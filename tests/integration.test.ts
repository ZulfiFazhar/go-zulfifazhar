import { describe, it, expect, mock } from "bun:test";
import app from "../workers/app";
import { signSessionJwt } from "../workers/modules/auth/auth.service";
import type { Env, UserSession } from "../workers/context";
import type { LinkRecord, UserRecord } from "../workers/db/queries";

interface MockD1State {
  links: Map<string, LinkRecord>;
  users: Map<string, UserRecord>;
  clicks: Array<{
    id: number;
    link_id: string;
    timestamp: number;
    country: string | null;
    referrer: string | null;
    user_agent: string | null;
  }>;
}

function createIntegrationTestEnv() {
  const kvStore = new Map<string, string>();
  const dbState: MockD1State = {
    links: new Map<string, LinkRecord>(),
    users: new Map<string, UserRecord>(),
    clicks: [],
  };

  const mockKv = {
    get: mock(async (key: string, format?: string) => {
      const val = kvStore.get(key);
      if (val === undefined) return null;
      if (format === "json") {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    }),
    put: mock(async (key: string, val: string) => {
      kvStore.set(key, val);
    }),
    delete: mock(async (key: string) => {
      kvStore.delete(key);
    }),
  } as unknown as KVNamespace;

  let clickIdSeq = 1;

  function executeStatement(query: string, boundArgs: any[]) {
    if (query.includes("INSERT INTO links")) {
      const [id, slug, target_url, user_id, clicks, created_at, updated_at] = boundArgs;
      dbState.links.set(id, { id, slug, target_url, user_id: user_id ?? null, clicks: clicks ?? 0, created_at, updated_at });
      return { success: true, meta: { changes: 1 } };
    }
    if (query.includes("UPDATE links SET clicks = clicks + 1")) {
      const [updated_at, id] = boundArgs;
      const link = dbState.links.get(id);
      if (link) {
        link.clicks = (link.clicks || 0) + 1;
        link.updated_at = updated_at;
        return { success: true, meta: { changes: 1 } };
      }
      return { success: true, meta: { changes: 0 } };
    }
    if (query.includes("INSERT INTO link_clicks")) {
      const [link_id, timestamp, country, referrer, user_agent] = boundArgs;
      dbState.clicks.push({
        id: clickIdSeq++,
        link_id,
        timestamp,
        country: country ?? null,
        referrer: referrer ?? null,
        user_agent: user_agent ?? null,
      });
      return { success: true, meta: { changes: 1 } };
    }
    if (query.includes("DELETE FROM links WHERE id = ? AND user_id = ?")) {
      const [id, userId] = boundArgs;
      const existing = dbState.links.get(id);
      if (existing && existing.user_id === userId) {
        dbState.links.delete(id);
        return { success: true, meta: { changes: 1 } };
      }
      return { success: true, meta: { changes: 0 } };
    }
    if (query.includes("INSERT INTO users")) {
      const [id, email, name, avatar_url, created_at] = boundArgs;
      dbState.users.set(id, { id, email, name, avatar_url, created_at });
      return { success: true, meta: { changes: 1 } };
    }
    return { success: true, meta: { changes: 0 } };
  }

  const mockDb = {
    prepare: mock((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: mock((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        run: mock(async () => executeStatement(query, boundArgs)),
        first: mock(async <T>() => {
          if (query.includes("FROM links WHERE slug = ?")) {
            const slug = boundArgs[0];
            for (const link of dbState.links.values()) {
              if (link.slug === slug) return { ...link } as unknown as T;
            }
            return null;
          }
          if (query.includes("SELECT id, slug, user_id FROM links WHERE id = ? AND user_id = ?")) {
            const [id, userId] = boundArgs;
            const link = dbState.links.get(id);
            if (link && link.user_id === userId) {
              return { id: link.id, slug: link.slug, user_id: link.user_id } as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM links WHERE id = ?")) {
            const id = boundArgs[0];
            const link = dbState.links.get(id);
            return link ? ({ ...link } as unknown as T) : null;
          }
          if (query.includes("FROM users WHERE email = ?")) {
            const email = boundArgs[0];
            for (const user of dbState.users.values()) {
              if (user.email === email) return { ...user } as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM users WHERE id = ?")) {
            const id = boundArgs[0];
            const user = dbState.users.get(id);
            return user ? ({ ...user } as unknown as T) : null;
          }
          return null;
        }),
        all: mock(async <T>() => {
          if (query.includes("FROM links WHERE user_id = ? ORDER BY created_at DESC")) {
            const userId = boundArgs[0];
            const results = Array.from(dbState.links.values())
              .filter((l) => l.user_id === userId)
              .sort((a, b) => b.created_at - a.created_at)
              .map((l) => ({ ...l }));
            return { success: true, results: results as unknown as T[] };
          }
          return { success: true, results: [] as unknown as T[] };
        }),
        _query: query,
        _getBoundArgs: () => boundArgs,
      };
      return stmt;
    }),
    batch: mock(async (statements: any[]) => {
      const results = [];
      for (const stmt of statements) {
        results.push(executeStatement(stmt._query, stmt._getBoundArgs()));
      }
      return results;
    }),
  } as unknown as D1Database;

  const env: Env = {
    SHORTENER_DB: mockDb,
    SHORTENER_CACHE: mockKv,
    BASE_URL: "https://go.zulfifazhar.dev",
    JWT_SECRET: "integration-test-secret-key-32chars-min!",
    GOOGLE_CLIENT_ID: "mock-google-client-id",
    GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  };

  return { env, mockKv, mockDb, kvStore, dbState };
}

function createWaitUntilContext() {
  const promises: Promise<any>[] = [];
  const ctx = {
    waitUntil: (p: Promise<any>) => {
      promises.push(p);
    },
    passThroughOnException: () => {},
  };
  const flush = async () => {
    await Promise.all(promises);
  };
  return { ctx, flush };
}

describe("End-to-End Integration Tests", () => {
  it("anonymous flow: create link -> edge redirect 302 -> click recorded in D1", async () => {
    const { env, kvStore, dbState } = createIntegrationTestEnv();

    // 1. Create anonymous link via POST /api/links
    const createReq = new Request("https://go.zulfifazhar.dev/api/links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com/anon-destination" }),
    });

    const createRes = await app.fetch(createReq, env);
    expect(createRes.status).toBe(201);
    const createData = (await createRes.json()) as any;

    expect(createData.id).toBeDefined();
    expect(createData.slug).toMatch(/^[A-Za-z0-9_-]{6}$/);
    expect(createData.targetUrl).toBe("https://example.com/anon-destination");
    expect(createData.shortUrl).toBe(`https://go.zulfifazhar.dev/${createData.slug}`);

    // Verify stored in D1 & KV
    const d1Link = dbState.links.get(createData.id);
    expect(d1Link).toBeDefined();
    expect(d1Link?.slug).toBe(createData.slug);
    expect(d1Link?.user_id).toBeNull();
    expect(d1Link?.clicks).toBe(0);

    const kvEntry = JSON.parse(kvStore.get(`slug:${createData.slug}`) || "{}");
    expect(kvEntry.id).toBe(createData.id);
    expect(kvEntry.targetUrl).toBe("https://example.com/anon-destination");

    // 2. Perform edge redirect via GET /:slug
    const { ctx, flush } = createWaitUntilContext();
    const redirectReq = new Request(`https://go.zulfifazhar.dev/${createData.slug}`, {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 IntegrationTestAgent",
        "Referer": "https://google.com/search?q=test",
        "CF-IPCountry": "ID",
      },
    });

    const redirectRes = await app.fetch(redirectReq, env, ctx);
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get("Location")).toBe("https://example.com/anon-destination");

    // Await background execution (waitUntil)
    await flush();

    // 3. Verify click recording in D1
    expect(d1Link?.clicks).toBe(1);
    expect(dbState.clicks).toHaveLength(1);
    const click = dbState.clicks[0];
    expect(click.link_id).toBe(createData.id);
    expect(click.country).toBe("ID");
    expect(click.referrer).toBe("https://google.com/search?q=test");
    expect(click.user_agent).toBe("Mozilla/5.0 IntegrationTestAgent");

    // Second redirect increment verification
    const { ctx: ctx2, flush: flush2 } = createWaitUntilContext();
    const redirectRes2 = await app.fetch(
      new Request(`https://go.zulfifazhar.dev/${createData.slug}`, {
        method: "GET",
        headers: { "CF-IPCountry": "US" },
      }),
      env,
      ctx2
    );
    expect(redirectRes2.status).toBe(302);
    await flush2();

    expect(d1Link?.clicks).toBe(2);
    expect(dbState.clicks).toHaveLength(2);
    expect(dbState.clicks[1].country).toBe("US");
  });

  it("authenticated flow: create custom slug -> list user links -> delete link -> verify KV eviction & 404 fallthrough", async () => {
    const { env, kvStore, dbState } = createIntegrationTestEnv();

    const user: UserSession = {
      userId: "user-alpha",
      email: "alpha@zulfifazhar.dev",
      name: "Alpha Developer",
    };

    // 1. Create authenticated session token
    const token = await signSessionJwt(user, env.JWT_SECRET);
    const authHeaders = {
      Cookie: `auth_session=${token}`,
    };

    // Verify /api/auth/me recognizes user session
    const meReq = new Request("https://go.zulfifazhar.dev/api/auth/me", {
      method: "GET",
      headers: authHeaders,
    });
    const meRes = await app.fetch(meReq, env);
    expect(meRes.status).toBe(200);
    const meData = (await meRes.json()) as any;
    expect(meData.user.userId).toBe(user.userId);
    expect(meData.user.email).toBe(user.email);

    // 2. Create link with custom slug
    const customSlug = "my-custom-portfolio";
    const createReq = new Request("https://go.zulfifazhar.dev/api/links", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders,
      },
      body: JSON.stringify({
        url: "https://zulfifazhar.dev",
        customSlug,
      }),
    });

    const createRes = await app.fetch(createReq, env);
    expect(createRes.status).toBe(201);
    const createdLink = (await createRes.json()) as any;

    expect(createdLink.slug).toBe(customSlug);
    expect(createdLink.targetUrl).toBe("https://zulfifazhar.dev");
    expect(createdLink.shortUrl).toBe(`https://go.zulfifazhar.dev/${customSlug}`);

    // Verify stored in D1 with user_id & cached in KV
    expect(dbState.links.get(createdLink.id)?.user_id).toBe(user.userId);
    expect(kvStore.has(`slug:${customSlug}`)).toBe(true);

    // 3. List user links via GET /api/user/links
    const listReq = new Request("https://go.zulfifazhar.dev/api/user/links", {
      method: "GET",
      headers: authHeaders,
    });
    const listRes = await app.fetch(listReq, env);
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as any;
    expect(listData.links).toHaveLength(1);
    expect(listData.links[0].id).toBe(createdLink.id);
    expect(listData.links[0].slug).toBe(customSlug);

    // 4. Edge redirect works for custom slug
    const { ctx, flush } = createWaitUntilContext();
    const redirectReq = new Request(`https://go.zulfifazhar.dev/${customSlug}`, { method: "GET" });
    const redirectRes = await app.fetch(redirectReq, env, ctx);
    expect(redirectRes.status).toBe(302);
    expect(redirectRes.headers.get("Location")).toBe("https://zulfifazhar.dev");
    await flush();

    // 5. Delete link via DELETE /api/user/links/:id
    const deleteReq = new Request(`https://go.zulfifazhar.dev/api/user/links/${createdLink.id}`, {
      method: "DELETE",
      headers: authHeaders,
    });
    const deleteRes = await app.fetch(deleteReq, env);
    expect(deleteRes.status).toBe(200);
    const deleteData = (await deleteRes.json()) as any;
    expect(deleteData.success).toBe(true);

    // 6. Verify KV eviction and D1 deletion
    expect(kvStore.has(`slug:${customSlug}`)).toBe(false);
    expect(dbState.links.has(createdLink.id)).toBe(false);

    // 7. Verify subsequent redirect falls through to SSR fallback
    const deadRedirectReq = new Request(`https://go.zulfifazhar.dev/${customSlug}`, { method: "GET" });
    const deadRedirectRes = await app.fetch(deadRedirectReq, env);
    expect(deadRedirectRes.status).toBe(500);
  });

  it("handles KV cache miss with D1 backfill and subsequent KV cache hit", async () => {
    const { env, kvStore, dbState } = createIntegrationTestEnv();

    // Pre-populate link only in D1 (simulating KV cold start or eviction)
    const slug = "cold-start-slug";
    const linkId = "cold-1";
    dbState.links.set(linkId, {
      id: linkId,
      slug,
      target_url: "https://docs.zulfifazhar.dev",
      user_id: null,
      clicks: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });

    expect(kvStore.has(`slug:${slug}`)).toBe(false);

    // First request: KV miss -> query D1 -> backfill KV -> redirect 302
    const { ctx: ctx1, flush: flush1 } = createWaitUntilContext();
    const req1 = new Request(`https://go.zulfifazhar.dev/${slug}`, { method: "GET" });
    const res1 = await app.fetch(req1, env, ctx1);
    expect(res1.status).toBe(302);
    expect(res1.headers.get("Location")).toBe("https://docs.zulfifazhar.dev");
    await flush1();

    // KV should now be backfilled
    expect(kvStore.has(`slug:${slug}`)).toBe(true);
    const cachedVal = JSON.parse(kvStore.get(`slug:${slug}`)!);
    expect(cachedVal.id).toBe(linkId);
    expect(cachedVal.targetUrl).toBe("https://docs.zulfifazhar.dev");
    expect(dbState.links.get(linkId)?.clicks).toBe(1);

    // Second request: KV cache hit -> redirect 302
    const { ctx: ctx2, flush: flush2 } = createWaitUntilContext();
    const req2 = new Request(`https://go.zulfifazhar.dev/${slug}`, { method: "GET" });
    const res2 = await app.fetch(req2, env, ctx2);
    expect(res2.status).toBe(302);
    expect(res2.headers.get("Location")).toBe("https://docs.zulfifazhar.dev");
    await flush2();

    expect(dbState.links.get(linkId)?.clicks).toBe(2);
  });
});

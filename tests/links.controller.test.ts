import { describe, it, expect, mock } from "bun:test";
import app from "../workers/app";
import { signSessionJwt } from "../workers/modules/auth/auth.service";
import type { Env, UserSession } from "../workers/context";
import type { LinkRecord } from "../workers/db/queries";

interface MockEnvOptions {
  initialLinks?: LinkRecord[];
  initialKv?: Record<string, string>;
}

function createTestEnv(options: MockEnvOptions = {}) {
  const linksMap = new Map<string, LinkRecord>();
  if (options.initialLinks) {
    for (const link of options.initialLinks) {
      linksMap.set(link.id, { ...link });
    }
  }

  const kvStore = new Map<string, string>();
  if (options.initialKv) {
    for (const [k, v] of Object.entries(options.initialKv)) {
      kvStore.set(k, v);
    }
  }

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

  const mockDb = {
    prepare: mock((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: mock((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        run: mock(async () => {
          if (query.includes("INSERT INTO links")) {
            const [id, slug, target_url, user_id, clicks, created_at, updated_at] = boundArgs;
            linksMap.set(id, { id, slug, target_url, user_id, clicks, created_at, updated_at });
            return { success: true, meta: { changes: 1 } };
          }
          if (query.includes("DELETE FROM links WHERE id = ? AND user_id = ?")) {
            const [id, userId] = boundArgs;
            const existing = linksMap.get(id);
            if (existing && existing.user_id === userId) {
              linksMap.delete(id);
              return { success: true, meta: { changes: 1 } };
            }
            return { success: true, meta: { changes: 0 } };
          }
          return { success: true, meta: { changes: 1 } };
        }),
        first: mock(async <T>() => {
          if (query.includes("FROM links WHERE slug = ?")) {
            const slug = boundArgs[0];
            for (const link of linksMap.values()) {
              if (link.slug === slug) return link as unknown as T;
            }
            return null;
          }
          if (query.includes("SELECT id, slug, user_id FROM links WHERE id = ? AND user_id = ?")) {
            const [id, userId] = boundArgs;
            const link = linksMap.get(id);
            if (link && link.user_id === userId) {
              return { id: link.id, slug: link.slug, user_id: link.user_id } as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM links WHERE id = ?")) {
            const id = boundArgs[0];
            return (linksMap.get(id) || null) as unknown as T;
          }
          return null;
        }),
        all: mock(async <T>() => {
          if (query.includes("FROM links WHERE user_id = ? ORDER BY created_at DESC")) {
            const userId = boundArgs[0];
            const results = Array.from(linksMap.values())
              .filter((l) => l.user_id === userId)
              .sort((a, b) => b.created_at - a.created_at);
            return { success: true, results: results as unknown as T[] };
          }
          return { success: true, results: [] as unknown as T[] };
        }),
      };
      return stmt;
    }),
    batch: mock(async () => [{ success: true }]),
  } as unknown as D1Database;

  const env: Env = {
    SHORTENER_DB: mockDb,
    SHORTENER_CACHE: mockKv,
    BASE_URL: "https://go.zulfifazhar.dev",
    JWT_SECRET: "test-secret-key-1234567890123456",
    GOOGLE_CLIENT_ID: "mock-google-client-id",
    GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
  };

  return { env, mockKv, mockDb, kvStore, linksMap };
}

describe("Links API Controller & Routes", () => {
  const userA: UserSession = {
    userId: "user-123",
    email: "user@example.com",
    name: "User A",
  };

  const userB: UserSession = {
    userId: "user-456",
    email: "other@example.com",
    name: "User B",
  };

  describe("POST /api/links", () => {
    it("creates shortlink anonymously with random slug", async () => {
      const { env, kvStore, linksMap } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/links",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "https://example.com/dest" }),
        },
        env
      );

      expect(res.status).toBe(201);
      const data: any = await res.json();
      expect(data.id).toBeDefined();
      expect(data.slug).toHaveLength(6);
      expect(data.targetUrl).toBe("https://example.com/dest");
      expect(data.shortUrl).toBe(`https://go.zulfifazhar.dev/${data.slug}`);

      // Verify stored in D1
      const saved = linksMap.get(data.id);
      expect(saved).toBeDefined();
      expect(saved?.user_id).toBeNull();
      expect(saved?.target_url).toBe("https://example.com/dest");

      // Verify stored in KV
      expect(kvStore.has(`slug:${data.slug}`)).toBe(true);
    });

    it("creates shortlink for authenticated user with custom slug", async () => {
      const { env, kvStore, linksMap } = createTestEnv();
      const token = await signSessionJwt(userA, env.JWT_SECRET);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/links",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `auth_session=${token}`,
          },
          body: JSON.stringify({
            url: "https://zulfifazhar.dev/portfolio",
            customSlug: "my-portfolio",
          }),
        },
        env
      );

      expect(res.status).toBe(201);
      const data: any = await res.json();
      expect(data.id).toBeDefined();
      expect(data.slug).toBe("my-portfolio");
      expect(data.targetUrl).toBe("https://zulfifazhar.dev/portfolio");
      expect(data.shortUrl).toBe("https://go.zulfifazhar.dev/my-portfolio");

      // Verify user_id assigned in D1
      const saved = linksMap.get(data.id);
      expect(saved?.user_id).toBe(userA.userId);

      // Verify KV sync
      const cached = JSON.parse(kvStore.get("slug:my-portfolio")!);
      expect(cached.targetUrl).toBe("https://zulfifazhar.dev/portfolio");
    });

    it("rejects custom slug when user is unauthenticated", async () => {
      const { env } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/links",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "https://example.com",
            customSlug: "hacker-slug",
          }),
        },
        env
      );

      expect(res.status).toBe(403);
      const data: any = await res.json();
      expect(data.error).toBe("Custom slug requires authentication");
    });

    it("rejects invalid destination URL", async () => {
      const { env } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/links",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: "ftp://invalid-url.com" }),
        },
        env
      );

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toBe("Invalid destination URL");
    });

    it("rejects malformed JSON body", async () => {
      const { env } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/links",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "not a json string",
        },
        env
      );

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toBe("Invalid JSON body");
    });

    it("rejects reserved slug for authenticated user", async () => {
      const { env } = createTestEnv();
      const token = await signSessionJwt(userA, env.JWT_SECRET);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/links",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `auth_session=${token}`,
          },
          body: JSON.stringify({
            url: "https://example.com",
            customSlug: "api",
          }),
        },
        env
      );

      expect(res.status).toBe(400);
      const data: any = await res.json();
      expect(data.error).toBe("Invalid or reserved slug");
    });

    it("rejects already taken custom slug with 409 Conflict", async () => {
      const initialLink: LinkRecord = {
        id: "link-existing",
        slug: "taken-slug",
        target_url: "https://example.com/original",
        user_id: "other",
        clicks: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      const { env } = createTestEnv({ initialLinks: [initialLink] });
      const token = await signSessionJwt(userA, env.JWT_SECRET);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/links",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `auth_session=${token}`,
          },
          body: JSON.stringify({
            url: "https://example.com/new",
            customSlug: "taken-slug",
          }),
        },
        env
      );

      expect(res.status).toBe(409);
      const data: any = await res.json();
      expect(data.error).toBe("Slug already in use");
    });
  });

  describe("GET /api/user/links", () => {
    it("returns 401 Unauthorized when session is missing", async () => {
      const { env } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/user/links",
        { method: "GET" },
        env
      );

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 Unauthorized when session cookie is invalid or expired", async () => {
      const { env } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/user/links",
        {
          method: "GET",
          headers: { Cookie: "auth_session=invalid.token.here" },
        },
        env
      );

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns links created by authenticated user sorted by created_at DESC", async () => {
      const link1: LinkRecord = {
        id: "l1",
        slug: "link-1",
        target_url: "https://example.com/1",
        user_id: userA.userId,
        clicks: 5,
        created_at: 1000,
        updated_at: 1000,
      };
      const link2: LinkRecord = {
        id: "l2",
        slug: "link-2",
        target_url: "https://example.com/2",
        user_id: userA.userId,
        clicks: 12,
        created_at: 2000,
        updated_at: 2000,
      };
      const linkOther: LinkRecord = {
        id: "l3",
        slug: "link-other",
        target_url: "https://example.com/other",
        user_id: userB.userId,
        clicks: 0,
        created_at: 1500,
        updated_at: 1500,
      };

      const { env } = createTestEnv({ initialLinks: [link1, link2, linkOther] });
      const token = await signSessionJwt(userA, env.JWT_SECRET);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/user/links",
        {
          method: "GET",
          headers: { Cookie: `auth_session=${token}` },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(Array.isArray(data.links)).toBe(true);
      expect(data.links).toHaveLength(2);
      // Sorted DESC
      expect(data.links[0].id).toBe("l2");
      expect(data.links[1].id).toBe("l1");
      expect(data.links[0].targetUrl).toBe("https://example.com/2");
      expect(data.links[0].shortUrl).toBe("https://go.zulfifazhar.dev/link-2");
    });
  });

  describe("DELETE /api/user/links/:id", () => {
    it("returns 401 Unauthorized without session", async () => {
      const { env } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/user/links/link-123",
        { method: "DELETE" },
        env
      );

      expect(res.status).toBe(401);
      const data: any = await res.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when link does not exist", async () => {
      const { env } = createTestEnv();
      const token = await signSessionJwt(userA, env.JWT_SECRET);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/user/links/nonexistent",
        {
          method: "DELETE",
          headers: { Cookie: `auth_session=${token}` },
        },
        env
      );

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error).toBe("Link not found");
    });

    it("returns 404 when link belongs to another user", async () => {
      const linkOther: LinkRecord = {
        id: "link-b",
        slug: "slug-b",
        target_url: "https://example.com/b",
        user_id: userB.userId,
        clicks: 0,
        created_at: 1000,
        updated_at: 1000,
      };

      const { env } = createTestEnv({ initialLinks: [linkOther] });
      const tokenA = await signSessionJwt(userA, env.JWT_SECRET);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/user/links/link-b",
        {
          method: "DELETE",
          headers: { Cookie: `auth_session=${tokenA}` },
        },
        env
      );

      expect(res.status).toBe(404);
      const data: any = await res.json();
      expect(data.error).toBe("Link not found");
    });

    it("deletes link from D1 and evicts slug from KV cache", async () => {
      const myLink: LinkRecord = {
        id: "link-del",
        slug: "delete-me",
        target_url: "https://example.com/to-delete",
        user_id: userA.userId,
        clicks: 1,
        created_at: 1000,
        updated_at: 1000,
      };

      const { env, mockKv, kvStore, linksMap } = createTestEnv({
        initialLinks: [myLink],
        initialKv: { "slug:delete-me": JSON.stringify({ id: "link-del", targetUrl: myLink.target_url }) },
      });
      const token = await signSessionJwt(userA, env.JWT_SECRET);

      expect(kvStore.has("slug:delete-me")).toBe(true);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/user/links/link-del",
        {
          method: "DELETE",
          headers: { Cookie: `auth_session=${token}` },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.success).toBe(true);

      // Verify removed from D1
      expect(linksMap.has("link-del")).toBe(false);

      // Verify evicted from KV
      expect(mockKv.delete).toHaveBeenCalledWith("slug:delete-me");
      expect(kvStore.has("slug:delete-me")).toBe(false);
    });
  });

  describe("Full App Integration Routing", () => {
    it("routes /api/auth/me correctly", async () => {
      const { env } = createTestEnv();
      const token = await signSessionJwt(userA, env.JWT_SECRET);

      const res = await app.request(
        "https://go.zulfifazhar.dev/api/auth/me",
        {
          method: "GET",
          headers: { Cookie: `auth_session=${token}` },
        },
        env
      );

      expect(res.status).toBe(200);
      const data: any = await res.json();
      expect(data.user.userId).toBe(userA.userId);
      expect(data.user.email).toBe(userA.email);
    });

    it("intercepts /:slug for edge redirection on hit", async () => {
      const { env } = createTestEnv({
        initialKv: { "slug:fast-redirect": JSON.stringify({ id: "l-fast", targetUrl: "https://fast.example.com" }) },
      });

      const res = await app.request(
        "https://go.zulfifazhar.dev/fast-redirect",
        { method: "GET" },
        env
      );

      expect(res.status).toBe(302);
      expect(res.headers.get("Location")).toBe("https://fast.example.com");
    });

    it("falls through /:slug on cache/D1 miss to SSR fallback", async () => {
      const { env } = createTestEnv();

      const res = await app.request(
        "https://go.zulfifazhar.dev/nonexistent-slug",
        { method: "GET" },
        env
      );

      // In bun test without virtual:react-router build, the fallback catches and returns 404
      expect(res.status).toBe(404);
      expect(await res.text()).toBe("Not Found");
    });
  });
});

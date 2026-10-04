import { describe, it, expect, mock } from "bun:test";
import {
  sanitizeSlug,
  isValidUrl,
  generateRandomSlug,
  createShortLink,
  RESERVED_SLUGS,
  type ShortLinkResult,
} from "../workers/modules/links/links.service";
import type { Env } from "../workers/context";

function createMockEnv(existingSlugs: string[] = []) {
  const kvStore = new Map<string, string>();
  const dbRows = new Map<string, any>();

  for (const s of existingSlugs) {
    dbRows.set(s, {
      id: `id-${s}`,
      slug: s,
      target_url: `https://existing.com/${s}`,
      user_id: "user-1",
      clicks: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    });
  }

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
            dbRows.set(slug, { id, slug, target_url, user_id, clicks, created_at, updated_at });
          }
          return { success: true, meta: { changes: 1 } };
        }),
        first: mock(async <T>() => {
          if (query.includes("FROM links WHERE slug = ?")) {
            const slug = boundArgs[0];
            return (dbRows.get(slug) || null) as unknown as T;
          }
          return null;
        }),
        all: mock(async <T>() => ({ success: true, results: [] as unknown as T[] })),
      };
      return stmt;
    }),
    batch: mock(async () => []),
  } as unknown as D1Database;

  const mockKv = {
    get: mock(async (key: string, format?: string) => {
      const val = kvStore.get(key) || null;
      if (val && format === "json") return JSON.parse(val);
      return val;
    }),
    put: mock(async (key: string, val: string) => {
      kvStore.set(key, val);
    }),
    delete: mock(async (key: string) => {
      kvStore.delete(key);
    }),
  } as unknown as KVNamespace;

  const env: Env = {
    SHORTENER_DB: mockDb,
    SHORTENER_CACHE: mockKv,
    BASE_URL: "https://go.zulfifazhar.dev",
    JWT_SECRET: "test-secret-12345",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
  };

  return { env, mockDb, mockKv, kvStore, dbRows };
}

describe("Link Validation Logic", () => {
  it("rejects invalid URLs and non-http/https protocols", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://files.example.com")).toBe(false);
    expect(isValidUrl("data:text/html,test")).toBe(false);
    expect(isValidUrl("")).toBe(false);
    expect(isValidUrl("   ")).toBe(false);
    expect(isValidUrl("https://zulfifazhar.dev")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
    expect(isValidUrl("https://example.com/path?foo=bar#hash")).toBe(true);
  });

  it("sanitizes and validates custom slugs", () => {
    expect(sanitizeSlug("My-Slug_123")).toBe("My-Slug_123");
    expect(sanitizeSlug("invalid space")).toBeNull();
    expect(sanitizeSlug("invalid/slash")).toBeNull();
    expect(sanitizeSlug("")).toBeNull();
    expect(sanitizeSlug("   ")).toBeNull();
  });

  it("blocks all reserved slugs in case-insensitive manner", () => {
    const reservedList = [
      "api",
      "dashboard",
      "assets",
      "favicon.ico",
      "build",
      "_",
      "cdn-cgi",
    ];

    for (const reserved of reservedList) {
      expect(RESERVED_SLUGS.has(reserved)).toBe(true);
      expect(sanitizeSlug(reserved)).toBeNull();
      expect(sanitizeSlug(reserved.toUpperCase())).toBeNull();
    }
  });
});

describe("Slug Generator", () => {
  it("generates random slug with default length 6", () => {
    const slug = generateRandomSlug();
    expect(slug).toBeDefined();
    expect(slug.length).toBe(6);
    expect(/^[a-zA-Z0-9]+$/.test(slug)).toBe(true);
    expect(RESERVED_SLUGS.has(slug.toLowerCase())).toBe(false);
  });

  it("generates random slug with custom length", () => {
    const slug8 = generateRandomSlug(8);
    expect(slug8.length).toBe(8);

    const slug12 = generateRandomSlug(12);
    expect(slug12.length).toBe(12);
  });

  it("generates unique values across multiple invocations", () => {
    const set = new Set<string>();
    for (let i = 0; i < 50; i++) {
      set.add(generateRandomSlug());
    }
    expect(set.size).toBe(50);
  });
});

describe("createShortLink Service", () => {
  it("creates shortlink with random slug when customSlug omitted", async () => {
    const { env, kvStore, dbRows } = createMockEnv();
    const result: ShortLinkResult = await createShortLink(env, {
      url: "https://zulfifazhar.dev/projects",
    });

    expect(result.id).toBeDefined();
    expect(result.slug).toBeDefined();
    expect(result.slug.length).toBe(6);
    expect(result.targetUrl).toBe("https://zulfifazhar.dev/projects");
    expect(result.shortUrl).toBe(`https://go.zulfifazhar.dev/${result.slug}`);
    expect(result.userId).toBeNull();
    expect(result.clicks).toBe(0);

    // Verify stored in DB
    expect(dbRows.has(result.slug)).toBe(true);

    // Verify populated into KV cache
    const cachedRaw = kvStore.get(`slug:${result.slug}`);
    expect(cachedRaw).toBeDefined();
    const parsedCache = JSON.parse(cachedRaw!);
    expect(parsedCache.id).toBe(result.id);
    expect(parsedCache.targetUrl).toBe(result.targetUrl);
  });

  it("creates shortlink with valid customSlug and userId", async () => {
    const { env, kvStore, dbRows } = createMockEnv();
    const result = await createShortLink(env, {
      url: "https://github.com/zulfifazhar",
      customSlug: "github",
      userId: "user_abc123",
    });

    expect(result.slug).toBe("github");
    expect(result.userId).toBe("user_abc123");
    expect(result.shortUrl).toBe("https://go.zulfifazhar.dev/github");
    expect(dbRows.get("github")?.user_id).toBe("user_abc123");

    const cachedRaw = kvStore.get("slug:github");
    expect(cachedRaw).toBeDefined();
    expect(JSON.parse(cachedRaw!).targetUrl).toBe("https://github.com/zulfifazhar");
  });

  it("rejects invalid destination URL", async () => {
    const { env } = createMockEnv();
    expect(
      createShortLink(env, { url: "javascript:alert(1)" })
    ).rejects.toThrow("Invalid destination URL");

    expect(
      createShortLink(env, { url: "not-a-valid-url" })
    ).rejects.toThrow("Invalid destination URL");
  });

  it("rejects reserved custom slug", async () => {
    const { env } = createMockEnv();
    expect(
      createShortLink(env, { url: "https://example.com", customSlug: "api" })
    ).rejects.toThrow("Invalid or reserved slug");

    expect(
      createShortLink(env, { url: "https://example.com", customSlug: "Dashboard" })
    ).rejects.toThrow("Invalid or reserved slug");
  });

  it("rejects invalid characters in custom slug", async () => {
    const { env } = createMockEnv();
    expect(
      createShortLink(env, { url: "https://example.com", customSlug: "has space" })
    ).rejects.toThrow("Invalid or reserved slug");
  });

  it("rejects custom slug if already taken", async () => {
    const { env } = createMockEnv(["taken-slug"]);
    expect(
      createShortLink(env, { url: "https://example.com", customSlug: "taken-slug" })
    ).rejects.toThrow("Slug already in use");
  });

  it("regenerates random slug on collision until a unique slug is found", async () => {
    const { env, mockDb } = createMockEnv();
    let collisionCount = 0;
    const queriedSlugs: string[] = [];

    (mockDb.prepare as any) = mock((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: mock((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        run: mock(async () => ({ success: true, meta: { changes: 1 } })),
        first: mock(async <T>() => {
          if (query.includes("FROM links WHERE slug = ?")) {
            const slug = boundArgs[0];
            queriedSlugs.push(slug);
            if (collisionCount < 2) {
              collisionCount++;
              return { id: "existing", slug } as unknown as T;
            }
            return null;
          }
          return null;
        }),
        all: mock(async <T>() => ({ success: true, results: [] as unknown as T[] })),
      };
      return stmt;
    });

    const result = await createShortLink(env, { url: "https://example.com" });
    expect(result.slug).toBeDefined();
    expect(queriedSlugs.length).toBe(3);
    expect(queriedSlugs[0]).not.toBe(queriedSlugs[1]);
    expect(queriedSlugs[1]).not.toBe(queriedSlugs[2]);
    expect(result.slug).toBe(queriedSlugs[2]);
  });

  it("throws error when random slug collisions exceed retry limit", async () => {
    const { env, mockDb } = createMockEnv();
    (mockDb.prepare as any) = mock((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: mock((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        run: mock(async () => ({ success: true, meta: { changes: 1 } })),
        first: mock(async <T>() => {
          if (query.includes("FROM links WHERE slug = ?")) {
            return { id: "existing", slug: boundArgs[0] } as unknown as T;
          }
          return null;
        }),
        all: mock(async <T>() => ({ success: true, results: [] as unknown as T[] })),
      };
      return stmt;
    });

    expect(
      createShortLink(env, { url: "https://example.com" })
    ).rejects.toThrow("Failed to generate unique slug");
  });
});

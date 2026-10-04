import { describe, it, expect, mock } from "bun:test";
import { Hono } from "hono";
import {
  handleEdgeRedirect,
  recordClick,
  extractClickMeta,
} from "../workers/modules/redirect/redirect.controller";
import type { Env } from "../workers/context";

function createMockEnv(initialKv: Record<string, any> = {}, initialDbLinks: Record<string, any> = {}) {
  const kvStore = new Map<string, any>(Object.entries(initialKv));
  const dbLinks = new Map<string, any>(Object.entries(initialDbLinks));
  const trackedClicks: Array<{ linkId: string; meta: any }> = [];

  const mockKv = {
    get: mock(async (key: string, format?: string) => {
      const val = kvStore.get(key);
      if (val === undefined) return null;
      if (typeof val === "string" && format === "json") {
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
        run: mock(async () => ({ success: true, meta: { changes: 1 } })),
        first: mock(async <T>() => {
          if (query.includes("FROM links WHERE slug = ?")) {
            const slug = boundArgs[0];
            return (dbLinks.get(slug) || null) as unknown as T;
          }
          return null;
        }),
        all: mock(async <T>() => ({ success: true, results: [] as unknown as T[] })),
      };
      return stmt;
    }),
    batch: mock(async (statements: any[]) => {
      return statements.map(() => ({ success: true }));
    }),
  } as unknown as D1Database;

  const env: Env = {
    SHORTENER_DB: mockDb,
    SHORTENER_CACHE: mockKv,
    BASE_URL: "https://go.zulfifazhar.dev",
    JWT_SECRET: "test-secret-12345",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
  };

  return { env, mockKv, mockDb, kvStore, dbLinks, trackedClicks };
}

describe("Edge Redirection Handler", () => {
  it("resolves KV cache hit directly", async () => {
    const mockKv = {
      get: mock(() => Promise.resolve({ id: "1", targetUrl: "https://example.com" })),
    };
    const cached = await mockKv.get("slug:test");
    expect(cached?.targetUrl).toBe("https://example.com");
  });

  it("redirects 302 directly on KV cache hit without querying D1", async () => {
    const { env, mockDb, mockKv } = createMockEnv({
      "slug:my-doc": JSON.stringify({ id: "link-123", targetUrl: "https://docs.example.com" }),
    });

    const waitUntilMock = mock((promise: Promise<any>) => promise);
    const mockContext = {
      req: {
        param: (key: string) => (key === "slug" ? "my-doc" : undefined),
        header: () => null,
        url: "https://go.zulfifazhar.dev/my-doc",
        raw: new Request("https://go.zulfifazhar.dev/my-doc"),
      },
      env,
      executionCtx: {
        waitUntil: waitUntilMock,
      },
      redirect: mock((url: string, status?: number) => {
        return new Response(null, { status: status || 302, headers: { Location: url } });
      }),
    } as any;

    const res = await handleEdgeRedirect(mockContext);

    expect(res).not.toBeNull();
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("https://docs.example.com");
    expect(mockContext.redirect).toHaveBeenCalledWith("https://docs.example.com", 302);
    const selectCalls = mockDb.prepare.mock.calls.filter(([query]: [string]) =>
      query.includes("FROM links WHERE slug = ?")
    );
    expect(selectCalls.length).toBe(0);
    expect(mockDb.batch).toHaveBeenCalledTimes(1);
    expect(waitUntilMock).toHaveBeenCalledTimes(1);
  });

  it("handles KV cache hit when KV returns parsed object directly", async () => {
    const { env } = createMockEnv({
      "slug:obj-slug": { id: "link-456", targetUrl: "https://example.org/obj" },
    });

    const waitUntilMock = mock(() => {});
    const mockContext = {
      req: {
        param: (key: string) => (key === "slug" ? "obj-slug" : undefined),
        header: () => null,
        url: "https://go.zulfifazhar.dev/obj-slug",
        raw: new Request("https://go.zulfifazhar.dev/obj-slug"),
      },
      env,
      executionCtx: { waitUntil: waitUntilMock },
      redirect: (url: string, status?: number) =>
        new Response(null, { status: status || 302, headers: { Location: url } }),
    } as any;

    const res = await handleEdgeRedirect(mockContext);
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("https://example.org/obj");
    expect(waitUntilMock).toHaveBeenCalledTimes(1);
  });

  it("queries D1, backfills KV, and redirects on KV cache miss", async () => {
    const { env, mockKv, kvStore } = createMockEnv(
      {},
      {
        github: {
          id: "link-gh",
          slug: "github",
          target_url: "https://github.com/zulfifazhar",
          user_id: "user-1",
          clicks: 10,
          created_at: 1000,
          updated_at: 1000,
        },
      }
    );

    const waitUntilMock = mock((promise: Promise<any>) => promise);
    const mockContext = {
      req: {
        param: (key: string) => (key === "slug" ? "github" : undefined),
        header: (name: string) => {
          if (name.toLowerCase() === "cf-ipcountry") return "SG";
          if (name.toLowerCase() === "referer") return "https://google.com";
          if (name.toLowerCase() === "user-agent") return "curl/7.68.0";
          return null;
        },
        url: "https://go.zulfifazhar.dev/github",
        raw: new Request("https://go.zulfifazhar.dev/github"),
      },
      env,
      executionCtx: { waitUntil: waitUntilMock },
      redirect: (url: string, status?: number) =>
        new Response(null, { status: status || 302, headers: { Location: url } }),
    } as any;

    const res = await handleEdgeRedirect(mockContext);

    expect(res).not.toBeNull();
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("https://github.com/zulfifazhar");

    // Verify KV was backfilled
    expect(mockKv.put).toHaveBeenCalledTimes(1);
    const backfilledRaw = kvStore.get("slug:github");
    expect(backfilledRaw).toBeDefined();
    const backfilled = typeof backfilledRaw === "string" ? JSON.parse(backfilledRaw) : backfilledRaw;
    expect(backfilled.id).toBe("link-gh");
    expect(backfilled.targetUrl).toBe("https://github.com/zulfifazhar");

    // Verify waitUntil called for tracking
    expect(waitUntilMock).toHaveBeenCalledTimes(1);
  });

  it("returns null when slug is not found in KV or D1", async () => {
    const { env, mockDb } = createMockEnv();

    const waitUntilMock = mock(() => {});
    const mockContext = {
      req: {
        param: (key: string) => (key === "slug" ? "missing-link" : undefined),
        header: () => null,
        url: "https://go.zulfifazhar.dev/missing-link",
        raw: new Request("https://go.zulfifazhar.dev/missing-link"),
      },
      env,
      executionCtx: { waitUntil: waitUntilMock },
      redirect: (url: string, status?: number) =>
        new Response(null, { status: status || 302, headers: { Location: url } }),
    } as any;

    const res = await handleEdgeRedirect(mockContext);
    expect(res).toBeNull();
    expect(mockDb.prepare).toHaveBeenCalledTimes(1);
    expect(waitUntilMock).not.toHaveBeenCalled();
  });

  it("returns null immediately for reserved slugs without querying KV or D1", async () => {
    const reservedSlugs = [
      "api",
      "dashboard",
      "assets",
      "favicon.ico",
      "build",
      "_",
      "cdn-cgi",
      "API",
      "Dashboard",
    ];

    for (const reserved of reservedSlugs) {
      const { env, mockKv, mockDb } = createMockEnv();
      const waitUntilMock = mock(() => {});
      const mockContext = {
        req: {
          param: (key: string) => (key === "slug" ? reserved : undefined),
          header: () => null,
          url: `https://go.zulfifazhar.dev/${reserved}`,
          raw: new Request(`https://go.zulfifazhar.dev/${reserved}`),
        },
        env,
        executionCtx: { waitUntil: waitUntilMock },
        redirect: (url: string, status?: number) =>
          new Response(null, { status: status || 302, headers: { Location: url } }),
      } as any;

      const res = await handleEdgeRedirect(mockContext);
      expect(res).toBeNull();
      expect(mockKv.get).not.toHaveBeenCalled();
      expect(mockDb.prepare).not.toHaveBeenCalled();
      expect(waitUntilMock).not.toHaveBeenCalled();
    }
  });

  it("returns null when slug is empty or missing", async () => {
    const { env, mockKv, mockDb } = createMockEnv();
    const mockContext = {
      req: {
        param: () => undefined,
        header: () => null,
        url: "https://go.zulfifazhar.dev/",
        raw: new Request("https://go.zulfifazhar.dev/"),
      },
      env,
      executionCtx: { waitUntil: mock(() => {}) },
      redirect: (url: string) => new Response(null, { status: 302, headers: { Location: url } }),
    } as any;

    const res = await handleEdgeRedirect(mockContext);
    expect(res).toBeNull();
    expect(mockKv.get).not.toHaveBeenCalled();
    expect(mockDb.prepare).not.toHaveBeenCalled();
  });

  it("extracts slug from URL pathname when req.param is missing", async () => {
    const { env } = createMockEnv({
      "slug:from-path": { id: "link-p", targetUrl: "https://example.com/from-path" },
    });

    const mockContext = {
      req: {
        header: () => null,
        url: "https://go.zulfifazhar.dev/from-path",
        raw: new Request("https://go.zulfifazhar.dev/from-path"),
      },
      env,
      executionCtx: { waitUntil: mock(() => {}) },
      redirect: (url: string, status?: number) =>
        new Response(null, { status: status || 302, headers: { Location: url } }),
    } as any;

    const res = await handleEdgeRedirect(mockContext);
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("https://example.com/from-path");
  });

  it("extracts click metadata correctly from headers and cf object", () => {
    const mockContext1 = {
      req: {
        header: (name: string) => {
          if (name === "cf-ipcountry") return "ID";
          if (name === "referer") return "https://twitter.com";
          if (name === "user-agent") return "Mozilla/5.0";
          return null;
        },
        raw: new Request("https://go.zulfifazhar.dev/test"),
      },
    } as any;

    const meta1 = extractClickMeta(mockContext1);
    expect(meta1.country).toBe("ID");
    expect(meta1.referrer).toBe("https://twitter.com");
    expect(meta1.user_agent).toBe("Mozilla/5.0");

    // Test fallback to req.raw.cf
    const mockContext2 = {
      req: {
        header: () => null,
        raw: {
          cf: { country: "US" },
          headers: new Headers(),
        },
      },
    } as any;

    const meta2 = extractClickMeta(mockContext2);
    expect(meta2.country).toBe("US");
    expect(meta2.referrer).toBeNull();
    expect(meta2.user_agent).toBeNull();
  });

  it("works without executionCtx without throwing", async () => {
    const { env } = createMockEnv({
      "slug:no-ctx": { id: "link-no-ctx", targetUrl: "https://example.com/no-ctx" },
    });

    const mockContext = {
      req: {
        param: (key: string) => (key === "slug" ? "no-ctx" : undefined),
        header: () => null,
        url: "https://go.zulfifazhar.dev/no-ctx",
        raw: new Request("https://go.zulfifazhar.dev/no-ctx"),
      },
      env,
      // executionCtx is undefined
      redirect: (url: string, status?: number) =>
        new Response(null, { status: status || 302, headers: { Location: url } }),
    } as any;

    const res = await handleEdgeRedirect(mockContext);
    expect(res?.status).toBe(302);
    expect(res?.headers.get("Location")).toBe("https://example.com/no-ctx");
  });

  it("integrates with Hono router and falls through on null", async () => {
    const { env } = createMockEnv({
      "slug:hono-test": { id: "link-hono", targetUrl: "https://example.com/hono" },
    });

    const app = new Hono<{ Bindings: Env }>();

    app.get("/:slug", async (c) => {
      const redirectResponse = await handleEdgeRedirect(c);
      if (redirectResponse) return redirectResponse;
      return c.text("Fallback to React Router", 404);
    });

    // Hit existing slug
    const hitRes = await app.request("https://go.zulfifazhar.dev/hono-test", {}, env);
    expect(hitRes.status).toBe(302);
    expect(hitRes.headers.get("Location")).toBe("https://example.com/hono");

    // Hit reserved slug
    const reservedRes = await app.request("https://go.zulfifazhar.dev/api", {}, env);
    expect(reservedRes.status).toBe(404);
    expect(await reservedRes.text()).toBe("Fallback to React Router");

    // Hit nonexistent slug
    const missRes = await app.request("https://go.zulfifazhar.dev/nonexistent", {}, env);
    expect(missRes.status).toBe(404);
    expect(await missRes.text()).toBe("Fallback to React Router");
  });
});

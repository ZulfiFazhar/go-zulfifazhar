import { describe, it, expect, mock, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import {
  signSessionJwt,
  verifySessionJwt,
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from "../workers/modules/auth/auth.service";
import { authMiddleware, requireAuth } from "../workers/modules/auth/auth.middleware";
import { authRoutes } from "../workers/modules/auth/auth.controller";
import type { AppEnv, Env, UserSession } from "../workers/context";

function createMockEnv(overrides: Partial<Env> = {}): Env {
  const usersTable = new Map<string, any>();

  const mockDb = {
    prepare: mock((query: string) => {
      let boundArgs: any[] = [];
      const stmt = {
        bind: mock((...args: any[]) => {
          boundArgs = args;
          return stmt;
        }),
        run: mock(async () => {
          if (query.includes("INSERT INTO users")) {
            const [id, email, name, avatar_url, created_at] = boundArgs;
            usersTable.set(id, { id, email, name, avatar_url, created_at });
          }
          return { success: true, meta: { changes: 1 } };
        }),
        first: mock(async <T>() => {
          if (query.includes("FROM users WHERE email = ?")) {
            const email = boundArgs[0];
            for (const u of usersTable.values()) {
              if (u.email === email) return u as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM users WHERE id = ?")) {
            const id = boundArgs[0];
            return (usersTable.get(id) || null) as unknown as T;
          }
          return null;
        }),
        all: mock(async <T>() => ({ success: true, results: [] as unknown as T[] })),
      };
      return stmt;
    }),
  } as unknown as D1Database;

  const mockKv = {
    get: mock(async () => null),
    put: mock(async () => {}),
    delete: mock(async () => {}),
  } as unknown as KVNamespace;

  return {
    SHORTENER_DB: mockDb,
    SHORTENER_CACHE: mockKv,
    BASE_URL: "https://go.zulfifazhar.dev",
    JWT_SECRET: "test-secret-key-1234567890123456",
    GOOGLE_CLIENT_ID: "mock-google-client-id",
    GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
    ...overrides,
  };
}

describe("Auth Session JWT", () => {
  const secret = "test-secret-key-1234567890123456";

  it("signs and verifies HMAC-SHA256 session token", async () => {
    const payload: UserSession = { userId: "user_1", email: "test@example.com", name: "Zulfi" };
    const token = await signSessionJwt(payload, secret);
    expect(typeof token).toBe("string");

    const verified = await verifySessionJwt(token, secret);
    expect(verified?.userId).toBe("user_1");
    expect(verified?.email).toBe("test@example.com");
    expect(verified?.name).toBe("Zulfi");
  });

  it("rejects tampered token", async () => {
    const payload: UserSession = { userId: "user_1", email: "test@example.com", name: "Zulfi" };
    const token = await signSessionJwt(payload, secret);
    const tampered = token.slice(0, -5) + "abcde";
    const verified = await verifySessionJwt(tampered, secret);
    expect(verified).toBeNull();
  });

  it("rejects token with wrong secret", async () => {
    const payload: UserSession = { userId: "user_1", email: "test@example.com" };
    const token = await signSessionJwt(payload, secret);
    const verified = await verifySessionJwt(token, "wrong-secret-key-0987654321");
    expect(verified).toBeNull();
  });

  it("rejects token missing exp claim", async () => {
    // Manually sign a token without exp
    const enc = new TextEncoder();
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const payload = btoa(JSON.stringify({ userId: "u_no_exp", email: "noexp@example.com" }))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const dataToSign = `${header}.${payload}`;

    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, enc.encode(dataToSign));
    const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const token = `${dataToSign}.${signatureB64}`;

    const verified = await verifySessionJwt(token, secret);
    expect(verified).toBeNull();
  });

  it("rejects expired token", async () => {
    const payload: UserSession = { userId: "user_1", email: "test@example.com" };
    // Expires immediately (-1 second)
    const token = await signSessionJwt(payload, secret, -1);
    const verified = await verifySessionJwt(token, secret);
    expect(verified).toBeNull();
  });

  it("rejects malformed tokens", async () => {
    expect(await verifySessionJwt("", secret)).toBeNull();
    expect(await verifySessionJwt("invalid-token", secret)).toBeNull();
    expect(await verifySessionJwt("a.b", secret)).toBeNull();
    expect(await verifySessionJwt("a.b.c.d", secret)).toBeNull();
    expect(await verifySessionJwt("notbase64.notbase64.notbase64", secret)).toBeNull();
  });

  it("preserves optional properties and handles unicode", async () => {
    const payload: UserSession = {
      userId: "user_unicode",
      email: "test@example.com",
      name: "Zülfi Fazhar 🚀",
      avatarUrl: "https://example.com/avatar.png",
    };
    const token = await signSessionJwt(payload, secret);
    const verified = await verifySessionJwt(token, secret);
    expect(verified?.userId).toBe("user_unicode");
    expect(verified?.email).toBe("test@example.com");
    expect(verified?.name).toBe("Zülfi Fazhar 🚀");
    expect(verified?.avatarUrl).toBe("https://example.com/avatar.png");
  });
});

describe("Google OAuth Helpers", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("builds valid Google OAuth authorization URL", () => {
    const urlStr = buildGoogleAuthUrl({
      clientId: "my-client-id",
      redirectUri: "https://example.com/api/auth/callback",
      state: "csrf-state-123",
    });
    const parsed = new URL(urlStr);
    expect(parsed.origin).toBe("https://accounts.google.com");
    expect(parsed.pathname).toBe("/o/oauth2/v2/auth");
    expect(parsed.searchParams.get("client_id")).toBe("my-client-id");
    expect(parsed.searchParams.get("redirect_uri")).toBe("https://example.com/api/auth/callback");
    expect(parsed.searchParams.get("state")).toBe("csrf-state-123");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("openid email profile");
  });

  it("exchanges Google code for tokens", async () => {
    globalThis.fetch = mock(async (input: any, init?: any) => {
      expect(input.toString()).toBe("https://oauth2.googleapis.com/token");
      expect(init?.method).toBe("POST");
      return new Response(
        JSON.stringify({
          access_token: "mock-access-token",
          id_token: "mock-id-token",
          token_type: "Bearer",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const tokens = await exchangeGoogleCode(
      "code-123",
      "client-id",
      "client-secret",
      "https://example.com/callback"
    );
    expect(tokens.access_token).toBe("mock-access-token");
  });

  it("throws when Google code exchange fails", async () => {
    globalThis.fetch = mock(async () => {
      return new Response("invalid_grant", { status: 400 });
    });

    expect(
      exchangeGoogleCode("bad-code", "client-id", "client-secret", "https://example.com/callback")
    ).rejects.toThrow("Google token exchange failed");
  });

  it("fetches Google userinfo", async () => {
    globalThis.fetch = mock(async (input: any, init?: any) => {
      expect(input.toString()).toBe("https://www.googleapis.com/oauth2/v2/userinfo");
      expect(init?.headers?.Authorization).toBe("Bearer mock-token");
      return new Response(
        JSON.stringify({
          id: "google-uid-1",
          email: "user@gmail.com",
          name: "Google User",
          picture: "https://lh3.google.com/pic.jpg",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const profile = await fetchGoogleUserInfo("mock-token");
    expect(profile.id).toBe("google-uid-1");
    expect(profile.email).toBe("user@gmail.com");
    expect(profile.name).toBe("Google User");
    expect(profile.picture).toBe("https://lh3.google.com/pic.jpg");
  });
});

describe("Auth Middleware", () => {
  const env = createMockEnv();

  it("attaches user to context when valid session cookie present", async () => {
    const token = await signSessionJwt(
      { userId: "u1", email: "u1@example.com", name: "User 1" },
      env.JWT_SECRET
    );

    const app = new Hono<AppEnv>();
    app.use("*", authMiddleware);
    app.get("/test", (c) => c.json({ user: c.get("user") }));

    const res = await app.request(
      "/test",
      { headers: { Cookie: `auth_session=${token}` } },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user?.userId).toBe("u1");
    expect(body.user?.email).toBe("u1@example.com");
  });

  it("sets user to null when no cookie provided", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", authMiddleware);
    app.get("/test", (c) => c.json({ user: c.get("user") }));

    const res = await app.request("/test", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user).toBeNull();
  });

  it("clears cookie and sets user to null on tampered or expired cookie", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", authMiddleware);
    app.get("/test", (c) => c.json({ user: c.get("user") }));

    const res = await app.request(
      "/test",
      { headers: { Cookie: "auth_session=tampered.fake.token" } },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user).toBeNull();

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("auth_session=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("requireAuth blocks unauthenticated request with 401", async () => {
    const app = new Hono<AppEnv>();
    app.use("*", authMiddleware);
    app.get("/protected", requireAuth, (c) => c.text("secret"));

    const res = await app.request("/protected", {}, env);
    expect(res.status).toBe(401);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Unauthorized");
  });

  it("requireAuth allows authenticated request", async () => {
    const token = await signSessionJwt({ userId: "u1", email: "u1@example.com" }, env.JWT_SECRET);

    const app = new Hono<AppEnv>();
    app.use("*", authMiddleware);
    app.get("/protected", requireAuth, (c) => c.text("secret"));

    const res = await app.request(
      "/protected",
      { headers: { Cookie: `auth_session=${token}` } },
      env
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("secret");
  });
});

describe("Auth Controller Sub-app", () => {
  const originalFetch = globalThis.fetch;
  let env: Env;
  let app: Hono<AppEnv>;

  beforeEach(() => {
    env = createMockEnv();
    app = new Hono<AppEnv>();
    app.route("/api/auth", authRoutes);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("GET /google sets oauth_state cookie and redirects to Google", async () => {
    const res = await app.request("/api/auth/google", {}, env);
    expect(res.status).toBe(302);
    const location = res.headers.get("location");
    expect(location).toContain("accounts.google.com");
    expect(location).toContain("client_id=mock-google-client-id");
    expect(location).toContain("redirect_uri=https%3A%2F%2Fgo.zulfifazhar.dev%2Fapi%2Fauth%2Fcallback");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("oauth_state=");
  });

  it("GET /callback returns 400 when state does not match cookie", async () => {
    const res = await app.request(
      "/api/auth/callback?code=test-code&state=mismatched-state",
      { headers: { Cookie: "oauth_state=expected-state" } },
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Invalid state");
  });

  it("GET /callback returns 400 when code is missing", async () => {
    const res = await app.request(
      "/api/auth/callback?state=my-state",
      { headers: { Cookie: "oauth_state=my-state" } },
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as any;
    expect(body.error).toBe("Missing authorization code");
  });

  it("GET /callback redirects cleanly when Google returns error query param", async () => {
    const res = await app.request(
      "/api/auth/callback?error=access_denied",
      { headers: { Cookie: "oauth_state=my-state" } },
      env
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/?error=access_denied");
  });

  it("GET /callback exchanges code, upserts user, sets session cookie, redirects to /dashboard", async () => {
    globalThis.fetch = mock(async (input: any) => {
      const url = input.toString();
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ access_token: "google-access-tok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("googleapis.com/oauth2/v2/userinfo")) {
        return new Response(
          JSON.stringify({
            id: "google-sub-42",
            email: "zulfi@example.com",
            name: "Zulfi Fazhar",
            picture: "https://lh3.google.com/pic.png",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not found", { status: 404 });
    });

    const res = await app.request(
      "/api/auth/callback?code=good-code&state=good-state",
      { headers: { Cookie: "oauth_state=good-state" } },
      env
    );

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/dashboard");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toContain("auth_session=");
    expect(setCookie).toContain("Max-Age=2592000");

    // Verify session token inside cookie
    const match = setCookie?.match(/auth_session=([^;]+)/);
    const token = match?.[1];
    expect(token).toBeTruthy();

    const verified = await verifySessionJwt(token!, env.JWT_SECRET);
    expect(verified?.email).toBe("zulfi@example.com");
    expect(verified?.name).toBe("Zulfi Fazhar");
  });

  it("GET /me returns user: null when unauthenticated", async () => {
    const res = await app.request("/api/auth/me", {}, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user).toBeNull();
  });

  it("GET /me returns session user when authenticated", async () => {
    const token = await signSessionJwt(
      { userId: "u123", email: "zulfi@example.com", name: "Zulfi" },
      env.JWT_SECRET
    );

    const res = await app.request(
      "/api/auth/me",
      { headers: { Cookie: `auth_session=${token}` } },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user?.userId).toBe("u123");
    expect(body.user?.email).toBe("zulfi@example.com");
    expect(body.user?.name).toBe("Zulfi");
  });

  it("POST /logout clears auth_session cookie and redirects to /", async () => {
    const res = await app.request(
      "/api/auth/logout",
      {
        method: "POST",
        headers: { Cookie: "auth_session=some-session-token" },
      },
      env
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("/");

    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeTruthy();
    expect(setCookie).toContain("auth_session=");
    expect(setCookie).toContain("Max-Age=0");
  });
});

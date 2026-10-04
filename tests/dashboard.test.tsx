import { describe, it, expect, mock } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import Dashboard, { loader, meta } from "../app/routes/dashboard";
import {
  DashboardTable,
  type DashboardLinkItem,
} from "../app/components/dashboard-table";
import { cloudflareContext } from "../app/context";
import { signSessionJwt } from "../workers/modules/auth/auth.service";
import type { Env } from "../workers/context";

function createMockContext(env: Partial<Env> = {}) {
  const defaultEnv: Env = {
    SHORTENER_DB: {
      prepare: mock((query: string) => {
        let boundArgs: any[] = [];
        const stmt = {
          bind: mock((...args: any[]) => {
            boundArgs = args;
            return stmt;
          }),
          all: mock(async () => {
            if (query.includes("FROM links WHERE user_id = ?")) {
              return {
                success: true,
                results: [
                  {
                    id: "link-1",
                    slug: "my-blog",
                    target_url: "https://zulfifazhar.dev",
                    user_id: boundArgs[0],
                    clicks: 25,
                    created_at: 1774900000000,
                    updated_at: 1774900000000,
                  },
                  {
                    id: "link-2",
                    slug: "docs",
                    target_url: "https://example.com/docs",
                    user_id: boundArgs[0],
                    clicks: 10,
                    created_at: 1774910000000,
                    updated_at: 1774910000000,
                  },
                ],
              };
            }
            return { success: true, results: [] };
          }),
        };
        return stmt;
      }),
    } as unknown as D1Database,
    SHORTENER_CACHE: {} as unknown as KVNamespace,
    BASE_URL: "https://go.zulfifazhar.dev",
    JWT_SECRET: "test-secret-key-1234567890123456",
    GOOGLE_CLIENT_ID: "client-id",
    GOOGLE_CLIENT_SECRET: "client-secret",
    ...env,
  };

  return {
    get: (key: any) => {
      if (key === cloudflareContext) {
        return {
          env: defaultEnv,
          ctx: {
            waitUntil: () => {},
            passThroughOnException: () => {},
          },
        };
      }
      return undefined;
    },
  };
}

describe("Dashboard Page & Table (Task 8 Implementation)", () => {
  const secret = "test-secret-key-1234567890123456";

  it("returns appropriate metadata for Dashboard", () => {
    const metaTags = meta({
      data: { user: null, links: [] },
      params: {},
      location: { pathname: "/dashboard", search: "", hash: "", state: null, key: "default" },
      matches: [],
    } as any);

    expect(metaTags).toEqual([
      { title: "Dashboard • go.zulfifazhar.dev" },
      {
        name: "description",
        content: "Manage your edge shortlinks and view real-time click analytics.",
      },
    ]);
  });

  describe("Dashboard Loader Auth Protection", () => {
    it("redirects unauthenticated requests without session cookie to /", async () => {
      const request = new Request("https://go.zulfifazhar.dev/dashboard");
      const context = createMockContext();

      const response = await loader({
        request,
        context: context as any,
        params: {},
      } as any);

      expect(response).toBeInstanceOf(Response);
      const res = response as Response;
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
    });

    it("redirects request with invalid session token to /", async () => {
      const request = new Request("https://go.zulfifazhar.dev/dashboard", {
        headers: {
          Cookie: "auth_session=invalid.token.here",
        },
      });
      const context = createMockContext();

      const response = await loader({
        request,
        context: context as any,
        params: {},
      } as any);

      expect(response).toBeInstanceOf(Response);
      const res = response as Response;
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe("/");
    });

    it("loads user profile and link records when authenticated", async () => {
      const validToken = await signSessionJwt(
        {
          userId: "user-42",
          email: "zulfi@cloudflare.com",
          name: "Zulfi Fazhar",
        },
        secret
      );

      const request = new Request("https://go.zulfifazhar.dev/dashboard", {
        headers: {
          Cookie: `auth_session=${validToken}`,
        },
      });
      const context = createMockContext();

      const data = (await loader({
        request,
        context: context as any,
        params: {},
      } as any)) as { user: any; links: DashboardLinkItem[] };

      expect(data).toHaveProperty("user");
      expect(data.user.userId).toBe("user-42");
      expect(data.user.email).toBe("zulfi@cloudflare.com");
      expect(data.user.name).toBe("Zulfi Fazhar");

      expect(data).toHaveProperty("links");
      expect(data.links.length).toBe(2);
      expect(data.links[0].slug).toBe("my-blog");
      expect(data.links[0].shortUrl).toBe("https://go.zulfifazhar.dev/my-blog");
      expect(data.links[0].clicks).toBe(25);
      expect(data.links[1].slug).toBe("docs");
      expect(data.links[1].clicks).toBe(10);
    });
  });

  describe("Dashboard Component UI Rendering", () => {
    it("renders page header, user welcome message, and stat cards", () => {
      const mockUser = {
        userId: "user-1",
        email: "dev@example.com",
        name: "Cloudflare Engineer",
      };
      const mockLinks: DashboardLinkItem[] = [
        {
          id: "link-1",
          slug: "blog",
          targetUrl: "https://example.com/blog",
          shortUrl: "https://go.zulfifazhar.dev/blog",
          clicks: 35,
          createdAt: 1774900000000,
        },
        {
          id: "link-2",
          slug: "github",
          targetUrl: "https://github.com/zulfifazhar",
          shortUrl: "https://go.zulfifazhar.dev/github",
          clicks: 12,
          createdAt: 1774910000000,
        },
      ];

      const html = renderToStaticMarkup(
        <MemoryRouter>
          <Dashboard
            loaderData={{ user: mockUser, links: mockLinks }}
            params={{}}
            matches={[]}
          />
        </MemoryRouter>
      );

      // Header & User welcome
      expect(html).toContain("Dashboard");
      expect(html).toContain("Edge Analytics");
      expect(html).toContain("Cloudflare Engineer");

      // Stats Summary
      expect(html).toContain("Total Links");
      expect(html).toContain("Total Clicks");
      expect(html).toContain("Top Performing Link");
      expect(html).toContain("47"); // 35 + 12 = 47 total clicks
      expect(html).toContain("/blog"); // Top performing slug

      // Shorten section
      expect(html).toContain("Create Short Link");
      expect(html).toContain("Paste long URL");
      expect(html).toContain("custom-slug");

      // Link table section
      expect(html).toContain("Your Links");
      expect(html).toContain("https://go.zulfifazhar.dev/blog");
      expect(html).toContain("https://example.com/blog");
      expect(html).toContain("35 clicks");
      expect(html).toContain("https://go.zulfifazhar.dev/github");
      expect(html).toContain("12 clicks");
    });
  });

  describe("DashboardTable Component", () => {
    it("renders empty state placeholder when no links are present", () => {
      const html = renderToStaticMarkup(
        <DashboardTable links={[]} />
      );

      expect(html).toContain("No shortlinks created yet");
      expect(html).toContain("Shorten a destination URL above");
    });

    it("renders table with full columns: shortlink, destination, click pill badge, date, and actions", () => {
      const mockLinks: DashboardLinkItem[] = [
        {
          id: "link-xyz",
          slug: "launch-2026",
          targetUrl: "https://acme.org/announcements/launch-2026-edge",
          shortUrl: "https://go.zulfifazhar.dev/launch-2026",
          clicks: 100,
          createdAt: 1774900000000,
        },
      ];

      const html = renderToStaticMarkup(
        <DashboardTable links={mockLinks} />
      );

      // Column headers
      expect(html).toContain("Short Link");
      expect(html).toContain("Destination URL");
      expect(html).toContain("Clicks");
      expect(html).toContain("Created");
      expect(html).toContain("Actions");

      // Link row data
      expect(html).toContain("https://go.zulfifazhar.dev/launch-2026");
      expect(html).toContain("https://acme.org/announcements/launch-2026-edge");
      expect(html).toContain("100 clicks");

      // Action buttons
      expect(html).toContain("Copy");
      expect(html).toContain('aria-label="Delete link launch-2026"');
    });
  });
});

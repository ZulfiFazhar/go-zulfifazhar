import { describe, it, expect, mock } from "bun:test";
import app from "../workers/app";
import { getPublicPlatformStats, getUserClickTrend } from "../workers/db/queries";

describe("Public Platform Stats", () => {
  it("calculates user 24h click trend", async () => {
    const now = Date.now();
    const mockDb = {
      prepare: mock(() => {
        const stmt = {
          bind: mock(() => stmt),
          all: mock(async () => ({
            results: [{ timestamp: now - 1800 * 1000 }, { timestamp: now - 3600 * 1000 }],
          })),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const trend = await getUserClickTrend(mockDb, "test_user_id");
    expect(trend.length).toBe(8);
    const totalTrend = trend.reduce((sum, p) => sum + p.clicks, 0);
    expect(totalTrend).toBe(2);
  });
  it("calculates total links, total clicks, and 24h trend buckets", async () => {
    const now = Date.now();
    const mockDb = {
      prepare: mock((query: string) => {
        const stmt = {
          bind: mock(() => stmt),
          first: mock(async () => {
            if (query.includes("SUM(clicks)")) {
              return { total_links: 10, total_clicks: 42 };
            }
            return null;
          }),
          all: mock(async () => {
            if (query.includes("FROM link_clicks")) {
              return {
                results: [
                  { timestamp: now - 3600 * 1000 },
                  { timestamp: now - 7200 * 1000 },
                  { timestamp: now - 7200 * 1000 },
                ],
              };
            }
            return { results: [] };
          }),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const stats = await getPublicPlatformStats(mockDb);
    expect(stats.totalLinks).toBe(10);
    expect(stats.totalClicks).toBe(42);
    expect(stats.trend.length).toBe(8);
    const sumTrendClicks = stats.trend.reduce((acc, p) => acc + p.clicks, 0);
    expect(sumTrendClicks).toBe(3);
  });

  it("serves GET /api/stats/public via Hono", async () => {
    const mockDb = {
      prepare: mock((query: string) => {
        const stmt = {
          bind: mock(() => stmt),
          first: mock(async () => ({ total_links: 5, total_clicks: 25 })),
          all: mock(async () => ({ results: [] })),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const env = {
      SHORTENER_DB: mockDb,
      BASE_URL: "http://localhost:5173",
      JWT_SECRET: "mock-secret-at-least-32-chars-long!",
    } as any;

    const req = new Request("http://localhost:5173/api/stats/public");
    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.totalLinks).toBe(5);
    expect(body.totalClicks).toBe(25);
    expect(Array.isArray(body.trend)).toBe(true);
  });
});

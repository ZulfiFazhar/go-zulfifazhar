import { describe, it, expect, mock } from "bun:test";
import app from "../workers/app";
import { signSessionJwt } from "../workers/modules/auth/auth.service";
import { claimAnonymousLinks, type LinkRecord } from "../workers/db/queries";

describe("Claim Anonymous Links", () => {
  it("claims anonymous links where user_id is null", async () => {
    const linksMap = new Map<string, LinkRecord>([
      [
        "link_1",
        {
          id: "link_1",
          slug: "anon1",
          target_url: "https://example.com/1",
          user_id: null,
          clicks: 0,
          created_at: 1000,
          updated_at: 1000,
        },
      ],
      [
        "link_2",
        {
          id: "link_2",
          slug: "user1",
          target_url: "https://example.com/2",
          user_id: "other_user",
          clicks: 0,
          created_at: 1000,
          updated_at: 1000,
        },
      ],
    ]);

    const mockDb = {
      prepare: mock((query: string) => {
        let boundArgs: any[] = [];
        const stmt = {
          bind: mock((...args: any[]) => {
            boundArgs = args;
            return stmt;
          }),
          run: mock(async () => {
            if (query.includes("UPDATE links SET user_id = ?")) {
              const [newUserId, , ...linkIds] = boundArgs;
              let changes = 0;
              for (const id of linkIds) {
                const link = linksMap.get(id);
                if (link && link.user_id === null) {
                  link.user_id = newUserId;
                  changes++;
                }
              }
              return { success: true, meta: { changes } };
            }
            return { success: true, meta: { changes: 0 } };
          }),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const claimed = await claimAnonymousLinks(mockDb, "target_user", ["link_1", "link_2"]);
    expect(claimed).toBe(1);
    expect(linksMap.get("link_1")?.user_id).toBe("target_user");
    expect(linksMap.get("link_2")?.user_id).toBe("other_user");
  });

  it("handles POST /api/user/links/claim or /api/links/claim with auth token", async () => {
    const secret = "test-secret-32-chars-minimum-length!";
    const token = await signSessionJwt(
      { userId: "claim_user", email: "claim@example.com", name: "Claim User" },
      secret
    );

    const mockDb = {
      prepare: mock((query: string) => {
        const stmt = {
          bind: mock(() => stmt),
          run: mock(async () => ({ success: true, meta: { changes: 2 } })),
        };
        return stmt;
      }),
    } as unknown as D1Database;

    const env = {
      SHORTENER_DB: mockDb,
      SHORTENER_CACHE: {
        get: mock(async () => null),
        put: mock(async () => {}),
        delete: mock(async () => {}),
      },
      JWT_SECRET: secret,
      BASE_URL: "http://localhost:5173",
    } as any;

    const req = new Request("http://localhost:5173/api/links/claim", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `auth_session=${token}`,
      },
      body: JSON.stringify({ linkIds: ["id_1", "id_2"] }),
    });

    const res = await app.fetch(req, env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.success).toBe(true);
    expect(body.claimedCount).toBe(2);
  });
});

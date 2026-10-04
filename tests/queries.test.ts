import { describe, it, expect, mock } from "bun:test";
import {
  createLinkRecord,
  findLinkBySlug,
  incrementLinkClicks,
  listUserLinks,
  deleteUserLink,
  upsertUserRecord,
  findUserById,
  findUserByEmail,
  type LinkRecord,
  type UserRecord,
} from "../workers/db/queries";

function createMockD1() {
  const preparedStatements: Array<{ query: string; bindings: any[] }> = [];

  const mockDb = {
    prepare: mock((query: string) => {
      let currentBindings: any[] = [];
      const stmt = {
        bind: mock((...args: any[]) => {
          currentBindings = args;
          return stmt;
        }),
        run: mock(async () => {
          preparedStatements.push({ query, bindings: currentBindings });
          return {
            success: true,
            meta: {
              changes: 1,
              last_row_id: 1,
              duration: 1,
              size_after: 1,
              rows_read: 1,
              rows_written: 1,
              changed_db: true,
            },
            results: [],
          };
        }),
        first: mock(async <T>() => {
          preparedStatements.push({ query, bindings: currentBindings });
          if (query.includes("FROM links WHERE slug = ?")) {
            if (currentBindings[0] === "existing-slug") {
              return {
                id: "link-1",
                slug: "existing-slug",
                target_url: "https://example.com",
                user_id: "user-1",
                clicks: 5,
                created_at: 1000,
                updated_at: 1000,
              } as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM users WHERE id = ?")) {
            if (currentBindings[0] === "user-1") {
              return {
                id: "user-1",
                email: "test@example.com",
                name: "Zulfi",
                avatar_url: null,
                created_at: 1000,
              } as unknown as T;
            }
            return null;
          }
          if (query.includes("FROM users WHERE email = ?")) {
            if (currentBindings[0] === "test@example.com") {
              return {
                id: "user-1",
                email: "test@example.com",
                name: "Zulfi",
                avatar_url: null,
                created_at: 1000,
              } as unknown as T;
            }
            return null;
          }
          return null;
        }),
        all: mock(async <T>() => {
          preparedStatements.push({ query, bindings: currentBindings });
          if (query.includes("FROM links WHERE user_id = ?")) {
            return {
              success: true,
              meta: { duration: 1, changes: 0, last_row_id: 0, size_after: 0, rows_read: 1, rows_written: 0, changed_db: false },
              results: [
                {
                  id: "link-1",
                  slug: "slug-1",
                  target_url: "https://a.com",
                  user_id: currentBindings[0],
                  clicks: 2,
                  created_at: 2000,
                  updated_at: 2000,
                },
              ] as unknown as T[],
            };
          }
          return { success: true, meta: { duration: 1, changes: 0, last_row_id: 0, size_after: 0, rows_read: 0, rows_written: 0, changed_db: false }, results: [] as unknown as T[] };
        }),
      };
      return stmt;
    }),
    batch: mock(async (statements: any[]) => {
      return statements.map(() => ({
        success: true,
        meta: { duration: 1, changes: 1, last_row_id: 1, size_after: 1, rows_read: 0, rows_written: 1, changed_db: true },
        results: [],
      }));
    }),
  } as unknown as D1Database;

  return { mockDb, preparedStatements };
}

describe("D1 Database Queries", () => {
  it("createLinkRecord inserts link with default fields and returns record", async () => {
    const { mockDb, preparedStatements } = createMockD1();
    const result = await createLinkRecord(mockDb, {
      slug: "new-slug",
      target_url: "https://zulfifazhar.dev",
      user_id: "user-1",
    });

    expect(result.slug).toBe("new-slug");
    expect(result.target_url).toBe("https://zulfifazhar.dev");
    expect(result.user_id).toBe("user-1");
    expect(result.clicks).toBe(0);
    expect(typeof result.id).toBe("string");
    expect(typeof result.created_at).toBe("number");
    expect(typeof result.updated_at).toBe("number");
    expect(preparedStatements.length).toBe(1);
    expect(preparedStatements[0].query).toContain("INSERT INTO links");
  });

  it("findLinkBySlug returns record if found and null if not found", async () => {
    const { mockDb } = createMockD1();

    const found = await findLinkBySlug(mockDb, "existing-slug");
    expect(found).not.toBeNull();
    expect(found?.slug).toBe("existing-slug");

    const notFound = await findLinkBySlug(mockDb, "missing-slug");
    expect(notFound).toBeNull();
  });

  it("incrementLinkClicks batches link update and click insertion", async () => {
    const { mockDb } = createMockD1();

    await incrementLinkClicks(mockDb, "link-1", {
      country: "US",
      referrer: "https://google.com",
      user_agent: "Mozilla/5.0",
      timestamp: 1234567890,
    });

    expect(mockDb.batch).toHaveBeenCalledTimes(1);
    expect(mockDb.prepare).toHaveBeenCalledTimes(2);
  });

  it("listUserLinks retrieves array of link records", async () => {
    const { mockDb } = createMockD1();

    const links = await listUserLinks(mockDb, "user-1");
    expect(Array.isArray(links)).toBe(true);
    expect(links.length).toBe(1);
    expect(links[0].slug).toBe("slug-1");
    expect(links[0].user_id).toBe("user-1");
  });

  it("deleteUserLink returns true when row is deleted and false when 0 changes", async () => {
    const { mockDb } = createMockD1();

    const deleted = await deleteUserLink(mockDb, "link-1", "user-1");
    expect(deleted).toBe(true);

    const noOpDb = {
      prepare: mock(() => ({
        bind: mock(() => ({
          run: mock(async () => ({
            success: true,
            meta: { changes: 0 },
            results: [],
          })),
        })),
      })),
    } as unknown as D1Database;

    const notDeleted = await deleteUserLink(noOpDb, "link-2", "user-1");
    expect(notDeleted).toBe(false);
  });

  it("upsertUserRecord inserts or updates user", async () => {
    const { mockDb, preparedStatements } = createMockD1();

    const user = await upsertUserRecord(mockDb, {
      id: "user-1",
      email: "test@example.com",
      name: "Zulfi",
      avatar_url: "https://avatar.com/u1",
    });

    expect(user.id).toBe("user-1");
    expect(user.email).toBe("test@example.com");
    expect(preparedStatements.length).toBe(1);
    expect(preparedStatements[0].query).toContain("INSERT INTO users");
  });

  it("findUserById and findUserByEmail resolve users or null", async () => {
    const { mockDb } = createMockD1();

    const userById = await findUserById(mockDb, "user-1");
    expect(userById?.email).toBe("test@example.com");

    const missingUserById = await findUserById(mockDb, "missing");
    expect(missingUserById).toBeNull();

    const userByEmail = await findUserByEmail(mockDb, "test@example.com");
    expect(userByEmail?.id).toBe("user-1");

    const missingUserByEmail = await findUserByEmail(mockDb, "notfound@example.com");
    expect(missingUserByEmail).toBeNull();
  });
});

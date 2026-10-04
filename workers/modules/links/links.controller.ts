import { Hono, type Context } from "hono";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../../context";
import { createShortLink } from "./links.service";
import {
  listUserLinks,
  deleteUserLink,
  claimAnonymousLinks,
  getPublicPlatformStats,
  type LinkRecord,
} from "../../db/queries";
import { authMiddleware, requireAuth } from "../auth/auth.middleware";
import { verifySessionJwt } from "../auth/auth.service";

export async function handleCreateLink(c: Context<AppEnv>) {
  let user = c.get("user");
  if (user === undefined) {
    const token = getCookie(c, "auth_session");
    if (token) {
      user = await verifySessionJwt(token, c.env.JWT_SECRET);
    }
    c.set("user", user ?? null);
  }

  // ponytail: payload validated inline; switch to zod schema validator if request parameters expand.
  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const rawUrl = body?.url ?? body?.targetUrl ?? body?.target_url;
  if (!rawUrl || typeof rawUrl !== "string") {
    return c.json({ error: "Invalid destination URL" }, 400);
  }

  const rawCustomSlug = body?.customSlug ?? body?.slug;
  const customSlug =
    typeof rawCustomSlug === "string" && rawCustomSlug.trim().length > 0
      ? rawCustomSlug.trim()
      : undefined;

  if (customSlug && !user) {
    return c.json({ error: "Custom slug requires authentication" }, 403);
  }

  const rawExpiresIn = body?.expiresIn ?? body?.expires_in;
  const expiresIn =
    typeof rawExpiresIn === "number" && rawExpiresIn > 0 ? rawExpiresIn : undefined;

  try {
    const result = await createShortLink(c.env, {
      url: rawUrl,
      customSlug: user ? customSlug : undefined,
      userId: user?.userId,
      expiresIn,
    });

    return c.json(
      {
        id: result.id,
        slug: result.slug,
        targetUrl: result.targetUrl,
        shortUrl: result.shortUrl,
        expiresAt: result.expiresAt,
      },
      201
    );
  } catch (err: any) {
    const message = err?.message || "Failed to create shortlink";
    if (
      message === "Invalid destination URL" ||
      message === "Invalid or reserved slug"
    ) {
      return c.json({ error: message }, 400);
    }
    if (
      message.includes("Slug already in use") ||
      message.includes("UNIQUE constraint failed")
    ) {
      return c.json({ error: message }, 409);
    }
    return c.json({ error: message }, 500);
  }
}

export async function handleListUserLinks(c: Context<AppEnv>) {
  const user = c.get("user");
  if (!user?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    // ponytail: listUserLinks returns all records without pagination; add cursor-based pagination when user exceeds 100 links.
    const records = await listUserLinks(c.env.SHORTENER_DB, user.userId);
    const base = c.env.BASE_URL ? c.env.BASE_URL.replace(/\/$/, "") : "";
    const links = records.map((record) => ({
      ...record,
      targetUrl: record.target_url,
      shortUrl: base ? `${base}/${record.slug}` : `/${record.slug}`,
    }));

    return c.json({ links });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to list user links" }, 500);
  }
}

export async function handleDeleteUserLink(c: Context<AppEnv>) {
  const user = c.get("user");
  if (!user?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const id = c.req.param("id");
  if (!id) {
    return c.json({ error: "Missing link ID" }, 400);
  }

  try {
    const link = await c.env.SHORTENER_DB
      .prepare("SELECT id, slug, user_id FROM links WHERE id = ? AND user_id = ?")
      .bind(id, user.userId)
      .first<Pick<LinkRecord, "id" | "slug" | "user_id">>();

    if (!link) {
      return c.json({ error: "Link not found" }, 404);
    }

    const deleted = await deleteUserLink(c.env.SHORTENER_DB, id, user.userId);
    if (!deleted) {
      return c.json({ error: "Failed to delete link" }, 500);
    }

    if (c.env.SHORTENER_CACHE && link.slug) {
      await c.env.SHORTENER_CACHE.delete(`slug:${link.slug}`);
    }

    return c.json({ success: true, message: "Link deleted successfully" });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to delete link" }, 500);
  }
}

export async function handleClaimLinks(c: Context<AppEnv>) {
  const user = c.get("user");
  if (!user?.userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const linkIds = Array.isArray(body?.linkIds)
    ? body.linkIds.filter((id: any) => typeof id === "string" && id.trim().length > 0)
    : [];

  if (linkIds.length === 0) {
    return c.json({ success: true, claimedCount: 0 });
  }

  try {
    const claimedCount = await claimAnonymousLinks(c.env.SHORTENER_DB, user.userId, linkIds);
    return c.json({ success: true, claimedCount });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to claim links" }, 500);
  }
}

export async function handleGetPublicStats(c: Context<AppEnv>) {
  try {
    const stats = await getPublicPlatformStats(c.env.SHORTENER_DB);
    return c.json(stats, 200, {
      "Cache-Control": "public, max-age=5, s-maxage=5",
    });
  } catch (err: any) {
    return c.json({ error: err?.message || "Failed to load public stats" }, 500);
  }
}

export const linksRoutes = new Hono<AppEnv>();
linksRoutes.use("*", authMiddleware);
linksRoutes.get("/stats/public", handleGetPublicStats);
linksRoutes.post("/", handleCreateLink);
linksRoutes.post("/links", handleCreateLink);
linksRoutes.post("/claim", requireAuth, handleClaimLinks);
linksRoutes.get("/", requireAuth, handleListUserLinks);
linksRoutes.get("/user/links", requireAuth, handleListUserLinks);
linksRoutes.delete("/:id", requireAuth, handleDeleteUserLink);
linksRoutes.delete("/user/links/:id", requireAuth, handleDeleteUserLink);

export const userLinksRoutes = new Hono<AppEnv>();
userLinksRoutes.use("*", authMiddleware, requireAuth);
userLinksRoutes.get("/", handleListUserLinks);
userLinksRoutes.post("/claim", handleClaimLinks);
userLinksRoutes.delete("/:id", handleDeleteUserLink);

import type { Context } from "hono";
import type { Env } from "../../context";
import { findLinkBySlug, incrementLinkClicks, type ClickMeta } from "../../db/queries";
import { RESERVED_SLUGS } from "../links/links.service";

export interface CachedLink {
  id: string;
  targetUrl?: string;
  target_url?: string;
  expiresAt?: number | null;
}

interface ExecutionContextLike {
  waitUntil(promise: Promise<any>): void;
}

function getExecutionCtx(c: Context<any>): ExecutionContextLike | undefined {
  try {
    return c.executionCtx as ExecutionContextLike;
  } catch {
    return undefined;
  }
}

export function extractClickMeta(c: Context<any>): ClickMeta {
  const req = c.req;
  const header = (name: string): string | null => {
    try {
      if (typeof req.header === "function") {
        return req.header(name) ?? null;
      }
      if (req.raw?.headers?.get) {
        return req.raw.headers.get(name);
      }
    } catch {
      return null;
    }
    return null;
  };

  const cfCountry = (req.raw as { cf?: { country?: string } })?.cf?.country;
  const country = header("cf-ipcountry") || cfCountry || null;
  const referrer = header("referer") || header("referrer") || null;
  const user_agent = header("user-agent") || null;

  return { country, referrer, user_agent };
}

export async function recordClick(c: Context<any>, linkId: string): Promise<void> {
  const meta = extractClickMeta(c);
  await incrementLinkClicks(c.env.SHORTENER_DB, linkId, meta);
}

export async function handleEdgeRedirect(
  c: Context<any>
): Promise<Response | null> {
  let slug: string | null = null;

  if (typeof c.req.param === "function") {
    slug = c.req.param("slug") || null;
  } else if (c.req.param && typeof c.req.param === "object") {
    slug = (c.req.param as any).slug || null;
  }

  if (!slug) {
    try {
      const pathname = c.req.path || new URL(c.req.url).pathname;
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length === 1) {
        slug = segments[0];
      }
    } catch {
      // ponytail: ignore malformed URL parse errors; falls through to null
    }
  }

  if (!slug) return null;

  try {
    slug = decodeURIComponent(slug);
  } catch {
    // ponytail: ignore malformed URI components; use raw slug
  }

  if (RESERVED_SLUGS.has(slug.toLowerCase())) {
    return null;
  }

  const cacheKey = `slug:${slug}`;

  const ctx = getExecutionCtx(c);

  // 1. Check KV cache
  if (c.env.SHORTENER_CACHE) {
    try {
      const raw = await c.env.SHORTENER_CACHE.get(cacheKey, "json");
      let cached: CachedLink | null = null;
      if (raw) {
        if (typeof raw === "string") {
          try {
            cached = JSON.parse(raw);
          } catch {
            cached = null;
          }
        } else if (typeof raw === "object") {
          cached = raw as CachedLink;
        }
      }

      const targetUrl = cached?.targetUrl || cached?.target_url;
      if (cached && targetUrl) {
        if (typeof cached.expiresAt === "number" && cached.expiresAt < Date.now()) {
          return c.text("This shortlink has expired.", 410);
        }

        if (cached.id && ctx?.waitUntil) {
          ctx.waitUntil(
            recordClick(c, cached.id).catch((err) => {
              console.error("Failed to track click:", err);
            })
          );
        }
        return c.redirect(targetUrl, 302);
      }
    } catch (err) {
      // ponytail: KV read failures fallback silently to D1 database
      console.error("KV cache read error:", err);
    }
  }

  // 2. Query D1 on KV miss
  const record = await findLinkBySlug(c.env.SHORTENER_DB, slug);
  if (!record) {
    return null;
  }

  if (typeof record.expires_at === "number" && record.expires_at < Date.now()) {
    return c.text("This shortlink has expired.", 410);
  }

  // 3. Backfill KV cache & track click in background
  if (c.env.SHORTENER_CACHE) {
    try {
      const ttl =
        typeof record.expires_at === "number"
          ? Math.max(Math.floor((record.expires_at - Date.now()) / 1000), 60)
          : undefined;

      await c.env.SHORTENER_CACHE.put(
        cacheKey,
        JSON.stringify({
          id: record.id,
          targetUrl: record.target_url,
          expiresAt: record.expires_at,
        }),
        ttl ? { expirationTtl: ttl } : undefined
      );
    } catch (err) {
      console.error("Failed to populate KV cache:", err);
    }
  }

  if (ctx?.waitUntil) {
    ctx.waitUntil(
      recordClick(c, record.id).catch((err) => {
        console.error("Failed to track click:", err);
      })
    );
  }

  return c.redirect(record.target_url, 302);
}

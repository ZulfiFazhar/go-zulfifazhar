import type { Env } from "../../context";
import { createLinkRecord, findLinkBySlug } from "../../db/queries";

export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "api",
  "dashboard",
  "assets",
  "favicon.ico",
  "build",
  "_",
  "cdn-cgi",
]);

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface CreateShortLinkInput {
  url: string;
  customSlug?: string;
  userId?: string;
}

export interface ShortLinkResult {
  id: string;
  slug: string;
  targetUrl: string;
  target_url: string;
  shortUrl: string;
  userId: string | null;
  user_id: string | null;
  clicks: number;
  createdAt: number;
  created_at: number;
}

export function isValidUrl(url: string): boolean {
  if (!url || typeof url !== "string") return false;
  try {
    const parsed = new URL(url.trim());
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      Boolean(parsed.hostname)
    );
  } catch {
    return false;
  }
}

export function sanitizeSlug(slug: string): string | null {
  if (!slug || typeof slug !== "string") return null;
  const trimmed = slug.trim();
  if (!trimmed || RESERVED_SLUGS.has(trimmed.toLowerCase())) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) return null;
  return trimmed;
}

export function generateRandomSlug(length = 6): string {
  let slug = "";
  // ponytail: modulo 62 introduces sub-0.1% bias; replace with crypto rejection sampling if strict uniform distribution needed.
  do {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    slug = "";
    for (let i = 0; i < length; i++) {
      slug += ALPHABET[bytes[i] % ALPHABET.length];
    }
  } while (RESERVED_SLUGS.has(slug.toLowerCase()));
  return slug;
}

export async function createShortLink(
  env: Env,
  input: CreateShortLinkInput
): Promise<ShortLinkResult> {
  const targetUrl = input.url ? input.url.trim() : "";
  if (!isValidUrl(targetUrl)) {
    throw new Error("Invalid destination URL");
  }

  let slug: string;
  if (input.customSlug) {
    const sanitized = sanitizeSlug(input.customSlug);
    if (!sanitized) {
      throw new Error("Invalid or reserved slug");
    }
    const existing = await findLinkBySlug(env.SHORTENER_DB, sanitized);
    if (existing) {
      throw new Error("Slug already in use");
    }
    slug = sanitized;
  } else {
    let attempts = 0;
    slug = generateRandomSlug(6);
    while (await findLinkBySlug(env.SHORTENER_DB, slug)) {
      attempts++;
      if (attempts > 10) {
        throw new Error("Failed to generate unique slug");
      }
      slug = generateRandomSlug(attempts > 5 ? 7 : 6);
    }
  }

  const record = await createLinkRecord(env.SHORTENER_DB, {
    slug,
    target_url: targetUrl,
    user_id: input.userId || null,
  });

  if (env.SHORTENER_CACHE) {
    await env.SHORTENER_CACHE.put(
      `slug:${record.slug}`,
      JSON.stringify({ id: record.id, targetUrl: record.target_url })
    );
  }

  const base = env.BASE_URL ? env.BASE_URL.replace(/\/$/, "") : "";
  const shortUrl = base ? `${base}/${record.slug}` : `/${record.slug}`;

  return {
    id: record.id,
    slug: record.slug,
    targetUrl: record.target_url,
    target_url: record.target_url,
    shortUrl,
    userId: record.user_id,
    user_id: record.user_id,
    clicks: record.clicks,
    createdAt: record.created_at,
    created_at: record.created_at,
  };
}

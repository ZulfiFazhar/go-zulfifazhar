export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  created_at: number;
}

export interface UserInsert {
  id: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  created_at?: number;
}

export interface LinkRecord {
  id: string;
  slug: string;
  target_url: string;
  user_id: string | null;
  clicks: number;
  created_at: number;
  updated_at: number;
}

export interface LinkInsert {
  id?: string;
  slug: string;
  target_url: string;
  user_id?: string | null;
  clicks?: number;
  created_at?: number;
  updated_at?: number;
}

export interface ClickMeta {
  country?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
  timestamp?: number;
}

export interface LinkClickRecord {
  id: number;
  link_id: string;
  timestamp: number;
  country: string | null;
  referrer: string | null;
  user_agent: string | null;
}

export async function createLinkRecord(
  db: D1Database,
  data: LinkInsert
): Promise<LinkRecord> {
  const now = Date.now();
  const id = data.id || crypto.randomUUID();
  const created_at = data.created_at ?? now;
  const updated_at = data.updated_at ?? now;
  const clicks = data.clicks ?? 0;
  const user_id = data.user_id ?? null;

  await db
    .prepare(
      "INSERT INTO links (id, slug, target_url, user_id, clicks, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(id, data.slug, data.target_url, user_id, clicks, created_at, updated_at)
    .run();

  return {
    id,
    slug: data.slug,
    target_url: data.target_url,
    user_id,
    clicks,
    created_at,
    updated_at,
  };
}

export async function findLinkBySlug(
  db: D1Database,
  slug: string
): Promise<LinkRecord | null> {
  const record = await db
    .prepare("SELECT * FROM links WHERE slug = ?")
    .bind(slug)
    .first<LinkRecord>();
  return record ?? null;
}

export async function incrementLinkClicks(
  db: D1Database,
  id: string,
  meta: ClickMeta = {}
): Promise<void> {
  const timestamp = meta.timestamp ?? Date.now();
  const country = meta.country ?? null;
  const referrer = meta.referrer ?? null;
  const user_agent = meta.user_agent ?? null;

  const updateStmt = db
    .prepare("UPDATE links SET clicks = clicks + 1, updated_at = ? WHERE id = ?")
    .bind(timestamp, id);

  const insertStmt = db
    .prepare(
      "INSERT INTO link_clicks (link_id, timestamp, country, referrer, user_agent) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(id, timestamp, country, referrer, user_agent);

  await db.batch([updateStmt, insertStmt]);
}

export async function listUserLinks(
  db: D1Database,
  userId: string
): Promise<LinkRecord[]> {
  const { results } = await db
    .prepare("SELECT * FROM links WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<LinkRecord>();
  return results ?? [];
}

export async function deleteUserLink(
  db: D1Database,
  id: string,
  userId: string
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM links WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function claimAnonymousLinks(
  db: D1Database,
  userId: string,
  linkIds: string[]
): Promise<number> {
  if (!linkIds || linkIds.length === 0) return 0;
  // ponytail: cap at 50 links per batch to prevent SQL parameter limits
  const safeIds = linkIds.slice(0, 50);
  const placeholders = safeIds.map(() => "?").join(",");
  const now = Date.now();
  const query = `UPDATE links SET user_id = ?, updated_at = ? WHERE id IN (${placeholders}) AND user_id IS NULL`;
  const result = await db.prepare(query).bind(userId, now, ...safeIds).run();
  return result.meta?.changes ?? 0;
}

export async function upsertUserRecord(
  db: D1Database,
  data: UserInsert
): Promise<UserRecord> {
  const now = Date.now();
  const created_at = data.created_at ?? now;
  const name = data.name ?? null;
  const avatar_url = data.avatar_url ?? null;

  await db
    .prepare(
      `INSERT INTO users (id, email, name, avatar_url, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         avatar_url = excluded.avatar_url`
    )
    .bind(data.id, data.email, name, avatar_url, created_at)
    .run();

  return {
    id: data.id,
    email: data.email,
    name,
    avatar_url,
    created_at,
  };
}

export async function findUserById(
  db: D1Database,
  id: string
): Promise<UserRecord | null> {
  const user = await db
    .prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first<UserRecord>();
  return user ?? null;
}

export async function findUserByEmail(
  db: D1Database,
  email: string
): Promise<UserRecord | null> {
  const user = await db
    .prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<UserRecord>();
  return user ?? null;
}

export interface PublicTrendPoint {
  timestamp: number;
  label: string;
  clicks: number;
}

export interface PublicStats {
  totalClicks: number;
  totalLinks: number;
  trend: PublicTrendPoint[];
}

export async function getPublicPlatformStats(db: D1Database): Promise<PublicStats> {
  const totalsRes = await db
    .prepare("SELECT COUNT(*) as total_links, COALESCE(SUM(clicks), 0) as total_clicks FROM links")
    .first<{ total_links: number; total_clicks: number }>();

  const totalLinks = totalsRes?.total_links ?? 0;
  const totalClicks = totalsRes?.total_clicks ?? 0;

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const clicksRes = await db
    .prepare("SELECT timestamp FROM link_clicks WHERE timestamp >= ? ORDER BY timestamp ASC")
    .bind(oneDayAgo)
    .all<{ timestamp: number }>();

  const timestamps = (clicksRes.results || []).map((r) => r.timestamp);

  // 8 slots covering 24h (3-hour intervals)
  const slotCount = 8;
  const slotDuration = (24 * 60 * 60 * 1000) / slotCount;
  const trend: PublicTrendPoint[] = [];

  for (let i = 0; i < slotCount; i++) {
    const slotStart = oneDayAgo + i * slotDuration;
    const slotEnd = slotStart + slotDuration;
    const count = timestamps.filter((ts) => ts >= slotStart && ts < slotEnd).length;
    const date = new Date(slotEnd);
    const label = `${date.getUTCHours().toString().padStart(2, "0")}:00`;
    trend.push({ timestamp: slotEnd, label, clicks: count });
  }

  return {
    totalClicks,
    totalLinks,
    trend,
  };
}

export async function getUserClickTrend(
  db: D1Database,
  userId: string
): Promise<PublicTrendPoint[]> {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const clicksRes = await db
    .prepare(
      `SELECT lc.timestamp
       FROM link_clicks lc
       JOIN links l ON lc.link_id = l.id
       WHERE l.user_id = ? AND lc.timestamp >= ?
       ORDER BY lc.timestamp ASC`
    )
    .bind(userId, oneDayAgo)
    .all<{ timestamp: number }>();

  const timestamps = (clicksRes.results || []).map((r) => r.timestamp);

  const slotCount = 8;
  const slotDuration = (24 * 60 * 60 * 1000) / slotCount;
  const trend: PublicTrendPoint[] = [];

  for (let i = 0; i < slotCount; i++) {
    const slotStart = oneDayAgo + i * slotDuration;
    const slotEnd = slotStart + slotDuration;
    const count = timestamps.filter((ts) => ts >= slotStart && ts < slotEnd).length;
    const date = new Date(slotEnd);
    const label = `${date.getUTCHours().toString().padStart(2, "0")}:00`;
    trend.push({ timestamp: slotEnd, label, clicks: count });
  }

  return trend;
}

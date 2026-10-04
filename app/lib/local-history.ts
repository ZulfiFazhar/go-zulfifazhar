export interface LocalLinkItem {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  createdAt: number;
}

const STORAGE_KEY = "shortened_links";
const MAX_ENTRIES = 10;

export function getLocalHistory(): LocalLinkItem[] {
  if (typeof window === "undefined" || !window.localStorage) {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLocalHistory(links: LocalLinkItem[]): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(links.slice(0, MAX_ENTRIES)));
  } catch {
    // ponytail: ignore localStorage quota errors
  }
}

export function addLocalHistory(item: Omit<LocalLinkItem, "createdAt"> & { createdAt?: number }): LocalLinkItem[] {
  const current = getLocalHistory();
  const newItem: LocalLinkItem = {
    ...item,
    createdAt: item.createdAt ?? Date.now(),
  };

  const filtered = current.filter((l) => l.id !== newItem.id && l.slug !== newItem.slug);
  const updated = [newItem, ...filtered].slice(0, MAX_ENTRIES);
  saveLocalHistory(updated);
  return updated;
}

export function clearLocalHistory(): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore error
  }
}

export async function claimLocalHistory(): Promise<number> {
  const current = getLocalHistory();
  if (current.length === 0) return 0;

  const linkIds = current.map((l) => l.id).filter(Boolean);
  if (linkIds.length === 0) {
    clearLocalHistory();
    return 0;
  }

  try {
    const res = await fetch("/api/user/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ linkIds }),
    });

    if (res.ok) {
      const data = (await res.json()) as any;
      clearLocalHistory();
      return data.claimedCount ?? 0;
    }
  } catch (err) {
    console.error("Failed to claim local history:", err);
  }
  return 0;
}

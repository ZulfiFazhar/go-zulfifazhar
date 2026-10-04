# Specification: Cloudflare Fullstack Link Shortener (go.zulfifazhar.dev)

- **Date:** 2026-10-04
- **Domain:** `go.zulfifazhar.dev`
- **Stack:** Cloudflare Workers, Hono, Cloudflare D1, Cloudflare KV, React Router v7, Tailwind CSS v4, shadcn/ui

---

## 1. Overview & Goals

Build a high-performance link shortener deployed on Cloudflare's edge network for the domain `go.zulfifazhar.dev`. The system combines instant sub-millisecond edge redirects with relational data storage, Google OAuth authentication, and an enterprise landing page and dashboard styled according to `Design.md` using shadcn/ui.

### Key Objectives
1. **Ultra-Low Latency Redirects:** Serve shortlink redirects (`/:slug`) directly from Cloudflare KV edge cache in single-digit milliseconds.
2. **Asynchronous Telemetry:** Track clicks, countries, and referrers to Cloudflare D1 in the background without blocking the HTTP 302 redirect response.
3. **Hybrid Access Model:**
   - **Public / Anonymous:** Instant short link generation (auto-generated 6-character random slug).
   - **Authenticated (Google OAuth):** Custom slugs, link management dashboard, click analytics, and deletion.
4. **Cloudflare Enterprise Design (`Design.md`):** High-contrast orange accent (`#ff5e1f`), clean typography, pill buttons and inputs, built with shadcn/ui components.

---

## 2. Cloudflare Infrastructure & Bindings

### 2.1 Wrangler Configuration (`wrangler.jsonc`)
- **D1 Database Binding:** `SHORTENER_DB` (Relational storage for users, links, and click logs).
- **KV Namespace Binding:** `SHORTENER_CACHE` (Key-value store for edge redirect lookups).
- **Environment Variables & Secrets:**
  - `BASE_URL`: `https://go.zulfifazhar.dev` (or `http://localhost:5173` in local dev).
  - `GOOGLE_CLIENT_ID`: Google OAuth 2.0 Web Client ID.
  - `GOOGLE_CLIENT_SECRET`: Google OAuth 2.0 Client Secret (stored via `wrangler secret put`).
  - `JWT_SECRET`: Secret key for HMAC-SHA256 session token signing.

---

## 3. Data Model & Storage

### 3.1 D1 Relational Schema (`workers/db/schema.sql`)
```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  avatar_url TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  target_url TEXT NOT NULL,
  user_id TEXT,
  clicks INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  country TEXT,
  referrer TEXT,
  user_agent TEXT,
  FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_links_slug ON links(slug);
CREATE INDEX IF NOT EXISTS idx_links_user ON links(user_id);
CREATE INDEX IF NOT EXISTS idx_clicks_link ON link_clicks(link_id);
```

### 3.2 KV Cache Structure
- **Key:** `slug:{slug}`
- **Value (JSON string):**
  ```json
  {
    "id": "link_cuj123",
    "targetUrl": "https://zulfifazhar.dev/projects"
  }
  ```
- **Sync Invalidation:**
  - Creation: Written to D1 then written immediately to KV (`SHORTENER_CACHE.put("slug:" + slug, json)`).
  - Deletion: Deleted from D1 then evicted from KV (`SHORTENER_CACHE.delete("slug:" + slug)`).

---

## 4. Backend Modular Architecture (`workers/`)

```
workers/
├── app.ts                         # Main Hono entrypoint, middleware, route mounting
├── context.ts                     # TypeScript environment bindings & Hono Context types
├── db/
│   ├── schema.sql                 # D1 SQL DDL schema
│   └── queries.ts                 # D1 typed query helper functions
└── modules/
    ├── auth/                      # Google OAuth & session management
    │   ├── auth.controller.ts     # Route handlers (/api/auth/google, /callback, /me, /logout)
    │   ├── auth.service.ts        # Google token exchange, user profile fetching, JWT creation
    │   └── auth.middleware.ts     # Optional & required session validation middleware
    ├── links/                     # Shortlink creation & management
    │   ├── links.controller.ts    # Route handlers (/api/links, /api/user/links, DELETE)
    │   └── links.service.ts       # URL validation, slug collision check, D1 & KV sync
    └── redirect/                  # High-speed edge redirect & telemetry
        └── redirect.controller.ts # KV lookup, D1 fallback, non-blocking click tracking
```

### 4.1 Edge Redirect Logic (`/:slug`)
1. Extract `slug` from route parameter. Ignore system routes (`api`, `assets`, `favicon.ico`, `build`, etc.).
2. Query `SHORTENER_CACHE.get("slug:" + slug, "json")`.
3. If cache hit:
   - Schedule asynchronous task via `c.executionCtx.waitUntil()`:
     - `UPDATE links SET clicks = clicks + 1, updated_at = ? WHERE id = ?`
     - `INSERT INTO link_clicks (link_id, timestamp, country, referrer, user_agent) VALUES (?, ?, ?, ?, ?)`
   - Immediately respond with `c.redirect(targetUrl, 302)`.
4. If cache miss:
   - Query D1: `SELECT id, target_url FROM links WHERE slug = ?`.
   - If found in D1:
     - Populate KV: `SHORTENER_CACHE.put("slug:" + slug, JSON.stringify({ id, targetUrl }))`.
     - Schedule `waitUntil()` click tracking.
     - Return `c.redirect(targetUrl, 302)`.
   - If not found:
     - Fall through to React Router handler (renders 404 Not Found page).

### 4.2 Authentication Flow
- Standard Google OAuth 2.0 with state verification.
- Session stored in signed cookie `auth_session`:
  - `HttpOnly: true`, `Secure: true`, `SameSite: Lax`, `Path: /`, `Max-Age: 30 days`.
  - Signature validated using `crypto.subtle` (HMAC-SHA256) with `JWT_SECRET`.

---

## 5. Frontend & UI Design (`Design.md` + shadcn/ui)

### 5.1 Design Tokens
- **Primary Color:** `#ff5e1f` (Cloudflare Orange).
- **Secondary Color:** `#262626` (Headline & body dark text).
- **Surface / Background:** `#ffffff` canvas with `#f7f7f7` secondary cards.
- **Accent Soft:** `#ffefe8` for badge highlights and active states.
- **Buttons & Inputs:** `rounded-full` pill controls with 50px standard height for primary actions.

### 5.2 shadcn/ui Components Needed
- `Button` (configured with pill variant option)
- `Input` (configured with pill variant and orange focus ring)
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`
- `Badge` (pill chip for announcements / tags)
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- `DropdownMenu` (for user avatar profile & logout)
- `Toast` / Sonner notification (for copy-to-clipboard alerts)
- Icons: `lucide-react` (Link2, Copy, Check, QrCode, Trash2, ExternalLink, LogIn, LogOut, BarChart3)

### 5.3 Routes & Screens
1. **Global Header (`app/root.tsx`):**
   - Brand: `go.` + `zulfifazhar.dev` with orange dot.
   - Right: "Login with Google" button or User Avatar dropdown (Name, Email, Dashboard, Logout).
2. **Landing Page (`/` - `app/routes/home.tsx`):**
   - **Hero Section:**
     - Chip: `go.zulfifazhar.dev • Cloudflare Edge Shortener`
     - Headline: "Shorten links. Accelerate clicks at the edge."
     - Subheadline: "Blazing fast redirects powered by Cloudflare Workers, KV, and D1."
   - **Shorten Form (Pill Card):**
     - Big URL input field with clear paste icon.
     - Optional custom alias field (enabled when logged in, prompts login when anonymous).
     - Pill Action Button (`#ff5e1f`): "Shorten URL".
   - **Success Card (Dynamic):**
     - Displays shortened link `go.zulfifazhar.dev/xyz`.
     - 1-click "Copy" button with immediate toast feedback.
     - QR code toggle preview.
   - **Feature Highlights (3-card grid):**
     - Sub-millisecond KV redirect.
     - D1 real-time analytics & click tracking.
     - Custom vanity slugs & Google account sync.
3. **Dashboard (`/dashboard` - `app/routes/dashboard.tsx`):**
   - Protected route: redirects unauthenticated users to `/`.
   - Top metrics: Total Links, Total Clicks, Most Active Link.
   - Create new link modal/form.
   - Interactive table of user links:
     - Slug / Short URL (clickable)
     - Original Destination URL (truncated)
     - Click Count badge
     - Creation Date
     - Actions: Copy, QR Code, Delete (with confirmation).

---

## 6. Testing & Verification

1. **Unit & Integration Logic:**
   - Link validator (valid HTTP/HTTPS URLs, sanitization).
   - Slug collision detection & random slug generator.
   - HMAC session token encoding/decoding.
2. **Edge Redirect Verification:**
   - Test redirect with KV cache hit.
   - Test fallback to D1 on KV cache miss.
   - Test click counter and log persistence via `waitUntil`.
3. **End-to-End Build & Types:**
   - `bun run cf-typegen`
   - `bun run typecheck`
   - `bun run build`

# go.zulfifazhar.dev

High-performance, edge-first link shortener deployed on Cloudflare Workers, powered by Hono, React Router v7, Cloudflare D1, and Cloudflare KV.

## Architecture

- **Runtime & Edge Compute**: [Cloudflare Workers](https://workers.cloudflare.com/) delivering sub-millisecond redirects at global edge points of presence.
- **Backend API & Edge Routing**: [Hono](https://hono.dev/) with modular controllers (`/api/auth/*`, `/api/links`, `/api/user/links`) and high-speed edge slug resolution (`/:slug`).
- **Edge Cache Layer**: [Cloudflare Workers KV](https://developers.cloudflare.com/kv/) for ultra-low latency redirect resolution, with asynchronous write-through backfilling on cache misses.
- **Persistent Storage**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (serverless SQLite) storing users, shortlinks, and click telemetry.
- **Frontend**: [React Router v7](https://reactrouter.com/) with SSR, styled with Tailwind CSS v4 and accessible Radix UI / shadcn/ui components.
- **Authentication**: Google OAuth 2.0 flow with cryptographically signed HMAC-SHA256 JWT sessions stored in HTTP-only cookies.

```
                    ┌───────────────────────────────────────────────┐
                    │            Cloudflare Edge Network            │
                    └───────────────────────┬───────────────────────┘
                                            │
               ┌────────────────────────────┴───────────────────────────┐
               ▼                                                        ▼
       [GET /:slug Redirect]                                     [Web / API Routes]
               │                                                        │
        Check KV Cache ───────────────────┐                             │
      ┌────────┴────────┐                 │                             │
    (Hit)             (Miss)              │                             │
      │                 │                 │                             │
  302 Redirect     Query D1 Links         │                             ▼
      │                 │                 │                  React Router SSR &
      │           Backfill KV             │                  Hono Modular APIs
      │                 │                 │              (/api/links, /api/auth)
      ▼                 ▼                 │                             │
┌───────────────────────────────┐         │                             ▼
│ Background ctx.waitUntil:     │         │                     Cloudflare D1 & KV
│ Record click telemetry in D1  │◄────────┘
└───────────────────────────────┘
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.2+)
- Cloudflare account (for remote deployment)

### 1. Install Dependencies

```bash
bun install
```

### 2. Configure Environment & Secrets

Environment variables are configured in `wrangler.jsonc` for local development.

For local development with Google OAuth:
1. Configure credentials in [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Set authorized redirect URI: `http://localhost:5173/api/auth/callback` (production: `https://go.zulfifazhar.dev/api/auth/callback`).
3. Set the variables in `wrangler.jsonc` or pass them as environment variables:
   - `GOOGLE_CLIENT_ID`: Your Google OAuth 2.0 Client ID.
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth 2.0 Client Secret.
   - `JWT_SECRET`: Random string (min 32 characters) for signing session cookies.
   - `BASE_URL`: `http://localhost:5173` (local) or `https://go.zulfifazhar.dev` (production).

For production deployment, add secrets securely via Wrangler:
```bash
bun x wrangler secret put GOOGLE_CLIENT_ID
bun x wrangler secret put GOOGLE_CLIENT_SECRET
bun x wrangler secret put JWT_SECRET
```

### 3. Initialize Local D1 Database & Schema

Apply the database schema to your local D1 SQLite database:

```bash
bun x wrangler d1 execute SHORTENER_DB --local --file=workers/db/schema.sql
```

### 4. Create Production Cloudflare Resources

When preparing for remote deployment to Cloudflare:

```bash
# Create remote D1 database
bun x wrangler d1 create shortener-db

# Execute schema on remote D1 database
bun x wrangler d1 execute SHORTENER_DB --remote --file=workers/db/schema.sql

# Create production KV namespace for edge link caching
bun x wrangler kv namespace create SHORTENER_CACHE
```

Update `wrangler.jsonc` with the generated database ID and KV namespace ID.

### 5. Run Local Development Server

```bash
bun run dev
```

The application will be accessible at `http://localhost:5173`.

## Commands

| Command | Description |
| :--- | :--- |
| `bun run dev` | Starts local dev server with Hono & React Router Vite plugin |
| `bun test` | Runs the test suite with Bun test runner |
| `bun run typecheck` | Generates Worker types & validates TypeScript types across client & server |
| `bun run build` | Builds client assets and Worker SSR production bundles |
| `bun run deploy` | Builds production bundle and deploys Worker to Cloudflare |

## Verification

To verify the codebase:

```bash
# Run all unit and E2E integration tests
bun test

# Validate TypeScript typing
bun run typecheck

# Build production bundle
bun run build
```

## Database Schema

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
```

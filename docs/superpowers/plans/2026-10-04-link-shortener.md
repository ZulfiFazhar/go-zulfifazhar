# Cloudflare Fullstack Link Shortener Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready edge link shortener for `go.zulfifazhar.dev` with anonymous shortening, Google OAuth personal dashboard, Cloudflare KV sub-millisecond edge redirects, D1 click tracking, and an enterprise landing page conforming to `Design.md` using shadcn/ui.

**Architecture:** Fullstack Cloudflare Workers application using Hono for modular API routing and KV/D1 edge operations, paired with React Router v7 for client and SSR rendering. KV handles instant redirect caching (`/:slug`), D1 handles relational persistence (`users`, `links`, `link_clicks`), and asynchronous click metrics run via `executionCtx.waitUntil()`.

**Tech Stack:** Cloudflare Workers, Cloudflare D1, Cloudflare KV, Hono v4, React Router v7, Tailwind CSS v4, shadcn/ui, `lucide-react`, Bun.

**Spec:** `docs/superpowers/specs/2026-10-04-link-shortener-design.md`

## Global Constraints

- **Domain:** `go.zulfifazhar.dev` (local fallback `http://localhost:5173`).
- **Accent Color:** `#ff5e1f` (Cloudflare Orange).
- **Control Shapes:** `rounded-full` pill inputs and buttons (50px min-height for primary CTA).
- **Framework Mode:** React Router v7 with active v8 future flags (`v8_viteEnvironmentApi`, `v8_middleware`, `v8_splitRouteModules`, `v8_passThroughRequests`, `v8_trailingSlashAwareDataRequests`).
- **Context Injection:** Type-safe `RouterContextProvider` via `cloudflareContext` (`app/context.ts`).
- **Telemetry Boundary:** KV redirect responses must never await D1 click tracking operations.

## Review Focus

- Malformed destination URLs (e.g. `javascript:`, missing protocol, or unparseable text) must be rejected before saving.
- Reserved slugs (`api`, `dashboard`, `assets`, `favicon.ico`, `build`) cannot be claimed as short links.
- Expired or tampered `auth_session` cookies must clear cleanly and downgrade to anonymous state without throwing unhandled 500 errors.
- KV cache miss must gracefully fetch from D1, backfill KV, and continue redirect without breaking user navigation.
- Anonymous links cannot be deleted or modified by unauthenticated users.

---

### Task 1: Bindings Configuration, D1 Schema, and Data Layer

**Files:**
- Modify: `wrangler.jsonc`
- Create: `workers/context.ts`
- Create: `workers/db/schema.sql`
- Create: `workers/db/queries.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces:
  - `interface Env`: Cloudflare bindings with `SHORTENER_DB: D1Database`, `SHORTENER_CACHE: KVNamespace`, `BASE_URL: string`, `JWT_SECRET: string`, `GOOGLE_CLIENT_ID: string`, `GOOGLE_CLIENT_SECRET: string`.
  - `createLinkRecord(db: D1Database, data: LinkInsert): Promise<LinkRecord>`
  - `findLinkBySlug(db: D1Database, slug: string): Promise<LinkRecord | null>`
  - `incrementLinkClicks(db: D1Database, id: string, meta: ClickMeta): Promise<void>`
  - `listUserLinks(db: D1Database, userId: string): Promise<LinkRecord[]>`
  - `deleteUserLink(db: D1Database, id: string, userId: string): Promise<boolean>`

- [ ] **Step 1: Write the failing test for DB query helpers**

```ts
// tests/db.test.ts
import { describe, it, expect } from "bun:test";
import { sanitizeSlug, isValidUrl } from "../workers/modules/links/links.service";

describe("Link Validation Logic", () => {
  it("rejects invalid URLs and non-http/https protocols", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
    expect(isValidUrl("not-a-url")).toBe(false);
    expect(isValidUrl("ftp://files.example.com")).toBe(false);
    expect(isValidUrl("https://zulfifazhar.dev")).toBe(true);
    expect(isValidUrl("http://localhost:3000")).toBe(true);
  });

  it("sanitizes and validates custom slugs", () => {
    expect(sanitizeSlug("My-Slug_123")).toBe("My-Slug_123");
    expect(sanitizeSlug("api")).toBeNull(); // reserved
    expect(sanitizeSlug("dashboard")).toBeNull(); // reserved
    expect(sanitizeSlug("invalid space")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/db.test.ts`
Expected: FAIL with missing module `links.service`.

- [ ] **Step 3: Update `wrangler.jsonc` with D1 & KV bindings**

Add `d1_databases` (`SHORTENER_DB`), `kv_namespaces` (`SHORTENER_CACHE`), and env vars to `wrangler.jsonc`.

- [ ] **Step 4: Create `workers/context.ts`, `workers/db/schema.sql`, and `workers/db/queries.ts`**

Define SQL schema for `users`, `links`, and `link_clicks`. Implement type-safe D1 prepared query functions in `workers/db/queries.ts`.

- [ ] **Step 5: Run cf-typegen to update worker types**

Run: `bun run cf-typegen`
Expected: Generates project types with `SHORTENER_DB` and `SHORTENER_CACHE`.

---

### Task 2: Core Shortlink Service & Tests

**Files:**
- Create: `workers/modules/links/links.service.ts`
- Test: `tests/db.test.ts`

**Interfaces:**
- Produces:
  - `isValidUrl(url: string): boolean`
  - `sanitizeSlug(slug: string): string | null`
  - `generateRandomSlug(length?: number): string`
  - `createShortLink(env: Env, input: { url: string; customSlug?: string; userId?: string }): Promise<ShortLinkResult>`

- [ ] **Step 1: Implement `links.service.ts` with validation and random nanoid-style generator**

Ensure reserved slugs (`api`, `dashboard`, `assets`, `favicon.ico`, `build`, `_`, `cdn-cgi`) are blocked.

- [ ] **Step 2: Run test to verify it passes**

Run: `bun test tests/db.test.ts`
Expected: PASS

---

### Task 3: Edge Redirection Controller & Non-Blocking Tracking

**Files:**
- Create: `workers/modules/redirect/redirect.controller.ts`
- Test: `tests/redirect.test.ts`

**Interfaces:**
- Produces:
  - `handleEdgeRedirect(c: Context<{ Bindings: Env }>): Promise<Response | null>`

- [ ] **Step 1: Write test for edge redirect resolution**

```ts
// tests/redirect.test.ts
import { describe, it, expect, mock } from "bun:test";

describe("Edge Redirection Handler", () => {
  it("resolves KV cache hit directly", async () => {
    const mockKv = {
      get: mock(() => Promise.resolve({ id: "1", targetUrl: "https://example.com" })),
    };
    const cached = await mockKv.get("slug:test");
    expect(cached?.targetUrl).toBe("https://example.com");
  });
});
```

- [ ] **Step 2: Implement `redirect.controller.ts`**

1. Check KV `slug:{slug}`.
2. If hit, trigger `c.executionCtx.waitUntil(recordClick(...))` and `return c.redirect(targetUrl, 302)`.
3. If miss, query D1 `findLinkBySlug`. If found, populate KV, trigger `waitUntil`, and redirect.
4. If not found, return `null` so Hono falls through to React Router.

- [ ] **Step 3: Run test to verify it passes**

Run: `bun test tests/redirect.test.ts`
Expected: PASS

---

### Task 4: Google OAuth & Session Middleware

**Files:**
- Create: `workers/modules/auth/auth.service.ts`
- Create: `workers/modules/auth/auth.middleware.ts`
- Create: `workers/modules/auth/auth.controller.ts`
- Test: `tests/auth.test.ts`

**Interfaces:**
- Produces:
  - `signSessionJwt(payload: UserSession, secret: string): Promise<string>`
  - `verifySessionJwt(token: string, secret: string): Promise<UserSession | null>`
  - `authMiddleware`: Hono middleware attaching `c.get("user")`.
  - `authRoutes`: Hono sub-app handling `/api/auth/google`, `/callback`, `/me`, `/logout`.

- [ ] **Step 1: Write tests for session JWT signing & verification**

```ts
// tests/auth.test.ts
import { describe, it, expect } from "bun:test";
import { signSessionJwt, verifySessionJwt } from "../workers/modules/auth/auth.service";

describe("Auth Session JWT", () => {
  it("signs and verifies HMAC-SHA256 session token", async () => {
    const secret = "test-secret-key-1234567890123456";
    const payload = { userId: "user_1", email: "test@example.com", name: "Zulfi" };
    const token = await signSessionJwt(payload, secret);
    expect(typeof token).toBe("string");

    const verified = await verifySessionJwt(token, secret);
    expect(verified?.userId).toBe("user_1");
    expect(verified?.email).toBe("test@example.com");
  });

  it("rejects tampered token", async () => {
    const secret = "test-secret-key-1234567890123456";
    const payload = { userId: "user_1", email: "test@example.com", name: "Zulfi" };
    const token = await signSessionJwt(payload, secret);
    const tampered = token.slice(0, -5) + "abcde";
    const verified = await verifySessionJwt(tampered, secret);
    expect(verified).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun test tests/auth.test.ts`
Expected: FAIL with missing module.

- [ ] **Step 3: Implement Web Crypto HMAC-SHA256 signing and Google OAuth handlers**

Use native Web Crypto API (`crypto.subtle`) without third-party JWT libraries. Implement `auth.service.ts`, `auth.middleware.ts`, and `auth.controller.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tests/auth.test.ts`
Expected: PASS

---

### Task 5: Links API Routes & Hono Modular Wiring

**Files:**
- Create: `workers/modules/links/links.controller.ts`
- Modify: `workers/app.ts`

**Interfaces:**
- Produces:
  - `POST /api/links`: Create shortlink (anonymous or authenticated).
  - `GET /api/user/links`: List authenticated user's links.
  - `DELETE /api/user/links/:id`: Delete authenticated user's link.
  - Mount `/api/auth`, `/api/links`, edge redirect `/:slug`, and React Router SSR.

- [ ] **Step 1: Implement `links.controller.ts` with error handling and JSON responses**
- [ ] **Step 2: Wire up `workers/app.ts` to mount all modular routes**
- [ ] **Step 3: Run typecheck to verify backend TypeScript compilation**

Run: `bun run typecheck`
Expected: PASS with 0 errors.

---

### Task 6: UI Component Primitives (shadcn/ui & Lucide)

**Files:**
- Create: `app/lib/utils.ts`
- Create: `app/components/ui/button.tsx`
- Create: `app/components/ui/input.tsx`
- Create: `app/components/ui/badge.tsx`
- Create: `app/components/ui/card.tsx`
- Create: `app/components/ui/table.tsx`
- Modify: `package.json`

**Interfaces:**
- Produces:
  - `cn(...classes)` helper function (`clsx` + `tailwind-merge`).
  - Reusable pill buttons, inputs, cards, and badges configured with `Design.md` colors (`#ff5e1f` primary).

- [ ] **Step 1: Install required UI utility packages**

Run: `bun add clsx tailwind-merge class-variance-authority lucide-react`

- [ ] **Step 2: Create `app/lib/utils.ts`**
- [ ] **Step 3: Create UI primitives in `app/components/ui/` with pill variants**
- [ ] **Step 4: Verify typecheck passes**

Run: `bun run typecheck`
Expected: PASS

---

### Task 7: Landing Page Implementation (`Design.md` Compliant)

**Files:**
- Modify: `app/routes/home.tsx`
- Modify: `app/root.tsx`
- Create: `app/components/navbar.tsx`
- Create: `app/components/shorten-box.tsx`
- Create: `app/components/features-grid.tsx`

**Interfaces:**
- Consumes:
  - `POST /api/links`
  - `GET /api/auth/me`
- Produces:
  - High-converting landing page matching `Design.md`:
    - Pill chip badge: `go.zulfifazhar.dev • Cloudflare Edge Shortener`.
    - Hero statement: "Shorten links. Accelerate clicks at the edge."
    - Pill input with instant shorten action and inline feedback.
    - Success result display with 1-click copy to clipboard and toast feedback.
    - 3-column enterprise feature cards.

- [ ] **Step 1: Create `app/components/navbar.tsx` with logo (`go.zulfifazhar.dev`) and Google login CTA / user avatar**
- [ ] **Step 2: Implement `app/components/shorten-box.tsx` with form handling, loading state, and copy-to-clipboard**
- [ ] **Step 3: Assemble `app/routes/home.tsx`**
- [ ] **Step 4: Verify build succeeds**

Run: `bun run build`
Expected: PASS

---

### Task 8: Dashboard Page Implementation

**Files:**
- Create: `app/routes/dashboard.tsx`
- Create: `app/components/dashboard-table.tsx`
- Modify: `app/routes.ts`

**Interfaces:**
- Consumes:
  - `GET /api/user/links`
  - `DELETE /api/user/links/:id`
- Produces:
  - Protected route `/dashboard` rendering user statistics (total links, total clicks) and interactive link table with delete and copy actions.

- [ ] **Step 1: Register route `/dashboard` in `app/routes.ts`**
- [ ] **Step 2: Implement `app/routes/dashboard.tsx` with server loader to check session**
- [ ] **Step 3: Implement `app/components/dashboard-table.tsx` with click badges and delete actions**
- [ ] **Step 4: Verify typecheck and build pass**

Run: `bun run typecheck && bun run build`
Expected: PASS

---

### Task 9: End-to-End Integration, Local Seed, and Verification

**Files:**
- Test: `tests/integration.test.ts`
- Documentation: `README.md` (updated with setup instructions for D1 & KV)

- [ ] **Step 1: Create integration test verifying full redirect and link creation flow**
- [ ] **Step 2: Run all tests**

Run: `bun test`
Expected: ALL PASS.

- [ ] **Step 3: Run full typecheck and production build**

Run: `bun run typecheck && bun run build`
Expected: 0 errors, build artifacts created.

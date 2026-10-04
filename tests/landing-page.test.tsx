import { describe, it, expect } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { Navbar } from "../app/components/navbar";
import { ShortenBox } from "../app/components/shorten-box";
import { FeaturesGrid } from "../app/components/features-grid";
import Home, { meta } from "../app/routes/home";

describe("Landing Page Components (Design.md Compliant)", () => {
  it("renders Navbar in unauthenticated state with brand logo and Google sign-in", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Navbar user={null} />
      </MemoryRouter>
    );

    expect(html).toContain("go.zulfifazhar.dev");
    expect(html).toContain("Edge");
    expect(html).toContain("Sign in with Google");
    expect(html).toContain('href="/api/auth/google"');
    expect(html).not.toContain("Dashboard");
  });

  it("renders Navbar in authenticated state with Dashboard link, user avatar, and logout", () => {
    const mockUser = {
      userId: "user-123",
      email: "test@example.com",
      name: "Test User",
      avatarUrl: "https://example.com/avatar.jpg",
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Navbar user={mockUser} />
      </MemoryRouter>
    );

    expect(html).toContain("go.zulfifazhar.dev");
    expect(html).toContain("Dashboard");
    expect(html).toContain('href="/dashboard"');
    expect(html).toContain('src="https://example.com/avatar.jpg"');
    expect(html).toContain('href="/api/auth/logout"');
    expect(html).not.toContain("Sign in with Google");
  });

  it("renders ShortenBox with pill input, 50px CTA button, and custom alias section", () => {
    const html = renderToStaticMarkup(
      <ShortenBox user={null} />
    );

    expect(html).toContain("Paste long URL");
    expect(html).toContain("Shorten URL");
    expect(html).toContain("Add custom alias (optional)");
    expect(html).toContain("rounded-full");
  });

  it("renders ShortenBox error state with error alert", () => {
    const html = renderToStaticMarkup(
      <ShortenBox user={null} initialError="Slug already in use" />
    );

    expect(html).toContain("Slug already in use");
    expect(html).toContain("bg-[#fff0f0]");
  });

  it("renders ShortenBox success state with short link, copy button, and target url", () => {
    const mockResult = {
      id: "link-456",
      slug: "launch2026",
      targetUrl: "https://example.com/company/launch-2026",
      shortUrl: "https://go.zulfifazhar.dev/launch2026",
    };

    const html = renderToStaticMarkup(
      <ShortenBox user={null} initialResult={mockResult} />
    );

    expect(html).toContain("Link shortened at the edge");
    expect(html).toContain("https://go.zulfifazhar.dev/launch2026");
    expect(html).toContain("https://example.com/company/launch-2026");
    expect(html).toContain("Copy");
    expect(html).toContain("Shorten another");
  });

  it("renders FeaturesGrid with all 3 enterprise feature cards", () => {
    const html = renderToStaticMarkup(<FeaturesGrid />);

    expect(html).toContain("Engineered for Enterprise Performance");
    // Card 1
    expect(html).toContain("Sub-millisecond KV redirect");
    expect(html).toContain("&lt; 5ms global latency");
    // Card 2
    expect(html).toContain("Analytics &amp; Tracking");
    expect(html).toContain("Real-time edge stats");
    // Card 3
    expect(html).toContain("Google Auth &amp; Custom Slugs");
    expect(html).toContain("Branded vanity URLs");
  });

  it("renders Home route with hero chip badge, headline, and footer", () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home
          loaderData={{ user: null }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    // Pill chip badge
    expect(html).toContain("go.zulfifazhar.dev • Cloudflare Edge Shortener");
    // Hero statement
    expect(html).toContain("Shorten links. Accelerate clicks at the edge.");
    // Shorten Box
    expect(html).toContain("Shorten URL");
    // Features Grid
    expect(html).toContain("Sub-millisecond KV redirect");
    // Footer
    expect(html).toContain("go.zulfifazhar.dev");
    expect(html).toContain("Cloudflare Workers &amp; KV");
  });

  it("renders Home route with authenticated user dashboard link and avatar", () => {
    const mockUser = {
      userId: "u-999",
      email: "engineer@cloudflare.com",
      name: "Edge Engineer",
    };

    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Home
          loaderData={{ user: mockUser }}
          params={{}}
          matches={[]}
        />
      </MemoryRouter>
    );

    expect(html).toContain("Dashboard");
    expect(html).toContain("Edge Engineer");
    expect(html).toContain('href="/dashboard"');
    expect(html).not.toContain("Sign in with Google");
  });

  it("returns appropriate metadata for Home page", () => {
    const metaTags = meta({
      data: { user: null },
      params: {},
      location: { pathname: "/", search: "", hash: "", state: null, key: "default" },
      matches: [],
    } as any);

    expect(metaTags).toEqual([
      { title: "go.zulfifazhar.dev • Cloudflare Edge Shortener" },
      {
        name: "description",
        content:
          "Shorten links. Accelerate clicks at the edge. High-performance link shortener powered by Cloudflare Workers and KV.",
      },
    ]);
  });
});

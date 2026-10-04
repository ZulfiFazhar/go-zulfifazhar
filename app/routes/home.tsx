import * as React from "react";
import type { Route } from "./+types/home";
import { motion } from "framer-motion";
import { Navbar, type NavbarUser } from "../components/navbar";
import { ShortenBox, type ShortenResult } from "../components/shorten-box";
import { FeaturesGrid } from "../components/features-grid";
import { RecentLinks, type RecentLinkItem } from "../components/recent-links";
import { AnimatedBackground } from "../components/animated-background";
import { LiveStatsChart, type PlatformStats } from "../components/live-stats-chart";
import { Badge } from "../components/ui/badge";
import { cloudflareContext } from "../context";
import { verifySessionJwt } from "../../workers/modules/auth/auth.service";
import { listUserLinks, getPublicPlatformStats } from "../../workers/db/queries";
import { claimLocalHistory } from "../lib/local-history";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "go.zulfifazhar.dev • Cloudflare Edge Shortener" },
    {
      name: "description",
      content:
        "Shorten links. Accelerate clicks at the edge. High-performance link shortener powered by Cloudflare Workers and KV.",
    },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  let user: NavbarUser | null = null;
  let recentLinks: RecentLinkItem[] = [];
  let platformStats: PlatformStats = {
    totalClicks: 0,
    totalLinks: 0,
    trend: [],
  };

  try {
    const cf = context.get(cloudflareContext);
    if (cf?.env?.SHORTENER_DB) {
      try {
        platformStats = await getPublicPlatformStats(cf.env.SHORTENER_DB);
      } catch {
        // Fallback default
      }
    }

    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)auth_session=([^;]+)/);
    if (match) {
      const secret = cf?.env?.JWT_SECRET;
      if (secret) {
        user = await verifySessionJwt(match[1], secret);

        if (user && cf?.env?.SHORTENER_DB) {
          const records = await listUserLinks(cf.env.SHORTENER_DB, user.userId);
          const base = cf.env.BASE_URL
            ? cf.env.BASE_URL.replace(/\/$/, "")
            : "https://go.zulfifazhar.dev";

          recentLinks = records.slice(0, 5).map((r) => ({
            id: r.id,
            slug: r.slug,
            targetUrl: r.target_url,
            shortUrl: `${base}/${r.slug}`,
            clicks: r.clicks,
            createdAt: r.created_at,
          }));
        }
      }
    }
  } catch {
    // If context unavailable or JWT invalid, default to null
  }

  return { user, recentLinks, platformStats };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const user = loaderData?.user ?? null;
  const initialRecent = loaderData?.recentLinks ?? [];
  const initialStats = loaderData?.platformStats;
  const [recentLinks, setRecentLinks] = React.useState<RecentLinkItem[]>(initialRecent);

  // Sync state if loader data changes
  React.useEffect(() => {
    if (loaderData?.recentLinks) {
      setRecentLinks(loaderData.recentLinks);
    }
  }, [loaderData?.recentLinks]);

  // Auto-claim local storage history if user is logged in
  React.useEffect(() => {
    if (user) {
      claimLocalHistory().then((count) => {
        if (count > 0) {
          // Re-fetch or keep current state
        }
      });
    }
  }, [user]);

  const handleCreated = (result: ShortenResult) => {
    const newItem: RecentLinkItem = {
      id: result.id,
      slug: result.slug,
      targetUrl: result.targetUrl,
      shortUrl: result.shortUrl,
      clicks: 0,
      createdAt: Date.now(),
    };
    setRecentLinks((prev) => [newItem, ...prev.filter((l) => l.id !== newItem.id)].slice(0, 5));
  };

  return (
    <div className="relative min-h-screen bg-transparent text-[#262626] flex flex-col justify-between overflow-x-hidden">
      <AnimatedBackground />
      <Navbar user={user} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative mx-auto max-w-6xl px-4 pt-12 pb-8 sm:px-6 sm:pt-20 sm:pb-12">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            {/* Pill chip badge */}
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Badge
                variant="secondary"
                className="mb-6 gap-2 rounded-full border border-[#ffefe8] bg-[#ffefe8] px-4 py-1.5 text-xs font-semibold text-[#ff5e1f]"
              >
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ff5e1f] animate-pulse" />
                <span>go.zulfifazhar.dev • Cloudflare Edge Shortener</span>
              </Badge>
            </motion.div>

            {/* Hero Title */}
            <motion.h1
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-4xl font-medium tracking-tight text-[#262626] sm:text-5xl md:text-6xl md:leading-[1.15]"
            >
              Shorten links. Accelerate clicks at the edge.
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-5 max-w-xl text-base text-neutral-600 sm:text-lg sm:leading-relaxed"
            >
              Global sub-millisecond redirections powered by Cloudflare Workers and KV storage. Instant propagation, real-time analytics, and custom vanity slugs.
            </motion.p>

            {/* Shorten Box */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="mt-8 sm:mt-10 w-full"
            >
              <ShortenBox user={user} onCreated={handleCreated} />
            </motion.div>

            {/* Recent Links (Local History or User Synced) */}
            <RecentLinks user={user} serverLinks={recentLinks} />

            {/* Real-time Edge Activity & Line Chart */}
            <LiveStatsChart initialStats={initialStats} />
          </div>
        </section>

        {/* Features Grid */}
        <FeaturesGrid />
      </main>

      {/* Footer */}
      <footer className="border-t border-[#f0f0f0] bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-neutral-500 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#262626]">go.zulfifazhar.dev</span>
            <span>• Cloudflare Workers &amp; KV</span>
          </div>
          <div>
            <span>Fast, privacy-friendly URL shortener.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

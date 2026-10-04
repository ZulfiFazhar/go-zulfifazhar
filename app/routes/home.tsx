import type { Route } from "./+types/home";
import { motion } from "framer-motion";
import { Navbar, type NavbarUser } from "../components/navbar";
import { ShortenBox } from "../components/shorten-box";
import { FeaturesGrid } from "../components/features-grid";
import { Badge } from "../components/ui/badge";
import { cloudflareContext } from "../context";
import { verifySessionJwt } from "../../workers/modules/auth/auth.service";

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

  try {
    const cookieHeader = request.headers.get("Cookie") || "";
    const match = cookieHeader.match(/(?:^|;\s*)auth_session=([^;]+)/);
    if (match) {
      const cf = context.get(cloudflareContext);
      const secret = cf?.env?.JWT_SECRET;
      if (secret) {
        user = await verifySessionJwt(match[1], secret);
      }
    }
  } catch {
    // If context unavailable or JWT invalid, default to null
  }

  return { user };
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const user = loaderData?.user ?? null;

  return (
    <div className="min-h-screen bg-white text-[#262626] flex flex-col justify-between">
      <Navbar user={user} />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-20 sm:pb-24">
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
              <ShortenBox user={user} />
            </motion.div>
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

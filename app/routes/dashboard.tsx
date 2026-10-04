import * as React from "react";
import { redirect } from "react-router";
import type { Route } from "./+types/dashboard";
import { Navbar, type NavbarUser } from "../components/navbar";
import { ShortenBox, type ShortenResult } from "../components/shorten-box";
import {
  DashboardTable,
  type DashboardLinkItem,
} from "../components/dashboard-table";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { cloudflareContext } from "../context";
import { verifySessionJwt } from "../../workers/modules/auth/auth.service";
import { listUserLinks } from "../../workers/db/queries";
import { Link2, BarChart3, TrendingUp, PlusCircle } from "lucide-react";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Dashboard • go.zulfifazhar.dev" },
    {
      name: "description",
      content:
        "Manage your edge shortlinks and view real-time click analytics.",
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

  if (!user) {
    return redirect("/");
  }

  let links: DashboardLinkItem[] = [];
  try {
    const cf = context.get(cloudflareContext);
    if (cf?.env?.SHORTENER_DB) {
      const records = await listUserLinks(cf.env.SHORTENER_DB, user.userId);
      const base = cf.env.BASE_URL
        ? cf.env.BASE_URL.replace(/\/$/, "")
        : "https://go.zulfifazhar.dev";

      links = records.map((record) => ({
        id: record.id,
        slug: record.slug,
        targetUrl: record.target_url,
        shortUrl: `${base}/${record.slug}`,
        clicks: record.clicks,
        createdAt: record.created_at,
      }));
    }
  } catch {
    // If database query fails, fallback to empty array
  }

  return { user, links };
}

export default function Dashboard({ loaderData }: Route.ComponentProps) {
  const user = loaderData?.user;
  const initialLinks = loaderData?.links ?? [];
  const [links, setLinks] = React.useState<DashboardLinkItem[]>(initialLinks);

  // Sync state when loaderData changes
  React.useEffect(() => {
    if (loaderData?.links) {
      setLinks(loaderData.links);
    }
  }, [loaderData?.links]);

  const handleLinkCreated = (newResult: ShortenResult) => {
    const newLink: DashboardLinkItem = {
      id: newResult.id,
      slug: newResult.slug,
      targetUrl: newResult.targetUrl,
      shortUrl: newResult.shortUrl,
      clicks: 0,
      createdAt: Date.now(),
    };
    setLinks((prev) => [newLink, ...prev.filter((l) => l.id !== newLink.id)]);
  };

  const handleDeleteLink = async (id: string) => {
    const res = await fetch(`/api/user/links/${id}`, {
      method: "DELETE",
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as any;
      throw new Error(data.error || "Failed to delete link");
    }

    setLinks((prev) => prev.filter((link) => link.id !== id));
  };

  // Metrics computation
  const totalLinks = links.length;
  const totalClicks = links.reduce((sum, link) => sum + (link.clicks || 0), 0);
  const mostActiveLink = React.useMemo(() => {
    if (links.length === 0) return null;
    const sorted = [...links].sort((a, b) => (b.clicks || 0) - (a.clicks || 0));
    return sorted[0].clicks > 0 ? sorted[0] : null;
  }, [links]);

  return (
    <div className="min-h-screen bg-white text-[#262626] flex flex-col justify-between">
      <Navbar user={user} />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-[#262626] sm:text-3xl">
                  Dashboard
                </h1>
                <Badge
                  variant="secondary"
                  className="rounded-full bg-[#ffefe8] px-2.5 py-0.5 text-xs font-semibold text-[#ff5e1f]"
                >
                  Edge Analytics
                </Badge>
              </div>
              <p className="mt-1 text-sm text-neutral-500">
                Welcome back, {user?.name || user?.email || "User"}. Manage your short links and real-time click traffic.
              </p>
            </div>
          </div>

          {/* Stats Summary Cards */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Total Links */}
            <Card className="p-5 border-[#f0f0f0] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Total Links
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffefe8] text-[#ff5e1f]">
                  <Link2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold text-[#262626]">
                  {totalLinks}
                </span>
                <p className="mt-1 text-xs text-neutral-500">
                  Active edge routing endpoints
                </p>
              </div>
            </Card>

            {/* Total Clicks */}
            <Card className="p-5 border-[#f0f0f0] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Total Clicks
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffefe8] text-[#ff5e1f]">
                  <BarChart3 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-3xl font-bold text-[#262626]">
                  {totalClicks.toLocaleString()}
                </span>
                <p className="mt-1 text-xs text-neutral-500">
                  Global edge redirects accumulated
                </p>
              </div>
            </Card>

            {/* Most Active Link */}
            <Card className="p-5 border-[#f0f0f0] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Top Performing Link
                </span>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#ffefe8] text-[#ff5e1f]">
                  <TrendingUp className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="truncate block font-mono text-2xl font-bold text-[#262626]">
                  {mostActiveLink ? `/${mostActiveLink.slug}` : "—"}
                </span>
                <p className="mt-1 text-xs text-neutral-500">
                  {mostActiveLink
                    ? `${mostActiveLink.clicks} ${
                        mostActiveLink.clicks === 1 ? "click" : "clicks"
                      }`
                    : "No clicks recorded yet"}
                </p>
              </div>
            </Card>
          </div>

          {/* Shorten Section */}
          <Card className="mb-8 p-6 border-[#f0f0f0] shadow-xs">
            <div className="mb-6 flex items-center gap-2">
              <PlusCircle className="h-5 w-5 text-[#ff5e1f]" />
              <h2 className="text-lg font-semibold text-[#262626]">
                Create Short Link
              </h2>
            </div>
            <ShortenBox
              user={user}
              defaultCustomSlugOpen={true}
              onCreated={handleLinkCreated}
            />
          </Card>

          {/* Link Table Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#262626]">
                  Your Links
                </h2>
                <p className="text-xs text-neutral-500">
                  All active shortlinks and edge redirection targets.
                </p>
              </div>
              <Badge
                variant="outline"
                className="font-mono text-xs border-[#f0f0f0] text-neutral-600"
              >
                {links.length} {links.length === 1 ? "link" : "links"}
              </Badge>
            </div>

            <DashboardTable links={links} onDelete={handleDeleteLink} />
          </div>
        </div>
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

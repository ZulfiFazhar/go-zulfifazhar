import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ExternalLink, Clock, Trash2, ArrowUpRight } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { getLocalHistory, clearLocalHistory, type LocalLinkItem } from "../lib/local-history";

export interface RecentLinkItem {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  clicks?: number;
  createdAt?: number;
}

interface RecentLinksProps {
  user?: { userId: string; email: string; name?: string | null } | null;
  serverLinks?: RecentLinkItem[];
}

export function RecentLinks({ user, serverLinks = [] }: RecentLinksProps) {
  const [localLinks, setLocalLinks] = React.useState<LocalLinkItem[]>([]);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!user) {
      setLocalLinks(getLocalHistory());

      const handleStorage = () => {
        setLocalLinks(getLocalHistory());
      };

      window.addEventListener("storage", handleStorage);
      return () => window.removeEventListener("storage", handleStorage);
    }
  }, [user]);

  const activeLinks: RecentLinkItem[] = user ? serverLinks.slice(0, 5) : localLinks;

  const handleCopy = async (id: string, url: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleClear = () => {
    clearLocalHistory();
    setLocalLinks([]);
  };

  if (activeLinks.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
      className="mt-8 w-full max-w-2xl mx-auto"
    >
      <div className="rounded-2xl border border-[#f0f0f0] bg-white p-5 sm:p-6 shadow-xs">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#ff5e1f]" />
            <h3 className="text-sm font-semibold text-[#262626]">
              {user ? "Your Recent Links" : "Recent Shortened Links"}
            </h3>
            <Badge
              variant="secondary"
              className="rounded-full bg-[#ffefe8] px-2 py-0.5 text-[10px] font-semibold text-[#ff5e1f]"
            >
              {user ? "Account Synced" : "Local History"}
            </Badge>
          </div>

          {user ? (
            <a
              href="/dashboard"
              className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500 hover:text-[#ff5e1f] transition-colors"
            >
              <span>View all in dashboard</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ) : (
            <button
              onClick={handleClear}
              className="inline-flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {!user && (
          <p className="mb-3 text-xs text-neutral-500">
            Stored locally in your browser.{" "}
            <a href="/api/auth/google" className="font-medium text-[#ff5e1f] underline hover:opacity-80">
              Sign in with Google
            </a>{" "}
            to sync them permanently to your account.
          </p>
        )}

        <div className="divide-y divide-[#f5f5f5]">
          <AnimatePresence>
            {activeLinks.map((item) => {
              const isCopied = copiedId === item.id;
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <a
                        href={item.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-1.5 font-mono text-sm font-medium text-[#262626] hover:text-[#ff5e1f] transition-colors"
                      >
                        <span className="truncate">{item.shortUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0 text-neutral-400 group-hover:text-[#ff5e1f]" />
                      </a>

                      {typeof item.clicks === "number" && (
                        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-medium text-neutral-600 whitespace-nowrap">
                          {item.clicks} {item.clicks === 1 ? "click" : "clicks"}
                        </span>
                      )}
                    </div>

                    <p className="mt-0.5 truncate text-xs text-neutral-400">
                      {item.targetUrl}
                    </p>
                  </div>

                  <Button
                    onClick={() => handleCopy(item.id, item.shortUrl)}
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 gap-1.5 rounded-full px-3 text-xs text-neutral-600 hover:text-[#262626]"
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-neutral-400" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, ExternalLink, Loader2, ArrowRight, AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { addLocalHistory } from "../lib/local-history";

export interface ShortenResult {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
}

export interface ShortenBoxProps {
  user?: { userId: string; email: string } | null;
  initialResult?: ShortenResult | null;
  initialError?: string | null;
  onCreated?: (result: ShortenResult) => void;
  defaultCustomSlugOpen?: boolean;
}

export function ShortenBox({
  user,
  initialResult = null,
  initialError = null,
  onCreated,
  defaultCustomSlugOpen = false,
}: ShortenBoxProps) {
  const [url, setUrl] = React.useState("");
  const [customSlug, setCustomSlug] = React.useState("");
  const [showCustomSlug, setShowCustomSlug] = React.useState(defaultCustomSlugOpen);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(initialError);
  const [result, setResult] = React.useState<ShortenResult | null>(initialResult);
  const [copied, setCopied] = React.useState(false);
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    if (!result?.shortUrl) return;

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.shortUrl);
      }
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Fallback if clipboard API fails
      setCopied(true);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setUrl("");
    setCustomSlug("");
    setError(null);
    setResult(null);
    setCopied(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Please enter a valid destination URL");
      return;
    }

    if (!/^https?:\/\//i.test(trimmedUrl)) {
      trimmedUrl = `https://${trimmedUrl}`;
    }

    const trimmedSlug = customSlug.trim();
    if (trimmedSlug && !user) {
      setError("Custom alias requires signing in with Google");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: trimmedUrl,
          customSlug: trimmedSlug || undefined,
        }),
      });

      const data = (await response.json()) as any;

      if (!response.ok) {
        throw new Error(data.error || "Failed to shorten URL");
      }

      // Ensure full URL preview if shortUrl is relative
      let displayShortUrl = data.shortUrl;
      if (displayShortUrl.startsWith("/")) {
        const origin =
          typeof window !== "undefined"
            ? window.location.origin
            : "https://go.zulfifazhar.dev";
        displayShortUrl = `${origin}${displayShortUrl}`;
      }

      const shortened: ShortenResult = {
        id: data.id,
        slug: data.slug,
        targetUrl: data.targetUrl || trimmedUrl,
        shortUrl: displayShortUrl,
      };

      if (!user) {
        addLocalHistory(shortened);
      }

      setResult(shortened);
      onCreated?.(shortened);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: -8 }}
            transition={{ duration: 0.3 }}
            className="rounded-2xl border border-[#f0f0f0] bg-white p-6 sm:p-8 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ffefe8] px-3 py-1 text-xs font-semibold text-[#ff5e1f]">
                <Check className="h-3.5 w-3.5" />
                Link shortened at the edge
              </span>
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-[#262626] transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Shorten another
              </button>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl bg-[#f7f7f7] p-3 sm:p-4">
              <a
                href={result.shortUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2 truncate text-lg font-medium text-[#262626] hover:text-[#ff5e1f] transition-colors font-mono"
              >
                <span className="truncate">{result.shortUrl}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-neutral-400 group-hover:text-[#ff5e1f]" />
              </a>

              <Button
                onClick={handleCopy}
                variant={copied ? "default" : "secondary"}
                size="sm"
                className="h-10 shrink-0 gap-2 px-5 font-medium transition-all"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    <span>Copy</span>
                  </>
                )}
              </Button>
            </div>

            <p className="mt-3 truncate text-xs text-neutral-500">
              Target: <span className="font-mono text-neutral-600">{result.targetUrl}</span>
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.99 }}
            transition={{ duration: 0.25 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-3"
          >
            <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    setUrl(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Paste long URL (e.g. https://github.com/...)"
                  disabled={isLoading}
                  className="h-[50px] w-full rounded-full border border-[#f0f0f0] bg-white px-5 sm:px-6 text-base text-[#262626] placeholder:text-neutral-400 shadow-sm focus-visible:ring-2 focus-visible:ring-[#ff5e1f]"
                />
              </div>

              <Button
                type="submit"
                disabled={isLoading || !url.trim()}
                className="h-[50px] shrink-0 rounded-full bg-[#ff5e1f] px-6 text-base font-medium text-white hover:bg-[#e65016] shadow-sm transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Shortening...</span>
                  </>
                ) : (
                  <>
                    <span>Shorten URL</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            {/* Custom Slug section */}
            <div className="flex flex-col gap-1.5 px-2">
              {!showCustomSlug ? (
                <button
                  type="button"
                  onClick={() => setShowCustomSlug(true)}
                  className="self-start text-xs font-medium text-neutral-500 hover:text-[#ff5e1f] transition-colors"
                >
                  + Add custom alias (optional)
                </button>
              ) : (
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
                  <div className="flex h-9 items-center rounded-full border border-[#f0f0f0] bg-white px-3 text-xs text-neutral-500 shadow-xs">
                    <span className="font-mono text-neutral-400">go.zulfifazhar.dev/</span>
                    <input
                      type="text"
                      value={customSlug}
                      onChange={(e) => setCustomSlug(e.target.value.replace(/[^a-zA-Z0-9_-]/g, ""))}
                      placeholder="custom-slug"
                      disabled={isLoading}
                      className="ml-1 bg-transparent font-mono text-xs text-[#262626] outline-none placeholder:text-neutral-300 w-32"
                    />
                  </div>
                  {!user && (
                    <span className="text-[11px] text-neutral-400 sm:ml-2">
                      (Requires <a href="/api/auth/google" className="underline hover:text-[#ff5e1f]">Google sign-in</a>)
                    </span>
                  )}
                </div>
              )}
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 rounded-xl bg-[#fff0f0] border border-[#fdd] px-4 py-2.5 text-sm text-[#e5484d]"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}

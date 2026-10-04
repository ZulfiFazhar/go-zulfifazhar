import * as React from "react";
import { Copy, Check, Trash2, ExternalLink, Inbox, Loader2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export interface DashboardLinkItem {
  id: string;
  slug: string;
  targetUrl: string;
  shortUrl: string;
  clicks: number;
  createdAt: number;
}

export interface DashboardTableProps {
  links: DashboardLinkItem[];
  onDelete?: (id: string) => Promise<void> | void;
}

function formatDate(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleDateString("en-US", {
      timeZone: "UTC",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return new Date(timestamp).toISOString().slice(0, 10);
  }
}

export function DashboardTable({ links, onDelete }: DashboardTableProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = async (link: DashboardLinkItem) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link.shortUrl);
      }
      setCopiedId(link.id);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedId((curr) => (curr === link.id ? null : curr));
      }, 2000);
    } catch {
      setCopiedId(link.id);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedId((curr) => (curr === link.id ? null : curr));
      }, 2000);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    setErrorMessage(null);

    try {
      if (onDelete) {
        await onDelete(id);
      } else {
        const res = await fetch(`/api/user/links/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as any;
          throw new Error(data.error || "Failed to delete link");
        }
      }
      setConfirmingId(null);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to delete link");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full">
      {errorMessage && (
        <div className="mb-4 rounded-xl border border-[#fdd] bg-[#fff0f0] px-4 py-2.5 text-xs text-[#e5484d]">
          {errorMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white shadow-xs">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#f7f7f7]/80 hover:bg-[#f7f7f7]/80">
              <TableHead className="font-semibold text-[#262626]">Short Link</TableHead>
              <TableHead className="font-semibold text-[#262626]">Destination URL</TableHead>
              <TableHead className="font-semibold text-[#262626]">Clicks</TableHead>
              <TableHead className="font-semibold text-[#262626]">Created</TableHead>
              <TableHead className="text-right font-semibold text-[#262626]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {links.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-44 text-center text-neutral-500"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7f7f7] text-neutral-400">
                      <Inbox className="h-5 w-5" />
                    </div>
                    <p className="text-sm font-medium text-[#262626]">
                      No shortlinks created yet
                    </p>
                    <p className="text-xs text-neutral-500">
                      Shorten a destination URL above to start routing and tracking edge clicks.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              links.map((link) => {
                const isCopied = copiedId === link.id;
                const isConfirming = confirmingId === link.id;
                const isDeleting = deletingId === link.id;

                return (
                  <TableRow key={link.id} className="hover:bg-[#f7f7f7]/50">
                    {/* Short Link */}
                    <TableCell className="font-mono text-sm font-medium">
                      <a
                        href={link.shortUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group inline-flex items-center gap-1.5 text-[#262626] hover:text-[#ff5e1f] transition-colors"
                      >
                        <span className="truncate max-w-[200px] sm:max-w-xs">{link.shortUrl}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-400 group-hover:text-[#ff5e1f]" />
                      </a>
                    </TableCell>

                    {/* Destination URL */}
                    <TableCell>
                      <div
                        className="max-w-[180px] sm:max-w-[260px] md:max-w-[340px] truncate font-mono text-xs text-neutral-500"
                        title={link.targetUrl}
                      >
                        {link.targetUrl}
                      </div>
                    </TableCell>

                    {/* Click count pill badge */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-[#ffefe8] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#ff5e1f]"
                      >
                        {link.clicks} {link.clicks === 1 ? "click" : "clicks"}
                      </Badge>
                    </TableCell>

                    {/* Created Date */}
                    <TableCell className="text-xs text-neutral-500 whitespace-nowrap">
                      {formatDate(link.createdAt)}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Copy button */}
                        <Button
                          variant={isCopied ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleCopy(link)}
                          className={`h-8 gap-1.5 rounded-full px-3 text-xs font-medium transition-all ${
                            isCopied
                              ? "bg-[#ff5e1f] text-white hover:bg-[#e65016]"
                              : "border-[#f0f0f0] text-[#262626] hover:bg-[#f7f7f7]"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="h-3.5 w-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3.5 w-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </Button>

                        {/* Delete action with inline confirmation */}
                        {isConfirming ? (
                          <div className="inline-flex items-center gap-1">
                            <Button
                              variant="default"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDelete(link.id)}
                              className="h-8 rounded-full bg-[#e5484d] px-3 text-xs font-medium text-white hover:bg-[#cf3f44] transition-all"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                "Confirm"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => setConfirmingId(null)}
                              className="h-8 rounded-full px-2 text-xs text-neutral-500 hover:text-[#262626]"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setConfirmingId(link.id)}
                            className="h-8 w-8 rounded-full p-0 text-neutral-400 hover:bg-[#fff0f0] hover:text-[#e5484d] transition-colors"
                            title="Delete link"
                            aria-label={`Delete link ${link.slug}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

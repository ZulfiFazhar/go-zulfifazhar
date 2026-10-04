import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, Copy, Check, QrCode as QrIcon } from "lucide-react";
import { Button } from "./ui/button";

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortUrl: string;
}

export function QrModal({ isOpen, onClose, shortUrl }: QrModalProps) {
  const [svgString, setSvgString] = React.useState<string>("");
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!shortUrl || !isOpen) return;

    let isMounted = true;
    import("qrcode").then((QRCode) => {
      QRCode.toString(
        shortUrl,
        {
          type: "svg",
          margin: 2,
          color: {
            dark: "#262626",
            light: "#ffffff",
          },
        },
        (err, string) => {
          if (isMounted && !err && string) {
            setSvgString(string);
          }
        }
      );
    });

    return () => {
      isMounted = false;
    };
  }, [shortUrl, isOpen]);

  const handleDownloadPng = async () => {
    try {
      const QRCode = await import("qrcode");
      const dataUrl = await QRCode.toDataURL(shortUrl, {
        width: 600,
        margin: 2,
        color: {
          dark: "#262626",
          light: "#ffffff",
        },
      });

      const a = document.createElement("a");
      a.href = dataUrl;
      const slug = shortUrl.split("/").pop() || "qr";
      a.download = `qr-${slug}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error("Failed to download QR code:", err);
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shortUrl);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-10 w-full max-w-sm rounded-3xl border border-[#f0f0f0] bg-white p-6 shadow-xl"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 rounded-full p-1.5 text-neutral-400 hover:bg-[#f5f5f5] hover:text-[#262626] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Title */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffefe8] text-[#ff5e1f]">
              <QrIcon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[#262626]">QR Code</h3>
              <p className="text-xs text-neutral-400">Scan to redirect at the edge</p>
            </div>
          </div>

          {/* QR Code Graphic Box */}
          <div className="mx-auto my-4 flex items-center justify-center rounded-2xl border border-[#f0f0f0] bg-[#fafafa] p-4 shadow-inner">
            {svgString ? (
              <div
                className="h-48 w-48 [&>svg]:h-full [&>svg]:w-full [&>svg]:rounded-lg"
                dangerouslySetInnerHTML={{ __html: svgString }}
              />
            ) : (
              <div className="h-48 w-48 animate-pulse bg-neutral-200 rounded-lg" />
            )}
          </div>

          {/* URL text display */}
          <div className="my-3 rounded-xl border border-[#f5f5f5] bg-[#fafafa] px-3 py-2 text-center">
            <p className="font-mono text-xs font-medium text-[#262626] truncate">
              {shortUrl}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button
              onClick={handleCopy}
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 rounded-full border-[#f0f0f0] text-xs font-medium text-[#262626] hover:bg-[#f7f7f7]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 text-neutral-500" />
                  <span>Copy Link</span>
                </>
              )}
            </Button>

            <Button
              onClick={handleDownloadPng}
              size="sm"
              className="h-9 gap-1.5 rounded-full bg-[#ff5e1f] text-xs font-medium text-white hover:bg-[#e65016]"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download PNG</span>
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

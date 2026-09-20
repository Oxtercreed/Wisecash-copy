import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Camera barcode scanner (html5-qrcode, lazily imported to keep the main
 * bundle light). Calls onDetect with each decoded value.
 */
export function ScannerDialog({
  open,
  onClose,
  onDetect,
}: {
  open: boolean;
  onClose: () => void;
  onDetect: (code: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const scannerRef = useRef<{ stop: () => Promise<void>; clear: () => void } | null>(null);
  const detectedRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    detectedRef.current = false;
    setError(null);
    setStarting(true);

    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const scanner = new Html5Qrcode("sd-scanner-box");
        scannerRef.current = scanner as unknown as { stop: () => Promise<void>; clear: () => void };
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 240, height: 140 } },
          (decoded: string) => {
            if (detectedRef.current) return;
            detectedRef.current = true;
            onDetect(decoded.trim());
            onClose();
          },
          () => {
            /* per-frame decode misses are normal */
          }
        );
        if (!cancelled) setStarting(false);
      } catch (err) {
        if (cancelled) return;
        setStarting(false);
        setError(
          err instanceof Error && /permission/i.test(err.message)
            ? "Camera permission denied — allow camera access and try again."
            : "Could not start the camera on this device."
        );
      }
    })();

    return () => {
      cancelled = true;
      const scanner = scannerRef.current;
      scannerRef.current = null;
      if (scanner) {
        scanner.stop().then(() => scanner.clear()).catch(() => {
          try {
            scanner.clear();
          } catch {
            /* already stopped */
          }
        });
      }
    };
  }, [open, onClose, onDetect]);

  return (
    <Dialog open={open} onClose={onClose} title="Scan barcode">
      <div className="space-y-3">
        <div
          id="sd-scanner-box"
          className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-lg bg-black/90 text-white"
        >
          {starting && <ScanLine className="h-8 w-8 animate-pulse" />}
        </div>
        {error && <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          Point the camera at the product barcode. You can also type codes into the search box.
        </p>
        <Button variant="outline" className="w-full" onClick={onClose}>
          Close
        </Button>
      </div>
    </Dialog>
  );
}

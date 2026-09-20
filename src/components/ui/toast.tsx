import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ toast: (message: string, kind?: ToastKind) => void } | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = nextId++;
    setToasts((prev) => [...prev.slice(-3), { id, kind, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-4 no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex max-w-sm items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-pop animate-fade-up",
              t.kind === "success" && "bg-brand-600",
              t.kind === "error" && "bg-destructive",
              t.kind === "info" && "bg-foreground/90"
            )}
          >
            {t.kind === "success" && <CheckCircle2 className="h-4 w-4 shrink-0" />}
            {t.kind === "error" && <XCircle className="h-4 w-4 shrink-0" />}
            {t.kind === "info" && <Info className="h-4 w-4 shrink-0" />}
            <span className="line-clamp-2">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-muted", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-10", className)}>
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-brand-200 border-t-brand-600" />
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-card/60 px-6 py-12 text-center">
      {icon && <div className="rounded-full bg-secondary p-3 text-muted-foreground">{icon}</div>}
      <h3 className="text-sm font-bold">{title}</h3>
      {description && <p className="max-w-xs text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-lg bg-secondary p-1", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-bold transition-all",
            value === opt.value ? "bg-card text-foreground shadow-soft" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "default" | "positive" | "negative" | "accent";
}) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {icon && (
          <span
            className={cn(
              "rounded-md p-1.5",
              tone === "default" && "bg-secondary text-secondary-foreground",
              tone === "positive" && "bg-brand-100 text-brand-700",
              tone === "negative" && "bg-destructive/10 text-destructive",
              tone === "accent" && "bg-amberbrand-400/20 text-amberbrand-600"
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <span className={cn("text-xl font-extrabold tracking-tight", tone === "negative" && "text-destructive")}>
        {value}
      </span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </div>
  );
}

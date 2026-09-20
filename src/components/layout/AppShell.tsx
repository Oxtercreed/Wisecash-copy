import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useLiveQuery } from "dexie-react-hooks";
import { Bell, Circle, CloudOff, LogOut, MoreHorizontal, RefreshCw, Store } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNotifications, useMarkNotificationsRead } from "@/hooks/modules";
import { outboxDb } from "@/lib/outbox";
import { syncManager } from "@/lib/syncManager";
import { BRAND } from "@/lib/brand";
import { useOnline } from "@/hooks/useOnline";
import { NAV_SECTIONS } from "./nav";
import { useToast } from "@/components/ui/toast";
import { Dialog } from "@/components/ui/dialog";

function useSyncState() {
  const [flushing, setFlushing] = useState(false);
  useEffect(() => {
    const unsub = syncManager.subscribe(({ flushing: f }) => setFlushing(f));
    return () => {
      unsub();
    };
  }, []);
  const pending = useLiveQuery(
    () => outboxDb.outbox.where("status").anyOf("pending", "syncing", "failed").count(),
    [],
    0
  );
  return { flushing, pending: pending ?? 0 };
}

function SyncPill() {
  const online = useOnline();
  const { flushing, pending } = useSyncState();

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        !online && "bg-amberbrand-400/15 text-amberbrand-600",
        online && pending > 0 && "bg-secondary text-secondary-foreground",
        online && pending === 0 && !flushing && "bg-brand-100 text-brand-700",
        flushing && "bg-secondary text-secondary-foreground"
      )}
    >
      {!online ? (
        <>
          <CloudOff className="h-3 w-3" /> Offline mode
        </>
      ) : flushing || pending > 0 ? (
        <>
          <RefreshCw className={cn("h-3 w-3", flushing && "animate-spin")} />
          {flushing ? "Syncing…" : `${pending} to sync`}
        </>
      ) : (
        <>
          <Circle className="h-2 w-2 fill-current" /> Live
        </>
      )}
    </div>
  );
}

function NotificationBell() {
  const navigate = useNavigate();
  const { data: notifications = [] } = useNotifications();
  const { markAllRead } = useMarkNotificationsRead();
  const unreadItems = notifications.filter((n) => !n.read_at);
  const unread = unreadItems.length;

  return (
    <button
      className="relative rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      aria-label="Notifications"
      onClick={() => {
        if (unread > 0) void markAllRead.mutateAsync(unreadItems.map((u) => u.id)).catch(() => undefined);
        navigate("/notifications");
      }}
    >
      <Bell className="h-5 w-5" />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-extrabold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}

export function AppShell() {
  const { shop, profile, signOut } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => setMoreOpen(false), [location.pathname]);

  const primaryItems = NAV_SECTIONS[0].items.filter((n) => n.primary);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col overflow-y-auto bg-brand-950 text-white lg:flex no-print scrollbar-thin">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600">
            <Store className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-extrabold leading-tight">{BRAND.name}</p>
            <p className="text-[11px] text-white/60">Shopkeeper's assistant</p>
          </div>
        </div>

        <nav className="flex-1 space-y-3 px-3 py-1 pb-4">
          {NAV_SECTIONS.map((section) => (
            <div key={section.labelKey}>
              <p className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-white/35">
                {t(section.labelKey) !== section.labelKey ? t(section.labelKey) : section.fallback}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
                        isActive ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
                      )
                    }
                  >
                    <item.icon className="h-[17px] w-[17px]" />
                    {(() => {
                      const translated = t(item.labelKey);
                      return translated !== item.labelKey ? translated : item.fallback;
                    })()}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 px-4 py-4">
          <p className="truncate text-sm font-bold">{shop?.name ?? "My Shop"}</p>
          <p className="mb-3 truncate text-xs text-white/50">
            {profile?.full_name} · {profile?.role}
          </p>
          <button
            onClick={async () => {
              await signOut();
              toast("Signed out", "info");
            }}
            className="flex items-center gap-2 text-xs font-semibold text-white/60 transition-colors hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur lg:px-8 no-print">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Store className="h-4 w-4" />
            </span>
            <span className="text-sm font-extrabold">{BRAND.name}</span>
          </div>
          <div className="hidden lg:block">
            <h1 className="text-base font-extrabold">{shop?.name ?? "My Shop"}</h1>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <SyncPill />
          </div>
        </header>

        <main className="flex-1 px-4 pb-24 pt-4 lg:px-8 lg:pb-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden no-print">
        {primaryItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold transition-colors",
                isActive ? "text-brand-600" : "text-muted-foreground"
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {(() => {
              const translated = t(item.labelKey);
              return translated !== item.labelKey ? translated : item.fallback;
            })()}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-bold text-muted-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
          {t("nav.more") !== "nav.more" ? t("nav.more") : "More"}
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="All modules">
        <div className="grid grid-cols-3 gap-2">
          {NAV_SECTIONS.flatMap((s) => s.items)
            .filter((n) => !n.primary)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className="flex flex-col items-center gap-2 rounded-xl border p-3 text-center text-[11px] font-bold transition-colors hover:bg-secondary"
              >
                <item.icon className="h-5 w-5 text-brand-600" />
                {(() => {
                  const translated = t(item.labelKey);
                  return translated !== item.labelKey ? translated : item.fallback;
                })()}
              </NavLink>
            ))}
        </div>
        <button
          onClick={async () => {
            await signOut();
            toast("Signed out", "info");
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold text-destructive"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </Dialog>
    </div>
  );
}

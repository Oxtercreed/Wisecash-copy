import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CheckCheck, CreditCard, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useMarkNotificationsRead, useNotifications } from "@/hooks/modules";
import { cn } from "@/lib/utils";

export default function NotificationsPage() {
  const { toast } = useToast();
  const { data: notifications = [], isLoading } = useNotifications();
  const { markAllRead } = useMarkNotificationsRead();

  const unread = useMemo(() => notifications.filter((n) => !n.read_at), [notifications]);
  const sorted = useMemo(
    () => [...notifications].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [notifications]
  );

  const icon = (type: string) =>
    type === "warning" ? (
      <AlertTriangle className="h-4 w-4 text-amberbrand-600" />
    ) : type === "credit" ? (
      <CreditCard className="h-4 w-4 text-destructive" />
    ) : (
      <Info className="h-4 w-4 text-brand-600" />
    );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Notifications</h1>
          <p className="text-xs text-muted-foreground">{unread.length} unread</p>
        </div>
        {unread.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            loading={markAllRead.isPending}
            onClick={async () => {
              try {
                await markAllRead.mutateAsync(unread.map((u) => u.id));
                toast("All caught up", "success");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              }
            }}
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : sorted.length === 0 ? (
        <EmptyState icon={<Bell className="h-5 w-5" />} title="No notifications" description="Low stock alerts and credit sales will show up here automatically." />
      ) : (
        <div className="space-y-2">
          {sorted.map((n) => {
            const inner = (
              <div
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 shadow-soft transition-colors",
                  !n.read_at ? "bg-brand-50/60" : "bg-card",
                  n.link && "cursor-pointer hover:shadow-pop"
                )}
              >
                <div className="mt-0.5 rounded-lg bg-secondary p-2">{icon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{n.title}</p>
                    {!n.read_at && <Badge variant="default">new</Badge>}
                  </div>
                  {n.body && <p className="text-xs text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
            return n.link ? (
              <Link key={n.id} to={n.link} className="block">
                {inner}
              </Link>
            ) : (
              <div key={n.id}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

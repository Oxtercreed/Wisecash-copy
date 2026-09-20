import { ArchiveRestore, Trash, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useRecycleBin, useRecycleBinActions } from "@/hooks/modules";

const ENTITY_LABEL: Record<string, string> = {
  products: "Product",
  customers: "Customer",
  expenses: "Expense",
};

export default function RecycleBinPage() {
  const { toast } = useToast();
  const { data: items = [], isLoading } = useRecycleBin();
  const { restore, purge } = useRecycleBinActions();

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Recycle Bin</h1>
        <p className="text-xs text-muted-foreground">Deleted items are kept for 7 days, then purged</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={<Trash className="h-5 w-5" />} title="The bin is empty" description="Deleted products, customers and expenses wait here for 7 days before disappearing forever." />
      ) : (
        <div className="space-y-2">
          {items.map((it) => {
            const expires = new Date(it.expires_at);
            const daysLeft = Math.max(0, Math.ceil((expires.getTime() - Date.now()) / 86400000));
            return (
              <div key={it.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{it.item_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ENTITY_LABEL[it.entity_type] ?? it.entity_type} · deleted{" "}
                    {new Date(it.deleted_at).toLocaleDateString("en", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <Badge variant={daysLeft <= 1 ? "destructive" : "outline"}>{daysLeft}d left</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  loading={restore.isPending && restore.variables?.p_bin_id === it.id}
                  onClick={async () => {
                    try {
                      await restore.mutateAsync({ p_bin_id: it.id });
                      toast("Restored", "success");
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Failed", "error");
                    }
                  }}
                >
                  <ArchiveRestore className="h-3.5 w-3.5" /> Restore
                </Button>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={async () => {
                    if (!window.confirm(`Permanently delete "${it.item_name}"? This cannot be undone.`)) return;
                    try {
                      await purge.mutateAsync({ p_bin_id: it.id });
                      toast("Deleted forever", "success");
                    } catch (err) {
                      toast(err instanceof Error ? err.message : "Failed", "error");
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

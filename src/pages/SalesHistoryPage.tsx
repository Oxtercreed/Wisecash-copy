import { useMemo, useState } from "react";
import { Ban, Receipt, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useSales, useVoidSale } from "@/hooks/useSales";
import { formatMoney } from "@/lib/money";
import type { SaleWithItems } from "@/lib/types";

export default function SalesHistoryPage() {
  const { shop, role } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const [range, setRange] = useState<"1" | "7" | "30">("7");
  const { data: sales, isLoading, pendingCount } = useSales(Number(range));
  const { mutateAsync: voidSale, isPending: voiding } = useVoidSale();
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<SaleWithItems | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sales ?? [];
    return (sales ?? []).filter(
      (s) =>
        s.invoice_number.toLowerCase().includes(q) ||
        (s.customer_name ?? "").toLowerCase().includes(q) ||
        String(s.total).includes(q)
    );
  }, [sales, search]);

  const totalSold = (sales ?? []).filter((s) => s.status === "completed").reduce((sum, s) => sum + s.total, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Sales</h1>
          <p className="text-xs text-muted-foreground">
            {filtered.length} sale(s) · {formatMoney(totalSold, currency)} total
            {pendingCount > 0 && ` · ${pendingCount} waiting to sync`}
          </p>
        </div>
        <Segmented
          value={range}
          onChange={setRange}
          options={[
            { value: "1", label: "Today" },
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
          ]}
        />
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice, customer or amount…" className="pl-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="h-5 w-5" />} title="No sales in this period" description="Completed sales appear here instantly." />
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <button key={s.id} onClick={() => setDetail(s)} className="block w-full text-left">
              <Card className="flex items-center gap-3 p-3 transition-shadow hover:shadow-pop">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                  <Receipt className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.invoice_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.customer_name ?? "Walk-in"} · {new Date(s.created_at).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{formatMoney(s.total, currency)}</p>
                  {s.status === "voided" ? (
                    <Badge variant="destructive">voided</Badge>
                  ) : (
                    <Badge variant="secondary" className="capitalize">{s.payment_method}</Badge>
                  )}
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title={`Sale ${detail?.invoice_number ?? ""}`}>
        {detail && (
          <div className="space-y-3">
            <div className="space-y-1.5 rounded-lg border p-3 text-sm">
              {detail.sale_items?.map((it) => (
                <div key={it.id} className="flex justify-between">
                  <span className="truncate pr-2 text-muted-foreground">{it.quantity} × {it.product_name}</span>
                  <span className="font-semibold">{formatMoney(it.line_total, currency)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t pt-1.5 font-extrabold">
                <span>Total</span><span>{formatMoney(detail.total, currency)}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary" className="capitalize">{detail.payment_method}</Badge>
              {detail.mpesa_ref && <Badge variant="outline">Ref {detail.mpesa_ref}</Badge>}
              {detail.credit_amount > 0 && <Badge variant="warning">Credit {formatMoney(detail.credit_amount, currency)}</Badge>}
              {detail.idempotency_key?.startsWith?.("offline") && <Badge variant="outline">from offline sync</Badge>}
            </div>
            {detail.status === "completed" && (role === "owner" || role === "manager") && (
              <Button
                variant="destructive"
                className="w-full"
                loading={voiding}
                onClick={async () => {
                  try {
                    await voidSale(detail.id);
                    toast("Sale voided — stock returned", "success");
                    setDetail(null);
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Could not void", "error");
                  }
                }}
              >
                <Ban className="h-4 w-4" /> Void sale (restock items)
              </Button>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}

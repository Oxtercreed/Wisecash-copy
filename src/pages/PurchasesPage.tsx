import { useMemo, useState } from "react";
import { Minus, PackagePlus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { usePurchases, useRecordPurchase, useSuppliers } from "@/hooks/modules";
import { formatMoney, parseAmount } from "@/lib/money";

interface Line {
  product_id: string;
  name: string;
  quantity: number;
  unit_cost: number;
}

export default function PurchasesPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: purchases = [], isLoading } = usePurchases();
  const { data: suppliers = [] } = useSuppliers();
  const { data: products = [] } = useProducts();
  const recordPurchase = useRecordPurchase();

  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [reference, setReference] = useState("");
  const [paid, setPaid] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [detail, setDetail] = useState<(typeof purchases)[number] | null>(null);

  const total = lines.reduce((s, l) => s + l.quantity * l.unit_cost, 0);

  const recent = useMemo(() => purchases.slice(0, 50), [purchases]);

  function addLine() {
    const p = products.find((x) => x.id === productId);
    if (!p) return toast("Pick a product", "error");
    if (parseAmount(qty) <= 0) return toast("Enter quantity", "error");
    setLines((prev) => [
      ...prev.filter((l) => l.product_id !== p.id),
      { product_id: p.id, name: p.name, quantity: parseAmount(qty), unit_cost: parseAmount(cost) || p.buying_price },
    ]);
    setProductId("");
    setQty("");
    setCost("");
  }

  async function submit() {
    if (lines.length === 0) return toast("Add at least one item", "error");
    try {
      await recordPurchase.mutateAsync({
        p_supplier_id: supplierId || null,
        p_reference: reference.trim() || null,
        p_items: lines.map((l) => ({ product_id: l.product_id, product_name: l.name, quantity: l.quantity, unit_cost: l.unit_cost })),
        p_paid: parseAmount(paid),
        p_note: null,
      });
      toast(`Purchase recorded — stock updated`, "success");
      setOpen(false);
      setLines([]);
      setPaid("");
      setReference("");
      setSupplierId("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Purchases</h1>
          <p className="text-xs text-muted-foreground">Receive stock from suppliers — costs & debt update automatically</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <PackagePlus className="h-4 w-4" /> Record purchase
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : recent.length === 0 ? (
        <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="No purchases yet" description="Record stock you receive — it flows straight into inventory." />
      ) : (
        <div className="space-y-2">
          {recent.map((p) => (
            <button key={p.id} onClick={() => setDetail(p)} className="block w-full text-left">
              <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft transition-shadow hover:shadow-pop">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{p.supplier_name ?? "Unknown supplier"}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.purchase_items?.length ?? 0} item(s) · {new Date(p.created_at).toLocaleDateString("en", { day: "numeric", month: "short" })}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                </div>
                {p.total - p.paid > 0 && <Badge variant="warning">unpaid {formatMoney(p.total - p.paid, currency)}</Badge>}
                <span className="text-sm font-extrabold">{formatMoney(p.total, currency)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Record purchase */}
      <Dialog open={open} onClose={() => setOpen(false)} title="Record purchase" wide>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier">
              <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                <option value="">— none —</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </Field>
            <Field label="Reference / invoice #"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="optional" /></Field>
          </div>

          <div className="rounded-lg border p-3">
            <div className="grid grid-cols-[1fr_80px_100px_auto] gap-2">
              <Field label="Product">
                <Select value={productId} onChange={(e) => { setProductId(e.target.value); const p = products.find((x) => x.id === e.target.value); if (p) setCost(String(p.buying_price)); }}>
                  <option value="">Choose…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </Field>
              <Field label="Qty"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
              <Field label={`Unit cost`}><Input type="number" value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
              <div className="flex items-end">
                <Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={addLine}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              {lines.map((l) => (
                <div key={l.product_id} className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                  <span className="text-xs text-muted-foreground">{l.quantity} × {formatMoney(l.unit_cost, currency)}</span>
                  <span className="w-24 text-right font-bold">{formatMoney(l.quantity * l.unit_cost, currency)}</span>
                  <button onClick={() => setLines((prev) => prev.filter((x) => x.product_id !== l.product_id))} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {lines.length === 0 && <p className="py-2 text-center text-xs text-muted-foreground">Pick a product, enter qty & cost, then press +</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Amount paid now (${currency})`} hint={`Rest becomes supplier debt`}>
              <Input type="number" value={paid} onChange={(e) => setPaid(e.target.value)} inputMode="decimal" placeholder={String(total)} />
            </Field>
            <div className="flex flex-col justify-end">
              <p className="text-right text-lg font-extrabold">Total: {formatMoney(total, currency)}</p>
            </div>
          </div>

          <Button className="w-full" loading={recordPurchase.isPending} onClick={() => void submit()}>
            Save purchase · {formatMoney(total, currency)}
          </Button>
        </div>
      </Dialog>

      {/* Purchase detail */}
      <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} title={`Purchase — ${detail?.supplier_name ?? ""}`}>
        <div className="space-y-1.5 rounded-lg border p-3 text-sm">
          {detail?.purchase_items?.map((it) => (
            <div key={it.id} className="flex justify-between">
              <span className="text-muted-foreground">{it.quantity} × {it.product_name} @ {formatMoney(it.unit_cost, currency)}</span>
              <span className="font-semibold">{formatMoney(it.line_total, currency)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1.5 font-extrabold"><span>Total</span><span>{formatMoney(detail?.total ?? 0, currency)}</span></div>
          <div className="flex justify-between text-xs text-muted-foreground"><span>Paid</span><span>{formatMoney(detail?.paid ?? 0, currency)}</span></div>
        </div>
      </Dialog>
    </div>
  );
}

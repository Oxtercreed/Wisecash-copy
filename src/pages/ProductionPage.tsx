import { useState } from "react";
import { Factory, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useCompleteProduction, useProductionBatches } from "@/hooks/modules";
import { formatMoney, parseAmount } from "@/lib/money";

interface InputLine {
  key: string;
  product_id: string;
  name: string;
  qty: number;
  unit_cost: number;
}

export default function ProductionPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: batches = [], isLoading } = useProductionBatches();
  const { data: products = [] } = useProducts();
  const completeProduction = useCompleteProduction();

  const [open, setOpen] = useState(false);
  const [outputId, setOutputId] = useState("");
  const [outputQty, setOutputQty] = useState("");
  const [inputs, setInputs] = useState<InputLine[]>([]);
  const [inputId, setInputId] = useState("");
  const [inputQty, setInputQty] = useState("");

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? "Product";
  const estimatedCost = inputs.reduce((s, l) => s + l.qty * l.unit_cost, 0);
  const stockable = products.filter((p) => p.tracks_stock);

  async function submit() {
    const outQty = parseAmount(outputQty);
    if (!outputId) return toast("Pick the output product", "error");
    if (outQty <= 0) return toast("How many units are produced?", "error");
    if (inputs.length === 0) return toast("Add at least one input", "error");
    try {
      await completeProduction.mutateAsync({
        p_output_product_id: outputId,
        p_output_qty: outQty,
        p_inputs: inputs.map((l) => ({ product_id: l.product_id, quantity: l.qty })),
      });
      toast(`Batch complete — ${outQty} × ${productName(outputId)} added to stock`, "success");
      setOpen(false);
      setInputs([]);
      setOutputQty("");
      setOutputId("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Production</h1>
          <p className="text-xs text-muted-foreground">Combine inputs into finished products — costs are calculated for you</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Factory className="h-4 w-4" /> New batch
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : batches.length === 0 ? (
        <EmptyState icon={<Factory className="h-5 w-5" />} title="No production yet" description="e.g. turn flour + sugar + oil into 50 packs of mandazi mix." />
      ) : (
        <div className="space-y-2">
          {batches.map((b) => (
            <div key={b.id} className="rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {b.output_qty} × {productName(b.output_product_id)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    from {b.inputs.map((i) => `${i.quantity} × ${productName(i.product_id)}`).join(", ")} ·{" "}
                    {new Date(b.created_at).toLocaleDateString("en", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  unit cost ≈ {formatMoney(Math.round(b.input_cost_total / b.output_qty), currency)}
                </span>
                <span className="text-sm font-extrabold">{formatMoney(b.input_cost_total, currency)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New production batch" wide>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Output product">
              <Select value={outputId} onChange={(e) => setOutputId(e.target.value)}>
                <option value="">Choose…</option>
                {stockable.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field label="Units produced"><Input type="number" value={outputQty} onChange={(e) => setOutputQty(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
          </div>

          <div className="grid grid-cols-[1fr_90px_auto] gap-2 rounded-lg border p-3">
            <Field label="Input used">
              <Select value={inputId} onChange={(e) => setInputId(e.target.value)}>
                <option value="">Choose…</option>
                {stockable.map((p) => <option key={p.id} value={p.id}>{p.name} — cost {formatMoney(p.buying_price, currency)}</option>)}
              </Select>
            </Field>
            <Field label="Qty used"><Input type="number" value={inputQty} onChange={(e) => setInputQty(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
            <div className="flex items-end">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10"
                onClick={() => {
                  const p = products.find((x) => x.id === inputId);
                  if (!p) return toast("Pick an input product", "error");
                  if (parseAmount(inputQty) <= 0) return toast("Enter quantity", "error");
                  setInputs((prev) => [
                    ...prev.filter((l) => l.product_id !== p.id),
                    { key: p.id, product_id: p.id, name: p.name, qty: parseAmount(inputQty), unit_cost: p.buying_price },
                  ]);
                  setInputId("");
                  setInputQty("");
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            {inputs.map((l) => (
              <div key={l.key} className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.qty} × {formatMoney(l.unit_cost, currency)}</span>
                <button onClick={() => setInputs((prev) => prev.filter((x) => x.key !== l.key))} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-right text-sm font-bold text-muted-foreground">
            Estimated input cost: {formatMoney(estimatedCost, currency)}
          </p>
          <Button className="w-full" loading={completeProduction.isPending} onClick={() => void submit()}>
            Complete batch
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

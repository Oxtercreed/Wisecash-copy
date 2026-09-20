import { useState } from "react";
import { Plus, Trash2, Vault } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, StatCard } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useAssetActions, useAssets } from "@/hooks/modules";
import { formatMoney, formatMoneyCompact, parseAmount } from "@/lib/money";
import type { Asset } from "@/lib/types";

const CONDITIONS = ["Excellent", "Good", "Fair", "Needs repair", "Retired"];

export default function AssetsPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: assets = [], isLoading } = useAssets();
  const { create, update, remove } = useAssetActions();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Equipment");
  const [location, setLocation] = useState("");
  const [price, setPrice] = useState("");
  const [value, setValue] = useState("");
  const [condition, setCondition] = useState("Good");
  const [init, setInit] = useState(false);

  if (open && !init) {
    setInit(true);
    setName(editing?.name ?? "");
    setCategory(editing?.category ?? "Equipment");
    setLocation(editing?.location ?? "");
    setPrice(editing ? String(editing.purchase_price) : "");
    setValue(editing ? String(editing.current_value) : "");
    setCondition(editing?.condition ?? "Good");
  }
  if (!open && init) setInit(false);

  const totalValue = assets.reduce((s, a) => s + a.current_value, 0);
  const totalCost = assets.reduce((s, a) => s + a.purchase_price, 0);

  async function save() {
    if (!name.trim()) return toast("Name is required", "error");
    const payload = {
      name: name.trim(),
      category,
      location: location.trim() || null,
      purchase_price: parseAmount(price),
      current_value: parseAmount(value),
      condition,
      purchase_date: editing?.purchase_date ?? new Date().toISOString().slice(0, 10),
    };
    try {
      if (editing) await update.mutateAsync({ id: editing.id, ...payload } as unknown as Record<string, unknown>);
      else await create.mutateAsync(payload);
      toast("Asset saved", "success");
      setOpen(false);
      setEditing(null);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Assets</h1>
          <p className="text-xs text-muted-foreground">Freezers, shelves, motorcycles — what the shop owns</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Add asset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Current value" value={formatMoneyCompact(totalValue, currency)} sub={`${assets.length} asset(s)`} icon={<Vault className="h-4 w-4" />} tone="positive" />
        <StatCard label="Originally cost" value={formatMoneyCompact(totalCost, currency)} icon={<Vault className="h-4 w-4" />} />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : assets.length === 0 ? (
        <EmptyState icon={<Vault className="h-5 w-5" />} title="No assets recorded" description="Track big items so you know your business's real worth." />
      ) : (
        <div className="space-y-2">
          {assets.map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{a.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {a.category}{a.location ? ` · ${a.location}` : ""} · bought {formatMoney(a.purchase_price, currency)}
                </p>
              </div>
              <Badge variant={a.condition === "Needs repair" || a.condition === "Retired" ? "warning" : "secondary"}>{a.condition}</Badge>
              <span className="text-sm font-extrabold">{formatMoney(a.current_value, currency)}</span>
              <Button variant="outline" size="sm" onClick={() => { setEditing(a); setOpen(true); }}>Edit</Button>
              <button
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  if (!window.confirm(`Remove ${a.name}?`)) return;
                  try {
                    await remove.mutateAsync(a.id);
                    toast("Asset removed", "success");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Failed", "error");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Edit asset" : "Add asset"}>
        <div className="flex flex-col gap-3">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Deep freezer" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                {["Equipment", "Furniture", "Vehicle", "Electronics", "Building", "Other"].map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Condition">
              <Select value={condition} onChange={(e) => setCondition(e.target.value)}>
                {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Location"><Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Main shop" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`Bought for (${currency})`}><Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
            <Field label="Current value"><Input type="number" value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
          </div>
          <Button loading={create.isPending || update.isPending} onClick={() => void save()}>Save asset</Button>
        </div>
      </Dialog>
    </div>
  );
}

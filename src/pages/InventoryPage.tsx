import { useMemo, useState } from "react";
import { AlertTriangle, Package, PackagePlus, Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState, Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories, useProductMutations, useProducts, type ProductInput } from "@/hooks/useProducts";
import { formatMoney, parseAmount } from "@/lib/money";
import type { Product } from "@/lib/types";

const UNITS = ["piece", "kg", "litre", "bag", "box", "packet", "service"];

export default function InventoryPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const currency = shop?.currency ?? "TZS";
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { create, update, archive, adjustStock, createCategory } = useProductMutations();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (filter === "low" && !(p.tracks_stock && p.stock <= p.low_stock_at)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.barcode ?? "").includes(q);
    });
  }, [products, search, filter]);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Stock</h1>
          <p className="text-xs text-muted-foreground">{products.length} product(s) · live stock levels</p>
        </div>
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <PackagePlus className="h-4 w-4" /> Add product
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products or barcode…" className="pl-9" />
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "low", label: "Low stock" },
          ]}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title={search ? "No matches" : "No products yet"}
          description={search ? "Try a different search." : "Add your first product to start selling."}
          action={!search && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4" /> Add product</Button>}
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const low = p.tracks_stock && p.stock <= p.low_stock_at;
            const margin = p.selling_price - p.buying_price;
            return (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    {p.tracks_stock ? (
                      <Badge variant={p.stock <= 0 ? "destructive" : low ? "warning" : "secondary"}>
                        {p.stock <= 0 ? "Out of stock" : `${p.stock} ${p.unit}`}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Service</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Buy {formatMoney(p.buying_price, currency)} · Sell {formatMoney(p.selling_price, currency)} ·{" "}
                    <span className={margin >= 0 ? "text-brand-700" : "text-destructive"}>margin {formatMoney(margin, currency)}</span>
                  </p>
                </div>
                {p.tracks_stock && (
                  <Button variant="outline" size="sm" onClick={() => setAdjusting(p)}>
                    Adjust
                  </Button>
                )}
                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => { setEditing(p); setDialogOpen(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <ProductDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        product={editing}
        categories={categories}
        currency={currency}
        onCreateCategory={(name) => createCategory.mutateAsync(name)}
        onSave={async (input) => {
          try {
            if (editing) {
              await update.mutateAsync({ ...input, id: editing.id });
              toast("Product updated", "success");
            } else {
              await create.mutateAsync(input);
              toast("Product added", "success");
            }
            setDialogOpen(false);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Failed to save", "error");
          }
        }}
        saving={create.isPending || update.isPending}
      />

      <AdjustDialog
        product={adjusting}
        onClose={() => setAdjusting(null)}
        currency={currency}
        onSubmit={async (delta, reason) => {
          if (!adjusting) return;
          try {
            await adjustStock.mutateAsync({ productId: adjusting.id, delta, reason });
            toast(`Stock updated: ${delta > 0 ? "+" : ""}${delta} ${adjusting.unit}`, "success");
            setAdjusting(null);
          } catch (err) {
            toast(err instanceof Error ? err.message : "Failed", "error");
          }
        }}
        saving={adjustStock.isPending}
      />
    </div>
  );
}

function ProductDialog({
  open,
  onClose,
  product,
  categories,
  currency,
  onSave,
  onCreateCategory,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  product: Product | null;
  categories: Array<{ id: string; name: string }>;
  currency: string;
  onSave: (input: ProductInput) => Promise<void>;
  onCreateCategory: (name: string) => Promise<{ id: string; name: string }>;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [barcode, setBarcode] = useState("");
  const [unit, setUnit] = useState("piece");
  const [buy, setBuy] = useState("");
  const [sell, setSell] = useState("");
  const [stock, setStock] = useState("");
  const [lowAt, setLowAt] = useState("5");
  const [tracks, setTracks] = useState(true);
  const [newCat, setNewCat] = useState("");
  const [initialized, setInitialized] = useState(false);

  // Sync form when opening for edit vs create
  const key = `${open}-${product?.id ?? "new"}`;
  if (open && !initialized) {
    setInitialized(true);
    setName(product?.name ?? "");
    setCategoryId(product?.category_id ?? "");
    setBarcode(product?.barcode ?? "");
    setUnit(product?.unit ?? "piece");
    setBuy(product ? String(product.buying_price) : "");
    setSell(product ? String(product.selling_price) : "");
    setStock(product && product.tracks_stock ? String(product.stock) : "");
    setLowAt(String(product?.low_stock_at ?? 5));
    setTracks(product ? product.tracks_stock : true);
    setNewCat("");
  }
  if (!open && initialized) setInitialized(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Product name is required", "error");
    if (parseAmount(sell) <= 0) return toast("Selling price must be greater than 0", "error");
    await onSave({
      name: name.trim(),
      category_id: categoryId || null,
      barcode: barcode.trim() || null,
      unit,
      buying_price: parseAmount(buy),
      selling_price: parseAmount(sell),
      stock: tracks ? parseAmount(stock) : 0,
      tracks_stock: tracks,
      low_stock_at: parseAmount(lowAt),
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title={product ? "Edit product" : "Add product"} wide>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <Field label="Product name" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Azam Soda 500ml" />
        </Field>

        <Field label="Category">
          <div className="flex gap-2">
            <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
        </Field>
        <Field label="Or new category">
          <div className="flex gap-2">
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category…" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              disabled={!newCat.trim()}
              onClick={async () => {
                try {
                  const c = await onCreateCategory(newCat.trim());
                  setCategoryId(c.id);
                  setNewCat("");
                  toast("Category added", "success");
                } catch {
                  toast("Could not add category", "error");
                }
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </Field>

        <Field label={`Buying price (${currency})`}>
          <Input type="number" min={0} value={buy} onChange={(e) => setBuy(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
        <Field label={`Selling price (${currency})`} error={parseAmount(sell) > 0 && parseAmount(sell) < parseAmount(buy) ? "Selling below buying price!" : undefined}>
          <Input type="number" min={0} value={sell} onChange={(e) => setSell(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>

        <Field label="Barcode / code (optional)" className="sm:col-span-2">
          <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type…" />
        </Field>

        <Field label="Unit">
          <Select value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </Select>
        </Field>
        <Field label="Track stock?">
          <Select value={tracks ? "yes" : "no"} onChange={(e) => setTracks(e.target.value === "yes")}>
            <option value="yes">Yes — count stock down on every sale</option>
            <option value="no">No — service / unlimited item</option>
          </Select>
        </Field>

        {tracks && (
          <>
            <Field label={product ? "Current stock (use Adjust to change)" : "Opening stock"}>
              <Input type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" inputMode="decimal" disabled={Boolean(product)} />
            </Field>
            <Field label="Low stock alert at">
              <Input type="number" value={lowAt} onChange={(e) => setLowAt(e.target.value)} placeholder="5" inputMode="decimal" />
            </Field>
          </>
        )}

        <div className="flex gap-2 sm:col-span-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" loading={saving}>Save product</Button>
        </div>
      </form>
    </Dialog>
  );
}

function AdjustDialog({
  product,
  onClose,
  currency,
  onSubmit,
  saving,
}: {
  product: Product | null;
  onClose: () => void;
  currency: string;
  onSubmit: (delta: number, reason: string) => Promise<void>;
  saving: boolean;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("restock");

  const delta = mode === "in" ? parseAmount(qty) : -parseAmount(qty);

  return (
    <Dialog open={Boolean(product)} onClose={onClose} title={`Adjust stock — ${product?.name ?? ""}`}>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Current stock: <b>{product?.stock} {product?.unit}</b> · value {formatMoney((product?.stock ?? 0) * (product?.buying_price ?? 0), currency)}
        </p>
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "in", label: "Stock in" },
            { value: "out", label: "Stock out / damage" },
          ]}
          className="w-full"
        />
        <Field label="Quantity">
          <Input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>
        <Field label="Reason">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option value="restock">Restock from supplier</option>
            <option value="correction">Stock count correction</option>
            <option value="damage">Damage / expiry</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Button
          className="w-full"
          loading={saving}
          onClick={async () => {
            if (parseAmount(qty) <= 0) return toast("Enter a quantity", "error");
            await onSubmit(delta, reason);
            setQty("");
          }}
        >
          Apply {delta >= 0 ? "+" : ""}{delta || 0}
        </Button>
      </div>
    </Dialog>
  );
}

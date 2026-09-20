import { useMemo, useState } from "react";
import { Banknote, Minus, Plus, Printer, Search, ShoppingCart, Smartphone, Trash2, UserPlus, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/misc";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories, useProductMutations, useProducts } from "@/hooks/useProducts";
import { useCustomers, useCustomerMutations } from "@/hooks/useCustomers";
import { useCompleteSale } from "@/hooks/useSales";
import { formatMoney, parseAmount } from "@/lib/money";
import type { PaymentMethod, Product, SaleWithItems } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Receipt } from "@/features/pos/Receipt";

interface CartLine {
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
  tracks_stock: boolean;
  stock: number;
}

type PayTab = PaymentMethod;

export default function PosPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const { data: products = [], isLoading } = useProducts();
  const { data: categories = [] } = useCategories();
  const { data: customers = [] } = useCustomers();
  const { create: createCustomer } = useCustomerMutations();
  const completeSale = useCompleteSale();

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountInput, setDiscountInput] = useState("");
  const [payTab, setPayTab] = useState<PayTab>("cash");
  const [customerId, setCustomerId] = useState<string>("");
  const [mpesaRef, setMpesaRef] = useState("");
  const [cashPart, setCashPart] = useState("");
  const [mpesaPart, setMpesaPart] = useState("");
  const [received, setReceived] = useState("");
  const [note, setNote] = useState("");
  const [receiptSale, setReceiptSale] = useState<SaleWithItems | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");

  const currency = shop?.currency ?? "TZS";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryId && p.category_id !== categoryId) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q);
    });
  }, [products, search, categoryId]);

  const subtotal = cart.reduce((s, l) => s + l.unit_price * l.quantity, 0);
  const discount = Math.min(parseAmount(discountInput), subtotal);
  const total = Math.max(0, subtotal - discount);
  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const selectedCustomer = customers.find((c) => c.id === customerId) ?? null;

  function addToCart(p: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product_id === p.id);
      const inCart = existing?.quantity ?? 0;
      if (p.tracks_stock && inCart + 1 > p.stock) {
        toast(`Only ${p.stock} ${p.unit}(s) of ${p.name} in stock`, "error");
        return prev;
      }
      if (existing) {
        return prev.map((l) => (l.product_id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [
        ...prev,
        { product_id: p.id, name: p.name, unit_price: p.selling_price, quantity: 1, tracks_stock: p.tracks_stock, stock: p.stock },
      ];
    });
  }

  function setQty(productId: string | null, qty: number) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((l) => l.product_id !== productId)
        : prev.map((l) => {
            if (l.product_id !== productId) return l;
            const max = l.tracks_stock ? l.stock : Infinity;
            return { ...l, quantity: Math.min(qty, max) };
          })
    );
  }

  function onSearchEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    const q = search.trim().toLowerCase();
    if (!q) return;
    const exact = products.find((p) => (p.barcode ?? "").toLowerCase() === q);
    const match = exact ?? filtered[0];
    if (match) {
      addToCart(match);
      setSearch("");
    }
  }

  function resetSale() {
    setCart([]);
    setDiscountInput("");
    setPayTab("cash");
    setCustomerId("");
    setMpesaRef("");
    setCashPart("");
    setMpesaPart("");
    setReceived("");
    setNote("");
  }

  async function onComplete() {
    if (cart.length === 0) return toast("Cart is empty", "error");
    if (payTab === "credit" && !customerId) return toast("Pick a customer for credit sales", "error");
    if (payTab === "mpesa" && !mpesaRef.trim()) return toast("Enter the M-Pesa confirmation code", "error");
    if (payTab === "split") {
      const c = parseAmount(cashPart);
      const m = parseAmount(mpesaPart);
      if (Math.abs(c + m - total) > 0.01) return toast(`Cash + M-Pesa must equal ${formatMoney(total, currency)}`, "error");
    }

    try {
      const { sale, wasQueued } = await completeSale.mutateAsync({
        items: cart.map((l) => ({
          product_id: l.product_id,
          product_name: l.name,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tracks_stock: l.tracks_stock,
        })),
        discount,
        paymentMethod: payTab,
        cashAmount: payTab === "cash" ? (parseAmount(received) || total) : payTab === "split" ? parseAmount(cashPart) : 0,
        mpesaAmount: payTab === "mpesa" ? total : payTab === "split" ? parseAmount(mpesaPart) : 0,
        mpesaRef: payTab === "mpesa" || payTab === "split" ? mpesaRef.trim() || null : null,
        customerId: customerId || null,
        customerName: selectedCustomer?.name ?? null,
        note: note.trim() || null,
      });

      if (wasQueued) toast("No internet — sale saved and will sync automatically", "info");
      else toast(`Sale ${sale.invoice_number} completed`, "success");
      setReceiptSale(sale);
      setCartOpen(false);
      resetSale();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not complete sale", "error");
    }
  }

  const cartPanel = (
    <div className="flex h-full flex-col gap-3">
      <div className="max-h-[38vh] flex-1 space-y-2 overflow-y-auto scrollbar-thin lg:max-h-none">
        {cart.length === 0 && <EmptyState icon={<ShoppingCart className="h-5 w-5" />} title="Cart is empty" description="Tap products to add them" />}
        {cart.map((l) => (
          <div key={l.product_id ?? l.name} className="flex items-center gap-2 rounded-lg border bg-card p-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{l.name}</p>
              <p className="text-xs text-muted-foreground">{formatMoney(l.unit_price, currency)} each</p>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(l.product_id, l.quantity - 1)}>
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center text-sm font-extrabold">{l.quantity}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(l.product_id, l.quantity + 1)}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            <span className="w-20 text-right text-sm font-bold">{formatMoney(l.unit_price * l.quantity, currency)}</span>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => setQty(l.product_id, 0)}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border bg-card p-3">
        <div className="flex items-center gap-2">
          <Field label="Customer" className="flex-1">
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Walk-in customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.credit_balance > 0 ? ` (owes ${formatMoney(c.credit_balance, currency)})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="outline" size="icon" className="mt-5" title="Quick add customer" onClick={() => setQuickCustomer(true)}>
            <UserPlus className="h-4 w-4" />
          </Button>
        </div>

        <Field label="Discount">
          <Input type="number" min={0} value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} placeholder="0" inputMode="decimal" />
        </Field>

        <Segmented
          value={payTab}
          onChange={(v) => setPayTab(v)}
          options={[
            { value: "cash", label: "Cash" },
            { value: "mpesa", label: "M-Pesa" },
            { value: "split", label: "Split" },
            { value: "credit", label: "Credit" },
          ]}
          className="w-full"
        />

        {payTab === "cash" && (
          <Field label="Amount received (optional)">
            <Input type="number" value={received} onChange={(e) => setReceived(e.target.value)} placeholder={String(total)} inputMode="decimal" />
            {parseAmount(received) > total && (
              <p className="text-xs font-bold text-brand-700">Change: {formatMoney(parseAmount(received) - total, currency)}</p>
            )}
          </Field>
        )}

        {payTab === "mpesa" && (
          <Field label="M-Pesa confirmation code">
            <Input value={mpesaRef} onChange={(e) => setMpesaRef(e.target.value)} placeholder="e.g. QGH7XY2M9P" />
          </Field>
        )}

        {payTab === "split" && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="Cash part">
              <Input type="number" value={cashPart} onChange={(e) => setCashPart(e.target.value)} inputMode="decimal" placeholder="0" />
            </Field>
            <Field label="M-Pesa part">
              <Input type="number" value={mpesaPart} onChange={(e) => setMpesaPart(e.target.value)} inputMode="decimal" placeholder="0" />
            </Field>
            <p className="col-span-2 text-xs font-semibold text-muted-foreground">
              Balance: {formatMoney(Math.max(0, total - parseAmount(cashPart) - parseAmount(mpesaPart)), currency)}
            </p>
          </div>
        )}

        {payTab === "credit" && (
          <p className="rounded-lg bg-amberbrand-400/10 px-3 py-2 text-xs font-semibold text-amberbrand-600">
            {selectedCustomer
              ? `${selectedCustomer.name} will owe ${formatMoney((selectedCustomer.credit_balance ?? 0) + total, currency)} after this sale.`
              : "Choose a customer above — credit sales must be attached to someone."}
          </p>
        )}

        <Field label="Note (optional)">
          <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to remember about this sale…" className="min-h-[52px]" />
        </Field>

        <div className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatMoney(subtotal, currency)}</span></div>
          {discount > 0 && <div className="flex justify-between text-muted-foreground"><span>Discount</span><span>-{formatMoney(discount, currency)}</span></div>}
          <div className="flex justify-between text-lg font-extrabold"><span>Total</span><span>{formatMoney(total, currency)}</span></div>
        </div>

        <Button size="lg" className="w-full" loading={completeSale.isPending} onClick={() => void onComplete()}>
          Complete sale · {formatMoney(total, currency)}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">Sell</h1>
          <p className="text-xs text-muted-foreground">Tap a product to add it to the cart</p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
        {/* Products */}
        <div>
          <div className="sticky top-[60px] z-10 -mx-4 bg-background/95 px-4 pb-3 pt-1 backdrop-blur lg:static lg:mx-0 lg:px-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={onSearchEnter}
                placeholder="Search or scan barcode, then press Enter…"
                className="pl-9"
              />
            </div>
            <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
              <button
                onClick={() => setCategoryId(null)}
                className={cn(
                  "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                  categoryId === null ? "border-brand-600 bg-brand-600 text-white" : "bg-card text-muted-foreground hover:bg-secondary"
                )}
              >
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold transition-colors",
                    categoryId === c.id ? "border-brand-600 bg-brand-600 text-white" : "bg-card text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Printer className="h-5 w-5" />}
              title="No products yet"
              description="Add products in Stock to start selling."
            />
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => {
                const out = p.tracks_stock && p.stock <= 0;
                return (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    disabled={out}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-lg border bg-card p-3 text-left shadow-soft transition-all hover:border-brand-400 hover:shadow-pop active:scale-[0.98]",
                      out && "opacity-50"
                    )}
                  >
                    <span className="line-clamp-2 min-h-[32px] text-sm font-bold">{p.name}</span>
                    <span className="text-sm font-extrabold text-brand-700">{formatMoney(p.selling_price, currency)}</span>
                    <Badge variant={out ? "destructive" : p.tracks_stock && p.stock <= p.low_stock_at ? "warning" : "outline"}>
                      {p.tracks_stock ? (out ? "Out of stock" : `${p.stock} ${p.unit}`) : "Service"}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cart — desktop */}
        <Card className="sticky top-[76px] hidden max-h-[calc(100vh-100px)] overflow-y-auto scrollbar-thin lg:block">
          {cartPanel}
        </Card>
      </div>

      {/* Cart — mobile trigger */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-brand-600 px-5 py-3 text-sm font-extrabold text-white shadow-pop lg:hidden"
        >
          <ShoppingCart className="h-4 w-4" />
          {cartCount} item{cartCount > 1 ? "s" : ""} · {formatMoney(total, currency)}
        </button>
      )}

      <Dialog open={cartOpen} onClose={() => setCartOpen(false)} title="Cart" className="sm:max-w-lg">
        {cartPanel}
      </Dialog>

      <Receipt sale={receiptSale} shop={shop} open={Boolean(receiptSale)} onClose={() => setReceiptSale(null)} />

      {/* Quick add customer */}
      <Dialog open={quickCustomer} onClose={() => setQuickCustomer(false)} title="Quick add customer">
        <div className="flex flex-col gap-3">
          <Field label="Name">
            <Input value={newCustName} onChange={(e) => setNewCustName(e.target.value)} placeholder="Customer name" />
          </Field>
          <Field label="Phone (optional)">
            <Input value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} placeholder="07xx xxx xxx" inputMode="tel" />
          </Field>
          <Button
            loading={createCustomer.isPending}
            onClick={async () => {
              if (!newCustName.trim()) return toast("Enter a name", "error");
              try {
                const c = await createCustomer.mutateAsync({ name: newCustName.trim(), phone: newCustPhone.trim() || null, note: null });
                setCustomerId(c.id);
                setQuickCustomer(false);
                setNewCustName("");
                setNewCustPhone("");
                toast("Customer added", "success");
              } catch (err) {
                toast(err instanceof Error ? err.message : "Failed", "error");
              }
            }}
          >
            Save customer
          </Button>
        </div>
      </Dialog>

      {/* Payment method icons legend (visual only) */}
      <div className="mt-6 hidden items-center justify-center gap-6 text-[11px] text-muted-foreground lg:flex">
        <span className="flex items-center gap-1.5"><Banknote className="h-3.5 w-3.5" /> Cash</span>
        <span className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5" /> M-Pesa</span>
        <span className="flex items-center gap-1.5"><Wallet className="h-3.5 w-3.5" /> Credit book</span>
      </div>
    </div>
  );
}

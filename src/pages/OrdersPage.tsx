import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { ClipboardList, Play, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useProducts } from "@/hooks/useProducts";
import { useOrderActions, useOrders } from "@/hooks/modules";
import { formatMoney, parseAmount } from "@/lib/money";
import { uid } from "@/lib/utils";
import type { Order, OrderStatus } from "@/lib/types";

const STATUS_VARIANT: Record<OrderStatus, "warning" | "default" | "success" | "destructive"> = {
  pending: "warning",
  processing: "default",
  completed: "success",
  cancelled: "destructive",
};

/** Pending sale created from an order — picked up by the POS page. */
export interface PosPrefill {
  items: Array<{ product_id: string | null; product_name: string; quantity: number; unit_price: number; tracks_stock: boolean }>;
  customerId: string | null;
  customerName: string | null;
  orderId: string;
  orderNumber: string;
}

export function stashOrderPrefill(prefill: PosPrefill) {
  sessionStorage.setItem("sd_pos_prefill", JSON.stringify(prefill));
}

export default function OrdersPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const currency = shop?.currency ?? "TZS";
  const { data: orders = [], isLoading } = useOrders();
  const { update: updateOrder } = useOrderActions();
  const { data: products = [] } = useProducts();
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Array<{ key: string; product_id: string; name: string; qty: number; price: number }>>([]);
  const [productId, setProductId] = useState("");
  const [qty, setQty] = useState("");

  const active = orders.filter((o) => o.status === "pending" || o.status === "processing");
  const past = orders.filter((o) => o.status === "completed" || o.status === "cancelled");

  function addLine() {
    const p = products.find((x) => x.id === productId);
    if (!p) return toast("Pick a product", "error");
    if (parseAmount(qty) <= 0) return toast("Enter quantity", "error");
    setLines((prev) => [
      ...prev,
      { key: uid(), product_id: p.id, name: p.name, qty: parseAmount(qty), price: p.selling_price },
    ]);
    setProductId("");
    setQty("");
  }

  async function createOrder() {
    if (lines.length === 0) return toast("Add at least one item", "error");
    const total = lines.reduce((s, l) => s + l.qty * l.price, 0);
    try {
      const { data: order, error } = await supabase
        .from("orders")
        .insert({
          customer_id: null,
          customer_name: null,
          customer_phone: customerPhone.trim() || null,
          status: "pending",
          total,
          note: note.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("order_items").insert(
        lines.map((l) => ({
          order_id: order.id,
          product_id: l.product_id,
          product_name: l.name,
          quantity: l.qty,
          unit_price: l.price,
          line_total: l.qty * l.price,
        }))
      );
      if (itemsError) throw itemsError;

      toast("Order created", "success");
      setOpen(false);
      setLines([]);
      setCustomerPhone("");
      setNote("");
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  async function setStatus(order: Order, status: OrderStatus) {
    try {
      await updateOrder.mutateAsync({ id: order.id, status } as unknown as Record<string, unknown>);
      toast(`Order ${status}`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  function sellOrder(order: Order) {
    if (!order.order_items || order.order_items.length === 0) return;
    stashOrderPrefill({
      items: order.order_items.map((it) => ({
        product_id: it.product_id,
        product_name: it.product_name,
        quantity: it.quantity,
        unit_price: it.unit_price,
        tracks_stock: true,
      })),
      customerId: order.customer_id,
      customerName: order.customer_name,
      orderId: order.id,
      orderNumber: order.order_number,
    });
    navigate("/pos");
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Orders</h1>
          <p className="text-xs text-muted-foreground">{active.length} active · customer orders from calls, WhatsApp, walk-ins</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> New order
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : orders.length === 0 ? (
        <EmptyState icon={<ClipboardList className="h-5 w-5" />} title="No orders yet" description="Record customer orders, prepare them, then sell with one tap." />
      ) : (
        <div className="space-y-2">
          {[...active, ...past.slice(0, 20)].map((o) => (
            <div key={o.id} className="rounded-lg border bg-card p-3 shadow-soft">
              <div className="flex flex-wrap items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{o.order_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.customer_name ?? o.customer_phone ?? "No customer"} · {o.order_items?.length ?? 0} item(s) ·{" "}
                    {new Date(o.created_at).toLocaleDateString("en", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[o.status]}>{o.status}</Badge>
                <span className="text-sm font-extrabold">{formatMoney(o.total, currency)}</span>
              </div>
              {o.status !== "completed" && o.status !== "cancelled" && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {o.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => void setStatus(o, "processing")}>
                      <Play className="h-3.5 w-3.5" /> Start preparing
                    </Button>
                  )}
                  <Button size="sm" onClick={() => sellOrder(o)}>
                    Sell & complete
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void setStatus(o, "cancelled")}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title="New order" wide>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer phone (who ordered)"><Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="07xx xxx xxx" inputMode="tel" /></Field>
            <Field label="Note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. deliver at 5pm" /></Field>
          </div>
          <div className="grid grid-cols-[1fr_90px_auto] gap-2 rounded-lg border p-3">
            <Field label="Product">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Choose…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatMoney(p.selling_price, currency)}</option>)}
              </Select>
            </Field>
            <Field label="Qty"><Input type="number" value={qty} onChange={(e) => setQty(e.target.value)} inputMode="decimal" placeholder="0" /></Field>
            <div className="flex items-end"><Button type="button" variant="outline" size="icon" className="h-10 w-10" onClick={addLine}><Plus className="h-4 w-4" /></Button></div>
          </div>

          <div className="space-y-1.5">
            {lines.map((l) => (
              <div key={l.key} className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-semibold">{l.name}</span>
                <span className="text-xs text-muted-foreground">{l.qty} × {formatMoney(l.price, currency)}</span>
                <span className="w-24 text-right font-bold">{formatMoney(l.qty * l.price, currency)}</span>
                <button onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <p className="text-right text-lg font-extrabold">Total: {formatMoney(lines.reduce((s, l) => s + l.qty * l.price, 0), currency)}</p>
          <Button className="w-full" onClick={() => void createOrder()}>Create order</Button>
        </div>
      </Dialog>
    </div>
  );
}

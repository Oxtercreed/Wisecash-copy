import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLiveQuery } from "dexie-react-hooks";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { enqueueSale, outboxDb } from "@/lib/outbox";
import type { OutboxSale } from "@/lib/outbox";
import { syncManager } from "@/lib/syncManager";
import type { CompleteSaleArgs, SaleWithItems } from "@/lib/types";
import { uid } from "@/lib/utils";

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

export function useSales(days = 30) {
  const { shop } = useAuth();

  const query = useQuery({
    queryKey: ["sales", days],
    enabled: Boolean(shop),
    queryFn: async (): Promise<SaleWithItems[]> => {
      const { data, error } = await supabase
        .from("sales")
        .select("*, sale_items(*)")
        .gte("created_at", daysAgoISO(days))
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SaleWithItems[];
    },
  });

  // Offline/queued sales merged into the list so the UI stays truthful.
  const queued = useLiveQuery(() => outboxDb.outbox.toArray(), [], [] as OutboxSale[]);
  const queuedList: OutboxSale[] = Array.isArray(queued) ? queued : [];

  const merged: SaleWithItems[] | undefined = query.data
    ? [
        ...queuedList.map((q) => q.optimistic),
        ...query.data,
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    : undefined;

  return { ...query, data: merged, serverData: query.data, pendingCount: queuedList.length };
}

export interface PosSaleInput {
  items: CompleteSaleArgs["p_items"];
  discount: number;
  paymentMethod: CompleteSaleArgs["p_payment_method"];
  cashAmount: number | null;
  mpesaAmount: number | null;
  mpesaRef: string | null;
  customerId: string | null;
  customerName: string | null;
  note: string | null;
}

export function useCompleteSale() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PosSaleInput): Promise<{ sale: SaleWithItems; wasQueued: boolean }> => {
      const key = uid();
      const args: CompleteSaleArgs = {
        p_idempotency_key: key,
        p_customer_id: input.customerId,
        p_customer_name: input.customerName,
        p_payment_method: input.paymentMethod,
        p_items: input.items,
        p_discount: input.discount,
        p_tax: 0,
        p_cash_amount: input.cashAmount,
        p_mpesa_amount: input.mpesaAmount,
        p_mpesa_ref: input.mpesaRef,
        p_note: input.note,
      };

      const subtotal = input.items.reduce((sum, it) => sum + it.quantity * it.unit_price, 0);
      const total = Math.max(0, subtotal - input.discount);
      const now = new Date().toISOString();

      const optimistic: SaleWithItems = {
        id: key,
        shop_id: "local",
        cashier_id: null,
        customer_id: input.customerId,
        customer_name: input.customerName,
        invoice_number: `OFFLINE-${key.slice(0, 6).toUpperCase()}`,
        status: "completed",
        payment_method: input.paymentMethod,
        mpesa_ref: input.mpesaRef,
        subtotal,
        discount: input.discount,
        tax: 0,
        total,
        cash_amount: input.paymentMethod === "cash" ? total : input.cashAmount ?? 0,
        mpesa_amount: input.paymentMethod === "mpesa" ? total : input.mpesaAmount ?? 0,
        credit_amount: input.paymentMethod === "credit" ? total : 0,
        note: input.note,
        idempotency_key: key,
        created_at: now,
        sale_items: input.items.map((it, i) => ({
          id: `${key}-${i}`,
          sale_id: key,
          product_id: it.product_id,
          product_name: it.product_name,
          quantity: it.quantity,
          unit_price: it.unit_price,
          unit_cost: 0,
          line_total: it.quantity * it.unit_price,
        })),
      };

      const goOffline = async () => {
        await enqueueSale({ key, payload: args, status: "pending", retries: 0, createdAt: Date.now(), optimistic });
        return { sale: optimistic, wasQueued: true };
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) return goOffline();

      try {
        const { data, error } = await supabase.rpc("complete_sale", args);
        if (error) throw error;
        const sale = data as unknown as SaleWithItems;
        // Attach items for the receipt
        const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
        sale.sale_items = (items ?? []) as SaleWithItems["sale_items"];
        return { sale, wasQueued: false };
      } catch (err) {
        if (SyncHelper.isNetworkError(err)) return goOffline();
        throw err;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

/** Small wrapper so the mutation above can share SyncManager's heuristic. */
const SyncHelper = {
  isNetworkError(err: unknown): boolean {
    if (typeof navigator !== "undefined" && !navigator.onLine) return true;
    const msg = err instanceof Error ? err.message : String(err ?? "");
    const m = msg.toLowerCase();
    return (
      m.includes("fetch") || m.includes("network") || m.includes("timeout") ||
      m.includes("aborted") || m.includes("connection") || m.includes("gateway")
    );
  },
};

export function useVoidSale() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (saleId: string) => {
      const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId });
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sales"] });
      void queryClient.invalidateQueries({ queryKey: ["products"] });
      void queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
}

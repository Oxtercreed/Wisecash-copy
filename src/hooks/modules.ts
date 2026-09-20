import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useShopCrud, useShopRows, useRpc } from "./useShopData";
import type {
  Asset,
  Appointment,
  AppNotification,
  Order,
  OtherIncome,
  ProductionBatch,
  Purchase,
  RecycleBinItem,
  SalaryPayment,
  StaffMember,
  Supplier,
  Todo,
} from "@/lib/types";

/* ---------------- Suppliers ---------------- */
export function useSuppliers() {
  return useShopRows<Supplier>(["suppliers"], "suppliers", { column: "name", ascending: true });
}
export function useSupplierActions() {
  const crud = useShopCrud("suppliers", [["suppliers"]]);
  const payDebt = useRpc<{ p_supplier_id: string; p_amount: number; p_method: string; p_note: string | null }>(
    "record_supplier_payment",
    [["suppliers"]]
  );
  return { ...crud, payDebt };
}

/* ---------------- Purchases ---------------- */
export function usePurchases() {
  return useShopRows<Purchase>(
    ["purchases"],
    "purchases",
    { column: "created_at" },
    { select: "*, purchase_items(*)", limit: 200 }
  );
}
export function useRecordPurchase() {
  return useRpc<{
    p_supplier_id: string | null;
    p_reference: string | null;
    p_items: Array<{ product_id: string; product_name: string; quantity: number; unit_cost: number }>;
    p_paid: number;
    p_note: string | null;
  }>("record_purchase", [["purchases"], ["products"], ["suppliers"]]);
}

/* ---------------- Orders ---------------- */
export function useOrders() {
  return useShopRows<Order>(
    ["orders"],
    "orders",
    { column: "created_at" },
    { select: "*, order_items(*)", limit: 200 }
  );
}
export function useOrderActions() {
  return useShopCrud("orders", [["orders"]]);
}

/* ---------------- HRM ---------------- */
export function useStaff() {
  return useShopRows<StaffMember>(["staff"], "staff", { column: "full_name", ascending: true });
}
export function useStaffActions() {
  return useShopCrud("staff", [["staff"]]);
}
export function useAttendance(days = 30) {
  return useShopRows(
    ["attendance", days],
    "attendance",
    { column: "day" },
    { limit: 1000 }
  );
}
export function useAttendanceRpc() {
  const checkIn = useRpc<{ p_staff_id: string }>("staff_check_in", [["attendance"]]);
  const checkOut = useRpc<{ p_staff_id: string }>("staff_check_out", [["attendance"]]);
  return { checkIn, checkOut };
}
export function useSalaryPayments() {
  return useShopRows<SalaryPayment>(["salary_payments"], "salary_payments", { column: "created_at" });
}
export function useSalaryActions() {
  return useShopCrud("salary_payments", [["salary_payments"]]);
}

/* ---------------- Simple tables ---------------- */
export function useAssets() {
  return useShopRows<Asset>(["assets"], "assets", { column: "created_at" });
}
export function useAssetActions() {
  return useShopCrud("assets", [["assets"]]);
}

export function useTodos() {
  return useShopRows<Todo>(["todos"], "todos", { column: "created_at" });
}
export function useTodoActions() {
  return useShopCrud("todos", [["todos"]]);
}

export function useAppointments() {
  return useShopRows<Appointment>(["appointments"], "appointments", { column: "starts_at" });
}
export function useAppointmentActions() {
  return useShopCrud("appointments", [["appointments"]]);
}

export function useOtherIncome(days = 90) {
  return useShopRows<OtherIncome>(["other_income"], "other_income", { column: "earned_on" });
}
export function useOtherIncomeActions() {
  return useShopCrud("other_income", [["other_income"]]);
}

export function useNotifications() {
  return useShopRows<AppNotification>(["notifications"], "notifications", { column: "created_at" }, { limit: 50 });
}
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  const markAllRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
  return { markAllRead };
}

/* ---------------- Production ---------------- */
export function useProductionBatches() {
  return useShopRows<ProductionBatch>(["production"], "production_batches", { column: "created_at" }, { limit: 100 });
}
export function useCompleteProduction() {
  return useRpc<{
    p_output_product_id: string;
    p_output_qty: number;
    p_inputs: Array<{ product_id: string; quantity: number }>;
  }>("complete_production", [["production"], ["products"]]);
}

/* ---------------- Recycle bin ---------------- */
export function useRecycleBin() {
  return useShopRows<RecycleBinItem>(["recycle_bin"], "recycle_bin", { column: "deleted_at" });
}
export function useRecycleBinActions() {
  const softDelete = useRpc<{ p_entity: "products" | "customers" | "expenses"; p_entity_id: string }>(
    "soft_delete",
    [["products"], ["customers"], ["expenses"], ["recycle_bin"]]
  );
  const restore = useRpc<{ p_bin_id: string }>("restore_from_bin", [
    ["recycle_bin"],
    ["products"],
    ["customers"],
    ["expenses"],
  ]);
  const purge = useRpc<{ p_bin_id: string }>("purge_from_bin", [["recycle_bin"]]);
  return { softDelete, restore, purge };
}

/** Row types mirroring supabase/migrations/0001_core_schema.sql */

export type AppRole = "owner" | "manager" | "cashier";
export type PaymentMethod = "cash" | "mpesa" | "split" | "credit";
export type SaleStatus = "completed" | "voided";

export interface Profile {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
  disabled: boolean;
}

export interface ProfileWithShop extends Profile {
  shops: Shop | null;
}

export interface Shop {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  country: string;
  currency: string;
  tax_rate: number;
  receipt_footer: string;
  join_code: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  shop_id: string;
  name: string;
}

export interface Product {
  id: string;
  shop_id: string;
  category_id: string | null;
  name: string;
  barcode: string | null;
  unit: string;
  buying_price: number;
  selling_price: number;
  stock: number;
  tracks_stock: boolean;
  low_stock_at: number;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  note: string | null;
  credit_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Sale {
  id: string;
  shop_id: string;
  cashier_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  invoice_number: string;
  status: SaleStatus;
  payment_method: PaymentMethod;
  mpesa_ref: string | null;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  cash_amount: number;
  mpesa_amount: number;
  credit_amount: number;
  note: string | null;
  idempotency_key: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  unit_cost: number;
  line_total: number;
}

export interface SaleWithItems extends Sale {
  sale_items: SaleItem[];
}

export interface Expense {
  id: string;
  shop_id: string;
  title: string;
  category: string;
  amount: number;
  spent_on: string;
  created_at: string;
}

/** Payload sent to the complete_sale RPC */
export interface CompleteSaleArgs {
  p_idempotency_key: string;
  p_customer_id: string | null;
  p_customer_name: string | null;
  p_payment_method: PaymentMethod;
  p_items: Array<{
    product_id: string | null;
    product_name: string;
    quantity: number;
    unit_price: number;
    tracks_stock: boolean;
  }>;
  p_discount: number;
  p_tax: number;
  p_cash_amount: number | null;
  p_mpesa_amount: number | null;
  p_mpesa_ref: string | null;
  p_note: string | null;
}

/* ---------- Phase 2 module types ---------- */

export interface Supplier {
  id: string;
  shop_id: string;
  name: string;
  phone: string | null;
  note: string | null;
  pending_payment: number;
  created_at: string;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
}

export interface Purchase {
  id: string;
  shop_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  reference: string | null;
  total: number;
  paid: number;
  note: string | null;
  created_at: string;
  purchase_items?: PurchaseItem[];
}

export type OrderStatus = "pending" | "processing" | "completed" | "cancelled";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Order {
  id: string;
  shop_id: string;
  order_number: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  status: OrderStatus;
  total: number;
  note: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface StaffMember {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string | null;
  position: string;
  salary: number;
  hire_date: string;
  status: "active" | "inactive";
  created_at: string;
}

export interface Attendance {
  id: string;
  shop_id: string;
  staff_id: string;
  day: string;
  check_in: string | null;
  check_out: string | null;
  status: "present" | "absent" | "leave";
  notes: string | null;
}

export interface SalaryPayment {
  id: string;
  shop_id: string;
  staff_id: string;
  amount: number;
  month: string;
  note: string | null;
  created_at: string;
}

export interface Asset {
  id: string;
  shop_id: string;
  name: string;
  category: string;
  location: string | null;
  purchase_price: number;
  purchase_date: string | null;
  current_value: number;
  condition: string;
  notes: string | null;
  created_at: string;
}

export interface Todo {
  id: string;
  shop_id: string;
  title: string;
  due_date: string | null;
  completed: boolean;
  created_at: string;
}

export interface Appointment {
  id: string;
  shop_id: string;
  title: string;
  customer_name: string | null;
  customer_phone: string | null;
  starts_at: string;
  status: "scheduled" | "done" | "cancelled";
  notes: string | null;
  created_at: string;
}

export interface OtherIncome {
  id: string;
  shop_id: string;
  title: string;
  source: string;
  amount: number;
  earned_on: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  shop_id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface ProductionBatch {
  id: string;
  shop_id: string;
  output_product_id: string;
  output_qty: number;
  input_cost_total: number;
  inputs: Array<{ product_id: string; quantity: number }>;
  note: string | null;
  created_at: string;
}

export interface RecycleBinItem {
  id: string;
  shop_id: string;
  entity_type: "products" | "customers" | "expenses";
  entity_id: string;
  item_name: string;
  original_data: Record<string, unknown>;
  deleted_at: string;
  expires_at: string;
}

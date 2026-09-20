/** Row types mirroring supabase/migrations/0001_core_schema.sql */

export type AppRole = "owner" | "manager" | "cashier";
export type PaymentMethod = "cash" | "mpesa" | "split" | "credit";
export type SaleStatus = "completed" | "voided";

export interface Shop {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  country: string;
  currency: string;
  tax_rate: number;
  receipt_footer: string;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  shop_id: string;
  full_name: string;
  phone: string | null;
  role: AppRole;
}

export interface ProfileWithShop extends Profile {
  shops: Shop | null;
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

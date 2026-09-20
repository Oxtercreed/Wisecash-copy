import type { Expense, OtherIncome, SaleWithItems } from "./types";

/**
 * SmartDuka financial engine — the single source of truth for money math.
 *
 * Rules (kept intentionally strict):
 * 1. Revenue  = subtotal − discount. Tax collected is a liability, never income.
 * 2. COGS     = Σ (unit_cost_at_sale × qty). Costs are snapshotted per line at
 *               sale time, so reports stay correct even when prices change later.
 * 3. Profit   = Revenue − COGS − Expenses.
 * 4. Cash in  = cash + mpesa amounts (credit sales are receivables, not cash).
 */
export interface PnL {
  revenue: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  otherIncome: number;
  netProfit: number;
  margin: number; // net margin %
  cashIn: number;
  creditOut: number;
  saleCount: number;
}

function effectiveSales(sales: SaleWithItems[]) {
  return sales.filter((s) => s && s.status === "completed");
}

export function computePnl(sales: SaleWithItems[], expenses: Expense[], income: OtherIncome[] = []): PnL {
  const done = effectiveSales(sales);

  const revenue = done.reduce((sum, s) => sum + Math.max(0, Number(s.subtotal) - Number(s.discount || 0)), 0);

  const cogs = done.reduce(
    (sum, s) =>
      sum +
      (s.sale_items ?? []).reduce((is, it) => is + Number(it.unit_cost || 0) * Number(it.quantity || 0), 0),
    0
  );

  const expensesTotal = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const otherIncomeTotal = income.reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit + otherIncomeTotal - expensesTotal;

  const cashIn = done.reduce((sum, s) => sum + Number(s.cash_amount || 0) + Number(s.mpesa_amount || 0), 0);
  const creditOut = done.reduce((sum, s) => sum + Number(s.credit_amount || 0), 0);

  return {
    revenue,
    cogs,
    grossProfit,
    expenses: expensesTotal,
    otherIncome: otherIncomeTotal,
    netProfit,
    margin: revenue > 0 ? (netProfit / revenue) * 100 : 0,
    cashIn,
    creditOut,
    saleCount: done.length,
  };
}

export interface DaySeriesPoint {
  date: string; // yyyy-MM-dd
  label: string; // e.g. "Mon"
  revenue: number;
  profit: number;
  count: number;
}

/** Daily revenue/profit series for the last N days (inclusive of today). */
export function dailySeries(sales: SaleWithItems[], days = 7): DaySeriesPoint[] {
  const done = effectiveSales(sales);
  const points: DaySeriesPoint[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en", { weekday: "short" });

    const daySales = done.filter((s) => s.created_at.slice(0, 10) === key);
    const revenue = daySales.reduce((sum, s) => sum + Math.max(0, Number(s.subtotal) - Number(s.discount || 0)), 0);
    const cogs = daySales.reduce(
      (sum, s) =>
        sum +
        (s.sale_items ?? []).reduce((is, it) => is + Number(it.unit_cost || 0) * Number(it.quantity || 0), 0),
      0
    );

    points.push({ date: key, label, revenue, profit: revenue - cogs, count: daySales.length });
  }

  return points;
}

export interface PaymentMix {
  cash: number;
  mpesa: number;
  credit: number;
}

export function paymentMix(sales: SaleWithItems[]): PaymentMix {
  const done = effectiveSales(sales);
  return {
    cash: done.reduce((sum, s) => sum + Number(s.cash_amount || 0), 0),
    mpesa: done.reduce((sum, s) => sum + Number(s.mpesa_amount || 0), 0),
    credit: done.reduce((sum, s) => sum + Number(s.credit_amount || 0), 0),
  };
}

export interface TopProduct {
  name: string;
  qty: number;
  revenue: number;
}

export function topProducts(sales: SaleWithItems[], limit = 5): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const s of effectiveSales(sales)) {
    for (const it of s.sale_items ?? []) {
      const key = it.product_name;
      const cur = map.get(key) ?? { name: key, qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity || 0);
      cur.revenue += Number(it.line_total || 0);
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

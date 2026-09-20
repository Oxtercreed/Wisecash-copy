import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, Banknote, Package, Receipt, ShoppingBag, TrendingUp, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Skeleton, StatCard } from "@/components/ui/misc";
import { useAuth } from "@/contexts/AuthContext";
import { useExpenses } from "@/hooks/useExpenses";
import { useOtherIncome } from "@/hooks/modules";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import { computePnl, dailySeries, paymentMix, topProducts } from "@/lib/financials";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

export default function DashboardPage() {
  const { shop } = useAuth();
  const currency = shop?.currency ?? "TZS";
  const { data: sales, isLoading } = useSales(30);
  const { data: expenses = [] } = useExpenses(30);
  const { data: income = [] } = useOtherIncome();
  const { data: products = [] } = useProducts();

  const stats = useMemo(() => {
    if (!sales) return null;
    const today = new Date().toISOString().slice(0, 10);
    const todaySales = sales.filter((s) => s.created_at.slice(0, 10) === today);
    const todayExpenses = expenses.filter((e) => e.spent_on === today);
    const todayIncome = income.filter((e) => e.earned_on === today);
    return {
      today: computePnl(todaySales, todayExpenses, todayIncome),
      month: computePnl(sales, expenses, income),
      series: dailySeries(sales, 7),
      mix: paymentMix(sales),
      top: topProducts(sales, 5),
      lowStock: products
        .filter((p) => p.tracks_stock && p.stock <= p.low_stock_at)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
      recent: sales.slice(0, 6),
    };
  }, [sales, expenses, income, products]);

  if (isLoading || !stats) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const mixTotal = stats.mix.cash + stats.mix.mpesa + stats.mix.credit;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-extrabold">Today at a glance</h1>
        <p className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales today" value={formatMoneyCompact(stats.today.revenue, currency)} sub={`${stats.today.saleCount} sale(s)`} icon={<ShoppingBag className="h-4 w-4" />} tone="positive" />
        <StatCard label="Cash + M-Pesa in" value={formatMoneyCompact(stats.today.cashIn, currency)} sub="excludes credit sales" icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Net profit today" value={formatMoneyCompact(stats.today.netProfit, currency)} sub={`Margin ${stats.today.margin.toFixed(0)}%`} icon={<TrendingUp className="h-4 w-4" />} tone={stats.today.netProfit >= 0 ? "positive" : "negative"} />
        <StatCard label="Credit given today" value={formatMoneyCompact(stats.today.creditOut, currency)} sub="to collect later" icon={<ArrowDownRight className="h-4 w-4" />} tone="accent" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Last 7 days revenue</CardTitle>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.series} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                <defs>
                  <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#15764f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#15764f" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(150 14% 90%)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => formatMoneyCompact(v, currency).replace(/^(Sh|[A-Z]{3}) /, "")} />
                <Tooltip
                  formatter={(value: number | string) => formatMoney(Number(value), currency)}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(150 14% 88%)", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#15764f" strokeWidth={2.5} fill="url(#rev)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Payment mix */}
        <Card>
          <CardHeader><CardTitle>Payments (30 days)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mixTotal === 0 && <p className="text-xs text-muted-foreground">No payments yet.</p>}
            {mixTotal > 0 && (
              <>
                {[
                  { label: "Cash", value: stats.mix.cash, color: "bg-brand-600" },
                  { label: "M-Pesa", value: stats.mix.mpesa, color: "bg-amberbrand-500" },
                  { label: "Credit", value: stats.mix.credit, color: "bg-destructive" },
                ].map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex justify-between text-xs font-semibold">
                      <span>{row.label}</span>
                      <span>{formatMoneyCompact(row.value, currency)} · {Math.round((row.value / mixTotal) * 100)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div className={`h-full rounded-full ${row.color}`} style={{ width: `${(row.value / mixTotal) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Low stock */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Low stock</CardTitle>
            <Link to="/inventory"><Button variant="ghost" size="sm">Manage →</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.lowStock.length === 0 && <p className="text-xs text-muted-foreground">Everything is well stocked 🎉</p>}
            {stats.lowStock.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="truncate text-sm font-semibold">{p.name}</span>
                <Badge variant={p.stock <= 0 ? "destructive" : "warning"}>
                  {p.stock <= 0 ? "Out" : `${p.stock} left`}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Recent sales */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Recent sales</CardTitle>
            <Link to="/sales"><Button variant="ghost" size="sm">All sales →</Button></Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.recent.length === 0 && (
              <EmptyState icon={<Receipt className="h-5 w-5" />} title="No sales yet" description="Your first sale will show up here." />
            )}
            {stats.recent.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{s.invoice_number}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {s.customer_name ?? "Walk-in"} · {new Date(s.created_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-extrabold">{formatMoney(s.total, currency)}</p>
                  {s.status === "voided" ? <Badge variant="destructive">voided</Badge> : <Badge variant="secondary" className="capitalize">{s.payment_method}</Badge>}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Top products */}
      <Card>
        <CardHeader><CardTitle>Best sellers (30 days)</CardTitle></CardHeader>
        <CardContent>
          {stats.top.length === 0 && <p className="text-xs text-muted-foreground">No sales data yet.</p>}
          <div className="space-y-2">
            {stats.top.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.qty} sold</span>
                <span className="w-24 text-right text-sm font-bold">{formatMoney(t.revenue, currency)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Month summary */}
      <Card>
        <CardHeader><CardTitle>This month · profit & loss</CardTitle></CardHeader>
        <CardContent className="space-y-1.5 text-sm">
          <Row label="Revenue" value={formatMoney(stats.month.revenue, currency)} />
          <Row label="Cost of goods sold" value={`-${formatMoney(stats.month.cogs, currency)}`} muted />
          <Row label="Gross profit" value={formatMoney(stats.month.grossProfit, currency)} bold />
          {stats.month.otherIncome > 0 && <Row label="Other income" value={`+${formatMoney(stats.month.otherIncome, currency)}`} muted />}
          <Row label="Expenses" value={`-${formatMoney(stats.month.expenses, currency)}`} muted />
          <div className="border-t pt-1.5">
            <Row label="Net profit" value={formatMoney(stats.month.netProfit, currency)} bold />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <Package className="h-4 w-4 shrink-0" />
        Costs are snapshotted at each sale, so your profit stays accurate even when supplier prices change.
        <Link to="/expenses" className="ml-auto shrink-0 font-bold text-brand-700 hover:underline">Record expenses <Wallet className="inline h-3 w-3" /></Link>
      </div>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-muted-foreground" : ""}>{label}</span>
      <span className={bold ? "font-extrabold" : muted ? "text-muted-foreground" : "font-semibold"}>{value}</span>
    </div>
  );
}

import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowDownRight, ArrowRight, Banknote, Package, PackagePlus, Receipt,
  ShoppingCart, TrendingUp, Users, Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Skeleton, StatCard } from "@/components/ui/misc";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useExpenses } from "@/hooks/useExpenses";
import { useProducts } from "@/hooks/useProducts";
import { useSales } from "@/hooks/useSales";
import { useOtherIncome } from "@/hooks/modules";
import { computePnl, dailySeries, paymentMix, topProducts } from "@/lib/financials";
import { formatMoney, formatMoneyCompact } from "@/lib/money";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { shop, profile } = useAuth();
  const { theme } = useTheme();
  const currency = shop?.currency ?? "TZS";
  const { data: sales, isLoading } = useSales(30);
  const { data: expenses = [] } = useExpenses(30);
  const { data: income = [] } = useOtherIncome();
  const { data: products = [] } = useProducts();

  const stats = useMemo(() => {
    if (!sales) return null;
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const todaySales = sales.filter((s) => s.created_at.slice(0, 10) === today);
    const yesterdaySales = sales.filter((s) => s.created_at.slice(0, 10) === yesterday);
    const todayPnl = computePnl(
      todaySales,
      expenses.filter((e) => e.spent_on === today),
      income.filter((i) => i.earned_on === today)
    );
    const yPnl = computePnl(yesterdaySales, [], []);
    const delta = yPnl.revenue > 0 ? ((todayPnl.revenue - yPnl.revenue) / yPnl.revenue) * 100 : null;
    return {
      today: todayPnl,
      month: computePnl(sales, expenses, income),
      series: dailySeries(sales, 7),
      mix: paymentMix(sales),
      top: topProducts(sales, 5),
      lowStock: products
        .filter((p) => p.tracks_stock && p.stock <= p.low_stock_at)
        .sort((a, b) => a.stock - b.stock)
        .slice(0, 6),
      recent: sales.slice(0, 6),
      delta,
    };
  }, [sales, expenses, income, products]);

  const gridColor = theme === "dark" ? "#233b32" : "#e5ece7";
  const tickColor = theme === "dark" ? "#8ba79a" : "#5f7a6e";

  const quickActions = [
    { to: "/pos", icon: ShoppingCart, label: "New sale", primary: true },
    { to: "/inventory", icon: PackagePlus, label: "Add product" },
    { to: "/expenses", icon: Wallet, label: "Money" },
    { to: "/customers", icon: Users, label: "Debtors" },
  ];

  if (isLoading || !stats) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-3 lg:grid-cols-3">
          <Skeleton className="h-44 lg:col-span-1" />
          <Skeleton className="h-44 lg:col-span-2" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const mixTotal = stats.mix.cash + stats.mix.mpesa + stats.mix.credit;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {/* Greeting + quick actions */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">
            {greeting()}{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })} · {shop?.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((a) => (
            <Link key={a.to} to={a.to}>
              <Button size="sm" variant={a.primary ? "default" : "outline"}>
                <a.icon className="h-3.5 w-3.5" /> {a.label}
              </Button>
            </Link>
          ))}
        </div>
      </div>

      {/* Hero + chart */}
      <div className="grid gap-3 lg:grid-cols-[380px_1fr]">
        {/* Gradient hero card */}
        <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-5 text-white shadow-pop">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-xl" />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-white/70">Sales today</p>
              {stats.delta !== null && (
                <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-extrabold">
                  {stats.delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {stats.delta >= 0 ? "+" : ""}{stats.delta.toFixed(0)}% vs yesterday
                </span>
              )}
            </div>
            <p className="mt-1 text-4xl font-extrabold tracking-tight">
              {formatMoney(stats.today.revenue, currency)}
            </p>
            <p className="mt-0.5 text-xs text-white/60">{stats.today.saleCount} sale(s) · profit {formatMoney(stats.today.netProfit, currency)}</p>

            {/* mini sparkline */}
            <div className="mt-3 h-14">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={stats.series} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="revenue" stroke="#ffffff" strokeWidth={2} fill="url(#spark)" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold">
              <span className="rounded-full bg-white/15 px-2 py-1">Cash in {formatMoneyCompact(stats.today.cashIn, currency)}</span>
              <span className="rounded-full bg-white/15 px-2 py-1">Credit {formatMoneyCompact(stats.today.creditOut, currency)}</span>
              <span className="rounded-full bg-white/15 px-2 py-1">Margin {stats.today.margin.toFixed(0)}%</span>
            </div>
          </div>
        </div>

        {/* 7-day chart */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Last 7 days</CardTitle>
            <div className="flex items-center gap-3 text-[10px] font-bold text-muted-foreground">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand-600" /> Revenue</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amberbrand-500" /> Profit</span>
            </div>
          </CardHeader>
          <CardContent className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.series} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="rev2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1f9c70" stopOpacity={0.32} />
                    <stop offset="100%" stopColor="#1f9c70" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: tickColor }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 10, fill: tickColor }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => formatMoneyCompact(v, currency).replace(/^(Sh|[A-Z]{3}) /, "")}
                />
                <Tooltip
                  formatter={(value: number | string, name: string) => [formatMoney(Number(value), currency), name === "revenue" ? "Revenue" : "Profit"]}
                  contentStyle={{
                    borderRadius: 12,
                    border: `1px solid ${gridColor}`,
                    background: theme === "dark" ? "#101c16" : "#ffffff",
                    color: theme === "dark" ? "#e6efe9" : "#0f231a",
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#1f9c70" strokeWidth={2.5} fill="url(#rev2)" />
                <Line type="monotone" dataKey="profit" stroke="#f59e0b" strokeWidth={2.5} dot={{ r: 2.5, fill: "#f59e0b" }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Cash + M-Pesa in" value={formatMoneyCompact(stats.today.cashIn, currency)} sub="excludes credit" icon={<Banknote className="h-4 w-4" />} />
        <StatCard label="Net profit today" value={formatMoneyCompact(stats.today.netProfit, currency)} sub={`Margin ${stats.today.margin.toFixed(0)}%`} icon={<TrendingUp className="h-4 w-4" />} tone={stats.today.netProfit >= 0 ? "positive" : "negative"} />
        <StatCard label="Credit given today" value={formatMoneyCompact(stats.today.creditOut, currency)} sub="to collect later" icon={<ArrowDownRight className="h-4 w-4" />} tone="accent" />
        <StatCard label="Net profit · 30 days" value={formatMoneyCompact(stats.month.netProfit, currency)} sub={`Margin ${stats.month.margin.toFixed(0)}%`} icon={<TrendingUp className="h-4 w-4" />} tone={stats.month.netProfit >= 0 ? "positive" : "negative"} />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Low stock */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Low stock</CardTitle>
            <Link to="/inventory"><Button variant="ghost" size="sm">Manage <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
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
            <Link to="/sales"><Button variant="ghost" size="sm">All sales <ArrowRight className="h-3.5 w-3.5" /></Button></Link>
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

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Top products + payment mix */}
        <Card>
          <CardHeader><CardTitle>Best sellers (30 days)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.top.length === 0 && <p className="text-xs text-muted-foreground">No sales data yet.</p>}
            {stats.top.map((t, i) => (
              <div key={t.name} className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">{t.qty} sold</span>
                <span className="w-24 text-right text-sm font-bold">{formatMoney(t.revenue, currency)}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Payments (30 days)</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {mixTotal === 0 && <p className="text-xs text-muted-foreground">No payments yet.</p>}
            {mixTotal > 0 &&
              [
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
          </CardContent>
        </Card>
      </div>

      {/* P&L strip */}
      <Card className="bg-gradient-to-r from-card to-secondary/60">
        <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-5">
          {[
            ["Revenue", formatMoney(stats.month.revenue, currency)],
            ["COGS", `-${formatMoneyCompact(stats.month.cogs, currency)}`],
            ["Gross profit", formatMoney(stats.month.grossProfit, currency)],
            ["Expenses", `-${formatMoneyCompact(stats.month.expenses, currency)}`],
          ].map(([k, v]) => (
            <div key={k}>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{k}</p>
              <p className="text-sm font-extrabold">{v}</p>
            </div>
          ))}
          <div className="border-t pt-2 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Net · 30 days</p>
            <p className={`text-sm font-extrabold ${stats.month.netProfit >= 0 ? "text-brand-600" : "text-destructive"}`}>
              {formatMoney(stats.month.netProfit, currency)}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
        <Package className="h-4 w-4 shrink-0" />
        Costs are snapshotted at each sale, so your profit stays accurate even when supplier prices change.
        <Link to="/reports" className="ml-auto shrink-0 font-bold text-brand-600 hover:underline">Open reports <ArrowRight className="inline h-3 w-3" /></Link>
      </div>
    </div>
  );
}

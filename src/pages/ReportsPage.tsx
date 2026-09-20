import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/misc";
import { useAuth } from "@/contexts/AuthContext";
import { useExpenses } from "@/hooks/useExpenses";
import { useSales } from "@/hooks/useSales";
import { computePnl, dailySeries, topProducts } from "@/lib/financials";
import { formatMoney } from "@/lib/money";

export default function ReportsPage() {
  const { shop } = useAuth();
  const currency = shop?.currency ?? "TZS";
  const { data: sales = [] } = useSales(90);
  const { data: expenses = [] } = useExpenses(90);

  const pnl = useMemo(() => computePnl(sales, expenses), [sales, expenses]);
  const series = useMemo(() => dailySeries(sales, 14), [sales]);
  const best = useMemo(() => topProducts(sales, 10), [sales]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Reports</h1>
        <p className="text-xs text-muted-foreground">Profit & loss — last 90 days</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatMoney(pnl.revenue, currency)} sub={`${pnl.saleCount} sales`} />
        <StatCard label="COGS" value={formatMoney(pnl.cogs, currency)} sub="cost of goods sold" tone="accent" />
        <StatCard label="Gross profit" value={formatMoney(pnl.grossProfit, currency)} />
        <StatCard
          label="Net profit"
          value={formatMoney(pnl.netProfit, currency)}
          sub={`margin ${pnl.margin.toFixed(1)}%`}
          tone={pnl.netProfit >= 0 ? "positive" : "negative"}
        />
      </div>

      <Card>
        <CardHeader><CardTitle>Daily revenue & profit (14 days)</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {series.map((d) => {
              const max = Math.max(...series.map((x) => x.revenue), 1);
              return (
                <div key={d.date} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 font-semibold text-muted-foreground">{d.label}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-md bg-secondary">
                    <div
                      className="flex h-full items-center justify-end rounded-md bg-brand-500/80 pr-2 text-[10px] font-bold text-white"
                      style={{ width: `${Math.max(2, (d.revenue / max) * 100)}%` }}
                    >
                      {d.revenue > 0 ? formatMoney(d.revenue, currency) : ""}
                    </div>
                  </div>
                  <span className="w-20 shrink-0 text-right font-semibold text-brand-700">
                    {d.revenue > 0 ? `+${formatMoney(d.profit, currency)}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Product profitability (90 days)</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {best.length === 0 && <p className="text-xs text-muted-foreground">No sales yet.</p>}
          {best.map((t) => (
            <div key={t.name} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate font-semibold">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.qty} sold</span>
              <span className="font-bold">{formatMoney(t.revenue, currency)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <BarChart3 className="h-3.5 w-3.5" /> COGS uses each item's cost at sale time — true historical profit.
      </p>
    </div>
  );
}

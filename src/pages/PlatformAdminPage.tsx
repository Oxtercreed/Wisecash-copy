import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BadgeCheck, Crown, RefreshCw, ShieldCheck, Store, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { usePlatformAdmin } from "@/hooks/useSubscription";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { SUBSCRIPTION_PRICE_TZS } from "@/lib/subscription";

interface ShopRow {
  id: string;
  name: string;
  created_at: string;
  shop_subscriptions: Array<{
    state: string;
    days_left: number;
    period_end: string | null;
    trial_end: string | null;
    monthly_price: number;
  }>;
}

interface PaymentRow {
  id: string;
  shop_id: string;
  channel: string;
  phone: string;
  amount: number;
  months: number;
  reference: string | null;
  status: string;
  created_at: string;
  shops: { name: string } | null;
}

export default function PlatformAdminPage() {
  const { toast } = useToast();
  const { isPlatform, claim, isLoading: claimLoading } = usePlatformAdmin();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"shops" | "payments">("payments");

  // Claim flow for first-run
  const { data: anyAdmin } = useQuery({
    queryKey: ["any_platform_admin"],
    enabled: !isPlatform,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase.from("platform_admins").select("user_id").limit(1);
      if (error) return false;
      return (data ?? []).length > 0;
    },
  });

  const { data: shops = [] } = useQuery({
    queryKey: ["platform_shops"],
    enabled: isPlatform,
    queryFn: async (): Promise<ShopRow[]> => {
      const { data, error } = await supabase
        .from("shops")
        .select("id, name, created_at, shop_subscriptions(state, days_left, period_end, trial_end, monthly_price)")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return (data ?? []) as ShopRow[];
    },
    refetchInterval: 60_000,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["platform_payments"],
    enabled: isPlatform,
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*, shops(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as PaymentRow[];
    },
    refetchInterval: 30_000,
  });

  const review = useMutation({
    mutationFn: async ({ id, approve, note }: { id: string; approve: boolean; note?: string }) => {
      const { error } = await supabase.rpc(
        approve ? "approve_subscription_payment" : "reject_subscription_payment",
        approve ? { p_payment_id: id } : { p_payment_id: id, p_note: note ?? null }
      );
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast(vars.approve ? "Approved — shop is active 🎉" : "Rejected", "success");
      void queryClient.invalidateQueries({ queryKey: ["platform_payments"] });
      void queryClient.invalidateQueries({ queryKey: ["platform_shops"] });
    },
    onError: (err) => toast(err instanceof Error ? err.message : "Failed", "error"),
  });

  const stats = useMemo(() => {
    const state = (s: ShopRow) => s.shop_subscriptions?.[0] ?? null;
    const active = shops.filter((s) => state(s)?.state === "active");
    const trialing = shops.filter((s) => ["trialing", "grace"].includes(state(s)?.state ?? ""));
    const mrr = active.reduce((sum, s) => sum + Number(state(s)?.monthly_price ?? 0), 0);
    const revenue = payments.filter((p) => p.status === "approved").reduce((sum, p) => sum + p.amount, 0);
    return { total: shops.length, activeCount: active.length, trialingCount: trialing.length, mrr, revenue };
  }, [shops, payments]);

  const pending = payments.filter((p) => p.status === "pending");

  if (!isPlatform) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="rounded-lg border bg-card p-6 text-center shadow-soft">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <Crown className="h-6 w-6" />
          </span>
          <h1 className="text-lg font-extrabold">Platform admin</h1>
          {claimLoading ? (
            <p className="mt-2 text-sm text-muted-foreground">Checking…</p>
          ) : anyAdmin ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This platform already has an owner. If that's you, sign in with that account.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                This SmartDuka platform has no admin yet. The <b>first person to claim</b> becomes the
                platform owner — you'll review subscription payments and see all shops.
              </p>
              <Button
                className="mt-4"
                loading={claim.isPending}
                onClick={async () => {
                  try {
                    const ok = await claim.mutateAsync();
                    toast(ok ? "You are now the platform admin 👑" : "Someone claimed it first", ok ? "success" : "error");
                  } catch (err) {
                    toast(err instanceof Error ? err.message : "Failed", "error");
                  }
                }}
              >
                <ShieldCheck className="h-4 w-4" /> Claim platform ownership
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-extrabold">
            <Crown className="h-5 w-5 text-amberbrand-500" /> Platform admin
          </h1>
          <p className="text-xs text-muted-foreground">Your whole business at a glance</p>
        </div>
        <Badge variant="warning"><BadgeCheck className="mr-1 inline h-3 w-3" /> platform owner</Badge>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Shops" value={String(stats.total)} icon={<Store className="h-4 w-4" />} />
        <StatCard label="Active" value={String(stats.activeCount)} sub={`${stats.trialingCount} on trial`} icon={<BadgeCheck className="h-4 w-4" />} tone="positive" />
        <StatCard label="MRR" value={formatMoneyCompact(stats.mrr)} sub="monthly recurring" icon={<RefreshCw className="h-4 w-4" />} tone="accent" />
        <StatCard label="Revenue approved" value={formatMoneyCompact(stats.revenue)} sub="all time" />
      </div>

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: "payments", label: `Payments${pending.length ? ` (${pending.length})` : ""}` },
          { value: "shops", label: "Shops" },
        ]}
        className="w-full sm:w-auto"
      />

      {tab === "payments" && (
        <div className="space-y-2">
          {pending.length === 0 && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No payment requests waiting. 🎉</CardContent></Card>
          )}
          {pending.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex flex-wrap items-center gap-3 pt-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-extrabold">{formatMoney(p.amount, "TZS")} · {p.months} month(s)</p>
                  <p className="text-xs text-muted-foreground">
                    {p.shops?.name ?? "Shop"} · {p.channel} from {p.phone}
                    {p.reference ? ` · ref ${p.reference}` : ""} · {new Date(p.created_at).toLocaleString("en", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <Button size="sm" loading={review.isPending && review.variables?.id === p.id} onClick={() => void review.mutateAsync({ id: p.id, approve: true })}>
                  <BadgeCheck className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                  const note = window.prompt("Reason for rejecting (optional):") ?? undefined;
                  void review.mutateAsync({ id: p.id, approve: false, note });
                }}>
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </CardContent>
            </Card>
          ))}

          {payments.filter((p) => p.status !== "pending").slice(0, 15).map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-lg border bg-card/60 px-3 py-2 text-sm opacity-70">
              <span className="font-semibold">{formatMoney(p.amount, "TZS")}</span>
              <span className="text-xs text-muted-foreground">{p.shops?.name} · {new Date(p.created_at).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
              <div className="ml-auto">
                <Badge variant={p.status === "approved" ? "success" : "destructive"}>{p.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "shops" && (
        <div className="space-y-2">
          {shops.map((s) => {
            const sub = s.shop_subscriptions?.[0];
            const state = sub?.state ?? "trialing";
            return (
              <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 shadow-soft">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    joined {new Date(s.created_at).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" })}
                    {sub?.period_end ? ` · paid until ${new Date(sub.period_end).toLocaleDateString("en", { day: "numeric", month: "short" })}` : ""}
                    {sub?.trial_end && state !== "active" ? ` · trial ends ${new Date(sub.trial_end).toLocaleDateString("en", { day: "numeric", month: "short" })}` : ""}
                  </p>
                </div>
                <Badge variant={state === "active" ? "success" : state === "expired" ? "destructive" : state === "grace" ? "warning" : "default"}>
                  {state}
                </Badge>
                <span className="text-xs font-bold text-muted-foreground">{formatMoney(sub?.monthly_price ?? SUBSCRIPTION_PRICE_TZS, "TZS")}/mo</span>
              </div>
            );
          })}
        </div>
      )}

      <p className="pb-4 text-center text-xs text-muted-foreground">
        Tip: verifying money actually arrived in your mobile-money wallet before approving is your responsibility.
      </p>
    </div>
  );
}

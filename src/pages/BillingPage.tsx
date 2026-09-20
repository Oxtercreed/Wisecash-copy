import { useState } from "react";
import { ArrowLeft, BadgeCheck, Clock, PartyPopper, Send, Smartphone } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useMyPayments, useSubmitPayment, useSubscription } from "@/hooks/useSubscription";
import { PAYMENT_CHANNELS, PLANS, type Plan } from "@/lib/subscription";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATE_STYLES: Record<string, { label: string; variant: "success" | "default" | "warning" | "destructive"; icon: typeof Clock }> = {
  active: { label: "Active", variant: "success", icon: BadgeCheck },
  trialing: { label: "Free trial", variant: "default", icon: Clock },
  grace: { label: "Payment due", variant: "warning", icon: Clock },
  expired: { label: "Expired", variant: "destructive", icon: Clock },
};

export default function BillingPage() {
  const { shop } = useAuth();
  const { toast } = useToast();
  const { data: sub, isLoading } = useSubscription();
  const { data: myPayments = [] } = useMyPayments();
  const submitPayment = useSubmitPayment();

  const currency = sub?.currency ?? shop?.currency ?? "TZS";
  const [months, setMonths] = useState<number>(1);
  const [channel, setChannel] = useState<string>("Mpesa");
  const [phone, setPhone] = useState("");
  const [reference, setReference] = useState("");

  const plan: Plan = PLANS.find((p) => p.months === months) ?? PLANS[0];
  const stateInfo = sub ? STATE_STYLES[sub.state] : null;
  const StateIcon = stateInfo?.icon ?? Clock;
  const expired = sub?.state === "expired";

  const selectedChannel = PAYMENT_CHANNELS.find((c) => c.value === channel);

  async function submit() {
    if (!phone.trim() || phone.replace(/\D/g, "").length < 9) return toast("Enter the phone number you paid from", "error");
    try {
      await submitPayment.mutateAsync({
        channel,
        phone: phone.trim(),
        amount: plan.price,
        months: plan.months,
        reference: reference.trim() || null,
      });
      toast("Request sent! It will be reviewed shortly.", "success");
      setReference("");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "error");
    }
  }

  if (isLoading || !sub) {
    return <div className="mx-auto max-w-3xl p-4"><div className="h-48 animate-pulse rounded-lg bg-muted" /></div>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {expired && (
        <Link to="/dashboard" className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Link>
      )}

      {/* Status */}
      <Card className={cn(expired && "border-destructive/40")}>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <span className={cn(
            "rounded-lg p-2.5",
            sub.state === "active" && "bg-brand-100 text-brand-700",
            sub.state === "trialing" && "bg-secondary text-secondary-foreground",
            sub.state === "grace" && "bg-amberbrand-400/20 text-amberbrand-600",
            expired && "bg-destructive/10 text-destructive"
          )}>
            <StateIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-extrabold">Billing</h1>
              {stateInfo && <Badge variant={stateInfo.variant}>{stateInfo.label}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {sub.state === "active" && `Plan active until ${sub.period_end ? new Date(sub.period_end).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" }) : "—"}`}
              {sub.state === "trialing" && `${Math.max(0, sub.days_left)} day(s) of your free trial left`}
              {sub.state === "grace" && `Grace period — subscribe within ${Math.max(0, sub.days_left)} day(s) to keep working`}
              {expired && "Your subscription expired. Subscribe below to get back to selling."}
            </p>
          </div>
          <span className="text-sm font-bold text-muted-foreground">{formatMoney(sub.monthly_price, currency)}/mo</span>
        </CardContent>
      </Card>

      {/* Plans */}
      <Card>
        <CardHeader><CardTitle>Choose a plan</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {PLANS.map((p) => (
              <button
                key={p.months}
                onClick={() => setMonths(p.months)}
                className={cn(
                  "flex flex-col items-center gap-0.5 rounded-lg border p-3 text-center transition-all",
                  months === p.months ? "border-brand-600 bg-brand-50 shadow-soft" : "hover:bg-secondary"
                )}
              >
                <span className="text-sm font-extrabold">{p.label}</span>
                <span className="text-sm font-bold text-brand-700">{formatMoney(p.price, currency)}</span>
                {p.note && <span className="text-[10px] font-bold text-amberbrand-600">{p.note}</span>}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How to pay + submit */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand-600" /> 1. Send the money</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {PAYMENT_CHANNELS.map((c) => (
              <div key={c.value} className="flex items-center justify-between rounded-lg border px-3 py-2">
                <span className="font-semibold">{c.label}</span>
                <span className="text-right text-xs text-muted-foreground">
                  <b className="text-foreground">{c.number}</b>
                  <br />{c.name}
                </span>
              </div>
            ))}
            <p className="pt-1 text-xs text-muted-foreground">Send <b>{formatMoney(plan.price, currency)}</b> for the <b>{plan.label}</b> plan, then submit the form.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-4 w-4 text-brand-600" /> 2. Confirm your payment</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Field label="Plan">
              <Select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                {PLANS.map((p) => <option key={p.months} value={p.months}>{p.label} — {formatMoney(p.price, currency)}</option>)}
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Paid via">
                <Select value={channel} onChange={(e) => setChannel(e.target.value)}>
                  {PAYMENT_CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </Select>
              </Field>
              <Field label="Your phone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" inputMode="tel" />
              </Field>
            </div>
            <Field label="Transaction reference (optional)">
              <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. QGH7XY2M9P" />
            </Field>
            <Button className="w-full" loading={submitPayment.isPending} onClick={() => void submit()}>
              Submit for approval
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* History */}
      {myPayments.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Your payment requests</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {myPayments.map((p: Record<string, unknown>) => {
              const status = p.status as string;
              return (
                <div key={String(p.id)} className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <span className="font-bold">{formatMoney(Number(p.amount), currency)}</span>
                  <span className="text-xs text-muted-foreground">{String(p.channel)} · {String(p.months)}mo · {new Date(String(p.created_at)).toLocaleDateString("en", { day: "numeric", month: "short" })}</span>
                  <div className="ml-auto">
                    {status === "pending" && <Badge variant="warning">awaiting review</Badge>}
                    {status === "approved" && <Badge variant="success"><PartyPopper className="mr-1 inline h-3 w-3" />approved</Badge>}
                    {status === "rejected" && <Badge variant="destructive">rejected{p.review_note ? ` — ${String(p.review_note)}` : ""}</Badge>}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      <p className="pb-4 text-center text-xs text-muted-foreground">
        Payments are reviewed by the platform team — usually within a few hours. Your data is never deleted for lapsing; you simply can't sell until renewed.
      </p>
    </div>
  );
}

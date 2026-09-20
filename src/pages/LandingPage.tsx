import { Link } from "react-router-dom";
import {
  ArrowRight, BarChart3, Check, CloudOff, Factory, Package, ShieldCheck,
  ShoppingCart, Smartphone, Store, Users, Wallet, Zap,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { Button } from "@/components/ui/button";
import { BRAND } from "@/lib/brand";
import { useAuth } from "@/contexts/AuthContext";

/* ---------- Mini phone mockup of the POS (pure CSS — it's really our app) ---------- */
function PhoneMockup() {
  return (
    <div className="relative mx-auto w-[264px]">
      {/* floating chips */}
      <div className="absolute -left-24 top-16 hidden animate-float items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left shadow-pop sm:flex">
        <span className="rounded-lg bg-amberbrand-400/20 p-1.5 text-amberbrand-600"><Package className="h-4 w-4" /></span>
        <div>
          <p className="text-[11px] font-extrabold leading-tight">Low stock</p>
          <p className="text-[10px] text-muted-foreground">Azam Soda · 3 left</p>
        </div>
      </div>
      <div className="absolute -right-20 bottom-24 hidden animate-float items-center gap-2 rounded-xl border bg-card px-3 py-2 text-left shadow-pop [animation-delay:0.8s] sm:flex">
        <span className="rounded-lg bg-brand-100 p-1.5 text-brand-700"><Smartphone className="h-4 w-4" /></span>
        <div>
          <p className="text-[11px] font-extrabold leading-tight">M-Pesa received</p>
          <p className="text-[10px] text-muted-foreground">+Sh 45,000 today</p>
        </div>
      </div>

      {/* phone */}
      <div className="rounded-[2.6rem] border-[10px] border-brand-950 bg-card shadow-pop">
        <div className="overflow-hidden rounded-[1.9rem]">
          {/* status bar */}
          <div className="flex items-center justify-between bg-brand-950 px-4 py-1.5 text-[9px] font-bold text-white/80">
            <span>9:41</span>
            <span className="flex items-center gap-1"><CloudOff className="h-2.5 w-2.5" /> offline ok</span>
          </div>
          <div className="space-y-2.5 p-3 text-left">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Good morning ☀️</p>
                <p className="text-xs font-extrabold">Amina's Duka</p>
              </div>
              <span className="rounded-lg bg-brand-100 px-2 py-1 text-[9px] font-extrabold text-brand-700">Sh 184k today</span>
            </div>
            {/* product grid */}
            <div className="grid grid-cols-2 gap-1.5">
              {[
                ["Azam Soda 500ml", "Sh 800", "24 pc"],
                ["Unga 2kg", "Sh 4,500", "12 kg"],
                ["Cooking oil 1L", "Sh 9,000", "8 pc"],
                ["Sukari 1kg", "Sh 2,800", "30 kg"],
              ].map(([name, price, stock]) => (
                <div key={name} className="rounded-lg border p-2">
                  <p className="truncate text-[9px] font-bold">{name}</p>
                  <p className="text-[10px] font-extrabold text-brand-600">{price}</p>
                  <p className="text-[8px] text-muted-foreground">{stock}</p>
                </div>
              ))}
            </div>
            {/* cart bar */}
            <div className="rounded-xl bg-brand-600 p-2.5 text-white">
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span>3 items</span>
                <span>Sh 12,300</span>
              </div>
              <div className="mt-1.5 rounded-lg bg-white/15 py-1.5 text-center text-[10px] font-extrabold">
                Complete sale
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  { icon: ShoppingCart, title: "Sell in seconds", text: "Cash, M-Pesa, split and credit sales with camera barcode scanning and printable receipts." },
  { icon: Package, title: "Inventory that thinks", text: "Live stock, low-stock alerts, purchase receiving and production batches — with a full audit ledger." },
  { icon: Users, title: "Credit book & loyalty", text: "Track who owes you, collect repayments, and reward regulars with loyalty points." },
  { icon: BarChart3, title: "True profit math", text: "Costs are snapshotted at every sale, so margins stay honest even when supplier prices change." },
  { icon: Factory, title: "Run the whole shop", text: "Employees, attendance, salaries, assets, orders, suppliers — every module a real duka needs." },
  { icon: CloudOff, title: "Built for Tanzania", text: "Works offline, installs on any phone, speaks English & Kiswahili, thinks in TZS and M-Pesa." },
];

export default function LandingPage() {
  const { user } = useAuth();
  const cta = user ? "/dashboard" : "/signup";

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-lg font-extrabold tracking-tight">{BRAND.name}</span>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard"><Button size="sm">Open my shop <ArrowRight className="h-4 w-4" /></Button></Link>
            ) : (
              <>
                <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
                <Link to="/signup"><Button size="sm">Start free</Button></Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-mesh">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 lg:grid-cols-2 lg:py-24">
          <div className="animate-fade-up text-center lg:text-left">
            <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-bold text-brand-700 shadow-soft lg:mx-0">
              <Zap className="h-3.5 w-3.5" /> 14-day free trial · no card needed
            </div>
            <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Run your shop like a{" "}
              <span className="bg-gradient-to-r from-brand-500 to-brand-700 bg-clip-text text-transparent">big business</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-base leading-relaxed text-muted-foreground lg:mx-0">
              {BRAND.name} is the shopkeeper's assistant: point-of-sale, inventory, customer
              credit, employees and profit insights — in one fast app that{" "}
              <b className="text-foreground">keeps working when the internet doesn't</b>.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
              <Link to={cta}>
                <Button size="lg" className="shadow-pop">
                  {user ? "Go to dashboard" : "Create your shop — free"} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">I already sell here</Button>
              </Link>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-semibold text-muted-foreground lg:justify-start">
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Offline-first PWA</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> Your data, your Supabase</span>
              <span className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-brand-600" /> EN / Kiswahili</span>
            </div>
          </div>
          <div className="animate-fade-up [animation-delay:0.15s]">
            <PhoneMockup />
          </div>
        </div>
      </section>

      {/* Stats band */}
      <section className="border-y bg-brand-950 text-white">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-5 py-8 sm:grid-cols-4">
          {[
            ["18+", "modules built in"],
            ["4", "payment types at the till"],
            ["100%", "works offline"],
            ["Sh 0", "to get started"],
          ].map(([big, small]) => (
            <div key={small} className="text-center">
              <p className="text-2xl font-extrabold tracking-tight text-brand-300">{big}</p>
              <p className="mt-0.5 text-xs text-white/60">{small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Everything after the counter</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Not just a till — the full back office of a modern duka.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-xl border bg-card p-5 shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-pop">
              <span className="mb-3 inline-flex rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-2.5 text-white shadow-soft transition-transform group-hover:scale-105">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-bold">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-secondary/50">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <h2 className="text-center text-2xl font-extrabold tracking-tight sm:text-3xl">Selling in 3 steps</h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              { n: "1", icon: Store, title: "Create your shop", text: "Sign up free. Your workspace is ready in under a minute." },
              { n: "2", icon: Package, title: "Add your products", text: "Names, prices, stock. Scan barcodes straight from the camera." },
              { n: "3", icon: ShoppingCart, title: "Sell & watch profit", text: "Ring sales on any device. The dashboard does the accounting." },
            ].map((s) => (
              <div key={s.n} className="relative rounded-xl border bg-card p-5 shadow-soft">
                <span className="absolute -top-3 left-5 rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-extrabold text-white shadow-soft">
                  Step {s.n}
                </span>
                <s.icon className="mb-3 h-6 w-6 text-brand-600" />
                <h3 className="text-sm font-bold">{s.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Honest pricing for honest work</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Start with a <b className="text-foreground">14-day free trial</b>. After that, one simple
              plan — pay monthly with M-Pesa, or save up to 17% on a yearly plan. No commissions
              on your sales, ever.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm">
              {["Unlimited products & customers", "All 18 modules included", "Offline selling & automatic sync", "Multi-staff with roles & join codes"].map((x) => (
                <li key={x} className="flex items-center gap-2">
                  <span className="rounded-full bg-brand-100 p-1 text-brand-700"><Check className="h-3 w-3" /></span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="relative rounded-2xl border bg-brand-950 p-6 text-white shadow-pop">
            <span className="absolute -top-3 right-6 rounded-full bg-amberbrand-400 px-3 py-0.5 text-xs font-extrabold text-amberbrand-600 shadow-soft">
              most popular
            </span>
            <p className="text-sm font-semibold text-white/70">Monthly plan</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-4xl font-extrabold tracking-tight">Sh 25,000</span>
              <span className="pb-1 text-sm text-white/60">/ month</span>
            </div>
            <p className="mt-1 text-xs text-white/50">or Sh 250,000/year — two months free</p>
            <Link to={cta} className="mt-5 block">
              <Button variant="accent" size="lg" className="w-full">Start my 14-day free trial</Button>
            </Link>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-white/50">
              <ShieldCheck className="h-3 w-3" /> Cancel anytime · your data stays yours
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="border-t bg-mesh">
        <div className="mx-auto max-w-6xl px-5 py-16 text-center">
          <h2 className="mx-auto max-w-xl text-2xl font-extrabold tracking-tight sm:text-3xl">
            Your shop deserves better than a notebook
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">
            Join the dukes selling smarter with {BRAND.name}. Free for 14 days.
          </p>
          <Link to={cta} className="mt-7 inline-block">
            <Button size="lg" className="shadow-pop">
              <Wallet className="h-4 w-4" /> {user ? "Open my shop" : "Start free today"}
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {BRAND.name} · {BRAND.tagline}
      </footer>
    </div>
  );
}

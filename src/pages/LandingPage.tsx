import { Link } from "react-router-dom";
import { ArrowRight, BarChart3, CloudOff, Package, ShoppingCart, Smartphone, Store, Users, Wallet } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

const FEATURES = [
  { icon: ShoppingCart, title: "Sell in seconds", text: "A fast point-of-sale for cash, M-Pesa, split and credit sales. Prints receipts." },
  { icon: Package, title: "Know your stock", text: "Live stock levels, low-stock alerts and a full ledger of every movement." },
  { icon: Users, title: "Customer credit (book debts)", text: "Track who owes you, take repayments, and see balances at a glance." },
  { icon: BarChart3, title: "True profit, not guesses", text: "Costs snapshotted at every sale — real margin, daily revenue and trends." },
  { icon: Wallet, title: "Expenses", text: "Record rent, salaries, transport and more. Net profit updates instantly." },
  { icon: CloudOff, title: "Works offline", text: "Keep selling when the internet drops. Everything syncs safely later." },
];

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Store className="h-5 w-5" />
          </span>
          <span className="text-lg font-extrabold">{BRAND.name}</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Link to="/dashboard">
              <Button size="sm">Open my shop</Button>
            </Link>
          ) : (
            <>
              <Link to="/login">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link to="/signup">
                <Button size="sm">Start free</Button>
              </Link>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5">
        <section className="py-14 text-center sm:py-20">
          <div className="mx-auto mb-5 inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-bold text-brand-700">
            <Smartphone className="h-3.5 w-3.5" /> Installable app · works offline
          </div>
          <h1 className="mx-auto max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Run your shop like a <span className="text-brand-600">big business</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted-foreground">
            {BRAND.name} is the shopkeeper's assistant: point-of-sale, inventory, customer
            credit, expenses and profit insights — in one fast app. {BRAND.tagline}
          </p>
          <div className="mt-7 flex items-center justify-center gap-3">
            <Link to={user ? "/dashboard" : "/signup"}>
              <Button size="lg">
                {user ? "Go to dashboard" : "Create your shop — free"} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Free to start · No card needed</p>
        </section>

        <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-5 shadow-soft">
              <span className="mb-3 inline-flex rounded-lg bg-brand-100 p-2.5 text-brand-700">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="text-sm font-bold">{f.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        {BRAND.name} · {BRAND.tagline}
      </footer>
    </div>
  );
}

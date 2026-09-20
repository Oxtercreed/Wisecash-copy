import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BarChart3, CloudOff, ShieldCheck, Store } from "lucide-react";
import { BRAND } from "@/lib/brand";

const PERKS = [
  { icon: CloudOff, title: "Offline-first", text: "Keep selling when the internet drops." },
  { icon: BarChart3, title: "True profit", text: "Real margins, snapshotted at every sale." },
  { icon: ShieldCheck, title: "Yours only", text: "Your data lives in your own database." },
];

/** Split-screen brand panel (desktop) + form area. */
export function AuthLayout({ children, title, subtitle }: { children: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Brand panel */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-brand-950 p-10 text-white lg:flex">
        <div className="absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -bottom-24 -right-10 h-72 w-72 rounded-full bg-amberbrand-500/20 blur-3xl" />
        <div className="relative">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-soft">
              <Store className="h-5 w-5" />
            </span>
            <span className="text-xl font-extrabold tracking-tight">{BRAND.name}</span>
          </Link>
        </div>
        <div className="relative">
          <h2 className="max-w-sm text-3xl font-extrabold leading-tight tracking-tight">
            The shopkeeper's assistant that <span className="text-brand-300">sells smarter</span>.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/60">{BRAND.tagline} POS, stock, credit book, team and profit — one app.</p>
          <div className="mt-8 space-y-4">
            {PERKS.map((p) => (
              <div key={p.title} className="flex items-start gap-3">
                <span className="rounded-xl bg-white/10 p-2"><p.icon className="h-4 w-4" /></span>
                <div>
                  <p className="text-sm font-bold">{p.title}</p>
                  <p className="text-xs text-white/55">{p.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/40">© {new Date().getFullYear()} {BRAND.name} · Built for East African shops</p>
      </div>

      {/* Form */}
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center gap-2 text-center lg:hidden">
            <Link to="/" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-soft">
              <Store className="h-6 w-6" />
            </Link>
            <span className="text-lg font-extrabold">{BRAND.name}</span>
          </div>
          <h1 className="text-center text-xl font-extrabold">{title}</h1>
          <p className="mb-6 mt-1 text-center text-sm text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

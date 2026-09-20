import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Crown, Download, LogOut, Settings as SettingsIcon, Smartphone } from "lucide-react";
import { usePlatformAdmin } from "@/hooks/useSubscription";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage, type Language } from "@/contexts/LanguageContext";
import { COUNTRIES } from "@/hooks/useShopSettings";
import { BRAND } from "@/lib/brand";
import { parseAmount } from "@/lib/money";

export default function SettingsPage() {
  const { shop, profile, signOut } = useAuth();
  const { toast } = useToast();
  const { language, setLanguage } = useLanguage();
  const { isPlatform } = usePlatformAdmin();
  const [exporting, setExporting] = useState(false);

  async function exportBackup() {
    setExporting(true);
    try {
      const tables = ["products", "categories", "customers", "suppliers", "sales", "expenses", "staff", "assets"] as const;
      const backup: Record<string, unknown[]> = {};
      for (const table of tables) {
        const query = supabase.from(table).select(table === "sales" ? "*, sale_items(*)" : "*").limit(5000);
        const { data, error } = await query;
        if (error) throw error;
        backup[table] = data ?? [];
      }
      const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), shop: shop?.name, ...backup }, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `smartduka-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast("Backup downloaded", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [currency, setCurrency] = useState("TZS");
  const [taxRate, setTaxRate] = useState("0");
  const [footer, setFooter] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (shop && !initialized) {
      setInitialized(true);
      setName(shop.name);
      setPhone(shop.phone ?? "");
      setAddress(shop.address ?? "");
      setCurrency(shop.currency);
      setTaxRate(String(shop.tax_rate));
      setFooter(shop.receipt_footer);
    }
  }, [shop, initialized]);

  async function save() {
    if (!name.trim()) return toast("Shop name is required", "error");
    setSaving(true);
    try {
      const { supabase } = await import("@/lib/supabase");
      const { error } = await supabase
        .from("shops")
        .update({
          name: name.trim(),
          phone: phone.trim() || null,
          address: address.trim() || null,
          currency,
          tax_rate: parseAmount(taxRate),
          receipt_footer: footer,
        })
        .eq("id", shop!.id);
      if (error) throw error;
      toast("Settings saved — reloading…", "success");
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to save", "error");
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">Settings</h1>
        <p className="text-xs text-muted-foreground">Shop profile and app preferences</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Shop profile</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <Field label="Shop name" className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07xx xxx xxx" inputMode="tel" />
          </Field>
          <Field label="Address">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street, city" />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.currency} value={c.currency}>{c.currency} — {c.name}</option>
              ))}
              <option value="USD">USD</option>
            </Select>
          </Field>
          <Field label="Tax rate (%)" hint="Added on receipts as info; VAT flows into reports as a liability">
            <Input type="number" min={0} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} inputMode="decimal" />
          </Field>
          <Field label="Receipt footer" className="sm:col-span-2">
            <Textarea rows={2} value={footer} onChange={(e) => setFooter(e.target.value)} placeholder="Asante! Karibu tena." />
          </Field>
          <div className="sm:col-span-2">
            <Button onClick={() => void save()} loading={saving}>Save changes</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Language / Lugha</CardTitle></CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {([["en", "English"], ["sw", "Kiswahili"]] as Array<[Language, string]>).map(([code, label]) => (
              <button
                key={code}
                onClick={() => setLanguage(code)}
                className={
                  "flex-1 rounded-lg border p-3 text-sm font-bold transition-colors " +
                  (language === code ? "border-brand-600 bg-brand-50 text-brand-700" : "bg-card hover:bg-secondary")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Menus and key screens follow your choice. More translations coming.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Data</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">Backup export</p>
            <p className="text-xs text-muted-foreground">Download everything (products, customers, sales, expenses…) as one JSON file.</p>
          </div>
          <Button variant="outline" loading={exporting} onClick={() => void exportBackup()}>
            <Download className="h-4 w-4" /> Export backup
          </Button>
        </CardContent>
      </Card>

      {isPlatform && (
        <Card className="border-amberbrand-400/40">
          <CardHeader><CardTitle className="flex items-center gap-2"><Crown className="h-4 w-4 text-amberbrand-500" /> Platform admin</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Review subscription payments and see every shop on your platform.</p>
            <Link to="/platform"><Button variant="accent" size="sm">Open console</Button></Link>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Your account</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold">{profile?.full_name}</p>
            <p className="text-xs capitalize text-muted-foreground">Role: {profile?.role}</p>
          </div>
          <Button variant="outline" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Install {BRAND.name} on your phone</CardTitle></CardHeader>
        <CardContent className="flex items-start gap-3 text-sm text-muted-foreground">
          <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
          <div>
            Open this site in Chrome on Android (or Safari on iPhone) and tap{" "}
            <b className="text-foreground">"Add to Home Screen"</b> or the install banner.{" "}
            {BRAND.name} then works like a normal app — including offline.
          </div>
          <Download className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        </CardContent>
      </Card>

      <p className="flex items-center justify-center gap-2 py-2 text-center text-xs text-muted-foreground">
        <SettingsIcon className="h-3.5 w-3.5" /> {BRAND.name} v0.1 · {BRAND.tagline}
      </p>
    </div>
  );
}

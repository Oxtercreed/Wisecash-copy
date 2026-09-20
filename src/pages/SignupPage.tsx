import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRIES } from "@/hooks/useShopSettings";
import { BRAND } from "@/lib/brand";

export default function SignupPage() {
  const { signUp, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [countryCode, setCountryCode] = useState("TZ");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const currency = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode)?.currency ?? "TZS",
    [countryCode]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error, needsConfirm } = await signUp({
      email: email.trim(),
      password,
      fullName: fullName.trim(),
      shopName: shopName.trim(),
      country: countryCode,
      currency,
    });
    setLoading(false);

    if (error) {
      toast(error, "error");
      return;
    }
    if (needsConfirm) {
      toast("Check your email to confirm your account, then sign in.", "success");
      navigate("/login", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <Store className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-extrabold">Create your shop</h1>
          <p className="text-sm text-muted-foreground">Free · takes less than a minute</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-soft">
          <Field label="Your name">
            <Input required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Amina Joseph" />
          </Field>
          <Field label="Shop name">
            <Input required value={shopName} onChange={(e) => setShopName(e.target.value)} placeholder="Amina's Duka" />
          </Field>
          <Field label="Country" hint={`Currency: ${currency}`}>
            <Select value={countryCode} onChange={(e) => setCountryCode(e.target.value)}>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Field label="Password" hint="At least 6 characters">
            <Input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
          </Field>
          <Button type="submit" loading={loading} className="w-full">Create my shop</Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>
          <Button type="button" variant="outline" className="w-full" onClick={() => void signInWithGoogle()}>
            Sign up with Google
          </Button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-brand-700 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

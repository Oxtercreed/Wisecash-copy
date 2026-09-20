import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { COUNTRIES } from "@/hooks/useShopSettings";
import { BRAND } from "@/lib/brand";
import { resolveJoinCode } from "@/lib/joinCode";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function SignupPage() {
  const { signUp, signUpToExistingShop, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [shopName, setShopName] = useState("");
  const [countryCode, setCountryCode] = useState("TZ");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(false);

  const currency = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode)?.currency ?? "TZS",
    [countryCode]
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    // Joining an existing shop via code?
    let joinedError: string | null = null;
    if (joinCode.trim()) {
      const resolved = await resolveJoinCode(joinCode);
      if (!resolved) {
        joinedError = "That shop code doesn't match any shop. Check it or leave the field empty to create your own shop.";
      } else {
        const { error: joinError } = await signUpToExistingShop({
          email: email.trim(),
          password,
          fullName: fullName.trim(),
          shopId: resolved,
        });
        setLoading(false);
        if (joinError) {
          toast(joinError, "error");
          return;
        }
        toast("Welcome to the team! 🎉", "success");
        navigate("/dashboard", { replace: true });
        return;
      }
    }
    if (joinedError) {
      setLoading(false);
      toast(joinedError, "error");
      return;
    }

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
      // Only happens if "Confirm email" is still enabled in the Supabase dashboard.
      toast(
        "Email confirmation is still ON. In Supabase: Authentication → Providers → Email → turn OFF 'Confirm email', then sign up again.",
        "info"
      );
      navigate("/login", { replace: true });
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  return (
    <AuthLayout title="Create your shop" subtitle="Free 14-day trial · takes less than a minute">
      <div>

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
          <Field label="Shop code (optional)" hint="Have a code from your boss? Enter it to join their shop — shop name & country are ignored.">
            <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="SD-XXXXXX" />
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

      </div>
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-brand-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

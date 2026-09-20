import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { clearSupabaseCredentials, usingLocalCredentials } from "@/lib/supabase";
import { AuthLayout } from "@/components/layout/AuthLayout";

export default function LoginPage() {
  const { signIn, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) {
      toast(
        error.toLowerCase().includes("not confirmed")
          ? "Email confirmation is still ON. In Supabase: Authentication → Providers → Email → turn OFF 'Confirm email'. If that account was created before, delete it in Supabase (Authentication → Users) and sign up again."
          : error,
        "error"
      );
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to run your shop">
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-soft">
        <Field label="Email">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
        </Field>
        <Button type="submit" loading={loading} className="w-full">Sign in</Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => void signInWithGoogle()}>
          Continue with Google
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/signup" className="font-bold text-brand-600 hover:underline">
          Create your shop free
        </Link>
      </p>
      {usingLocalCredentials() && (
        <button
          onClick={() => {
            clearSupabaseCredentials();
            window.location.reload();
          }}
          className="mt-6 block w-full text-center text-[11px] text-muted-foreground hover:underline"
        >
          Change connected database
        </button>
      )}
    </AuthLayout>
  );
}

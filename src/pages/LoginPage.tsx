import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { BRAND } from "@/lib/brand";

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
      toast(error, "error");
      return;
    }
    navigate("/dashboard", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <Store className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-extrabold">Welcome back to {BRAND.name}</h1>
          <p className="text-sm text-muted-foreground">Sign in to run your shop</p>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border bg-card p-5 shadow-soft">
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
          <Link to="/signup" className="font-bold text-brand-700 hover:underline">
            Create your shop free
          </Link>
        </p>
      </div>
    </div>
  );
}

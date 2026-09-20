import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, CircleDashed, Database, ExternalLink, KeyRound, Link2, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { BRAND } from "@/lib/brand";
import { saveSupabaseCredentials, verifySupabaseCredentials } from "@/lib/supabase";

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-extrabold text-brand-700">
        {n}
      </span>
      <div className="min-w-0 text-sm">
        <p className="font-bold">{title}</p>
        <div className="mt-0.5 space-y-1 text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export default function SetupRequired() {
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warned, setWarned] = useState(false);

  const cleanUrl = url.trim().replace(/\/+$/, "");

  async function connect(force = false) {
    setError(null);
    if (!/^https?:\/\//.test(cleanUrl)) {
      setError("The Project URL should look like https://abcd1234.supabase.co");
      return;
    }
    if (key.trim().length < 20) {
      setError("That anon key looks too short — copy the whole thing.");
      return;
    }

    setChecking(true);
    const result = await verifySupabaseCredentials(cleanUrl, key);
    setChecking(false);

    if (result.ok || force) {
      saveSupabaseCredentials(cleanUrl, key);
      window.location.reload();
      return;
    }
    setWarned(true);
    setError(result.message ?? "Could not verify those credentials.");
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-soft">
            <Store className="h-6 w-6" />
          </span>
          <h1 className="text-2xl font-extrabold">Connect {BRAND.name} to your database</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            One-time setup (~5 minutes, free). Your data lives in <b>your own</b> Supabase project — we never see it.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[400px_1fr]">
          {/* Connect form */}
          <div className="rounded-lg border bg-card p-5 shadow-soft">
            <h2 className="mb-1 flex items-center gap-2 text-sm font-extrabold">
              <KeyRound className="h-4 w-4 text-brand-600" /> Paste your two keys
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Get them in Step 3 on the right →
            </p>
            <form
              className="flex flex-col gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void connect(false);
              }}
            >
              <Field label="Project URL">
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://abcd1234.supabase.co"
                  inputMode="url"
                  autoComplete="off"
                />
              </Field>
              <Field label="Anon / public key">
                <Input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="eyJhbGciOi… or sb_publishable_…"
                  autoComplete="off"
                />
              </Field>

              {error && (
                <p className="rounded-lg bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">{error}</p>
              )}

              <Button type="submit" loading={checking}>
                <Database className="h-4 w-4" /> Connect
              </Button>
              {warned && (
                <Button type="button" variant="outline" onClick={() => void connect(true)}>
                  Connect anyway
                </Button>
              )}
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                🔒 The <b>anon</b> key is the public one — it's designed to be used in apps and is safe
                here. <b>Never</b> paste the <code className="rounded bg-muted px-1">service_role</code> key anywhere.
              </p>
            </form>
          </div>

          {/* Guide */}
          <div className="space-y-5 rounded-lg border bg-card p-5 shadow-soft">
            <Step n={1} title="Create a free Supabase project (~2 min)">
              <p>
                Go to{" "}
                <a href="https://supabase.com" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-bold text-brand-700 hover:underline">
                  supabase.com <ExternalLink className="inline h-3 w-3" />
                </a>{" "}
                → sign up (GitHub or email) → click <b className="text-foreground">New project</b>.
              </p>
              <p>Name it <code className="rounded bg-muted px-1">smartduka</code>, pick a region near you, set a database password (save it), then hit <b className="text-foreground">Create new project</b>. No credit card needed.</p>
            </Step>

            <Step n={2} title="Create the tables (1 min)">
              <p>
                In your project's left sidebar open <b className="text-foreground">SQL Editor</b> (terminal icon) →
                click <b className="text-foreground">New query</b>.
              </p>
              <p>
                Open the file <code className="rounded bg-muted px-1">supabase/migrations/0001_core_schema.sql</code>{" "}
                in this repo, select all, copy, paste into the editor, then click{" "}
                <b className="text-foreground">Run</b> (or press Ctrl+Enter). It should say{" "}
                <i>Success. No rows returned</i>.
              </p>
            </Step>

            <Step n={3} title="Copy your two keys (30 sec)">
              <p>
                Left sidebar → <b className="text-foreground">Project Settings</b> (gear icon, bottom) →{" "}
                <b className="text-foreground">API</b> (or "API Keys" / "Data API").
              </p>
              <p className="flex items-start gap-2">
                <Link2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                Copy <b className="text-foreground">Project URL</b> — looks like <code className="rounded bg-muted px-1">https://abcd1234.supabase.co</code>
              </p>
              <p className="flex items-start gap-2">
                <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                Copy the <b className="text-foreground">anon / public</b> key (long string starting{" "}
                <code className="rounded bg-muted px-1">ey…</code> or <code className="rounded bg-muted px-1">sb_publishable_…</code>)
              </p>
            </Step>

            <Step n={4} title="Paste them in the form and connect">
              <p>Drop both values into the form on the left and press <b className="text-foreground">Connect</b> — {BRAND.name} verifies them and opens your shop. 🎉</p>
              <div className="flex gap-4 pt-1 text-xs">
                <span className="flex items-center gap-1.5"><CircleDashed className="h-3.5 w-3.5 text-muted-foreground" /> Project: creates your shop on signup</span>
                <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-brand-600" /> Free tier is plenty to start</span>
              </div>
            </Step>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prefer a .env file? Copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code>, fill the two values, restart the dev server.
        </p>
      </div>
    </div>
  );
}

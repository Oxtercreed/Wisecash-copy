import { Store } from "lucide-react";
import { BRAND } from "@/lib/brand";

export default function SetupRequired() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 text-center shadow-soft">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <Store className="h-6 w-6" />
        </span>
        <h1 className="text-lg font-extrabold">One step left: connect your database</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {BRAND.name} runs on Supabase (free tier is fine).
        </p>
        <ol className="mx-auto mt-4 max-w-sm space-y-2 text-left text-sm text-muted-foreground">
          <li>
            <b className="text-foreground">1.</b> Create a project at{" "}
            <a href="https://supabase.com" target="_blank" rel="noreferrer" className="font-bold text-brand-700 hover:underline">supabase.com</a>
          </li>
          <li>
            <b className="text-foreground">2.</b> Open <b className="text-foreground">SQL Editor</b> and run{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">supabase/migrations/0001_core_schema.sql</code> from this repo
          </li>
          <li>
            <b className="text-foreground">3.</b> Copy <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env.example</code> to{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">.env</code> and fill in{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> +{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code>
          </li>
          <li><b className="text-foreground">4.</b> Restart the dev server — you're done 🎉</li>
        </ol>
      </div>
    </div>
  );
}

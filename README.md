# SmartDuka — The Shopkeeper's Assistant 🏪

**Sell smarter. Track every shilling.**

SmartDuka is a mobile-first, offline-capable POS and business assistant for small
shops — point-of-sale, inventory, customer credit (book debts), expenses and true
profit reporting in one fast app. Built with ❤️ for East African dukes, in TZS by default.

> Phase 1 (current): Auth + shop onboarding · Inventory · POS (cash / M-Pesa / split / credit)
> · Sales history & voids · Customers & credit collection · Expenses · Dashboard & Reports ·
> offline sale queue · installable PWA.
> Roadmap: purchases & suppliers, staff/HR, receipts via thermal printers, subscription
> billing (mobile money), multi-user seats & roles UI, Swahili i18n.

## Tech stack

- **React 18 + Vite + TypeScript** — SPA, lazy-loaded routes
- **Tailwind CSS** — custom SmartDuka design system (emerald/amber, Plus Jakarta Sans)
- **Supabase** — Postgres + Auth + Row Level Security + atomic RPCs
- **Dexie (IndexedDB)** — offline outbox with idempotent sale replay
- **PWA** — installable, service worker caching, works offline
- **Recharts** — revenue & profit visuals

## Quick start

1. **Create a free Supabase project** at [supabase.com](https://supabase.com)
2. **Create the schema**: open Supabase → SQL Editor → paste & run
   [`supabase/migrations/0001_core_schema.sql`](./supabase/migrations/0001_core_schema.sql)
3. **Configure env**: copy `.env.example` → `.env` and fill in:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
   (Supabase Dashboard → Project Settings → API)
4. **Run**:
   ```bash
   npm install
   npm run dev        # http://localhost:5173
   npm run build      # production build in dist/
   ```

## Deploying (Vercel)

1. Push to GitHub and import the repo in Vercel
2. Add the two `VITE_*` environment variables
3. Deploy — the SPA fallback works out of the box
4. In Supabase → Authentication → URL Configuration, add your domain to Redirect URLs

## Architecture notes (the parts that matter)

- **Multi-tenant by design** — every table carries `shop_id`; Postgres Row Level
  Security scopes every read/write to the signed-in user's shop.
- **Atomic sales** — `complete_sale()` RPC checks stock, decrements it, snapshots
  `unit_cost` per line (so profit stays historically correct), creates customer
  credit, and generates the invoice — all in one database transaction.
- **Idempotent offline replay** — sales made offline are queued in IndexedDB with a
  UUID idempotency key; the SyncManager replays them when connectivity returns and
  the server dedupes safely.
- **Single money engine** — `src/lib/financials.ts` is the only place P&L is computed:
  Revenue = subtotal − discount (tax is a liability, never income); COGS uses
  snapshotted costs; Net = gross − expenses.

## Project structure

```
src/
├── app/            App root: providers + routes
├── components/     UI kit (hand-rolled) + layout shell
├── contexts/       Auth (session, profile, shop, role)
├── features/       Feature components (POS receipt…)
├── hooks/          Data hooks (products, sales, customers, expenses)
├── lib/            Supabase client, money, financials, outbox, sync
├── pages/          Route pages
└── styles/         Design tokens
supabase/
└── migrations/     0001_core_schema.sql (run once)
```

## Branding

Product name, tagline and description live in one file: `src/lib/brand.ts`.

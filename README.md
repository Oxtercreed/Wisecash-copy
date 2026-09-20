# SmartDuka — The Shopkeeper's Assistant 🏪

**Sell smarter. Track every shilling.**

SmartDuka is a mobile-first, offline-capable POS and business assistant for small
shops — point-of-sale, inventory, customer credit (book debts), expenses and true
profit reporting in one fast app. Built with ❤️ for East African dukes, in TZS by default.

> **Phase 1:** Auth + shop onboarding · Inventory · POS (cash / M-Pesa / split / credit with
> camera barcode scanning) · Sales history & voids · Customers & credit collection ·
> Dashboard & Reports · offline sale queue · installable PWA.
>
> **Phase 2:** Suppliers & purchase receiving · Orders (prepare → sell in one tap) ·
> Production batches · Team (HRM: employees, attendance, salaries) · Assets · To-Do ·
> Appointments · Other income · Notifications (auto low-stock & credit alerts) · User
> management with roles & join-code invites · Recycle bin (7-day restore) · CSV exports ·
> English/Kiswahili toggle.
>
> **Phase 3 (final):** Subscriptions — 14-day free trial, 25,000 TZS/month plans (1/3/6/12
> months), mobile-money payment submission & platform-admin approval, paywall enforcement
> with grace period · **Platform admin console** (all shops, MRR, payment queue) ·
> **Loyalty engine** (1 pt / 10,000 spent, redeem at POS) · Full JSON backup export ·
> First-run platform-owner claim.

## Monetization flow (Phase 3)

1. Every new shop starts a **14-day free trial** automatically.
2. When the trial ends there's a **7-day grace period** with warnings — then the app locks
   to the Billing page (data is never deleted).
3. The shop sends money to your mobile-money number, submits the reference on the Billing
   page, and you (the **platform admin**) approve it in the console — their plan extends
   instantly. Status is computed server-side, so no cron jobs are needed.
4. Claim platform ownership at `/platform` — the first account to claim wins (that's you,
   on your own deployment). Update the payment numbers in `src/lib/subscription.ts`.

## Tech stack

- **React 18 + Vite + TypeScript** — SPA, lazy-loaded routes
- **Tailwind CSS** — custom SmartDuka design system (emerald/amber, Plus Jakarta Sans)
- **Supabase** — Postgres + Auth + Row Level Security + atomic RPCs
- **Dexie (IndexedDB)** — offline outbox with idempotent sale replay
- **PWA** — installable, service worker caching, works offline
- **Recharts** — revenue & profit visuals

## Quick start

1. **Create a free Supabase project** at [supabase.com](https://supabase.com)
2. **Create the schema**: open Supabase → SQL Editor → paste & run all three, in order:
   [`supabase/migrations/0001_core_schema.sql`](./supabase/migrations/0001_core_schema.sql) →
   [`0002_phase2_modules.sql`](./supabase/migrations/0002_phase2_modules.sql) →
   [`0003_subscriptions_loyalty.sql`](./supabase/migrations/0003_subscriptions_loyalty.sql)
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
  snapshotted costs; Net = gross + other income − expenses.
- **Atomic stock everywhere** — sales, voids, purchases, production and stock
  adjustments all run through Postgres RPCs that check stock, write the
  `stock_moves` ledger and notify (low stock, credit sales) in one transaction.
- **Join codes instead of email invites** — every shop gets an `SD-XXXXXX` code;
  staff sign up with it and land in the shop as cashiers. The owner promotes them
  to manager or disables them, all enforced by RLS-backed RPCs.
- **Cron-free billing** — subscription state (trialing / active / grace / expired) is
  derived from timestamps on every read, so expiries just work without scheduled jobs.
- **Loyalty inside the sale transaction** — points are earned in the same atomic
  `complete_sale` RPC that moves stock, so they can never drift out of sync.

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

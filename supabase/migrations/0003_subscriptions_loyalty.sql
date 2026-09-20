-- ============================================================================
-- SmartDuka — Phase 3 schema: subscriptions & billing, platform admin,
-- loyalty engine. Run AFTER 0001 and 0002.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Platform admins (you!) — the first person to claim becomes platform owner
-- ---------------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
drop policy if exists "platform_admins_select" on public.platform_admins;
create policy "platform_admins_select" on public.platform_admins for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.platform_admins where user_id = auth.uid())
$$;

-- First-run claim: only succeeds while the table is empty
create or replace function public.claim_platform_admin()
returns boolean language plpgsql security definer set search_path = public as $$
declare v_empty boolean;
begin
  select not exists (select 1 from public.platform_admins) into v_empty;
  if not v_empty then
    return false;
  end if;
  insert into public.platform_admins (user_id) values (auth.uid()) on conflict do nothing;
  return true;
end $$;

-- ---------------------------------------------------------------------------
-- Subscriptions: 14-day trial, then monthly via approved mobile-money payments.
-- Status is COMPUTED from timestamps (no cron needed):
--   active   → current_period_end >= now
--   trialing → trial_ends_at >= now
--   grace    → past end but within 7 days
--   expired  → past end + 7 days
-- ---------------------------------------------------------------------------
create table if not exists public.shop_subscriptions (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '14 days'),
  current_period_start timestamptz,
  current_period_end timestamptz,
  monthly_price numeric not null default 25000 check (monthly_price >= 0),
  currency text not null default 'TZS',
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.create_shop_subscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.shop_subscriptions (shop_id) values (new.id) on conflict do nothing;
  return new;
end $$;

drop trigger if exists shops_subscription on public.shops;
create trigger shops_subscription after insert on public.shops
  for each row execute function public.create_shop_subscription();

-- Backfill for shops created before this migration
insert into public.shop_subscriptions (shop_id)
  select id from public.shops
  on conflict do nothing;

-- Manual mobile-money subscription payments, approved by the platform admin
create table if not exists public.subscription_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  submitted_by uuid references auth.users(id) on delete set null,
  provider text not null default 'manual',
  channel text not null check (channel in ('Mpesa','Halopesa','Airtel','MixxYas')),
  phone text not null,
  amount numeric not null check (amount > 0),
  months integer not null check (months in (1,3,6,12)),
  reference text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  review_note text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists subscription_payments_status_idx
  on public.subscription_payments (status, created_at desc);

create or replace function public.submit_subscription_payment(
  p_channel text,
  p_phone text,
  p_amount numeric,
  p_months integer,
  p_reference text default null
)
returns public.subscription_payments
language plpgsql security definer set search_path = public as $$
declare v_row public.subscription_payments;
begin
  if p_channel not in ('Mpesa','Halopesa','Airtel','MixxYas') then
    raise exception 'Unknown payment channel';
  end if;
  if p_months not in (1,3,6,12) then
    raise exception 'Invalid billing period';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  insert into public.subscription_payments (shop_id, submitted_by, channel, phone, amount, months, reference)
  values (public.my_shop_id(), auth.uid(), p_channel, p_phone, p_amount, p_months, nullif(trim(p_reference), ''))
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.approve_subscription_payment(p_payment_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_payment public.subscription_payments;
  v_sub public.shop_subscriptions;
  v_new_end timestamptz;
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform admin can approve payments';
  end if;

  select * into v_payment from public.subscription_payments where id = p_payment_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status <> 'pending' then raise exception 'Payment already reviewed'; end if;

  select * into v_sub from public.shop_subscriptions where shop_id = v_payment.shop_id for update;

  -- Extend from the later of "now" or the current paid period
  v_new_end := greatest(coalesce(v_sub.current_period_end, v_sub.trial_ends_at), now())
               + make_interval(months => v_payment.months);

  update public.subscription_payments
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = v_payment.id;

  update public.shop_subscriptions
    set current_period_start = now(),
        current_period_end = v_new_end,
        monthly_price = round(v_payment.amount / v_payment.months),
        last_payment_at = now(),
        updated_at = now()
    where shop_id = v_payment.shop_id;

  insert into public.notifications (shop_id, title, body, type, link)
  values (v_payment.shop_id, 'Subscription active 🎉',
          'Payment approved — your plan is active until ' || to_char(v_new_end, 'DD Mon YYYY'), 'info', '/billing');
end $$;

create or replace function public.reject_subscription_payment(p_payment_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only the platform admin can review payments';
  end if;
  update public.subscription_payments
    set status = 'rejected', review_note = p_note, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_payment_id and status = 'pending';
  if not found then raise exception 'Pending payment not found'; end if;
end $$;

-- One call the whole frontend uses to know the shop's billing state
create or replace function public.my_subscription()
returns json language plpgsql stable security definer set search_path = public as $$
declare
  v_sub public.shop_subscriptions;
  v_end timestamptz;
  v_state text;
  v_days int;
begin
  select * into v_sub from public.shop_subscriptions where shop_id = public.my_shop_id();

  if v_sub is null then
    return json_build_object(
      'state', 'trialing', 'days_left', 14, 'trial_end', null, 'period_end', null,
      'monthly_price', 25000, 'currency', 'TZS', 'is_platform', public.is_platform_admin());
  end if;

  v_end := coalesce(v_sub.current_period_end, v_sub.trial_ends_at);

  if v_sub.current_period_end is not null and v_sub.current_period_end >= now() then
    v_state := 'active';
  elsif v_sub.trial_ends_at >= now() then
    v_state := 'trialing';
  elsif now() < v_end + interval '7 days' then
    v_state := 'grace';
  else
    v_state := 'expired';
  end if;

  v_days := ceil(extract(epoch from (v_end - now())) / 86400)::int;

  return json_build_object(
    'state', v_state,
    'days_left', v_days,
    'trial_end', v_sub.trial_ends_at,
    'period_end', v_sub.current_period_end,
    'monthly_price', v_sub.monthly_price,
    'currency', v_sub.currency,
    'is_platform', public.is_platform_admin());
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.shop_subscriptions enable row level security;
drop policy if exists "shop_subscriptions_select" on public.shop_subscriptions;
create policy "shop_subscriptions_select" on public.shop_subscriptions for select to authenticated
  using (shop_id = public.my_shop_id() or public.is_platform_admin());

alter table public.subscription_payments enable row level security;
drop policy if exists "subscription_payments_select" on public.subscription_payments;
create policy "subscription_payments_select" on public.subscription_payments for select to authenticated
  using (shop_id = public.my_shop_id() or public.is_platform_admin());
drop policy if exists "subscription_payments_insert" on public.subscription_payments;
create policy "subscription_payments_insert" on public.subscription_payments for insert to authenticated
  with check (shop_id = public.my_shop_id());

-- Platform admin can see every shop (read-only)
drop policy if exists "shops_platform_read" on public.shops;
create policy "shops_platform_read" on public.shops for select to authenticated
  using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- Loyalty engine: 1 point per 10,000 spent, 1 point = 200 when redeeming
-- ---------------------------------------------------------------------------
alter table public.customers add column if not exists loyalty_points integer not null default 0 check (loyalty_points >= 0);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  delta integer not null,
  reason text not null,
  ref_sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.loyalty_ledger enable row level security;
drop policy if exists "loyalty_ledger_select" on public.loyalty_ledger;
create policy "loyalty_ledger_select" on public.loyalty_ledger for select to authenticated
  using (shop_id = public.my_shop_id());

create or replace function public.redeem_points(p_customer_id uuid, p_points integer)
returns numeric
language plpgsql security definer set search_path = public as $$
declare
  v_customer public.customers;
  v_value numeric;
begin
  if p_points is null or p_points <= 0 then
    raise exception 'Choose how many points to use';
  end if;

  select * into v_customer from public.customers
    where id = p_customer_id and shop_id = public.my_shop_id() for update;
  if not found then raise exception 'Customer not found'; end if;
  if v_customer.loyalty_points < p_points then
    raise exception 'Customer only has % points', v_customer.loyalty_points;
  end if;

  v_value := p_points * 200;

  update public.customers set loyalty_points = loyalty_points - p_points where id = v_customer.id;
  insert into public.loyalty_ledger (shop_id, customer_id, delta, reason)
  values (v_customer.shop_id, v_customer.id, -p_points, 'redeemed');

  return v_value;
end $$;

-- ---------------------------------------------------------------------------
-- complete_sale v2: adds loyalty earning to the existing atomic sale
-- ---------------------------------------------------------------------------
create or replace function public.complete_sale(
  p_idempotency_key uuid default null,
  p_customer_id uuid default null,
  p_customer_name text default null,
  p_payment_method public.payment_method default 'cash',
  p_items jsonb default '[]'::jsonb,
  p_discount numeric default 0,
  p_tax numeric default 0,
  p_cash_amount numeric default null,
  p_mpesa_amount numeric default null,
  p_mpesa_ref text default null,
  p_note text default null
)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_user_id uuid;
  v_existing public.sales;
  v_sale public.sales;
  v_item jsonb;
  v_product public.products;
  v_qty numeric;
  v_price numeric;
  v_subtotal numeric := 0;
  v_total numeric;
  v_cash numeric := 0;
  v_mpesa numeric := 0;
  v_credit numeric := 0;
  v_points integer;
  v_invoice text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;
  v_shop_id := public.my_shop_id();
  if v_shop_id is null then
    raise exception 'No shop found for current user';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.sales where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale must have at least one item';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::numeric, 0);
    v_price := coalesce((v_item->>'unit_price')::numeric, 0);
    if v_qty <= 0 or v_price < 0 then
      raise exception 'Invalid sale item';
    end if;
    v_subtotal := v_subtotal + (v_qty * v_price);
  end loop;

  v_total := v_subtotal - coalesce(p_discount, 0) + coalesce(p_tax, 0);
  if v_total < 0 then
    raise exception 'Discount cannot exceed sale total';
  end if;

  if p_payment_method = 'cash' then
    v_cash := v_total;
  elsif p_payment_method = 'mpesa' then
    v_mpesa := v_total;
  elsif p_payment_method = 'split' then
    v_cash := coalesce(p_cash_amount, 0);
    v_mpesa := coalesce(p_mpesa_amount, 0);
    if v_cash < 0 or v_mpesa < 0 or abs(v_cash + v_mpesa - v_total) > 0.01 then
      raise exception 'Split amounts must add up to the total';
    end if;
  elsif p_payment_method = 'credit' then
    if p_customer_id is null then
      raise exception 'Credit sale requires a customer';
    end if;
    v_credit := v_total;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    if (v_item->>'product_id') is not null and coalesce((v_item->>'tracks_stock')::boolean, true) then
      select * into v_product from public.products
        where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id for update;
      if not found then
        raise exception 'Product not found: %', v_item->>'product_name';
      end if;
      if v_product.stock < (v_item->>'quantity')::numeric then
        raise exception 'Not enough stock for % (have %)', v_product.name, v_product.stock;
      end if;
    end if;
  end loop;

  if v_credit > 0 then
    update public.customers
      set credit_balance = credit_balance + v_credit
      where id = p_customer_id and shop_id = v_shop_id;
    if not found then
      raise exception 'Customer not found';
    end if;
  end if;

  v_invoice := public.next_invoice_number();

  insert into public.sales (
    shop_id, cashier_id, customer_id, customer_name, invoice_number,
    payment_method, mpesa_ref, subtotal, discount, tax, total,
    cash_amount, mpesa_amount, credit_amount, note, idempotency_key
  ) values (
    v_shop_id, v_user_id, p_customer_id, p_customer_name, v_invoice,
    p_payment_method, p_mpesa_ref, v_subtotal, coalesce(p_discount, 0), coalesce(p_tax, 0), v_total,
    v_cash, v_mpesa, v_credit, p_note, p_idempotency_key
  ) returning * into v_sale;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_price := (v_item->>'unit_price')::numeric;

    if (v_item->>'product_id') is not null then
      select * into v_product from public.products
        where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id;

      insert into public.sale_items (sale_id, product_id, product_name, quantity, unit_price, unit_cost, line_total)
      values (v_sale.id, v_product.id, coalesce(v_product.name, v_item->>'product_name'), v_qty, v_price,
              coalesce(v_product.buying_price, 0), v_qty * v_price);

      if v_product.tracks_stock then
        update public.products
          set stock = stock - v_qty
          where id = v_product.id;
        insert into public.stock_moves (shop_id, product_id, delta, stock_before, stock_after, reason, ref_sale_id, created_by)
        values (v_shop_id, v_product.id, -v_qty, v_product.stock, v_product.stock - v_qty, 'sale', v_sale.id, v_user_id);
      end if;
    else
      insert into public.sale_items (sale_id, product_name, quantity, unit_price, unit_cost, line_total)
      values (v_sale.id, v_item->>'product_name', v_qty, v_price, 0, v_qty * v_price);
    end if;
  end loop;

  -- Loyalty: earn 1 point per 10,000 spent when the sale has a customer
  if p_customer_id is not null then
    v_points := floor(v_total / 10000);
    if v_points > 0 then
      update public.customers set loyalty_points = loyalty_points + v_points where id = p_customer_id;
      insert into public.loyalty_ledger (shop_id, customer_id, delta, reason, ref_sale_id)
      values (v_shop_id, p_customer_id, v_points, 'earned', v_sale.id);
    end if;
  end if;

  return v_sale;
end $$;

-- ============================================================================
-- SmartDuka — Core Schema (Phase 1)
-- Run this ONCE in your Supabase project: Dashboard → SQL Editor → New query
-- Multi-tenant POS: shops, products, customers & credit, sales, expenses,
-- stock ledger, atomic sale/void/payment RPCs, Row Level Security everywhere.
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('owner', 'manager', 'cashier');
create type public.sale_status as enum ('completed', 'voided');
create type public.payment_method as enum ('cash', 'mpesa', 'split', 'credit');

-- ---------------------------------------------------------------------------
-- Shops & users
-- ---------------------------------------------------------------------------
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'My Shop',
  phone text,
  address text,
  country text not null default 'TZ',
  currency text not null default 'TZS',
  tax_rate numeric not null default 0 check (tax_rate >= 0),
  receipt_footer text not null default 'Asante! Karibu tena.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  full_name text not null default 'Shop Owner',
  phone text,
  role public.app_role not null default 'owner',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_shop_idx on public.profiles (shop_id);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (shop_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  barcode text,
  unit text not null default 'piece',
  buying_price numeric not null default 0 check (buying_price >= 0),
  selling_price numeric not null default 0 check (selling_price >= 0),
  stock numeric not null default 0,
  tracks_stock boolean not null default true,
  low_stock_at numeric not null default 5,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_shop_idx on public.products (shop_id);
create index products_barcode_idx on public.products (shop_id, barcode);

-- ---------------------------------------------------------------------------
-- Customers & credit
-- ---------------------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  credit_balance numeric not null default 0 check (credit_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_shop_idx on public.customers (shop_id);

-- ---------------------------------------------------------------------------
-- Sales
-- ---------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  cashier_id uuid references auth.users(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  invoice_number text not null unique,
  status public.sale_status not null default 'completed',
  payment_method public.payment_method not null default 'cash',
  mpesa_ref text,
  subtotal numeric not null default 0,
  discount numeric not null default 0 check (discount >= 0),
  tax numeric not null default 0 check (tax >= 0),
  total numeric not null default 0,
  cash_amount numeric not null default 0,
  mpesa_amount numeric not null default 0,
  credit_amount numeric not null default 0,
  note text,
  idempotency_key uuid unique,
  created_at timestamptz not null default now()
);

create index sales_shop_created_idx on public.sales (shop_id, created_at desc);

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null,
  unit_cost numeric not null default 0,
  line_total numeric not null
);

create index sale_items_sale_idx on public.sale_items (sale_id);

-- Payments against customer credit (a full ledger of debt repayments)
create table public.customer_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'cash',
  reference text,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index customer_payments_customer_idx on public.customer_payments (customer_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Expenses
-- ---------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  category text not null default 'General',
  amount numeric not null check (amount > 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index expenses_shop_date_idx on public.expenses (shop_id, spent_on desc);

-- ---------------------------------------------------------------------------
-- Stock ledger (every stock change is recorded here)
-- ---------------------------------------------------------------------------
create table public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  delta numeric not null,
  stock_before numeric not null,
  stock_after numeric not null,
  reason text not null default 'manual_adjust',
  ref_sale_id uuid references public.sales(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index stock_moves_product_idx on public.stock_moves (product_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (SECURITY DEFINER so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.my_shop_id()
returns uuid language sql stable security definer set search_path = public as $$
  select shop_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role()
returns public.app_role language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger shops_touch before update on public.shops
  for each row execute function public.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- New auth user → create shop + owner profile (or join shop when invited)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_role public.app_role;
  v_currency text;
  v_country text;
begin
  if new.raw_user_meta_data->>'invited_shop_id' is not null then
    v_shop_id := (new.raw_user_meta_data->>'invited_shop_id')::uuid;
    v_role := coalesce((new.raw_user_meta_data->>'invited_role')::public.app_role, 'cashier');
    insert into public.profiles (id, shop_id, full_name, phone, role)
    values (new.id, v_shop_id,
            coalesce(new.raw_user_meta_data->>'full_name', 'Staff'),
            new.phone, v_role);
  else
    v_currency := coalesce(nullif(trim(new.raw_user_meta_data->>'currency'), ''), 'TZS');
    v_country := coalesce(nullif(trim(new.raw_user_meta_data->>'country'), ''), 'TZ');
    insert into public.shops (name, phone, currency, country)
    values (coalesce(nullif(trim(new.raw_user_meta_data->>'shop_name'), ''), 'My Shop'),
            new.phone, v_currency, v_country)
    returning id into v_shop_id;
    insert into public.profiles (id, shop_id, full_name, phone, role)
    values (new.id, v_shop_id,
            coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), 'Shop Owner'),
            new.phone, 'owner');
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Invoice numbers: INV-260920-4F2A9C style
create or replace function public.next_invoice_number()
returns text language plpgsql set search_path = public as $$
begin
  return 'INV-' || to_char(now(), 'DDMMYY') || '-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
end $$;

-- ---------------------------------------------------------------------------
-- RPC: complete a sale atomically (stock check + decrement + cost snapshot +
-- customer credit). Idempotent via p_idempotency_key so offline replays are safe.
-- p_items: jsonb array of {product_id, product_name, quantity, unit_price, tracks_stock?}
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

  -- Idempotency: already processed? return the existing sale untouched.
  if p_idempotency_key is not null then
    select * into v_existing from public.sales where idempotency_key = p_idempotency_key;
    if found then
      return v_existing;
    end if;
  end if;

  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Sale must have at least one item';
  end if;

  -- Totals from line items (server is the source of truth)
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

  -- Payment rules
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

  -- Stock check (before inserting anything)
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

  -- Credit limit guard: customer must not go negative
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

  -- Line items with cost snapshot + stock decrement + ledger entry
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
      -- Ad-hoc item without a product record
      insert into public.sale_items (sale_id, product_name, quantity, unit_price, unit_cost, line_total)
      values (v_sale.id, v_item->>'product_name', v_qty, v_price, 0, v_qty * v_price);
    end if;
  end loop;

  return v_sale;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: void a sale (owner/manager only) — restocks items, reverses credit
-- ---------------------------------------------------------------------------
create or replace function public.void_sale(p_sale_id uuid)
returns public.sales
language plpgsql security definer set search_path = public as $$
declare
  v_sale public.sales;
  v_item public.sale_items;
  v_before numeric;
begin
  if public.my_role() not in ('owner', 'manager') then
    raise exception 'Only owners and managers can void sales';
  end if;

  select * into v_sale from public.sales
    where id = p_sale_id and shop_id = public.my_shop_id() for update;
  if not found then
    raise exception 'Sale not found';
  end if;
  if v_sale.status = 'voided' then
    return v_sale;
  end if;

  for v_item in select * from public.sale_items where sale_id = v_sale.id loop
    if v_item.product_id is not null then
      select stock into v_before from public.products where id = v_item.product_id for update;
      update public.products set stock = stock + v_item.quantity where id = v_item.product_id;
      insert into public.stock_moves (shop_id, product_id, delta, stock_before, stock_after, reason, ref_sale_id, created_by)
      values (v_sale.shop_id, v_item.product_id, v_item.quantity, v_before, v_before + v_item.quantity, 'void', v_sale.id, auth.uid());
    end if;
  end loop;

  if v_sale.credit_amount > 0 and v_sale.customer_id is not null then
    update public.customers
      set credit_balance = greatest(0, credit_balance - v_sale.credit_amount)
      where id = v_sale.customer_id;
  end if;

  update public.sales set status = 'voided' where id = v_sale.id returning * into v_sale;
  return v_sale;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: manual stock adjustment (restock / correction) — writes to the ledger
-- ---------------------------------------------------------------------------
create or replace function public.adjust_stock(p_product_id uuid, p_delta numeric, p_reason text default 'manual_adjust')
returns public.products
language plpgsql security definer set search_path = public as $$
declare
  v_product public.products;
begin
  select * into v_product from public.products
    where id = p_product_id and shop_id = public.my_shop_id() for update;
  if not found then
    raise exception 'Product not found';
  end if;
  if v_product.stock + p_delta < 0 then
    raise exception 'Adjustment would make stock negative';
  end if;

  update public.products set stock = stock + p_delta where id = v_product.id
    returning * into v_product;

  insert into public.stock_moves (shop_id, product_id, delta, stock_before, stock_after, reason, created_by)
  values (v_product.shop_id, v_product.id, p_delta, v_product.stock - p_delta, v_product.stock, p_reason, auth.uid());

  return v_product;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: record a customer credit repayment
-- ---------------------------------------------------------------------------
create or replace function public.record_customer_payment(
  p_customer_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_reference text default null
)
returns public.customers
language plpgsql security definer set search_path = public as $$
declare
  v_customer public.customers;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment amount must be positive';
  end if;

  select * into v_customer from public.customers
    where id = p_customer_id and shop_id = public.my_shop_id() for update;
  if not found then
    raise exception 'Customer not found';
  end if;
  if v_customer.credit_balance < p_amount then
    raise exception 'Payment exceeds outstanding balance (%)', v_customer.credit_balance;
  end if;

  insert into public.customer_payments (shop_id, customer_id, amount, method, reference, recorded_by)
  values (v_customer.shop_id, v_customer.id, p_amount, p_method, p_reference, auth.uid());

  update public.customers set credit_balance = credit_balance - p_amount
    where id = v_customer.id returning * into v_customer;

  return v_customer;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security — every table scoped to the user's shop
-- ---------------------------------------------------------------------------
alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.customer_payments enable row level security;
alter table public.expenses enable row level security;
alter table public.stock_moves enable row level security;

-- shops: members can read/update their own shop
create policy "shops_select" on public.shops for select to authenticated
  using (id = public.my_shop_id());
create policy "shops_update" on public.shops for update to authenticated
  using (id = public.my_shop_id());

-- profiles: read everyone in your shop; edit only yourself
create policy "profiles_select" on public.profiles for select to authenticated
  using (shop_id = public.my_shop_id());
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid());

-- Generic shop-scoped CRUD for business tables
do $$
declare t text;
begin
  foreach t in array array['categories','products','customers','expenses'] loop
    execute format('create policy "%1$s_select" on public.%1$s for select to authenticated using (shop_id = public.my_shop_id());', t);
    execute format('create policy "%1$s_insert" on public.%1$s for insert to authenticated with check (shop_id = public.my_shop_id());', t);
    execute format('create policy "%1$s_update" on public.%1$s for update to authenticated using (shop_id = public.my_shop_id());', t);
    execute format('create policy "%1$s_delete" on public.%1$s for delete to authenticated using (shop_id = public.my_shop_id());', t);
  end loop;
end $$;

-- sales: staff can create/read; updates/deletes limited to owner+manager
create policy "sales_select" on public.sales for select to authenticated
  using (shop_id = public.my_shop_id());
create policy "sales_insert" on public.sales for insert to authenticated
  with check (shop_id = public.my_shop_id());
create policy "sales_update" on public.sales for update to authenticated
  using (shop_id = public.my_shop_id() and public.my_role() in ('owner','manager'));
create policy "sales_delete" on public.sales for delete to authenticated
  using (shop_id = public.my_shop_id() and public.my_role() in ('owner','manager'));

-- sale_items follow their sale
create policy "sale_items_select" on public.sale_items for select to authenticated
  using (exists (select 1 from public.sales s where s.id = sale_id and s.shop_id = public.my_shop_id()));
create policy "sale_items_insert" on public.sale_items for insert to authenticated
  with check (exists (select 1 from public.sales s where s.id = sale_id and s.shop_id = public.my_shop_id()));

-- credit repayments
create policy "customer_payments_select" on public.customer_payments for select to authenticated
  using (shop_id = public.my_shop_id());
create policy "customer_payments_insert" on public.customer_payments for insert to authenticated
  with check (shop_id = public.my_shop_id());

-- stock ledger: read-only for members (writes go through RPCs)
create policy "stock_moves_select" on public.stock_moves for select to authenticated
  using (shop_id = public.my_shop_id());

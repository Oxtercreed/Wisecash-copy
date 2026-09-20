-- ============================================================================
-- SmartDuka — Phase 2 schema: suppliers, purchases, orders, HRM, production,
-- assets, todos, appointments, other income, notifications, users & join codes,
-- recycle bin, richer complete_sale. Run AFTER 0001_core_schema.sql.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Shops: staff join codes
-- ---------------------------------------------------------------------------
alter table public.shops add column if not exists join_code text unique;

create or replace function public.generate_join_code()
returns text language plpgsql security definer set search_path = public as $$
declare
  v_code text;
  v_exists boolean;
begin
  loop
    v_code := 'SD-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    select exists(select 1 from public.shops where join_code = v_code) into v_exists;
    if not v_exists then
      return v_code;
    end if;
  end loop;
end $$;

-- Fill codes for existing shops + auto-generate for new ones
update public.shops set join_code = public.generate_join_code() where join_code is null;

create or replace function public.set_join_code()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.join_code is null or trim(new.join_code) = '' then
    new.join_code := public.generate_join_code();
  end if;
  return new;
end $$;

drop trigger if exists shops_join_code on public.shops;
create trigger shops_join_code before insert on public.shops
  for each row execute function public.set_join_code();

-- Anon-resolvable so a new user can look up a shop code before signup
create or replace function public.resolve_join_code(p_code text)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.shops where join_code = upper(trim(p_code)) limit 1
$$;
grant execute on function public.resolve_join_code(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profiles: role management + disable (owner actions)
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists disabled boolean not null default false;

create or replace function public.set_staff_role(p_profile_id uuid, p_role public.app_role)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'owner' then
    raise exception 'Only the owner can change roles';
  end if;
  if p_role not in ('manager', 'cashier') then
    raise exception 'You can only assign manager or cashier roles';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  update public.profiles set role = p_role
    where id = p_profile_id and shop_id = public.my_shop_id();
  if not found then
    raise exception 'User not found in your shop';
  end if;
end $$;

create or replace function public.set_staff_disabled(p_profile_id uuid, p_disabled boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() <> 'owner' then
    raise exception 'Only the owner can enable or disable users';
  end if;
  if p_profile_id = auth.uid() then
    raise exception 'You cannot disable yourself';
  end if;
  update public.profiles set disabled = p_disabled
    where id = p_profile_id and shop_id = public.my_shop_id();
  if not found then
    raise exception 'User not found in your shop';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Suppliers & purchases
-- ---------------------------------------------------------------------------
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  phone text,
  note text,
  pending_payment numeric not null default 0 check (pending_payment >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.supplier_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  amount numeric not null check (amount > 0),
  method text not null default 'cash',
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  reference text,
  total numeric not null default 0,
  paid numeric not null default 0 check (paid >= 0),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  product_name text not null,
  quantity numeric not null check (quantity > 0),
  unit_cost numeric not null check (unit_cost >= 0),
  line_total numeric not null
);

-- Atomic: stock in + cost update + supplier debt
create or replace function public.record_purchase(
  p_supplier_id uuid default null,
  p_reference text default null,
  p_items jsonb default '[]'::jsonb,
  p_paid numeric default 0,
  p_note text default null
)
returns public.purchases
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_user_id uuid;
  v_purchase public.purchases;
  v_item jsonb;
  v_product public.products;
  v_qty numeric;
  v_cost numeric;
  v_total numeric := 0;
  v_paid numeric;
begin
  v_user_id := auth.uid();
  if v_user_id is null then raise exception 'Authentication required'; end if;
  v_shop_id := public.my_shop_id();
  if v_shop_id is null then raise exception 'No shop found'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Purchase must have at least one item';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'quantity')::numeric;
    v_cost := coalesce((v_item->>'unit_cost')::numeric, 0);
    if v_qty <= 0 or v_cost < 0 then raise exception 'Invalid purchase item'; end if;
    v_total := v_total + v_qty * v_cost;
  end loop;

  v_paid := greatest(0, least(coalesce(p_paid, 0), v_total));

  -- Stock check up front
  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id for update;
    if not found then raise exception 'Product not found: %', v_item->>'product_name'; end if;
  end loop;

  insert into public.purchases (shop_id, supplier_id, supplier_name, reference, total, paid, note, created_by)
  values (
    v_shop_id, p_supplier_id,
    (select name from public.suppliers where id = p_supplier_id and shop_id = v_shop_id),
    p_reference, v_total, v_paid, p_note, v_user_id
  ) returning * into v_purchase;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id;
    v_qty := (v_item->>'quantity')::numeric;
    v_cost := coalesce((v_item->>'unit_cost')::numeric, 0);

    insert into public.purchase_items (purchase_id, product_id, product_name, quantity, unit_cost, line_total)
    values (v_purchase.id, v_product.id, v_product.name, v_qty, v_cost, v_qty * v_cost);

    update public.products set stock = stock + v_qty, buying_price = v_cost where id = v_product.id;
    insert into public.stock_moves (shop_id, product_id, delta, stock_before, stock_after, reason, created_by)
    values (v_shop_id, v_product.id, v_qty, v_product.stock, v_product.stock + v_qty, 'purchase', v_user_id);
  end loop;

  -- Unpaid remainder becomes supplier debt
  if p_supplier_id is not null and v_total - v_paid > 0 then
    update public.suppliers
      set pending_payment = pending_payment + (v_total - v_paid)
      where id = p_supplier_id;
  end if;

  return v_purchase;
end $$;

create or replace function public.record_supplier_payment(
  p_supplier_id uuid,
  p_amount numeric,
  p_method text default 'cash',
  p_note text default null
)
returns public.suppliers
language plpgsql security definer set search_path = public as $$
declare
  v_supplier public.suppliers;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  select * into v_supplier from public.suppliers
    where id = p_supplier_id and shop_id = public.my_shop_id() for update;
  if not found then raise exception 'Supplier not found'; end if;
  if v_supplier.pending_payment < p_amount then
    raise exception 'Payment exceeds pending balance (%)', v_supplier.pending_payment;
  end if;
  insert into public.supplier_payments (shop_id, supplier_id, amount, method, note)
  values (v_supplier.shop_id, v_supplier.id, p_amount, p_method, p_note);
  update public.suppliers set pending_payment = pending_payment - p_amount
    where id = v_supplier.id returning * into v_supplier;
  return v_supplier;
end $$;

-- ---------------------------------------------------------------------------
-- Orders (pending → processing → completed / cancelled) + convert to sale
-- ---------------------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  order_number text not null,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text,
  customer_phone text,
  status text not null default 'pending' check (status in ('pending','processing','completed','cancelled')),
  total numeric not null default 0,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null default 0,
  line_total numeric not null default 0
);

create or replace function public.next_order_number()
returns text language sql set search_path = public as $$
  select 'ORD-' || to_char(now(), 'DDMMYY') || '-' || upper(substr(md5(random()::text), 1, 4))
$$;

-- ---------------------------------------------------------------------------
-- HRM: staff, attendance, salary payments
-- ---------------------------------------------------------------------------
create table if not exists public.staff (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  full_name text not null,
  phone text,
  position text not null default 'Staff',
  salary numeric not null default 0 check (salary >= 0),
  hire_date date not null default current_date,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  day date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status text not null default 'present' check (status in ('present','absent','leave')),
  notes text,
  created_at timestamptz not null default now(),
  unique (staff_id, day)
);

create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  staff_id uuid not null references public.staff(id) on delete cascade,
  amount numeric not null check (amount > 0),
  month text not null,
  note text,
  created_at timestamptz not null default now()
);

-- Check in / out helpers (one row per staff per day)
create or replace function public.staff_check_in(p_staff_id uuid)
returns public.attendance language plpgsql security definer set search_path = public as $$
declare v_row public.attendance;
begin
  select * into v_row from public.attendance
    where staff_id = p_staff_id and shop_id = public.my_shop_id() and day = current_date;
  if found then return v_row; end if;
  insert into public.attendance (shop_id, staff_id, day, check_in, status)
  values (public.my_shop_id(), p_staff_id, current_date, now(), 'present')
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.staff_check_out(p_staff_id uuid)
returns public.attendance language plpgsql security definer set search_path = public as $$
declare v_row public.attendance;
begin
  update public.attendance set check_out = now()
    where staff_id = p_staff_id and shop_id = public.my_shop_id() and day = current_date
    returning * into v_row;
  if not found then raise exception 'No check-in found today'; end if;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- Assets, todos, appointments, other income, notifications
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  category text not null default 'Equipment',
  location text,
  purchase_price numeric not null default 0 check (purchase_price >= 0),
  purchase_date date,
  current_value numeric not null default 0 check (current_value >= 0),
  condition text not null default 'Good',
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  customer_name text,
  customer_phone text,
  starts_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled','done','cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.other_income (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  source text not null default 'Other',
  amount numeric not null check (amount > 0),
  earned_on date not null default current_date,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_shop_idx on public.notifications (shop_id, created_at desc);

-- Auto-notifications
create or replace function public.notify_low_stock()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.tracks_stock and new.stock <= new.low_stock_at and (old.stock is null or old.stock > old.low_stock_at) then
    insert into public.notifications (shop_id, title, body, type, link)
    values (new.shop_id, 'Low stock', new.name || ' is down to ' || new.stock || ' ' || new.unit, 'warning', '/inventory');
  end if;
  return new;
end $$;

drop trigger if exists products_low_stock on public.products;
create trigger products_low_stock after update on public.products
  for each row execute function public.notify_low_stock();

create or replace function public.notify_credit_sale()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.credit_amount > 0 then
    insert into public.notifications (shop_id, title, body, type, link)
    values (new.shop_id, 'Credit sale', coalesce(new.customer_name, 'A customer') || ' owes ' || new.credit_amount, 'warning', '/customers');
  end if;
  return new;
end $$;

drop trigger if exists sales_credit on public.sales;
create trigger sales_credit after insert on public.sales
  for each row execute function public.notify_credit_sale();

-- ---------------------------------------------------------------------------
-- Production: combine input products into an output product
-- ---------------------------------------------------------------------------
create table if not exists public.production_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  output_product_id uuid not null references public.products(id) on delete cascade,
  output_qty numeric not null check (output_qty > 0),
  input_cost_total numeric not null default 0,
  inputs jsonb not null default '[]'::jsonb,
  note text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create or replace function public.complete_production(
  p_output_product_id uuid,
  p_output_qty numeric,
  p_inputs jsonb
)
returns public.production_batches
language plpgsql security definer set search_path = public as $$
declare
  v_shop_id uuid;
  v_user_id uuid;
  v_out public.products;
  v_item jsonb;
  v_prod public.products;
  v_qty numeric;
  v_cost_total numeric := 0;
  v_batch public.production_batches;
begin
  v_user_id := auth.uid();
  v_shop_id := public.my_shop_id();
  if v_shop_id is null then raise exception 'No shop found'; end if;
  if p_output_qty is null or p_output_qty <= 0 then raise exception 'Output quantity must be positive'; end if;
  if p_inputs is null or jsonb_array_length(p_inputs) = 0 then raise exception 'Add at least one input'; end if;

  select * into v_out from public.products where id = p_output_product_id and shop_id = v_shop_id for update;
  if not found then raise exception 'Output product not found'; end if;

  -- Validate inputs & total cost
  for v_item in select * from jsonb_array_elements(p_inputs) loop
    select * into v_prod from public.products where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id for update;
    if not found then raise exception 'Input product not found'; end if;
    v_qty := (v_item->>'quantity')::numeric;
    if v_qty <= 0 then raise exception 'Input quantity must be positive'; end if;
    if v_prod.tracks_stock and v_prod.stock < v_qty then
      raise exception 'Not enough % in stock (have %)', v_prod.name, v_prod.stock;
    end if;
    v_cost_total := v_cost_total + v_qty * coalesce(v_prod.buying_price, 0);
  end loop;

  -- Consume inputs
  for v_item in select * from jsonb_array_elements(p_inputs) loop
    select * into v_prod from public.products where id = (v_item->>'product_id')::uuid and shop_id = v_shop_id;
    v_qty := (v_item->>'quantity')::numeric;
    if v_prod.tracks_stock then
      update public.products set stock = stock - v_qty where id = v_prod.id;
      insert into public.stock_moves (shop_id, product_id, delta, stock_before, stock_after, reason, created_by)
      values (v_shop_id, v_prod.id, -v_qty, v_prod.stock, v_prod.stock - v_qty, 'production_in', v_user_id);
    end if;
  end loop;

  -- Produce output
  update public.products set stock = stock + p_output_qty,
    buying_price = round((v_cost_total / p_output_qty)::numeric, 4)
    where id = v_out.id;

  select stock into v_out.stock from public.products where id = v_out.id;
  insert into public.stock_moves (shop_id, product_id, delta, stock_before, stock_after, reason, created_by)
  values (v_shop_id, v_out.id, p_output_qty, v_out.stock - p_output_qty, v_out.stock, 'production_out', v_user_id);

  insert into public.production_batches (shop_id, output_product_id, output_qty, input_cost_total, inputs, created_by)
  values (v_shop_id, v_out.id, p_output_qty, v_cost_total, p_inputs, v_user_id)
  returning * into v_batch;

  return v_batch;
end $$;

-- ---------------------------------------------------------------------------
-- Recycle bin (soft delete with 7-day retention)
-- ---------------------------------------------------------------------------
create table if not exists public.recycle_bin (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  entity_type text not null check (entity_type in ('products','customers','expenses')),
  entity_id uuid not null,
  item_name text not null,
  original_data jsonb not null,
  deleted_by uuid references auth.users(id) on delete set null,
  deleted_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days')
);

create or replace function public.soft_delete(p_entity text, p_entity_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_shop uuid;
  v_row record;
  v_name text;
begin
  if public.my_role() not in ('owner', 'manager') then
    raise exception 'Only owners and managers can delete items';
  end if;
  if p_entity not in ('products','customers','expenses') then
    raise exception 'Unsupported entity';
  end if;
  v_shop := public.my_shop_id();

  if p_entity = 'products' then
    select * into v_row from public.products where id = p_entity_id and shop_id = v_shop;
    v_name := v_row.name;
  elsif p_entity = 'customers' then
    select * into v_row from public.customers where id = p_entity_id and shop_id = v_shop;
    v_name := v_row.name;
    if v_row.credit_balance > 0 then raise exception 'Customer still owes money'; end if;
  else
    select * into v_row from public.expenses where id = p_entity_id and shop_id = v_shop;
    v_name := v_row.title;
  end if;

  if v_row is null then raise exception 'Item not found'; end if;

  insert into public.recycle_bin (shop_id, entity_type, entity_id, item_name, original_data, deleted_by)
  values (v_shop, p_entity, p_entity_id, v_name, to_jsonb(v_row), auth.uid());

  execute format('delete from public.%I where id = %L and shop_id = %L', p_entity, p_entity_id, v_shop);
end $$;

create or replace function public.restore_from_bin(p_bin_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_row record;
begin
  if public.my_role() not in ('owner', 'manager') then
    raise exception 'Only owners and managers can restore items';
  end if;
  select * into v_row from public.recycle_bin
    where id = p_bin_id and shop_id = public.my_shop_id();
  if not found then raise exception 'Item not found'; end if;

  if v_row.entity_type = 'products' then
    insert into public.products select (jsonb_populate_record(null::public.products, v_row.original_data)).*;
  elsif v_row.entity_type = 'customers' then
    insert into public.customers select (jsonb_populate_record(null::public.customers, v_row.original_data)).*;
  else
    insert into public.expenses select (jsonb_populate_record(null::public.expenses, v_row.original_data)).*;
  end if;

  delete from public.recycle_bin where id = p_bin_id;
end $$;

create or replace function public.purge_from_bin(p_bin_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() not in ('owner', 'manager') then
    raise exception 'Only owners and managers can purge items';
  end if;
  delete from public.recycle_bin where id = p_bin_id and shop_id = public.my_shop_id();
end $$;

create or replace function public.cleanup_expired_bin()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  delete from public.recycle_bin where expires_at < now();
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- Row Level Security for all new tables
-- ---------------------------------------------------------------------------
alter table public.suppliers enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.staff enable row level security;
alter table public.attendance enable row level security;
alter table public.salary_payments enable row level security;
alter table public.assets enable row level security;
alter table public.todos enable row level security;
alter table public.appointments enable row level security;
alter table public.other_income enable row level security;
alter table public.notifications enable row level security;
alter table public.production_batches enable row level security;
alter table public.recycle_bin enable row level security;

-- Shop-scoped CRUD helper (all members)
-- Generic template only for tables that actually carry a shop_id column.
-- Tables keyed through a parent (order_items) get dedicated policies below.
do $$
declare t text;
begin
  foreach t in array array[
    'suppliers','supplier_payments','purchases','orders',
    'staff','attendance','salary_payments','assets','todos','appointments',
    'other_income','production_batches'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = t and column_name = 'shop_id'
    ) then
      execute format('drop policy if exists "%1$s_all" on public.%1$s;', t);
      execute format('create policy "%1$s_all" on public.%1$s for all to authenticated using (shop_id = public.my_shop_id()) with check (shop_id = public.my_shop_id());', t);
    end if;
  end loop;
end $$;

-- Purchase items follow their purchase
drop policy if exists "purchase_items_all" on public.purchase_items;
create policy "purchase_items_all" on public.purchase_items for all to authenticated
  using (exists (select 1 from public.purchases p where p.id = purchase_id and p.shop_id = public.my_shop_id()))
  with check (exists (select 1 from public.purchases p where p.id = purchase_id and p.shop_id = public.my_shop_id()));

-- Order items follow their order
drop policy if exists "order_items_all" on public.order_items;
create policy "order_items_all" on public.order_items for all to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.shop_id = public.my_shop_id()))
  with check (exists (select 1 from public.orders o where o.id = order_id and o.shop_id = public.my_shop_id()));

-- Notifications: read + mark read only
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications for select to authenticated
  using (shop_id = public.my_shop_id());
drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications for update to authenticated
  using (shop_id = public.my_shop_id());

-- Recycle bin: read for all, manage for owner/manager (RPCs enforce too)
drop policy if exists "recycle_bin_select" on public.recycle_bin;
create policy "recycle_bin_select" on public.recycle_bin for select to authenticated
  using (shop_id = public.my_shop_id());

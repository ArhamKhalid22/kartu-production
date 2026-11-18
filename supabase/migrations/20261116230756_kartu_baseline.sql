-- Kartu MVP schema for Supabase/Postgres.
-- Run in the Supabase SQL Editor. Never expose a service-role key in the browser.

create extension if not exists pgcrypto;

create table if not exists public.neighborhoods (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  city text not null default 'Vilnius',
  active boolean not null default true
);

insert into public.neighborhoods (slug, name, city) values
  ('naujamiestis', 'Naujamiestis', 'Vilnius'),
  ('snipiskes', 'Šnipiškės', 'Vilnius'),
  ('zverynas', 'Žvėrynas', 'Vilnius')
on conflict (slug) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Kartu naudotojas',
  phone text,
  role text not null default 'buyer' check (role in ('buyer', 'supplier', 'admin')),
  neighborhood_id uuid references public.neighborhoods(id),
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  public_name text not null,
  about text not null default '',
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  neighborhood_id uuid not null references public.neighborhoods(id),
  offer_type text not null check (offer_type in ('group_buy', 'surplus')),
  title text not null check (length(title) between 2 and 120),
  description text not null default '',
  price_cents integer not null check (price_cents > 0),
  unit text not null,
  stock integer not null check (stock > 0),
  minimum integer not null default 0 check (minimum >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0 and reserved_quantity <= stock),
  deadline timestamptz not null,
  pickup_address text not null,
  pickup_details text not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'open', 'minimum_reached', 'ready_for_pickup', 'completed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  check ((offer_type = 'surplus' and minimum = 0) or (offer_type = 'group_buy' and minimum between 1 and stock))
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  total_cents integer not null check (total_cents > 0),
  pickup_code text not null unique,
  status text not null default 'reserved' check (status in ('reserved', 'ready_for_pickup', 'completed', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists offers_neighborhood_status_deadline_idx on public.offers (neighborhood_id, status, deadline);
create index if not exists offers_supplier_status_idx on public.offers (supplier_id, status);
create index if not exists reservations_buyer_created_idx on public.reservations (buyer_id, created_at desc);
create index if not exists reservations_offer_idx on public.reservations (offer_id, status);

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare default_neighborhood uuid;
begin
  select id into default_neighborhood from public.neighborhoods where slug = 'naujamiestis' limit 1;
  insert into public.profiles (id, display_name, phone, neighborhood_id)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 'Kartu naudotojas'),
    nullif(trim(new.raw_user_meta_data ->> 'phone'), ''),
    default_neighborhood
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_kartu on auth.users;
create trigger on_auth_user_created_kartu
  after insert on auth.users
  for each row execute procedure public.create_profile_for_new_user();

create or replace function public.current_app_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid()
$$;

alter table public.neighborhoods enable row level security;
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.offers enable row level security;
alter table public.reservations enable row level security;

revoke all on public.neighborhoods, public.profiles, public.suppliers, public.offers, public.reservations from anon, authenticated;
grant select on public.neighborhoods to anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, phone, neighborhood_id) on public.profiles to authenticated;
grant select on public.suppliers, public.offers to anon, authenticated;
grant select on public.reservations to authenticated;

drop policy if exists neighborhoods_read_active on public.neighborhoods;
create policy neighborhoods_read_active on public.neighborhoods
  for select to anon, authenticated using (active = true);

drop policy if exists profiles_read_self_or_admin on public.profiles;
create policy profiles_read_self_or_admin on public.profiles
  for select to authenticated using (id = auth.uid() or public.current_app_role() = 'admin');
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists suppliers_read_public_or_owner on public.suppliers;
create policy suppliers_read_public_or_owner on public.suppliers
  for select to anon, authenticated
  using (approved = true or user_id = auth.uid() or public.current_app_role() = 'admin');

drop policy if exists offers_read_public_or_owner on public.offers;
create policy offers_read_public_or_owner on public.offers
  for select to anon, authenticated
  using (
    (status in ('open', 'minimum_reached') and deadline > now())
    or exists (select 1 from public.suppliers s where s.id = supplier_id and s.user_id = auth.uid())
    or public.current_app_role() = 'admin'
  );

drop policy if exists reservations_read_buyer_supplier_admin on public.reservations;
create policy reservations_read_buyer_supplier_admin on public.reservations
  for select to authenticated
  using (
    buyer_id = auth.uid()
    or public.current_app_role() = 'admin'
    or exists (
      select 1 from public.offers o join public.suppliers s on s.id = o.supplier_id
      where o.id = offer_id and s.user_id = auth.uid()
    )
  );

create or replace function public.create_reservation(p_offer_id uuid, p_quantity integer)
returns public.reservations
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_offer public.offers%rowtype;
  v_reservation public.reservations%rowtype;
  v_reserved integer;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'Choose a valid quantity'; end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.status not in ('open', 'minimum_reached') or v_offer.deadline <= now() then raise exception 'Offer is closed'; end if;
  if v_offer.reserved_quantity + p_quantity > v_offer.stock then raise exception 'Not enough stock'; end if;

  insert into public.reservations (offer_id, buyer_id, quantity, total_cents, pickup_code)
  values (v_offer.id, auth.uid(), p_quantity, v_offer.price_cents * p_quantity,
          'KT' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)))
  returning * into v_reservation;

  v_reserved := v_offer.reserved_quantity + p_quantity;
  update public.offers
    set reserved_quantity = v_reserved,
        status = case when offer_type = 'group_buy' and v_reserved >= minimum then 'minimum_reached' else status end
    where id = v_offer.id;
  return v_reservation;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_res public.reservations%rowtype; v_offer public.offers%rowtype; v_remaining integer;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found or v_res.buyer_id <> auth.uid() then raise exception 'Reservation not found'; end if;
  if v_res.status <> 'reserved' then raise exception 'Reservation cannot be cancelled'; end if;
  select * into v_offer from public.offers where id = v_res.offer_id for update;
  if v_offer.status not in ('open', 'minimum_reached') or v_offer.deadline <= now() then raise exception 'Offer is closed'; end if;
  update public.reservations set status = 'cancelled' where id = v_res.id;
  v_remaining := greatest(0, v_offer.reserved_quantity - v_res.quantity);
  update public.offers set reserved_quantity = v_remaining,
    status = case when offer_type = 'group_buy' and status = 'minimum_reached' and v_remaining < minimum then 'open' else status end
    where id = v_offer.id;
end;
$$;

create or replace function public.submit_offer(
  p_offer_type text, p_title text, p_description text, p_price_cents integer, p_unit text,
  p_stock integer, p_minimum integer, p_neighborhood_id uuid, p_deadline timestamptz,
  p_pickup_address text, p_pickup_details text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_supplier public.suppliers%rowtype; v_id uuid;
begin
  if auth.uid() is null or public.current_app_role() <> 'supplier' then raise exception 'Supplier account required'; end if;
  select * into v_supplier from public.suppliers where user_id = auth.uid() and approved = true;
  if not found then raise exception 'Supplier account is awaiting approval'; end if;
  if p_offer_type not in ('group_buy','surplus') then raise exception 'Invalid offer type'; end if;
  if p_price_cents <= 0 or p_stock <= 0 or p_title is null or length(trim(p_title)) < 2 then raise exception 'Invalid offer details'; end if;
  if p_offer_type = 'group_buy' and (p_minimum < 1 or p_minimum > p_stock) then raise exception 'Minimum must be between 1 and stock'; end if;
  if p_offer_type = 'surplus' then p_minimum := 0; end if;
  if p_deadline <= now() then raise exception 'Deadline must be in the future'; end if;
  insert into public.offers (supplier_id, neighborhood_id, offer_type, title, description, price_cents, unit, stock, minimum, deadline, pickup_address, pickup_details)
  values (v_supplier.id, p_neighborhood_id, p_offer_type, trim(p_title), coalesce(p_description,''), p_price_cents, trim(p_unit), p_stock, p_minimum, p_deadline, trim(p_pickup_address), trim(p_pickup_details))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_offer(p_offer_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'admin' then raise exception 'Admin account required'; end if;
  update public.offers set status = case when p_approve then 'open' else 'cancelled' end
    where id = p_offer_id and status = 'pending_approval';
  if not found then raise exception 'Pending offer not found'; end if;
end;
$$;

create or replace function public.supplier_mark_ready(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or public.current_app_role() <> 'supplier' then raise exception 'Supplier account required'; end if;
  update public.offers o set status = 'ready_for_pickup'
    where o.id = p_offer_id and o.status in ('open','minimum_reached')
      and exists (select 1 from public.suppliers s where s.id = o.supplier_id and s.user_id = auth.uid());
  if not found then raise exception 'Offer not found or cannot be marked ready'; end if;
  update public.reservations set status = 'ready_for_pickup'
    where offer_id = p_offer_id and status = 'reserved';
end;
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to anon, authenticated;
revoke all on function public.create_reservation(uuid, integer) from public, anon;
grant execute on function public.create_reservation(uuid, integer) to authenticated;
revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;
revoke all on function public.submit_offer(text, text, text, integer, text, integer, integer, uuid, timestamptz, text, text) from public, anon;
grant execute on function public.submit_offer(text, text, text, integer, text, integer, integer, uuid, timestamptz, text, text) to authenticated;
revoke all on function public.review_offer(uuid, boolean) from public, anon;
grant execute on function public.review_offer(uuid, boolean) to authenticated;
revoke all on function public.supplier_mark_ready(uuid) from public, anon;
grant execute on function public.supplier_mark_ready(uuid) to authenticated;

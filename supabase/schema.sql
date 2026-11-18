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
  user_id uuid unique references public.profiles(id) on delete set null,
  public_name text not null,
  about text not null default '',
  approved boolean not null default false,
  redacted_at timestamptz,
  constraint suppliers_redacted_fields check (redacted_at is null or (user_id is null and public_name = 'Former supplier' and about = '' and not approved)),
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
  redacted_at timestamptz,
  constraint offers_redacted_fields check (redacted_at is null or (title = 'Removed listing' and description = '' and unit = '' and pickup_address = '' and pickup_details = '' and status in ('completed', 'cancelled'))),
  status text not null default 'pending_approval'
    check (status in ('pending_approval', 'open', 'minimum_reached', 'ready_for_pickup', 'completed', 'cancelled', 'expired')),
  created_at timestamptz not null default now(),
  check ((offer_type = 'surplus' and minimum = 0) or (offer_type = 'group_buy' and minimum between 1 and stock))
);

create table if not exists public.reservations (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete restrict,
  buyer_id uuid references public.profiles(id) on delete set null,
  quantity integer not null check (quantity > 0),
  total_cents bigint not null check (total_cents > 0),
  idempotency_key uuid not null default gen_random_uuid(),
  pickup_code text unique,
  pickup_redacted_at timestamptz,
  status text not null default 'reserved' check (status in ('reserved', 'ready_for_pickup', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  constraint reservations_active_buyer_required check (buyer_id is not null or status in ('completed', 'cancelled')),
  constraint reservations_active_pickup_code_required check (status in ('completed', 'cancelled') or (pickup_code is not null and length(trim(pickup_code)) > 0)),
  constraint reservations_redacted_pickup check (pickup_redacted_at is null or (status in ('completed', 'cancelled') and pickup_code is null))
);

create table if not exists public.user_action_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('reservation', 'offer_submission')),
  occurred_at timestamptz not null default now()
);

create index if not exists offers_neighborhood_status_deadline_idx on public.offers (neighborhood_id, status, deadline);
create index if not exists offers_supplier_status_idx on public.offers (supplier_id, status);
create index if not exists reservations_buyer_created_idx on public.reservations (buyer_id, created_at desc);
create index if not exists reservations_offer_idx on public.reservations (offer_id, status);
create unique index if not exists reservations_buyer_idempotency_key_uidx on public.reservations (buyer_id, idempotency_key);
create index if not exists user_action_events_user_action_time_idx on public.user_action_events (user_id, action, occurred_at desc);
create index if not exists user_action_events_occurred_at_idx on public.user_action_events (occurred_at);

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

-- Per-user sliding-window limits for marketplace writes. The advisory lock
-- makes simultaneous calls for the same user/action observe one counter.
create or replace function public.enforce_user_action_limit(p_action text, p_limit integer, p_window interval)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_count integer;
begin
  if v_user_id is null then raise exception 'Sign in is required'; end if;
  if p_action not in ('reservation', 'offer_submission') or p_limit < 1 or p_window <= interval '0 seconds' then
    raise exception 'Invalid rate limit configuration';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || p_action, 0));
  delete from public.user_action_events where occurred_at < now() - interval '1 day';
  delete from public.user_action_events
    where user_id = v_user_id and action = p_action and occurred_at < now() - p_window;
  select count(*) into v_count from public.user_action_events
    where user_id = v_user_id and action = p_action and occurred_at >= now() - p_window;
  if v_count >= p_limit then raise exception 'Too many requests. Please wait and try again'; end if;
  insert into public.user_action_events (user_id, action) values (v_user_id, p_action);
end;
$$;

create or replace function public.limit_reservation_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if;
  if new.buyer_id is distinct from auth.uid() then raise exception 'Reservation owner must match the signed-in user'; end if;
  perform public.enforce_user_action_limit('reservation', 15, interval '5 minutes');
  return new;
end;
$$;

create or replace function public.limit_offer_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then return new; end if;
  if not exists (
    select 1 from public.suppliers s where s.id = new.supplier_id and s.user_id = auth.uid()
  ) then raise exception 'Supplier account required'; end if;
  perform public.enforce_user_action_limit('offer_submission', 5, interval '1 hour');
  return new;
end;
$$;

drop trigger if exists reservations_apply_rate_limit on public.reservations;
create trigger reservations_apply_rate_limit before insert on public.reservations
  for each row execute function public.limit_reservation_insert();
drop trigger if exists offers_apply_rate_limit on public.offers;
create trigger offers_apply_rate_limit before insert on public.offers
  for each row execute function public.limit_offer_insert();

alter table public.neighborhoods enable row level security;
alter table public.profiles enable row level security;
alter table public.suppliers enable row level security;
alter table public.offers enable row level security;
alter table public.reservations enable row level security;
alter table public.user_action_events enable row level security;

revoke all on public.neighborhoods, public.profiles, public.suppliers, public.offers, public.reservations, public.user_action_events from anon, authenticated;
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

-- A buyer with a reservation must retain access to its pickup details after the
-- public offer closes. The definer helper checks the caller's reservation
-- without making the offers and reservations RLS policies depend on each other.
create or replace function public.buyer_has_reservation_for_offer(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1
    from public.reservations r
    where r.offer_id = p_offer_id
      and r.buyer_id = auth.uid()
  )
$$;
revoke all on function public.buyer_has_reservation_for_offer(uuid) from public, anon, authenticated;
grant execute on function public.buyer_has_reservation_for_offer(uuid) to anon, authenticated;

drop policy if exists offers_read_public_or_owner on public.offers;
create policy offers_read_public_or_owner on public.offers
  for select to anon, authenticated
  using (
    (status in ('open', 'minimum_reached') and deadline > now())
    or exists (select 1 from public.suppliers s where s.id = supplier_id and s.user_id = auth.uid())
    or public.buyer_has_reservation_for_offer(id)
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

-- BEGIN ORDER 1 FUNCTIONS (also used in the fresh-install schema).
create schema if not exists kartu_private;
revoke all on schema kartu_private from public, anon, authenticated, service_role;
create table if not exists kartu_private.lifecycle_guard (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0
);
revoke all on kartu_private.lifecycle_guard from public, anon, authenticated, service_role;
insert into kartu_private.lifecycle_guard (singleton) values (true) on conflict do nothing;

-- All write RPCs require fresh snapshots after a lock wait. Explicitly reject
-- stronger isolation rather than making decisions from a stale snapshot.
create or replace function kartu_private.require_read_committed()
returns void language plpgsql set search_path = '' as $$
begin
  if current_setting('transaction_isolation') <> 'read committed' then
    raise exception 'Marketplace writes require READ COMMITTED isolation';
  end if;
end;
$$;

-- A shared profile lock permits ordinary parallel actions but excludes deletion.
create or replace function kartu_private.lock_account(p_role text default null)
returns public.profiles language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_profile public.profiles%rowtype;
begin
  perform kartu_private.require_read_committed();
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for share;
  if p_role = 'supplier' and (v_profile.id is null or v_profile.role is distinct from p_role) then
    raise exception 'Supplier account required';
  elsif p_role = 'admin' and (v_profile.id is null or v_profile.role is distinct from p_role) then
    raise exception 'Admin account required';
  elsif v_profile.id is null then
    raise exception 'Account not found';
  end if;
  return v_profile;
end;
$$;

-- Discover IDs without locks, then lock supplier -> offer and validate again.
-- Supplier deletion exclusively locks the same supplier row before its checks.
create or replace function kartu_private.lock_offer(p_offer_id uuid, p_require_active_supplier boolean default false)
returns public.offers language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_supplier_id uuid; v_supplier public.suppliers%rowtype; v_offer public.offers%rowtype;
begin
  select supplier_id into v_supplier_id from public.offers where id = p_offer_id;
  if not found then raise exception 'Offer not found'; end if;
  select * into v_supplier from public.suppliers where id = v_supplier_id for share;
  if not found then raise exception 'Offer not found'; end if;
  if p_require_active_supplier and (v_supplier.user_id is null or not v_supplier.approved or v_supplier.redacted_at is not null) then
    raise exception 'Supplier is unavailable';
  end if;
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  if v_offer.supplier_id is distinct from v_supplier_id then raise exception 'Offer changed. Please try again'; end if;
  return v_offer;
end;
$$;

-- SQL-operator-only role changes, including bootstrap. Take the guard BEFORE
-- any profile row lock, just like delete_my_account. Not exposed as a REST RPC.
create or replace function kartu_private.set_account_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_profile public.profiles%rowtype;
begin
  perform kartu_private.require_read_committed();
  if p_role is null or p_role not in ('buyer', 'supplier', 'admin') then raise exception 'Invalid role'; end if;
  update kartu_private.lifecycle_guard set revision = revision + 1 where singleton;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  if v_profile.role = 'admin' and p_role <> 'admin' and
    (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'The last admin cannot be demoted';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

create or replace function public.create_reservation(p_offer_id uuid, p_quantity integer, p_idempotency_key uuid)
returns public.reservations language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_offer public.offers%rowtype; v_reservation public.reservations%rowtype; v_reserved integer;
begin
  perform kartu_private.lock_account();
  if p_idempotency_key is null then raise exception 'A request key is required'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'Choose a valid quantity'; end if;
  select * into v_reservation from public.reservations where buyer_id = auth.uid() and idempotency_key = p_idempotency_key;
  if found then
    if v_reservation.offer_id <> p_offer_id or v_reservation.quantity <> p_quantity then
      raise exception 'Request key was already used for a different reservation';
    end if;
    return v_reservation;
  end if;
  v_offer := kartu_private.lock_offer(p_offer_id, true);
  select * into v_reservation from public.reservations where buyer_id = auth.uid() and idempotency_key = p_idempotency_key;
  if found then
    if v_reservation.offer_id <> p_offer_id or v_reservation.quantity <> p_quantity then
      raise exception 'Request key was already used for a different reservation';
    end if;
    return v_reservation;
  end if;
  if v_offer.status not in ('open', 'minimum_reached') or v_offer.deadline <= clock_timestamp() then raise exception 'Offer is closed'; end if;
  if v_offer.reserved_quantity + p_quantity > v_offer.stock then raise exception 'Not enough stock'; end if;
  insert into public.reservations (offer_id, buyer_id, quantity, total_cents, pickup_code, idempotency_key)
    values (v_offer.id, auth.uid(), p_quantity, v_offer.price_cents::bigint * p_quantity,
      'KT' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), p_idempotency_key)
    on conflict (buyer_id, idempotency_key) do nothing returning * into v_reservation;
  if not found then
    select * into v_reservation from public.reservations where buyer_id = auth.uid() and idempotency_key = p_idempotency_key;
    if not found then raise exception 'Could not finish reservation'; end if;
    if v_reservation.offer_id <> p_offer_id or v_reservation.quantity <> p_quantity then
      raise exception 'Request key was already used for a different reservation';
    end if;
    return v_reservation;
  end if;
  v_reserved := v_offer.reserved_quantity + p_quantity;
  update public.offers set reserved_quantity = v_reserved,
    status = case when offer_type = 'group_buy' and v_reserved >= minimum then 'minimum_reached' else status end
    where id = v_offer.id;
  return v_reservation;
end;
$$;

create or replace function public.cancel_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_res public.reservations%rowtype; v_offer public.offers%rowtype; v_offer_id uuid; v_remaining integer;
begin
  perform kartu_private.lock_account();
  select offer_id into v_offer_id from public.reservations where id = p_reservation_id and buyer_id = auth.uid();
  if not found then raise exception 'Reservation not found'; end if;
  v_offer := kartu_private.lock_offer(v_offer_id);
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found or v_res.buyer_id is distinct from auth.uid() or v_res.offer_id is distinct from v_offer.id then
    raise exception 'Reservation not found';
  end if;
  if v_res.status <> 'reserved' then raise exception 'Reservation cannot be cancelled'; end if;
  if v_offer.status not in ('open', 'minimum_reached') or v_offer.deadline <= clock_timestamp() then raise exception 'Offer is closed'; end if;
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
returns uuid language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_supplier public.suppliers%rowtype; v_id uuid;
begin
  perform kartu_private.lock_account('supplier');
  select * into v_supplier from public.suppliers where user_id = auth.uid() for share;
  if not found or not v_supplier.approved or v_supplier.redacted_at is not null then raise exception 'Supplier account is awaiting approval'; end if;
  if p_offer_type not in ('group_buy', 'surplus') then raise exception 'Invalid offer type'; end if;
  if p_price_cents <= 0 or p_stock <= 0 or p_title is null or length(trim(p_title)) < 2 then raise exception 'Invalid offer details'; end if;
  if p_offer_type = 'group_buy' and (p_minimum < 1 or p_minimum > p_stock) then raise exception 'Minimum must be between 1 and stock'; end if;
  if p_offer_type = 'surplus' then p_minimum := 0; end if;
  if p_deadline <= clock_timestamp() then raise exception 'Deadline must be in the future'; end if;
  insert into public.offers (supplier_id, neighborhood_id, offer_type, title, description, price_cents, unit, stock, minimum, deadline, pickup_address, pickup_details)
    values (v_supplier.id, p_neighborhood_id, p_offer_type, trim(p_title), coalesce(p_description, ''), p_price_cents,
      trim(p_unit), p_stock, p_minimum, p_deadline, trim(p_pickup_address), trim(p_pickup_details)) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.review_offer(p_offer_id uuid, p_approve boolean)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_offer public.offers%rowtype;
begin
  perform kartu_private.lock_account('admin');
  v_offer := kartu_private.lock_offer(p_offer_id, p_approve is true);
  if v_offer.status <> 'pending_approval' then raise exception 'Pending offer not found'; end if;
  update public.offers set status = case when p_approve then 'open' else 'cancelled' end where id = p_offer_id;
end;
$$;

create or replace function public.supplier_mark_ready(p_offer_id uuid)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_offer public.offers%rowtype;
begin
  perform kartu_private.lock_account('supplier');
  v_offer := kartu_private.lock_offer(p_offer_id);
  if v_offer.status not in ('open', 'minimum_reached') or not exists (
    select 1 from public.suppliers where id = v_offer.supplier_id and user_id = auth.uid()
  ) then raise exception 'Offer not found or cannot be marked ready'; end if;
  update public.offers set status = 'ready_for_pickup' where id = p_offer_id;
  perform id from public.reservations where offer_id = p_offer_id and status = 'reserved' order by id for update;
  update public.reservations set status = 'ready_for_pickup' where offer_id = p_offer_id and status = 'reserved';
end;
$$;

create or replace function public.supplier_complete_reservation(p_reservation_id uuid)
returns void language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_offer_id uuid; v_offer public.offers%rowtype; v_res public.reservations%rowtype;
begin
  perform kartu_private.lock_account('supplier');
  select offer_id into v_offer_id from public.reservations where id = p_reservation_id;
  if not found then raise exception 'Reservation not found'; end if;
  v_offer := kartu_private.lock_offer(v_offer_id);
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found or v_res.offer_id is distinct from v_offer.id or not exists (
    select 1 from public.suppliers where id = v_offer.supplier_id and user_id = auth.uid()
  ) then raise exception 'Reservation not found'; end if;
  if v_res.status <> 'ready_for_pickup' then raise exception 'Reservation is not ready to complete'; end if;
  update public.reservations set status = 'completed' where id = v_res.id;
end;
$$;

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' set lock_timeout = '3s' as $$
declare v_user_id uuid := auth.uid(); v_profile public.profiles%rowtype; v_supplier_id uuid; v_time timestamptz := clock_timestamp();
begin
  perform kartu_private.require_read_committed();
  if v_user_id is null then raise exception 'Sign in is required'; end if;
  update kartu_private.lifecycle_guard set revision = revision + 1 where singleton;
  select * into v_profile from public.profiles where id = v_user_id for update;
  if not found then
    -- A retry after a committed deletion is successful. A broken live account is not.
    if not exists (select 1 from auth.users where id = v_user_id) then return; end if;
    raise exception 'Account not found';
  end if;
  if v_profile.role = 'admin' and (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'The last admin cannot delete its own account';
  end if;
  select id into v_supplier_id from public.suppliers where user_id = v_user_id for update;
  if v_supplier_id is not null then
    perform id from public.offers where supplier_id = v_supplier_id order by id for update;
  end if;
  perform r.id from public.reservations r where r.buyer_id = v_user_id
    or r.offer_id in (select id from public.offers where supplier_id = v_supplier_id) order by r.id for update;
  if exists (select 1 from public.reservations where buyer_id = v_user_id and status in ('reserved', 'ready_for_pickup')) then
    raise exception 'Active reservations must be completed or cancelled before account deletion';
  end if;
  if exists (select 1 from public.reservations r join public.offers o on o.id = r.offer_id
    where o.supplier_id = v_supplier_id and r.status in ('reserved', 'ready_for_pickup')) then
    raise exception 'Supplier orders must be completed before account deletion';
  end if;
  update public.reservations set pickup_code = null, pickup_redacted_at = coalesce(pickup_redacted_at, v_time)
    where buyer_id = v_user_id or offer_id in (select id from public.offers where supplier_id = v_supplier_id);
  if v_supplier_id is not null then
    update public.offers set title = 'Removed listing', description = '', unit = '', pickup_address = '', pickup_details = '',
      redacted_at = coalesce(redacted_at, v_time), status = case when status = 'completed' then status else 'cancelled' end
      where supplier_id = v_supplier_id;
    update public.suppliers set user_id = null, public_name = 'Former supplier', about = '', approved = false,
      redacted_at = coalesce(redacted_at, v_time) where id = v_supplier_id;
  end if;
  delete from auth.users where id = v_user_id;
  if not found then raise exception 'Account not found'; end if;
end;
$$;

revoke all on all functions in schema kartu_private from public, anon, authenticated, service_role;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
-- END ORDER 1 FUNCTIONS.

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to anon, authenticated;
revoke all on function public.create_reservation(uuid, integer, uuid) from public, anon;
grant execute on function public.create_reservation(uuid, integer, uuid) to authenticated;
revoke all on function public.cancel_reservation(uuid) from public, anon;
grant execute on function public.cancel_reservation(uuid) to authenticated;
revoke all on function public.submit_offer(text, text, text, integer, text, integer, integer, uuid, timestamptz, text, text) from public, anon;
grant execute on function public.submit_offer(text, text, text, integer, text, integer, integer, uuid, timestamptz, text, text) to authenticated;
revoke all on function public.review_offer(uuid, boolean) from public, anon;
grant execute on function public.review_offer(uuid, boolean) to authenticated;
revoke all on function public.supplier_mark_ready(uuid) from public, anon;
grant execute on function public.supplier_mark_ready(uuid) to authenticated;
revoke all on function public.supplier_complete_reservation(uuid) from public, anon;
grant execute on function public.supplier_complete_reservation(uuid) to authenticated;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
revoke all on function public.enforce_user_action_limit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.limit_reservation_insert() from public, anon, authenticated;
revoke all on function public.limit_offer_insert() from public, anon, authenticated;

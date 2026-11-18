-- Give each buyer request a stable identity so retrying it cannot reserve twice.
alter table public.reservations
  add column if not exists idempotency_key uuid;

update public.reservations
  set idempotency_key = gen_random_uuid()
  where idempotency_key is null;

alter table public.reservations
  alter column idempotency_key set default gen_random_uuid(),
  alter column idempotency_key set not null,
  alter column total_cents type bigint using total_cents::bigint;

create unique index if not exists reservations_buyer_idempotency_key_uidx
  on public.reservations (buyer_id, idempotency_key);

-- Remove the old RPC signature so clients cannot bypass idempotency.
drop function if exists public.create_reservation(uuid, integer);

create function public.create_reservation(p_offer_id uuid, p_quantity integer, p_idempotency_key uuid)
returns public.reservations
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers%rowtype;
  v_reservation public.reservations%rowtype;
  v_reserved integer;
begin
  if auth.uid() is null then raise exception 'Sign in is required'; end if;
  if p_idempotency_key is null then raise exception 'A request key is required'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'Choose a valid quantity'; end if;

  select * into v_reservation
    from public.reservations
    where buyer_id = auth.uid() and idempotency_key = p_idempotency_key;
  if found then
    if v_reservation.offer_id <> p_offer_id or v_reservation.quantity <> p_quantity then
      raise exception 'Request key was already used for a different reservation';
    end if;
    return v_reservation;
  end if;

  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;

  -- Recheck after waiting for the offer lock, so concurrent retries do not
  -- decrement stock or create a second reservation.
  select * into v_reservation
    from public.reservations
    where buyer_id = auth.uid() and idempotency_key = p_idempotency_key;
  if found then
    if v_reservation.offer_id <> p_offer_id or v_reservation.quantity <> p_quantity then
      raise exception 'Request key was already used for a different reservation';
    end if;
    return v_reservation;
  end if;

  if v_offer.status not in ('open', 'minimum_reached') or v_offer.deadline <= now() then raise exception 'Offer is closed'; end if;
  if v_offer.reserved_quantity + p_quantity > v_offer.stock then raise exception 'Not enough stock'; end if;

  insert into public.reservations (offer_id, buyer_id, quantity, total_cents, pickup_code, idempotency_key)
  values (v_offer.id, auth.uid(), p_quantity, v_offer.price_cents::bigint * p_quantity,
          'KT' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)), p_idempotency_key)
  on conflict (buyer_id, idempotency_key) do nothing
  returning * into v_reservation;

  if not found then
    select * into v_reservation
      from public.reservations
      where buyer_id = auth.uid() and idempotency_key = p_idempotency_key;
    if not found then raise exception 'Could not finish reservation'; end if;
    if v_reservation.offer_id <> p_offer_id or v_reservation.quantity <> p_quantity then
      raise exception 'Request key was already used for a different reservation';
    end if;
    return v_reservation;
  end if;

  v_reserved := v_offer.reserved_quantity + p_quantity;
  update public.offers
    set reserved_quantity = v_reserved,
        status = case when offer_type = 'group_buy' and v_reserved >= minimum then 'minimum_reached' else status end
    where id = v_offer.id;
  return v_reservation;
end;
$$;

revoke all on function public.create_reservation(uuid, integer, uuid) from public, anon;
grant execute on function public.create_reservation(uuid, integer, uuid) to authenticated;

create or replace function public.supplier_complete_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_offer_id uuid; v_offer public.offers%rowtype; v_res public.reservations%rowtype;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'supplier' then
    raise exception 'Supplier account required';
  end if;
  select offer_id into v_offer_id from public.reservations where id = p_reservation_id;
  if not found then raise exception 'Reservation not found'; end if;
  select * into v_offer from public.offers where id = v_offer_id for update;
  select * into v_res from public.reservations where id = p_reservation_id for update;
  if not found or not exists (
    select 1 from public.suppliers s where s.id = v_offer.supplier_id and s.user_id = auth.uid()
  ) then raise exception 'Reservation not found'; end if;
  if v_res.status <> 'ready_for_pickup' then raise exception 'Reservation is not ready to complete'; end if;
  update public.reservations set status = 'completed' where id = v_res.id;
end;
$$;

revoke all on function public.supplier_complete_reservation(uuid) from public, anon;
grant execute on function public.supplier_complete_reservation(uuid) to authenticated;

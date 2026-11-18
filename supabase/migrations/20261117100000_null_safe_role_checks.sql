-- SQL comparisons against NULL do not evaluate as true inside IF conditions.
-- Reject tokens whose profile is missing instead of treating a NULL role as allowed.
create or replace function public.submit_offer(
  p_offer_type text, p_title text, p_description text, p_price_cents integer, p_unit text,
  p_stock integer, p_minimum integer, p_neighborhood_id uuid, p_deadline timestamptz,
  p_pickup_address text, p_pickup_details text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_supplier public.suppliers%rowtype; v_id uuid;
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'supplier' then
    raise exception 'Supplier account required';
  end if;
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
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'admin' then
    raise exception 'Admin account required';
  end if;
  update public.offers set status = case when p_approve then 'open' else 'cancelled' end
    where id = p_offer_id and status = 'pending_approval';
  if not found then raise exception 'Pending offer not found'; end if;
end;
$$;

create or replace function public.supplier_mark_ready(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_app_role() is distinct from 'supplier' then
    raise exception 'Supplier account required';
  end if;
  update public.offers o set status = 'ready_for_pickup'
    where o.id = p_offer_id and o.status in ('open','minimum_reached')
      and exists (select 1 from public.suppliers s where s.id = o.supplier_id and s.user_id = auth.uid());
  if not found then raise exception 'Offer not found or cannot be marked ready'; end if;
  update public.reservations set status = 'ready_for_pickup'
    where offer_id = p_offer_id and status = 'reserved';
end;
$$;

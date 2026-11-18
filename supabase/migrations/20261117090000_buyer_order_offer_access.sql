-- Buyers need their existing offer's pickup instructions after it is no longer public.
-- The SECURITY DEFINER helper avoids an offers <-> reservations RLS recursion.
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

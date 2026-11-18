-- Allow self-service Auth deletion while retaining history without its profile link.
alter table public.suppliers alter column user_id drop not null;
alter table public.suppliers drop constraint suppliers_user_id_fkey;
alter table public.suppliers add constraint suppliers_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete set null;

alter table public.reservations alter column buyer_id drop not null;
alter table public.reservations drop constraint reservations_buyer_id_fkey;
alter table public.reservations add constraint reservations_buyer_id_fkey
  foreign key (buyer_id) references public.profiles(id) on delete set null;

create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_supplier_id uuid;
begin
  if v_user_id is null then raise exception 'Sign in is required'; end if;
  if public.current_app_role() = 'admin' and
     (select count(*) from public.profiles where role = 'admin') <= 1 then
    raise exception 'The last admin cannot delete its own account';
  end if;
  if exists (
    select 1 from public.reservations r
    where r.buyer_id = v_user_id and r.status in ('reserved', 'ready_for_pickup')
  ) then
    raise exception 'Active reservations must be completed or cancelled before account deletion';
  end if;

  select s.id into v_supplier_id from public.suppliers s where s.user_id = v_user_id for update;
  if v_supplier_id is not null then
    if exists (
      select 1 from public.reservations r
      join public.offers o on o.id = r.offer_id
      where o.supplier_id = v_supplier_id and r.status in ('reserved', 'ready_for_pickup')
    ) then
      raise exception 'Supplier orders must be completed before account deletion';
    end if;
    update public.offers set status = 'cancelled'
      where supplier_id = v_supplier_id and status not in ('completed', 'cancelled');
    update public.suppliers set public_name = 'Former supplier', about = '', approved = false
      where id = v_supplier_id;
  end if;

  delete from auth.users where id = v_user_id;
  if not found then raise exception 'Account not found'; end if;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

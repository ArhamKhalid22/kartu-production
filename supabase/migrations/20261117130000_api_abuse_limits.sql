create table public.user_action_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('reservation', 'offer_submission')),
  occurred_at timestamptz not null default now()
);
create index user_action_events_user_action_time_idx
  on public.user_action_events (user_id, action, occurred_at desc);
alter table public.user_action_events enable row level security;
revoke all on public.user_action_events from public, anon, authenticated;

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

revoke all on function public.enforce_user_action_limit(text, integer, interval) from public, anon, authenticated;
revoke all on function public.limit_reservation_insert() from public, anon, authenticated;
revoke all on function public.limit_offer_insert() from public, anon, authenticated;

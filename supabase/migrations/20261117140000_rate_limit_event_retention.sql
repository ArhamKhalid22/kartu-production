create index user_action_events_occurred_at_idx on public.user_action_events (occurred_at);

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

revoke all on function public.enforce_user_action_limit(text, integer, interval) from public, anon, authenticated;

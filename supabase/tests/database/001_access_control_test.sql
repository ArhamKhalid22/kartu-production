-- Run with `supabase test db` against the local stack only.
-- Fixtures are created as postgres; every access assertion runs as anon/authenticated.
-- UUIDs and example.test addresses are synthetic. Everything is rolled back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
select is((select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname in ('profiles', 'suppliers', 'offers', 'reservations', 'neighborhoods', 'user_action_events')
    and c.relrowsecurity), 6::bigint, 'All application tables have RLS enabled');

insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000001', 'buyer-a@example.test', '{"display_name":"Buyer A"}'),
  ('10000000-0000-0000-0000-000000000002', 'buyer-b@example.test', '{"display_name":"Buyer B"}'),
  ('10000000-0000-0000-0000-000000000003', 'supplier-a@example.test', '{"display_name":"Supplier A"}'),
  ('10000000-0000-0000-0000-000000000004', 'supplier-b@example.test', '{"display_name":"Supplier B"}'),
  ('10000000-0000-0000-0000-000000000005', 'admin@example.test', '{"display_name":"Admin"}');
insert into auth.users (id, email, raw_user_meta_data) values
  ('10000000-0000-0000-0000-000000000006', 'deleted-buyer@example.test', '{"display_name":"Deleted Buyer"}'),
  ('10000000-0000-0000-0000-000000000007', 'active-buyer@example.test', '{"display_name":"Active Buyer"}'),
  ('10000000-0000-0000-0000-000000000008', 'deleted-supplier@example.test', '{"display_name":"Deleted Supplier"}');
update public.profiles set role = 'supplier'
  where id in ('10000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000008');
update public.profiles set role = 'admin' where id = '10000000-0000-0000-0000-000000000005';
insert into public.suppliers (id, user_id, public_name, approved) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'Supplier A', true),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004', 'Supplier B', true),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000008', 'Supplier C', true);
insert into public.offers
  (id, supplier_id, neighborhood_id, offer_type, title, price_cents, unit, stock, minimum, reserved_quantity, deadline, pickup_address, pickup_details, status)
select f.id::uuid, f.supplier_id::uuid, n.id, 'group_buy', f.title, 250, 'bag', 10, 3,
  f.reserved, now() + f.deadline_offset, 'Test pickup point', 'Test pickup window', f.status
from (values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Open A', 2, interval '2 days', 'open'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Open B', 1, interval '2 days', 'open'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Pending A', 0, interval '2 days', 'pending_approval'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Pending B', 0, interval '2 days', 'pending_approval'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', 'Expired A', 0, interval '-1 day', 'open'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', 'Missing profile approve', 0, interval '2 days', 'pending_approval'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', 'Missing profile reject', 0, interval '2 days', 'pending_approval'),
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000002', 'Collected B', 1, interval '-1 day', 'ready_for_pickup')
) f(id, supplier_id, title, reserved, deadline_offset, status)
cross join public.neighborhoods n where n.slug = 'naujamiestis';
insert into public.offers
  (id, supplier_id, neighborhood_id, offer_type, title, price_cents, unit, stock, minimum, deadline, pickup_address, pickup_details, status)
select '30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000003', n.id,
  'group_buy', 'Supplier C offer', 200, 'bag', 10, 2, now() + interval '2 days', 'Test point', 'Test time', 'open'
from public.neighborhoods n where n.slug = 'naujamiestis';
insert into public.offers
  (id, supplier_id, neighborhood_id, offer_type, title, price_cents, unit, stock, minimum, deadline, pickup_address, pickup_details, status)
select '30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000003', n.id,
  'group_buy', 'Reservation rate limit', 200, 'bag', 20, 20, now() + interval '2 days', 'Test point', 'Test time', 'open'
from public.neighborhoods n where n.slug = 'naujamiestis';
insert into public.reservations (id, offer_id, buyer_id, quantity, total_cents, pickup_code) values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 250, 'TEST-A'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 1, 250, 'TEST-B'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1, 250, 'TEST-B-OTHER');
insert into public.reservations (id, offer_id, buyer_id, quantity, total_cents, pickup_code, status) values
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000001', 1, 250, 'TEST-CLOSED-A', 'ready_for_pickup'),
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000006', 1, 250, 'TEST-DELETED-HISTORY', 'completed'),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000007', 1, 250, 'TEST-ACTIVE-ORDER', 'ready_for_pickup');

-- Anonymous: visible public rows, hidden drafts/expired rows, no private data/mutations.
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select ok((select not rolsuper and not rolbypassrls from pg_roles where rolname = current_user),
  'Anonymous assertions run without superuser or RLS bypass');
select is((select count(*) from public.offers), 4::bigint, 'Anonymous visitors see public open offers only');
select is((select count(*) from public.offers where status = 'pending_approval'), 0::bigint, 'Anonymous visitors cannot see pending offers');
select throws_ok($$select * from public.reservations$$, '42501', null::text, 'Anonymous visitors cannot read reservations');
select throws_ok($$select * from public.user_action_events$$, '42501', null::text, 'Anonymous visitors cannot read rate-limit events');
select throws_ok($$select * from public.profiles$$, '42501', null::text, 'Anonymous visitors cannot read profiles');
select throws_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000001', 1, '50000000-0000-0000-0000-000000000001')$$,
  '42501', null::text, 'Anonymous visitors cannot create reservations');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000003', true)$$,
  '42501', null::text, 'Anonymous visitors cannot approve offers');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000003', false)$$,
  '42501', null::text, 'Anonymous visitors cannot reject offers');

-- Buyer A: real authenticated role and JWT subject, not a privileged test connection.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000001"}';
select ok((select not rolsuper and not rolbypassrls from pg_roles where rolname = current_user),
  'Authenticated assertions run without superuser or RLS bypass');
select is(auth.uid(), '10000000-0000-0000-0000-000000000001'::uuid, 'Buyer A identity is active');
select is((select count(*) from public.reservations), 2::bigint, 'Buyer A can read their own reservations');
select is((select count(*) from public.offers where id = '30000000-0000-0000-0000-000000000008'), 1::bigint,
  'Buyer A can read the closed offer needed for an existing pickup');
select is((select pickup_address from public.offers where id = '30000000-0000-0000-0000-000000000008'), 'Test pickup point',
  'Buyer A retains the pickup address after the offer closes');
select is((select count(*) from public.reservations where buyer_id = '10000000-0000-0000-0000-000000000002'), 0::bigint, 'Buyer A cannot read Buyer B reservations');
select throws_ok($$select public.cancel_reservation('40000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Reservation not found', 'Buyer A cannot cancel Buyer B reservation by known ID');
select throws_ok($$update public.profiles set role = 'admin' where id = auth.uid()$$,
  '42501', null::text, 'Buyer A cannot promote themselves to admin');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000003', true)$$,
  'P0001', 'Admin account required', 'Buyer A cannot approve offers');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000003', false)$$,
  'P0001', 'Admin account required', 'Buyer A cannot reject offers');
select throws_ok($$select public.supplier_mark_ready('30000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Supplier account required', 'Buyer A cannot act as a supplier');
select throws_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000001', 0, '50000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Choose a valid quantity', 'Zero quantity is rejected');
select throws_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000001', 20, '50000000-0000-0000-0000-000000000003')$$,
  'P0001', 'Not enough stock', 'Reservation cannot exceed stock');
select throws_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000005', 1, '50000000-0000-0000-0000-000000000004')$$,
  'P0001', 'Offer is closed', 'Past-deadline reservations are rejected');
select throws_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000003', 1, '50000000-0000-0000-0000-000000000005')$$,
  'P0001', 'Offer is closed', 'Pending offers cannot be reserved');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000001', 1, '50000000-0000-0000-0000-000000000001')$$,
  'Buyer A can create a valid reservation');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000001', 1, '50000000-0000-0000-0000-000000000001')$$,
  'Retrying the same request returns without creating a second reservation');
select is((select count(*) from public.reservations where buyer_id = auth.uid() and idempotency_key = '50000000-0000-0000-0000-000000000001'), 1::bigint,
  'One reservation is stored for the idempotency key');
select throws_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000001', 2, '50000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Request key was already used for a different reservation', 'A request key cannot be reused with a different quantity');
select is((select count(*) from public.reservations where buyer_id = auth.uid()), 3::bigint, 'New reservation belongs to Buyer A');
select is((select reserved_quantity from public.offers where id = '30000000-0000-0000-0000-000000000001'), 3, 'Reservation increments stock counter');
select is((select status from public.offers where id = '30000000-0000-0000-0000-000000000001'), 'minimum_reached', 'Reaching minimum updates offer status');
select ok((select bool_and(total_cents = quantity * 250) from public.reservations), 'Reservation totals are calculated by the database');
select lives_ok($$select public.cancel_reservation('40000000-0000-0000-0000-000000000001')$$,
  'Buyer A can cancel their own reservation after minimum is reached');
select is((select status from public.reservations where id = '40000000-0000-0000-0000-000000000001'), 'cancelled', 'Own reservation is cancelled');
select is((select reserved_quantity from public.offers where id = '30000000-0000-0000-0000-000000000001'), 2, 'Cancellation restores stock');
select is((select status from public.offers where id = '30000000-0000-0000-0000-000000000001'), 'open', 'Cancellation below minimum reopens group');
select throws_ok($$select public.cancel_reservation('40000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Reservation cannot be cancelled', 'Repeated cancellation is rejected');
select throws_ok($$update public.reservations set buyer_id = auth.uid() where id = '40000000-0000-0000-0000-000000000002'$$,
  '42501', null::text, 'Direct reservation mutation cannot bypass RPC permissions');
select throws_ok($$select * from public.user_action_events$$, '42501', null::text, 'Buyer cannot read rate-limit events');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000001')$$, 'First rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000002')$$, 'Second rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000003')$$, 'Third rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000004')$$, 'Fourth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000005')$$, 'Fifth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000006')$$, 'Sixth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000007')$$, 'Seventh rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000008')$$, 'Eighth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000009')$$, 'Ninth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000010')$$, 'Tenth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000011')$$, 'Eleventh rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000012')$$, 'Twelfth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000013')$$, 'Thirteenth rate-limited reservation is accepted');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000014')$$, 'Fourteenth rate-limited reservation is accepted');
select throws_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000015')$$,
  'P0001', 'Too many requests. Please wait and try again', 'Reservation submissions are capped at 15 per five minutes');
select lives_ok($$select public.create_reservation('30000000-0000-0000-0000-000000000010', 1, '60000000-0000-0000-0000-000000000001')$$,
  'An idempotent retry still succeeds after reaching the write limit');

-- Buyer B: isolation works in the other direction too; denied cancel left data intact.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000002"}';
select is((select count(*) from public.reservations), 2::bigint, 'Buyer B sees only their two reservations');
select is((select status from public.reservations where id = '40000000-0000-0000-0000-000000000002'), 'reserved', 'Denied cross-buyer cancellation left Buyer B order intact');
select is((select count(*) from public.reservations where buyer_id = '10000000-0000-0000-0000-000000000001'), 0::bigint, 'Buyer B cannot read Buyer A reservations');
select is((select count(*) from public.offers where id = '30000000-0000-0000-0000-000000000008'), 0::bigint,
  'Buyer B cannot read the closed offer attached to Buyer A reservation');
select throws_ok($$select public.cancel_reservation('40000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Reservation not found', 'Buyer B cannot cancel Buyer A reservation');

-- Supplier A: can submit offers, see own reservations and mark own offer ready.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000003"}';
select is((select count(*) from public.offers where id = '30000000-0000-0000-0000-000000000003'), 1::bigint, 'Supplier A can read their pending offer');
select is((select count(*) from public.offers where id = '30000000-0000-0000-0000-000000000004'), 0::bigint, 'Supplier A cannot read Supplier B pending offer');
select is((select count(*) from public.reservations where offer_id = '30000000-0000-0000-0000-000000000001'), 3::bigint, 'Supplier A can read reservations for their own offer');
select is((select count(*) from public.reservations where offer_id = '30000000-0000-0000-0000-000000000002'), 0::bigint, 'Supplier A cannot read another supplier reservations');
select lives_ok($$select public.submit_offer('group_buy', 'Supplier A submitted offer', 'Test', 300, 'bag', 10, 3,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$,
  'Approved supplier can submit a new offer');
select is((select status from public.offers where title = 'Supplier A submitted offer'), 'pending_approval', 'New supplier offer requires admin review');
select is((select supplier_id from public.offers where title = 'Supplier A submitted offer'),
  '20000000-0000-0000-0000-000000000001'::uuid, 'Submitted offer belongs to calling supplier');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000003', true)$$,
  'P0001', 'Admin account required', 'Supplier cannot approve their own offer');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000004', false)$$,
  'P0001', 'Admin account required', 'Supplier cannot reject another supplier offer');
select throws_ok($$select public.supplier_mark_ready('30000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Offer not found or cannot be marked ready', 'Supplier A cannot manage Supplier B offer');
select throws_ok($$update public.offers set status = 'ready_for_pickup' where id = '30000000-0000-0000-0000-000000000002'$$,
  '42501', null::text, 'Direct offer updates cannot bypass supplier ownership');
select lives_ok($$select public.supplier_mark_ready('30000000-0000-0000-0000-000000000001')$$,
  'Supplier A can mark their own offer ready');
select is((select status from public.offers where id = '30000000-0000-0000-0000-000000000001'), 'ready_for_pickup', 'Own offer becomes ready');
select is((select count(*) from public.reservations where offer_id = '30000000-0000-0000-0000-000000000001' and status = 'ready_for_pickup'),
  2::bigint, 'Only active reservations become ready');
select lives_ok($$select public.supplier_complete_reservation('40000000-0000-0000-0000-000000000002')$$,
  'Supplier A can mark a ready order collected for their own offer');
select is((select status from public.reservations where id = '40000000-0000-0000-0000-000000000002'), 'completed', 'Collected order is completed');
select throws_ok($$select public.supplier_complete_reservation('40000000-0000-0000-0000-000000000003')$$,
  'P0001', 'Reservation not found', 'Supplier A cannot complete another supplier reservation');
select is((select status from public.reservations where id = '40000000-0000-0000-0000-000000000001'), 'cancelled', 'Cancelled reservation is not revived');

-- Supplier B: positive ownership case for the second supplier, and reverse denial.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000004"}';
select is((select status from public.offers where id = '30000000-0000-0000-0000-000000000002'), 'open', 'Denied cross-supplier action left Supplier B offer intact');
select throws_ok($$select public.supplier_mark_ready('30000000-0000-0000-0000-000000000003')$$,
  'P0001', 'Offer not found or cannot be marked ready', 'Supplier B cannot manage Supplier A offer');
select lives_ok($$select public.supplier_mark_ready('30000000-0000-0000-0000-000000000002')$$,
  'Supplier B can mark their own offer ready');
select lives_ok($$select public.supplier_complete_reservation('40000000-0000-0000-0000-000000000003')$$,
  'Supplier B can complete a pickup on their own offer');

-- Supplier C can submit up to five offers per hour, then receives a bounded error.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000008"}';
select lives_ok($$select public.submit_offer('group_buy', 'Supplier C rate offer 1', 'Test', 200, 'bag', 10, 2,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$, 'Supplier offer one is accepted');
select lives_ok($$select public.submit_offer('group_buy', 'Supplier C rate offer 2', 'Test', 200, 'bag', 10, 2,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$, 'Supplier offer two is accepted');
select lives_ok($$select public.submit_offer('group_buy', 'Supplier C rate offer 3', 'Test', 200, 'bag', 10, 2,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$, 'Supplier offer three is accepted');
select lives_ok($$select public.submit_offer('group_buy', 'Supplier C rate offer 4', 'Test', 200, 'bag', 10, 2,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$, 'Supplier offer four is accepted');
select lives_ok($$select public.submit_offer('group_buy', 'Supplier C rate offer 5', 'Test', 200, 'bag', 10, 2,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$, 'Supplier offer five is accepted');
select throws_ok($$select public.submit_offer('group_buy', 'Supplier C rate offer 6', 'Test', 200, 'bag', 10, 2,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$,
  'P0001', 'Too many requests. Please wait and try again', 'Supplier submissions are capped at five per hour');

-- An authenticated subject without a profile must not inherit admin powers.
-- This models a still-valid token after its profile was removed.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000099"}';
select is(public.current_app_role(), null::text, 'Missing-profile subject has no application role');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000006', true)$$,
  'P0001', 'Admin account required', 'Missing-profile subject cannot approve offers');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000007', false)$$,
  'P0001', 'Admin account required', 'Missing-profile subject cannot reject offers');
select throws_ok($$select public.submit_offer('group_buy', 'Unprivileged offer', 'Test', 100, 'bag', 10, 3,
  (select id from public.neighborhoods where slug = 'naujamiestis'), now() + interval '2 days', 'Test point', 'Test time')$$,
  'P0001', 'Supplier account required', 'Missing-profile subject cannot submit supplier offers');
select throws_ok($$select public.supplier_mark_ready('30000000-0000-0000-0000-000000000001')$$,
  'P0001', 'Supplier account required', 'Missing-profile subject cannot mark supplier offers ready');
select throws_ok($$select public.supplier_complete_reservation('40000000-0000-0000-0000-000000000002')$$,
  'P0001', 'Supplier account required', 'Missing-profile subject cannot complete supplier orders');

-- Admin: both approve and reject work; all private reservations are readable.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000005"}';
select is(public.current_app_role(), 'admin', 'Admin identity is active');
select is((select count(*) from public.reservations), 21::bigint, 'Admin can read all reservations');
select throws_ok($$select public.delete_my_account()$$,
  'P0001', 'The last admin cannot delete its own account', 'The last admin cannot remove the only admin account');
select lives_ok($$select public.review_offer('30000000-0000-0000-0000-000000000003', true)$$,
  'Admin can approve an offer');
select is((select status from public.offers where id = '30000000-0000-0000-0000-000000000003'), 'open', 'Approved offer becomes public');
select lives_ok($$select public.review_offer('30000000-0000-0000-0000-000000000004', false)$$,
  'Admin can reject an offer');
select is((select status from public.offers where id = '30000000-0000-0000-0000-000000000004'), 'cancelled', 'Rejected offer is cancelled');
select throws_ok($$select public.review_offer('30000000-0000-0000-0000-000000000003', true)$$,
  'P0001', 'Pending offer not found', 'Review cannot silently overwrite an already reviewed offer');

-- Self-service deletion preserves de-identified completed orders and blocks active orders.
reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000006"}';
select lives_ok($$select public.delete_my_account()$$, 'Buyer can delete an account after resolving active orders');
select is((select count(*) from public.profiles where id = auth.uid()), 0::bigint, 'Deleted buyer profile is removed');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000007"}';
select throws_ok($$select public.delete_my_account()$$,
  'P0001', 'Active reservations must be completed or cancelled before account deletion', 'Buyer cannot delete an account with an active pickup');
select is((select count(*) from public.profiles where id = auth.uid()), 1::bigint, 'Blocked deletion retains the account profile');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000008"}';
select throws_ok($$select public.delete_my_account()$$,
  'P0001', 'Supplier orders must be completed before account deletion', 'Supplier cannot delete an account while buyers still have active pickups');
reset role;
update public.reservations set status = 'completed' where offer_id = '30000000-0000-0000-0000-000000000010';
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000008"}';
select lives_ok($$select public.delete_my_account()$$, 'Supplier can delete an account with no active orders');
select is((select count(*) from public.profiles where id = auth.uid()), 0::bigint, 'Deleted supplier profile is removed');

reset role;
set local role authenticated;
set local request.jwt.claims = '{"role":"authenticated","sub":"10000000-0000-0000-0000-000000000005"}';
select is((select count(*) from public.reservations where buyer_id is null), 1::bigint, 'Deleted buyer history remains without a profile link');
select is((select buyer_id from public.reservations where id = '40000000-0000-0000-0000-000000000005'), null::uuid,
  'Completed reservation no longer identifies the deleted buyer');
select is((select count(*) from public.profiles where id = '10000000-0000-0000-0000-000000000006'), 0::bigint,
  'Deleted buyer account cannot be recovered from its old profile');
select ok((select user_id is null and public_name = 'Former supplier' and not approved
  from public.suppliers where id = '20000000-0000-0000-0000-000000000003'), 'Deleted supplier record is detached and de-identified');
select is((select status from public.offers where id = '30000000-0000-0000-0000-000000000009'), 'cancelled',
  'Deleting a supplier closes their active listings');

reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
select is((select count(*) from public.offers where id = '30000000-0000-0000-0000-000000000003'), 1::bigint, 'Anonymous visitors can read newly approved offer');
select is((select count(*) from public.offers where id = '30000000-0000-0000-0000-000000000004'), 0::bigint, 'Anonymous visitors cannot read rejected offer');
select is((select count(*) from public.offers where id = '30000000-0000-0000-0000-000000000008'), 0::bigint,
  'Anonymous visitors cannot read closed offers through buyer reservation access');

reset role;
select * from finish();
rollback;

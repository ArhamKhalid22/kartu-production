-- Local only. All fixtures and the failure-injection trigger roll back.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data)
select ('91000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'deletion-' || n || '@example.test', '{"display_name":"Private test person","phone":"test-phone"}'::jsonb
from generate_series(1,6) n;
select kartu_private.set_account_role('91000000-0000-0000-0000-000000000001', 'admin');
select kartu_private.set_account_role('91000000-0000-0000-0000-000000000002', 'admin');
select kartu_private.set_account_role('91000000-0000-0000-0000-000000000003', 'supplier');
select kartu_private.set_account_role('91000000-0000-0000-0000-000000000004', 'supplier');
insert into public.suppliers (id,user_id,public_name,about,approved) values
 ('92000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000003','Private seller','Private contact',true),
 ('92000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000004','Other seller','Other contact',true);
insert into public.offers (id,supplier_id,neighborhood_id,offer_type,title,description,price_cents,unit,stock,minimum,deadline,pickup_address,pickup_details,status)
select ('93000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid,
 ('92000000-0000-0000-0000-' || lpad(n::text,12,'0'))::uuid, a.id,'group_buy',
 'Private seller text','Private description',250,'Private unit',20,2,now()+interval '2 days','Private address','Private instructions','open'
from generate_series(1,2) n cross join public.neighborhoods a where a.slug='naujamiestis';
insert into public.reservations (id,offer_id,buyer_id,quantity,total_cents,pickup_code,status) values
 ('94000000-0000-0000-0000-000000000001','93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000005',1,250,'DELETE-A','completed'),
 ('94000000-0000-0000-0000-000000000002','93000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000006',2,500,'DELETE-B','cancelled'),
 ('94000000-0000-0000-0000-000000000003','93000000-0000-0000-0000-000000000002','91000000-0000-0000-0000-000000000006',1,250,'DELETE-ACTIVE','reserved');

select throws_ok($$update public.reservations set buyer_id=null where id='94000000-0000-0000-0000-000000000003'$$,
 '23514',null::text,'An active reservation cannot lose its buyer');
select throws_ok($$update public.reservations set pickup_code=null where id='94000000-0000-0000-0000-000000000003'$$,
 '23514',null::text,'An active reservation cannot lose its pickup code');
select throws_ok($$delete from auth.users where id='91000000-0000-0000-0000-000000000006'$$,
 '23514',null::text,'Even a direct Auth deletion cannot detach an active buyer');
select lives_ok($$select kartu_private.set_account_role('91000000-0000-0000-0000-000000000002','buyer')$$,'Operator may demote one of two admins');
select throws_ok($$select kartu_private.set_account_role('91000000-0000-0000-0000-000000000001','buyer')$$,
 'P0001','The last admin cannot be demoted','Operator function protects the last admin');
select kartu_private.set_account_role('91000000-0000-0000-0000-000000000002','admin');

set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000005"}';
select throws_ok($$select kartu_private.set_account_role(auth.uid(),'admin')$$,'42501',null::text,'Clients cannot invoke the operator role setter');
select throws_ok($$select * from kartu_private.lifecycle_guard$$,'42501',null::text,'Clients cannot read the internal lifecycle guard');
select lives_ok($$select public.delete_my_account()$$,'Buyer with terminal history can delete');
select lives_ok($$select public.delete_my_account()$$,'Retry after a committed deletion is idempotent');
select throws_ok($$select public.create_reservation('93000000-0000-0000-0000-000000000002',1,gen_random_uuid())$$,
 'P0001','Account not found','Old JWT subject cannot reserve after deletion');
select is((select count(*) from public.profiles),0::bigint,'Old subject cannot read a private profile');
select is((select count(*) from public.reservations),0::bigint,'Old subject cannot read detached reservations');
reset role;
select is((select count(*) from auth.users where id='91000000-0000-0000-0000-000000000005'),0::bigint,'Auth account is removed');
select ok((select buyer_id is null and pickup_code is null and pickup_redacted_at is not null from public.reservations
 where id='94000000-0000-0000-0000-000000000001'),'Deleted buyer loses account link and old pickup code');
select is((select pickup_code from public.reservations where id='94000000-0000-0000-0000-000000000002'),'DELETE-B','Other buyer code is unchanged by buyer deletion');
select is((select pickup_address from public.offers where id='93000000-0000-0000-0000-000000000001'),'Private address','Buyer deletion does not erase an active supplier listing');

set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000003"}';
select lives_ok($$select public.delete_my_account()$$,'Supplier with terminal orders can delete');
select throws_ok($$select public.supplier_mark_ready('93000000-0000-0000-0000-000000000001')$$,
 'P0001','Supplier account required','Deleted supplier cannot mutate offers with an old subject');
reset role;
select ok((select user_id is null and public_name='Former supplier' and about='' and not approved and redacted_at is not null
 from public.suppliers where id='92000000-0000-0000-0000-000000000001'),'Supplier record is scrubbed and detached');
select ok((select title='Removed listing' and description='' and unit='' and pickup_address='' and pickup_details='' and redacted_at is not null
 and status='cancelled' from public.offers where id='93000000-0000-0000-0000-000000000001'),'Every supplier-authored text field is removed');
select ok((select buyer_id='91000000-0000-0000-0000-000000000006' and pickup_code is null and total_cents=500 and quantity=2
 from public.reservations where id='94000000-0000-0000-0000-000000000002'),'Other customer keeps ownership and amounts, without an old pickup code');
select is((select pickup_address from public.offers where id='93000000-0000-0000-0000-000000000002'),'Private address','Other supplier data remains intact');
select throws_ok($$update public.offers set pickup_address='Leaked address' where id='93000000-0000-0000-0000-000000000001'$$,
 '23514',null::text,'Redacted offers cannot regain pickup data accidentally');
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000006"}';
select is((select pickup_address from public.offers where id='93000000-0000-0000-0000-000000000001'),'','Past buyer sees only the redacted offer');
select is((select title from public.offers where id='93000000-0000-0000-0000-000000000001'),'Removed listing','Past buyer sees a safe history title');
select throws_ok($$select public.cancel_reservation('94000000-0000-0000-0000-000000000001')$$,
 'P0001','Reservation not found','Null buyer ownership never authorizes another account');
select throws_ok($$select public.delete_my_account()$$,
 'P0001','Active reservations must be completed or cancelled before account deletion','Active buyer deletion remains blocked');
set local request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000004"}';
select throws_ok($$select public.delete_my_account()$$,
 'P0001','Supplier orders must be completed before account deletion','Active supplier deletion remains blocked');
reset role;
select is((select pickup_address from public.offers where id='93000000-0000-0000-0000-000000000002'),'Private address','Blocked deletion does not scrub listings');
update public.reservations set status='completed' where id='94000000-0000-0000-0000-000000000003';
create function public.order1_test_delete_failure() returns trigger language plpgsql as $$
begin
 if old.id='91000000-0000-0000-0000-000000000004' then raise exception 'Injected deletion failure'; end if;
 return old;
end;
$$;
create trigger order1_test_delete_failure before delete on auth.users for each row execute function public.order1_test_delete_failure();
set local role authenticated;
select throws_ok($$select public.delete_my_account()$$,'P0001','Injected deletion failure','Failure after redaction aborts the whole deletion');
reset role;
select is((select count(*) from auth.users where id='91000000-0000-0000-0000-000000000004'),1::bigint,'Failed deletion preserves Auth account');
select ok((select user_id is not null and approved and redacted_at is null from public.suppliers
 where id='92000000-0000-0000-0000-000000000002'),'Failed deletion restores supplier identity');
select is((select pickup_address from public.offers where id='93000000-0000-0000-0000-000000000002'),'Private address','Failed deletion restores pickup data');
select is((select pickup_code from public.reservations where id='94000000-0000-0000-0000-000000000003'),'DELETE-ACTIVE','Failed deletion restores pickup code');
drop trigger order1_test_delete_failure on auth.users;
drop function public.order1_test_delete_failure();
set local role authenticated;
set local request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000001"}';
select lives_ok($$select public.delete_my_account()$$,'One of two administrators can delete');
set local request.jwt.claims='{"role":"authenticated","sub":"91000000-0000-0000-0000-000000000002"}';
select throws_ok($$select public.delete_my_account()$$,'P0001','The last admin cannot delete its own account','Remaining admin is protected');
reset role;
select * from finish();
rollback;

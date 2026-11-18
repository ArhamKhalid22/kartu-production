#!/usr/bin/env python3
"""Order 1 tests using real, independent Postgres sessions. No pip packages.

Requires the local supabase_db_kartu-local Docker container. Creates disposable
databases, copies only the Auth schema (no accounts/credentials), and drops the
test databases in finally. Never accepts a remote URL or a production database.
Run: python3 audit/account_deletion_concurrency.py
"""
import json
from pathlib import Path
import queue
import re
import subprocess
import threading
import time
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[1]
CONTAINER = 'supabase_db_kartu-local'
DATABASE = 'kartu_order1_' + uuid.uuid4().hex[:12]


def command(args, **kwargs):
    return subprocess.run(args, capture_output=True, text=True, check=True, **kwargs).stdout


def sql_script(database, sql):
    return command(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-qAt',
                    '-v', 'ON_ERROR_STOP=1', '--single-transaction', '-U', 'postgres', '-d', database], input=sql)


def admin_sql(sql):
    return command(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-qAt',
                    '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'postgres'], input=sql)


class Session:
    def __init__(self, database=DATABASE):
        self.proc = subprocess.Popen(['docker', 'exec', '-i', CONTAINER, 'psql', '-X', '-qAt',
                                      '-U', 'postgres', '-d', database], stdin=subprocess.PIPE,
                                     stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        self.lines = queue.Queue()
        threading.Thread(target=self._read, daemon=True).start()
        self.proc.stdin.write('\\set VERBOSITY sqlstate\n'); self.proc.stdin.flush()
        self.pid = int(self.query('select pg_backend_pid()')[0])

    def _read(self):
        for line in self.proc.stdout:
            self.lines.put(line.rstrip('\n'))

    def send(self, sql):
        marker = 'END_' + uuid.uuid4().hex
        self.proc.stdin.write(sql.rstrip('; \n') + ';\n\\echo ' + marker + ' :ERROR :SQLSTATE\n')
        self.proc.stdin.flush()
        return marker

    def finish(self, marker, timeout=12):
        rows = []; end = time.monotonic() + timeout
        while True:
            line = self.lines.get(timeout=max(.01, end-time.monotonic()))
            if line.startswith(marker):
                parts = line.split()
                return rows, parts[-1] if parts[-2] == 'true' else None
            if line:
                rows.append(line)

    def query(self, sql):
        rows, error = self.finish(self.send(sql))
        if error:
            raise AssertionError('SQL failed with ' + error + ': ' + '\n'.join(rows))
        return rows

    def begin(self, user=None, isolation='read committed'):
        self.query('begin isolation level ' + isolation)
        if user:
            self.query('set local role authenticated')
            claims = json.dumps({'role': 'authenticated', 'sub': user})
            self.query("select set_config('request.jwt.claims','" + claims + "',true)")

    def close(self):
        if self.proc.poll() is None:
            try:
                self.proc.stdin.write('rollback;\n\\q\n'); self.proc.stdin.flush()
                self.proc.wait(timeout=5)
            except (BrokenPipeError, subprocess.TimeoutExpired):
                self.proc.kill()
        self.proc.stdin.close(); self.proc.stdout.close()


def auth_schema():
    dump = command(['docker', 'exec', CONTAINER, 'pg_dump', '-U', 'postgres', '-d', 'postgres',
                    '--schema-only', '--schema=auth', '--no-owner'])
    # The only Kartu Auth trigger is recreated by schema.sql / the baseline.
    dump = re.sub(r'^CREATE TRIGGER on_auth_user_created_kartu .*?;\n', '', dump, flags=re.M)
    # Default ACLs belong to managed Supabase roles which postgres cannot alter.
    # They concern future objects, not the copied tables/functions or their grants.
    return re.sub(r'^ALTER DEFAULT PRIVILEGES .*?;\n', '', dump, flags=re.M)


def create_database(name, auth):
    assert re.fullmatch(r'kartu_order1_[a-z0-9_]+', name)
    admin_sql('create database ' + name + ';')
    sql_script(name, 'create schema extensions; grant usage on schema extensions to anon, authenticated, service_role; create extension if not exists "uuid-ossp" with schema extensions;\n' + auth)


def drop_database(name):
    assert re.fullmatch(r'kartu_order1_[a-z0-9_]+', name)
    admin_sql('drop database if exists ' + name + ' with (force);')


class AccountConcurrency(unittest.TestCase):
    def setUp(self):
        self.sessions = []
        self.control = self.session()
        self.ids = {k: str(uuid.uuid4()) for k in ['buyer', 'buyer2', 'seller', 'admin', 'admin2', 'supplier', 'offer']}
        for k in ['buyer', 'buyer2', 'seller', 'admin', 'admin2']:
            self.control.query("insert into auth.users(id,email) values ('%s','%s@example.test')" % (self.ids[k], self.ids[k]))
        for k, role in [('seller','supplier'), ('admin','admin'), ('admin2','admin')]:
            self.control.query("select kartu_private.set_account_role('%s','%s')" % (self.ids[k], role))
        self.control.query("insert into public.suppliers(id,user_id,public_name,approved) values ('{supplier}','{seller}','Test supplier',true)".format(**self.ids))
        self.control.query("""insert into public.offers(id,supplier_id,neighborhood_id,offer_type,title,description,price_cents,unit,stock,minimum,deadline,pickup_address,pickup_details,status)
          select '{offer}','{supplier}',id,'group_buy','Test offer','Private text',250,'bag',2,1,now()+interval '1 day','Private address','Private instructions','open'
          from public.neighborhoods where slug='naujamiestis'""".format(**self.ids))

    def tearDown(self):
        for session in reversed(self.sessions):
            session.close()
        # This is the disposable test DB only. No real local or hosted data.
        assert DATABASE.startswith('kartu_order1_')
        sql_script(DATABASE, 'truncate auth.users, public.profiles, public.suppliers, public.offers, public.reservations, public.user_action_events cascade;')

    def session(self):
        s = Session(); self.sessions.append(s); return s

    def reserve(self, key=None):
        return "select (public.create_reservation('%s',1,'%s')).id" % (self.ids['offer'], key or uuid.uuid4())

    def deletion(self):
        return 'select public.delete_my_account()'

    def wait_blocked(self, waiter, blocker):
        deadline = time.monotonic() + 2.5
        while time.monotonic() < deadline:
            rows = self.control.query('select %d = any(pg_blocking_pids(%d))' % (blocker.pid, waiter.pid))
            if rows == ['t']:
                return
            time.sleep(.02)
        self.fail('Second transaction did not wait for the expected first transaction')

    def race(self, actor1, sql1, actor2, sql2, error2=None):
        a, b = self.session(), self.session()
        a.begin(self.ids.get(actor1)); b.begin(self.ids.get(actor2))
        result1 = a.query(sql1)
        pending = b.send(sql2)
        self.wait_blocked(b, a)
        a.query('commit')
        result2, error = b.finish(pending)
        self.assertEqual(error, error2, result2)
        b.query('rollback' if error else 'commit')
        self.assertEqual(self.control.query("""select count(*) from public.reservations r
          join public.offers o on o.id=r.offer_id join public.suppliers s on s.id=o.supplier_id
          where r.status in ('reserved','ready_for_pickup') and
          (r.buyer_id is null or s.user_id is null or o.status in ('cancelled','completed','expired'))"""), ['0'])
        return result1, result2

    def test_buyer_reservation_wins(self):
        self.race('buyer', self.reserve(), 'buyer', self.deletion(), 'P0001')

    def test_buyer_deletion_wins(self):
        self.race('buyer', self.deletion(), 'buyer', self.reserve(), 'P0001')

    def test_supplier_reservation_wins(self):
        self.race('buyer', self.reserve(), 'seller', self.deletion(), 'P0001')

    def test_supplier_deletion_wins(self):
        self.race('seller', self.deletion(), 'buyer', self.reserve(), 'P0001')

    def test_two_admin_deletions(self):
        self.race('admin', self.deletion(), 'admin2', self.deletion(), 'P0001')
        self.assertEqual(self.control.query("select count(*) from public.profiles where role='admin'"), ['1'])

    def test_admin_delete_then_operator_demotion(self):
        sql = "select kartu_private.set_account_role('%s','buyer')" % self.ids['admin2']
        self.race('admin', self.deletion(), None, sql, 'P0001')

    def test_operator_demotion_then_admin_delete(self):
        sql = "select kartu_private.set_account_role('%s','buyer')" % self.ids['admin2']
        self.race(None, sql, 'admin', self.deletion(), 'P0001')

    def submit(self):
        return """select public.submit_offer('group_buy','New listing','text',250,'bag',2,1,
          (select id from public.neighborhoods where slug='naujamiestis'),now()+interval '1 day','address','pickup')"""

    def test_submission_then_deletion(self):
        self.race('seller', self.submit(), 'seller', self.deletion())
        self.assertEqual(self.control.query('select count(*) from public.offers where redacted_at is null'), ['0'])

    def test_deletion_then_submission(self):
        self.race('seller', self.deletion(), 'seller', self.submit(), 'P0001')

    def test_approval_then_deletion(self):
        self.control.query("update public.offers set status='pending_approval'")
        self.race('admin', "select public.review_offer('%s',true)" % self.ids['offer'], 'seller', self.deletion())

    def test_deletion_then_approval(self):
        self.control.query("update public.offers set status='pending_approval'")
        self.race('seller', self.deletion(), 'admin', "select public.review_offer('%s',true)" % self.ids['offer'], 'P0001')

    def seed_reservation(self):
        s = self.session(); s.begin(self.ids['buyer']); result = s.query(self.reserve())[0]; s.query('commit'); return result

    def test_cancellation_then_ready(self):
        r = self.seed_reservation()
        self.race('buyer', "select public.cancel_reservation('%s')" % r, 'seller', "select public.supplier_mark_ready('%s')" % self.ids['offer'])
        self.assertEqual(self.control.query('select status from public.reservations'), ['cancelled'])

    def test_ready_then_cancellation(self):
        r = self.seed_reservation()
        self.race('seller', "select public.supplier_mark_ready('%s')" % self.ids['offer'], 'buyer', "select public.cancel_reservation('%s')" % r, 'P0001')
        self.assertEqual(self.control.query('select status from public.reservations'), ['ready_for_pickup'])

    def test_ready_then_deletion(self):
        self.seed_reservation()
        self.race('seller', "select public.supplier_mark_ready('%s')" % self.ids['offer'], 'seller', self.deletion(), 'P0001')

    def test_completion_then_supplier_deletion(self):
        r = self.seed_reservation()
        s = self.session(); s.begin(self.ids['seller']); s.query("select public.supplier_mark_ready('%s')" % self.ids['offer']); s.query('commit')
        self.race('seller', "select public.supplier_complete_reservation('%s')" % r, 'seller', self.deletion())
        self.assertEqual(self.control.query('select pickup_code is null from public.reservations'), ['t'])

    def test_last_stock(self):
        self.control.query('update public.offers set stock=1')
        self.race('buyer', self.reserve(), 'buyer2', self.reserve(), 'P0001')
        self.assertEqual(self.control.query('select reserved_quantity from public.offers'), ['1'])

    def test_duplicate_idempotency(self):
        sql = self.reserve(str(uuid.uuid4()))
        first, second = self.race('buyer', sql, 'buyer', sql)
        self.assertEqual(first, second)
        self.assertEqual(self.control.query('select count(*) from public.reservations'), ['1'])
        self.assertEqual(self.control.query('select reserved_quantity from public.offers'), ['1'])

    def test_bounded_lock_wait(self):
        a, b = self.session(), self.session()
        a.begin(); a.query("select id from public.profiles where id='%s' for update" % self.ids['buyer'])
        b.begin(self.ids['buyer']); start = time.monotonic(); pending = b.send(self.deletion())
        self.wait_blocked(b, a)
        _, error = b.finish(pending)
        self.assertEqual(error, '55P03'); self.assertLess(time.monotonic()-start, 6)
        a.query('rollback'); b.query('rollback')
        self.assertEqual(self.control.query("select count(*) from public.profiles where id='%s'" % self.ids['buyer']), ['1'])

    def test_stale_snapshot_is_rejected(self):
        s = self.session(); s.begin(self.ids['buyer'], 'repeatable read')
        _, error = s.finish(s.send(self.reserve()))
        self.assertEqual(error, 'P0001'); s.query('rollback')


def migration_tests(auth):
    db = DATABASE + '_upgrade'
    try:
        create_database(db, auth)
        target = ROOT/'supabase/migrations/20261117150000_safe_account_deletion.sql'
        migrations = sorted(p for p in (ROOT/'supabase/migrations').glob('*.sql') if p.name < target.name)
        for migration in migrations:
            sql_script(db, migration.read_text())
        sql_script(db, """
          insert into public.suppliers(id,public_name,approved) values
           ('95000000-0000-0000-0000-000000000001','Former supplier',false),
           ('95000000-0000-0000-0000-000000000002','Unowned import',false);
          insert into public.offers(id,supplier_id,neighborhood_id,offer_type,title,price_cents,unit,stock,minimum,deadline,pickup_address,pickup_details,status)
           select '96000000-0000-0000-0000-000000000001','95000000-0000-0000-0000-000000000001',id,'group_buy','Legacy private text',250,'bag',5,1,now()+interval '1 day','Legacy address','Legacy instructions','open'
           from public.neighborhoods where slug='naujamiestis';
          insert into public.reservations(id,offer_id,buyer_id,quantity,total_cents,pickup_code,status) values
           ('97000000-0000-0000-0000-000000000001','96000000-0000-0000-0000-000000000001',null,1,250,'LEGACY-ACTIVE','reserved'),
           ('97000000-0000-0000-0000-000000000002','96000000-0000-0000-0000-000000000001',null,1,250,'LEGACY-DONE','completed');
        """)
        try:
            sql_script(db, target.read_text())
            raise AssertionError('Migration accepted an active orphan')
        except subprocess.CalledProcessError as e:
            if 'Resolve active orphan reservations' not in e.stderr:
                raise
        columns = sql_script(db, "select count(*) from information_schema.columns where table_schema='public' and table_name='offers' and column_name='redacted_at';").strip()
        assert columns == '0', 'Failed migration partially changed the schema'
        # Remove only the deliberately invalid synthetic row in this disposable DB.
        sql_script(db, "delete from public.reservations where id='97000000-0000-0000-0000-000000000001';")
        sql_script(db, target.read_text())
        actual = sql_script(db, """select title='Removed listing' and pickup_address='' and redacted_at is not null from public.offers;
          select pickup_code is null and pickup_redacted_at is not null from public.reservations;
          select public_name='Unowned import' and redacted_at is null from public.suppliers where id='95000000-0000-0000-0000-000000000002';""").strip().splitlines()
        assert actual == ['t','t','t'], actual
        print('PASS upgrade preflight, atomic failure, targeted legacy redaction', flush=True)
    finally:
        drop_database(db)


def main():
    auth = auth_schema()
    try:
        migration_tests(auth)
        create_database(DATABASE, auth)
        sql_script(DATABASE, (ROOT/'supabase/schema.sql').read_text())
        # Run the pgTAP suite against the fresh-install schema as well.
        for file in sorted((ROOT/'supabase/tests/database').glob('*.sql')):
            output = command(['docker','exec','-i',CONTAINER,'psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres','-d',DATABASE],input=file.read_text())
            assert not re.search(r'^not ok\b', output, re.M), output
        print('PASS fresh-install schema and SQL policy tests', flush=True)
        result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(AccountConcurrency))
        return 0 if result.wasSuccessful() else 1
    finally:
        drop_database(DATABASE)


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError as error:
        print(error.stderr, flush=True)
        raise SystemExit(1)

"""Restore a staging export into a disposable local database and verify it."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

from account_deletion_concurrency import (
    DATABASE, ROOT, auth_schema, create_database, drop_database, sql_script,
)

STAGING = 'fvmantcrremlqgehbces'


def export_staging(dump):
    cli = shutil.which('supabase') or str(Path.home()/'.supabase/bin/supabase')
    subprocess.run(
        [cli, 'db', 'dump', '--remote='+STAGING, '--data-only', '--use-copy',
         '--schema', 'public,auth', '-x', 'auth.schema_migrations', '--file', str(dump)],
        env=dict(os.environ, SUPABASE_TELEMETRY_DISABLED='1'), check=True,
    )


def verify_restore(data, schema):
    start = time.monotonic()
    auth = auth_schema()
    try:
        create_database(DATABASE, auth)
        sql_script(DATABASE, schema)
        sql_script(DATABASE, 'DELETE FROM public.neighborhoods;\n'
                   'SET LOCAL session_replication_role = replica;\n' + data)
        counts = sql_script(DATABASE, """
            SELECT count(*) FROM public.neighborhoods;
            SELECT count(*) FROM auth.users;
            SELECT count(*) FROM public.offers;
        """).splitlines()
        if len(counts) != 3 or int(counts[0]) == 0:
            raise RuntimeError('Expected restored neighborhoods and readable Auth and offer tables')
        for test in sorted((ROOT/'supabase/tests/database').glob('*.sql')):
            results = sql_script(DATABASE, test.read_text())
            if any(line.startswith('not ok') for line in results.splitlines()):
                raise RuntimeError(f'Restored database failed {test.name}')
            if not any(line.startswith('ok ') for line in results.splitlines()):
                raise RuntimeError(f'No assertions ran in {test.name}')
        print(f'Restored neighborhoods/users/offers: {"/".join(counts)}. '
              f'Both SQL suites passed. Elapsed: {time.monotonic()-start:.1f}s.')
    finally:
        drop_database(DATABASE)


def main():
    with tempfile.TemporaryDirectory(prefix='kartu-restore-') as directory:
        dump = Path(directory)/'data.sql'
        export_staging(dump)
        verify_restore(dump.read_text(), (ROOT/'supabase/schema.sql').read_text())


if __name__ == '__main__':
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(f'Restore operation failed with status {error.returncode}; output suppressed.')

"""Save encrypted Kartu staging snapshots and verify a restore locally."""
import argparse
import datetime
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile

from restore_drill import ROOT, export_staging, verify_restore

SUPPORT = Path.home() / 'Library/Application Support'
ARCHIVES = SUPPORT / 'Kartu Staging Backups'
KEYS = SUPPORT / 'Kartu Staging Backup Key'
CERT = KEYS / 'recipient.pem'
PRIVATE_KEY = KEYS / 'identity.pem'
PATTERN = 'kartu-staging-*.tar.gz.cms'
KEEP = 14


def crypto(*args):
    subprocess.run(['/usr/bin/openssl', *args], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def init_key():
    if CERT.exists() or PRIVATE_KEY.exists():
        if not CERT.is_file() or not PRIVATE_KEY.is_file():
            raise RuntimeError('Backup key pair is incomplete')
        return
    KEYS.mkdir(mode=0o700, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=KEYS) as directory:
        folder = Path(directory)
        crypto('req', '-x509', '-newkey', 'rsa:3072', '-nodes', '-sha256', '-days', '3650',
               '-subj', '/CN=Kartu staging backup',
               '-keyout', str(folder / 'identity.pem'), '-out', str(folder / 'recipient.pem'))
        (folder / 'identity.pem').replace(PRIVATE_KEY)
        (folder / 'recipient.pem').replace(CERT)


def backup():
    init_key()
    ARCHIVES.mkdir(mode=0o700, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = ARCHIVES / f'kartu-staging-{stamp}.tar.gz.cms'
    with tempfile.TemporaryDirectory(dir=ARCHIVES) as directory:
        folder = Path(directory)
        sql = folder / 'data.sql'
        bundle = folder / 'backup.tar.gz'
        encrypted = folder / 'backup.cms'
        export_staging(sql)
        if not sql.stat().st_size:
            raise RuntimeError('Empty staging export')
        with tarfile.open(bundle, 'w:gz') as archive:
            archive.add(sql, arcname='data.sql')
            archive.add(ROOT / 'supabase/schema.sql', arcname='schema.sql')
            archive.add(ROOT / 'deployment/staging/supabase/config.toml', arcname='staging-auth.toml')
        crypto('cms', '-encrypt', '-binary', '-aes256', '-outform', 'DER',
               '-in', str(bundle), '-out', str(encrypted), str(CERT))
        encrypted.replace(destination)
    for expired in sorted(ARCHIVES.glob(PATTERN), reverse=True)[KEEP:]:
        expired.unlink()
    print(f'Saved encrypted staging snapshot {destination.name} ({destination.stat().st_size} bytes).')


def restore_latest():
    snapshots = sorted(ARCHIVES.glob(PATTERN))
    if not snapshots:
        raise RuntimeError('No staging snapshots found')
    with tempfile.TemporaryDirectory() as directory:
        bundle = Path(directory) / 'backup.tar.gz'
        crypto('cms', '-decrypt', '-binary', '-inform', 'DER', '-in', str(snapshots[-1]),
               '-recip', str(CERT), '-inkey', str(PRIVATE_KEY), '-out', str(bundle))
        with tarfile.open(bundle, 'r:gz') as archive:
            data = archive.extractfile('data.sql').read().decode()
            schema = archive.extractfile('schema.sql').read().decode()
        verify_restore(data, schema)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('backup', 'verify-latest'))
    args = parser.parse_args()
    os.umask(0o077)
    try:
        if args.action == 'backup':
            backup()
        else:
            restore_latest()
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError, tarfile.TarError):
        raise SystemExit(f'Kartu {args.action} failed. Check local Docker, CLI login and backup files.')

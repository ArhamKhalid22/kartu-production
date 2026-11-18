# Kartu staging operations

Run `python3 scripts/check-staging.py` for a quick check of the private site gate and a Supabase database read. It exits nonzero on failure. To verify the Worker itself, open `/healthz` in a signed-in staging browser and confirm `status: ok`, `mode: staging`, and `backendConfigured: true`. The private gate returns HTTP 401 to an unsigned monitor, which only proves the gate is reachable.

Run `python3 audit/restore_drill.py` with the Supabase CLI signed in and local Docker/Supabase running. The script exports staging Auth and application rows, recreates the application schema in a disposable local database, verifies the restored data, runs the SQL test suites, and removes the local database and temporary export. Auth configuration, credentials, migration history, and Storage objects need separate recovery coverage. [Supabase restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)

For the pilot, assign an operator and use an encrypted backup location independent of the hosted project. Proposed targets are at most 24 hours of data loss and four hours to restore. Confirm the targets by timing a representative restore with a populated dataset. Keep the release commit, Auth redirect settings and migration versions alongside recovery instructions. Keep passwords and keys in the operator's password manager.

If staging fails, run the probe and check the Sites deployment status and Supabase Auth, API and Postgres logs. Record timestamps, HTTP status codes, and the release revision. Leave email addresses, pickup codes and tokens out of reports. For a bad frontend release, redeploy the last verified Sites version. For a database issue, rehearse recovery in a fresh target and run the role and order tests before repointing the app. After an outage, verify sign-in, reservation and pickup.

The **Kartu staging backup and health** Codex automation is active and scheduled daily at 09:00. It runs the backup and health checks on this Mac and reports to this thread. It depends on the local Codex environment, Docker, and the authenticated Supabase CLI.

Run `python3 audit/staging_backup.py backup` for an on-demand encrypted snapshot. It keeps the 14 newest archives in `~/Library/Application Support/Kartu Staging Backups`. The separate `Kartu Staging Backup Key` directory contains the certificate and private key. Both directories are restricted to the local user. Store an independent copy of the archive and a separately protected copy of the key before relying on backups for a pilot. Losing this Mac can otherwise lose both copies needed for recovery.

Run `python3 audit/staging_backup.py verify-latest` to decrypt the newest archive and verify a restore into a disposable local database. Restore archives produced by this job from your own protected storage. The first archive restored successfully. Staging had three neighborhoods, zero users, and zero offers.

The first unattended result and failure notification still need verification. The daily probe can miss shorter outages. For continuous alerts, configure a dedicated monitor and confirm an alert and recovery notification reach the operator. Verify real signup and recovery email delivery before invitations.

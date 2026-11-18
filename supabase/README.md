# Local database development

This folder was inspected before CLI initialization: it contained only `schema.sql`. `migrations/20261116230756_kartu_baseline.sql` is an exact copy of the original schema snapshot (the migration timestamp is UTC). The top-level `schema.sql` is kept as a complete single-file setup path for manual hosted-project setup; local development applies the baseline plus later additive migrations. Future local changes belong in new migration files; do not edit an already-applied baseline.

## Tools

- Docker Desktop for Apple silicon, installed from [Docker's official Mac instructions](https://docs.docker.com/desktop/setup/install/mac-install/).
- Supabase CLI 3.2.0, installed using the [official Supabase CLI installer](https://github.com/supabase/cli#installation). The executable is `~/.supabase/bin/supabase`.

Open a new terminal after installation so the CLI paths are loaded. Docker Desktop must show **Engine running**. If a terminal cannot find Docker, its bundled CLI is `/Applications/Docker.app/Contents/Resources/bin/docker`.

## Run only the local stack

Run these commands separately from the Kartu project root:

```sh
cd "/Users/arham/Documents/ChatGPT/New project"
supabase start
supabase migration up --local
supabase test db
python3 audit/account_deletion_concurrency.py
```

The configuration uses project ID `kartu-local`, API port `54321`, database port `54322`, and Studio port `54323`. The auth redirect points to the frontend on port `8000`. CLI 3.2.0 targets the local database by default for `db reset` and `test db`. Do not add `--remote`, a hosted project reference, or a remote database URL to this workflow. No hosted project login or link is needed.

`db reset` deletes and recreates this local database, then reapplies versioned migrations. It is appropriate for these disposable local test fixtures. The baseline inserts the three neighborhoods; application accounts and offers are not seeded. The database tests create synthetic accounts and records inside a transaction and roll it back.

Inspect local services with `supabase status`. Stop them with `supabase stop` when finished. Keep the browser's `config.js` ignored; it has not been populated by this setup.

## Database tests

`tests/database/001_access_control_test.sql` uses pgTAP and switches the actual database role to `anon` or `authenticated`, with distinct JWT subjects for two buyers, two suppliers, and an admin. Fixture creation uses the privileged connection; access assertions do not.

Coverage includes public-offer visibility, buyer-only access to closed offers needed for existing pickup details, private reservation/profile isolation, cross-buyer cancellation denial, supplier ownership, admin-only approval/rejection, missing-profile role denial, preventing direct mutation/role escalation, idempotent reservations, stock limits, deadline enforcement, minimum thresholds, cancellation counters, pickup status propagation, supplier completion, per-account write throttles, and account-deletion behavior. Deletion tests verify active-order blocks, final-admin protection, order-history detachment, supplier listing closure, and removal of supplier-authored identifying text.

The current local suite passes **154 pgTAP assertions** across two test files. `audit/account_deletion_concurrency.py` also passes **19 tests**, using independent PostgreSQL sessions with observed blocking barriers. It verifies fresh installation, upgrade preflight/rollback, and targeted legacy redaction in disposable databases. It exercises database permissions and functions; it does not replace hosted authentication, browser, mail delivery, or concurrent-load testing. Follow-up changes and remaining hosted checks are documented in [the application audit](../AUDIT.md).

Official references: [migrations](https://supabase.com/docs/guides/local-development/database-migrations), [pgTAP database testing](https://supabase.com/docs/guides/database/testing).

## Order 1 migration and operator rules

`20261117150000_safe_account_deletion.sql` adds coordinated write locks, active-buyer/code constraints, redaction timestamps, null-safe ownership, and atomic deletion. Lock waits are bounded at three seconds. Write RPCs explicitly require READ COMMITTED isolation; other isolation modes are rejected rather than using stale snapshots after waiting.

The internal `kartu_private` schema is not exposed through the API and grants no access to anon/authenticated/service_role. Its lifecycle guard serializes rare account deletions and SQL-operator role changes. Use `kartu_private.set_account_role(user_uuid, 'admin'|'supplier'|'buyer')` as the SQL owner, including when demoting an admin. Direct privileged SQL can bypass the workflow; it is not the normal operational path.

The migration fails atomically if active orphan orders or active orders on closed offers exist. Resolve those records individually first. Its legacy cleanup targets only the earlier deletion function’s explicit `Former supplier`, unapproved, ownerless tombstones and detached terminal pickup codes. Unowned imports are not silently scrubbed. Backfilled timestamps represent the cleanup time, not the original deletion time.

Redaction removes supplier names/about text, offer title/description/unit/address/instructions, and terminal pickup codes. Numeric transaction fields, timestamps, final order statuses, and other customers’ ownership remain. Redaction is irreversible; use a forward corrective migration for code defects, not restoration of erased personal data. Previously exported copies and backups need their own retention process.

The concurrency runner uses Python’s standard library and the existing local Docker `psql`/`pg_dump`; no pip packages or remote credentials are required. It copies Auth schema definitions only, retains existing object grants, omits managed roles’ default ACL changes (which the local postgres role cannot alter), and supplies the standard extensions-schema usage grants. Test data is synthetic. The named `kartu_order1_*` databases are dropped in `finally`; the main local database is never reset by this runner.

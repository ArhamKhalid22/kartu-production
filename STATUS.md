# Project checkpoint — 2026-11-17

## Order 1: completed locally

Safe account deletion and coordinated marketplace writes are implemented. Migration `20261117150000_safe_account_deletion.sql` is applied to local Supabase; fresh-install `supabase/schema.sql` includes the same behavior.

- Active pickups block buyer/supplier deletion. Deletion and guarded operator role changes preserve the final admin.
- Reservations, listing submission/review, cancellation, preparation and completion coordinate with deletion. Transactions roll back on failure; lock waits are bounded. Reservation retries remain idempotent.
- Deleted supplier listing text and pickup details are scrubbed. Terminal pickup codes are removed. Limited transaction history remains, including other buyers' ownership; this is not full anonymization.
- The interface prevents duplicate deletion requests, explains blocked/uncertain outcomes, permits retries, and clears account state on success. Late data responses and token refreshes cannot restore a deleted session.
- Upgrade preflight rejects inconsistent legacy active orders before changes; legacy redaction targets explicit deletion tombstones only.

## Verification

- 154 local pgTAP assertions passed; fresh-install SQL tests also passed.
- 19 independent-session concurrency tests passed.
- Upgrade preflight, atomic rollback and targeted legacy cleanup checks passed.
- 12 frontend regression checks passed using mocked browser/network objects.
- JavaScript syntax and Git whitespace checks passed.

Repeat with Docker, Supabase CLI, Python 3 and Node.js available:

```sh
SUPABASE_TELEMETRY_DISABLED=1 supabase start
SUPABASE_TELEMETRY_DISABLED=1 supabase migration up --local
SUPABASE_TELEMETRY_DISABLED=1 supabase test db --local
python3 audit/account_deletion_concurrency.py
node --check app.js
node audit/regressions.cjs
git diff --check
```

The concurrency runner uses disposable local databases and removes them afterward. It does not reset the main database. The frontend checks are mocks, not visual browser tests.

## Remaining scope

Order 2 / hosted rollout is pending. No hosted Supabase project, public deployment, real recovery-email delivery, or hosted multi-user browser flow has been verified. This checkpoint does not establish production readiness. Backup retention, a defined transaction-retention period, hosting/security headers and operational monitoring still require their launch work.

Use the SQL-owner-only `kartu_private.set_account_role` procedure for role changes. Direct privileged edits can bypass application safeguards. See `supabase/README.md` for migration and operator details and `AUDIT.md` for the broader audit; this checkpoint supersedes older Order 1 gaps.

## Order 2 — hosted staging, 2026-11-18

- Private [Kartu staging](https://kartu-staging-arham.stripycompass32.chatgpt.site/) deployed through Sites. The browser loaded the shared-mode sign-in screen. Release `32857c79641b8e86` uses Supabase project `grupinis-pirkimas` (`fvmantcrremlqgehbces`). This is the project's main branch, which Supabase labels production. It was empty before rollout and is used for staging.
- Eight migrations applied after a dry run. Auth redirects to staging and email confirmation is enabled. Existing Vercel redirects were preserved.
- Four deployment checks and eleven hosted HTTP checks passed with real test sessions. These covered role isolation, approval, reservation retries, cancellation, pickup, account deletion, token refresh and sign-out. Synthetic records were removed and the hosted database has zero users and offers.
- Hosted pgTAP failed before assertions because the CLI test connection could not resolve `no_plan()`. Local pgTAP and hosted HTTP results are separate.
- Real signup/recovery email delivery, full browser journeys, backup restoration and monitoring remain open. Supabase's [SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp) explains the built-in sender restrictions.

Repeat hosted HTTP checks only on the designated staging project:

```sh
python3 audit/hosted_smoke.py --project-ref fvmantcrremlqgehbces --allow-staging-writes
```

## Order 3 — staging operations

- Exported hosted Auth and application rows and restored them into a disposable local database. The restored data contained three neighborhoods, zero accounts and zero offers. Both SQL suites passed on the restored database. The first run took 68 seconds including the database image download.
- The one-shot staging probe passed for the Sites access gate and a live Supabase data read. The gate check needs signed-in browser access to verify the Worker itself.
- [Operations runbook](OPERATIONS.md) documents the drill, outage checks, rollback and alert acceptance criteria. Scheduled backups, alert delivery, and a restore with populated data still need verification. Hosted signup/recovery email and full browser journeys remain open from Order 2.

## Order 4 — pilot verification

- Verified that the private staging site opens its signup and password recovery forms.
- Added and ran `python3 audit/local_recovery.py`. A synthetic account received a recovery link in local Mailpit. The link produced a recovery session, the old password stopped working, and the new password signed in. The test account was removed. Local sign-up currently skips email confirmation.
- All 12 frontend regressions and the staging availability probe passed.
- Real staging email delivery still needs an authorized test mailbox and a sender capable of delivering to it. Broader browser journeys, continuous alerts, and scheduled backups are pending. Keep staging private while validating the pilot.

## Order 5 — browser order journey

- On the private staging site, signed in with separate supplier, admin, and buyer test accounts. The supplier submitted a bulk rice listing, the admin approved it, and the buyer reserved and cancelled an order. The buyer then reserved all 10 units for €25 and met the group minimum.
- The supplier marked the order ready and completed pickup. The buyer saw the completed order after signing back in and reloading. Sign-out returned to the login screen.
- Fixed a supplier dashboard discrepancy where the badge excluded offers that met their group minimum while the statistics included them. The new regression passed with the other 12 frontend checks. All four deployment checks passed. Signed-in staging health confirmed release `66d7f8e7337a591b`.
- Removed all test records. Verified zero matching test users and offers. Hosted email delivery, scheduled backup and alert delivery, and broader accessibility and device coverage remain pending.

## Order 6 — scheduled staging backup and health

- Created the active daily Codex automation **Kartu staging backup and health** at 09:00. It runs locally and reports to this thread.
- Created an encrypted staging archive outside the repository. Decrypted and restored it into a disposable local database. The restored counts were 3 neighborhoods, 0 users and 0 offers. Both SQL suites passed. The staging gate and database probe also passed.
- Archives retain the 14 most recent snapshots. The local key is stored separately from the archive folder with user-only permissions. Both currently live on the same Mac. See [OPERATIONS.md](OPERATIONS.md) for recovery commands and limitations.
- The first unattended run, failure notification, independent backup copy and continuous outage alerting are unverified. Hosted email delivery remains open.

# Kartu local audit — 17 November 2026

For current results, see the [staging reassessment](#current-staging-reassessment--18-november-2026) below.

Baseline: `e913fb6` (`Save Kartu audit baseline`). Application files were not changed during this audit.

## Verified in the browser

- Demo starts at `http://127.0.0.1:8000` with no credentials.
- Buyer reservation, quantity/total calculation, and reload persistence work.
- Cancellation works before the group minimum is reached.
- Supplier submission, admin approval, and the approved offer appearing in the buyer feed work.
- Supplier marking an offer ready updates the buyer's demo order and preserves its pickup code.
- Lithuanian/English switching works in the main shell.
- Desktop (1440 px), phone (390 px), and narrow-phone order view (320 px) were inspected. The phone views checked had no horizontal document overflow.
- No browser console errors or warnings were recorded during these flows. JavaScript syntax check passed.

Evidence: [desktop](audit/desktop.jpg), [phone feed](audit/mobile.jpg), [phone pickup order](audit/pickup-mobile.jpg). Browser test records are local demo data, including one approved offer named “Audit test — oats.”

## Findings to address

### P1 — Shared orders disappear when the offer closes or becomes ready

`supabase/schema.sql:141` permits an ordinary buyer to read an offer only while its status is `open`/`minimum_reached` and its deadline is future. The reservation policy still lets the buyer read their reservation. `app.js:257` silently omits the whole order when its offer is absent, including the pickup code and instructions.

This combines static policy inspection with a mocked missing-offer rendering reproduction; a live database check is still required. PostgreSQL filters rows not allowed by an RLS expression: [official row-security documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).

Fix direction: preserve access to the details needed for a buyer's existing order without publishing closed/private offers to everyone; render a useful fallback when offer details are unavailable. Avoid introducing a recursive policy dependency between offers and reservations.

### P1 — Failed shared-data loading displays demo listings as shared data

`app.js:112` assigns the signed-in profile before the remaining requests finish. On a subsequent 503, the catch block stores an error but leaves that profile and the initial demo listings in place. `render()` then displays the shared-mode shell without the error. A mocked profile success followed by a data-request failure reproduced this.

Fix direction: keep demo and shared data separate, commit a remote snapshot only after successful loading, and display a recoverable error state.

### P2 — Cancellation disappears at the group minimum

Reserve three units of the seeded detergent offer: progress changes from 12/15 to 15/15. The order is still reserved, but its Cancel control disappears because `app.js:258` requires `offer.status === 'open'`. The database cancellation function permits `minimum_reached` before the deadline. Confirmed in the browser and a regression check.

Fix direction: align the cancellation control with the server's allowed states and deadline.

### P2 — Demo deadlines do not expire correctly

The client uses a stored `hoursLeft` value rather than recalculating from the deadline. `app.js:329` therefore accepts a demo reservation even when the absolute deadline has passed. A fixture with a past deadline and stale positive `hoursLeft` reproduced this. Shared-mode SQL independently checks `deadline <= now()`, so this reproduction is not a server-side deadline bypass.

Fix direction: derive availability/countdown from timestamps on each relevant render/action and give seeded offers stable timestamps.

## Repeatable baseline checks

Run `node audit/regressions.cjs` with Node.js. It executes the real application code with mocked DOM, storage, and HTTP responses; it never contacts a Supabase project. The five checks cover cancellation at the minimum, fallback order details, expired demo deadlines, shared-data failures, and password recovery links. All five passed in the local regression run.

## Coverage limits

This baseline audit did not yet run the schema in Postgres, test hosted authentication, prove concurrent reservation behavior, or complete an accessibility audit. Follow-up implementation and evidence are recorded below. No hosted project was linked or changed.

## Follow-up implementation — 17 November 2026

### Fixed in the app

- Offer deadlines are absolute timestamps. Old saved demo offers migrate their previous remaining-hours value once.
- Cancellation remains available at `minimum_reached` until the offer closes.
- Orders keep a pickup-code/total fallback when offer details cannot be fetched.
- Shared snapshots are committed only after every required request succeeds; failed loads show a retry/demo/sign-out state instead of seeded demo content.
- Reservation actions keep a request idempotency key across network retries and prevent concurrent clicks in one tab.
- Suppliers can mark each ready reservation completed after pickup.
- Shared offers and reservations load in stable 50-row pages. Supabase requests have a 15-second timeout.
- Database triggers limit each buyer to 15 reservation writes per five minutes and each supplier to 5 offer submissions per hour. Retry keys do not consume a second reservation slot; rate-limit event rows are private, pruned after a day, and deleted with the Auth account.
- Password recovery is wired to Supabase Auth. Sessions are now kept in tab-scoped `sessionStorage`; older local-storage sessions migrate on next load and are removed from `localStorage`.
- Account export downloads the user's profile, reservations, and owned supplier offers as JSON.
- Account deletion requires confirmation and is backed by a definer RPC. It blocks active buyer/supplier pickups, protects the last admin, deletes the Auth/profile account, detaches historical reservations from the profile, and closes/anonymizes supplier data.
- Product text contrast was darkened and small supporting text enlarged. Offer details now trap keyboard focus and restore focus when closed.

### Database fixes and verification

Added migrations `20261117090000_buyer_order_offer_access.sql`, `20261117100000_null_safe_role_checks.sql`, `20261117110000_order_idempotency_and_completion.sql`, `20261117120000_account_data_lifecycle.sql`, `20261117130000_api_abuse_limits.sql`, and `20261117140000_rate_limit_event_retention.sql`. The original baseline migration remains unchanged.

The local Supabase migration chain applied successfully. `supabase test db --local` passes **118/118 pgTAP checks**, including buyer/supplier/admin/anonymous isolation, retries, stock and deadline checks, missing-profile role denial, completed pickups, rate-limit thresholds, and account deletion behavior. The five frontend regression checks pass with mocked DOM/storage/network objects. Test fixtures are synthetic; no live Supabase project is contacted.

### Still requires a hosted project or provider choice

- Auth email delivery, allowed production redirect URLs, MFA policy, hosted quotas, TLS, and CSP/security headers.
- Browser verification of current account, modal, phone, and desktop layouts; browser access is unavailable in this Codex chat.
- Hosted end-to-end/tenant-isolation checks, realistic load tests, uptime/error alerts, audit logging, backups, and a restore drill.
- Review and approval of marketplace data-retention periods and applicable Lithuania/EU food-safety requirements.

No hosted project or third-party service was configured or modified during this follow-up.

## Current staging reassessment — 18 November 2026

This section supersedes the earlier local findings where newer evidence exists. Kartu is a static JavaScript app served over HTTPS on a private Sites deployment. Supabase provides shared authentication and Postgres data. Buyers, suppliers, and admins use separate accounts. The app handles account contact details and pickup information. Sales are paid at pickup.

| Area | Status | Current evidence and remaining gap |
| --- | --- | --- |
| 1. Core functionality | **Partially verified** | The private staging browser run passed supplier submission, admin approval, buyer reservation and cancellation, group minimum, pickup completion, and persistence after reload. Account deletion passed on the hosted API. Local recovery worked through Mailpit. Hosted email and a full browser export/deletion check remain open. |
| 2. Authentication and sessions | **Partially verified** | Hosted password sign-in, refresh, sign-out and refresh-token revocation passed. Local recovery rejected the old password after reset. Tokens are readable by page JavaScript in tab-scoped session storage. Hosted signup/recovery delivery, session expiry, enumeration checks and an app admin MFA flow remain open. |
| 3. Authorization and tenant isolation | **Partially verified** | The 154 local SQL assertions include role and row isolation. Real hosted sessions exercised buyer, supplier and admin access, including anonymous write denial and cross-buyer and cross-supplier access denial. The separate hosted pgTAP run stopped during setup before running assertions. [Supabase RLS test guidance](https://supabase.com/docs/guides/database/postgres/testing-row-level-security) |
| 4. Database and data integrity | **Partially verified** | Eight migrations are applied to staging. The 19 local concurrency tests cover deletion races, last stock, duplicate requests and admin protection. Fresh install and upgrade checks passed. Load and concurrency under hosted traffic remain unmeasured. The workspace migration chain is still uncommitted in the main repository. |
| 5. Encryption and secrets | **Partially verified** | The staging site and API were reached over HTTPS. The generated browser configuration accepts a Supabase publishable key only. The local backup is encrypted and the key has user-only permissions. Provider storage encryption and a fresh comprehensive secrets scan were outside this recheck. |
| 6. Application security | **Partially verified** | The staging Worker sets CSP, HSTS, framing, and MIME-sniffing restrictions and serves an allowlist of browser assets. Four deployment checks passed. A full dependency and application security audit remains open. |
| 7. APIs and abuse prevention | **Partially verified** | The app uses 15-second request timeouts and 50-row pages. Database write throttles are covered locally, and a hosted repeated reservation returned the same order. Offset paging can shift with concurrent changes. Read/export abuse limits and hosted quota behavior remain unverified. |
| 8. Privacy and data lifecycle | **Fail** | Supplier deletion now scrubs pickup details and listing text. Hosted deletion and redaction passed. Limited historical transaction data remains by design. The app still needs a user-facing privacy notice and an approved retention schedule. |
| 9. Performance and capacity | **Not verified** | Local concurrency tests establish behavior for specific races. Realistic dataset, query latency, sustained load and overload behavior remain unmeasured. |
| 10. Reliability and dependencies | **Partially verified** | Staging exposes a health endpoint. The availability probe confirmed the private Sites gate and a live Supabase database read. The app shows a recoverable load error in regression tests. Hosted dependency outage and quota exhaustion behavior remain unverified. |
| 11. Backups and disaster recovery | **Partially verified** | The encrypted staging archive restored with 3 neighborhoods, 0 users and 0 offers. Both SQL suites passed on the restored database. A daily local schedule and recovery runbook exist. First unattended success, recovery of a populated dataset, and an independent copy of the archive and key remain unverified. |
| 12. Monitoring and incident response | **Partially verified** | A daily check and incident runbook exist. The unauthenticated check verifies the availability of the private access gate. Continuous monitoring, delivery of failure and recovery notifications, application error tracking and a privileged-action audit trail remain open. |
| 13. Infrastructure and deployment | **Partially verified** | The app is deployed to private Sites staging with a hosted Supabase database designated for staging. Build, deployment and rollback steps exist. A separate production environment, production release controls and CI/CD remain open. |
| 14. Usability, accessibility and compatibility | **Partially verified** | The hosted journey worked in one narrow browser viewport, and earlier demo checks covered desktop and mobile sizes. Contrast styling was improved and the offer dialog has a focus trap. Systematic contrast, screen reader, keyboard and cross-browser coverage remain open. |
| 15. Business-specific requirements | **Partially verified** | The pickup workflow passed in staging. Payment is collected at pickup and supplier onboarding is manual. The pilot scope excludes chilled meat and dairy. Review food handling and cold-chain requirements before adding chicken. [MVP scope](SPEC.md) |

Before opening a public pilot, verify hosted signup and recovery email, publish the privacy notice and approve retention, establish production deployment controls, and verify independent backup storage and failure alert delivery. Test a realistic dataset and complete the accessibility and product-safety checks for the intended pilot.

The recheck ran JavaScript syntax and whitespace checks, 13 frontend regressions, four deployment checks, 154 local pgTAP assertions, the 19-case concurrency and migration test, the staging availability probe, and an encrypted archive restore. It also read the hosted migration history. Earlier hosted HTTP and browser results are recorded in [STATUS.md](STATUS.md). No deployment or hosted data changes were made during this recheck.

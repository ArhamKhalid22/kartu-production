# Kartu staging and launch checklist

Private hosted staging is live. See [STATUS.md](STATUS.md) for the deployed URL and test results. Use the checks below before a public pilot.

## 1. Recheck the local release

From the project root:

```sh
supabase start
node audit/regressions.cjs
supabase test db
python3 -m http.server 8000
```

Open `http://localhost:8000`. Check buyer reserve/cancel, supplier create/ready/complete, admin approval, password recovery screen, account export, and account deletion in a test project. Stop the server with `Ctrl+C`. The database test creates synthetic data inside a transaction and rolls it back.

## 2. Create a staging Supabase project

1. Create a separate project for staging. Do not use production credentials for local work.
2. Install the Supabase CLI from its official instructions and sign in with `supabase login`.
3. In the project root, link the repository to the staging project with `supabase link --project-ref <staging-project-ref>`.
4. Preview the migration target with `supabase db push --dry-run --remote`. Read the `Target:` line and migration list; confirm the project reference is the staging project.
5. Apply the listed migrations with `supabase db push --remote`. Never run `supabase db reset --remote` against production: that command drops and rebuilds the remote schema. The CLI migration workflow is documented in [Supabase local development](https://supabase.com/docs/guides/local-development/cli-workflows).
6. Create test buyer, supplier, and admin accounts. Promote only the test supplier/admin in SQL, then exercise the role-isolation cases from `supabase/tests/database/001_access_control_test.sql` with real JWTs.

The repository's versioned migration chain contains the baseline and all follow-up migrations. Use that chain for managed environments. The one-file `supabase/schema.sql` is a manual setup route for a new empty project; do not apply that file and then replay the historical migration chain on the same database.

## 3. Configure Auth and account recovery

1. In Authentication → URL Configuration, set the Site URL to your staging HTTPS address.
2. Add the exact staging app URL and `http://localhost:8000/**` to allowed redirect URLs. Add the production URL only when that host exists.
3. Enable email confirmation. Set confirmation and password-recovery link expiry to one hour or less.
4. Configure a custom SMTP sender before inviting anyone outside the project team. Supabase's default SMTP service is for development, restricts recipients to project-team addresses, and currently limits sending to two emails per hour. Confirm current settings in [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).
5. Test a recovery email end to end: request it, open the link in a clean browser session, set a new password, sign in with the new password, and confirm the old password fails.
6. Add TOTP MFA for administrator accounts and decide how to require it for admin actions. The app does not yet have MFA enrollment/challenge screens, so do not enforce `aal2` policies until the app has an admin MFA flow and a tested recovery path. See [Supabase MFA](https://supabase.com/docs/guides/auth/auth-mfa).

## 4. Set the frontend configuration

1. Copy `config.example.js` to the ignored local `config.js`.
2. Set only the Supabase project URL and the publishable key (legacy anon key also works).
3. Never put a service-role key, database password, SMTP password, or management API token in `config.js` or any other browser file.
4. Test sign-up, sign-in, refresh after reload, sign-out, recovery, export, and deletion against staging. Verify a buyer cannot see another buyer's pickup code and one supplier cannot access another supplier's reservations.
5. Verify the app's write throttles in staging: 15 reservation writes per account per five minutes and 5 offer submissions per supplier per hour; confirm same-key retries do not create a second reservation.

The session token is stored in `sessionStorage`, which is readable by JavaScript in the page and is cleared when the tab closes. Keep all HTML output escaped and avoid adding third-party scripts.

## 5. Deploy the static app securely

Choose a static host that serves HTTPS and lets you set response headers. Configure the app URL in Supabase Auth after the host is assigned. Do not publish `config.js` with any secret.

Set headers equivalent to:

```text
Content-Security-Policy: default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://<your-project-ref>.supabase.co; form-action 'self'; upgrade-insecure-requests
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

Replace the Supabase origin with the exact one in `config.js`. `style-src 'unsafe-inline'` is currently needed for product colors and progress widths rendered as style attributes; scripts remain restricted to same-origin files. Test the policy in a staging browser and review any violation before production. Add HSTS only after HTTPS is working on the domain and all included subdomains.

## 6. Backups, monitoring, and response

1. If staying on the Supabase Free plan, schedule regular logical database exports with the Supabase CLI `db dump` command and store them in a private location separate from the project. Supabase says Free projects do not receive automatic database backups. Test restoring an export into a disposable project. See [Supabase backups](https://supabase.com/docs/guides/platform/backups).
2. Choose an uptime monitor for the public site and an alert path for failures. Do not include user emails, pickup codes, or access tokens in alert payloads.
3. Review Supabase Auth, API, and Postgres logs during staging. Add client-side error reporting only after deciding which fields are scrubbed; never send tokens or personal order details to logs.
4. Write down who can disable sign-ups, rotate project keys, contact the host/Supabase, and tell users about an outage. Rehearse restoring a database backup before launch.
5. Establish a data-retention schedule with qualified Lithuania/EU counsel. The app's deletion RPC retains limited order history and closes supplier listings; review that policy for accounting, consumer, and food traceability duties.

## 7. Production release gate

- [ ] Staging migration preview and application reviewed; staging database tests pass.
- [ ] Hosted buyer, supplier, admin, and anonymous journeys pass with separate accounts.
- [ ] Recovery email, link expiry, and custom SMTP delivery pass.
- [ ] Export contains the complete account dataset; deletion blocks active orders and removes profile access.
- [ ] Phone, tablet, and desktop flows have been inspected in a browser, including keyboard-only modal use.
- [ ] Realistic pilot dataset and concurrent reservation test stay within stock limits and request timeouts.
- [ ] TLS, response headers, CSP, admin MFA decision, email abuse limits, backup/restore, uptime alerts, and incident contacts are ready.
- [ ] Food-safety scope and data retention have been reviewed for the actual products and locations.
- [ ] Production migration target is confirmed with `supabase db push --dry-run --remote` before applying migrations.

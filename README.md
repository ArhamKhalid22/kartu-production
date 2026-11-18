# Kartu

Kartu is a mobile-friendly web app for finding discounted surplus food and joining neighborhood group orders in Lithuania. It has a zero-setup local demo and an optional Supabase mode for shared accounts and data.

## Run it locally

No account, API key, package install, or paid service is needed for the demo.

1. Install Python 3 if it is not already installed.
2. Open a terminal in this project folder.
3. Run:

   ```sh
   python3 -m http.server 8000
   ```

4. Open [http://localhost:8000](http://localhost:8000).
5. Stop the local server with `Ctrl+C` in the terminal.

Without Supabase keys, the app stores demo data in this browser on this device. Changing demo role lets you try buyer, supplier, and administrator flows. Use the language button to switch between Lithuanian and English.

## Try the main flows

1. As the buyer, open a group order and reserve a quantity. It appears under **Mano užsakymai** with a pickup code.
2. Change the demo role to **Tiekėjas · Mantas**. Create a new offer and submit it for review.
3. Change the role to **Administratorius**. Approve that offer.
4. Return to the buyer and see the approved offer in the neighborhood feed.
5. Return to the supplier and mark the detergent offer as ready for pickup. Switch back to the buyer to see the order status update.

## Connect shared accounts and data

For repeatable local database development and access-control tests, use the separate [local Supabase workflow](supabase/README.md). It preserves the original schema as a versioned migration and does not require a hosted project.

1. Create a Supabase project and open its SQL Editor.
2. For a brand-new empty project, run the current contents of `supabase/schema.sql` once. For a project created from an earlier Kartu schema, apply the versioned migrations in `supabase/migrations/` instead of rerunning the one-file setup script.
3. In Supabase project settings, copy the Project URL and the publishable key (or legacy anon key).
4. Copy `config.example.js` to `config.js`, then enter those two values. `config.js` is ignored by Git. **Never use the service-role key in this browser app.**
5. In Supabase Authentication URL settings, set the local Site URL to `http://localhost:8000` and add `http://localhost:8000/**` to allowed redirect URLs. Password reset uses the current app URL, so it must be allowed. Add your final HTTPS domain before sending real reset emails.
6. Reload the local site. It will show the sign-in screen. Create your first account and confirm its email if Supabase email confirmation is enabled.
7. Promote your account to admin in the Supabase SQL Editor, replacing the email:

   ```sql
   select kartu_private.set_account_role(
     (select id from auth.users where email = 'you@example.com'), 'admin'
   );
   ```

8. Sign out and back in. New buyers can now create accounts. To approve a supplier, have them sign up, then run this SQL as the project owner, replacing the email and supplier details:

   ```sql
   select kartu_private.set_account_role(
     (select id from auth.users where email = 'supplier@example.com'), 'supplier'
   );

   insert into public.suppliers (user_id, public_name, about, approved)
   select id, 'Supplier name', 'Short description', true
   from auth.users where email = 'supplier@example.com'
   on conflict (user_id) do update set approved = true;
   ```

With Supabase configured, reservations and offers are stored in the shared database and RLS policies enforce access. Reservations are validated in a database transaction so concurrent buyers cannot exceed available stock. The database also caps each account at 15 reservation writes per five minutes and 5 offer submissions per hour; idempotent retries do not consume another reservation attempt. The app does not process payments; payment is due at pickup.

## Account recovery, export, and deletion

- **Password recovery:** choose **Forgot password?**, request a reset link, then set a new password from the emailed link. Configure the app URL in Supabase Authentication → URL Configuration and set up a working Auth email sender before expecting email delivery. Supabase reset requests do not disclose whether an account exists; the app shows the same confirmation for either case. [Password reset guide](https://supabase.com/docs/guides/auth/passwords)
- **Export:** sign in, open the `•••` account menu, and choose **Export my data**. The app downloads JSON with the account and supplier profiles, reservations, and supplier offers owned by that account. Keep the file private because it includes pickup codes and order information.
- **Delete:** open the same menu and choose **Delete account**. The database blocks deletion while the account has reserved or ready pickups. Once active orders are resolved, it deletes the Auth account and profile. Historical reservations remain with no buyer profile link. A supplier’s active offers are closed, and its account link and public business name are removed. The last administrator must appoint another admin first. The current implementation is in `delete_my_account` and migration `20261117150000_safe_account_deletion.sql`. Deletion coordinates with marketplace writes, removes old pickup codes and supplier-authored listing text, and retains quantities, amounts, dates, and final statuses. Other buyers keep access to their reduced order history. A lost response can be retried safely.
- **Session storage:** the browser keeps the Supabase session in tab-scoped `sessionStorage` so it is cleared when that browser tab closes. JavaScript on the page can still access the token, so this does not replace a strong Content Security Policy, output escaping, or secure hosting.

The deletion behavior preserves limited transaction records with the deleted account link removed; this is not a promise of complete anonymity. Pickup addresses/instructions and supplier-authored text are scrubbed on supplier deletion. Previously downloaded exports and backups have separate retention needs. Confirm retention periods and legal obligations for Lithuania/EU with qualified counsel before opening the service to the public.

## Limits

Without Supabase configuration, offers and reservations are local demo data and are **not shared** with other people or devices. The public version still needs static hosting. A shared backend may fit within a free plan for a small pilot, but check current quotas, inactivity rules, email limits, and billing requirements before launch. The app does not send notifications or manage real food handling. Production TLS, CSP/security headers, backups, uptime alerts, MFA policy, and hosted end-to-end checks remain provider/project setup tasks; no hosted project is configured in this workspace.

Use `kartu_private.set_account_role` in the SQL Editor for role changes, including demotions. It serializes with deletion and refuses removal of the last admin. Ordinary app clients cannot call it. Direct privileged edits to Auth users or profile roles bypass these application workflows and should not be used as the normal deletion/role-change procedure.

See [STATUS.md](STATUS.md) for the completed Order 1 checks and remaining hosted work.

## Local checks

With Node.js and the local Supabase stack available, run:

```sh
node audit/regressions.cjs
supabase start
supabase test db
python3 audit/account_deletion_concurrency.py
```

The first command runs mocked frontend checks without contacting Supabase. The database suite runs against the local stack and uses synthetic fixtures that roll back. See [LAUNCH_CHECKLIST.md](LAUNCH_CHECKLIST.md) before connecting a hosted project.

## Project files

- `index.html` — app entry point
- `styles.css` — responsive layout and styling
- `app.js` — buyer, supplier, and admin flows; local demo; optional Supabase REST integration
- `config.example.js` — shared-backend configuration template
- `supabase/schema.sql` — tables, RLS policies, and transaction-safe order functions
- `LAUNCH_CHECKLIST.md` — staging, Auth, security, backup, and release steps
- `SPEC.md` — product and MVP requirements
- `manifest.webmanifest` and `icon.svg` — installable-app metadata

# Kartu — MVP specification

> **Implementation status:** the app now includes both a dependency-free local demo and optional Supabase Auth/Postgres integration. The shared mode requires a Supabase project, the SQL in `supabase/schema.sql`, and local values in `config.js`; it has not been connected to a live project in this workspace.

## Product

Kartu is a Lithuanian-first, mobile-friendly web app for finding discounted surplus food and joining neighborhood group orders for everyday goods. The pilot starts in one Vilnius neighborhood. Its working name can change later.

## Users and roles

- **Buyer:** browses offers, reserves a quantity, and collects a confirmed order.
- **Supplier:** creates offers, sets quantities and pickup details, and sees reservations for their own offers.
- **Admin:** approves suppliers and offers, manages order status, and resolves cancellations.

## Screens

1. **Home:** neighborhood selector; tabs for “Group orders” and “Surplus deals”; open and closing-soon offers.
2. **Offer details:** product, supplier, unit and price in EUR, available quantity, minimum group quantity (for group orders), deadline, pickup address and time window.
3. **Reserve / confirmation:** quantity selector, order summary, reserve action, and clear payment-at-pickup instructions.
4. **My orders:** reservation status, pickup instructions, and collection code.
5. **Supplier dashboard:** create offers; see reservation quantities and pickup codes; mark an offer ready for pickup.
6. **Admin dashboard:** approve or reject submitted offers. The first admin and supplier accounts are promoted manually in Supabase SQL for this pilot.
7. **Sign in / account:** email and password; password recovery; export account data; self-service account deletion with active-order checks.

## Main user flows

### Buyer

Sign up or sign in → choose the pilot neighborhood → open an offer → select a valid quantity → reserve → see the updated group progress and order status → collect using the displayed code.

Forgot password → request a generic confirmation → use the email link to set a new password. Account menu → download a JSON export, or confirm deletion after active orders have been resolved.

### Supplier

Sign in with an approved supplier account → create an offer → wait for admin approval → review reservation quantities and pickup codes → mark it ready → hand orders over during the displayed pickup window → mark each collected reservation completed.

### Group order lifecycle

An offer is `draft`, `pending_approval`, `open`, `minimum_reached`, `ready_for_pickup`, `completed`, `cancelled`, or `expired`. Reservations are accepted only while an offer is open and stock remains. Reservation requests use an idempotency key so retries do not create duplicate orders. Reaching the minimum changes the visible progress/status; payment is collected by the supplier at pickup. No card details are collected in this MVP.

## Data to save

- **profiles:** auth user ID, display name, phone, role, neighborhood.
- **neighborhoods:** name, city, active status.
- **suppliers:** owner user ID, public name, short description, approval status. The owner link becomes nullable on account deletion; supplier offers close and supplier-authored text, addresses, instructions, and old pickup codes are removed; redaction timestamps are retained.
- **offers:** supplier, neighborhood, offer type (`group_buy` or `surplus`), title, description, image URL, unit, price in euro cents, available quantity, minimum quantity, deadline, pickup address/window, status.
- **reservations:** offer, nullable buyer link, quantity, total in euro cents, short pickup code, status, created time. Deletion detaches the profile link from retained history.

## Technology and cost assumptions

- **Frontend:** dependency-free HTML, CSS, and JavaScript. The app is mobile-friendly and includes install metadata.
- **Shared backend:** optional Supabase Auth + Postgres integration. The SQL schema enables RLS for exposed tables and uses a transaction-backed function for reservation validation.
- **Authentication and privacy:** password reset uses Supabase Auth email links; session tokens are kept in tab-scoped `sessionStorage`. A user can export their profile, supplier profile, reservations, and supplier offers as JSON. The database refuses deletion with active pickups, deletes the Auth/profile row, detaches retained order history, and scrubs deleted suppliers’ listing text and pickup information. Marketplace writes coordinate with deletion using account/supplier/offer/reservation locks. Guarded deletion and operator role changes preserve the last admin; missing-profile tokens cannot mutate the app. Limited transaction history remains, without claiming complete anonymity.
- **Abuse limits:** database triggers cap buyer reservations at 15 writes per 5 minutes and supplier offer submissions at 5 per hour, per account. Same-key reservation retries remain idempotent. Supabase Auth has separate provider-level rate limits.
- **Local development:** run with Python's built-in static HTTP server. In demo mode, sample listings and orders persist in browser storage. Shared mode reads the Supabase URL and publishable key from ignored `config.js`.
- **Budget:** no paid APIs, maps, SMS, or payment processing in v1. Reserve and pay at pickup. Supabase free tier is the intended pilot backend; check current limits and billing requirements before relying on it. Shared use across different devices requires the configured backend and internet access.
- **Hosting:** local-only is free but only available on that computer. A public link requires a hosting provider and a configured shared backend; do not deploy without checking current provider pricing/limits.

## MVP exclusions

No offer editing, supplier application/approval screen, account profile editing, home delivery, in-app card payments, supplier payouts, chat, loyalty program, push/SMS notifications, subscriptions, or chilled meat/dairy offers. Supplier onboarding starts with manual admin setup. Start with shelf-stable goods, household products, and bakery surplus.

## Pass/fail release checklist

- [x] The dependency-free demo starts locally using the README instructions.
- [x] Responsive buyer, supplier, and admin screens and the local-demo reserve, pickup, and approval flows are implemented.
- [x] Demo orders, listing creation, approvals, and pickup statuses persist in browser storage.
- [x] Demo mode is labelled and states that data is only on this device.
- [x] Shared-mode sign-up/sign-in, reads, and mutation calls are wired to Supabase.
- [x] SQL RLS policies and transaction-backed reservation functions are included.
- [x] Shared data queries use bounded 50-row pages and 15-second request timeouts.
- [x] Idempotent reservation retries and supplier completion of collected pickups are implemented.
- [x] Password recovery, account export, and protected account deletion are implemented in the app and SQL migrations.
- [x] Server-side per-account write limits cover reservations and supplier offers.
- [x] Local pgTAP RLS and order-lifecycle suite passes (154 checks, local Supabase only).
- [ ] Connect a real Supabase project and verify authentication, access rules, and reservation flow.
- [ ] Verify password recovery emails, account export, and deletion against a hosted test project.
- [ ] Visually verify current changes at phone and desktop widths in a browser. Local browser access is unavailable in this Codex chat.
- [ ] Configure production security headers/CSP, MFA requirements, monitoring, uptime alerts, and backup/restore procedures for the chosen host and Supabase project.
- [ ] Review data retention and food-handling requirements with qualified local counsel before launch.
- [ ] Configure a public host if users outside the local computer need access.

## Run instructions

Run `python3 -m http.server 8000` and open `http://localhost:8000`. Without Supabase credentials, the app starts in labelled demo mode. To enable shared mode, follow the Supabase setup section in `README.md`.

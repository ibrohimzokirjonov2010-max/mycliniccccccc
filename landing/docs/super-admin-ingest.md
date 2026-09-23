# Super Admin ingest

Landing purchases and free trials are written into the same Supabase project the CRM Super Admin portal already reads (`public.clinics` and `public.users`). The portal page is `https://app-shahobidin-4.vercel.app/super-admin-portal`. There is no separate subscriptions API on the CRM.

Activation does not wait on a successful CRM write. The landing license is opened first. The ingest runs in the same request and any CRM error is logged, not returned to Payme, Click, or the buyer.

## Data layer

Nexus SuperAdmin (`src/pages/SuperAdmin.jsx`, routes `/super-admin` and `/super-admin-portal`) loads `base44.clinic.getAll()` and `base44.auth.getAllUsers()`.

- Online, those calls read Supabase `public.clinics` and `public.users`. `getAll` then copies clinics into the browser key `system_clinics`. The System tab label "LocalStorage Sync" is that offline fallback.
- The landing server cannot write the CEO's browser storage. It upserts the same Supabase rows. The next portal load copies them into localStorage.
- Native payment columns are `monthly_fee` and `last_payment_date`. **To'lovni Qabul Qilish** only used to set `last_payment_date`. It now also appends a ledger row.
- There is no `clinic_payments` table and no Payme/Click client in the CRM. The ledger is `payment_ledger` inside the clinic `logo` blob (the same `[EXT]…[/EXT]` envelope SuperAdmin already decodes). A SQL `clinic_payments` table is the upgrade if finance needs to query payments outside the portal.

## When a row is created

| Event | `subscription_status` | CRM `clinics.status` | Access |
| --- | --- | --- | --- |
| Payme `PerformTransaction`, Click complete that opens a license, or demo pay | `active` | `Active` | unlocked for 30 days, `monthly_fee` = landing tariff, `last_payment_date` set |
| Payme `CancelTransaction` after perform, or a cancelled license | `expired` | `Expired` | locked, the original ledger row stays |
| `POST /api/demo` (Bepul demo) or `POST /api/auth/register` | `trialing` | `Active` | unlocked for 14 days, amount 0, no `last_payment_date` |

A Click or Payme callback that never opens a license does not create a clinic. Clinic id is stable: `c` + the first 10 characters of the order id, or `t` + the first 10 characters of the trial id. Repeating the webhook updates the same row and keeps the temporary password.

## CRM columns

`clinics`: `id`, `name` (clinic), `password` (temporary), `expires_at` (`YYYY-MM-DD`), `status` (`Active` or `Expired`), `monthly_fee` (UZS, `0` for trial), `last_payment_date` (paid only), `plan`.

`plan` only allows `basic` and `pro` on some databases. The map is `landing/config/shifo-tariffs.json` (also imported by the landing price list and by the Nexus clinic form):

| Landing tariff | Monthly UZS | CRM `plan` | `subscription_status` when paid |
| --- | ---: | --- | --- |
| Start | 990000 | `basic` | `active` |
| Pro | 1990000 | `pro` | `active` |
| Klinika | 3490000 | `pro` | `active` |
| Trial | 0 | `basic` | `trialing` |

The Nexus form for a clinic created by hand still offers the older fees in that same file: BASIC `99000`, PRO `189000`. Landing fees are not rewritten to those amounts. A clinic that already has a `tariff` field keeps the landing plan.

`users`: one clinic-owner row, `id` `user-{clinicId}`, `role` `admin`, `commission_rate` 0, `name` / `full_name` the doctor, `phone`, `notes` the email, same temporary password. SuperAdmin **Kirish** picks the admin user.

Fields the `clinics` table has no column for are stored in `logo` with the prefix the CRM already decodes:

```text
[EXT]{"phone":"+998901234567","email":"a@b.uz","doctor_name":"Akmal Karimov","payment_method":"payme","tariff":"pro","billing_status":"paid","subscription_status":"active","period_ends_at":"2026-10-22","access_unlocked":true,"license_key":"SHIFO-PRO-....","payment_ledger":[{"id":"pay-ORDER","amountUzs":1990000,"method":"payme","paidAt":"2026-09-22","subscriptionStatus":"active","orderId":"ORDER","note":"Pro to'lovi"}]}[/EXT]
```

`payment_method` is `payme`, `click`, `mock`, or `trial`. `subscription_status` is `trialing`, `active`, or `expired`. `billing_status` stays `trial`, `paid`, or `expired` for older rows. `tariff` is `start`, `pro`, `klinika`, or `trial`. `payment_ledger` is appended once per order or trial. Repeating a webhook does not add a second row. Manual **To'lovni Qabul Qilish** and **+Muddat** append a `manual` row and set `last_payment_date`.

The portal shows clinic name, mapped plan, monthly fee, expiry, password, and the doctor in the users list as soon as the row exists. Doctor, phone, email, tariff name, billing status, payment method, and access text render after the CRM project that contains this repo's `SuperAdmin.jsx` is deployed.

## Self-serve trial (`Ro'yxatdan o'tish`)

`POST /api/auth/register` collects the owner's name, a password, a clinic name or a doctor name, and a phone or email. It stages the same 14-day trial row as `POST /api/demo`, then upserts `clinics` and `users`.

The password is bcrypt-hashed before it is written. `users.password` and `clinics.password` store that hash, never the plaintext. CRM login already calls `bcrypt.compare`, so the hash signs in. SuperAdmin **reveal** shows the hash for these rows because the owner chose the password. Paid checkout temporary passwords stay recoverable for the existing success page.

Login is `POST /api/auth/login` with `identifier` (phone, email, or username) and `password`. A match returns a 2-minute HMAC handoff (`LICENSE_SIGNING_SECRET`) to `{NEXT_PUBLIC_APP_URL}/login#handoff=…&from={landing origin}`. The CRM login page redeems `POST /api/auth/handoff` only when `VITE_LANDING_URL` equals that origin, then writes the same localStorage session as a normal clinic login.

## Environment

| Variable | Purpose |
| --- | --- |
| `CRM_SUPABASE_URL` | CRM Supabase URL. Default is the project already hardcoded in `src/api/supabaseClient.js` |
| `CRM_SUPABASE_KEY` | Key with insert/update on `clinics` and `users`. Default is that project's anon key. RLS is off in `FIX_ALL_SUPABASE_NOW.sql` |
| `CRM_SUPABASE_DISABLED` | `1` skips the CRM write. Tests set this |
| `LANDING_ADMIN_TOKEN` | Bearer token for `GET /api/admin/subscriptions` |

Set `CRM_SUPABASE_URL` and `CRM_SUPABASE_KEY` on the landing Vercel project when the CRM database changes. Leave them empty to write into the current portal database.

## Read API

`GET /api/admin/subscriptions` with `Authorization: Bearer $LANDING_ADMIN_TOKEN`.

```json
{
  "subscriptions": [
    {
      "id": "c0123abcd",
      "doctorName": "Akmal Karimov",
      "clinicName": "Smile Stomatologiya",
      "phone": "+998901234567",
      "email": "akmal@smile.uz",
      "planId": "pro",
      "planName": "Pro",
      "status": "paid",
      "amountUzs": 1990000,
      "paymentMethod": "payme",
      "accessUnlocked": true,
      "startedAt": "2026-09-22T12:00:00.000Z",
      "expiresAt": "2026-10-22T12:00:00.000Z",
      "paidAt": "2026-09-22T12:00:00.000Z",
      "licenseKey": "SHIFO-PRO-XXXX-XXXX",
      "orderId": "0123abcd...",
      "leadId": null,
      "temporaryPassword": "Shifoab12cd",
      "updatedAt": "2026-09-22T12:00:00.000Z"
    }
  ]
}
```

The browser portal must not call this route. The token would ship in the client. The portal reads Supabase directly.

Landing also keeps the same objects in its own store (`subscriptions` inside `landing_store` or `landing/.data/store.json`) so the read API still works when the CRM write fails.

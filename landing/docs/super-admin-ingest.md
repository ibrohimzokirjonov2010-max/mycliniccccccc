# Super Admin ingest

Landing purchases and free trials are written into the same Supabase project the CRM Super Admin portal already reads (`public.clinics` and `public.users`). The portal page is `https://app-shahobidin-4.vercel.app/super-admin-portal`. There is no separate subscriptions API on the CRM.

Activation does not wait on a successful CRM write. The landing license is opened first. The ingest runs in the same request and any CRM error is logged, not returned to Payme, Click, or the buyer.

## When a row is created

| Event | Landing status | CRM `clinics.status` | Access |
| --- | --- | --- | --- |
| Payme `PerformTransaction`, Click complete (`error` 0 and order becomes active), or demo pay | `paid` | `Active` | unlocked for 30 days |
| Payme `CancelTransaction` after perform, or a cancelled license | `expired` | `Expired` | locked |
| `POST /api/demo` (Bepul demo) | `trial` | `Active` | unlocked for 14 days, amount 0 |

A Click or Payme callback that never opens a license does not create a clinic. Clinic id is stable: `c` + the first 10 characters of the order id, or `t` + the first 10 characters of the trial id. Repeating the webhook updates the same row and keeps the temporary password.

## CRM columns

`clinics`: `id`, `name` (clinic), `password` (temporary), `expires_at` (`YYYY-MM-DD`), `status` (`Active` or `Expired`), `monthly_fee` (UZS, `0` for trial), `last_payment_date` (paid only), `plan`.

`plan` only allows `basic` and `pro` on some databases. Landing maps Start and trial to `basic`, and Pro and Klinika to `pro`. The real tariff is inside `logo`.

`users`: one doctor row, `id` `user-{clinicId}`, `role` `doctor`, `name` / `full_name` the doctor, `phone`, `notes` the email, same temporary password.

Fields the `clinics` table has no column for are stored in `logo` with the prefix the CRM already decodes:

```text
[EXT]{"phone":"+998901234567","email":"a@b.uz","doctor_name":"Akmal Karimov","payment_method":"payme","tariff":"pro","billing_status":"paid","access_unlocked":true,"license_key":"SHIFO-PRO-...."}[/EXT]
```

`payment_method` is `payme`, `click`, `mock`, or `trial`. `billing_status` is `trial`, `paid`, or `expired`. `tariff` is `start`, `pro`, `klinika`, or `trial`.

The portal shows clinic name, mapped plan, monthly fee, expiry, password, and the doctor in the users list as soon as the row exists. Doctor, phone, email, tariff name, billing status, payment method, and access text render after the CRM project that contains this repo's `SuperAdmin.jsx` is deployed.

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

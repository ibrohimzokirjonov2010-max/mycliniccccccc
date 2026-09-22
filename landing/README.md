# SHIFO CRM landing

Marketing site for clinic owners. The clinic CRM stays at the repository root and is a separate Vite app. This Next.js app lives only in `landing/` and deploys as its own Vercel project.

```bash
cd landing
npm install
npm run dev
```

Open http://localhost:3000.

## Tariffs

Prices and the Nexus plan map are in `config/shifo-tariffs.json` (Start → BASIC, Pro and Klinika → PRO). The portal form for a hand-created clinic still uses the older BASIC 99 000 / PRO 189 000 fees from that same file. Landing charges the Start / Pro / Klinika prices.

| Plan | Price | |
| --- | ---: | --- |
| Start | 990 000 | |
| Pro | 1 990 000 | recommended |
| Klinika | 3 490 000 | |

`Sotib olish` collects name, phone, email, and an optional clinic name, then sends the buyer to Payme or Click. The webhook checks the signature and amount, then opens a 30-day license for that plan. The success page links to `NEXT_PUBLIC_APP_URL` (default `https://app-shahobidin-4.vercel.app`).

A verified payment (Payme, Click, or demo pay) and a free trial (`Bepul demo`, 14 days) are also written to the CRM Super Admin database. The buyer still gets the license if that write fails. See [docs/super-admin-ingest.md](docs/super-admin-ingest.md).

## Environment

Copy `env.example` to `.env.local`.

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | CRM link on Kirish and the success page |
| `NEXT_PUBLIC_SITE_URL` | Public URL of this landing, used as the Payme/Click return URL |
| `NEXT_PUBLIC_APP_LABEL` | Footer label, default `app.shifo.uz` |
| `LICENSE_SIGNING_SECRET` | Signs the success token. Set this in production |
| `PAYME_MERCHANT_ID` | Payme checkout merchant id |
| `PAYME_SECRET_KEY` | Payme Basic password (`PAYME_LOGIN`, default `Paycom`) |
| `CLICK_MERCHANT_ID` | Click merchant id |
| `CLICK_SERVICE_ID` | Click service id |
| `CLICK_SECRET_KEY` | Click MD5 secret |
| `SUPABASE_URL` | Optional durable store |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key. Never expose it to the browser |
| `LANDING_DATA_DIR` | Optional JSON store directory |
| `CRM_SUPABASE_URL` | CRM database. Empty uses the portal's current Supabase project |
| `CRM_SUPABASE_KEY` | Insert key for `clinics` and `users`. Empty uses the portal anon key |
| `CRM_SUPABASE_DISABLED` | `1` skips the Super Admin write |
| `LANDING_ADMIN_TOKEN` | Bearer token for `GET /api/admin/subscriptions` |

Leave Payme or Click empty to use **demo pay** for that provider. Demo pay does not charge a card. It calls the same `activateOrder` path as a verified webhook and then opens the success page. When a provider's keys are set, demo pay for that provider is rejected.

Webhook URLs for the landing domain:

- Payme: `POST /api/webhooks/payme`
- Click prepare: `POST /api/webhooks/click/prepare`
- Click complete: `POST /api/webhooks/click/complete`

Payme amount is checked in tiyin (`UZS × 100`). Click amount is checked in so'm. A bad signature, unknown order, or mismatched sum does not open a license. Cancelling a completed Payme transaction revokes the license.

## Storage

`npm run dev` and `npm run start` write `landing/.data/store.json` (gitignored). That file is enough for one Node process.

On Vercel the disk is not shared between functions. For real Payme/Click webhooks, create the table in `supabase/landing_store.sql` and set `SUPABASE_URL` plus `SUPABASE_SERVICE_ROLE_KEY`. The landing app stores orders, licenses, and a copy of each subscription in that table. Paid and trial customers are also upserted into the CRM tables `public.clinics` and `public.users`, which Super Admin already lists. Details and the read API are in `docs/super-admin-ingest.md`.

Demo pay still completes without Supabase because the success page accepts a signed token.

## Second Vercel project

Keep the existing CRM project pointed at the repository root (Vite, output `dist`). Add a **second** project for this site:

1. Vercel → Add New → Project → import this GitHub repository.
2. Set **Root Directory** to `landing`.
3. Framework preset: Next.js. Build command `npm run build`, output left as Next.js default. Do not reuse the root `vercel.json` (that file belongs to the CRM).
4. Add the variables from `env.example`. Production needs `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `LICENSE_SIGNING_SECRET`, and either merchant keys or no keys for demo pay. Leave `CRM_SUPABASE_URL` empty to write new clinics into the portal database. Set `LANDING_ADMIN_TOKEN` if you want the subscriptions read API.
5. For live payments, set the Supabase variables and run `supabase/landing_store.sql`.
6. Deploy. Point Payme and Click webhooks at this deployment, not at the CRM project.

## Scripts

```bash
npm test       # Payme, Click, and activation
npm run build
```

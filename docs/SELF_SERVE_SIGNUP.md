# O'z-o'ziga xizmat: klinika ro'yxati

`/register` sahifasi yangi klinikani serverda yaratadi (`POST /api/auth?action=signup`, service role). Brauzer `clinics` yoki `users` ga to'g'ridan-to'g'ri yozmaydi. Sessiya shu javobdagi Supabase Auth JWT (`app_metadata.clinic_id`, `crm_role`, `crm_user_id`) orqali ochiladi va foydalanuvchi boshqaruv paneliga o'tadi.

Tarif bo'sh yoki noma'lum bo'lsa **basic**. Landingdan `?plan=pro` yoki `premium` kelsa, shu tarif saqlanadi. `trial_ends_at` va `expires_at` = Toshkent buguni + 14 kun. Parol kamida 8 belgi. Band login maydonida «Bu login band».

Karta qadami mavjud Click oqimidan foydalanadi (`api/card/*`, `docs/CARD_BINDING.md`). `VITE_CARD_BINDING_REQUIRED` o'chiq bo'lsa, karta so'ralmaydi.

Sinov tugagach `GET /api/cron/charge-trials` (vercel.json, `0 3 * * *` UTC) saqlangan token bilan yechadi. Urinish `clinic_payment_charges` ga yoziladi (bir kunda bir marta). Muvaffaqiyatsiz bo'lsa klinika `past_due` + `access_mode=read_only`: kirish ochiq, yozish yopiq, sariq banner chiqadi. 3 ta ketma-ket xatodan keyin qayta yechilmaydi. Tarmoq javobsiz qolsa (`unknown`) qayta yechilmaydi.

## Yangi migratsiya (productionga yozilmagan)

`supabase/migrations/20261118140000_signup_readonly_rls.sql`

Phase 1 (`20261118120400_phase1_plan_rls.sql`) dan keyin, qo'lda, zaxiradan so'ng. Jadval qatorlarini o'zgartirmaydi. Qaytarish: `supabase/rollbacks/20261118140000_signup_readonly_rls_rollback.sql`.

`clinic_payment_methods` va `clinic_payment_charges` avvalgi migratsiyada. Ularni bu PR qayta yaratmaydi.

## Muhit o'zgaruvchilari

Yangi nom yo'q. Ro'yxat va yechish uchun mavjudlar:

| Nomi | Qayerda | Vazifasi |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | build | Supabase loyiha URL |
| `VITE_SUPABASE_ANON_KEY` | build | Brauzer kaliti (service role emas) |
| `VITE_CARD_BINDING_REQUIRED` | build | `1` bo'lsa karta qadami majburiy. Bo'sh bo'lsa karta so'ralmaydi |
| `SUPABASE_URL` | server | Bo'sh bo'lsa `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | server | Klinika yaratish, sessiya, karta yozuvi. Brauzerga chiqmasin |
| `CLICK_SERVICE_ID` | server | Click |
| `CLICK_MERCHANT_USER_ID` | server | Click Auth |
| `CLICK_SECRET_KEY` | server | Faqat server |
| `CRON_SECRET` | server | Vercel Cron `Authorization: Bearer` |
| `CARD_BINDING_SECRET` | server | Ixtiyoriy. Bo'sh bo'lsa `CLICK_SECRET_KEY` dan olinadi |

## Supabase dashboard (qo'lda)

Loyiha: `zvyggjldzkxwufpnaatr`.

1. Authentication → Providers → Google ni yoqing. Google Cloud dan Client ID va Client Secret qo'ying (kalitlarni repoga yozmang).
2. Authentication → URL Configuration → Redirect URLs:
   - `https://<crm-domeni>/register`
   - `http://localhost:5173/register` (mahalliy sinov)
3. Site URL ni CRM domeniga qo'ying.
4. Google Cloud OAuth clientda Authorized redirect URI: Supabase bergan `https://zvyggjldzkxwufpnaatr.supabase.co/auth/v1/callback`.
5. Migratsiyani SQL Editor da ishga tushiring (yuqoridagi tartib). Bu PR uni productionga yozmagan.

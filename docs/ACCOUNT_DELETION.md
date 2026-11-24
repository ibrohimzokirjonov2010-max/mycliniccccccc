# Hisobni o'chirish (Apple 5.1.1(v))

Mobil ilova o'z CRM loginini o'chirishi uchun. Klinika tibbiy va moliyaviy yozuvlari (bemor, qabul, to'lov) o'chirilmaydi.

Bu hujjatdagi migratsiya **ishga tushirilmagan**. Agent uni jonli bazaga yozmagan.

## So'rov

`POST /api/auth?action=delete-account`

```http
POST /api/auth?action=delete-account
Authorization: Bearer <access_token>
Content-Type: application/json

{"confirm": true}
```

```bash
curl -sS -X POST 'https://<crm-host>/api/auth?action=delete-account' \
  -H 'Authorization: Bearer <access_token>' \
  -H 'Content-Type: application/json' \
  -d '{"confirm":true}'
```

`<access_token>` — `POST /api/auth?action=login` javobidagi `session.access_token`.

`confirm` aynan JSON boolean `true` bo'lishi kerak. `"true"` qabul qilinmaydi.

Parol so'ralmaydi va e'tiborsiz. Tasodifiy POST ni to'xtatish uchun `confirm` yetarli: chaqiruvchi allaqachon bearer sessiya bilan tasdiqlangan. Kelgan parol saqlanmaydi va logga yozilmaydi.

`user_id` yoki `clinic_id` tanada yuborilsa, e'tiborsiz. O'chiriladigan login faqat shu tokenning `app_metadata.crm_user_id` si. `user_metadata` ishlatilmaydi.

## Javoblar

| Status | Body | Qachon |
| --- | --- | --- |
| 200 | `{"ok":true,"deleted":true}` | Shifokor, qabulxona yoki boshqa faol admin bor klinikadagi admin/egasi. Shu login o'chirildi. |
| 200 | `{"ok":true,"deletion_requested":true,"message":"..."}` | Oxirgi faol admin yoki ega. Login yopildi, klinika saqlanadi, so'rov yozildi. `message` o'zbekcha — ilova shu matnni ko'rsatishi kerak. |
| 400 | `{"ok":false,"error":"confirm_required"}` | `confirm: true` yo'q. |
| 401 | `{"ok":false,"error":"unauthorized"}` | `Authorization: Bearer` yo'q, token yaroqsiz, CRM qatori yo'q, yoki login allaqachon yopilgan. |
| 403 | `{"ok":false,"error":"forbidden"}` | Platforma superadmini, yoki foydalanuvchida `clinic_id` yo'q. |
| 403 | `{"ok":false,"error":"forbidden_origin"}` | Brauzer `Origin` hosti so'rov hostiga teng emas. Mobil ilova `Origin` yubormasa, bu chiqmaydi. |
| 405 | `{"ok":false,"error":"method_not_allowed"}` | POST emas. |
| 409 | `{"ok":false,"error":"last_admin","message":"..."}` | Oxirgi admin, lekin `clinic_deletion_requests` jadvali hali yo'q. Hech narsa o'zgarmaydi. |
| 409 | `{"ok":false,"error":"account_referenced","message":"..."}` | `users` qatori boshqa yozuvga bog'langan (FK). Login, parol va klinika yozuvlari joyida qoladi. |
| 429 | `{"ok":false,"error":"too_many_requests"}` | Shu IP dan 10 daqiqada 5 tadan ko'p. |
| 500 | `{"ok":false,"error":"db_error"}` | So'rov yozilmadi yoki login yopilmadi. Klinika yozuvlari o'chirilmaydi. |
| 500 | `{"ok":false,"error":"server_error"}` | Kutilmagan server xatosi. |
| 503 | `{"ok":false,"error":"server_not_configured"}` | `SUPABASE_SERVICE_ROLE_KEY` yo'q. |

Oxirgi admin bloklanganda (`409 last_admin`) `message`:

> Siz ushbu klinikaning oxirgi administratori yoki egasisiz. Hisobingiz o'chirilmadi, chunki klinika egasiz qolmasligi kerak. Administratorni boshqa xodimga o'tkazish yoki klinikani yopish uchun qo'llab-quvvatlashga yozing: https://t.me/dentist_shaxin. Bemorlar, qabullar va to'lovlar o'chirilmaydi.

So'rov qabul qilinganda (`200 deletion_requested`) `message`:

> Hisobingizni o'chirish so'rovi qabul qilindi. Kirish yopildi. Klinika ma'lumotlari — bemorlar, qabullar va to'lovlar — saqlanadi. Qo'llab-quvvatlash so'rovni ko'rib chiqadi: https://t.me/dentist_shaxin.

Bog'langan yozuv (`409 account_referenced`) `message`:

> Hisobingiz hozircha o'chirilmadi: klinikadagi yozuvlar shu xodimga bog'langan. Bemorlar, qabullar va to'lovlar o'zgartirilmadi. Qo'llab-quvvatlashga yozing: https://t.me/dentist_shaxin.

## Kim o'chiriladi

Faqat chaqiruvchining logini:

- `public.users` dagi shu qator (oxirgi admin emas bo'lsa)
- `crm_private.user_passwords` dagi shu `user_id` hash'i. `crm_account_delete_login` users qatori va hash ni bitta tranzaksiyada o'chiradi: FK rad etsa, ikkalasi ham qoladi
- Shu foydalanuvchining Supabase Auth sessiyalari: `auth.admin.signOut(access_token, 'global')`, so'ng auth user `deleteUser`
- Auth user id: `shadowId('user:' + crmUserId)` (`api/_lib/crmSession.js`). Qatorda `auth_user_id` yoki `supabase_user_id` bo'lsa, ular ham. Token egasi bo'lgan auth user ham.

`main` da Google / Supabase Auth bog'lanishi yo'q. PR #66 Google tokenidan faqat ism va email o'qiydi va CRM sessiyasini baribir `user:<id>` soyasida yaratadi. Google auth user id `users` qatoriga yozilmaydi, shuning uchun bu endpoint uni o'chirmaydi. Keyinroq `auth_user_id` yoki `supabase_user_id` ustuni qo'shilsa, shu id ham o'chiriladi.

## Nima o'chirilmaydi

Bemorlar, qabullar, to'lovlar, klinikalar, boshqa xodimlar va boshqa klinika yozuvlari. Eski qabuldagi `doctor_name` matni tibbiy yozuv sifatida qoladi.

Oxirgi faol admin yoki ega (`role` `admin` yoki `owner`, `login_disabled` emas) klinikada yagona bo'lsa, uning `users` qatori o'chirilmaydi. Boshqa klinikadagi admin hisobga olinmaydi. `login_disabled = true` bo'lgan admin "faol" emas.

Shu holda, jadval mavjud bo'lsa:

1. `clinic_deletion_requests` ga `pending` qator (parol va bemor ma'lumoti yo'q: `clinic_id`, `user_id`, `username`, `role`).
2. Login yopiladi: `login_disabled = true` va parol hash'i tasodifiy bcrypt (`crm_account_disable_login`). Eski parol bilan kira olmaydi.
3. Sessiyalar bekor qilinadi va soya auth user o'chiriladi. Keyingi muvaffaqiyatli kirish `mintSession` orqali uni qayta yaratadi.
4. `200` va `deletion_requested: true`.

Jadval yo'q bo'lsa (migratsiya yurmagan): `409 last_admin`. Login, parol va qator o'zgarmaydi.

Shifokor yoki qabulxona yagona xodim bo'lsa ham, uning logini o'chiriladi. Klinika qatorlari qoladi. Bu faqat admin/ega uchun to'xtatiladi.

`login_disabled = true` bo'lgan foydalanuvchi yangi sessiya ololmaydi (`login` va `handoff` → `403 {"ok":false,"error":"account_disabled"}`). Eski access token `readSession` da rad etiladi (`401`). Noto'g'ri parol avvalgidek `401 invalid_credentials`.

## Audit

Alohida umumiy audit jadvali yo'q. `implants.audit_log` klinik yozuv — bu yerga tegilmaydi.

Migratsiya `account_deletion_events` ni qo'shadi: `clinic_id`, `user_id`, `username`, `role`, `action` (`deleted` yoki `deletion_requested`), `created_at`. Parol, telefon, ism va bemor ma'lumoti yo'q. Jadval hali yo'q bo'lsa, o'chirish baribir tugaydi.

Ikkala jadvalda RLS yoqilgan, policy yo'q, `anon` / `authenticated` dan huquq olingan. Faqat service role.

## Migratsiya (yozilmagan)

Fayl: `supabase/migrations/20261124180000_account_deletion.sql`

Operator zaxiradan keyin, SQL Editor da, qo'lda ishga tushiradi. Bu PR uni `zvyggjldzkxwufpnaatr` ga yozmagan.

Qiladigan ishi:

- `public.users.login_disabled boolean NOT NULL DEFAULT false` (mavjud loginlar ochiq qoladi)
- `public.clinic_deletion_requests`, `public.account_deletion_events`
- `crm_private.account_delete_login` / `account_disable_login` (SECURITY DEFINER, search_path qat'iy) va `public.crm_account_*` (SECURITY INVOKER, faqat service role). `account_delete_login` faqat shu user id ning `users` qatori va parol hash ini o'chiradi
- `public.users` ga qaragan, NULL bo'lishi mumkin bo'lgan bitta ustunli FK larni `ON DELETE SET NULL` qiladi, shunda login o'chsa klinika qatori o'chmaydi. Eski `ON DELETE` `crm_private.account_deletion_fk_backup` ga yoziladi. `NOT NULL` FK lar o'zgarmaydi — shunda endpoint `409 account_referenced` qaytaradi.

Qaytarish: `supabase/rollbacks/20261124180000_account_deletion_rollback.sql`

- funksiyalarni o'chiradi
- `login_disabled` ustunini o'chiradi
- ikkala jadvalni o'chiradi
- backup dagi FK larni eski `ON DELETE` ga qaytaradi (oldingi qiymat CASCADE bo'lgan bo'lsa, CASCADE qaytadi; faylning o'zi klinika qatorini o'chirmaydi)
- backup jadvalini o'chiradi

## Qo'llab-quvvatlash: loginni qayta ochish

So'rov qabul qilingandan keyin xodim kira olmaydi. Klinikani boshqa adminga o'tkazish yoki yopish qo'llab-quvvatlashda. Loginni qayta ochish kerak bo'lsa, yangi parolni **ikkala** joyga yozing (`users.password` va `crm_private.user_passwords`) va `login_disabled = false` qiling. Keyin xodim oddiy login bilan kiradi, sessiya qayta yaratiladi.

## Tekshiruv

```bash
node scripts/assert-account-deletion.mjs
npx vite build
```

## PR #66 va #67

- #66 `api/auth.js` dagi import, login muddati va `limits` qatoriga tegadi. Bu PR `limits` ga `'delete-account': 5` qo'shadi — birlashtirishda ikkala kalit qolsin. Google auth user id bu yerda saqlanmaydi.
- #67 `api/auth.js` ga tegmaydi. Uning migratsiyasi `20261118150000_...`, bu PR niki `20261124180000_...`.

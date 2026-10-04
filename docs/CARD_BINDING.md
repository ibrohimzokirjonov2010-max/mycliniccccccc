# 14 kunlik sinov uchun karta biriktirish (Click Card Token)

## Oqim
1. `/register` (Klinika Admin): ma'lumotlar → **Davom etish**.
2. "14 kunlik bepul sinov uchun kartangizni kiriting": karta raqami + amal qilish muddati → Click SMS-kod → tasdiqlash.
3. Pastda majburiy checkbox (rozilik + oferta / maxfiylik havolalari). Belgilanmaguncha va karta tasdiqlanmaguncha **CRM'ga kirish** tugmasi nofaol.
4. Tugma bosilganda: klinika yaratiladi (14 kun trial, mavjud mantiq) → `POST /api/card/attach` token'ni DB'ga yozadi → CRM.
5. Sinov tugagan kuni (cron) tarif narxi token bilan yechiladi.

Xulosa kartasi: tarif nomi, narx, birinchi yechilish sanasi (bugun + 14 kun).

## Fayllar
| Fayl | Vazifasi |
| --- | --- |
| `src/pages/Register.jsx` | 2 qadamli oqim (flag bilan) |
| `src/components/register/CardBindingStep.jsx` | Karta qadami UI |
| `src/api/cardBindingClient.js` | `/api/card/*` chaqiruvlari, TEST REJIM |
| `src/config/cardBinding.js` | `VITE_CARD_BINDING_REQUIRED`, rozilik matni/versiyasi |
| `src/pages/LegalDocs.jsx` | `/oferta`, `/maxfiylik` |
| `api/card/status.js`, `request.js`, `verify.js`, `attach.js` | Click proksi + biriktirish |
| `api/cron/charge-trials.js` | Kunlik avtomatik yechish |
| `api/_lib/*` | Click klienti, imzo (proof), [EXT] kodlash, sana, narxlar |
| `supabase/migrations/20261004_clinic_payment_methods.sql` | Yangi jadvallar (qo'lda ishga tushiriladi) |
| `vercel.json` | cron (`0 3 * * *` UTC = 08:00 Toshkent) va `/api` rewrite'dan chiqarildi |
| `scripts/assert-card-binding.mjs`, `scripts/assert-card-charge-cron.mjs` | Tekshiruvlar |

## Muhit o'zgaruvchilari
Vercel → Project → Settings → Environment Variables (Production):

| Nomi | Qayerda | Izoh |
| --- | --- | --- |
| `CLICK_SERVICE_ID` | server | Click xizmat ID |
| `CLICK_MERCHANT_USER_ID` | server | `Auth` sarlavhasidagi `merchant_user_id` |
| `CLICK_SECRET_KEY` | server | **Faqat serverda**, `VITE_` prefiksisiz |
| `CLICK_MERCHANT_ID` | server | Hozir ishlatilmaydi (karta-token API talab qilmaydi); kelajak uchun |
| `SUPABASE_SERVICE_ROLE_KEY` | server | `clinic_payment_*` jadvallari va `clinics` yangilash uchun |
| `SUPABASE_URL` | server | Bo'sh qolsa `VITE_SUPABASE_URL` ishlatiladi |
| `CRON_SECRET` | server | Vercel Cron `Authorization: Bearer ...` yuboradi; bo'lmasa cron 401 qaytaradi |
| `CARD_BINDING_SECRET` | server | (ixtiyoriy) isbot imzosi kaliti; bo'lmasa `CLICK_SECRET_KEY` dan hosil qilinadi |
| `VITE_CARD_BINDING_REQUIRED` | build | `1` — karta qadami majburiy. **Default o'chiq.** |

## Yoqish tartibi
1. `supabase/migrations/20261004_clinic_payment_methods.sql` ni Supabase SQL Editor'da ishga tushiring.
2. Click kalitlari va yuqoridagi server env'larni qo'ying, redeploy.
3. `GET /api/card/status` → `{"mode":"live"}` bo'lishini tekshiring.
4. Bitta test karta bilan butun oqimni sinang (kichik summa), keyin `VITE_CARD_BINDING_REQUIRED=1` qo'yib redeploy qiling.

Kalitlarsiz (`mode: "mock"`) oqim TEST REJIMda: mock token, SMS-kod `123456`, hech narsa DB'ga yozilmaydi, pul yechilmaydi, cron "click_not_configured" bilan o'tkazib yuboradi.
`/register?card_demo=1` flagni yoqmasdan oqimni ko'rish imkonini beradi (faqat server TEST REJIMda bo'lsa; Click ulangan bo'lsa e'tiborga olinmaydi).

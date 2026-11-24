# App Review va Google Play tekshiruvi

Har bir band: holat va dalil. Parol bu faylda yo‘q.

Holatlar: **Tayyor** — kod yoki faylda bajarilgan. **Egasi** — faqat egasi qila oladi.

## Apple

| Band | Holat | Dalil |
| --- | --- | --- |
| 2.1 Ishlaydigan oqim, «tez orada» yo‘q | Tayyor | Kirish, bosh sahifa, bemor, qabul, shifokor, to‘lov va hisob ekranlari tugmalari shu ekranlarga olib boradi. `coming soon` / lorem yo‘q. `npx tsc --noEmit` va `npx expo export --platform web` o‘tgan. |
| 2.3 Matn va skrinshot haqiqiy ilovaga mos | Tayyor | `store/listing.md` shu ekranlarni tasvirlaydi. Skrinshotlar `qa_test_1811` dan, bo‘sh joy to‘ldiruvchi matn emas. |
| 4.2 Kamida foydali ilova, WebView emas | Tayyor | Expo native ekranlar. Veb faqat maxfiylik havolasi uchun ochiladi. |
| 4.0 iPad | Tayyor | `supportsTablet: true`. Keng ekranda kontent 960px ga markazlashadi (`Screen.tsx`). `plugins/withIpadOrientations.js` iPad ni to‘rt tomonga burishga ruxsat beradi. Skrinshot: `ipad-13/` 2064×2752. |
| 4.0 Qorong‘i rejim | Tayyor | `userInterfaceStyle: "light"`. Tizim qorong‘i rejimda ranglar buzilmaydi, ilova ochiq temada qoladi. Alohida qorong‘i tema e’lon qilinmagan. |
| 4.0 Xavfsiz chetlar | Tayyor | `SafeAreaView` yuqori, chap va o‘ng. Pastki tab `useSafeAreaInsets` bilan ko‘tariladi. |
| 4.0 Dynamic Type | Tayyor | `allowFontScaling={false}` yo‘q, tizim shrifti ishlaydi. Tugma va maydon `maxFontSizeMultiplier={2}`. Ekranlar `ScrollView` ichida, qat’iy balandlik bilan kesilmaydi. |
| 5.1.1 Maxfiylik ilovada va URL | Tayyor | Kirish va Hisob dan `privacy` ekrani. URL: `https://app-shahobidin-4.vercel.app/privacy` (`src/pages/StorePublicPage.jsx`, `/privacy`). |
| 5.1.1 Hisobni o‘chirish | Tayyor | Hisob → tasdiqlash oynasi → `POST /api/auth?action=delete-account`, body `{"confirm": true}`, Bearer token. 404 yoki hali chiqmagan `bad_request` da qo‘llab-quvvatlash oqimi. Veb: `/delete-account`. |
| 5.1.1 Ortiqcha ma’lumot va ruxsatlar | Tayyor | Kamera, mikrofon, joylashuv, kontakt, foto so‘ralmaydi. `Info.plist` da usage satrlari yo‘q. Parol qurilmada saqlanmaydi. |
| 5.1.2 Ma’lumotdan foydalanish | Tayyor | `store/privacy-labels.md`. Reklama SDK yo‘q, ma’lumot sotilmaydi, faqat klinika ishi. |
| Login-only B2B | Tayyor | Yagona kirish: klinika ID, login, parol. `store/review-notes.txt` buni reviewer uchun yozadi. Demo parolni egasi do‘konga yozadi, git ga emas. |
| Eksport (shifrlash) | Tayyor | `ITSAppUsesNonExemptEncryption: false`. Faqat HTTPS. |
| Sign in with Apple | Tayyor, hozir shart emas | Mobil ilovada Google, Facebook yoki Apple tugmasi yo‘q. PR #66 dagi Google yozilishi faqat vebda. U mobilga ko‘chsa, Sign in with Apple ham qo‘shilishi shart. |

## Google Play

| Band | Holat | Dalil |
| --- | --- | --- |
| Target API | Tayyor | `expo-build-properties`: `compileSdkVersion` va `targetSdkVersion` 36. SDK 58 standartiga mos. |
| 64-bit | Tayyor | `buildArchs`: `arm64-v8a` va `x86_64` (32-bit `armeabi-v7a` ham bor). |
| Data safety | Tayyor | Javoblar `store/privacy-labels.md` da ilova yig‘adigan maydonlarga mos: ism, telefon, to‘lov summasi va usuli, qabul xizmati nomi, xodim id. Karta raqami yo‘q. |
| Hisobni o‘chirish URL | Tayyor | `https://app-shahobidin-4.vercel.app/delete-account`. Sahifa ochiq, login shart emas. |
| Reviewer kirishi | Tayyor | `store/review-notes.txt`. Klinika ID `demo_clinic`. Login va parolni egasi Play Console ga yozadi. |
| Siniq havola | Tayyor | Ilova ochadigan havolalar: `/privacy`, `/delete-account`, `https://t.me/dentist_shaxin`. |
| Play Integrity | Tayyor, kerak emas | Ilova Integrity API chaqirmaydi. |
| 12 tester | Tayyor, kerak emas | Hisob tashkilot. Yopiq testdagi 12 kishi sharti shaxsiy hisob uchun. `eas.json` track: `production`. |

## Skrinshot o‘lchamlari

| Fayl | O‘lcham | Holat |
| --- | --- | --- |
| `ios-6.7/*.png` (7 ta) | 1290×2796 | Tayyor |
| `ios-6.5/*.png` (7 ta) | 1284×2778 | Tayyor |
| `ipad-13/*.png` (7 ta) | 2064×2752 | Tayyor |
| `android-phone/*.png` (7 ta) | 1080×2400 | Tayyor |
| `play-feature-graphic.png` | 1024×500 | Tayyor |
| `play-icon-512.png` | 512×512 | Tayyor |

Har bir papkada: `01-login`, `02-home`, `03-patients`, `04-appointments`, `05-payments`, `06-doctors`, `07-account`. Ma’lumot faqat `qa_test_1811`.

## Versiya va yuborish

| Band | Holat | Dalil |
| --- | --- | --- |
| Versiya 1.0.0 | Tayyor | `app.json` `version`. |
| buildNumber / versionCode | Tayyor | Boshlang‘ich `1`. `eas.json` `appVersionSource: remote`, production `autoIncrement: true`. |
| iOS submit | Tayyor, joy egasi | `ascAppId: "0000000000"`, `appleTeamId: "XXXXXXXXXX"`. Egasining haqiqiy qiymati kerak. |
| Android submit | Tayyor, joy egasi | `serviceAccountKeyPath: ./store/google-play-service-account.json`. JSON git ga kirmaydi. |
| Veb sahifalar jonli | Egasi | `/privacy` va `/delete-account` shu PR da. Production URL ularni shu PR `main` ga qo‘shilgach ochadi. |
| Server o‘chirish | Egasi | PR #69 qo‘shilguncha ilova 404/`bad_request` da qo‘llab-quvvatlash oqimini ko‘rsatadi. |

## Faqat egasi

1. Apple Developer Program (tashkilot bo‘lsa D-U-N-S).
2. Google Play Console tashkilot hisobi va D-U-N-S tekshiruvi. 12 tester shart emas.
3. `app.myclinic.crm` band bo‘lsa, o‘z bundle id va package name.
4. `eas login`, `eas init`, haqiqiy `ascAppId` va `appleTeamId`.
5. Play service account JSON ni `mobile/store/google-play-service-account.json` ga qo‘yish.
6. EAS production ga anon kalit (`VITE_SUPABASE_ANON_KEY`). Service role emas.
7. `demo_clinic` login va parolini faqat App Store Connect va Play Console review maydoniga yozish.
8. `listing.md`, `privacy-labels.md`, `content-rating.md` va `screenshots/` ni do‘konlarga joylash.
9. Shu PR ni `main` ga qo‘shib, `/privacy` va `/delete-account` ni production ga chiqarish.
10. PR #69 ni qo‘shish, shunda hisob o‘chirish serverda ishlaydi.
11. `eas build -p all --profile production` va `eas submit` ni o‘z hisobidan ishga tushirish.

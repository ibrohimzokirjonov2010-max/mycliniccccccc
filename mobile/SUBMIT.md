# My Clinic ilovasini do‘konga topshirish

Bu qo‘llanma egasi uchun. Versiya `1.0.0`. iOS `buildNumber` va Android `versionCode` ni EAS production profili o‘zi oshiradi (`eas.json` → `autoIncrement`, `appVersionSource: remote`).

Tayyor matnlar:

- `mobile/store/listing.md` — nom, subtitle, qisqa va to‘liq tavsif, kalit so‘zlar, promo, reliz eslatmasi (o‘zbek, rus, ingliz)
- `mobile/store/privacy-labels.md` — Apple privacy va Google Data safety javoblari
- `mobile/store/content-rating.md` — yosh reytingi savollari
- `mobile/store/review-notes.txt` — App Review eslatmasi. Parolni shu yerga yozmang
- `mobile/store/screenshots/` — skrinshotlar va Play grafikalar
- `mobile/store/REVIEW_CHECKLIST.md` — App Review va Play review bandlari, holat va dalil
- `mobile/SUBMIT.md` — shu qo‘llanma

Ommaviy sahifalar (veb):

- https://app-shahobidin-4.vercel.app/privacy
- https://app-shahobidin-4.vercel.app/delete-account

## 1. Hisoblar

Google Play hisobi **tashkilot** sifatida ochiladi. Shaxsiy hisob emas.

1. Dun & Bradstreet dan tashkilot uchun D-U-N-S raqamini oling: https://www.dnb.com/duns.html. Play Console tashkilotni shu raqam bilan tekshiradi. Tekshiruv bir necha kun olishi mumkin.
2. Google Play Console da hisobni Organization qilib oching: https://play.google.com/console/signup. Tashkilot hisobida 12 kishilik yopiq test (14 kun) talab qilinmaydi. `eas.json` dagi Android track `production`.
3. Apple Developer Program ga yoziling: https://developer.apple.com/programs/. Tashkilot nomidan yozilsa, Apple ham D-U-N-S so‘raydi. Shaxs nomidan yozilsa, D-U-N-S shart emas.
4. App Store Connect da yangi iOS ilova oching. Bundle ID: `app.myclinic.crm` (band bo‘lsa, `app.json` dagi `ios.bundleIdentifier` ni o‘zingiznikiga almashtiring).
5. Play Console da ilova oching. Package name `android.package` bilan bir xil bo‘lsin.
6. Play Console → API access dan service account yarating, JSON kalitni yuklab oling va `mobile/store/google-play-service-account.json` qilib qo‘ying. Bu fayl git ga kirmaydi.

## 2. EAS

Kompyuteringizda, loyiha ildizidan:

```bash
npm install -g eas-cli
cd mobile
eas login
eas init
```

`eas init` `app.json` ichidagi `extra.eas.projectId` ni haqiqiy ID ga almashtiradi. Hozir u `00000000-0000-0000-0000-000000000000`.

`mobile/eas.json` ni oching:

- `submit.production.ios.ascAppId` — App Store Connect dagi raqamli Apple ID (ilova sahifasidagi Apple ID, bundle id emas)
- `submit.production.ios.appleTeamId` — Apple Developer jamoangizning Team ID si
- `submit.production.android.serviceAccountKeyPath` — `./store/google-play-service-account.json` (joyida qoldiring, faylni o‘sha yo‘lga qo‘ying)
- `submit.production.android.track` — `production`. Tashkilot hisobida yopiq test shart emas.

`.env` yoki EAS environment ga qo‘ying (service role emas, faqat anon kalit):

```bash
eas env:create --name EXPO_PUBLIC_API_BASE_URL --value https://app-shahobidin-4.vercel.app --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://zvyggjldzkxwufpnaatr.supabase.co --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value PASTE_ANON_KEY --environment production --visibility sensitive
eas env:create --name EXPO_PUBLIC_PRIVACY_POLICY_URL --value https://app-shahobidin-4.vercel.app/privacy --environment production --visibility plaintext
eas env:create --name EXPO_PUBLIC_DELETE_ACCOUNT_URL --value https://app-shahobidin-4.vercel.app/delete-account --environment production --visibility plaintext
```

`PASTE_ANON_KEY` o‘rniga vebdagi `VITE_SUPABASE_ANON_KEY` ni qo‘ying.

## 3. Yig‘ish

```bash
cd mobile
npx tsc --noEmit
npm run export
eas build -p all --profile production
```

`eas build` tugagach, havolalar EAS dashboard da chiqadi. iOS uchun Apple hisobingizga distributsiya sertifikati so‘ralishi mumkin. `eas build` so‘rasa, unga ruxsat bering.

## 4. Do‘kon kartochkalari

App Store Connect va Play Console da `listing.md` dan mos tilni nusxalang.

- Maxfiylik URL: https://app-shahobidin-4.vercel.app/privacy
- Hisobni o‘chirish URL (Play Data safety): https://app-shahobidin-4.vercel.app/delete-account
- Privacy / Data safety javoblari: `privacy-labels.md`
- Yosh reytingi: `content-rating.md`
- Skrinshotlar: `store/screenshots/` dagi papkalar
  - `ios-6.7` — 1290×2796
  - `ios-6.5` — 1284×2778
  - `ipad-13` — 2064×2752 (`supportsTablet` true)
  - `android-phone` — 1080×2400
  - `play-feature-graphic.png` — 1024×500
  - `play-icon-512.png` — 512×512

Review notes: `review-notes.txt` ni oching. `OWNER_FILLS_THIS` o‘rniga `demo_clinic` uchun login va parolni faqat App Store Connect / Play Console maydoniga yozing. Repozitoriyaga parol qo‘ymang. `default_clinic` ni reviewerga bermang.

## 5. Yuborish

```bash
cd mobile
eas submit -p ios --profile production
eas submit -p android --profile production
```

iOS da birinchi marta Apple ID va app-specific password yoki API kalit so‘raladi. Android da service account JSON yo‘li `eas.json` da turibdi.

Yuborilgandan keyin do‘konlarda “Waiting for Review” holatini kuting. Rad etilsa, xatdagi bandni `store/` dagi javoblar bilan solishtiring.

## Faqat egasi qiladigan ishlar

- Apple Developer Program ga yozilish (tashkilot bo‘lsa D-U-N-S)
- Google Play Console ni tashkilot sifatida ochish va D-U-N-S tekshiruvidan o‘tish. 12 testerlik yopiq test kerak emas
- Bundle ID / package name ni o‘ziga biriktirish, agar `app.myclinic.crm` band bo‘lsa
- `eas login`, `eas init`, ascAppId, appleTeamId va Play service account JSON
- Anon kalitni EAS production environment ga qo‘yish
- `demo_clinic` (yoki `qa_test_1811`) uchun review login va parolini do‘kon formalariga yozish
- Listing, privacy, reyting va skrinshotlarni do‘konlarga joylash
- Shu PR `main` ga qo‘shilgach, `/privacy` va `/delete-account` production da ochilishini tekshirish
- PR #69 ni qo‘shish, shunda hisob o‘chirish serverda ishlaydi
- `eas build` va `eas submit` ni o‘z hisobidan ishga tushirish

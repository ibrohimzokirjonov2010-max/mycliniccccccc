# My Clinic mobil ilova

My Clinic dental CRM ning iOS va Android ilovasi. Bu veb-ilovaning (Vite) o‘rnini bosadigan yupqa WebView emas: kirish, bosh sahifa, bemorlar, uchrashuvlar, shifokorlar, to‘lovlar va hisob alohida native ekranlar.

Ilova mavjud serverless API dan foydalanadi:

`POST /api/auth?action=login` → `{ clinic_id, username, password }` → `{ ok, clinic, session, user }`

Sessiya qurilmaning himoyalangan xotirasida saqlanadi (`expo-secure-store`, iOS Keychain / Android Keystore). Ma’lumotlar shu sessiya JWT si bilan o‘qiladi. **Supabase `service_role` kaliti ilovaga kiritilmaydi.** Faqat ochiq (publishable / anon) kalit ishlatiladi. API chaqiriqlari `src/api/` da ajratilgan, shuning uchun vebdagi auth o‘zgarishlarini shu qatlamda moslashtirish oson.

Standart API manzili: `https://app-shahobidin-4.vercel.app`

## Ishga tushirish

Talab: Node.js 20+ va [Expo](https://docs.expo.dev/) muhiti.

```bash
cd mobile
npm install
cp env.example .env
```

`.env` ichida `EXPO_PUBLIC_SUPABASE_ANON_KEY` ni veb-ilovadagi `VITE_SUPABASE_ANON_KEY` bilan to‘ldiring. Bu anon kalit, service kalit emas.

```bash
npx expo start
```

- Telefon: Expo Go yoki development build
- Tekshiruv: `npm run typecheck` va `npm run export`

Hisob ilova ichida yaratilmaydi. Klinika ID, login va parolni administrator beradi. Sinov uchun faqat `qa_test_1811` yoki `demo_clinic` dan foydalaning. `default_clinic` da haqiqiy bemorlar bor.

## EAS bilan yig‘ish

```bash
npm install -g eas-cli
eas login
cd mobile
eas init
```

`eas init` `app.json` dagi `extra.eas.projectId` ni haqiqiy loyiha ID si bilan almashtiradi. Hozir u joy egasi (placeholder).

`ios.bundleIdentifier` va `android.package` hozir `app.myclinic.crm`. Egasiga tegishli yakuniy identifikatorga almashtiring (masalan, `uz.klinika.myclinic`). Ikkalasi App Store va Play Console dagi yozuv bilan bir xil bo‘lishi kerak.

EAS production muhitiga qo‘ying:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_PRIVACY_POLICY_URL`

```bash
eas build --platform all --profile production
eas submit --platform ios --profile production
eas submit --platform android --profile production
```

Ilova faqat HTTPS ishlatadi. `ITSAppUsesNonExemptEncryption` `false`: odatiy eksport anketasida qo‘shimcha shifrlash yo‘q. Kamera, mikrofon, joylashuv va kontaktlar so‘ralmaydi, chunki ilova ulardan foydalanmaydi.

## Do‘konga topshirishdan oldin egasi berishi kerak bo‘lganlar

- [ ] Apple Developer Program a’zoligi
- [ ] Google Play Console hisobi
- [ ] Yakuniy bundle id / package name (hozirgi `app.myclinic.crm` placeholder)
- [ ] EAS loyihasi (`eas init`) va iOS/Android imzo sertifikatlari
- [ ] `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable/anon). Service role kalitini hech qachon bermang
- [ ] Maxfiylik siyosati URL si. Hozirgi havola: `https://app-shahobidin-4.vercel.app/maxfiylik`. Ommaga chiqarishdan oldin yurist ko‘rigidan o‘tkazing
- [ ] Do‘kon matni: nom, qisqa tavsif, to‘liq tavsif (o‘zbek, rus, ingliz)
- [ ] Skrinshotlar: iPhone 6.7" va 6.5", planshet yoqilgan bo‘lsa iPad, Android telefon. Play uchun 1024×500 feature graphic
- [ ] App Review uchun demo hisob, `demo_clinic` yoki `qa_test_1811` da: klinika ID, login, parol. Parolni kodga yozmang. Review notes da yozing
- [ ] Apple Privacy Nutrition Labels va Google Data safety: bemor ismi, telefon, qabul va to‘lov ma’lumotlari klinika hisobida saqlanadi, sotilmaydi
- [ ] Hisobni o‘chirish uchun server amali (quyida). Ilovada so‘rov oqimi bor, lekin server hali hisobni o‘zi o‘chirmaydi

## Serverda hali yo‘q, lekin kerak bo‘ladigan amal

Ilova `POST /api/auth?action=delete-account` ni Bearer sessiya bilan chaqiradi. Hozirgi API buni `bad_request` qilib qaytaradi. Shunda ilova so‘rovni qurilmada qayd etadi va qo‘llab-quvvatlash havolasini ochadi. Apple 5.1.1(v) to‘liq o‘chirishni talab qilishi mumkin, chunki hisob yaratish vebda bor.

Tavsiya etilgan amal (bu PR da yozilmagan):

1. Bearer JWT dan `clinic_id` va `crm_user_id` ni oling
2. Joriy parolni qayta tekshiring
3. `users` qatorini va unga bog‘liq shadow `auth.users` yozuvini o‘chiring
4. Sessiyalarni bekor qiling
5. `{ ok: true }` qaytaring

Bu o‘zgarish veb API da qilinadi. Mobil qatlam (`src/api/session.ts` → `requestAccountDeletion`) javobni kutib turibdi.

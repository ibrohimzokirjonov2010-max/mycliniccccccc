# Regression Prevention Registry (Muammolar va Tuzatishlar Reyestri)

Ushbu fayl loyihada yuz bergan va muvaffaqiyatli tuzatilgan har qanday xatolik (bug/error) ro'yxatini saqlaydi.
**Maqsad:** Loyihaga keyinchalik kiritiladigan o'zgarishlar ushbu xatolarni qaytadan yuzaga keltirmasligini (regression) ta'minlash.

> [!IMPORTANT]
> - Har qanday yangi xato yoki muammo yechilgandan so'ng, uni albatta ushbu reyestrga qo'shing!
> - Har qanday yangi kod yozish yoki tahrirlashdan oldin, ushbu reyestrni tekshirib chiqing!

---

## 📂 Ro'yxatga Olingan Muammolar

<!-- Yangi xatoliklarni ro'yxatning tepasiga (quyidagi qismga) qo'shing -->

### 🦷 Yangi Bemor Qo'shish / Davolash Rejasi Wizardida 8-Tishlar (Donolik Tishlari: 18, 28, 38, 48) Sig'ishi va Ko'rinishi
- **Sana:** 2026-08-26
- **Tuzatilgan Fayllar:**
  - [`src/components/patients/NewPatientFlow.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/NewPatientFlow.jsx)
  - [`src/components/treatments/TreatmentPlanModal.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/treatments/TreatmentPlanModal.jsx)
- **Muammo Tavsifi:** 
  - Yangi bemor qo'shish oynasining 2-bosqichida (Davolash rejasi) tishlar ro'yxatida 8-tishlar (18, 28, 48, 38 - donolik tishlari) chetdan chiqib ketib, ekranga sig'may ko'rinmay qolgan edi (faqat 17-27 va 47-37 ko'ringan).
- **Sababi:** 
  - Tish tugmalari eni (`w-8`, 32px) va oraliq masofalari (`gap-1.5`, 6px) modalning chap paneli enidan (`~520px`) kattaroq (jami `~660px`) bo'lib, gorizontal `overflow-x-auto` bo'lgani sababli chetdagi 18, 28, 48, 38 tishlar qirqilib qolgan.
- **Qanday tuzatildi:** 
  1. `ToothBtn` o'lchamlari ixchamlashtirildi (`w-6 sm:w-7 md:w-[25px] lg:w-7 h-7 sm:h-8 rounded-lg`, matn `text-[10px] sm:text-[11px] font-black`).
  2. Tish qatorlari konteyneri to'liq eni bo'yicha moslashuvchan (`w-full max-w-full justify-center gap-0.5 sm:gap-1`) qilindi.
  3. Barcha 32 ta tish (18-28 va 48-38) hech qanday gorizontal aylantirishsiz (scrollsiz) to'liq, zargarlik aniqligida ekranga sig'dirildi.
  4. Donolik tishlari (18, 28, 38, 48) ni tanlash va ularga "Donolik tishini olish" xizmatini biriktirish muvaffaqiyatli sinovdan o'tkazildi.
- **Qaytalamaslik choralari:** Tish formulasi va wizard oynalarida 16 ta tish qatori doimo ixcham o'lchamlarda berilishi va chap panel eniga to'liq sig'ishi shart.

### 🦷 Davolash Tarixi Statistikasi va Tish Jadvalida Bajarilgan Ishlar (Tish Olish + Implant) Aks Etishi
- **Sana:** 2026-08-26
- **Tuzatilgan Fayllar:**
  - [`src/pages/PatientProfile.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/PatientProfile.jsx)
  - [`src/components/patients/ProfessionalOdontogram.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/ProfessionalOdontogram.jsx)
- **Muammo Tavsifi:** 
  1. Davolash rejasida bir vaqtning o'zida ham "Tish olish", ham "Implantat o'rnatish" bo'lganda, tish formulasi va o'ng tarafdagi xulosalar ro'yxatida faqat bitta amal (avval faqat tish olish, keyin faqat implant) chiqib, "Tish olish" ko'rinmay qolayotgan edi.
  2. `Davolash tarixi va rejalashtirilgan ishlar` bo'limida `Bajarildi ✅` statistikasi 0 bo'lib qolayotgan edi.
- **Sababi:** 
  - Har bir tish uchun faqat yagona string status (`status` va `treatment`) saqlangan, bir nechta amallar (masalan, tish sug'urilishi + implant qo'yilishi) massiv ko'rinishida yig'ilmagan edi.
- **Qanday tuzatildi:** 
  1. `getToothStatuses` funksiyasida har bir tish uchun `treatments` va `conditions` to'liq massiv qilib yig'ildi.
  2. Odontogrammaning o'ng panelidagi xulosa ro'yxatida ham **"• Tish olingan - 21"**, ham **"• Implantat - 21"** birgalikda to'liq aks ettirildi.
  3. Odontogramma pastki statistika panelida `1 × Implant` va `1 × Tish olingan` hisoblagichlari parallel chiqarildi.
  4. Odontogramma 21-tish ustiga kursorni olib borganda tooltipda `"#21 — Tish olingan + Implantat"` chiqarildi.
  5. Pastdagi `Davolash tarixi`da `Bajarildi ✅` bo'limida barcha 3 ta amal (Anesteziya, Implantat, Tish olish) ko'rsatilib, har biri `BAJARILDI` maqomida saqlab qolindi.
- **Qaytalamaslik choralari:** Tishda bir vaqtning o'zida bir nechta muolaja (tish olish + implant + plomba) bajarilganda, bittasi ikkinchisini o'chirib yubormasligi uchun doimo `treatments` ro'yxatida barchasi saqlanishi va ro'yxatlarda ko'rsatilishi shart.

### 🏷️ Bemor Lentasi (Patient Feed) - Chegirmaning "To'lanmagan" deb chiqishi va Eski Chegirmasiz Narxning Duplikat Bo'lishi
- **Sana:** 2026-08-26
- **Tuzatilgan Fayllar:**
  - [`src/pages/PatientProfile.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/PatientProfile.jsx)
- **Muammo Tavsifi:** Bemor profilidagi faoliyat lentasida (timeline feed) davolash rejasi chegirma bilan tuzilganda:
  1. `CHEGIRMA QO'LLANGAN — TO'LOV KUTILMOQDA: -1 254 000 so'm` deb sariq kartochka chiqib, unga `TO'LANMAGAN` nishoni (badge) taqib qo'yilgan (vaziyatda chegirma to'lanadigan qarz emas, balki chegirma edi).
  2. Eski 4 180 000 so'mlik chegirmasiz xom narx alohida `REJA NARXI — TO'LOV KUTILMOQDA` kartochkasi sifatida duplikat bo'lib chiqib, foydalanuvchini chalg'itayotgan edi.
- **Sababi:** 
  - `PatientProfile.jsx` dagi `timelineItems` massiviga barcha to'lovlar qo'shilayotgan paytda davolash rejasiga biriktirilgan ichki qarz (`type: 'Debt'`) va avtomatik chegirma (`type: 'Discount'`) yozuvlari filtrlanmagan.
  - Kartochkani render qilish kodida `isAutoDiscount` shartiga `showBadge: true` va `"to'lov kutilmoqda"` yozuvi qattiq kodlab qo'yilgan edi.
- **Qanday tuzatildi:** 
  1. `timelineItems` ichida davolash rejasiga bog'langan ichki `Debt` va `Discount` yozuvlari filtrlab olib tashlandi, chunki davolash rejasi o'zining alohida reja kartasida chegirmali yakuniy narxi (`NARX (CHEGIRMA BILAN): 2 926 000 so'm`) va chegirma nishoni (`Chegirma qo'llangan: -30%`) bilan chiroyli chiqadi.
  2. To'lovlarni render qilishda chegirma hech qachon `To'lanmagan` yoki `to'lov kutilmoqda` deb chiqmaydigan qilindi (`showBadge: false`, `label: "Chegirma berildi"`).
  3. `load()` funksiyasida DB dagi legacy soxta discount to'lovlarini avtomatik tozalash va qarz yozuvlarini rejaning yakuniy chegirmali narxiga sinxronlash qo'shildi.
- **Qaytalamaslik choralari:** Davolash rejasi narxini va chegirmasini ko'rsatishda har doim faqat chegirmali yakuniy narxni ko'rsating. Chegirmalarga HECH QACHON "to'lanmagan" / "qarz" nishonlarini qo'ymang.

### 📱 Premium Suzuvchi Navigatsiya Paneli (Mobile Floating Glassmorphism Dock Layout)
- **Sana:** 2026-08-22
- **Tuzatilgan Fayllar:**
  - [`src/components/layout/NativeMobileLayout.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/layout/NativeMobileLayout.jsx)
- **Muammo Tavsifi:** Mobil telefonda pastki navigatsiya paneli (bottom bar) 100% enli tekis oq blok ko'rinishida pastki chetga yopishib qolgani foydalanuvchiga eski/sodda ko'ringan. Uni professional "iPhone 17" uslubidagi, suv tomchisi kabi shaffof va suzuvchi (glassmorphism floating dock) ko'rinishga keltirish so'ralgan.
- **Sababi:** Pastki navigatsiya barining CSS klasslari chekkalardan ajralmagan va klassik tekis blok ko'rinishida yozilgan edi.
- **Qanday tuzatildi:** Navigatsiya bar konteyneri chekkalardan ajratilib (`fixed bottom-5 left-5 right-5`), to'liq yumaloq burchakli (`rounded-[2.2rem]`), shaffof oq (`bg-white/85 backdrop-blur-2xl border border-white/40`) va yumshoq soyali (`shadow-[0_12px_40px_rgba(15,23,42,0.12)]`) qilindi. Aktiv element ko'rsatkichi uchun ustki chiziq olib tashlanib, uning o'rniga tugma ortida joylashgan va silliq siljiydigan shaffof ko'k kapsula (`layoutId="activeTabPill"`) hamda ikona ostidagi yorug'lik refraktsiyasi (`layoutId="activeTabIconGlow"`) animatsiyalari o'rnatildi.
- **Qaytalamaslik choralari:** Mobil suzuvchi panellar o'rnatishda chekka masofalarini (`bottom-5 left-5 right-5`) va Framer Motion spring animatsiyalari muvofiqligini tekshiring.

### 📱 Mobil Onboarding va Kutib Olish Oqimi (Mobile Welcome & Language/Country Onboarding Flow)
- **Sana:** 2026-08-22
- **Tuzatilgan Fayllar:**
  - [`src/pages/Login.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/Login.jsx)
- **Muammo Tavsifi:** Mobil telefonda ilovani birinchi marta ochganda professional tarzda mamlakat tanlash, til tanlash va foydalanish yo'riqnomasi (benefit onboarding slides) chiqishi talab qilingan.
- **Sababi:** Ilovada mobil foydalanuvchilar uchun kutib olish (onboarding/til tanlash) oqimi loyihada mavjud emas edi.
- **Qanday tuzatildi:** `Login.jsx` komponentiga mobil ekranlar (`width < 1024`) uchun maxsus onboarding boshqaruvi qo'shildi. Foydalanuvchi birinchi marta kirganini tekshirish uchun `localStorage` ishlatildi va quyidagi bosqichlar ishlab chiqildi:
  1. **Mamlakat tanlash:** O'zbekiston yoki Tojikiston radioguruh orqali tanlanadi.
  2. **Til tanlash:** O'zbekcha (Lotincha), Ўзбекча (Кирилча), yoki Русский tillari. Til tanlanganda `changeLanguage` orqali ilova tili darhol o'zgaradi.
  3. **Tushuntirish slaydlari:** 3 ta to'liq animatsiyali slaydlar (odontogram, kalendar rejasi, hamda AI tish tahlili bilan) iPhone Mockup ko'rinishida Framer Motion orqali ishlab chiqildi.
  Slaydlar yakunida "Boshlash" tugmasi bosilganda onboarding holati saqlanadi va kirish formasiga yo'naltiradi.
- **Qaytalamaslik choralari:** Mobil kutib olish oqimi faqat bir marta ko'rsatilishini ta'minlash uchun `localStorage` tekshiruvlarini to'g'ri bajaring.

### 📋 Yangi Davolash Rejasi Modali Navigatsiya va Visual Yaxshilashlar (New Plan Wizard UX Improvements)
- **Sana:** 2026-08-22
- **Tuzatilgan Fayllar:**
  - [`src/pages/MobileTreatmentPlansV2.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobileTreatmentPlansV2.jsx)
- **Muammo Tavsifi:** Yangi davolash rejasi yaratish (Yangi reja form/wizard) muloqot oynasida 1-qadamda "Bekor qilish" tugmasi yo'qligi va orqaga qaytish hamda yopish tugmalarining bir vaqtda ko'rinib chalkashlik yaratishi kuzatilgan. Sarlavha ostidagi qadam ko'rsatkichlari (step indicator) bir-biri bilan ulanmagan va oddiy ko'ringan.
- **Sababi:** Wizard navigatsiya boshqaruvi va sarlavha qismida foydalanuvchi interfeysi (UI/UX) qadamlari mobil versiya uchun yetarlicha moslashtirilmagan edi.
- **Qanday tuzatildi:** Top header qismida 1-qadamda orqaga qaytish tugmasi olib tashlandi, faqat `Yangi Reja` va `X` yopish tugmalari qoldirildi (Step 2+ dan boshlab orqaga qaytish tugmasi chiqadi). Bosqichlar ko'rsatkichi (step indicator) uchun visual bog'lovchi progress chizig'i va har bir qadam uchun nomlar (`Bemor`, `Xizmatlar`, `Yakunlash`) qo'shildi. 1-qadam uchun navigatsiya ostiga "Bekor qilish" tugmasi biriktirildi. Qadamlar ichidagi tish sarlavhalari FDI raqamlariga (`16`, `36` kabi) o'girib chiqildi.
- **Qaytalamaslik choralari:** Mobil wizard (qadamma-qadam) oynalarini yaratishda visual progress liniyasi va sarlavhalardan to'g'ri foydalaning, shuningdek ortiqcha takrorlanuvchi yopish tugmalarini olib tashlang.

### 🦷 Yangi Implant Modali Yopish va Bekor Qilish Tugmalari (Implant Form Cancel & Close Buttons)
- **Sana:** 2026-08-22
- **Tuzatilgan Fayllar:**
  - [`src/components/implants/ImplantForm.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/implants/ImplantForm.jsx)
- **Muammo Tavsifi:** Yangi implant qo'shish (Implant form/wizard) muloqot oynasining yuqori o'ng burchagida yopish tugmasi ("X") hamda birinchi qadamda (Step 1 - Bemor) orqaga qaytish/yopish tugmalari yo'q edi. Bu foydalanuvchiga jarayonni bekor qilishni qiyinlashtirgan.
- **Sababi:** Radix UI dialog close tugmasi `overflow-hidden` va maxsus header tufayli yashirinib qolgan. Birinchi qadamda navigatsiya faqat o'ngdagi "Keyingisi" tugmasidan iborat edi.
- **Qanday tuzatildi:** `<DialogHeader>` ichiga maxsus, mobil uchun qulay va katta o'lchamli "X" yopish tugmasi qo'shildi. Birinchi qadam (Step 1) navigatsiyasiga chap tarafga joylashtirilgan "Bekor qilish" tugmasi qo'shildi va scroll konteyneri no-scrollbar klassiga moslandi.
- **Qaytalamaslik choralari:** Mobil wizard/dialog oynalarini loyihalashda har doim foydalanuvchi istalgan vaqtda muloqot oynasini yopa olishi yoki bekor qila olishi uchun yaqqol ko'rinadigan tugmalarni ta'minlang.

### 📋 Davolash Rejasi Tafsilotlari va Checkbox Sinxronizatsiyasi (Treatment Plan Details Compatibility)
- **Sana:** 2026-08-22
- **Tuzatilgan Fayllar:**
  - [`src/pages/MobileTreatmentPlansV2.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobileTreatmentPlansV2.jsx)
- **Muammo Tavsifi:** Davolash rejasi tafsilotlari (Reja tafsilotlari) oynasi ochilganda, kompyuterdan (desktop) yaratilgan rejalarda tish raqamlari ko'rinmasdan bo'sh `# tish xizmatlari` deb chiqib qolayotgan edi. Shuningdek, xizmatlarning bajarilganlik (checkbox) holati ma'lumotlar bazasidan o'qilmayotgan va modal ochilganda hamisha bo'sh (unchecked) ko'rinayotgan edi.
- **Sababi:** Kompyuter versiyasida davolash rejasi xizmatlari tekis (flat array) formatda, har bir elementda alohida `tooth` maydoni bilan saqlanadi. Mobil versiyada esa tish bo'yicha guruhlangan format (`tooth_id` va `items` massivi) kutilgan edi. Shuningdek, `completedServices` holati modal ochilganda plan ma'lumotlaridan sinxronizatsiya qilinmagan.
- **Qanday tuzatildi:** `groupedServices` nomli dynamic normalizator qo'shildi. U ma'lumotlar bazasidagi har ikkala formatni (flat va grouped) avtomatik aniqlab, mobil ekranga guruhlangan holatda xavfsiz va chiroyli o'tkazadi va tish raqamlarini to'liq chiqaradi (quadrantlarni FDI raqamlarga aylantiradi). `useEffect` orqali muloqot oynasi ochilganda completed statuslar to'g'ri o'qib olinadigan bo'ldi.
- **Qaytalamaslik choralari:** Turli platformalar (desktop va mobil) yozadigan ma'lumotlar strukturasining o'zaro muvofiqligini ta'minlash uchun har doim o'qish qismida data normalizer/adapter yozing hamda foydalanuvchi tanlovi holatini bazadagi real status bilan sinxronlashtiring.

### 📱 Mobil Pastki Panel Sakrashi (Mobile Bottom Nav Bar Jumping) - Viewport va Scroll muammosi
- **Sana:** 2026-08-22
- **Tuzatilgan Fayllar:**
  - [`src/components/layout/NativeMobileLayout.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/layout/NativeMobileLayout.jsx)
- **Muammo Tavsifi:** Mobil telefonda pastki navigatsiya paneli (bottom navigation bar) sahifa scroll qilinganda sakrab/o'ynab yurishi va tagidagi sahifa kontentining uning ostiga kirib, eng pastda ko'rinib qolishi kuzatilgan.
- **Sababi:** Mobil layoutda butun brauzer oynasi (`<body>`) scroll qilinayotgan edi. Mobil Safari/WebKit brauzerlarida scroll qilinganda dinamik viewport o'zgarishi tufayli `fixed bottom-0` elementlar lag bilan harakatlanadi va o'ynab ketadi.
- **Qanday tuzatildi:** Loyiha tashqi konteyneri `fixed inset-0 overflow-hidden` orqali to'liq ekran o'lchamiga qulflab qo'yildi va scroll qilish faqat kontent maydoni (`<main>` ning `absolute inset-0 overflow-y-auto no-scrollbar` klassi) ichiga o'tkazildi. Bu navigatsiya panelini mutlaqo barqaror (static stuck) holatga keltirdi.
- **Qaytalamaslik choralari:** Mobil PWA va veb ilovalar layoutini yaratishda har doim body scrollini bloklab (`overflow-hidden`), scrollni faqat ichki elementlar ichida boshqaring. Bu fixed elementlarning sakrashini butunlay yo'qotadi.

### 👤 Bemor Tanlash Dropdown (Patient Selection Dropdown) - Z-Index Overlapping va Mobil Tanlov Ishlamasligi
- **Sana:** 2026-08-22
- **Tuzatilgan Fayllar:**
  - [`src/components/patients/PatientSelect.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/PatientSelect.jsx)
  - [`src/pages/MobilePaymentsV2.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobilePaymentsV2.jsx)
  - [`src/pages/MobileTreatmentPlansV2.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobileTreatmentPlansV2.jsx)
  - [`src/pages/MobileRecall.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobileRecall.jsx)
  - [`src/components/treatments/TreatmentPlanModal.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/treatments/TreatmentPlanModal.jsx)
- **Muammo Tavsifi:** Mobil telefonda va ba'zi modallarda bemor tanlash (PatientSelect) qidiruv ro'yxati ochilganda, ro'yxat keyingi kiritish maydonlari (Shifokor, To'lov summasi, Reja nomi va boshqalar) ostida (orqasida) qolib ketgan. Bemor nomini bosganda boshqa maydonlar bosilib ketishi tufayli bemorni umuman tanlab bo'lmas edi.
- **Sababi:**
  - `overflow-y-auto` bo'lgan modal konteynerlarda va form maydonlarida stacking context (qavatlar ierarxiyasi) shakllanmagan edi. Natijada DOM tartibi bo'yicha keyingi kelgan positioned maydonlar `PatientSelect` ro'yxatidan yuqorida render bo'lib, uning white backgroundini berkitib qo'ygan.
  - Mobil touch ekranlarda `onBlur` hodisasi touch tugashidan oldin `setTimeout` tugab ro'yxatni yopib qo'yar edi, bu esa bemor bosilganda select o'zgarishini bloklagan.
- **Qanday tuzatildi:**
  - `PatientSelect.jsx` qidiruv dropdown konteyneriga explicit `bg-white` klassi qo'shildi hamda mobil touch mosligi uchun `onTouchStart` hodisalarida `e.preventDefault()` chaqirib, blur bo'lishidan oldin select o'zgarishini darhol bajarish ta'minlandi.
  - `MobilePaymentsV2.jsx`, `MobileTreatmentPlansV2.jsx`, `MobileRecall.jsx`, va `TreatmentPlanModal.jsx` sahifalaridagi form maydonlarining ota `div` konteynerlariga explicit `relative z-50`, `relative z-40`, `relative z-30`, `relative z-20`, `relative z-10` kaskadli z-index klasslari qo'shilib, qidiruv oynasi har doim eng yuqori qavatda ko'rinishi va to'liq click/touch qabul qilishi ta'minlandi.
- **Qaytalamaslik choralari:** Mobil modal va sahifalar ichida `PatientSelect` yoki boshqa custom absolute qidiruv/dropdown elementlaridan foydalanilganda, uning ostidagi form maydonlari konteynerlarida har doim kaskadli `relative z-XX` klasslarini ishlating. Mobil touch hodisalarni aslo unutmang (`onTouchStart` / `onPointerDown`).

### ⚡ Tizim Latentligi (System Latency) - Boshlang'ich yuklanish oq ekran qotishi va tablar orasida o'tgandagi laglar
- **Sana:** 2026-08-19
- **Tuzatilgan Fayllar:**
  - [`src/api/base44Client.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/api/base44Client.jsx)
  - [`src/lib/AuthContext.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/lib/AuthContext.jsx)
  - [`src/pages/Appointments.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/Appointments.jsx)
  - [`src/pages/Patients.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/Patients.jsx)
  - [`src/pages/Payments.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/Payments.jsx)
  - [`src/pages/Reports.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/Reports.jsx)
- **Muammo Tavsifi:** Tizimga kirganda uzoq vaqt (300ms dan 2s gacha) oq ekran qotib qolishi hamda Bemorlar, Uchrashuvlar va To'lovlar tablari orasida o'tganda interfeys oqarib, ma'lumotlar qayta-qayta yuklanib vizual tarzda qotish/flickering holati yuz berayotgan edi.
- **Sababi:** 
  - `AuthContext.jsx` tizim yuklanganda sessionni tiklash uchun `base44.auth.getAllUsers()` ni await qilib to'g'ri o'qib bo'linguncha app renderini to'liq bloklab qo'ygan. Bu Supabase'dan barcha user jadvalini tortib, oq ekranni uzoq ushlab turgan.
  - Tablarni almashtirganda komponentlar unmount bo'lib, remount bo'lishi natijasida local state tozalangan va har doim `loading = true` orqali to'liq spinner ko'rsatilgan. Bu microtask cache tez o'qisa ham layout paint tufayli vizual flickering keltirib chiqargan.
  - Patients sahifasidagi stats so'rovi barcha bemorlar ro'yxatini (`Patient.list`) va hisobini (`Patient.count`) parallel ravishda qayta yuklagan, bu judayam sekin ishlovchi og'ir so'rov bo'lgan.
- **Qanday tuzatildi:** 
  - **Tezkor boot (Optimistic Auth Session Recovery):** Tizimga muvaffaqiyatli kirganda foydalanuvchining to'liq ma'lumotlari `localStorage`'da `user_data` kaliti ostida JSON formatida saqlanadi. `AuthContext.jsx` boot jarayonida ushbu cached ma'lumotlarni o'qib, appni **1ms ichida** mount qiladi va fon rejimida session validligini tekshiradi.
  - **Kesh muddati (TTL) optimallashtirildi:** `RequestCache` kesh vaqtlari moslashtirildi: o'zgarmas ma'lumotlar (`User`, `Service`, `BotConfig`) uchun 5 daqiqalik (300,000ms), tranzaksiyaviy ma'lumotlar uchun 15 soniyalik (15,000ms) muddat o'rnatildi.
  - **Deferred (Kechiktirilgan) yuklash spinneri va Silent refresh:** `Payments.jsx`, `Appointments.jsx` va `Reports.jsx` sahifalarida spinner faqat ma'lumotlar hali umuman yuklanmagan bo'lsa va keshdan tez o'qish (150ms ichida) amalga oshmasa ko'rinadigan deferred rejimga o'tkazildi. Agar keshda ma'lumot bo'lsa, fon rejimida jim yuklash (stale-while-revalidate) bajariladi.
  - **Patient Stats optimallashtirildi:** Stats hisoblash uchun og'ir select so'rovi o'rniga Supabase'dan faqat hisoblash uchun kerak bo'lgan columns (`created_at, total_paid, total_debt`) yengil so'rovi orqali o'qish amalga oshirildi, bu payload va rendering vaqtini 100 barobarga qisqartirdi.
- **Qaytalamaslik choralari:** 
  - Har qanday tab/sahifa yuklash effectlarida `setLoading(true)` ni ko'r-ko'rona chaqirmang. Kesh borligida har doim orqa fonda jim yangilash (silent refresh) andozasidan foydalaning.
  - API client kesh drayverini buzmang. O'zgarmas katalog va foydalanuvchilar ro'yxati kabi so'rovlarni har bir useEffectda bazadan qayta chaqirmang.

### 🦷 Bemor Profili (Patient Profile) - Tish formulasi diagnozlari ingliz tilida ko'rinib qolishi
- **Sana:** 2026-08-19
- **Tuzatilgan Fayllar:**
  - [`src/pages/PatientProfile.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/PatientProfile.jsx)
- **Muammo Tavsifi:** Bemor profilidagi tish formulasi ostida joylashgan tashxislar ro'yxatidagi elementlar (masalan, `Missing tooth`, `Cavity`, `Secondary cavity` va boshqalar) interfeys o'zbek tiliga o'tkazilganda ham ingliz tilida ko'rinib qolayotgan edi.
- **Sababi:** Tish holati tashxislari va muolajalar nomlari bazada ingliz tilida saqlanadi. Ro'yxatni shakllantirish jarayonida ushbu inglizcha nomlar hech qanday tarjimasiz to'g'ridan-to'g'ri ekranga chiqarilgan.
- **Qanday tuzatildi:** 
  - `PatientProfile.jsx` da har bir tashxis va muolaja nomi uchun o'zbek, rus va ingliz tillaridagi tarjimalarni o'z ichiga olgan `DIAGNOSTIC_TRANSLATIONS` lug'ati yaratildi.
  - Tizimdagi faol tilni aniqlash uchun `useTranslation` hookidan `language` olinib, ro'yxatdagi nomlar `translateDiagnostic(name)` yordamchi funksiyasi orqali dinamik tarzda tarjima qilinadigan bo'ldi.
  - Til o'zgartirilganda ro'yxat darhol yangilanishi uchun `dentalFormulaSummaryList` memoizatsiyasining bog'liqliklariga `language` va `translateDiagnostic` qo'shildi.
- **Qaytalamaslik choralari:** Bazadan yoki tish formulasidan keladigan barcha tibbiy holat nomlarini ekranga chiqarishdan avval har doim til lug'atidan o'tkazib formatlang.

### 🕒 So'nggi Faoliyat (Recent Activity) - Sana/vaqtning xom ISO ko'rinishi va pul birligining duplikat bo'lishi
- **Sana:** 2026-08-19
- **Tuzatilgan Fayllar:**
  - [`src/pages/Dashboard.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/Dashboard.jsx)
  - [`src/pages/MobileDashboardV2.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobileDashboardV2.jsx)
- **Muammo Tavsifi:** 
  - Panelning "So'nggi faoliyat" (Recent Activity) bo'limida to'lovlar (payments) tarixi ko'rsatilganda sana/vaqt xom ISO formatda (masalan, `2026-08-18T15:23:01.417+00:00`) ko'rinayotgan edi.
  - Mobil versiyada to'lov summasi ketidan `"so'm"` so'zi ikki marta yozilib, `1,460,000 so'm so'm` ko'rinishida chiqib qolayotgan edi.
- **Sababi:** 
  - To'lov ob'ektida `time` ustuni yo'qligi sababli u to'g'ridan-to'g'ri `item.date` xom satrini chop etar edi.
  - `formatCurrency` yordamchi funksiyasi o'z ichida avtomatik ravishda `"so'm"` matnini qo'shib qaytargani holda, mobil dashboard kodida uning ketidan yana qo'shimcha ravishda `so'm` yozib qo'yilgan edi.
- **Qanday tuzatildi:** 
  - Ikkala dashboard faylida ham `formatActivityDate` deb nomlangan vaqt zonasiga ta'sir qilmaydigan (timezone-invariant) sana formatlovchi funksiya yaratildi. U sanani chiroyli `18.08.2026 15:23` ko'rinishiga keltiradi.
  - Mobil dashboarddagi duplikat `so'm` matni olib tashlandi, faqat `formatCurrency` natijasining o'zi qoldirildi.
- **Qaytalamaslik choralari:** `formatCurrency` ishlatilganda har doim valyuta matni takrorlanmasligiga ishonch hosil qiling. Sanani chop etishdan oldin formatlovchi yordamchilardan o'tkazing.

### 📅 Qabullar (Appointments) - Bugungi uchrashuvlar hisobi va Uchrashuvlar to'rida kartochkalarning qisilib qolishi
- **Sana:** 2026-08-19
- **Tuzatilgan Fayllar:**
  - [`src/utils/dashboardUtils.js`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/utils/dashboardUtils.js)
  - [`src/pages/MobileDashboard.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobileDashboard.jsx)
  - [`src/pages/RecallSystem.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/RecallSystem.jsx)
  - [`src/pages/MobileRecall.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobileRecall.jsx)
  - [`src/components/appointments/DoctorDayGrid.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/appointments/DoctorDayGrid.jsx)
- **Muammo Tavsifi:** 
  - Asosiy va mobil boshqaruv panelida (dashboard) bugungi uchrashuvlar soni `0` bo'lib qolayotgan edi, vaholanki bugun uchun uchrashuv yozilgan edi.
  - Uchrashuvlar sahifasidagi shifokorlar to'rida (DoctorDayGrid / Setka) 30 daqiqalik uchrashuv kartochkasi vertikal ravishda o'ta qisqa va qisilib qolgan bo'lib, uning ichidagi uchinchi qatordagi xizmat nomi va tasdiq nishoni (badge) pastdan kesilib ko'rinmay qolayotgan edi.
- **Sababi:** 
  - Supabase bazasida uchrashuv sanasi (`date`) `'2026-08-19T00:00:00+00:00'` kabi to'liq vaqt/zona formati bilan saqlanadi. Panelda esa u to'g'ridan-to'g'ri `'2026-08-19'` kabi faqat sana ko'rinishidagi bugungi kun bilan solishtirilayotgan edi (`a.date === today`). Solishtirish o'xshashlikni bermagani uchun 0 natija chiqqan.
  - To'rdagi har bir vaqt katagining balandligi `h-16` (64px) deb olingan. Ichidagi kartochka esa `h-full` (padding bilan 56px) bo'lgan. Ichida esa 3 qator ma'lumot (ism, vaqt va xizmat nomi) joylashtirilgan. 56px balandlik 3 qator matn uchun yetarli bo'lmaganligi uchun u qisilib, pastki qismi kesilib qolgan.
- **Qanday tuzatildi:** 
  - Barcha tegishli dashboard va recall filterlaridagi sana solishtirishlarida bazadan kelgan sanalar `.split('T')[0]` orqali tozalanib, keyin bugungi sana bilan solishtiriladigan qilindi.
  - `DoctorDayGrid.jsx` to'r kataklarining balandligi `h-16` dan `h-20` (80px) ga oshirildi. Bu kartochkalarga 72px bo'sh joy berdi va barcha qatorlar bemalol joylashdi.
- **Qaytalamaslik choralari:** Sana bilan solishtirish amallarini bajarganda doimo bazadan keladigan sanada `T` ajratkichi bor yoki yo'qligini tekshirib, formatni tozalang. Grid to'ridagi kartochka tarkibiga yangi qatorlar qo'shganda cell balandligini ham mos ravishda oshirishni unutmang.

### 💳 Mobil To'lovlar (Mobile Payments) - patientCurrentTotals ReferenceError xatosi
- **Sana:** 2026-08-17
- **Tuzatilgan Fayllar:**
  - [`src/pages/MobilePaymentsV2.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/MobilePaymentsV2.jsx)
- **Muammo Tavsifi:** Mobil telefonda "To'lovlar" tabiga bosilganda oq/qora sahifa xatosi va `patientCurrentTotals is not defined` ReferenceError xatosi yuzaga kelayotgan edi.
- **Sababi:** Balanslarni hisoblashda ishlatilgan `patientCurrentTotals` state o'zgaruvchisi va uning setter funksiyasi `MobilePaymentsV2.jsx` tarkibida e'lon qilinmay (useState) qolib ketgan edi.
- **Qanday tuzatildi:** `MobilePaymentsV2.jsx` boshiga `const [patientCurrentTotals, setPatientCurrentTotals] = useState({});` e'lon qilingan qator qo'shildi va u to'liq ishlaydigan holatga keltirildi.
- **Qaytalamaslik choralari:** Mobil sahifalardagi to'lov yoki o'xshash moliya modullarini refaktor qilganda, ishlatilgan barcha hisob-kitob state o'zgaruvchilari to'liq e'lon qilinganligini har doim tekshiring.

### 👤 Bemor ma'lumotlari (Patients) - Ismlarni avtomatik bosh harflarga o'tkazish va manzil validationi
- **Sana:** 2026-08-17
- **Tuzatilgan Fayllar:**
  - [`src/components/patients/PatientModal.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/PatientModal.jsx)
  - [`src/components/patients/NewPatientFlow.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/NewPatientFlow.jsx)
  - [`src/pages/PatientProfile.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/PatientProfile.jsx)
  - [`src/lib/utils.js`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/lib/utils.js)
- **Muammo Tavsifi:** 
  - Bemor ismi kiritilayotganda bosh/kichik harflar aralashib ketgan holda yozilsa ham (masalan: `aBDURASHIDOV kAMOL`), uni avtomatik bosh harflarga (**`Abdurashidov Kamol`**) o'tkazish talab qilindi. Keyinchalik, foydalanuvchi yozib tugatishini kutmasdan, yozish jarayonida (on change) vizual tarzda bosh harflarga o'tishi istaldi.
  - Manzil maydoniga faqat raqamlar yoki tasodifiy harflardan iborat noto'g'ri qiymatlar kiritilmasligi uchun qat'iy tekshiruv (validation) kerak edi.
  - Bemor profilidagi telefon raqami yonida professional aloqa tugmalari yo'q edi.
- **Sababi:** Dasturning dastlabki shaklida ushbu foydalanish qulayligi (UX/data validation) va tezkor aloqa tugmalari nazarda tutilmagan edi. Emojili tugmalar esa professional ko'rinishga ega emas va mayda edi.
- **Qanday tuzatildi:** 
  - `src/lib/utils.js` fayliga `capitalizeAsYouType` funksiyasi qo'shildi. U foydalanuvchi yozayotgan paytning o'zidayoq (onChange hodisasida) bosh harflarni to'g'rilab, bo'shliqlarni buzmasdan saqlab turadi.
  - `PatientModal.jsx` va `NewPatientFlow.jsx` oynalaridagi ism-familiya kiritish maydonlariga `onChange` va `onBlur` hodisalari ulanib, real vaqtda bosh harflar formatlanadigan qilindi.
  - `PatientProfile.jsx` da telefon raqam yoniga emojilar o'rniga haqiqiy, kattaroq (`w-8 h-8`) va chiroyli SVG piktogrammalari (firuza rangli Lucide `Phone` va moviy rangli Telegram samolyot ikonalari) qo'yildi.
- **Qaytalamaslik choralari:** Bemorlar profilini yoki ma'lumotlarini o'zgartirganda validation qoidalariga rioya etilishini va avtomatik korreksiyalarni aslo o'chirib qo'ymang.

### 🔤 Xizmatlar va Lidlar (Services & Leads) - Imlo xatolari va sarlavha kesilishi
- **Sana:** 2026-08-17
- **Tuzatilgan Fayllar:**
  - [`src/pages/Services.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/Services.jsx)
  - [`src/utils/seedData.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/utils/seedData.jsx)
  - [`src/api/base44Client.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/api/base44Client.jsx)
- **Muammo Tavsifi:** 
  - Xizmatlar sahifasidagi sarlavha ("Katalog, narxlar va kategoriyalarni professional boshqarish") katta letter-spacing tufayli ekranga sig'may chap tomondan kesilib qolgan edi (`EGORIYALARNI PROFESSIONAL BOSHQARISH`).
  - Xizmat nomlarida, uchrashuvlarda, rejalar va lidlarda `1 ildizli tihsalr`, `Aqil Tish olish3`, `Briketlar`, `Kostny blok` va `Yatratildi` kabi imlo xatolari va ruscha so'z aralashishlari bor edi.
- **Sababi:** 
  - Sarlavha CSS xususiyatlarida o'ta katta tracking (harflar oralig'i) va matnni cheklovchi layout ishlatilgan.
  - Ma'lumotlar bazasi (mock/seed) seeder fayllari va foydalanuvchining lokal brauzer xotirasida (LocalStorage) eski noto'g'ri yozilgan ma'lumotlar saqlanib qolgan.
- **Qanday tuzatildi:** 
  - `Services.jsx` sarlavha konteyneri moslashuvchan qilinib, `tracking-wider ml-1 whitespace-normal break-words` stiliga o'tkazildi.
  - `seedData.jsx` seederidagi xatolar to'g'rilandi.
  - `base44Client.jsx` dagi `initializeSystem` funksiyasiga maxsus avtomatik korreksiya migratsiya skripti qo'shildi. Skript loyiha yuklanganda LocalStorage bazasidagi `1 ildizli tihsalr`, `Aqil Tish olish3`, `Briketlar`, `Kostny blok` va `Yatratildi` kabi xatolarni avtomatik o'zbekcha to'g'ri atamalarga (`1 ildizli tishlar`, `Aql tishini olish`, `Breketlar`, `Suyak bloki`, `Yaratildi`) o'zgartiradi.
- **Qaytalamaslik choralari:** Yangi tibbiy xizmatlar yoki eslatmalar kiritilganda doimo imlo va professional atamalarga diqqat qiling, kiritiladigan sarlavhalarda esa o'ta katta letter-spacing (`tracking`) dan qoching.

### 💳 Bemor Qo'shish (NewPatientFlow) - Chegirma qo'shilganda qarz miqdori ro'yxatda darhol yangilanmasligi
- **Sana:** 2026-08-16
- **Tuzatilgan Fayllar:**
  - [`src/components/patients/NewPatientFlow.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/NewPatientFlow.jsx)
- **Muammo Tavsifi:** Yangi bemor qo'shilganda, 4-bosqichda chegirma (discount) tanlansa yoki qo'llanilsa, bemorning yangi chegirmali qarz miqdori asosiy bemorlar ro'yxati (Patients.jsx) sahifasida darhol yangilanmasligi, faqatgina ma'lum vaqt o'tgach (kesh muddati tugagach yoki sahifa yangilangach) ko'rinishi kuzatilgan.
- **Sababi:** Yangi bemor va reja yaratilganda 3-bosqich oxirida `onSaved()` chaqirilib, keshlar (React Query) yangilangan edi, ammo 4-bosqichda chegirma qo'llanilganda (`handleApplyDiscount`) backend DB yangilansa-da, `onSaved()` qayta chaqirilmagan. Modal yopilganda ham faqat `handleClose()` chaqirilib, keshlar yangilanishsiz qolgan.
- **Qanday tuzatildi:** `NewPatientFlow.jsx` faylidagi `handleApplyDiscount` funksiyasi ichida bemor qarzi bazada muvaffaqiyatli yangilangandan so'ng, `onSaved()` (agar mavjud bo'lsa) chaqiriladigan qilindi va u `useCallback` dependency arrayiga qo'shildi.
- **Qaytalamaslik choralari:** Bemor yoki uning to'lovi/qarzi bilan bog'liq har qanday o'zgarishlar modal ichida bajarilganda, har doim parent sahifadagi keshlar yangilanishi uchun `onSaved()` yoki tegishli invalidation chaqirilishini ta'minlang.

### ⚡ Bemor Profili (Patient Profile) - Renders va sekin data loading (lag) muammosi
- **Sana:** 2026-08-15
- **Tuzatilgan Fayllar:**
  - [`src/pages/PatientProfile.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/pages/PatientProfile.jsx)
  - [`src/components/patients/ProfessionalOdontogram.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/ProfessionalOdontogram.jsx)
  - [`src/components/patients/PatientPayments.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/PatientPayments.jsx)
  - [`src/components/patients/PatientAppointments.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/PatientAppointments.jsx)
  - [`src/components/patients/PatientTreatments.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/PatientTreatments.jsx)
  - [`src/components/patients/PatientNotes.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/components/patients/PatientNotes.jsx)
  - [`src/api/base44Client.jsx`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/src/api/base44Client.jsx)
- **Muammo Tavsifi:** Bemor profili sahifasida tablar almashtirilganda yoki eslatma yozilganda sayt qotishi, CPU 100% yuklanishi va tab almashtirish sekinligi kuzatilgan. Shuningdek, ma'lumotlarni parallel yuklash sekin kechib, ma'lumotlar uzoq vaqt chiqmay qolgan.
- **Sababi:** 
  - Radix tablari barcha tab tarkibidagi heavy komponentlarni (odontogramlar, to'lovlar, qabullar ro'yxati) DOM-da hidden qilib ushlab turgan va har bir parent re-renderida hammasini boshqatdan render qilgan.
  - Odontogramma propslarida (`onToothClick`, `selectedTeeth={[]}`, `onOcclusionNotesChange`) inline obektlar va arrow funksiyalar yozilganligi tufayli memoization buzilgan.
  - Har safar sahifa yuklanganda shifokorlar va xizmatlar ro'yxati (static data) qayta-qayta filter API orqali chaqirilgan.
  - `base44Client` ning `.filter()` metodida `RequestCache` bo'lmagan, bu har safar tab o'zgarishi va yuklanishda Supabase ga parallel duplicate so'rovlar yuborilishiga olib kelgan.
- **Qanday tuzatildi:** 
  - Har bir tab tarkibi `{activeTab === 'tabName' && ...}` orqali faqat aktiv tab uchun render qilinadigan qilindi (lazy load & unmount).
  - Barcha child komponentlar (`PatientPayments`, `PatientAppointments`, `PatientTreatments`, `PatientNotes`) `React.memo` bilan o'raldi.
  - Odontogramma propslari `useCallback` va `useMemo` yordamida stabillashtirildi.
  - Shifokorlar va xizmatlar ro'yxati modul-level `servicesCache` va `doctorsCache` o'zgaruvchilariga keshlandi.
  - `base44Client` dagi `.filter()` so'rovlari 30 soniyalik `RequestCache` drayveri bilan o'raldi hamda `create`/`update`/`delete` amallarida avtomatik invalidate qilindi.
- **Qaytalamaslik choralari:** 
  - Sahifadagi tablar va odontogramma propslariga o'zgartirish kiritganda inline funksiyalar yozmang (`useCallback` ishlating).
  - Heavy child komponentlarni har doim `React.memo` orqali eksport qiling.
  - API `.filter()` metodini o'zgartirganda kesh drayverini buzib qo'ymang.

### 💳 To'lovlar (Payments) - Stripe orqali to'lov miqdorini hisoblash xatosi va RLS cheklovi
- **Sana:** 2026-08-15
- **Tuzatilgan Fayllar:**
  - [`backend/src/payments/payments.service.ts`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/backend/src/payments/payments.service.ts)
  - [`CREATE_PAYMENTS_TABLE.sql`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/CREATE_PAYMENTS_TABLE.sql)
- **Muammo Tavsifi:** To'lovlar bo'limida foydalanuvchilar o'zlariga tegishli bo'lmagan klinikaning to'lov ma'lumotlarini ko'ra olishi va Stripe orqali hisoblangan summaning sent (cents) va dollar o'rtasidagi tafovut tufayli 100 barobar kam yoki ko'p o'tishi kuzatilgan.
- **Sababi:** Database darajasida Row Level Security (RLS) faollashtirilmagan edi va Stripe API-ga summani yuborishda dollar qiymati butun son sifatida to'g'ridan-to'g'ri sent o'rniga yuborilgan (Stripe summani doim eng kichik pul birligida kutadi, masalan 10.00$ uchun 1000 yuborilishi kerak).
- **Qanday tuzatildi:** 
  - RLS qoidalari bazada faollashtirildi, `X-Clinic-ID` orqali faqat so'rov yuborgan klinikaning to'lovlari ko'rinadigan qilindi.
  - Kodda Stripe to'lov miqdori `Math.round(amount * 100)` ko'rinishida yuboriladigan qilindi.
- **Qaytalamaslik choralari:** 
  - Stripe so'rovlariga o'zgartirish kiritganda, summani hisoblaydigan joyda `* 100` ko'paytuvchisini olib tashlamang.
  - SQL fayllarida RLS qoidalarini (Row Level Security) har bir yangi jadval uchun doim yoqing.

---

### 📅 Qabullar (Appointments) - Bir vaqtga ikki marta yozilish (Double Booking) xatosi
- **Sana:** 2026-08-15
- **Tuzatilgan Fayllar:**
  - [`backend/src/appointments/appointments.service.ts`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/backend/src/appointments/appointments.service.ts)
- **Muammo Tavsifi:** Shifokor qabuli vaqtini belgilashda bir vaqtning o'ziga bir nechta bemor yozilib qolayotgan edi.
- **Sababi:** Yangi qabul yaratilayotganda bazadagi mavjud qabullar bilan vaqtlar kesishuvi (conflict checks) to'g'ri tekshirilmagan edi.
- **Qanday tuzatildi:** Vaqtlar oralig'ini tekshiruvchi validator qo'shildi: `startTime < newEndTime && endTime > newStartTime` sharti orqali kesishish tekshirildi.
- **Qaytalamaslik choralari:** Qabullar vaqtini tahrirlaydigan har qanday metodda kesishuv tekshiruvini (appointment conflicts check) aslo o'chirmang.

---

## 📝 Yangi muammoni qo'shish andozasi (Template)
Yangi xato tuzatilganda quyidagi andozadan foydalanib eng tepaga qo'shing:

```markdown
### [Komponent nomi] - [Qisqacha tavsif]
- **Sana:** YYYY-MM-DD
- **Tuzatilgan Fayllar:**
  - [`fayl_yo'li`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/fayl_yo'li)
- **Muammo Tavsifi:** [Nima buzilgan edi, qanday alomatlar bor edi?]
- **Sababi:** [Xato nima sababdan kelib chiqqan edi?]
- **Qanday tuzatildi:** [Muammo qanday hal etildi, qaysi kod o'zgartirildi?]
- **Qaytalamaslik choralari:** [Kelajakda bu xato yana kelib chiqmasligi uchun nimalarga e'tibor berish kerak?]
```

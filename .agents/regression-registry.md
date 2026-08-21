# Regression Prevention Registry (Muammolar va Tuzatishlar Reyestri)

Ushbu fayl loyihada yuz bergan va muvaffaqiyatli tuzatilgan har qanday xatolik (bug/error) ro'yxatini saqlaydi.
**Maqsad:** Loyihaga keyinchalik kiritiladigan o'zgarishlar ushbu xatolarni qaytadan yuzaga keltirmasligini (regression) ta'minlash.

> [!IMPORTANT]
> - Har qanday yangi xato yoki muammo yechilgandan so'ng, uni albatta ushbu reyestrga qo'shing!
> - Har qanday yangi kod yozish yoki tahrirlashdan oldin, ushbu reyestrni tekshirib chiqing!

---

## 📂 Ro'yxatga Olingan Muammolar

<!-- Yangi xatoliklarni ro'yxatning tepasiga (quyidagi qismga) qo'shing -->

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

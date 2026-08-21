---
name: regression-preventer
description: >-
  Prevent bug regressions, ensure previously solved bugs in payments, auth, appointments, or other parts do not reappear, and enforce checking and logging of solved bugs in the regression registry. Triggered by queries like "xato qaytmasin", "to'lov xatosini tekshir", "prevent regressions", "regression-preventer", "muammolar qaytalanmasin".
---

# Regression Preventer (Bug Regression Shield / Qaytalamaslik Shviti)

## Overview (Umumiy ma'lumot)
Ushbu SKILL loyihada ilgari yuz bergan va muvaffaqiyatli tuzatilgan xatolarning (bug) qaytadan paydo bo'lishini (regression) umuman bartaraf etish uchun mo'ljallangan. Dasturiy ta'minotni rivojlantirishda, ayniqsa AI agentlar bilan ishlashda, oldin tuzatilgan xatolarning yangi kod yozilganda yana qaytib kelishi tez-tez uchraydi. 

Bu skill loyihadagi muhim bo'limlar (To'lovlar, Avtorizatsiya, Qabullar va boshqalar) ustida ish boshlashdan oldin tarixiy xatolarni tekshirishni va yangi tuzatishlarni tizimli ravishda qayd etishni majburiy qilib belgilaydi.

---

## Quick Start (Tezkor Boshlash)
1. **O'zgartirishdan oldin:** Kodga biron bir o'zgartirish kiritishdan oldin [.agents/regression-registry.md](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/.agents/regression-registry.md) faylini o'qing.
2. **Tekshirish:** O'zgartirmoqchi bo'lgan faylingiz yoki komponentingiz (masalan, `payments`, `auth`, `appointments`) oldin ro'yxatga olinganmi yoki yo'qmi, aniqlang.
3. **Profilaktika:** Yangi yozilayotgan kod oldingi tuzatish shartlariga zid kelmasligini va ularni buzib yubormasligini ta'minlang.

---

## Workflow (Ish jarayoni)

### 1. Pre-Implementation Check (Ishdan Oldingi Tekshiruv)
* Kod yozishni yoki rejalar tuzishni boshlashdan oldin, [.agents/regression-registry.md](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/.agents/regression-registry.md) faylini to'liq o'qib chiqing.
* Siz o'zgartirmoqchi bo'lgan fayllarga tegishli yozuvlarni toping.
* Har bir tegishli yozuvning **"Qaytalamaslik choralari" (Prevention measures)** qismiga alohida e'tibor bering.

### 2. Implementation & Protection (Kodlash va Himoya Qoidalari)
* Oldingi xatoni tuzatishda qo'shilgan tekshiruvlar (validation), error boundary-lar yoki try-catch bloklarini aslo olib tashlamang yoki chetlab o'tmang.
* Agar to'lovlar, avtorizatsiya yoki ma'lumotlar bazasi sxemasini o'zgartirayotgan bo'lsangiz, oldingi RLS (Row Level Security) qoidalari, tranzaksiyalar xavfsizligi va ma'lumotlar yaxlitligini buzmaslikka kafolat bering.
* Mumkin bo'lsa, xatolik qaytalanmasligini avtomatlashtirilgan testlar (unit/integration tests) orqali tekshiring.

### 3. Post-Fix Registration (Tuzatishni Ro'yxatdan O'tkazish)
Yangi xatolik aniqlanib, tuzatilgandan so'ng, ushbu xatoni reyestrga kiritish majburiydir:
* [.agents/regression-registry.md](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/.agents/regression-registry.md) faylini oching.
* **📂 Ro'yxatga Olingan Muammolar** bo'limining eng yuqori qismiga yangi xatolik tafsilotlarini quyidagi shablon asosida qo'shing:

```markdown
### [Komponent Nomi] - [Muammoning qisqacha mazmuni]
- **Sana:** YYYY-MM-DD
- **Tuzatilgan Fayllar:**
  - [`fayl_yoli`](file:///c:/Users/aveks/Desktop/app%20shahobidin%204/fayl_yoli)
- **Muammo Tavsifi:** Nima buzilgan edi, qanday muammo bor edi.
- **Sababi:** Nega bu xato kelib chiqqan edi (kod darajasida).
- **Qanday tuzatildi:** Muammoni qanday hal qildingiz va qaysi kodni o'zgartirdingiz.
- **Qaytalamaslik choralari:** Kelajakda bu xato yana qaytib kelmasligi uchun nimalarga e'tibor berish kerak (muhim qoidalar).
```

---

## Component-Specific Safeguards (Komponentlar bo'yicha maxsus qoidalar)

### 💳 Payments & Stripe (To'lovlar bo'limi)
* **Kritik holat:** To'lovlar miqdori (amount), valyutalar, tranzaksiya statuslari va foydalanuvchilarning hisoblari doimo to'g'ri hisoblanishi shart.
* **Tekshiruv:** Har qanday to'lov o'zgarishida, o'zgartirish kiritilgan metod tranzaksiya yaxlitligini saqlashini va hisob-kitoblarda yaxlitlash xatolari (rounding errors) yo'qligini tekshiring.
* **Supabase/DB:** RLS qoidalari faqat tegishli klinika yoki foydalanuvchi o'z to'lovlarini ko'ra olishini ta'minlashi shart.

### 🔐 Authentication & Authorization (Login va Xavfsizlik)
* **Kritik holat:** Foydalanuvchilar o'zlariga tegishli bo'lmagan klinika ma'lumotlariga yoki boshqa bemorlarning shaxsiy ma'lumotlariga kira olmasliklari shart (Multi-tenant isolation).
* **Tekshiruv:** JWT tokenlar, Middleware-lar va API endpointlardagi `X-Clinic-ID` tekshiruvlarini aslo chetlab o'tmang.

### 📅 Appointments (Qabullar va Eslatmalar)
* **Kritik holat:** Bitta shifokorga bitta vaqtda ikkita bemor yozilib qolmasligi (double booking) va eslatmalar o'z vaqtida yuborilishi kerak.
* **Tekshiruv:** Vaqt zonalari (timezones) va bandlik cheklovlari (conflicts) to'g'ri ishlashini tekshiring.

---

## Common Mistakes (Tez-tez qilinadigan xatolar)
* **Ko'r-ko'rona o'zgartirish (Blind Edit):** Reyestrni tekshirmasdan kod yozish va natijada 1-2 hafta oldin tuzatilgan xatoni qaytadan keltirib chiqarish.
* **Hujjatlashtirishni unutish:** Xatoni tuzatib, reyestrni yangilamaslik. Bu keyingi safar boshqa dasturchi/agent xuddi shu xatoga yo'l qo'yishiga olib keladi.
* **Try-Catch va Tekshiruvlarni olib tashlash:** Kodni soddalashtirish bahonasida oldingi tuzatishda qo'shilgan muhim xavfsizlik cheklovlarini o'chirib yuborish.

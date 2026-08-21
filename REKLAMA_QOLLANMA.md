# 📢 REKLAMA BOSHQARUV TIZIMI

## 🎯 Umumiy Ma'lumot

Saytga reklama funksiyasi qo'shildi. Admin panel orqali reklamalarni boshqarish va asosiy saytda reklamalar ko'rsatish imkoniyati mavjud.

---

## ✨ Xususiyatlar

### 1. **Admin Panel - Reklama Boshqaruvi**
- ✅ Reklama qo'shish
- ✅ Reklamani tahrirlash
- ✅ Reklamani o'chirish
- ✅ Reklamani yoqish/o'chirish (enable/disable)
- ✅ Reklama vaqtini sozlash (boshlanish va tugash vaqti)
- ✅ Rasm URL qo'shish
- ✅ Link URL qo'shish
- ✅ CTA (Call-to-Action) matni
- ✅ Statistika kuzatish (impressions, clicks, CTR)

### 2. **Asosiy Sayt - Reklama Ko'rsatish**
- ✅ Banner shaklida pastda ko'rsatiladi
- ✅ Bir nechta reklamalar avtomatik aylanadi (har 10 soniyada)
- ✅ Reklamaga bosganda link ochiladi
- ✅ Yopish tugmasi mavjud
- ✅ Progress bar ko'rsatiladi
- ✅ Responsive dizayn (mobil va desktop)

---

## 🚀 Qanday Ishlatish

### Admin Panelda Reklama Qo'shish

1. **Super Admin portaliga kiring:**
   ```
   http://localhost:5175/super-admin-portal
   Login: admin
   Password: admin123
   ```

2. **"Reklamalar" tabini tanlang**
   - Yuqorida ikkita tab bor: "Klinikalar" va "Reklamalar"
   - "Reklamalar" tugmasini bosing

3. **"Reklama Qo'shish" tugmasini bosing**

4. **Reklama ma'lumotlarini to'ldiring:**
   - **Sarlavha*** (majburiy): Reklama nomi
   - **Tavsif**: Qisqa tavsif (ixtiyoriy)
   - **Rasm URL**: Reklama rasmi havolasi (ixtiyoriy)
   - **Link URL**: Bosganda ochiladigan sayt (ixtiyoriy)
   - **CTA Matni**: Tugma matni (masalan: "Batafsil", "Hoziroq", "Ko'rish")
   - **Boshlanish Vaqti**: Reklama qachon ko'rsatila boshlaydi (masalan: 08:00)
   - **Tugash Vaqti**: Reklama qachon to'xtaydi (masalan: 22:00)
   - **Reklama faol**: Checkbox orqali yoqish/o'chirish

5. **"Saqlash" tugmasini bosing**

### Reklamani Boshqarish

- **Yoqish/O'chirish**: "Yoqish" yoki "O'chirish" tugmasi orqali
- **Tahrirlash**: Qalam ikonkasi orqali
- **O'chirish**: Axlat qutisi ikonkasi orqali

### Statistika

Har bir reklama uchun quyidagi statistika ko'rsatiladi:
- **Impressions**: Necha marta ko'rsatilgan
- **Clicks**: Necha marta bosilgan
- **CTR**: Click-through rate (clicks / impressions * 100)

---

## 📊 Reklama Ko'rinishi

### Desktop
```
┌──────────────────────────────────────────────────────┐
│  [Rasm]  Sarlavha                                    │
│          Tavsif                         [CTA Button] │
│          Reklama • ● ○ ○                              │
└──────────────────────────────────────────────────────┘
```

### Mobile
```
┌─────────────────────────┐
│ [Rasm] Sarlavha         │
│        Tavsif  [CTA]    │
│        Reklama          │
└─────────────────────────┘
```

---

## 🔧 Texnik Ma'lumotlar

### Fayllar

1. **Reklama Menejeri:**
   - `src/utils/adManager.js` - CRUD operatsiyalar

2. **Reklama Komponenti:**
   - `src/components/layout/AdBanner.jsx` - Banner ko'rsatish

3. **Admin Panel:**
   - `src/pages/SuperAdmin.jsx` - Reklama boshqaruvi UI

4. **Layout Integratsiya:**
   - `src/components/layout/AppLayout.jsx` - Desktop layout
   - `src/components/layout/MobileLayout.jsx` - Mobile layout

### Ma'lumotlar Saqlash

Reklamalar `localStorage` da saqlanadi:
```javascript
Key: 'clinic_ads'
Value: Array of ad objects
```

### Reklama Ob'ekti Strukturasi

```javascript
{
  id: "1234567890",           // Unique ID
  title: "Reklama sarlavhasi", // Sarlavha (majburiy)
  description: "Tavsif",       // Tavsif (ixtiyoriy)
  image_url: "https://...",    // Rasm URL (ixtiyoriy)
  link_url: "https://...",     // Link URL (ixtiyoriy)
  cta_text: "Batafsil",        // CTA matni (ixtiyoriy)
  start_time: "08:00",         // Boshlanish vaqti (ixtiyoriy)
  end_time: "22:00",           // Tugash vaqti (ixtiyoriy)
  enabled: true,               // Faol holat
  created_at: "2024-...",      // Yaratilgan sana
  clicks: 0,                   // Clicklar soni
  impressions: 0               // Ko'rsatishlar soni
}
```

---

## 🎨 Dizayn

### Ranglar
- **Background**: Gradient (slate-900 → slate-800 → slate-900)
- **Border**: White 10% opacity
- **CTA Button**: Blue to Cyan gradient
- **Text**: White for title, Slate-300 for description

### Animatsiyalar
- **Slide Up**: Banner pastdan chiqadi
- **Auto Rotate**: Har 10 soniyada keyingi reklamaga o'tadi
- **Progress Bar**: Pastda progress bar ko'rsatiladi
- **Hover Effects**: Interactive elementlar hover bilan

---

## 📱 Responsive

### Desktop (>768px)
- Banner balandligi: auto
- Rasm hajmi: 20x20 (80px)
- Padding: 6 (24px)

### Mobile (<768px)
- Banner balandligi: compact
- Rasm hajmi: 16x16 (64px)
- Padding: 4 (16px)
- Bottom navigation uchun joy qoldirilgan (pb-24)

---

## ⚙️ Sozlamalar

### Avtomatik Aylanish
- **Interval**: 10 soniya
- **Loop**: Ha (oxiridan keyin boshiga qaytadi)
- **Tracking**: Har yangi reklama impression track qilinadi

### Vaqt Cheklovlari
- Agar `start_time` va `end_time` belgilangan bo'lsa
- Faqat shu vaqt oralig'ida reklama ko'rsatiladi
- Misol: 08:00 - 22:00 (faqat shu vaqtda ko'rsatiladi)

---

## 🧪 Test Qilish

1. **Admin panelda reklama yarating**
2. **Asosiy saytga o'ting** (`http://localhost:5175`)
3. **Pastda banner ko'rinishi kerak**
4. **10 soniya kuting** - keyingi reklamaga o'tishi kerak
5. **Reklamaga bosing** - link ochilishi kerak
6. **X tugmasini bosing** - banner yopilishi kerak

---

## 🐛 Muammolarni Hal Qilish

### Reklama ko'rinmayapti
1. Reklama "Faol" ekanligini tekshiring
2. Hozirgi vaqt `start_time` va `end_time` oralig'ida ekanligini tekshiring
3. Browser console da xatolik bor-yo'qligini tekshiring

### Rasm ko'rinmayapti
1. URL to'g'ri ekanligini tekshiring
2. Rasm public access ekanligini tekshiring
3. CORS muammosi yo'qligini tekshiring

### Link ochilmayapti
1. URL to'g'ri formatda ekanligini tekshiring (https:// bilan boshlanishi kerak)
2. Popup blocker o'chiq ekanligini tekshiring

---

## 📈 Kelajak Rejalar

- [ ] A/B testing qo'llab-quvvatlash
- [ ] Ko'proq analytics (conversion tracking)
- [ ] Reklama kampaniyalari (groups)
- [ ] Targeting (foydalanuvchi segmentlari)
- [ ] Budget management
- [ ] Auto-pause when budget exhausted
- [ ] Image upload (hozir faqat URL)
- [ ] Video reklama qo'llab-quvvatlash
- [ ] Carousel/banner slider variantlari

---

## 💡 Maslahatlar

1. **Rasm o'lchami**: 400x400 yoki 800x800 px tavsiya etiladi
2. **Matn uzunligi**: Sarlavha qisqa va aniq bo'lsin (max 50 character)
3. **CTA**: Aniq va harakatga chorlovchi bo'lsin ("Hoziroq", "Batafsil")
4. **Vaqt**: Peak soatlarda reklama ko'rsatish (09:00-21:00)
5. **Testing**: Turli reklamalar test qilib, eng yaxshisini tanlang

---

## 📞 Yordam

Savollar bo'lsa:
1. Console loglarni tekshiring (F12)
2. LocalStorage ni ko'ring: `localStorage.getItem('clinic_ads')`
3. Code review qiling: `src/utils/adManager.js`

---

**Muvaffaqiyatlar! 🎉**

Reklama tizimi to'liq tayyor va ishlayapti!

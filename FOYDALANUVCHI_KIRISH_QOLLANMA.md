# Foydalanuvchi Kirish Qo'llanmasi 👤

## Muammo Nima?

Super Admin paneldan foydalanuvchi qo'shgandan so'ng, login qilishda muammo yuzaga kelmoqda. Buning sababi - **to'g'ri Clinic ID kiritilmayapti**.

---

## ✅ To'g'ri Kirish Usuli

### 1-qadam: Klinikani Yaratish

Avval klinika yaratishingiz kerak:

```
Super Admin Portal → Klinikalar → Klinika Qo'shish
```

**Misol:**
- **Klinika ID:** `shahobidin_clinic` (bu juda muhim!)
- **Klinika nomi:** Shahobidin Stomatologiya
- **Parol:** admin123
- **Status:** Active

### 2-qadam: Foydalanuvchi Qo'shish

Klinika yaratilgandan so'ng, unga foydalanuvchi qo'shing:

```
Super Admin Portal → Klinikalar ro'yxati
→ "Foydalanuvchilar" tugmasini bosing
→ Yangi foydalanuvchi ma'lumotlarini kiriting
```

**Misol:**
- **Login:** doctor1
- **Parol:** doctor123
- **Ism:** Dr. Aliyev
- **Rol:** Doctor

### 3-qadam: Login Sahifasida Kirish

Endi asosiy login sahifasiga o'ting:

```
http://localhost:5175/login
```

**To'ldirish kerak bo'lgan maydonlar:**

```
┌─────────────────────────────┐
│  Klinika ID:                │
│  [shahobidin_clinic]        │ ← 1-qadamdagi ID
│                             │
│  Login:                     │
│  [doctor1]                  │ ← 2-qadamdagi username
│                             │
│  Parol:                     │
│  [doctor123]                │ ← 2-qadamdagi password
│                             │
│  [Kirish]                   │
└─────────────────────────────┘
```

---

## 📋 Muhim Eslatmalar

### ❗ Clinic ID Nima?

**Clinic ID** - bu har bir klinikaning noyidentifikatori. 

**Qayerdan topish mumkin:**
1. Super Admin portalga kiring
2. "Klinikalar" tabini oching
3. Kerakli klinikani toping
4. **"Klinika ID"** ustuniga qarang

**Misol Clinic ID lar:**
- `shahobidin_clinic`
- `dental_care_uz`
- `smile_clinic`

### ❗ Username va Password

- **Username:** Kichik harflar bilan (doctor1, admin, nurse1)
- **Password:** Istalgan parol (kamida 6 ta belgi)
- **Ism:** To'liq ism (Dr. Karimov, Hamshira Dilnoza)

### ❗ Rol Turlari

Foydalanuvchi qo'shayotganda quyidagi rollarni tanlashingiz mumkin:

| Rol | Vazifa |
|-----|--------|
| **admin** | To'liq huquqlar |
| **doctor** | Shifokor huquqlari |
| **nurse** | Hamshira huquqlari |
| **receptionist** | Qabulxona xodimi |

---

## 🔍 Tekshirish Usuli

Agar login ishlamasa, quyidagilarni tekshiring:

### 1. Clinic ID To'g'rimi?

```javascript
// Browser Console da tekshirish:
console.log(localStorage.getItem('system_users'));
```

Bu sizning barcha foydalanuvchilaringizni ko'rsatadi. Har bir foydalanuvchining `clinic_id` maydoni bor.

### 2. Foydalanuvchi Mavjudmi?

```
Super Admin → Klinikalar → "Foydalanuvchilar" tugmasi
→ Ro'yxatda foydalanuvchingiz bormi?
```

### 3. Status Active Mi?

Klinika statusi **Active** bo'lishi kerak:
```
Super Admin → Klinikalar → Status ustuni → "Active" ✅
```

---

## 💡 Misol Senariy

### Senariy 1: Yangi Klinika va Foydalanuvchi

**1. Klinika yaratish:**
```
ID: my_dental_clinic
Nomi: Mening Stomatologiyam
Parol: clinic123
Status: Active
```

**2. Foydalanuvchi qo'shish:**
```
Clinic ID: my_dental_clinic
Username: receptionist1
Password: welcome123
Ism: Zilola Rahimova
Rol: receptionist
```

**3. Login qilish:**
```
URL: http://localhost:5175/login

Maydonlar:
- Klinika ID: my_dental_clinic
- Login: receptionist1
- Parol: welcome123

Natija: ✅ Muvaffaqiyatli kirish!
```

---

## 🚨 Keng Tarqalgan Xatolar

### Xato 1: Clinic ID Kiritilmagan
```
❌ Xato: "Barcha maydonlarni to'ldiring"
✅ Yechim: Clinic ID ni to'g'ri kiriting
```

### Xato 2: Noto'g'ri Clinic ID
```
❌ Xato: "Klinika topilmadi"
✅ Yechim: Super Admin dan to'g'ri Clinic ID ni ko'ring
```

### Xato 3: Noto'g'ri Username/Password
```
❌ Xato: "Login yoki parol noto'g'ri"
✅ Yechim: Username va parolni tekshiring (kichik/katta harflar)
```

### Xato 4: Klinika Faol Emas
```
❌ Xato: "Klinika faol emas"
✅ Yechim: Super Admin dan klinikani "Active" qiling
```

---

## 🔧 Muammolarni Bartaraf Etish

### Agar hali ham ishlamasa:

**1. LocalStorage ni tozalash:**
```
Brauzer: F12 → Application → Local Storage
→ "is_authenticated", "user_id" larni o'chiring
→ Sahifani yangilang
```

**2. Foydalanuvchini qayta yaratish:**
```
Super Admin → Klinikalar → Foydalanuvchilar
→ Eski foydalanuvchini o'chiring
→ Yangi foydalanuvchi qo'shing
```

**3. Browser Cache ni tozalash:**
```
Ctrl + Shift + Delete
→ Cache va cookies ni tozalang
→ Sahifani qayta yuklang
```

---

## 📞 Tezkor Yordam

**Demo ma'lumotlar:**

```
Klinika ID: default_clinic
Login: admin
Parol: admin
```

**Admin Login:**
```
URL: http://localhost:5175/super-admin-portal
Username: admin
Password: admin123
```

---

## ✨ Xulosa

Foydalanuvchi qo'shgandan keyin login qilish uchun:

1. ✅ **Clinic ID** ni bilish (Super Admin dan ko'ring)
2. ✅ **Username** va **Password** ni eslab qolish
3. ✅ Login sahifasida **uchala maydonni** to'ldirish
4. ✅ Klinika **Active** statusda ekanligini tekshirish

Agar muammo davom etsa, browser console ni ochib (F12) xatolarni ko'ring! 🎯

# 🦷 DENTAL CLINIC - TO'LIQ ISHGA TUSHIRISH QO'LLANMASI

## 📋 Talablar (Prerequisites)

Loyihani ishga tushirish uchun quyidagilar kerak:

1. **Node.js** (v18 yoki undan yuqori) ✅ O'rnatilgan
2. **npm** (Node Package Manager) ✅ O'rnatilgan
3. **MongoDB** - Ma'lumotlar bazasi (3 variant)
4. **Docker** (ixtiyoriy, lekin tavsiya etiladi)

---

## 🚀 TEZ ISHGA TUSHIRISH (Eng oson yo'li)

### Variant 1: Docker bilan (TAVSIYA ETILADI) ⭐

Agar sizda Docker Desktop o'rnatilgan bo'lsa:

```bash
# Loyiha papkasida ushbu faylni ishga tushiring:
Start-Dental-Clinic.bat
```

Bu skript avtomatik ravishda:
- ✅ MongoDB va Redis ni Docker orqali ishga tushiradi
- ✅ Backend serverni port 3000 da ishga tushiradi
- ✅ Frontend ni port 5173 da ishga tushiradi

---

### Variant 2: Alohida ishga tushirish

Agar siz backend va frontend ni alohida boshqarmoqchi bo'lsangiz:

**1-qadam: Backend ishga tushirish**
```bash
Start-Backend-Only.bat
```

**2-qadam: Frontend ishga tushirish**
```bash
Start-Frontend-Only.bat
```

---

## 🗄️ MONGODB SOZLASH (3 XIL VARIANT)

### Variant A: Docker orqali (ENG OSON) ⭐⭐⭐

1. **Docker Desktop o'rnating:**
   - Yuklab olish: https://www.docker.com/products/docker-desktop
   - O'rnatish va kompyuterni qayta ishga tushirish

2. **Loyihani ishga tushirish:**
   ```bash
   Start-Dental-Clinic.bat
   ```

Tayyor! Docker avtomatik ravishda MongoDB va Redis ni ishga tushiradi.

---

### Variant B: MongoDB Atlas (Cloud - BEPUL) ⭐⭐

1. **MongoDB Atlas akkaunt oching:**
   - Sayt: https://www.mongodb.com/cloud/atlas/register
   - Bepul akkaunt yarating (kredit karta talab qilinmaydi)

2. **Cluster yarating:**
   - "Build a Database" tugmasini bosing
   - "M0 FREE" ni tanlang
   - Region tanlang (Yevropa yoki AQSh)
   - "Create Cluster" ni bosing (3-5 daqiqa kutish kerak)

3. **Database User yarating:**
   - "Database Access" bo'limiga o'ting
   - "Add New Database User" ni bosing
   - Username va Password kiriting (eslab qoling!)
   - "Read and write to any database" ni tanlang
   - "Add User" ni bosing

4. **Network Access sozlash:**
   - "Network Access" bo'limiga o'ting
   - "Add IP Address" ni bosing
   - "Allow Access from Anywhere" (0.0.0.0/0) ni tanlang
   - "Confirm" ni bosing

5. **Connection String olish:**
   - "Database" bo'limiga qayting
   - "Connect" tugmasini bosing
   - "Connect your application" ni tanlang
   - Connection string ni nusxa oling
   - Misol: `mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/`

6. **.env faylini tahrirlash:**
   
   `backend\.env` faylini oching va quyidagini o'zgartiring:
   ```env
   MONGODB_URI=mongodb+srv://sizning_username:sizning_password@cluster0.xxxxx.mongodb.net/dental-clinic
   ```

7. **Backend ni ishga tushirish:**
   ```bash
   Start-Backend-Only.bat
   ```

---

### Variant C: Local MongoDB (Kompyuteringizga o'rnatish)

1. **MongoDB Community Server yuklab oling:**
   - Sayt: https://www.mongodb.com/try/download/community
   - Operating System: Windows
   - Package: MSI
   - Yuklab oling va o'rnating

2. **MongoDB Compass o'rnating (ixtiyoriy):**
   - Grafik interfeys orqali ma'lumotlarni ko'rish uchun
   - https://www.mongodb.com/try/download/compass

3. **MongoDB xizmatini tekshirish:**
   ```powershell
   # PowerShell da:
   Get-Service -Name MongoDB
   ```

4. **.env faylini tahrirlash:**
   
   `backend\.env` faylida:
   ```env
   MONGODB_URI=mongodb://localhost:27017/dental-clinic
   ```

5. **Backend ni ishga tushirish:**
   ```bash
   Start-Backend-Only.bat
   ```

---

## 🔧 MUAMMOLARNI HAL QILISH

### ❌ MongoDB ulanmayapti

**Yechim 1: Docker ishlatayotgan bo'lsangiz**
```bash
cd backend
docker-compose ps
docker-compose logs mongodb
```

**Yechim 2: .env faylini tekshiring**
- `backend\.env` faylida MONGODB_URI to'g'ri ekanligini tekshiring
- Parolda maxsus belgilar bo'lsa, URL encode qiling

**Yechim 3: Port band bo'lsa**
```bash
# Port 27017 ni kim ishlatayotganini tekshirish
netstat -ano | findstr :27017
```

---

### ❌ Backend ishga tushmayapti

**1. Dependencies o'rnatilganmi?**
```bash
cd backend
npm install
```

**2. Port 3000 bandmi?**
```bash
netstat -ano | findstr :3000
```

Agar band bo'lsa, `backend\.env` faylida portni o'zgartiring:
```env
PORT=3001
```

**3. Xatolik xabarini o'qing**
- Terminalda qizil rangda chiqqan xatolarni diqqat bilan o'qing
- Ko'pincha muammo aniq ko'rsatilgan bo'ladi

---

### ❌ Frontend ishga tushmayapti

**1. Dependencies o'rnatilganmi?**
```bash
npm install
```

**2. Port 5173 bandmi?**
Vite avtomatik ravishda keyingi bo'sh portni topadi (5174, 5175, ...)

**3. Browser da oching:**
- http://localhost:5173
- Yoki terminalda ko'rsatilgan portga o'ting

---

### ❌ "Cannot find module" xatosi

**Yechim:**
```bash
cd backend
rm -rf node_modules package-lock.json
npm install
```

Keyin VS Code ni qayta yuklang:
- `Ctrl+Shift+P` → "Reload Window"

---

## 📊 PORTLAR

| Xizmat | Port | URL |
|--------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend API | 3000 | http://localhost:3000 |
| API Docs (Swagger) | 3000 | http://localhost:3000/api/docs |
| MongoDB | 27017 | localhost:27017 |
| Redis | 6379 | localhost:6379 |

---

## 🛑 TO'XTATISH

### Barcha xizmatlarni to'xtatish:

1. **Terminal oynalarini yoping** (Backend va Frontend)

2. **Docker konteynerlarini to'xtatish:**
   ```bash
   cd backend
   docker-compose down
   ```

---

## 📝 DEFAULT FOYDALANUVCHI YARATISH

Backend ishga tushgandan so'ng, birinchi foydalanuvchini yaratish uchun:

1. **Swagger UI ga o'ting:**
   http://localhost:3000/api/docs

2. **POST /api/users endpoint ini toping**

3. **"Try it out" tugmasini bosing**

4. **Request body:**
   ```json
   {
     "email": "admin@clinic.uz",
     "password": "admin123",
     "firstName": "Admin",
     "lastName": "User",
     "role": "admin"
   }
   ```

5. **"Execute" tugmasini bosing**

6. **Frontend da login qiling:**
   - Email: admin@clinic.uz
   - Password: admin123

---

## 🔐 XAVFSIZLIK (Production uchun)

Production muhitda `.env` faylida quyidagilarni o'zgartiring:

```env
# JWT Secret - Juda murakkab parol qo'ying!
JWT_SECRET=super-secret-key-change-this-in-production-2024-random-string

# Stripe keys (agar to'lov tizimi ishlatilsa)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# AWS S3 (fayl saqlash uchun)
AWS_ACCESS_KEY_ID=your_real_key
AWS_SECRET_ACCESS_KEY=your_real_secret
```

---

## 📞 YORDAM KERAKMI?

### Fayllar:
- `README.md` - Asosiy loyiha hujjatlari
- `backend/README.md` - Backend batafsil ma'lumotlari
- `backend/START_HERE.md` - Backend tez boshlash
- `backend/DEPLOYMENT.md` - Production deployment
- `backend/SETUP_UZ.md` - O'zbek tilida qo'llanma

### Skriptlar:
- `Start-Dental-Clinic.bat` - Hammasini birgalikda ishga tushirish
- `Start-Backend-Only.bat` - Faqat backend
- `Start-Frontend-Only.bat` - Faqat frontend
- `backend/check-status.bat` - Holatni tekshirish

---

## ✅ TEKSHIRISH RO'YXATI

Loyiha to'g'ri ishlayotganini tekshirish:

- [ ] MongoDB ishlayapti (Docker yoki local)
- [ ] Backend server ishlayapti (http://localhost:3000)
- [ ] Swagger docs ochiladi (http://localhost:3000/api/docs)
- [ ] Frontend ishlayapti (http://localhost:5173)
- [ ] Browser da login sahifasi ko'rinadi
- [ ] Login qilish mumkin

---

## 🎯 KEYINGI QADAMLAR

1. ✅ Loyihani ishga tushirish
2. ✅ Birinchi admin foydalanuvchini yaratish
3. ✅ Klinik ma'lumotlarini kiritish
4. ✅ Bemorlarni qo'shish
5. ✅ Randevularni boshqarish
6. ✅ To'lovlarni kuzatish

---

**Muvaffaqiyatlar! 🦷✨**

Agar savollaringiz bo'lsa, hujjatlarni o'qing yoki developer bilan bog'laning.

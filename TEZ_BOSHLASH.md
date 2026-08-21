# 🚀 TEZ BOSHlash - 3 QADAMDA

## ⚡ ENG OSON USUL (Docker bilan)

### 1-QADAM: Docker Desktop o'rnating
- Yuklab olish: https://www.docker.com/products/docker-desktop
- O'rnatish va kompyuterni qayta ishga tushirish

### 2-QADAM: Loyihani ishga tushiring
```
Start-Dental-Clinic.bat
```
Faylni ikki marta bosing!

### 3-QADAM: Brauzerda oching
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/api/docs

**TAYYOR!** ✅

---

## 📋 AGAR DOCKER BO'L'MASA

### Variant A: MongoDB Atlas (Cloud - Bepul)

1. https://www.mongodb.com/cloud/atlas da akkaunt oching
2. Bepul cluster yarating
3. Connection string ni oling
4. `backend\.env` faylida MONGODB_URI ni yangilang
5. `Start-Backend-Only.bat` ni ishga tushiring
6. `Start-Frontend-Only.bat` ni ishga tushiring

### Variant B: Local MongoDB

1. https://www.mongodb.com/try/download/community dan yuklab oling
2. O'rnating
3. `Start-Backend-Only.bat` ni ishga tushiring
4. `Start-Frontend-Only.bat` ni ishga tushiring

---

## 🔐 BIRINCHI LOGIN

Backend ishga tushgandan so'ng:

1. http://localhost:3000/api/docs ga o'ting
2. POST /api/users endpoint orqali admin yarating:
```json
{
  "email": "admin@clinic.uz",
  "password": "admin123",
  "firstName": "Admin",
  "lastName": "User",
  "role": "admin"
}
```

3. Frontend da login qiling:
   - Email: admin@clinic.uz
   - Password: admin123

---

## ❓ MUAMMO BO'LSA

Batafsil qo'llanma: **TO_LIQ_ISHGA_TUSHIRISH.md**

Yoki:
- `backend/check-status.bat` - Holatni tekshirish
- `backend/START_HERE.md` - Backend yordam
- `backend/README.md` - To'liq hujjatlar

---

**Muvaffaqiyatlar! 🦷**

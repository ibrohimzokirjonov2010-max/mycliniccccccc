# ⚠️ Node.js O'rnatish Kerak!

## Muammo:
Terminal da `npm` va `node` buyruqlari ishlamayapti. Bu **Node.js o'rnatilmagan** degani.

---

## ✅ Yechim: Node.js O'rnatish

### 1-Qadam: Node.js Yuklab Olish

1. Brauzer da oching: **https://nodejs.org**
2. Tanlang: **LTS (Long Term Support)** versiyasi (tavsiya etiladi)
   - Hozirgi LTS: **Node.js 20.x**
3. "Download" tugmasini bosing

### 2-Qadam: O'rnatish

1. Yuklab olingan `.exe` faylni ishga tushiring
2. "Next" → "Next" → ... → "Finish"
3. Barchi standart sozlamalarni qoldiring

### 3-Qadam: Tekshirish

Yangi PowerShell terminal oching va yozing:

```bash
node --version
npm --version
```

Agar versiya raqamlari chiqsa (masalan: `v20.10.0`), muvaffaqiyatli! ✅

---

## 🚀 Keyin Backend ni Ishga Tushirish

Node.js o'rnatilgandan keyin:

```bash
# Backend papkasiga o'ting
cd "c:\Users\PC\Desktop\APP SHAHOBIDIN\backend"

# Dependencies o'rnating (agar hali o'rnatmagan bo'lsangiz)
npm install

# Serverni ishga tushiring
npm run start:dev
```

---

## 💡 Muhim Eslatmalar:

1. **Node.js o'rnatilgandan keyin kompyuterni qayta ishga tushiring** (restart)
2. **VS Code ni yopib qayta oching**
3. Agar hali ham ishlamasa, PATH ni tekshiring:
   - Control Panel → System → Advanced System Settings
   - Environment Variables
   - Path da `C:\Program Files\nodejs\` borligini tekshiring

---

## 🆘 Yordam Kerakmi?

Agar muammo bo'lsa:

1. Node.js to'g'ri o'rnatilganligini tekshiring:
   ```bash
   where node
   where npm
   ```

2. Agar hech narsa chiqmasa, Node.js qayta o'rnating

3. Kompyuterni restart qiling

---

## 📞 Keyingi Qadamlar:

Node.js o'rnatilgandan keyin:

1. ✅ `npm install` - Dependencies o'rnatish
2. ✅ `copy .env.example .env` - Environment fayl
3. ✅ MongoDB connection string qo'shish
4. ✅ `npm run start:dev` - Server ishga tushirish

---

**Node.js o'rnatib bo'lgach, menga xabar bering - serverni ishga tushiraman!** 🚀

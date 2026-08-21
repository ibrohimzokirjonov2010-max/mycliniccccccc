# 🔧 SUPABASE TO'LIQ TUZATISH QO'LLANMASI

## Muammo nima?
Supabase'ga data **kirmiryapti** chunki:
1. **RLS (Row Level Security)** yoqilgan - anon key bilan yozish taqiqlangan  
2. **GRANT** berilmagan - foydalanuvchi ruxsati yo'q  

---

## ✅ TUZATISH (5 DAQIQA)

### 1-qadam: Supabase Dashboard'ga kiring
👉 https://supabase.com/dashboard 

### 2-qadam: Loyihangizni tanlang
- `epmemjirbqamqfvblaie` loyihasini tanlang

### 3-qadam: SQL Editor'ga kiring
- Chap menuda **"SQL Editor"** tugmasini bosing

### 4-qadam: SQL skriptni ishga tushiring
- **"New query"** tugmasini bosing
- `FIX_ALL_SUPABASE_NOW.sql` faylini oching:
  ```
  C:\Users\aveks\Desktop\app shahobidin 4\FIX_ALL_SUPABASE_NOW.sql
  ```
- Faylning **BARCHA** mazmunini kopyalab SQL Editor'ga qo'ying
- **"Run"** tugmasini bosing ✅

### 5-qadam: Natijani tekshiring
SQL muaffaqiyatli ishlasa quyidagi xabarlar chiqadi:
```
✅ Barcha jadvallar yaratildi/yangilandi!
✅ RLS o'chirildi - anon key bilan ishlaydi
✅ GRANT berildi - ma'lumotlar yozish/o'qish mumkin
✅ Seed data qo'shildi
🚀 Dental CRM tayyor!
```

---

## 🧪 TEKSHIRISH

SQL ishlagandan keyin saytni yangilang:
- http://localhost:5175/login
- Klinika ID: `ava-dent`
- Login: `admin`  
- Parol: `ava7`

Yoki yangi klinika ochib ko'ring:
- http://localhost:5175/register

---

## ❓ SQL Editor'ni qanday topaman?

Supabase Dashboard'da:
```
Dashboard > [Loyiha] > SQL Editor (chap menu) > New Query
```

![SQL Editor Location](https://supabase.com/docs/img/guides/database/sql-editor.png)

---

## Agar hali ham ishlamasa

Supabase Dashboard > Settings > API dan **service_role** key'ni oling va menga yuboring.

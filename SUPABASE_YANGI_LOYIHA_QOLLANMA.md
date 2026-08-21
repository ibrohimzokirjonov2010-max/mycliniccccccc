# Yangi Supabase ulash

Hozir loyiha yangi `Supabase` project'ga moslab qo'yildi. `Frontend` va `backend` konfiguratsiya fayllari yangilangan.

## Tayyorlangan fayllar

- `SUPABASE_FULL_SETUP_PRO.sql`
- `.env`
- `backend/.env`

## Nima qilish kerak

1. Supabase dashboard oching.
2. `SQL Editor` ga kiring.
3. `SUPABASE_FULL_SETUP_PRO.sql` faylini to'liq nusxalab ishga tushiring.
4. SQL muvaffaqiyatli tugagach, frontend va backend serverlarni qayta ishga tushiring.

## Ishga tushirish

1. Frontend:
   - `npm run dev`
2. Backend:
   - `npm run start:dev`
   - yoki loyiha ichidagi `Start-All.bat`

## Nima yaratiladi

- klinikalar
- foydalanuvchilar
- bemorlar
- uchrashuvlar
- to'lovlar
- xizmatlar
- service kategoriyalar
- davolash rejalari
- implantlar
- recalls
- qarzlar
- xarajatlar
- ombor
- notes
- xrays
- technicians
- technician jobs
- cases
- case categories
- advertisements
- bot configs
- telegram bookings

## Muhim eslatma

- Hozirgi setup `app compatibility` uchun `RLS`ni o'chirib turadi.
- Agar keyin klinikalar bo'yicha qat'iy xavfsizlik kerak bo'lsa, alohida `rls_setup.sql` ni keyinroq ishlatish mumkin.
- Eski Supabase ichidagi ma'lumotlar avtomatik ko'chmaydi. Agar eski project hali ochilsa, data export/import qilish kerak bo'ladi.

## Tekshirish

SQL tugagandan keyin `Table Editor`da kamida quyidagilar ko'rinishi kerak:

- `clinics`
- `users`
- `patients`
- `appointments`
- `payments`
- `services`
- `treatment_plans`
- `implants`
- `leads`
- `inventory`
- `notes`
- `xrays`
- `botconfigs`
- `telegrambookings`

## Default login

- Klinika ID: `ava-dent`
- Admin: `admin`
- Parol: `ava7`

Yoki:

- Klinika ID: `default_clinic`
- Admin: `admin`
- Parol: `admin`

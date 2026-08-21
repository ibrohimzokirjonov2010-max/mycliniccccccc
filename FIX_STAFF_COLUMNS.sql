-- ============================================
-- FIX STAFF COLUMNS - Xodimlar uchun etishmayotgan ustunlar
-- Ushbu skriptni Supabase SQL Editor ga joylashtiring va ishga tushiring
-- URL: https://supabase.com/dashboard/project/hkkhhnrqzjvhubkqhrhm/sql/new
-- ============================================

-- 1. Xodimlar uchun telefon raqami ustuni
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;

-- 2. Xodimlar uchun mutaxassislik ustuni
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT;

-- 3. Xodimlar uchun komissiya foizi ustuni
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2) DEFAULT 30.0;

-- 4. Xodimlar uchun to'liq ism ustuni (agar patch_fix.sql dan keyin qo'shilmagan bo'lsa)
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 5. Rol check constraint ni yangilash (reception -> receptionist)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check 
  CHECK (role IN ('admin', 'doctor', 'receptionist'));

-- Tekshirish
DO $$
BEGIN
  RAISE NOTICE '✅ Xodimlar uchun barcha ustunlar muvaffaqiyatli qo''shildi!';
  RAISE NOTICE '📊 phone, specialty, commission_rate, full_name ustunlari tayyor.';
END $$;

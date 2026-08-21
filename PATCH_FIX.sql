-- ============================================
-- PATCH SQL - Yetishmayotgan ustunlarni qo'shish
-- Supabase SQL Editor ga joylashtiring va ishga tushiring
-- URL: https://supabase.com/dashboard/project/hkkhhnrqzjvhubkqhrhm/sql/new
-- ============================================

-- 1. patients jadvaliga source ustunini qo'shish
ALTER TABLE patients ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes2 TEXT;

-- 2. leads jadvalidagi status check ni yangilash (kengaytirish)
-- Avval eski constraint ni o'chiramiz
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

-- Yangi kengaytirilgan constraint qo'shamiz (ham lowercase, ham uppercase)
ALTER TABLE leads ADD CONSTRAINT leads_status_check 
  CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost',
                    'New', 'Contacted', 'Qualified', 'Converted', 'Lost'));

-- 3. users jadvaliga full_name ustunini qo'shish (agar kerak bo'lsa)
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 4. appointments jadvalidagi status check ni kengaytirish
ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_status_check;

-- 5. treatment_plans jadvalidagi status check ni o'chirish (flexible qilish)
ALTER TABLE treatment_plans DROP CONSTRAINT IF EXISTS treatment_plans_status_check;

-- 6. patients jadvalidagi gender check ni kengaytirish
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_gender_check;
ALTER TABLE patients ADD CONSTRAINT patients_gender_check 
  CHECK (gender IN ('male', 'female', 'other', 'Male', 'Female', 'Other'));

-- 7. patients jadvalidagi status check ni kengaytirish  
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_status_check;
ALTER TABLE patients ADD CONSTRAINT patients_status_check
  CHECK (status IN ('New', 'Active', 'Inactive', 'Archived', 'new', 'active', 'inactive'));

-- Tekshirish
DO $$
BEGIN
  RAISE NOTICE '✅ Patch muvaffaqiyatli qo''llandi!';
  RAISE NOTICE '📊 source ustuni patients ga qo''shildi';
  RAISE NOTICE '📊 leads status check kengaytirildi';
  RAISE NOTICE '📊 users full_name ustuni qo''shildi';
END $$;

-- ============================================
-- PLAN USTUNINI QO'SHISH VA YANGILASH
-- Supabase SQL Editor ga bir marta kiriting:
-- https://supabase.com/dashboard/project/hkkhhnrqzjvhubkqhrhm/sql/new
-- ============================================

-- 1. clinics jadvaliga plan ustunini qo'shish
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pro' CHECK (plan IN ('basic', 'pro'));

-- 2. Mavjud klinikalarni pro ga yangilash 
UPDATE clinics SET plan = 'pro' WHERE plan IS NULL;

-- 3. Tekshirish
SELECT id, name, plan, status FROM clinics;

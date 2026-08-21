-- ======================================================
-- MUHIM PATCH: "payments" jadvaliga doktor va komissiya ustunlari qo'shish
-- Bu scriptni Supabase > SQL Editor'da ishlatish KERAK
-- ======================================================

ALTER TABLE payments ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_rate NUMERIC;

-- Tekshirish uchun (ixtiyoriy):
-- SELECT id, patient_name, amount, doctor_id, commission_rate FROM payments ORDER BY created_date DESC LIMIT 10;

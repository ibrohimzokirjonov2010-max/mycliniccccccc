-- ============================================================
-- ESLATMA USTUNLARINI QO'SHISH
-- Supabase Dashboard > SQL Editor ga kirip, bu faylni ishlatib yuboring
-- ============================================================

-- appointments jadvaliga eslatma flaglarini qo'shing
ALTER TABLE IF EXISTS appointments
  ADD COLUMN IF NOT EXISTS pre_reminder_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS morning_reminder_sent BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ DEFAULT NULL;

-- patients jadvaliga telegram_chat_id ustunini qo'shish (agar yo'q bo'lsa)
ALTER TABLE IF EXISTS patients
  ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT DEFAULT NULL;

-- Muvaffaqiyatli qo'shildi degan javob
SELECT 
  'appointments' AS table_name,
  COUNT(*) AS total_appointments
FROM appointments
UNION ALL
SELECT 
  'patients_with_telegram' AS table_name,
  COUNT(*) AS count
FROM patients
WHERE telegram_chat_id IS NOT NULL;

-- Eslatma status turlarini GRANT qilish
GRANT SELECT, INSERT, UPDATE, DELETE ON appointments TO anon;
GRANT SELECT, UPDATE ON patients TO anon;

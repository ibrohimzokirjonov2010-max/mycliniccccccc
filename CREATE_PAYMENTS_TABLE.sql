-- ============================================================
-- PAYMENTS JADVALI YARATISH + DOKTOR KUZATUVI
-- Supabase SQL Editor'da ishlatish uchun
-- ============================================================

-- 1. Payments jadvali (agar mavjud bo'lmasa yaratish)
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT 'pay-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT,
  patient_name TEXT,
  doctor_id TEXT,
  commission_rate NUMERIC,
  type TEXT DEFAULT 'Income',
  amount NUMERIC DEFAULT 0,
  method TEXT DEFAULT 'Cash',
  category TEXT,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Agar jadval bor bo'lsa, faqat etishmayotgan ustunlarni qo'shish
ALTER TABLE payments ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_rate NUMERIC;

-- 3. RLS sozlash
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for payments" ON payments;
CREATE POLICY "Allow all for payments" ON payments FOR ALL USING (true) WITH CHECK (true);

-- 4. Tekshirish
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' AND table_schema = 'public'
ORDER BY column_name;

DO $$
BEGIN
  RAISE NOTICE '✅ Payments jadvali va doktor ustunlari tayyor!';
END $$;

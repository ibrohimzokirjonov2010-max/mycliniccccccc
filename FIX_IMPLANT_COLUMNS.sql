-- ============================================
-- IMPLANT JADVALIGA YETISHMAYOTGAN USTUNLARNI QOSHISH
-- va tooth_data JSONB backup ustunini qoshish
-- Supabase SQL Editor ga nusxalab ishga tushiring:
-- https://supabase.com/dashboard/project/hkkhhnrqzjvhubkqhrhm/sql/new
-- ============================================

-- 1. Asosiy yetishmayotgan ustunlar (agar yo'q bo'lsa qo'shadi)
ALTER TABLE implants ADD COLUMN IF NOT EXISTS diameter TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS length TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS brend TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS torque TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS isq TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS bone_type TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS implant_type TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS firma TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS firma_custom TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS tooth_id TEXT;

-- 2. JSONB backup ustun - barcha tish ma'lumotlarini backup sifatida saqlaydi
ALTER TABLE implants ADD COLUMN IF NOT EXISTS tooth_data JSONB DEFAULT '{}'::jsonb;

-- 3. Extra services, xrays, timeline, audit uchun (agar yo'q bo'lsa)
ALTER TABLE implants ADD COLUMN IF NOT EXISTS extra_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS xray_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS complications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS tooth_numbers JSONB DEFAULT '[]'::jsonb;

-- 4. Asosiy maydonlar
ALTER TABLE implants ADD COLUMN IF NOT EXISTS doctor TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'Rejalashtirilgan';
ALTER TABLE implants ADD COLUMN IF NOT EXISTS reminder_months TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS reminder_date DATE;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS placement_date DATE;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS passport_url TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS patient_phone TEXT;

-- 5. Index qoshish
CREATE INDEX IF NOT EXISTS idx_implants_tooth_id ON implants(tooth_id);
CREATE INDEX IF NOT EXISTS idx_implants_placement_date ON implants(placement_date);

-- Tekshirish uchun
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'implants' 
ORDER BY column_name;

DO $$
BEGIN
  RAISE NOTICE '✅ Implant jadvali muvaffaqiyatli yangilandi!';
END $$;

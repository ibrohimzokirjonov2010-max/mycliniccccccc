-- ============================================
-- SQL SCRIPT: Technician va Technician Jobs jadvallarini yaratish
-- Supabase SQL Editor ga joylashtiring va "RUN" tugmasini bosing
-- URL: https://supabase.com/dashboard/project/hkkhhnrqzjvhubkqhrhm/sql/new
-- ============================================

-- 1. Texniklar (Laboratoriyalar) jadvali
CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    specialization TEXT,
    is_active BOOLEAN DEFAULT true,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. Laboratoriya Ishlari (Technician Jobs) jadvali
CREATE TABLE IF NOT EXISTS technician_jobs (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    patient_id TEXT,
    patient_name TEXT,
    doctor_id TEXT,
    doctor_name TEXT,
    technician_id TEXT,
    technician_name TEXT,
    tooth_number TEXT,
    work_type TEXT,
    construction_type TEXT,
    shade TEXT,
    status TEXT DEFAULT 'Sent',
    deadline TIMESTAMP WITH TIME ZONE,
    impression_date TIMESTAMP WITH TIME ZONE,
    cost NUMERIC DEFAULT 0,
    notes TEXT,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_date TIMESTAMP WITH TIME ZONE
);

-- RLS siyosati (Hamma uchun ochiq, sababi xavfsizlik frontendda tekshiriladi)
ALTER TABLE technicians ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for technicians" ON technicians FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE technician_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for technician_jobs" ON technician_jobs FOR ALL USING (true) WITH CHECK (true);

-- Tekshirish xabari
DO $$
BEGIN
  RAISE NOTICE '✅ Laboratoriya modullari uchun bazalar yaratildi!';
END $$;

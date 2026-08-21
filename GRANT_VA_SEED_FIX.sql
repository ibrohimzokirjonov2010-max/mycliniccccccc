-- ============================================================
-- FAQAT GRANT VA RLS TUZATISH
-- Bu skriptni Supabase SQL Editor'da ishga tushiring
-- ============================================================

-- 1. Barcha jadvallar uchun anon va authenticated rollarga to'liq ruxsat
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'clinics', 'users', 'patients', 'appointments', 'payments',
    'services', 'service_categories', 'treatment_plans', 'tooth_records',
    'implants', 'leads', 'recalls', 'debts', 'expenses', 'inventory',
    'notes', 'xrays', 'technicians', 'technician_jobs', 'cases',
    'case_categories', 'advertisements', 'botconfigs', 'telegrambookings',
    'scheduled_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- RLS o'chirish
    EXECUTE format('ALTER TABLE IF EXISTS public.%I DISABLE ROW LEVEL SECURITY', t);
    -- Grant berish
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO anon', t);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL PRIVILEGES ON TABLE public.%I TO service_role', t);
    RAISE NOTICE '✅ % - RLS disabled, GRANT done', t;
  END LOOP;
END $$;

-- 2. Sequences va schema ga ham ruxsat
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 3. Default privileges (keyinchalik yaratilgan jadvallar uchun)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

-- 4. Agar clinics bo'sh bo'lsa, seed data kiritamiz
INSERT INTO public.clinics (id, name, password, expires_at, status, monthly_fee, last_payment_date, plan)
SELECT 'ava-dent', 'Ava Dent Clinic', 'ava7', '2026-12-31', 'Active', 500000, '2025-10-01', 'pro'
WHERE NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = 'ava-dent');

INSERT INTO public.clinics (id, name, password, expires_at, status, monthly_fee, last_payment_date, plan)
SELECT 'default_clinic', 'Demo Clinic', 'admin', '2030-01-01', 'Active', 0, CURRENT_DATE, 'pro'
WHERE NOT EXISTS (SELECT 1 FROM public.clinics WHERE id = 'default_clinic');

-- 5. Users seed data
INSERT INTO public.users (id, clinic_id, username, password, name, full_name, role, commission_rate)
SELECT 'user-1', 'ava-dent', 'admin', 'ava7', 'Administrator', 'Administrator', 'admin', 0
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = 'user-1');

INSERT INTO public.users (id, clinic_id, username, password, name, full_name, role, commission_rate)
SELECT 'user-2', 'ava-dent', 'doctor', 'doctor123', 'Shifokor', 'Shifokor', 'doctor', 30
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = 'user-2');

INSERT INTO public.users (id, clinic_id, username, password, name, full_name, role, commission_rate)
SELECT 'user-3', 'default_clinic', 'admin', 'admin', 'Demo Admin', 'Demo Admin', 'admin', 0
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = 'user-3');

INSERT INTO public.users (id, clinic_id, username, password, name, full_name, role, commission_rate)
SELECT 'user-4', 'default_clinic', 'demo', 'demo', 'Demo User', 'Demo User', 'doctor', 30
WHERE NOT EXISTS (SELECT 1 FROM public.users WHERE id = 'user-4');

-- 6. Tekshirish
SELECT 'clinics_count' as table_name, COUNT(*) as row_count FROM public.clinics
UNION ALL
SELECT 'users_count', COUNT(*) FROM public.users;

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '🎉 GRANT va SEED DATA tayyor!';
  RAISE NOTICE '✅ Endi anon key bilan yozish ishlaydi';
END $$;

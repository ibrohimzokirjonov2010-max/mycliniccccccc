-- ============================================================
-- 🔓 DENTAL CRM - BARCHA JADVALLARDAGI RLS TO'LIQ O'CHIRISH
-- Supabase Dashboard > SQL Editor ga kirip, bu faylni to'liq
-- copy-paste qiling va "Run" tugmasini bosing.
-- ============================================================

-- 1. Barcha jadvallarda Row Level Security (RLS) ni o'chirish
ALTER TABLE IF EXISTS public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.clinics DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.recalls DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.implants DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.technicians DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.technician_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.treatment_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.xrays DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.tooth_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.advertisements DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.botconfigs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.case_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_notifications DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.service_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.telegrambookings DISABLE ROW LEVEL SECURITY;

-- 2. Barcha jadvallarga 'anon' va 'authenticated' rollar uchun to'liq huquqlarni berish
GRANT ALL ON TABLE public.patients TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.appointments TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.users TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.clinics TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.payments TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.recalls TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.leads TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.implants TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.technicians TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.technician_jobs TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.inventory TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.expenses TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.treatment_plans TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.notes TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.xrays TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.tooth_records TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.advertisements TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.botconfigs TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.case_categories TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.cases TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.scheduled_notifications TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.service_categories TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.services TO anon, authenticated, postgres, service_role;
GRANT ALL ON TABLE public.telegrambookings TO anon, authenticated, postgres, service_role;

-- 3. Natijani tekshirish
SELECT 
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'r'
  AND c.relname IN (
    'patients', 'appointments', 'users', 'clinics', 'payments', 
    'recalls', 'leads', 'implants', 'technicians', 'technician_jobs', 
    'inventory', 'expenses', 'treatment_plans', 'notes', 'xrays', 
    'tooth_records', 'services', 'botconfigs'
  )
ORDER BY c.relname;

-- ============================================================
-- 🔧 DENTAL CRM - TO'LIQ SUPABASE TUZATISH
-- Supabase Dashboard > SQL Editor ga kirip, bu faylni to'liq
-- copy-paste qiling va "Run" tugmasini bosing.
-- Bir marta ishga tushirish yetarli!
-- ============================================================

-- 1. UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 2. CLINICS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT,
  logo TEXT,
  expires_at DATE,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  monthly_fee INTEGER DEFAULT 0,
  last_payment_date DATE,
  plan TEXT DEFAULT 'pro'
);

ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pro';
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS logo TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS expires_at DATE;

-- ============================================================
-- 3. USERS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT 'user-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  username TEXT NOT NULL,
  password TEXT,
  name TEXT,
  full_name TEXT,
  phone TEXT,
  specialty TEXT,
  role TEXT DEFAULT 'doctor',
  commission_rate NUMERIC(5,2) DEFAULT 30.00,
  base_salary NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- Agar UNIQUE constraint yo'q bo'lsa qo'shamiz
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'users_clinic_id_username_key'
  ) THEN
    ALTER TABLE public.users ADD CONSTRAINT users_clinic_id_username_key UNIQUE (clinic_id, username);
  END IF;
END $$;

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 30.00;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'doctor';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password TEXT;

-- ============================================================
-- 4. PATIENTS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id TEXT PRIMARY KEY DEFAULT 'patient-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  gender TEXT,
  address TEXT,
  city TEXT,
  region TEXT,
  status TEXT DEFAULT 'Active',
  source TEXT,
  notes TEXT,
  notes2 TEXT,
  photo_url TEXT,
  last_visit DATE,
  total_paid NUMERIC(14,2) DEFAULT 0,
  total_debt NUMERIC(14,2) DEFAULT 0,
  telegram_chat_id TEXT,
  telegram_username TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS notes2 TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS total_paid NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS total_debt NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS last_visit DATE;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE public.patients ADD COLUMN IF NOT EXISTS telegram_username TEXT;

-- ============================================================
-- 5. APPOINTMENTS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id TEXT PRIMARY KEY DEFAULT 'appt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  patient_phone TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  service_id TEXT,
  service TEXT,
  service_name TEXT,
  price NUMERIC(14,2) DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  time TEXT,
  duration INTEGER DEFAULT 30,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'Scheduled',
  notes TEXT,
  confirmation_status TEXT,
  confirmation_sent_at TIMESTAMPTZ,
  confirmation_requested_at TIMESTAMPTZ,
  confirmation_response_at TIMESTAMPTZ,
  confirmation_response_channel TEXT,
  confirmation_follow_up_choice TEXT,
  confirmation_message_id TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_status TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_requested_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_response_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_response_channel TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_follow_up_choice TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS confirmation_message_id TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS duration_minutes INTEGER DEFAULT 30;

-- ============================================================
-- 6. PAYMENTS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY DEFAULT 'pay-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  doctor_id TEXT,
  doctor_name TEXT,
  service TEXT,
  service_name TEXT,
  amount NUMERIC(14,2) DEFAULT 0,
  discount NUMERIC(14,2) DEFAULT 0,
  total_price NUMERIC(14,2) DEFAULT 0,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  debt_amount NUMERIC(14,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  category TEXT,
  commission_rate NUMERIC(5,2) DEFAULT 0,
  doctor_commission NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'paid',
  date TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  form_data TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS doctor_name TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS doctor_commission NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS form_data TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS total_price NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS debt_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS discount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS service_name TEXT;

-- ============================================================
-- 7. SERVICES JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY DEFAULT 'svc-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  price NUMERIC(14,2) DEFAULT 0,
  duration INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS duration INTEGER DEFAULT 30;

-- ============================================================
-- 8. SERVICE_CATEGORIES JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_categories (
  id TEXT PRIMARY KEY DEFAULT 'scat-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, name)
);

-- ============================================================
-- 9. TREATMENT_PLANS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id TEXT PRIMARY KEY DEFAULT 'tp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  name TEXT,
  status TEXT DEFAULT 'Planned',
  priority TEXT DEFAULT 'Normal',
  tooth_number TEXT,
  services TEXT,
  total_price NUMERIC(14,2) DEFAULT 0,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  start_date DATE,
  notes TEXT,
  installment_plan TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS installment_plan TEXT;

-- ============================================================
-- 10. TOOTH_RECORDS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tooth_records (
  id TEXT PRIMARY KEY DEFAULT 'tr-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  tooth_number TEXT,
  status TEXT,
  treatment TEXT,
  color TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. IMPLANTS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.implants (
  id TEXT PRIMARY KEY DEFAULT 'imp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  doctor TEXT,
  doctor_id TEXT,
  tooth_number TEXT,
  tooth_numbers TEXT,
  placement_date DATE,
  status TEXT DEFAULT 'placed',
  lifecycle_status TEXT,
  tooth_id TEXT,
  tooth_data JSONB,
  firma TEXT,
  firma_custom TEXT,
  brend TEXT,
  diameter TEXT,
  length TEXT,
  lot_number TEXT,
  torque TEXT,
  isq TEXT,
  bone_type TEXT,
  implant_type TEXT,
  extra_services TEXT,
  timeline TEXT,
  audit_log TEXT,
  complications TEXT,
  xray_urls TEXT,
  reminder_months INTEGER,
  reminder_date DATE,
  total_price NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS tooth_numbers TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS tooth_id TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS tooth_data JSONB;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS firma TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS firma_custom TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS brend TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS diameter TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS length TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS torque TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS isq TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS bone_type TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS implant_type TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS extra_services TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS timeline TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS audit_log TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS complications TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS xray_urls TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS reminder_months INTEGER;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS reminder_date DATE;

-- ============================================================
-- 12. LEADS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY DEFAULT 'lead-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  name TEXT,
  phone TEXT,
  email TEXT,
  source TEXT,
  status TEXT DEFAULT 'new',
  assigned_to TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS email TEXT;

-- ============================================================
-- 13. RECALLS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recalls (
  id TEXT PRIMARY KEY DEFAULT 'recall-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  patient_phone TEXT,
  type TEXT,
  type_label TEXT,
  status TEXT DEFAULT 'pending',
  recall_date DATE,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.recalls ADD COLUMN IF NOT EXISTS type_label TEXT;
ALTER TABLE public.recalls ADD COLUMN IF NOT EXISTS patient_phone TEXT;

-- ============================================================
-- 14. DEBTS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.debts (
  id TEXT PRIMARY KEY DEFAULT 'debt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  amount NUMERIC(14,2) DEFAULT 0,
  remaining_amount NUMERIC(14,2) DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'active',
  payment_id TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS remaining_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS payment_id TEXT;

-- ============================================================
-- 15. EXPENSES JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT 'exp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  category TEXT,
  description TEXT,
  amount NUMERIC(14,2) DEFAULT 0,
  date DATE DEFAULT CURRENT_DATE,
  staff_id TEXT,
  staff_name TEXT,
  type TEXT DEFAULT 'expense',
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS staff_id TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';

-- ============================================================
-- 16. INVENTORY JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id TEXT PRIMARY KEY DEFAULT 'inv-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  quantity NUMERIC(12,2) DEFAULT 0,
  unit TEXT,
  min_quantity NUMERIC(12,2) DEFAULT 0,
  price NUMERIC(14,2) DEFAULT 0,
  supplier TEXT,
  location TEXT,
  expiry_date DATE,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS min_quantity NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS expiry_date DATE;
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS location TEXT;

-- ============================================================
-- 17. NOTES JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY DEFAULT 'note-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  entity_type TEXT,
  title TEXT,
  content TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS entity_type TEXT;

-- ============================================================
-- 18. XRAYS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.xrays (
  id TEXT PRIMARY KEY DEFAULT 'xray-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  tooth_number TEXT,
  image_url TEXT,
  notes TEXT,
  date DATE DEFAULT CURRENT_DATE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 19. TECHNICIANS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.technicians (
  id TEXT PRIMARY KEY DEFAULT 'tech-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  specialization TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 20. TECHNICIAN_JOBS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.technician_jobs (
  id TEXT PRIMARY KEY DEFAULT 'tj-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_name TEXT,
  patient_id TEXT,
  doctor_name TEXT,
  doctor_id TEXT,
  technician_name TEXT,
  technician_id TEXT,
  tooth_number TEXT,
  work_type TEXT,
  construction_type TEXT,
  shade TEXT,
  status TEXT DEFAULT 'pending',
  deadline DATE,
  impression_date DATE,
  cost NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 21. CASES JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cases (
  id TEXT PRIMARY KEY DEFAULT 'case-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patientname TEXT,
  doctor TEXT,
  date DATE DEFAULT CURRENT_DATE,
  tags TEXT,
  images TEXT,
  description TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS patientname TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE public.cases ADD COLUMN IF NOT EXISTS images TEXT;

-- ============================================================
-- 22. CASE_CATEGORIES JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.case_categories (
  id TEXT PRIMARY KEY DEFAULT 'ccat-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  name TEXT NOT NULL,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 23. ADVERTISEMENTS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advertisements (
  id TEXT PRIMARY KEY DEFAULT 'ad-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  title TEXT,
  platform TEXT,
  budget NUMERIC(14,2) DEFAULT 0,
  spent NUMERIC(14,2) DEFAULT 0,
  leads_count INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 24. BOTCONFIGS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.botconfigs (
  id TEXT PRIMARY KEY DEFAULT 'bc-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT,
  botToken TEXT,
  botUsername TEXT,
  isActive BOOLEAN DEFAULT FALSE,
  welcomeMessage TEXT,
  availableServices TEXT,
  workingHours TEXT,
  bookingAdvanceDays INTEGER DEFAULT 7,
  slotDuration INTEGER DEFAULT 30,
  requirePhone BOOLEAN DEFAULT TRUE,
  allowSameDay BOOLEAN DEFAULT FALSE,
  leadChatId TEXT,
  lead_chat_id TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.botconfigs ADD COLUMN IF NOT EXISTS lead_chat_id TEXT;
ALTER TABLE public.botconfigs ADD COLUMN IF NOT EXISTS leadChatId TEXT;

-- ============================================================
-- 25. TELEGRAMBOOKINGS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telegrambookings (
  id TEXT PRIMARY KEY DEFAULT 'tgb-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT,
  patient_id TEXT,
  patient_name TEXT,
  phone TEXT,
  service_name TEXT,
  preferred_date DATE,
  preferred_date_text TEXT,
  preferred_time TEXT,
  status TEXT DEFAULT 'pending',
  chat_id TEXT,
  telegram_username TEXT,
  notes TEXT,
  confirmedAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.telegrambookings ADD COLUMN IF NOT EXISTS preferred_date_text TEXT;

-- ============================================================
-- 26. SCHEDULED_NOTIFICATIONS JADVALI
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scheduled_notifications (
  id TEXT PRIMARY KEY DEFAULT 'sn-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL,
  patient_id TEXT,
  patient_name TEXT,
  message TEXT,
  scheduled_at TIMESTAMPTZ,
  channel TEXT DEFAULT 'telegram',
  status TEXT DEFAULT 'pending',
  type TEXT,
  appointment_id TEXT,
  chat_id TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_clinics_status ON public.clinics(status);
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON public.users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON public.patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_payments_clinic_id ON public.payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);
CREATE INDEX IF NOT EXISTS idx_leads_clinic_id ON public.leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_recalls_clinic_id ON public.recalls(clinic_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
DO $$ BEGIN CREATE TRIGGER update_users_updated_date BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_patients_updated_date BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_appointments_updated_date BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_payments_updated_date BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_treatment_plans_updated_date BEFORE UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_implants_updated_date BEFORE UPDATE ON public.implants FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_leads_updated_date BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_recalls_updated_date BEFORE UPDATE ON public.recalls FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_inventory_updated_date BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_debts_updated_date BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_expenses_updated_date BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_cases_updated_date BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_notes_updated_date BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_technicians_updated_date BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_technician_jobs_updated_date BEFORE UPDATE ON public.technician_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_advertisements_updated_date BEFORE UPDATE ON public.advertisements FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_botconfigs_updated_date BEFORE UPDATE ON public.botconfigs FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TRIGGER update_telegrambookings_updated_date BEFORE UPDATE ON public.telegrambookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column(); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 🔓 RLS O'CHIRISH (ANON KEY BILAN ISHLASH UCHUN)
-- ============================================================
ALTER TABLE public.clinics DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.services DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.treatment_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tooth_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.implants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.recalls DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.xrays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.technicians DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.technician_jobs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.advertisements DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.botconfigs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegrambookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_notifications DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- GRANT PERMISSIONS TO ANON AND AUTHENTICATED
-- ============================================================
GRANT ALL ON public.clinics TO anon, authenticated;
GRANT ALL ON public.users TO anon, authenticated;
GRANT ALL ON public.patients TO anon, authenticated;
GRANT ALL ON public.appointments TO anon, authenticated;
GRANT ALL ON public.payments TO anon, authenticated;
GRANT ALL ON public.services TO anon, authenticated;
GRANT ALL ON public.service_categories TO anon, authenticated;
GRANT ALL ON public.treatment_plans TO anon, authenticated;
GRANT ALL ON public.tooth_records TO anon, authenticated;
GRANT ALL ON public.implants TO anon, authenticated;
GRANT ALL ON public.leads TO anon, authenticated;
GRANT ALL ON public.recalls TO anon, authenticated;
GRANT ALL ON public.debts TO anon, authenticated;
GRANT ALL ON public.expenses TO anon, authenticated;
GRANT ALL ON public.inventory TO anon, authenticated;
GRANT ALL ON public.notes TO anon, authenticated;
GRANT ALL ON public.xrays TO anon, authenticated;
GRANT ALL ON public.technicians TO anon, authenticated;
GRANT ALL ON public.technician_jobs TO anon, authenticated;
GRANT ALL ON public.cases TO anon, authenticated;
GRANT ALL ON public.case_categories TO anon, authenticated;
GRANT ALL ON public.advertisements TO anon, authenticated;
GRANT ALL ON public.botconfigs TO anon, authenticated;
GRANT ALL ON public.telegrambookings TO anon, authenticated;
GRANT ALL ON public.scheduled_notifications TO anon, authenticated;

-- ============================================================
-- DEFAULT SEED DATA (klinikalar va foydalanuvchilar)
-- ============================================================
INSERT INTO public.clinics (id, name, password, expires_at, status, monthly_fee, last_payment_date, plan)
VALUES
  ('ava-dent', 'Ava Dent Clinic', 'ava7', '2026-12-31', 'Active', 500000, '2025-10-01', 'pro'),
  ('default_clinic', 'Demo Clinic', 'admin', '2030-01-01', 'Active', 0, CURRENT_DATE, 'pro')
ON CONFLICT (id) DO UPDATE
SET plan = 'pro', status = 'Active';

INSERT INTO public.users (id, clinic_id, username, password, name, full_name, role, commission_rate)
VALUES
  ('user-1', 'ava-dent', 'admin', 'ava7', 'Administrator', 'Administrator', 'admin', 0),
  ('user-2', 'ava-dent', 'doctor', 'doctor123', 'Shifokor', 'Shifokor', 'doctor', 30),
  ('user-3', 'default_clinic', 'admin', 'admin', 'Demo Admin', 'Demo Admin', 'admin', 0),
  ('user-4', 'default_clinic', 'demo', 'demo', 'Demo User', 'Demo User', 'doctor', 30)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.service_categories (clinic_id, name, sort_order)
VALUES
  ('ava-dent', 'TERAPIYA( ENDO +PLOMBA)', 1),
  ('ava-dent', 'ORTOPEDIYA', 2),
  ('ava-dent', 'XIRURGIYA', 3),
  ('ava-dent', 'ORTODONTIYA', 4),
  ('default_clinic', 'TERAPIYA( ENDO +PLOMBA)', 1),
  ('default_clinic', 'ORTOPEDIYA', 2),
  ('default_clinic', 'XIRURGIYA', 3),
  ('default_clinic', 'ORTODONTIYA', 4)
ON CONFLICT (clinic_id, name) DO NOTHING;

-- PostgREST schema reload
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Barcha jadvallar yaratildi/yangilandi!';
  RAISE NOTICE '✅ RLS o''chirildi - anon key bilan ishlaydi';
  RAISE NOTICE '✅ GRANT berildi - ma''lumotlar yozish/o''qish mumkin';
  RAISE NOTICE '✅ Seed data qo''shildi';
  RAISE NOTICE '🚀 Dental CRM tayyor!';
END $$;

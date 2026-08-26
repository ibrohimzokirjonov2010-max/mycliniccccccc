-- ============================================================
-- DENTAL CRM - FULL SUPABASE SETUP (PRO)
-- Project URL: https://zvyggjldzkxwufpnaatr.supabase.co
-- Ushbu faylni Supabase SQL Editor ichida bir marta ishga tushiring
-- Maqsad: yangi project'da eski app to'liq va barqaror ishlashi
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_date = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 1. CLINICS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  logo TEXT,
  expires_at DATE,
  status TEXT DEFAULT 'Active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  monthly_fee INTEGER DEFAULT 0,
  last_payment_date DATE,
  plan TEXT DEFAULT 'pro'
);

ALTER TABLE public.clinics ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pro';
CREATE INDEX IF NOT EXISTS idx_clinics_status ON public.clinics(status);

-- ============================================================
-- 2. USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY DEFAULT 'user-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  specialty TEXT,
  role TEXT DEFAULT 'doctor',
  commission_rate NUMERIC(5,2) DEFAULT 30.00,
  base_salary NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, username)
);

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 30.00;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2) DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON public.users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);

-- ============================================================
-- 3. PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id TEXT PRIMARY KEY DEFAULT 'patient-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
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
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON public.patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON public.patients(full_name);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON public.patients(phone);

-- ============================================================
-- 4. APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id TEXT PRIMARY KEY DEFAULT 'appt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  patient_phone TEXT,
  doctor_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
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

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON public.appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON public.appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON public.appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON public.appointments(status);

-- ============================================================
-- 5. PAYMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id TEXT PRIMARY KEY DEFAULT 'pay-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  doctor_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  commission_rate NUMERIC(5,2),
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  date TIMESTAMPTZ DEFAULT NOW(),
  payment_method TEXT,
  method TEXT,
  type TEXT,
  category TEXT,
  description TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_clinic_id ON public.payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON public.payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments(date);

-- ============================================================
-- 6. SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.services (
  id TEXT PRIMARY KEY DEFAULT 'svc-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  price NUMERIC(14,2) DEFAULT 0,
  duration INTEGER DEFAULT 30,
  duration_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT TRUE,
  requires_tooth BOOLEAN DEFAULT FALSE,
  tooth_numbers JSONB DEFAULT '[]'::jsonb,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON public.services(clinic_id);
CREATE INDEX IF NOT EXISTS idx_services_name ON public.services(name);

-- ============================================================
-- 7. SERVICE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.service_categories (
  id TEXT PRIMARY KEY DEFAULT 'svc-cat-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, name)
);

CREATE INDEX IF NOT EXISTS idx_service_categories_clinic_id ON public.service_categories(clinic_id);

-- ============================================================
-- 8. TREATMENT PLANS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.treatment_plans (
  id TEXT PRIMARY KEY DEFAULT 'tp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  title TEXT,
  name TEXT,
  description TEXT,
  status TEXT DEFAULT 'Planned',
  priority TEXT DEFAULT 'Medium',
  tooth_number TEXT,
  services JSONB DEFAULT '[]'::jsonb,
  total_cost NUMERIC(14,2) DEFAULT 0,
  total_price NUMERIC(14,2) DEFAULT 0,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  discount_amount NUMERIC(14,2) DEFAULT 0,
  installment_plan JSONB,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(14,2) DEFAULT 0;
ALTER TABLE public.treatment_plans ADD COLUMN IF NOT EXISTS installment_plan JSONB;
CREATE INDEX IF NOT EXISTS idx_treatment_plans_clinic_id ON public.treatment_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id ON public.treatment_plans(patient_id);

-- ============================================================
-- 9. TOOTH RECORDS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tooth_records (
  id TEXT PRIMARY KEY DEFAULT 'tooth-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,
  condition TEXT,
  treatment TEXT,
  notes TEXT,
  image_url TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tooth_records_patient_id ON public.tooth_records(patient_id);

-- ============================================================
-- 10. IMPLANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.implants (
  id TEXT PRIMARY KEY DEFAULT 'implant-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  patient_phone TEXT,
  tooth_number TEXT,
  tooth_id TEXT,
  tooth_numbers JSONB DEFAULT '[]'::jsonb,
  implant_type TEXT,
  brand TEXT,
  brend TEXT,
  model TEXT,
  size TEXT,
  diameter TEXT,
  length TEXT,
  firma TEXT,
  firma_custom TEXT,
  lot_number TEXT,
  torque TEXT,
  isq TEXT,
  bone_type TEXT,
  doctor TEXT,
  lifecycle_status TEXT DEFAULT 'Rejalashtirilgan',
  reminder_months INTEGER,
  reminder_date DATE,
  placement_date DATE,
  placed_date DATE,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  radiograph_url TEXT,
  passport_url TEXT,
  cost NUMERIC(14,2) DEFAULT 0,
  tooth_data JSONB DEFAULT '{}'::jsonb,
  extra_services JSONB DEFAULT '[]'::jsonb,
  xray_urls JSONB DEFAULT '[]'::jsonb,
  timeline JSONB DEFAULT '[]'::jsonb,
  complications JSONB DEFAULT '[]'::jsonb,
  audit_log JSONB DEFAULT '[]'::jsonb,
  step INTEGER DEFAULT 1,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS tooth_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS extra_services JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS xray_urls JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS timeline JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS complications JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS audit_log JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS tooth_numbers JSONB DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_implants_clinic_id ON public.implants(clinic_id);
CREATE INDEX IF NOT EXISTS idx_implants_patient_id ON public.implants(patient_id);
CREATE INDEX IF NOT EXISTS idx_implants_tooth_id ON public.implants(tooth_id);

-- ============================================================
-- 11. LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.leads (
  id TEXT PRIMARY KEY DEFAULT 'lead-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  status TEXT DEFAULT 'new',
  notes TEXT,
  form_data JSONB DEFAULT '{}'::jsonb,
  visit_date DATE,
  assigned_to TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS form_data JSONB DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_leads_clinic_id ON public.leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- ============================================================
-- 12. RECALLS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recalls (
  id TEXT PRIMARY KEY DEFAULT 'recall-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  patient_phone TEXT,
  type TEXT,
  type_label TEXT,
  status TEXT DEFAULT 'pending',
  recall_date DATE NOT NULL,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recalls_clinic_id ON public.recalls(clinic_id);
CREATE INDEX IF NOT EXISTS idx_recalls_patient_id ON public.recalls(patient_id);
CREATE INDEX IF NOT EXISTS idx_recalls_date ON public.recalls(recall_date);

-- ============================================================
-- 13. DEBTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.debts (
  id TEXT PRIMARY KEY DEFAULT 'debt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debts_clinic_id ON public.debts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_debts_patient_id ON public.debts(patient_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON public.debts(status);

-- ============================================================
-- 14. EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY DEFAULT 'exp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  receipt_url TEXT,
  paid_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_clinic_id ON public.expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);

-- ============================================================
-- 15. INVENTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory (
  id TEXT PRIMARY KEY DEFAULT 'inv-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 0,
  unit TEXT,
  min_quantity INTEGER DEFAULT 0,
  price NUMERIC(14,2) DEFAULT 0,
  supplier TEXT,
  location TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_clinic_id ON public.inventory(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON public.inventory(name);

-- ============================================================
-- 16. NOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notes (
  id TEXT PRIMARY KEY DEFAULT 'note-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  appointment_id TEXT,
  type TEXT,
  priority TEXT DEFAULT 'Normal',
  is_pinned BOOLEAN DEFAULT FALSE,
  is_confidential BOOLEAN DEFAULT FALSE,
  content TEXT,
  notes TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  related_tooth_numbers JSONB DEFAULT '[]'::jsonb,
  attachments JSONB DEFAULT '[]'::jsonb,
  reminder_date DATE,
  created_by TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_patient_id ON public.notes(patient_id);

-- ============================================================
-- 17. XRAYS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.xrays (
  id TEXT PRIMARY KEY DEFAULT 'xray-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  download_url TEXT,
  file_name TEXT,
  file_size BIGINT,
  file_format TEXT,
  xray_type TEXT,
  description TEXT,
  findings TEXT,
  diagnosis TEXT,
  tooth_number TEXT,
  tooth_numbers JSONB DEFAULT '[]'::jsonb,
  date DATE,
  time TEXT,
  taken_date DATE,
  ordered_by TEXT,
  taken_by TEXT,
  interpreted_by TEXT,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xrays_patient_id ON public.xrays(patient_id);

-- ============================================================
-- 18. TECHNICIANS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.technicians (
  id TEXT PRIMARY KEY DEFAULT 'tech-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  specialization TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technicians_clinic_id ON public.technicians(clinic_id);

-- ============================================================
-- 19. TECHNICIAN JOBS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.technician_jobs (
  id TEXT PRIMARY KEY DEFAULT 'techjob-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  doctor_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
  doctor_name TEXT,
  technician_id TEXT REFERENCES public.technicians(id) ON DELETE SET NULL,
  technician_name TEXT,
  tooth_number TEXT,
  work_type TEXT,
  construction_type TEXT,
  shade TEXT,
  status TEXT DEFAULT 'Sent',
  deadline TIMESTAMPTZ,
  impression_date TIMESTAMPTZ,
  cost NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_technician_jobs_clinic_id ON public.technician_jobs(clinic_id);

-- ============================================================
-- 20. CASES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cases (
  id TEXT PRIMARY KEY DEFAULT 'case-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  doctor TEXT,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  patientname TEXT,
  patient_name TEXT,
  date DATE,
  tags JSONB DEFAULT '[]'::jsonb,
  images JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cases_clinic_id ON public.cases(clinic_id);

-- ============================================================
-- 21. CASE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.case_categories (
  id TEXT PRIMARY KEY DEFAULT 'case-cat-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(clinic_id, name)
);

CREATE INDEX IF NOT EXISTS idx_case_categories_clinic_id ON public.case_categories(clinic_id);

-- ============================================================
-- 22. ADVERTISEMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.advertisements (
  id TEXT PRIMARY KEY DEFAULT 'ad-' || uuid_generate_v4()::TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  cta_text TEXT DEFAULT 'Batafsil',
  start_time TEXT DEFAULT '08:00',
  end_time TEXT DEFAULT '22:00',
  enabled BOOLEAN DEFAULT TRUE,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ads_enabled ON public.advertisements(enabled);

-- ============================================================
-- 23. BOT CONFIGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.botconfigs (
  id TEXT PRIMARY KEY DEFAULT 'botcfg-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT REFERENCES public.clinics(id) ON DELETE CASCADE,
  botToken TEXT,
  botUsername TEXT,
  isActive BOOLEAN DEFAULT FALSE,
  welcomeMessage TEXT,
  availableServices JSONB DEFAULT '[]'::jsonb,
  workingHours JSONB DEFAULT '{}'::jsonb,
  bookingAdvanceDays INTEGER DEFAULT 14,
  slotDuration INTEGER DEFAULT 30,
  requirePhone BOOLEAN DEFAULT TRUE,
  allowSameDay BOOLEAN DEFAULT FALSE,
  leadChatId TEXT,
  lead_chat_id TEXT,
  commands JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_botconfigs_clinic_id ON public.botconfigs(clinic_id);

-- ============================================================
-- 24. TELEGRAM BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.telegrambookings (
  id TEXT PRIMARY KEY DEFAULT 'tgb-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT REFERENCES public.clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES public.patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  phone TEXT,
  service_name TEXT,
  preferred_date DATE,
  preferred_time TEXT,
  status TEXT DEFAULT 'pending',
  chat_id TEXT,
  telegram_username TEXT,
  notes TEXT,
  confirmedAt TIMESTAMPTZ,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  updated_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegrambookings_clinic_id ON public.telegrambookings(clinic_id);

-- ============================================================
-- UPDATED_DATE TRIGGERS
-- ============================================================
DO $$ BEGIN
  CREATE TRIGGER update_users_updated_date BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_patients_updated_date BEFORE UPDATE ON public.patients FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_appointments_updated_date BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_treatment_plans_updated_date BEFORE UPDATE ON public.treatment_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_implants_updated_date BEFORE UPDATE ON public.implants FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_leads_updated_date BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_recalls_updated_date BEFORE UPDATE ON public.recalls FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_debts_updated_date BEFORE UPDATE ON public.debts FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_inventory_updated_date BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_notes_updated_date BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_technicians_updated_date BEFORE UPDATE ON public.technicians FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_technician_jobs_updated_date BEFORE UPDATE ON public.technician_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_cases_updated_date BEFORE UPDATE ON public.cases FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_advertisements_updated_date BEFORE UPDATE ON public.advertisements FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_botconfigs_updated_date BEFORE UPDATE ON public.botconfigs FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TRIGGER update_telegrambookings_updated_date BEFORE UPDATE ON public.telegrambookings FOR EACH ROW EXECUTE FUNCTION public.update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- RLS DISABLED FOR MAXIMUM APP COMPATIBILITY
-- Agar keyin qat'iy SaaS xavfsizligi kerak bo'lsa `rls_setup.sql` ni ishlating
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

-- ============================================================
-- DEFAULT SEED DATA
-- ============================================================
INSERT INTO public.clinics (id, name, password, expires_at, status, monthly_fee, last_payment_date, plan)
VALUES
  ('ava-dent', 'Ava Dent Clinic', 'ava7', '2026-12-31', 'Active', 500000, '2025-10-01', 'pro'),
  ('default_clinic', 'Demo Clinic', 'admin', '2030-01-01', 'Active', 0, CURRENT_DATE, 'pro')
ON CONFLICT (id) DO UPDATE
SET plan = EXCLUDED.plan;

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

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ Full Supabase setup tayyor!';
  RAISE NOTICE '📦 Jadvalar, indekslar, triggerlar va seed ma''lumotlar yaratildi';
  RAISE NOTICE '🔐 Hozircha compatibility uchun RLS o''chirilgan';
END $$;

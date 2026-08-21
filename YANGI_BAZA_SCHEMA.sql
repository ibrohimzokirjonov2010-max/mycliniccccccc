-- ============================================
-- YANGI SUPABASE BAZASI UCHUN TO'LIQ SCHEMA
-- Ushbu skriptni Supabase SQL Editor ga ko'chiring va ishga tushiring
-- URL: https://supabase.com/dashboard/project/hkkhhnrqzjvhubkqhrhm/sql/new
-- ============================================

-- UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CLINICS
CREATE TABLE IF NOT EXISTS clinics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  logo TEXT,
  expires_at DATE,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  monthly_fee INTEGER DEFAULT 0,
  last_payment_date DATE
);
CREATE INDEX IF NOT EXISTS idx_clinics_id ON clinics(id);
CREATE INDEX IF NOT EXISTS idx_clinics_status ON clinics(status);

-- 2. USERS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'doctor' CHECK (role IN ('admin', 'doctor', 'receptionist')),
  commission_rate DECIMAL(5,2) DEFAULT 30.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clinic_id, username)
);
CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- 3. PATIENTS
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY DEFAULT 'patient-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  email TEXT,
  birth_date DATE,
  gender TEXT CHECK (gender IN ('male', 'female', 'other')),
  address TEXT,
  city TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('New', 'Active', 'Inactive', 'Archived')),
  source TEXT,
  notes TEXT,
  photo_url TEXT,
  total_paid DECIMAL(10,2) DEFAULT 0,
  total_debt DECIMAL(10,2) DEFAULT 0,
  last_visit DATE,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name);

-- 4. APPOINTMENTS
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY DEFAULT 'appt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  doctor_id TEXT REFERENCES users(id),
  doctor_name TEXT,
  date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  time TEXT,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'Scheduled' CHECK (status IN ('Scheduled', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No-Show')),
  service TEXT,
  service_id TEXT,
  service_name TEXT,
  price DECIMAL(10,2) DEFAULT 0,
  duration INTEGER DEFAULT 30,
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- 5. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT 'pay-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  patient_name TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT DEFAULT 'cash',
  description TEXT,
  notes TEXT,
  type TEXT,
  category TEXT,
  method TEXT,
  doctor_id TEXT REFERENCES users(id),
  commission_rate DECIMAL(5,2),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_clinic_id ON payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);

-- 6. SERVICES
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY DEFAULT 'svc-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL DEFAULT 0,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30,
  duration INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  category TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON services(clinic_id);

-- 7. TREATMENT PLANS
CREATE TABLE IF NOT EXISTS treatment_plans (
  id TEXT PRIMARY KEY DEFAULT 'tp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  title TEXT,
  name TEXT,
  description TEXT,
  total_cost DECIMAL(10, 2) DEFAULT 0,
  total_price DECIMAL(10, 2) DEFAULT 0,
  status TEXT DEFAULT 'planned',
  priority TEXT DEFAULT 'Medium',
  tooth_number TEXT,
  services JSONB,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_clinic_id ON treatment_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id ON treatment_plans(patient_id);

-- 8. TOOTH RECORDS
CREATE TABLE IF NOT EXISTS tooth_records (
  id TEXT PRIMARY KEY DEFAULT 'tooth-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,
  condition TEXT,
  treatment TEXT,
  notes TEXT,
  image_url TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tooth_records_patient_id ON tooth_records(patient_id);

-- 9. IMPLANTS
CREATE TABLE IF NOT EXISTS implants (
  id TEXT PRIMARY KEY DEFAULT 'implant-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  tooth_number TEXT NOT NULL,
  brand TEXT,
  brend TEXT,
  model TEXT,
  size TEXT,
  diameter TEXT,
  length TEXT,
  implant_type TEXT,
  firma TEXT,
  firma_custom TEXT,
  lot_number TEXT,
  torque TEXT,
  isq TEXT,
  bone_type TEXT,
  patient_phone TEXT,
  tooth_numbers JSONB,
  doctor TEXT,
  lifecycle_status TEXT,
  reminder_months INTEGER,
  reminder_date DATE,
  extra_services JSONB,
  xray_urls JSONB,
  timeline JSONB,
  complications JSONB,
  audit_log JSONB,
  tooth_id TEXT,
  placement_date DATE,
  status TEXT DEFAULT 'planned',
  notes TEXT,
  radiograph_url TEXT,
  passport_url TEXT,
  cost DECIMAL(10, 2),
  step INTEGER DEFAULT 1,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_implants_clinic_id ON implants(clinic_id);
CREATE INDEX IF NOT EXISTS idx_implants_patient_id ON implants(patient_id);

-- 10. LEADS
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY DEFAULT 'lead-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes TEXT,
  visit_date DATE,
  assigned_to TEXT REFERENCES users(id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_leads_clinic_id ON leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- 11. RECALLS
CREATE TABLE IF NOT EXISTS recalls (
  id TEXT PRIMARY KEY DEFAULT 'recall-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  recall_date DATE NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recalls_clinic_id ON recalls(clinic_id);
CREATE INDEX IF NOT EXISTS idx_recalls_patient_id ON recalls(patient_id);
CREATE INDEX IF NOT EXISTS idx_recalls_date ON recalls(recall_date);

-- 12. DEBTS
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY DEFAULT 'debt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  patient_name TEXT,
  amount DECIMAL(10, 2) NOT NULL,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_debts_clinic_id ON debts(clinic_id);
CREATE INDEX IF NOT EXISTS idx_debts_patient_id ON debts(patient_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);

-- 13. EXPENSES
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY DEFAULT 'exp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  receipt_url TEXT,
  paid_by TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_expenses_clinic_id ON expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

-- 14. INVENTORY
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY DEFAULT 'inv-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT,
  quantity INTEGER DEFAULT 0,
  unit TEXT,
  min_quantity INTEGER DEFAULT 0,
  price DECIMAL(10, 2),
  supplier TEXT,
  location TEXT,
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventory_clinic_id ON inventory(clinic_id);
CREATE INDEX IF NOT EXISTS idx_inventory_name ON inventory(name);

-- 15. NOTES
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY DEFAULT 'note-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notes_patient_id ON notes(patient_id);

-- 16. XRAYS
CREATE TABLE IF NOT EXISTS xrays (
  id TEXT PRIMARY KEY DEFAULT 'xray-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  tooth_number TEXT,
  taken_date DATE,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_xrays_patient_id ON xrays(patient_id);

-- 17. ADVERTISEMENTS
CREATE TABLE IF NOT EXISTS advertisements (
  id TEXT PRIMARY KEY DEFAULT 'ad-' || uuid_generate_v4()::TEXT,
  title TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  link_url TEXT,
  cta_text TEXT DEFAULT 'Batafsil',
  start_time TIME DEFAULT '08:00',
  end_time TIME DEFAULT '22:00',
  enabled BOOLEAN DEFAULT true,
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ads_enabled ON advertisements(enabled);

-- ============================================
-- TRIGGERS (auto-update timestamps)
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER update_patients_updated_date BEFORE UPDATE ON patients FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER update_appointments_updated_date BEFORE UPDATE ON appointments FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER update_treatment_plans_updated_date BEFORE UPDATE ON treatment_plans FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER update_implants_updated_date BEFORE UPDATE ON implants FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER update_leads_updated_date BEFORE UPDATE ON leads FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER update_recalls_updated_date BEFORE UPDATE ON recalls FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER update_debts_updated_date BEFORE UPDATE ON debts FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

DO $$ BEGIN
  CREATE TRIGGER update_inventory_updated_date BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();
EXCEPTION WHEN duplicate_object THEN NULL; END; $$;

-- ============================================
-- RLS O'CHIRISH (muhim! yoksa ma'lumot saqlanmaydi)
-- ============================================
ALTER TABLE clinics DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE appointments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE treatment_plans DISABLE ROW LEVEL SECURITY;
ALTER TABLE tooth_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE implants DISABLE ROW LEVEL SECURITY;
ALTER TABLE leads DISABLE ROW LEVEL SECURITY;
ALTER TABLE recalls DISABLE ROW LEVEL SECURITY;
ALTER TABLE debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE notes DISABLE ROW LEVEL SECURITY;
ALTER TABLE xrays DISABLE ROW LEVEL SECURITY;
ALTER TABLE advertisements DISABLE ROW LEVEL SECURITY;

-- ============================================
-- DEFAULT MA'LUMOTLAR (clinika va foydalanuvchilar)
-- ============================================
INSERT INTO clinics (id, name, password, expires_at, status, monthly_fee, last_payment_date)
VALUES 
  ('ava-dent', 'Ava Dent Clinic', 'ava7', '2026-12-31', 'Active', 500000, '2025-10-01'),
  ('default_clinic', 'Demo Clinic', 'admin', '2030-01-01', 'Active', 0, NOW()::DATE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, clinic_id, username, password, name, role)
VALUES 
  ('user-1', 'ava-dent', 'admin', 'ava7', 'Administrator', 'admin'),
  ('user-2', 'ava-dent', 'doctor', 'doctor123', 'Shifokor', 'doctor'),
  ('user-3', 'default_clinic', 'admin', 'admin', 'Demo Admin', 'admin'),
  ('user-4', 'default_clinic', 'demo', 'demo', 'Demo User', 'doctor')
ON CONFLICT (id) DO NOTHING;

-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Barcha jadvallar yaratildi!';
  RAISE NOTICE '📊 17 ta jadval, 2 ta klinika, 4 ta foydalanuvchi';
END $$;

-- ============================================
-- COMPLETE SUPABASE SCHEMA FOR DENTAL CLINIC
-- Copy and paste this ENTIRE script into Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. CLINICS TABLE
-- ============================================
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

-- ============================================
-- 2. USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'doctor' CHECK (role IN ('admin', 'doctor', 'receptionist')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clinic_id, username)
);

CREATE INDEX IF NOT EXISTS idx_users_clinic_id ON users(clinic_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- 3. PATIENTS TABLE
-- ============================================
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
  notes TEXT,
  photo_url TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_clinic_id ON patients(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
CREATE INDEX IF NOT EXISTS idx_patients_full_name ON patients(full_name);

-- ============================================
-- 4. APPOINTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id TEXT PRIMARY KEY DEFAULT 'appt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  doctor_id TEXT REFERENCES users(id),
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  time TEXT,
  duration_minutes INTEGER DEFAULT 30,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no-show')),
  service TEXT,
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_appointments_clinic_id ON appointments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

-- ============================================
-- 5. PAYMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY DEFAULT 'pay-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  payment_method TEXT CHECK (payment_method IN ('cash', 'card', 'transfer', 'other')),
  description TEXT,
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_clinic_id ON payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(date);

-- ============================================
-- 6. SERVICES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY DEFAULT 'svc-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  duration_minutes INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  category TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_services_clinic_id ON services(clinic_id);

-- ============================================
-- 7. TREATMENT PLANS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS treatment_plans (
  id TEXT PRIMARY KEY DEFAULT 'tp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  total_cost DECIMAL(10, 2),
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'in-progress', 'completed', 'cancelled')),
  start_date DATE,
  end_date DATE,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treatment_plans_clinic_id ON treatment_plans(clinic_id);
CREATE INDEX IF NOT EXISTS idx_treatment_plans_patient_id ON treatment_plans(patient_id);

-- ============================================
-- 8. TOOTH RECORDS TABLE
-- ============================================
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

-- ============================================
-- 9. IMPLANTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS implants (
  id TEXT PRIMARY KEY DEFAULT 'implant-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  tooth_number TEXT NOT NULL,
  brand TEXT,
  model TEXT,
  size TEXT,
  placement_date DATE,
  status TEXT DEFAULT 'planned' CHECK (status IN ('planned', 'placed', 'healed', 'restored', 'failed')),
  notes TEXT,
  radiograph_url TEXT,
  passport_url TEXT,
  cost DECIMAL(10, 2),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_implants_patient_id ON implants(patient_id);

-- ============================================
-- 10. LEADS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY DEFAULT 'lead-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  source TEXT,
  status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost')),
  notes TEXT,
  assigned_to TEXT REFERENCES users(id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_clinic_id ON leads(clinic_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ============================================
-- 11. RECALL TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS recalls (
  id TEXT PRIMARY KEY DEFAULT 'recall-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  recall_date DATE NOT NULL,
  type TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'cancelled')),
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recalls_patient_id ON recalls(patient_id);
CREATE INDEX IF NOT EXISTS idx_recalls_date ON recalls(recall_date);

-- ============================================
-- 12. DEBTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS debts (
  id TEXT PRIMARY KEY DEFAULT 'debt-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  remaining_amount DECIMAL(10, 2) NOT NULL,
  due_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue', 'cancelled')),
  notes TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_debts_patient_id ON debts(patient_id);
CREATE INDEX IF NOT EXISTS idx_debts_status ON debts(status);

-- ============================================
-- 13. EXPENSES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY DEFAULT 'exp-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  date DATE NOT NULL,
  description TEXT,
  receipt_url TEXT,
  paid_by TEXT,
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_clinic_id ON expenses(clinic_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);

-- ============================================
-- 14. INVENTORY TABLE
-- ============================================
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

-- ============================================
-- 15. NOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY DEFAULT 'note-' || uuid_generate_v4()::TEXT,
  clinic_id TEXT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  patient_id TEXT REFERENCES patients(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by TEXT REFERENCES users(id),
  created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notes_patient_id ON notes(patient_id);

-- ============================================
-- 16. XRAYS TABLE
-- ============================================
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

-- ============================================
-- 17. ADVERTISEMENTS TABLE
-- ============================================
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
-- TRIGGERS FOR UPDATED_DATE
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_date_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_date = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_patients_updated_date BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_appointments_updated_date BEFORE UPDATE ON appointments
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_treatment_plans_updated_date BEFORE UPDATE ON treatment_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_tooth_records_updated_date BEFORE UPDATE ON tooth_records
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_implants_updated_date BEFORE UPDATE ON implants
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_leads_updated_date BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_recalls_updated_date BEFORE UPDATE ON recalls
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_debts_updated_date BEFORE UPDATE ON debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_inventory_updated_date BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

CREATE TRIGGER update_advertisements_updated_date BEFORE UPDATE ON advertisements
    FOR EACH ROW EXECUTE FUNCTION update_updated_date_column();

-- ============================================
-- INSERT DEFAULT DATA
-- ============================================

-- Default Clinics
INSERT INTO clinics (id, name, password, expires_at, status, monthly_fee, last_payment_date)
VALUES 
  ('ava-dent', 'Ava Dent Clinic', 'ava7', '2026-12-31', 'Active', 500000, '2025-10-01'),
  ('default_clinic', 'Demo Clinic', 'admin', '2030-01-01', 'Active', 0, NOW()::DATE)
ON CONFLICT (id) DO NOTHING;

-- Default Users
INSERT INTO users (id, clinic_id, username, password, name, role)
VALUES 
  ('user-1', 'ava-dent', 'admin', 'ava7', 'Administrator', 'admin'),
  ('user-2', 'ava-dent', 'doctor', 'doctor123', 'Shifokor', 'doctor'),
  ('user-3', 'default_clinic', 'admin', 'admin', 'Demo Admin', 'admin'),
  ('user-4', 'default_clinic', 'demo', 'demo', 'Demo User', 'doctor')
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- SUCCESS MESSAGE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Database schema created successfully!';
  RAISE NOTICE '📊 Tables created: 17';
  RAISE NOTICE '🏢 Default clinics: 2';
  RAISE NOTICE '👥 Default users: 4';
END $$;

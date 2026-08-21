-- ============================================================
-- NexusOS CRM — RLS Setup (Xavfsiz versiya)
-- Avval barcha mavjud qoidalarni o'chiradi, keyin yangisini yaratadi
-- ============================================================

-- 1-QADAM: YORDAMCHI FUNKSIYALAR
-- ============================================================

CREATE OR REPLACE FUNCTION get_clinic_id()
RETURNS TEXT AS $func$
  SELECT COALESCE(current_setting('app.clinic_id', true), '');
$func$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $func$
  SELECT COALESCE(current_setting('app.is_super_admin', true), 'false') = 'true';
$func$ LANGUAGE SQL STABLE SECURITY DEFINER;


-- ============================================================
-- 2-QADAM: MAVJUD BARCHA QOIDALARNI O'CHIRISH
-- (nomidan qat'iy nazar, barcha jadvallardan)
-- ============================================================

DO $cleanup$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'patients','appointments','payments','services',
        'inventory','leads','treatment_plans','recalls',
        'debts','users','expenses','tooth_records','implants',
        'notes','xrays','technician_jobs','technicians',
        'service_categories','cases','case_categories','clinics'
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
    RAISE NOTICE 'Dropped policy: % on %', r.policyname, r.tablename;
  END LOOP;
END;
$cleanup$;


-- ============================================================
-- 3-QADAM: BARCHA JADVALLAR UCHUN RLS YOQISH
-- ============================================================

ALTER TABLE IF EXISTS patients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS appointments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS treatment_plans    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recalls            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS debts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS expenses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tooth_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS implants           ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS xrays              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS technician_jobs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS technicians        ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS service_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cases              ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS case_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clinics            ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 4-QADAM: YANGI QOIDALAR YARATISH
-- ============================================================

-- PATIENTS
CREATE POLICY "clinic_select" ON patients FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON patients FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON patients FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON patients FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- APPOINTMENTS
CREATE POLICY "clinic_select" ON appointments FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON appointments FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON appointments FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON appointments FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- PAYMENTS
CREATE POLICY "clinic_select" ON payments FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON payments FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON payments FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON payments FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- SERVICES
CREATE POLICY "clinic_select" ON services FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON services FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON services FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON services FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- INVENTORY
CREATE POLICY "clinic_select" ON inventory FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON inventory FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON inventory FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON inventory FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- LEADS
CREATE POLICY "clinic_select" ON leads FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON leads FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON leads FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON leads FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- TREATMENT_PLANS
CREATE POLICY "clinic_select" ON treatment_plans FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON treatment_plans FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON treatment_plans FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON treatment_plans FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- RECALLS
CREATE POLICY "clinic_select" ON recalls FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON recalls FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON recalls FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON recalls FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- DEBTS
CREATE POLICY "clinic_select" ON debts FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON debts FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON debts FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON debts FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- USERS
CREATE POLICY "clinic_select" ON users FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON users FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON users FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON users FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- EXPENSES
CREATE POLICY "clinic_select" ON expenses FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON expenses FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON expenses FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON expenses FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- TOOTH_RECORDS
CREATE POLICY "clinic_select" ON tooth_records FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON tooth_records FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON tooth_records FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON tooth_records FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- IMPLANTS
CREATE POLICY "clinic_select" ON implants FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON implants FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON implants FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON implants FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- NOTES
CREATE POLICY "clinic_select" ON notes FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON notes FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON notes FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON notes FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- XRAYS
CREATE POLICY "clinic_select" ON xrays FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON xrays FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON xrays FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON xrays FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- TECHNICIAN_JOBS
CREATE POLICY "clinic_select" ON technician_jobs FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON technician_jobs FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON technician_jobs FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON technician_jobs FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- TECHNICIANS
CREATE POLICY "clinic_select" ON technicians FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON technicians FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON technicians FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON technicians FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- SERVICE_CATEGORIES
CREATE POLICY "clinic_select" ON service_categories FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON service_categories FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON service_categories FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON service_categories FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- CASES
CREATE POLICY "clinic_select" ON cases FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON cases FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON cases FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON cases FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- CASE_CATEGORIES
CREATE POLICY "clinic_select" ON case_categories FOR SELECT USING (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_insert" ON case_categories FOR INSERT WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_update" ON case_categories FOR UPDATE USING (clinic_id = get_clinic_id() OR is_super_admin()) WITH CHECK (clinic_id = get_clinic_id() OR is_super_admin());
CREATE POLICY "clinic_delete" ON case_categories FOR DELETE USING (clinic_id = get_clinic_id() OR is_super_admin());

-- CLINICS (Super Admin alohida)
CREATE POLICY "super_admin_all"  ON clinics FOR ALL    USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_self_read" ON clinics FOR SELECT USING (id = get_clinic_id());


-- ============================================================
-- TEKSHIRISH:
-- SELECT set_config('app.clinic_id', 'ava-dent', true);
-- SELECT COUNT(*) FROM patients; -- faqat ava-dent bemorlar
-- ============================================================

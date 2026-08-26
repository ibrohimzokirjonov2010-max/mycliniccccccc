-- ============================================================
-- NexusOS CRM — RLS Setup (Optimallashtirilgan versiya)
-- Avval barcha mavjud qoidalarni o'chiradi, keyin har bir table uchun
-- clinic va super admin siyosatlarini 2 ta alohida POLICY ga ajratadi.
-- Bu PostgreSQL ga clinic_id indekslaridan to'liq foydalanish imkonini beradi.
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
  END LOOP;
END;
$cleanup$;


-- ============================================================
-- 3-QADAM: YANGI ALOHIDA SIYOSATLARNI YARATISH (Indekslar uchun qulay)
-- ============================================================

-- Yordamchi makro (har bir jadval uchun alohida policy yozish)
-- PostgreSQL additive RLS siyosatlarini implicit OR bilan birlashtiradi.

-- PATIENTS
CREATE POLICY "clinic_select_patients" ON patients FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_patients"  ON patients FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_patients" ON patients FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_patients"  ON patients FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_patients" ON patients FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_patients"  ON patients FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_patients" ON patients FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_patients"  ON patients FOR DELETE USING (is_super_admin());

-- APPOINTMENTS
CREATE POLICY "clinic_select_appts" ON appointments FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_appts"  ON appointments FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_appts" ON appointments FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_appts"  ON appointments FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_appts" ON appointments FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_appts"  ON appointments FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_appts" ON appointments FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_appts"  ON appointments FOR DELETE USING (is_super_admin());

-- PAYMENTS
CREATE POLICY "clinic_select_pays" ON payments FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_pays"  ON payments FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_pays" ON payments FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_pays"  ON payments FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_pays" ON payments FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_pays"  ON payments FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_pays" ON payments FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_pays"  ON payments FOR DELETE USING (is_super_admin());

-- SERVICES
CREATE POLICY "clinic_select_services" ON services FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_services"  ON services FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_services" ON services FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_services"  ON services FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_services" ON services FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_services"  ON services FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_services" ON services FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_services"  ON services FOR DELETE USING (is_super_admin());

-- INVENTORY
CREATE POLICY "clinic_select_inv" ON inventory FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_inv"  ON inventory FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_inv" ON inventory FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_inv"  ON inventory FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_inv" ON inventory FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_inv"  ON inventory FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_inv" ON inventory FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_inv"  ON inventory FOR DELETE USING (is_super_admin());

-- LEADS
CREATE POLICY "clinic_select_leads" ON leads FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_leads"  ON leads FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_leads" ON leads FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_leads"  ON leads FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_leads" ON leads FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_leads"  ON leads FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_leads" ON leads FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_leads"  ON leads FOR DELETE USING (is_super_admin());

-- TREATMENT_PLANS
CREATE POLICY "clinic_select_plans" ON treatment_plans FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_plans"  ON treatment_plans FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_plans" ON treatment_plans FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_plans"  ON treatment_plans FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_plans" ON treatment_plans FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_plans"  ON treatment_plans FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_plans" ON treatment_plans FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_plans"  ON treatment_plans FOR DELETE USING (is_super_admin());

-- RECALLS
CREATE POLICY "clinic_select_recalls" ON recalls FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_recalls"  ON recalls FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_recalls" ON recalls FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_recalls"  ON recalls FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_recalls" ON recalls FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_recalls"  ON recalls FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_recalls" ON recalls FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_recalls"  ON recalls FOR DELETE USING (is_super_admin());

-- DEBTS
CREATE POLICY "clinic_select_debts" ON debts FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_debts"  ON debts FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_debts" ON debts FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_debts"  ON debts FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_debts" ON debts FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_debts"  ON debts FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_debts" ON debts FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_debts"  ON debts FOR DELETE USING (is_super_admin());

-- USERS
CREATE POLICY "clinic_select_users" ON users FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_users"  ON users FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_users" ON users FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_users"  ON users FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_users" ON users FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_users"  ON users FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_users" ON users FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_users"  ON users FOR DELETE USING (is_super_admin());

-- EXPENSES
CREATE POLICY "clinic_select_exp" ON expenses FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_exp"  ON expenses FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_exp" ON expenses FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_exp"  ON expenses FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_exp" ON expenses FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_exp"  ON expenses FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_exp" ON expenses FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_exp"  ON expenses FOR DELETE USING (is_super_admin());

-- TOOTH_RECORDS
CREATE POLICY "clinic_select_tooth" ON tooth_records FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_tooth"  ON tooth_records FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_tooth" ON tooth_records FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_tooth"  ON tooth_records FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_tooth" ON tooth_records FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_tooth"  ON tooth_records FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_tooth" ON tooth_records FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_tooth"  ON tooth_records FOR DELETE USING (is_super_admin());

-- IMPLANTS
CREATE POLICY "clinic_select_implants" ON implants FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_implants"  ON implants FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_implants" ON implants FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_implants"  ON implants FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_implants" ON implants FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_implants"  ON implants FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_implants" ON implants FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_implants"  ON implants FOR DELETE USING (is_super_admin());

-- NOTES
CREATE POLICY "clinic_select_notes" ON notes FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_notes"  ON notes FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_notes" ON notes FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_notes"  ON notes FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_notes" ON notes FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_notes"  ON notes FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_notes" ON notes FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_notes"  ON notes FOR DELETE USING (is_super_admin());

-- XRAYS
CREATE POLICY "clinic_select_xrays" ON xrays FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_xrays"  ON xrays FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_xrays" ON xrays FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_xrays"  ON xrays FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_xrays" ON xrays FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_xrays"  ON xrays FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_xrays" ON xrays FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_xrays"  ON xrays FOR DELETE USING (is_super_admin());

-- TECHNICIAN_JOBS
CREATE POLICY "clinic_select_tech_jobs" ON technician_jobs FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_tech_jobs"  ON technician_jobs FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_tech_jobs" ON technician_jobs FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_tech_jobs"  ON technician_jobs FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_tech_jobs" ON technician_jobs FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_tech_jobs"  ON technician_jobs FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_tech_jobs" ON technician_jobs FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_tech_jobs"  ON technician_jobs FOR DELETE USING (is_super_admin());

-- TECHNICIANS
CREATE POLICY "clinic_select_technicians" ON technicians FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_technicians"  ON technicians FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_technicians" ON technicians FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_technicians"  ON technicians FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_technicians" ON technicians FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_technicians"  ON technicians FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_technicians" ON technicians FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_technicians"  ON technicians FOR DELETE USING (is_super_admin());

-- SERVICE_CATEGORIES
CREATE POLICY "clinic_select_svc_cats" ON service_categories FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_svc_cats"  ON service_categories FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_svc_cats" ON service_categories FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_svc_cats"  ON service_categories FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_svc_cats" ON service_categories FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_svc_cats"  ON service_categories FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_svc_cats" ON service_categories FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_svc_cats"  ON service_categories FOR DELETE USING (is_super_admin());

-- CASES
CREATE POLICY "clinic_select_cases" ON cases FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_cases"  ON cases FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_cases" ON cases FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_cases"  ON cases FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_cases" ON cases FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_cases"  ON cases FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_cases" ON cases FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_cases"  ON cases FOR DELETE USING (is_super_admin());

-- CASE_CATEGORIES
CREATE POLICY "clinic_select_case_cats" ON case_categories FOR SELECT USING (clinic_id = get_clinic_id());
CREATE POLICY "super_select_case_cats"  ON case_categories FOR SELECT USING (is_super_admin());
CREATE POLICY "clinic_insert_case_cats" ON case_categories FOR INSERT WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_insert_case_cats"  ON case_categories FOR INSERT WITH CHECK (is_super_admin());
CREATE POLICY "clinic_update_case_cats" ON case_categories FOR UPDATE USING (clinic_id = get_clinic_id()) WITH CHECK (clinic_id = get_clinic_id());
CREATE POLICY "super_update_case_cats"  ON case_categories FOR UPDATE USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_delete_case_cats" ON case_categories FOR DELETE USING (clinic_id = get_clinic_id());
CREATE POLICY "super_delete_case_cats"  ON case_categories FOR DELETE USING (is_super_admin());

-- CLINICS (Allohida)
CREATE POLICY "super_admin_all_clinics" ON clinics FOR ALL    USING (is_super_admin()) WITH CHECK (is_super_admin());
CREATE POLICY "clinic_self_read_clinics" ON clinics FOR SELECT USING (id = get_clinic_id());

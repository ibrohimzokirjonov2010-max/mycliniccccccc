-- Restores clinic-wide policies after 20261118120400_phase1_plan_rls.sql.
-- Does not restore patient text or dropped functions.
-- Run only if the phase-1 policies must be undone. Anon stays without grants.

DO $restore$
DECLARE
  t text;
  pol record;
  names text[] := ARRAY[
    'patients', 'appointments', 'payments', 'services', 'service_categories',
    'treatment_plans', 'tooth_records', 'implants', 'implant_brands', 'leads',
    'recalls', 'debts', 'expenses', 'inventory', 'notes', 'technicians',
    'technician_jobs', 'cases', 'case_categories', 'botconfigs',
    'telegrambookings', 'scheduled_notifications', 'xrays'
  ];
BEGIN
  FOREACH t IN ARRAY names LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t AND policyname LIKE 'crm_%' LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'clinic_id'
    ) THEN
      EXECUTE format(
        'CREATE POLICY crm_tenant_clinic ON public.%I FOR ALL TO authenticated USING (crm_private.is_platform_admin() OR clinic_id = crm_private.jwt_clinic_id()) WITH CHECK (crm_private.is_platform_admin() OR clinic_id = crm_private.jwt_clinic_id())',
        t
      );
    END IF;
  END LOOP;

  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' AND policyname LIKE 'crm_%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
  CREATE POLICY crm_users_clinic ON public.users FOR ALL TO authenticated
    USING (crm_private.is_platform_admin() OR clinic_id = crm_private.jwt_clinic_id())
    WITH CHECK (crm_private.is_platform_admin() OR clinic_id = crm_private.jwt_clinic_id());

  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clinics' AND policyname LIKE 'crm_%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinics', pol.policyname);
  END LOOP;
  CREATE POLICY crm_clinics_own ON public.clinics FOR SELECT TO authenticated
    USING (crm_private.is_platform_admin() OR id = crm_private.jwt_clinic_id());
  CREATE POLICY crm_clinics_own_write ON public.clinics FOR UPDATE TO authenticated
    USING (crm_private.is_platform_admin() OR id = crm_private.jwt_clinic_id())
    WITH CHECK (crm_private.is_platform_admin() OR id = crm_private.jwt_clinic_id());
END
$restore$;

DROP TRIGGER IF EXISTS crm_reject_short_password ON public.users;

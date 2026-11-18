-- Restores phase-1 FOR ALL policies after 20261118140000_signup_readonly_rls.sql.
-- Does not delete clinic or patient rows.

DO $restore$
DECLARE
  t text;
  names text[] := ARRAY[
    'patients', 'appointments', 'payments', 'services', 'service_categories',
    'treatment_plans', 'tooth_records', 'implants', 'implant_brands', 'leads',
    'recalls', 'debts', 'expenses', 'inventory', 'notes', 'technicians',
    'technician_jobs', 'cases', 'case_categories', 'botconfigs',
    'telegrambookings', 'scheduled_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY names LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_delete ON public.%I', t);
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'clinic_id'
    ) THEN
      EXECUTE format(
        'CREATE POLICY crm_tenant_access ON public.%I FOR ALL TO authenticated USING (crm_private.can_access(clinic_id, %L)) WITH CHECK (crm_private.can_access(clinic_id, %L))',
        t, t, t
      );
    END IF;
  END LOOP;
END
$restore$;

DO $xrays$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.xrays') IS NULL THEN RETURN; END IF;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'xrays' AND policyname LIKE 'crm_tenant_%' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.xrays', pol.policyname);
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'xrays' AND column_name = 'xray_type'
  ) THEN
    CREATE POLICY crm_tenant_access ON public.xrays
      FOR ALL TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays', xray_type))
      WITH CHECK (crm_private.can_access(clinic_id, 'xrays', xray_type));
  ELSE
    CREATE POLICY crm_tenant_access ON public.xrays
      FOR ALL TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays'))
      WITH CHECK (crm_private.can_access(clinic_id, 'xrays'));
  END IF;
END
$xrays$;

DROP POLICY IF EXISTS crm_users_insert ON public.users;
DROP POLICY IF EXISTS crm_users_update ON public.users;
DROP POLICY IF EXISTS crm_users_delete ON public.users;
CREATE POLICY crm_users_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK (
    crm_private.is_platform_admin()
    OR (clinic_id = crm_private.jwt_clinic_id() AND (crm_private.is_clinic_admin() OR crm_private.staff_page_granted('staff')))
  );
CREATE POLICY crm_users_update ON public.users FOR UPDATE TO authenticated
  USING (
    crm_private.is_platform_admin()
    OR (clinic_id = crm_private.jwt_clinic_id() AND (
      crm_private.is_clinic_admin() OR crm_private.staff_page_granted('staff') OR id = crm_private.jwt_user_id()
    ))
  )
  WITH CHECK (crm_private.is_platform_admin() OR clinic_id = crm_private.jwt_clinic_id());
CREATE POLICY crm_users_delete ON public.users FOR DELETE TO authenticated
  USING (
    crm_private.is_platform_admin()
    OR (clinic_id = crm_private.jwt_clinic_id() AND (crm_private.is_clinic_admin() OR crm_private.staff_page_granted('staff')))
  );

DROP POLICY IF EXISTS crm_clinics_update ON public.clinics;
CREATE POLICY crm_clinics_update ON public.clinics FOR UPDATE TO authenticated
  USING (id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin())
  WITH CHECK (id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin());

DROP FUNCTION IF EXISTS crm_private.subscription_writable();

NOTIFY pgrst, 'reload schema';

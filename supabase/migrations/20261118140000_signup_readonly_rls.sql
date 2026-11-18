-- ============================================================================
-- Self-serve signup: past_due / read_only clinics can still SELECT, but not write.
-- Does not update or delete existing rows. Depends on 20261118120400_phase1_plan_rls.sql.
-- Rollback: supabase/rollbacks/20261118140000_signup_readonly_rls_rollback.sql
-- Do not run against production until the signup flow is reviewed.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS crm_private;

CREATE OR REPLACE FUNCTION crm_private.subscription_writable()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
DECLARE
  raw_logo text;
  extra text;
  sub_status text;
  access_mode text;
BEGIN
  IF crm_private.is_platform_admin() THEN
    RETURN true;
  END IF;
  SELECT c.logo INTO raw_logo
  FROM public.clinics c
  WHERE c.id = crm_private.jwt_clinic_id();

  IF raw_logo LIKE '[EXT]%' AND position('[/EXT]' in raw_logo) > 5 THEN
    extra := substring(raw_logo from 6 for position('[/EXT]' in raw_logo) - 6);
    BEGIN
      sub_status := lower(btrim(extra::jsonb ->> 'subscription_status'));
      access_mode := lower(btrim(extra::jsonb ->> 'access_mode'));
    EXCEPTION WHEN OTHERS THEN
      sub_status := NULL;
      access_mode := NULL;
    END;
  END IF;

  IF sub_status = 'past_due' OR access_mode = 'read_only' THEN
    RETURN false;
  END IF;
  RETURN true;
END
$fn$;

REVOKE ALL ON FUNCTION crm_private.subscription_writable() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crm_private.subscription_writable() TO authenticated, service_role;

DO $tenant$
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
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'clinic_id'
    ) THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_access ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS crm_tenant_delete ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY crm_tenant_select ON public.%I FOR SELECT TO authenticated USING (crm_private.can_access(clinic_id, %L))',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY crm_tenant_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (crm_private.can_access(clinic_id, %L) AND crm_private.subscription_writable())',
      t, t
    );
    EXECUTE format(
      'CREATE POLICY crm_tenant_update ON public.%I FOR UPDATE TO authenticated USING (crm_private.can_access(clinic_id, %L) AND crm_private.subscription_writable()) WITH CHECK (crm_private.can_access(clinic_id, %L) AND crm_private.subscription_writable())',
      t, t, t
    );
    EXECUTE format(
      'CREATE POLICY crm_tenant_delete ON public.%I FOR DELETE TO authenticated USING (crm_private.can_access(clinic_id, %L) AND crm_private.subscription_writable())',
      t, t
    );
  END LOOP;
END
$tenant$;

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
    CREATE POLICY crm_tenant_select ON public.xrays
      FOR SELECT TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays', xray_type));
    CREATE POLICY crm_tenant_insert ON public.xrays
      FOR INSERT TO authenticated
      WITH CHECK (crm_private.can_access(clinic_id, 'xrays', xray_type) AND crm_private.subscription_writable());
    CREATE POLICY crm_tenant_update ON public.xrays
      FOR UPDATE TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays', xray_type) AND crm_private.subscription_writable())
      WITH CHECK (crm_private.can_access(clinic_id, 'xrays', xray_type) AND crm_private.subscription_writable());
    CREATE POLICY crm_tenant_delete ON public.xrays
      FOR DELETE TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays', xray_type) AND crm_private.subscription_writable());
  ELSE
    CREATE POLICY crm_tenant_select ON public.xrays
      FOR SELECT TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays'));
    CREATE POLICY crm_tenant_insert ON public.xrays
      FOR INSERT TO authenticated
      WITH CHECK (crm_private.can_access(clinic_id, 'xrays') AND crm_private.subscription_writable());
    CREATE POLICY crm_tenant_update ON public.xrays
      FOR UPDATE TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays') AND crm_private.subscription_writable())
      WITH CHECK (crm_private.can_access(clinic_id, 'xrays') AND crm_private.subscription_writable());
    CREATE POLICY crm_tenant_delete ON public.xrays
      FOR DELETE TO authenticated
      USING (crm_private.can_access(clinic_id, 'xrays') AND crm_private.subscription_writable());
  END IF;
END
$xrays$;

DROP POLICY IF EXISTS crm_users_insert ON public.users;
DROP POLICY IF EXISTS crm_users_update ON public.users;
DROP POLICY IF EXISTS crm_users_delete ON public.users;
CREATE POLICY crm_users_insert ON public.users FOR INSERT TO authenticated
  WITH CHECK (
    crm_private.subscription_writable()
    AND (
      crm_private.is_platform_admin()
      OR (clinic_id = crm_private.jwt_clinic_id() AND (crm_private.is_clinic_admin() OR crm_private.staff_page_granted('staff')))
    )
  );
CREATE POLICY crm_users_update ON public.users FOR UPDATE TO authenticated
  USING (
    crm_private.subscription_writable()
    AND (
      crm_private.is_platform_admin()
      OR (clinic_id = crm_private.jwt_clinic_id() AND (
        crm_private.is_clinic_admin() OR crm_private.staff_page_granted('staff') OR id = crm_private.jwt_user_id()
      ))
    )
  )
  WITH CHECK (
    crm_private.subscription_writable()
    AND (crm_private.is_platform_admin() OR clinic_id = crm_private.jwt_clinic_id())
  );
CREATE POLICY crm_users_delete ON public.users FOR DELETE TO authenticated
  USING (
    crm_private.subscription_writable()
    AND (
      crm_private.is_platform_admin()
      OR (clinic_id = crm_private.jwt_clinic_id() AND (crm_private.is_clinic_admin() OR crm_private.staff_page_granted('staff')))
    )
  );

DROP POLICY IF EXISTS crm_clinics_update ON public.clinics;
CREATE POLICY crm_clinics_update ON public.clinics FOR UPDATE TO authenticated
  USING (
    crm_private.subscription_writable()
    AND (id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin())
  )
  WITH CHECK (
    crm_private.subscription_writable()
    AND (id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin())
  );

NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Phase 1 — replaces RLS policies on tenant tables.
-- This does not delete rows. It drops existing public policies on the listed
-- tables and creates policies that:
--   * ignore anon (no policy and no grant)
--   * read clinic_id from the JWT app_metadata, not from the browser
--   * hide pro-only tables when the clinic row's plan is basic
--   * let only admin/owner, or a staff page grant, write expenses and manage users
-- Rollback: supabase/rollbacks/20261118120400_phase1_plan_rls_rollback.sql
-- Run this only after P0-1. Take a backup first.
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS crm_private;
GRANT USAGE ON SCHEMA crm_private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION crm_private.jwt_clinic_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
  SELECT NULLIF(btrim(auth.jwt() -> 'app_metadata' ->> 'clinic_id'), '');
$fn$;

CREATE OR REPLACE FUNCTION crm_private.jwt_user_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
  SELECT NULLIF(btrim(auth.jwt() -> 'app_metadata' ->> 'crm_user_id'), '');
$fn$;

CREATE OR REPLACE FUNCTION crm_private.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
  SELECT coalesce(auth.jwt() -> 'app_metadata' ->> 'crm_role', '') = 'superadmin';
$fn$;

CREATE OR REPLACE FUNCTION crm_private.current_staff_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
  SELECT lower(btrim(u.role))
  FROM public.users u
  WHERE u.id = crm_private.jwt_user_id()
    AND u.clinic_id = crm_private.jwt_clinic_id()
  LIMIT 1;
$fn$;

CREATE OR REPLACE FUNCTION crm_private.is_clinic_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
  SELECT crm_private.current_staff_role() IN ('admin', 'owner');
$fn$;

CREATE OR REPLACE FUNCTION crm_private.current_plan()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
DECLARE
  raw_plan text;
  raw_logo text;
  extra text;
  tariff text;
BEGIN
  SELECT c.plan, c.logo INTO raw_plan, raw_logo
  FROM public.clinics c
  WHERE c.id = crm_private.jwt_clinic_id();

  IF raw_logo LIKE '[EXT]%' AND position('[/EXT]' in raw_logo) > 5 THEN
    extra := substring(raw_logo from 6 for position('[/EXT]' in raw_logo) - 6);
    BEGIN
      tariff := lower(btrim(extra::jsonb ->> 'tariff'));
    EXCEPTION WHEN OTHERS THEN
      tariff := NULL;
    END;
  END IF;

  IF tariff IN ('premium', 'klinika') THEN RETURN 'premium'; END IF;
  IF tariff = 'pro' THEN RETURN 'pro'; END IF;
  IF tariff IN ('basic', 'start') THEN RETURN 'basic'; END IF;
  IF lower(btrim(raw_plan)) IN ('premium', 'klinika') THEN RETURN 'premium'; END IF;
  IF lower(btrim(raw_plan)) = 'pro' THEN RETURN 'pro'; END IF;
  RETURN 'basic';
END
$fn$;

CREATE OR REPLACE FUNCTION crm_private.staff_page_granted(p_key text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
DECLARE
  notes text;
  blob text;
  flag text;
BEGIN
  IF crm_private.is_platform_admin() OR crm_private.is_clinic_admin() THEN
    RETURN true;
  END IF;
  SELECT u.notes INTO notes
  FROM public.users u
  WHERE u.id = crm_private.jwt_user_id()
    AND u.clinic_id = crm_private.jwt_clinic_id();
  IF notes IS NULL OR position('[TECH_DATA]' in notes) <> 1 OR position('[END_TECH]' in notes) < 12 THEN
    RETURN false;
  END IF;
  blob := substring(notes from 12 for position('[END_TECH]' in notes) - 12);
  BEGIN
    flag := blob::jsonb -> 'page_access' ->> p_key;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  RETURN flag = 'true';
END
$fn$;

CREATE OR REPLACE FUNCTION crm_private.can_access(p_clinic text, p_table text, p_extra text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
DECLARE
  plan text;
  pro_tables text[] := ARRAY[
    'leads', 'expenses', 'inventory', 'implants', 'implant_brands',
    'cases', 'case_categories', 'technicians', 'technician_jobs'
  ];
BEGIN
  IF crm_private.is_platform_admin() THEN
    RETURN true;
  END IF;
  IF p_clinic IS NULL OR p_clinic IS DISTINCT FROM crm_private.jwt_clinic_id() THEN
    RETURN false;
  END IF;
  plan := crm_private.current_plan();
  IF p_table = ANY (pro_tables) AND plan NOT IN ('pro', 'premium') THEN
    RETURN false;
  END IF;
  IF p_table = 'xrays' AND coalesce(p_extra, '') = 'clinic_case' AND plan NOT IN ('pro', 'premium') THEN
    RETURN false;
  END IF;
  IF p_table = 'expenses' AND NOT crm_private.staff_page_granted('expenses') THEN
    RETURN false;
  END IF;
  RETURN true;
END
$fn$;

REVOKE ALL ON FUNCTION crm_private.jwt_clinic_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION crm_private.jwt_user_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION crm_private.is_platform_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION crm_private.current_staff_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION crm_private.is_clinic_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION crm_private.current_plan() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION crm_private.staff_page_granted(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION crm_private.can_access(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION crm_private.jwt_clinic_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION crm_private.jwt_user_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION crm_private.is_platform_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION crm_private.current_staff_role() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION crm_private.is_clinic_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION crm_private.current_plan() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION crm_private.staff_page_granted(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION crm_private.can_access(text, text, text) TO authenticated, service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

DO $tenant$
DECLARE
  t text;
  pol record;
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
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format(
      'CREATE POLICY crm_tenant_access ON public.%I FOR ALL TO authenticated USING (crm_private.can_access(clinic_id, %L)) WITH CHECK (crm_private.can_access(clinic_id, %L))',
      t, t, t
    );
  END LOOP;
END
$tenant$;

DO $xrays$
DECLARE
  pol record;
BEGIN
  IF to_regclass('public.xrays') IS NULL THEN RETURN; END IF;
  ALTER TABLE public.xrays ENABLE ROW LEVEL SECURITY;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'xrays' LOOP
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

DO $users$
DECLARE
  pol record;
BEGIN
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'users' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.users', pol.policyname);
  END LOOP;
  CREATE POLICY crm_users_select ON public.users FOR SELECT TO authenticated
    USING (clinic_id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin());
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
END
$users$;

DO $clinics$
DECLARE
  pol record;
BEGIN
  ALTER TABLE public.clinics ENABLE ROW LEVEL SECURITY;
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clinics' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.clinics', pol.policyname);
  END LOOP;
  CREATE POLICY crm_clinics_select ON public.clinics FOR SELECT TO authenticated
    USING (id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin());
  CREATE POLICY crm_clinics_update ON public.clinics FOR UPDATE TO authenticated
    USING (id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin())
    WITH CHECK (id = crm_private.jwt_clinic_id() OR crm_private.is_platform_admin());
  CREATE POLICY crm_clinics_insert ON public.clinics FOR INSERT TO authenticated
    WITH CHECK (crm_private.is_platform_admin());
  CREATE POLICY crm_clinics_delete ON public.clinics FOR DELETE TO authenticated
    USING (crm_private.is_platform_admin());
END
$clinics$;

NOTIFY pgrst, 'reload schema';

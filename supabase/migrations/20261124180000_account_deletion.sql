-- ============================================================================
-- Account deletion (Apple App Store 5.1.1(v)).
-- NOT APPLIED. Do not run this file from automation or against the live
-- project until it has been reviewed. It does not DELETE or UPDATE patients,
-- appointments, payments, or any other clinical row.
--
-- What an operator run does:
--   1. public.users.login_disabled (default false). Existing logins stay enabled.
--   2. public.clinic_deletion_requests and public.account_deletion_events.
--      Service role only. No patient fields and no password column.
--   3. Two service-role functions that touch one CRM user id:
--        crm_account_delete_login(user id)    — deletes that users row and its password hash
--        crm_account_disable_login(user id)   — disables that one login
--   4. Nullable public FKs that point at public.users become ON DELETE SET NULL
--      so removing a login cannot cascade-delete clinic rows. The previous
--      action is saved in crm_private.account_deletion_fk_backup (metadata).
--
-- Rollback: supabase/rollbacks/20261124180000_account_deletion_rollback.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS crm_private;
GRANT USAGE ON SCHEMA crm_private TO service_role;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS login_disabled boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.clinic_deletion_requests (
  id text PRIMARY KEY,
  clinic_id text NOT NULL,
  user_id text NOT NULL,
  username text,
  role text,
  status text NOT NULL DEFAULT 'pending',
  requested_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clinic_deletion_requests_status_chk CHECK (status IN ('pending', 'processed', 'cancelled'))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinic_deletion_requests_pending
  ON public.clinic_deletion_requests (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_clinic_deletion_requests_clinic
  ON public.clinic_deletion_requests (clinic_id, status);

CREATE TABLE IF NOT EXISTS public.account_deletion_events (
  id text PRIMARY KEY,
  clinic_id text NOT NULL,
  user_id text NOT NULL,
  username text,
  role text,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_deletion_events_action_chk CHECK (action IN ('deleted', 'deletion_requested'))
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_events_clinic
  ON public.account_deletion_events (clinic_id, created_at DESC);

ALTER TABLE public.clinic_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.clinic_deletion_requests FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.account_deletion_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.clinic_deletion_requests TO service_role;
GRANT ALL ON TABLE public.account_deletion_events TO service_role;

-- Password helpers live in crm_private (not exposed). The public functions are
-- SECURITY INVOKER wrappers so PostgREST can call them with the service role.
-- anon and authenticated cannot execute either copy.

-- Deletes one CRM login and its password hash in a single transaction.
-- A foreign-key failure aborts both, so the password is not removed when the
-- users row cannot be deleted. Clinic tables are not named here.
CREATE OR REPLACE FUNCTION crm_private.account_delete_login(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = crm_private, public
AS $fn$
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'missing_user' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;
  DELETE FROM public.users WHERE id = p_user_id;
  IF to_regclass('crm_private.user_passwords') IS NOT NULL THEN
    DELETE FROM crm_private.user_passwords WHERE user_id = p_user_id;
  END IF;
END
$fn$;

CREATE OR REPLACE FUNCTION public.crm_account_delete_login(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = crm_private, public
AS $fn$
BEGIN
  PERFORM crm_private.account_delete_login(p_user_id);
END
$fn$;

REVOKE ALL ON FUNCTION crm_private.account_delete_login(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_account_delete_login(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crm_private.account_delete_login(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_account_delete_login(text) TO service_role;

-- Disables one CRM login. The random bcrypt hash is not returned.
-- Clinic rows are not updated.
CREATE OR REPLACE FUNCTION crm_private.account_disable_login(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = crm_private, public, extensions
AS $fn$
DECLARE
  hash_column text;
  junk text;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'missing_user' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'user_not_found' USING ERRCODE = 'P0002';
  END IF;

  junk := crypt(encode(gen_random_bytes(32), 'hex'), gen_salt('bf'));

  SELECT c.column_name INTO hash_column
  FROM information_schema.columns c
  WHERE c.table_schema = 'crm_private'
    AND c.table_name = 'user_passwords'
    AND c.column_name IN ('password_hash', 'password')
  ORDER BY CASE c.column_name WHEN 'password_hash' THEN 0 ELSE 1 END
  LIMIT 1;

  IF hash_column IS NOT NULL THEN
    EXECUTE format(
      'UPDATE crm_private.user_passwords SET %I = $1 WHERE user_id = $2',
      hash_column
    ) USING junk, p_user_id;
  END IF;

  UPDATE public.users
    SET password = junk,
        login_disabled = true
  WHERE id = p_user_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public.crm_account_disable_login(p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = crm_private, public
AS $fn$
BEGIN
  PERFORM crm_private.account_disable_login(p_user_id);
END
$fn$;

REVOKE ALL ON FUNCTION crm_private.account_disable_login(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.crm_account_disable_login(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION crm_private.account_disable_login(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.crm_account_disable_login(text) TO service_role;

CREATE TABLE IF NOT EXISTS crm_private.account_deletion_fk_backup (
  constraint_name text PRIMARY KEY,
  table_name text NOT NULL,
  column_name text NOT NULL,
  delete_action "char" NOT NULL
);

ALTER TABLE crm_private.account_deletion_fk_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE crm_private.account_deletion_fk_backup FROM PUBLIC, anon, authenticated;

DO $fk_users$
DECLARE
  r record;
BEGIN
  IF to_regclass('public.users') IS NULL THEN
    RAISE EXCEPTION 'public.users is missing. Stop.';
  END IF;

  FOR r IN
    SELECT
      rel.relname AS table_name,
      con.conname AS constraint_name,
      att.attname AS column_name,
      att.attnotnull AS not_null,
      con.confdeltype AS delete_action,
      array_length(con.conkey, 1) AS key_count
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'public.users'::regclass
      AND nsp.nspname = 'public'
  LOOP
    IF r.key_count IS DISTINCT FROM 1 OR r.not_null OR r.delete_action::text = 'n' THEN
      RAISE NOTICE 'account deletion: leave %.% (%) unchanged', r.table_name, r.column_name, r.constraint_name;
      CONTINUE;
    END IF;

    INSERT INTO crm_private.account_deletion_fk_backup (constraint_name, table_name, column_name, delete_action)
    VALUES (r.constraint_name, r.table_name, r.column_name, r.delete_action)
    ON CONFLICT (constraint_name) DO NOTHING;

    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) ON DELETE SET NULL',
      r.table_name, r.constraint_name, r.constraint_name, r.column_name
    );
  END LOOP;
END
$fk_users$;

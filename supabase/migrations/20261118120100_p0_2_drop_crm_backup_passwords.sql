-- ============================================================================
-- IRREVERSIBLE — P0-2
-- Delete leftover password copies in crm_backup.
--
-- Drops:
--   crm_backup.user_passwords_final
--   crm_backup.clinic_passwords_final
-- Those rows cannot be restored from this file. Restore the whole database
-- from the backup taken before this migration if they are still needed.
--
-- crm_private.user_passwords is the live hash store. This file does not
-- read it, does not add a policy, and does not grant it to anon or
-- authenticated. RLS stays enabled with no policy (default deny).
--
-- Other crm_backup tables (catalog snapshots) get RLS enabled and no
-- policies. Their rows are not deleted.
-- ============================================================================

REVOKE ALL ON SCHEMA crm_backup FROM PUBLIC, anon, authenticated;

DROP TABLE IF EXISTS crm_backup.user_passwords_final;
DROP TABLE IF EXISTS crm_backup.clinic_passwords_final;

DO $backup_rls$
DECLARE
  r record;
BEGIN
  IF to_regnamespace('crm_backup') IS NULL THEN
    RETURN;
  END IF;
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'crm_backup'
      AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE crm_backup.%I ENABLE ROW LEVEL SECURITY', r.relname);
    EXECUTE format('REVOKE ALL ON TABLE crm_backup.%I FROM PUBLIC, anon, authenticated', r.relname);
  END LOOP;
END
$backup_rls$;

-- Trigger helpers must not be callable as RPCs. Owner execute (needed by
-- triggers) is unchanged. Skip any function that is not installed yet.
DO $revoke_private$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'crm_private'
      AND p.proname IN (
        'users_capture_password',
        'users_role_guard',
        'clinics_password_hash',
        'clinics_billing_guard',
        'to_hash',
        'ext_of',
        'raw_logo'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
  END LOOP;
END
$revoke_private$;

DO $keep_hash_rpc_closed$
BEGIN
  IF to_regprocedure('public.crm_user_password_hash(text)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.crm_user_password_hash(text) FROM PUBLIC, anon, authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.crm_user_password_hash(text) TO service_role';
  END IF;
END
$keep_hash_rpc_closed$;

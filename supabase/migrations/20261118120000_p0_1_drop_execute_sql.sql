-- ============================================================================
-- IRREVERSIBLE — P0-1
-- Drop public.execute_query(text) and public.execute_ddl(text).
--
-- The app does not call these RPCs. They are SECURITY DEFINER and
-- authenticated could run arbitrary SQL, including reads of crm_backup.
--
-- There is no rollback script. Do not recreate these functions.
-- Take a database backup before running. See supabase/ROLLOUT.md.
-- Nothing in this file reads or changes patient rows.
-- ============================================================================

DO $drop_exec$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('execute_query', 'execute_ddl')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('DROP FUNCTION %s', r.sig);
  END LOOP;
END
$drop_exec$;

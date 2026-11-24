-- ============================================================================
-- Rollback for supabase/migrations/20261124180000_account_deletion.sql
-- NOT APPLIED. Run only to undo that migration. This file does not delete
-- patients, appointments, payments, or other clinic rows.
--
-- Foreign keys listed in crm_private.account_deletion_fk_backup are restored
-- to the ON DELETE action they had before the migration (including CASCADE,
-- if that was the previous action). Constraints that were not changed are
-- left alone. Dropping login_disabled removes only that flag.
-- ============================================================================

DROP FUNCTION IF EXISTS public.crm_account_disable_login(text);
DROP FUNCTION IF EXISTS public.crm_account_delete_login(text);
DROP FUNCTION IF EXISTS crm_private.account_disable_login(text);
DROP FUNCTION IF EXISTS crm_private.account_delete_login(text);

ALTER TABLE public.users DROP COLUMN IF EXISTS login_disabled;

DROP TABLE IF EXISTS public.account_deletion_events;
DROP TABLE IF EXISTS public.clinic_deletion_requests;

DO $restore_fks$
DECLARE
  r record;
  action_sql text;
BEGIN
  IF to_regclass('crm_private.account_deletion_fk_backup') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT constraint_name, table_name, column_name, delete_action
    FROM crm_private.account_deletion_fk_backup
  LOOP
    action_sql := CASE r.delete_action::text
      WHEN 'a' THEN 'ON DELETE NO ACTION'
      WHEN 'r' THEN 'ON DELETE RESTRICT'
      WHEN 'c' THEN 'ON DELETE CASCADE'
      WHEN 'n' THEN 'ON DELETE SET NULL'
      WHEN 'd' THEN 'ON DELETE SET DEFAULT'
      ELSE 'ON DELETE NO ACTION'
    END;

    IF to_regclass('public.' || r.table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.users(id) %s',
      r.table_name, r.constraint_name, r.column_name, action_sql
    );
  END LOOP;
END
$restore_fks$;

DROP TABLE IF EXISTS crm_private.account_deletion_fk_backup;

-- ============================================================================
-- IRREVERSIBLE — P0-3a  Lock the published admin login only.
--
-- default_clinic holds real patients. This file does not read or write
-- patients, appointments, payments, treatment plans, x-rays, notes, or leads.
--
-- It replaces the password hash for the single user
--   clinic_id = default_clinic AND username = admin
-- with a random bcrypt hash. The old password stops working. This file does
-- not choose or store a new password. Other staff in that clinic keep their
-- passwords. Other clinics are not updated.
--
-- The old hash cannot be restored from this file. Use the database dump.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $lock_admin$
DECLARE
  hash_column text;
  target_id text;
  updated_count integer;
BEGIN
  IF to_regclass('crm_private.user_passwords') IS NULL THEN
    RAISE EXCEPTION 'crm_private.user_passwords is missing. Stop.';
  END IF;

  SELECT c.column_name INTO hash_column
  FROM information_schema.columns c
  WHERE c.table_schema = 'crm_private'
    AND c.table_name = 'user_passwords'
    AND c.column_name IN ('password_hash', 'password')
  ORDER BY CASE c.column_name WHEN 'password_hash' THEN 0 ELSE 1 END
  LIMIT 1;

  IF hash_column IS NULL THEN
    RAISE EXCEPTION 'crm_private.user_passwords has no password column. Stop and inspect.';
  END IF;

  SELECT u.id INTO target_id
  FROM public.users u
  WHERE lower(u.clinic_id) = 'default_clinic'
    AND lower(u.username) = 'admin'
  LIMIT 1;

  IF target_id IS NULL THEN
    RAISE EXCEPTION 'No default_clinic admin user found. Stop. No rows were changed.';
  END IF;

  EXECUTE format(
    'UPDATE crm_private.user_passwords SET %I = crypt(encode(gen_random_bytes(24), ''hex''), gen_salt(''bf'')) WHERE user_id = $1',
    hash_column
  ) USING target_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'Expected to rotate exactly one password hash, updated %. Stop and restore the dump.', updated_count;
  END IF;
END
$lock_admin$;

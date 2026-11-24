-- Additive: one login per clinic. Does not rewrite or delete user rows.
-- If this fails, two users in the same clinic already share a username;
-- rename the duplicate, then run the statement again.
-- Not applied to production by this change.
-- Rollback: supabase/rollbacks/20261118150000_users_clinic_username_unique_rollback.sql

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_clinic_username
  ON public.users (clinic_id, lower(btrim(username)))
  WHERE username IS NOT NULL AND btrim(username) <> '';

-- Rollback for 20261118150000_users_clinic_username_unique.sql
-- Drops only the new unique index. User rows stay as they are.

DROP INDEX IF EXISTS public.uq_users_clinic_username;

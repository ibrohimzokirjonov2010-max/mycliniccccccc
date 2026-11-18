-- ============================================================================
-- Phase 1 — reversible configuration
-- Pins search_path on update_updated_date_column.
-- Rejects new plaintext passwords shorter than 8 characters.
-- Existing hashes and already-stored short passwords are not rewritten.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.update_updated_date_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  NEW.updated_date = now();
  RETURN NEW;
END
$fn$;

CREATE OR REPLACE FUNCTION crm_private.reject_short_password()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = crm_private, public
AS $fn$
BEGIN
  IF coalesce(NEW.password, '') <> ''
     AND NEW.password !~ '^\$2[aby]\$'
     AND char_length(NEW.password) < 8 THEN
    RAISE EXCEPTION 'password_too_short' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$fn$;

REVOKE ALL ON FUNCTION crm_private.reject_short_password() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS crm_reject_short_password ON public.users;
CREATE TRIGGER crm_reject_short_password
  BEFORE INSERT OR UPDATE OF password ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION crm_private.reject_short_password();

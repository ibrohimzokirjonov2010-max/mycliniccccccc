-- ============================================================================
-- IRREVERSIBLE — P0-3
-- Demo clinics only: default_clinic and store-review-demo.
--
-- 1. Replaces every password hash for users in those clinics with a random
--    bcrypt hash. The published demo password stops working. This file does
--    not contain a replacement password. The owner sets one afterwards,
--    outside git (see supabase/ROLLOUT.md).
-- 2. Rewrites names, phones, addresses, notes, and image fields in those
--    clinics to obvious placeholders. Amounts and row ids stay. Rows are
--    not deleted.
--
-- Other clinics, including ava-dent, are not updated.
-- Original text cannot be rebuilt from this file. Restore the backup taken
-- before this step if a rewritten row was a real patient.
-- A missing optional column is skipped. A missing password column stops
-- the script before any patient text is changed.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION crm_private.demo_has_column(p_table text, p_column text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = crm_private, public
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = p_table
      AND column_name = p_column
  );
$fn$;

DO $demo_people$
DECLARE
  demo_clinics text[] := ARRAY['default_clinic', 'store-review-demo'];
  hash_column text;
  patient_set text := '';
  col text;
  optional_patients text[] := ARRAY[
    'first_name', 'last_name', 'email', 'address', 'city', 'region',
    'notes', 'notes2', 'photo_url', 'telegram_chat_id', 'telegram_username'
  ];
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

  IF to_regclass('public.patients') IS NOT NULL
     AND crm_private.demo_has_column('patients', 'full_name') THEN
    patient_set := 'full_name = ''Demo Bemor '' || lpad(n.rn::text, 2, ''0'')';
    IF crm_private.demo_has_column('patients', 'phone') THEN
      patient_set := patient_set || ', phone = ''+998 90 000 '' || lpad(((n.rn - 1) / 100)::text, 2, ''0'') || '' '' || lpad(((n.rn - 1) % 100)::text, 2, ''0'')';
    END IF;
    FOREACH col IN ARRAY optional_patients LOOP
      IF crm_private.demo_has_column('patients', col) THEN
        patient_set := patient_set || format(
          ', %1$I = %2$s',
          col,
          CASE col
            WHEN 'first_name' THEN '''Demo'''
            WHEN 'last_name' THEN '''Bemor '' || lpad(n.rn::text, 2, ''0'')'
            WHEN 'email' THEN '''demo'' || lpad(n.rn::text, 2, ''0'') || ''@example.test'''
            WHEN 'address' THEN '''Demo manzil'''
            WHEN 'city' THEN '''Demo'''
            WHEN 'region' THEN '''Demo'''
            WHEN 'notes' THEN '''Soxta demo yozuv'''
            ELSE 'NULL'
          END
        );
      END IF;
    END LOOP;
    EXECUTE
      'UPDATE public.patients AS p SET ' || patient_set ||
      ' FROM (SELECT id, row_number() OVER (ORDER BY id) AS rn FROM public.patients WHERE lower(clinic_id) = ANY ($1)) AS n WHERE p.id = n.id'
      USING demo_clinics;
  END IF;

  IF to_regclass('public.users') IS NOT NULL THEN
    UPDATE public.users
    SET
      name = CASE WHEN lower(coalesce(role, '')) IN ('admin', 'owner') THEN 'Demo Admin' ELSE 'Demo Shifokor' END
    WHERE lower(clinic_id) = ANY (demo_clinics);
    IF crm_private.demo_has_column('users', 'full_name') THEN
      UPDATE public.users
      SET full_name = CASE WHEN lower(coalesce(role, '')) IN ('admin', 'owner') THEN 'Demo Admin' ELSE 'Demo Shifokor' END
      WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
    IF crm_private.demo_has_column('users', 'phone') THEN
      UPDATE public.users SET phone = NULL WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
  END IF;

  IF to_regclass('public.appointments') IS NOT NULL
     AND crm_private.demo_has_column('appointments', 'patient_name')
     AND crm_private.demo_has_column('appointments', 'patient_id') THEN
    UPDATE public.appointments AS a
    SET patient_name = COALESCE(p.full_name, 'Demo Bemor')
    FROM public.patients AS p
    WHERE a.patient_id = p.id
      AND lower(a.clinic_id) = ANY (demo_clinics);
    IF crm_private.demo_has_column('appointments', 'patient_phone') THEN
      UPDATE public.appointments AS a
      SET patient_phone = COALESCE(p.phone, '+998 90 000 00 00')
      FROM public.patients AS p
      WHERE a.patient_id = p.id
        AND lower(a.clinic_id) = ANY (demo_clinics);
    END IF;
    IF crm_private.demo_has_column('appointments', 'notes') THEN
      UPDATE public.appointments
      SET notes = 'Soxta demo yozuv'
      WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
    UPDATE public.appointments
    SET patient_name = 'Demo Bemor'
    WHERE lower(clinic_id) = ANY (demo_clinics)
      AND patient_id IS NULL;
  END IF;

  IF to_regclass('public.leads') IS NOT NULL AND crm_private.demo_has_column('leads', 'name') THEN
    UPDATE public.leads AS l
    SET
      name = 'Demo Lid ' || lpad(n.rn::text, 2, '0'),
      phone = CASE WHEN crm_private.demo_has_column('leads', 'phone')
        THEN '+998 90 100 ' || lpad(((n.rn - 1) / 100)::text, 2, '0') || ' ' || lpad(((n.rn - 1) % 100)::text, 2, '0')
        ELSE l.phone END,
      notes = CASE WHEN crm_private.demo_has_column('leads', 'notes') THEN 'Soxta demo yozuv' ELSE l.notes END
    FROM (
      SELECT id, row_number() OVER (ORDER BY id) AS rn
      FROM public.leads
      WHERE lower(clinic_id) = ANY (demo_clinics)
    ) AS n
    WHERE l.id = n.id;
  END IF;

  IF to_regclass('public.payments') IS NOT NULL
     AND crm_private.demo_has_column('payments', 'patient_name')
     AND crm_private.demo_has_column('payments', 'patient_id') THEN
    UPDATE public.payments AS pay
    SET patient_name = COALESCE(p.full_name, 'Demo Bemor')
    FROM public.patients AS p
    WHERE pay.patient_id = p.id
      AND lower(pay.clinic_id) = ANY (demo_clinics);
  END IF;

  IF to_regclass('public.treatment_plans') IS NOT NULL
     AND crm_private.demo_has_column('treatment_plans', 'patient_name')
     AND crm_private.demo_has_column('treatment_plans', 'patient_id') THEN
    UPDATE public.treatment_plans AS tp
    SET patient_name = COALESCE(p.full_name, 'Demo Bemor')
    FROM public.patients AS p
    WHERE tp.patient_id = p.id
      AND lower(tp.clinic_id) = ANY (demo_clinics);
  END IF;

  IF to_regclass('public.implants') IS NOT NULL
     AND crm_private.demo_has_column('implants', 'notes') THEN
    UPDATE public.implants
    SET notes = 'Soxta demo yozuv'
    WHERE lower(clinic_id) = ANY (demo_clinics);
  END IF;
  IF to_regclass('public.implants') IS NOT NULL
     AND crm_private.demo_has_column('implants', 'patient_name')
     AND crm_private.demo_has_column('implants', 'patient_id') THEN
    UPDATE public.implants AS i
    SET patient_name = COALESCE(p.full_name, 'Demo Bemor')
    FROM public.patients AS p
    WHERE i.patient_id = p.id
      AND lower(i.clinic_id) = ANY (demo_clinics);
  END IF;

  IF to_regclass('public.tooth_records') IS NOT NULL
     AND crm_private.demo_has_column('tooth_records', 'notes') THEN
    UPDATE public.tooth_records
    SET notes = 'Soxta demo yozuv'
    WHERE lower(clinic_id) = ANY (demo_clinics);
  END IF;

  IF to_regclass('public.notes') IS NOT NULL THEN
    IF crm_private.demo_has_column('notes', 'content') THEN
      UPDATE public.notes SET content = 'Soxta demo yozuv' WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
    IF crm_private.demo_has_column('notes', 'notes') THEN
      UPDATE public.notes SET notes = 'Soxta demo yozuv' WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
  END IF;

  IF to_regclass('public.xrays') IS NOT NULL THEN
    IF crm_private.demo_has_column('xrays', 'image_url') THEN
      UPDATE public.xrays SET image_url = 'demo://no-image' WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
    IF crm_private.demo_has_column('xrays', 'patient_name') THEN
      UPDATE public.xrays SET patient_name = 'Demo Bemor' WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
    IF crm_private.demo_has_column('xrays', 'description') THEN
      UPDATE public.xrays SET description = 'Soxta demo yozuv' WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
    IF crm_private.demo_has_column('xrays', 'findings') THEN
      UPDATE public.xrays SET findings = NULL WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
    IF crm_private.demo_has_column('xrays', 'diagnosis') THEN
      UPDATE public.xrays SET diagnosis = NULL WHERE lower(clinic_id) = ANY (demo_clinics);
    END IF;
  END IF;

  -- Last, so a staff-name update cannot put the old hash back.
  EXECUTE format(
    $sql$
      UPDATE crm_private.user_passwords AS vault
      SET %1$I = crypt(encode(gen_random_bytes(24), 'hex'), gen_salt('bf'))
      WHERE vault.user_id IN (
        SELECT u.id FROM public.users u WHERE lower(u.clinic_id) = ANY ($1)
      )
    $sql$,
    hash_column
  ) USING demo_clinics;
END
$demo_people$;

DROP FUNCTION IF EXISTS crm_private.demo_has_column(text, text);

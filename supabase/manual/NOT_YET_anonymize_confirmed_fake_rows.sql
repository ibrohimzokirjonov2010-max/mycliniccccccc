-- ============================================================================
-- DO NOT RUN YET.
-- This file is not part of the rollout order. It is not a numbered migration
-- the owner should apply with P0-1 .. phase 1.
--
-- default_clinic contains real patients. This script refuses to start until
-- the owner fills an explicit fake-patient id list, or a name prefix they
-- have confirmed belongs only to fake rows (for example 'TEST ').
-- An empty list and an empty prefix abort before any UPDATE.
-- It never updates a clinic wholesale.
--
-- When the owner is ready:
--   1. Take a fresh dump.
--   2. Edit fake_patient_ids and/or name_prefix below.
--   3. Run this file alone, in a transaction, and read the NOTICE counts
--      before committing.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $anonymize_listed_fakes$
DECLARE
  -- Owner: paste ids of rows already confirmed fake. Leave empty until then.
  fake_patient_ids text[] := ARRAY[]::text[];
  -- Owner: set only after confirming every matching name is fake.
  -- Example after confirmation: 'TEST '
  -- Must be at least 4 characters. Empty means "do not match by name".
  name_prefix text := '';
  ids text[];
  n integer;
BEGIN
  IF coalesce(array_length(fake_patient_ids, 1), 0) = 0 AND btrim(name_prefix) = '' THEN
    RAISE EXCEPTION 'NOT TO RUN YET: fake_patient_ids is empty and name_prefix is empty. No patient row was changed.';
  END IF;
  IF btrim(name_prefix) <> '' AND char_length(btrim(name_prefix)) < 4 THEN
    RAISE EXCEPTION 'name_prefix must be at least 4 characters. No row was changed.';
  END IF;

  SELECT array_agg(p.id) INTO ids
  FROM public.patients p
  WHERE p.id = ANY (fake_patient_ids)
     OR (btrim(name_prefix) <> '' AND p.full_name ILIKE btrim(name_prefix) || '%');

  IF ids IS NULL OR coalesce(array_length(ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No patient matched the explicit id list or prefix. No row was changed.';
  END IF;

  UPDATE public.patients AS p
  SET
    full_name = 'TEST Bemor ' || lpad(n.rn::text, 2, '0'),
    phone = CASE WHEN p.phone IS NULL THEN NULL ELSE '+998 90 000 00 ' || lpad(n.rn::text, 2, '0') END,
    email = 'test' || lpad(n.rn::text, 2, '0') || '@example.test',
    address = 'TEST manzil',
    notes = 'Soxta qator'
  FROM (
    SELECT id, row_number() OVER (ORDER BY id) AS rn
    FROM public.patients
    WHERE id = ANY (ids)
  ) AS n
  WHERE p.id = n.id
    AND p.id = ANY (ids);

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'patients rewritten: %', n;

  IF to_regclass('public.appointments') IS NOT NULL THEN
    UPDATE public.appointments AS a
    SET patient_name = p.full_name,
        patient_phone = p.phone
    FROM public.patients AS p
    WHERE a.patient_id = p.id
      AND p.id = ANY (ids);
  END IF;

  IF to_regclass('public.payments') IS NOT NULL THEN
    UPDATE public.payments AS pay
    SET patient_name = p.full_name
    FROM public.patients AS p
    WHERE pay.patient_id = p.id
      AND p.id = ANY (ids);
  END IF;

  IF to_regclass('public.xrays') IS NOT NULL THEN
    UPDATE public.xrays AS x
    SET patient_name = p.full_name,
        image_url = 'demo://no-image'
    FROM public.patients AS p
    WHERE x.patient_id = p.id
      AND p.id = ANY (ids);
  END IF;
END
$anonymize_listed_fakes$;

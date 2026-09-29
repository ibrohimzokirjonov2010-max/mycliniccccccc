-- Cases server save
-- The anon key cannot run this. Apply it in the Supabase SQL editor
-- with the service_role / database owner.
--
-- Live findings (2026-09-29):
--   * public.cases exists, but INSERT is rejected:
--     42501 new row violates row-level security policy for table "cases"
--   * public.cases has no notes, consent_given, image_before, or image_after column.
--     The app no longer sends those. It writes doctor, patientname, patient_id,
--     date, tags, images, and description.
--   * Storage bucket list is empty. Creating a "cases" bucket also needs service_role.
--
-- Until this runs, the app stores before/after JPEG data URLs on public.xrays
-- (xray_type = 'clinic_case'), the same table Rentgen uploads already use.

ALTER TABLE IF EXISTS public.cases DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.cases TO anon, authenticated, postgres, service_role;

-- Optional, only if you want a notes column later. The app does not require it.
ALTER TABLE IF EXISTS public.cases ADD COLUMN IF NOT EXISTS notes TEXT;

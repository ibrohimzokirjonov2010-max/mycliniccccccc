-- payments updates failed with:
--   record "new" has no field "updated_date"
-- The shared BEFORE UPDATE trigger writes NEW.updated_date, but payments
-- never had that column. Add it, and skip the assignment on tables that
-- still do not have the column.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS updated_date timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.update_updated_date_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_jsonb(NEW) ? 'updated_date' THEN
    NEW.updated_date = now();
  END IF;
  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';

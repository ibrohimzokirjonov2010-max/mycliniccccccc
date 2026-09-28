-- Clinical implant passport fields. Safe to re-run.
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS lot_number TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS torque TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS isq TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS bone_type TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS brend TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS diameter TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS length TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS firma TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS firma_custom TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS doctor TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS loading_protocol TEXT;
ALTER TABLE public.implants ADD COLUMN IF NOT EXISTS tooth_data JSONB DEFAULT '{}'::jsonb;

-- Leads jadvaliga form_data ustunini qo'shish
-- Bu ustun Instagram/Facebook reklamalaridan kelgan savol-javoblarni saqlaydi
-- Supabase Dashboard > SQL Editor da ishlating

ALTER TABLE leads ADD COLUMN IF NOT EXISTS form_data jsonb DEFAULT '{}'::jsonb;

-- Supabase schema cache ni yangilash uchun PostgREST ni reload qilish kerak
-- Dashboard > Settings > API > "Reload schema cache" tugmasini bosing
NOTIFY pgrst, 'reload schema';

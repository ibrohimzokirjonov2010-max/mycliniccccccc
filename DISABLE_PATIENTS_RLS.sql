-- ============================================================
-- 1. OPEN A NEW TAB IN SUPABASE SQL EDITOR (Click the '+' button next to 'Untitled query')
-- 2. Paste ONLY this code
-- 3. Click 'Run'
-- ============================================================

-- Force disable RLS on patients table
ALTER TABLE public.patients DISABLE ROW LEVEL SECURITY;

-- Confirm RLS status (should return 'f' for rowsecurity)
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND tablename = 'patients';

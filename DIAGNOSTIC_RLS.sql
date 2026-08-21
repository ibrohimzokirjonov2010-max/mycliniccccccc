-- ============================================================
-- 1. OPEN A NEW TAB IN SUPABASE SQL EDITOR (Click the '+' button)
-- 2. Paste ONLY this code
-- 3. Click 'Run'
-- ============================================================

-- Create a temporary diagnostic function to check RLS status
CREATE OR REPLACE FUNCTION public.check_rls_status()
RETURNS TABLE (t_name text, rls_enabled boolean, policy_count bigint) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.relname::text as t_name,
    c.relrowsecurity as rls_enabled,
    (SELECT count(*) FROM pg_policy p WHERE p.polrelid = c.oid) as policy_count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
  ORDER BY c.relname;
END;
$$ LANGUAGE plpgsql;

-- Run it right here to see results in SQL Editor
SELECT * FROM public.check_rls_status();

-- ============================================================
-- 1. OPEN A NEW TAB IN SUPABASE SQL EDITOR
-- 2. Paste ONLY this code
-- 3. Click 'Run'
-- ============================================================

-- Helper 1: For executing SELECT queries and returning JSON
CREATE OR REPLACE FUNCTION public.execute_query(query_text text)
RETURNS json SECURITY DEFINER AS $$
DECLARE
  result json;
BEGIN
  EXECUTE 'SELECT json_agg(t) FROM (' || query_text || ') t' INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Helper 2: For executing DDL/commands like ALTER TABLE directly
CREATE OR REPLACE FUNCTION public.execute_ddl(sql_text text)
RETURNS void SECURITY DEFINER AS $$
BEGIN
  EXECUTE sql_text;
END;
$$ LANGUAGE plpgsql;

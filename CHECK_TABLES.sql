-- 1-qadam: Barcha jadvallar nomini ko'rish
-- Buni Supabase SQL Editor'da ishlatib tekshiring:
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- RUN THIS IN SUPABASE SQL EDITOR TO FIX ALL PERSISTENCE ISSUES PERMANENTLY

-- 1. Fix Payments Table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS doctor_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_date TIMESTAMP WITH TIME ZONE;

-- 2. Fix Users Table (Staff)
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS commission_rate DECIMAL(5,2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 3. Additional Tech Fields for enrichment
ALTER TABLE leads ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE implants ADD COLUMN IF NOT EXISTS notes TEXT;

-- Verify columns
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_name IN ('payments', 'users') 
ORDER BY table_name;

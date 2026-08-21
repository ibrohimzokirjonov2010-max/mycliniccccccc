-- RUN THIS IN SUPABASE SQL EDITOR TO FIX RECALL TABLE PERMANENTLY
-- If the table doesn't exist, this will create it with all necessary columns.

CREATE TABLE IF NOT EXISTS recalls (
    id TEXT PRIMARY KEY,
    clinic_id TEXT NOT NULL,
    patient_id TEXT,
    patient_name TEXT,
    patient_phone TEXT,
    type TEXT,
    type_label TEXT,
    recall_date DATE,
    notes TEXT,
    status TEXT DEFAULT 'Pending',
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_date TIMESTAMP WITH TIME ZONE,
    completed_date TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE recalls ENABLE ROW LEVEL SECURITY;

-- Policy for all users (Simplified for this app's context)
CREATE POLICY "Allow all actions for clinic users" ON recalls
    FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- CREATE ADVERTISEMENTS TABLE
-- Reklamalar jadvalini yaratish
-- ============================================

CREATE TABLE IF NOT EXISTS advertisements (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    link_url TEXT,
    cta_text TEXT,
    enabled BOOLEAN DEFAULT true,
    start_time TEXT, -- HH:MM format
    end_time TEXT,   -- HH:MM format
    clicks INTEGER DEFAULT 0,
    impressions INTEGER DEFAULT 0,
    created_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS o'chirish (SaaS superadmin uchun qulaylik)
ALTER TABLE advertisements DISABLE ROW LEVEL SECURITY;

-- Tekshirish
DO $$
BEGIN
  RAISE NOTICE '✅ Advertisements jadvali muvaffaqiyatli yaratildi!';
END $$;

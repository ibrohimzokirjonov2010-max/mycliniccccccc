-- ============================================================================
-- My Clinic: Click billing hardening (13.10.2026)
-- 20261004_clinic_payment_methods.sql dan KEYIN, Supabase SQL Editor'da bir marta ishga tushiriladi.
-- Idempotent: qayta ishga tushirish xavfsiz.
-- Barcha yangi jadvallar faqat service-role orqali (RLS yoqilgan, policy yo'q).
-- ============================================================================

-- 1) Urinishlarni hisob davriga (billing period) bog'lash -----------------------
ALTER TABLE clinic_payment_charges ADD COLUMN IF NOT EXISTS period_start DATE;
UPDATE clinic_payment_charges SET period_start = attempt_date WHERE period_start IS NULL;
ALTER TABLE clinic_payment_charges ALTER COLUMN period_start SET NOT NULL;
ALTER TABLE clinic_payment_charges ADD COLUMN IF NOT EXISTS reconciled_at TIMESTAMPTZ;
ALTER TABLE clinic_payment_charges ADD COLUMN IF NOT EXISTS click_payment_status INTEGER;

-- Bir davr uchun faqat BITTA muvaffaqiyatli yechish (ikki marta yechishdan DB darajasida himoya).
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpc_clinic_period_success
  ON clinic_payment_charges (clinic_id, period_start) WHERE status = 'success';
-- Bir davrda bir vaqtda faqat bitta ochiq (pending/unknown) urinish.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpc_clinic_period_open
  ON clinic_payment_charges (clinic_id, period_start) WHERE status IN ('pending', 'unknown');
CREATE INDEX IF NOT EXISTS idx_cpc_period ON clinic_payment_charges (clinic_id, period_start);
CREATE INDEX IF NOT EXISTS idx_cpc_open ON clinic_payment_charges (status, created_at) WHERE status IN ('pending', 'unknown');

-- 2) Bardoshli tezlik cheklovi ---------------------------------------------------
CREATE TABLE IF NOT EXISTS api_rate_limits (
  key          TEXT NOT NULL,          -- sha256(path|ip)
  window_start TIMESTAMPTZ NOT NULL,
  hits         INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
CREATE INDEX IF NOT EXISTS idx_arl_window ON api_rate_limits (window_start);

CREATE OR REPLACE FUNCTION rate_limit_hit(p_key TEXT, p_window_seconds INTEGER, p_limit INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  n INTEGER;
BEGIN
  INSERT INTO api_rate_limits AS r (key, window_start, hits) VALUES (p_key, w, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = r.hits + 1
  RETURNING hits INTO n;
  -- Eski oynalarni vaqti-vaqti bilan tozalash (~1% chaqiruvlarda).
  IF random() < 0.01 THEN
    DELETE FROM api_rate_limits WHERE window_start < now() - interval '1 day';
  END IF;
  RETURN n <= p_limit;
END;
$$;
REVOKE ALL ON FUNCTION rate_limit_hit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

-- 3) Bir martalik ro'yxatdan o'tish tokenlari -------------------------------------
CREATE TABLE IF NOT EXISTS registration_token_uses (
  jti        TEXT PRIMARY KEY,
  clinic_id  TEXT NOT NULL,
  used_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 4) Billing ledger (clinics.logo [EXT].payment_ledger o'rniga; eski ma'lumot o'qilishda qoladi) ---
CREATE TABLE IF NOT EXISTS billing_ledger (
  id                  TEXT PRIMARY KEY,
  clinic_id           TEXT NOT NULL,
  charge_id           UUID REFERENCES clinic_payment_charges(id) ON DELETE SET NULL,
  paid_at             DATE NOT NULL,
  amount_uzs          INTEGER NOT NULL,
  method              TEXT NOT NULL,
  status              TEXT NOT NULL,
  subscription_status TEXT,
  order_id            TEXT,
  note                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_bl_clinic ON billing_ledger (clinic_id, created_at DESC);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE registration_token_uses ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON api_rate_limits FROM anon, authenticated;
REVOKE ALL ON registration_token_uses FROM anon, authenticated;
REVOKE ALL ON billing_ledger FROM anon, authenticated;

-- ============================================================================
-- My Clinic: platforma obuna to'lovlari (Click / Payme / avto-yechish / qo'lda)
-- DIQQAT: `payments` jadvali allaqachon bor (klinika ichidagi BEMOR to'lovlari),
-- shuning uchun obuna to'lovlari alohida `subscription_payments` jadvalida.
-- Faqat service-role (Vercel serverless) o'qiydi/yozadi: RLS yoqilgan, policy yo'q.
-- ============================================================================
CREATE TABLE IF NOT EXISTS subscription_payments (
  id               BIGSERIAL PRIMARY KEY,
  clinic_id        TEXT NOT NULL,
  amount           INTEGER NOT NULL,               -- so'm
  months           INTEGER NOT NULL DEFAULT 1,
  provider         TEXT NOT NULL CHECK (provider IN ('click', 'payme', 'click_card', 'manual')),
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'cancelled', 'unknown')),
  provider_txn_id  TEXT,                           -- click_trans_id / payme transaction id / click payment_id
  state            INTEGER,                        -- Payme holati: 1, 2, -1, -2
  create_time      BIGINT,                         -- Payme (ms)
  perform_time     BIGINT,
  cancel_time      BIGINT,
  reason           INTEGER,
  note             TEXT,
  paid_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sp_provider_txn ON subscription_payments (provider, provider_txn_id) WHERE provider_txn_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sp_clinic ON subscription_payments (clinic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sp_status_paid ON subscription_payments (status, paid_at);
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON subscription_payments FROM anon, authenticated;

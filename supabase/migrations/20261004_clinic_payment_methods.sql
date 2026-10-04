-- ============================================================================
-- My Clinic: 14 kunlik sinov uchun karta biriktirish (Click Card Token)
-- FOYDALANUVCHI TASDIQLAGACH Supabase SQL Editor'da ishga tushiriladi.
-- Karta raqami / CVV bu jadvallarda SAQLANMAYDI: faqat Click tokeni, maskalangan raqam va rozilik.
-- Jadvallar faqat service-role (Vercel serverless funksiyalari) orqali o'qiladi/yoziladi:
-- RLS yoqilgan va hech qanday policy yo'q => anon/authenticated kalitlar bilan KIRISH MUMKIN EMAS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS clinic_payment_methods (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id       TEXT NOT NULL,
  provider        TEXT NOT NULL DEFAULT 'click',
  card_token      TEXT NOT NULL,                 -- Click card_token (maxfiy: faqat server o'qiydi)
  masked_pan      TEXT,                          -- masalan "8600 55** **** 3244"
  expiry          TEXT,                          -- "MM/YY"
  consent_at      TIMESTAMPTZ NOT NULL,          -- avtomatik yechishga rozilik vaqti (server vaqti)
  consent_version TEXT NOT NULL,                 -- rozilik matni/oferta versiyasi
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'removed', 'failed')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bitta klinikada bitta faol karta; bitta token bitta klinikaga.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpm_clinic_active ON clinic_payment_methods (clinic_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpm_card_token ON clinic_payment_methods (card_token);
CREATE INDEX IF NOT EXISTS idx_cpm_clinic ON clinic_payment_methods (clinic_id);

CREATE TABLE IF NOT EXISTS clinic_payment_charges (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id             TEXT NOT NULL,
  payment_method_id     UUID REFERENCES clinic_payment_methods(id) ON DELETE SET NULL,
  amount                INTEGER NOT NULL,        -- so'm
  currency              TEXT NOT NULL DEFAULT 'UZS',
  status                TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed', 'unknown')),
  attempt_date          DATE NOT NULL,           -- Asia/Tashkent kuni
  attempt_no            INTEGER NOT NULL DEFAULT 1,
  transaction_parameter TEXT NOT NULL,
  click_payment_id      TEXT,
  click_error_code      INTEGER,
  click_error_note      TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ikki marta yechishdan himoya: bir kunda bir klinika uchun bitta urinish, tranzaksiya parametri noyob.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpc_clinic_day ON clinic_payment_charges (clinic_id, attempt_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cpc_tx ON clinic_payment_charges (transaction_parameter);
CREATE INDEX IF NOT EXISTS idx_cpc_clinic ON clinic_payment_charges (clinic_id, created_at DESC);

ALTER TABLE clinic_payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinic_payment_charges ENABLE ROW LEVEL SECURITY;
-- Policy ATAYLAB yozilmagan. Qo'shimcha ehtiyot uchun jamoat rollaridan huquqlar olinadi:
REVOKE ALL ON clinic_payment_methods FROM anon, authenticated;
REVOKE ALL ON clinic_payment_charges FROM anon, authenticated;

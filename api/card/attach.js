import { clickConfig } from '../_lib/click.js';
import { decodeExt } from '../_lib/clinicExt.js';
import { bodyOf, guard, send } from '../_lib/http.js';
import { planPrice } from '../_lib/plans.js';
import { verifyProof } from '../_lib/proof.js';
import { supabaseAdmin } from '../_lib/supabaseAdmin.js';

const FRESH_CLINIC_MS = 60 * 60 * 1000;

/**
 * POST /api/card/attach { clinic_id, proof, consent: true, consent_version }
 * Klinika yaratilgach chaqiriladi: tasdiqlangan karta tokenini clinic_payment_methods'ga yozadi.
 * Saqlanadi: card_token, maskalangan raqam, amal qilish muddati, rozilik vaqti (server vaqti) va versiyasi.
 * Karta raqami/CVV bu yerga umuman kelmaydi.
 */
export default async function handler(req, res) {
  if (!guard(req, res, { limit: 10 })) return;
  const body = bodyOf(req);
  const clinicId = String(body.clinic_id || '').trim().toLowerCase();
  const consentVersion = String(body.consent_version || '').trim();
  if (!clinicId) return send(res, 400, { ok: false, error: 'invalid_clinic' });
  if (body.consent !== true) return send(res, 400, { ok: false, error: 'consent_required' });
  if (!/^[\w.-]{1,40}$/.test(consentVersion)) return send(res, 400, { ok: false, error: 'invalid_consent_version' });

  const proof = verifyProof(body.proof);
  if (!proof) return send(res, 400, { ok: false, error: 'invalid_or_expired_proof' });

  const cfg = clickConfig();
  if (!cfg.configured) {
    // TEST REJIM: hech narsa saqlanmaydi.
    return send(res, 200, { ok: true, mode: 'mock', masked_pan: proof.mp, expiry: proof.ex, stored: false });
  }
  if (proof.mock) return send(res, 400, { ok: false, error: 'invalid_or_expired_proof' });

  const sb = supabaseAdmin();
  if (!sb) return send(res, 503, { ok: false, error: 'server_not_configured' });

  try {
    const { data: clinic, error: cErr } = await sb.from('clinics').select('id,created_at,logo,plan,expires_at').eq('id', clinicId).maybeSingle();
    if (cErr || !clinic) return send(res, 404, { ok: false, error: 'clinic_not_found' });
    const { ext } = decodeExt(clinic.logo);
    const fresh = Date.now() - new Date(clinic.created_at).getTime() < FRESH_CLINIC_MS;
    if (!fresh || ext.subscription_status !== 'trialing') return send(res, 409, { ok: false, error: 'clinic_not_eligible' });

    const { data: existing } = await sb.from('clinic_payment_methods').select('id').eq('clinic_id', clinicId).eq('status', 'active').limit(1);
    if (existing && existing.length > 0) return send(res, 409, { ok: false, error: 'already_attached' });

    const { error: iErr } = await sb.from('clinic_payment_methods').insert({
      clinic_id: clinicId,
      provider: 'click',
      card_token: proof.ct,
      masked_pan: proof.mp,
      expiry: proof.ex,
      consent_at: new Date().toISOString(),
      consent_version: consentVersion,
      status: 'active',
    });
    if (iErr) return send(res, iErr.code === '23505' ? 409 : 500, { ok: false, error: iErr.code === '23505' ? 'already_attached' : 'db_error' });

    return send(res, 200, {
      ok: true,
      mode: 'live',
      masked_pan: proof.mp,
      expiry: proof.ex,
      amount: planPrice(ext.tariff || clinic.plan),
      first_charge_date: ext.trial_ends_at || clinic.expires_at || null,
    });
  } catch {
    return send(res, 500, { ok: false, error: 'server_error' });
  }
}

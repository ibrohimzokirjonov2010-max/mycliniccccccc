import { supabase } from '@/api/supabaseClient';

const EXPIRY_CACHE = new Map();
const SUPPORT_URL = 'https://t.me/dentist_shaxin';
const SUPPORT_PHONE = '+998901234567';

export function supportContacts() {
  return { url: SUPPORT_URL, phone: SUPPORT_PHONE };
}

export function expiryEnd(expiresAt) {
  if (!expiresAt) return null;
  const match = String(expiresAt).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) {
    const parsed = new Date(expiresAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
}

export function isClinicExpired(expiresAt, now = new Date()) {
  const end = expiryEnd(expiresAt);
  if (!end) return false;
  return now.getTime() > end.getTime();
}

export function daysUntilExpiry(expiresAt, now = new Date()) {
  const end = expiryEnd(expiresAt);
  if (!end) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const expiryDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.round((expiryDay.getTime() - today.getTime()) / 86400000);
}

export function formatExpiryDate(expiresAt) {
  const end = expiryEnd(expiresAt);
  if (!end) return '';
  const day = String(end.getDate()).padStart(2, '0');
  const month = String(end.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${end.getFullYear()}`;
}

export function todayStamp(now = new Date()) {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function reminderStorageKey(clinicId) {
  return `tariff_reminder_${clinicId}`;
}

export function shouldShowTariffReminder(clinic, now = new Date()) {
  if (!clinic?.id || isClinicExpired(clinic.expires_at, now)) return false;
  const days = daysUntilExpiry(clinic.expires_at, now);
  if (days == null || days < 0 || days > 7) return false;
  return localStorage.getItem(reminderStorageKey(clinic.id)) !== todayStamp(now);
}

export function markTariffReminderShown(clinicId, now = new Date()) {
  if (!clinicId) return;
  localStorage.setItem(reminderStorageKey(clinicId), todayStamp(now));
}

export function clinicAccessClosed(clinic, now = new Date()) {
  if (!clinic) return false;
  const status = String(clinic.status || '');
  if (status === 'Inactive' || status === 'Blocked') return true;
  return isClinicExpired(clinic.expires_at, now);
}

export function invalidateClinicExpiry(clinicId) {
  if (clinicId) EXPIRY_CACHE.delete(String(clinicId).toLowerCase());
  else EXPIRY_CACHE.clear();
}

export async function loadClinicAccess(clinicId) {
  const id = String(clinicId || '').trim();
  if (!id) return { clinic: null, missing: true };
  const key = id.toLowerCase();
  const hit = EXPIRY_CACHE.get(key);
  if (hit && Date.now() - hit.at < 5000) return { clinic: hit.clinic };
  const { data, error } = await supabase
    .from('clinics')
    .select('id,name,plan,status,expires_at,monthly_fee')
    .eq('id', id)
    .maybeSingle();
  if (error) return { clinic: null, error };
  if (!data) return { clinic: null, missing: true };
  EXPIRY_CACHE.set(key, { clinic: data, at: Date.now() });
  return { clinic: data };
}

export async function assertClinicNotExpired() {
  if (typeof window === 'undefined') return;
  const path = window.location.pathname || '';
  if (path.startsWith('/login') || path.startsWith('/super-admin')) return;
  if (localStorage.getItem('is_authenticated') !== 'true') return;
  if (localStorage.getItem('is_super_admin') === 'true' && path.startsWith('/super-admin')) return;
  const id = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || '';
  if (!id) return;
  const { clinic, error, missing } = await loadClinicAccess(id);
  if (error || missing || !clinic) return;
  if (!clinicAccessClosed(clinic)) return;
  window.dispatchEvent(new CustomEvent('shifo:tariff-expired', { detail: { clinic } }));
  const denied = new Error("Tarif muddati tugagan");
  denied.code = 402;
  throw denied;
}

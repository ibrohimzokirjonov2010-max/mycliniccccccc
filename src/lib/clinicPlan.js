import { supabase } from '@/api/supabaseClient';
import { assertClinicNotExpired } from '@/lib/clinicExpiry';

export const CLINIC_SESSION_EVENT = 'shifo:clinic-session';

const BASIC_FEATURES = [
  'patients', 'appointments', 'payments', 'recalls', 'settings',
  'services', 'treatment_plans', 'debts',
];

const PRO_FEATURES = [
  ...BASIC_FEATURES,
  'leads', 'expenses', 'payroll', 'inventory', 'reports',
  'no_show', 'treatment_tracking', 'technicians', 'staff',
  'implants', 'marketing', 'cases', 'doctor_accounts',
];

export const PLAN_FEATURES = {
  basic: BASIC_FEATURES,
  pro: PRO_FEATURES,
  premium: PRO_FEATURES,
};

export const FEATURE_LABELS = {
  patients: 'Bemorlar',
  appointments: 'Uchrashuvlar',
  payments: "To'lovlar",
  recalls: 'Eslatmalar',
  leads: 'Lidlar',
  settings: 'Sozlamalar',
  expenses: 'Xarajatlar',
  payroll: 'Ish haqi',
  services: 'Xizmatlar',
  inventory: 'Ombor',
  reports: 'Hisobotlar',
  treatment_plans: 'Davolash rejalari',
  no_show: 'Kelgan emas',
  treatment_tracking: 'Davolash kuzatuvi',
  debts: 'Qarzlar',
  technicians: 'Laboratoriya',
  staff: 'Xodimlar',
  implants: 'Implantlar',
  marketing: 'Marketing',
  cases: 'Mening keyslarim',
  doctor_accounts: 'Shifokor hisobi',
};

export const PRO_EXTRA_LABELS = [
  'Implantlar va PDF pasport',
  'Xodimlar, ish haqi, xarajatlar',
  'Ombor va hisobotlar',
  'Lidlar, kelmaganlar, kuzatuv',
  'Marketing va Mening keyslarim',
  'Shifokor uchun alohida kirish',
];

export const PATH_FEATURES = {
  '/implants': 'implants',
  '/marketing': 'marketing',
  '/cases': 'cases',
  '/technicians': 'technicians',
  '/expenses': 'expenses',
  '/payroll': 'payroll',
  '/inventory': 'inventory',
  '/reports': 'reports',
  '/no-show': 'no_show',
  '/treatment-tracking': 'treatment_tracking',
  '/staff': 'staff',
  '/leads': 'leads',
};

const SERVER_PLAN_CACHE = new Map();

export function normalizePlan(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'premium' || raw === 'klinika') return 'premium';
  if (raw === 'pro') return 'pro';
  if (raw === 'basic' || raw === 'start') return 'basic';
  return '';
}

export function decodeClinicExtras(clinic) {
  if (!clinic || typeof clinic.logo !== 'string' || !clinic.logo.startsWith('[EXT]')) return clinic;
  const end = clinic.logo.indexOf('[/EXT]');
  if (end < 5) return clinic;
  try {
    const extra = JSON.parse(clinic.logo.slice(5, end));
    return { ...clinic, ...extra };
  } catch {
    return clinic;
  }
}

/** Tariff in the logo wins when the plan column cannot store PREMIUM. */
export function resolveClinicPlan(clinic) {
  const decoded = decodeClinicExtras(clinic);
  const tariff = normalizePlan(decoded?.tariff);
  const column = normalizePlan(decoded?.plan);
  if (tariff) return tariff;
  if (column) return column;
  const id = String(decoded?.id || clinic?.id || '').trim().toLowerCase();
  if (id === 'default_clinic') return 'premium';
  if (id === 'ava-dent') return 'pro';
  return 'basic';
}

export function planAllows(plan, feature) {
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.basic;
  return features.includes(feature);
}

export function planRequiredFor(feature) {
  if (planAllows('basic', feature)) return 'basic';
  if (planAllows('pro', feature)) return 'pro';
  return 'premium';
}

export function isPathLocked(plan, path) {
  const feature = PATH_FEATURES[path];
  if (!feature) return false;
  return !planAllows(plan, feature);
}

export function readClinicPlan() {
  return normalizePlan(localStorage.getItem('clinic_plan')) || 'basic';
}

export function subscribeClinicPlan(listener) {
  const handler = () => listener(readClinicPlan());
  window.addEventListener(CLINIC_SESSION_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(CLINIC_SESSION_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function clearClinicSessionCache() {
  localStorage.removeItem('clinic_settings');
  localStorage.removeItem('clinic_plan');
  window.dispatchEvent(new CustomEvent(CLINIC_SESSION_EVENT, { detail: { clinic: null, plan: 'basic' } }));
}

export function applyClinicSession(clinic) {
  if (!clinic?.id) return 'basic';
  const plan = resolveClinicPlan(clinic);
  SERVER_PLAN_CACHE.set(String(clinic.id).toLowerCase(), { plan, at: Date.now() });
  localStorage.setItem('clinic_id', clinic.id);
  localStorage.setItem('current_clinic_id', clinic.id);
  localStorage.setItem('clinic_plan', plan);
  try {
    const previous = JSON.parse(localStorage.getItem('clinic_settings') || '{}');
    const sameClinic = previous?.id && String(previous.id).toLowerCase() === String(clinic.id).toLowerCase();
    localStorage.setItem('clinic_settings', JSON.stringify({
      id: clinic.id,
      name: clinic.name || '',
      phone: clinic.phone || '',
      address: clinic.address || '',
      logo: sameClinic ? (clinic.logo || previous.logo || null) : (clinic.logo || null),
      subtitle: clinic.subtitle || '',
      plan,
      monthly_fee: clinic.monthly_fee,
      expires_at: clinic.expires_at || '',
    }));
  } catch { /* ignore quota */ }
  window.dispatchEvent(new CustomEvent(CLINIC_SESSION_EVENT, { detail: { clinic, plan } }));
  return plan;
}

export async function fetchServerPlan(clinicId) {
  const id = String(clinicId || localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || '').trim();
  if (!id) return 'basic';
  const key = id.toLowerCase();
  const hit = SERVER_PLAN_CACHE.get(key);
  if (hit && Date.now() - hit.at < 15000) return hit.plan;

  const { data, error } = await supabase.from('clinics').select('id,plan,logo').eq('id', id).maybeSingle();
  let plan = 'basic';
  if (!error && data) plan = resolveClinicPlan(data);
  else if (key === 'default_clinic') plan = 'premium';
  else if (key === 'ava-dent') plan = 'pro';
  SERVER_PLAN_CACHE.set(key, { plan, at: Date.now() });

  const current = localStorage.getItem('clinic_plan');
  if (current !== plan) {
    localStorage.setItem('clinic_plan', plan);
    window.dispatchEvent(new CustomEvent(CLINIC_SESSION_EVENT, { detail: { plan } }));
  }
  return plan;
}

export async function assertServerFeature(feature) {
  await assertClinicNotExpired();
  const plan = await fetchServerPlan();
  if (!planAllows(plan, feature)) {
    const needed = planRequiredFor(feature) === 'premium' ? 'PREMIUM' : 'PRO';
    const error = new Error(`Bu moduldan foydalanish uchun ${needed} ta'rifiga o'ting!`);
    error.code = 403;
    throw error;
  }
  return plan;
}

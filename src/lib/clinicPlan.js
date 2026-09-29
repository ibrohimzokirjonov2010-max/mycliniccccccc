import { supabase } from '@/api/supabaseClient';

/** Hand-created clinics with no plan stay BASIC. These two already-live clinics stay PRO without a database write. */
export const PROTECTED_PRO_CLINIC_IDS = new Set(['default_clinic', 'ava-dent']);

export const CLINIC_SESSION_EVENT = 'shifo:clinic-session';

export const PLAN_FEATURES = {
  basic: [
    'patients', 'appointments', 'payments', 'recalls', 'leads', 'settings',
    'expenses', 'payroll', 'services', 'inventory', 'reports', 'treatment_plans',
    'no_show', 'treatment_tracking', 'debts', 'technicians', 'staff',
  ],
  pro: [
    'patients', 'appointments', 'payments', 'recalls', 'leads', 'settings',
    'expenses', 'payroll', 'services', 'inventory', 'reports', 'treatment_plans',
    'no_show', 'treatment_tracking', 'debts', 'technicians', 'staff',
    'implants', 'marketing', 'cases',
  ],
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
  cases: 'Mening Keyslarim',
};

export const PRO_EXTRA_LABELS = ['Implantlar', 'Marketing', 'Mening Keyslarim'];

const SERVER_PLAN_CACHE = new Map();

export function resolveClinicPlan(clinic) {
  const raw = String(clinic?.plan || '').trim().toLowerCase();
  if (raw === 'pro' || raw === 'basic') return raw;
  const id = String(clinic?.id || '').trim().toLowerCase();
  if (PROTECTED_PRO_CLINIC_IDS.has(id)) return 'pro';
  return 'basic';
}

export function planAllows(plan, feature) {
  const features = PLAN_FEATURES[plan] || PLAN_FEATURES.basic;
  return features.includes(feature);
}

export function readClinicPlan() {
  const stored = localStorage.getItem('clinic_plan');
  return stored === 'pro' || stored === 'basic' ? stored : 'basic';
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

  const { data, error } = await supabase.from('clinics').select('id,plan').eq('id', id).maybeSingle();
  let plan = 'basic';
  if (!error && data) plan = resolveClinicPlan(data);
  else if (PROTECTED_PRO_CLINIC_IDS.has(key)) plan = 'pro';
  SERVER_PLAN_CACHE.set(key, { plan, at: Date.now() });

  const current = localStorage.getItem('clinic_plan');
  if (current !== plan) {
    localStorage.setItem('clinic_plan', plan);
    window.dispatchEvent(new CustomEvent(CLINIC_SESSION_EVENT, { detail: { plan } }));
  }
  return plan;
}

export async function assertServerFeature(feature) {
  const plan = await fetchServerPlan();
  if (!planAllows(plan, feature)) {
    const error = new Error("Bu moduldan foydalanish uchun PRO ta'rifiga o'ting!");
    error.code = 403;
    throw error;
  }
  return plan;
}

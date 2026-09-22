/** Billing helpers for the Super Admin control room. Pure functions, no React. */

export const LEDGER_STORAGE_KEY = 'system_payment_ledger';

/** Hand-created clinics keep the older portal fees. Landing prices live in LANDING_TARIFFS. */
export const LEGACY_FEES = { basic: 99000, pro: 189000 };

export const LANDING_TARIFFS = [
  { id: 'start', name: 'Start', priceUzs: 990000, crmPlan: 'basic' },
  { id: 'pro', name: 'Pro', priceUzs: 1990000, crmPlan: 'pro' },
  { id: 'klinika', name: 'Klinika', priceUzs: 3490000, crmPlan: 'pro' },
  { id: 'trial', name: 'Sinov', priceUzs: 0, crmPlan: 'basic' },
];

export const PLAN_CATALOG = {
  basic: {
    id: 'basic',
    label: 'BASIC',
    landing: ['Start'],
    catalogPrice: LEGACY_FEES.basic,
    landingPrices: LANDING_TARIFFS.filter((plan) => plan.crmPlan === 'basic' && plan.id !== 'trial'),
    summary: 'Qo\'lda yaratilgan klinika 99,000 UZS. Landingdagi Start (990,000 UZS) shu tarifga tushadi.',
  },
  pro: {
    id: 'pro',
    label: 'PRO',
    landing: ['Pro', 'Klinika'],
    catalogPrice: LEGACY_FEES.pro,
    landingPrices: LANDING_TARIFFS.filter((plan) => plan.crmPlan === 'pro'),
    summary: 'Qo\'lda yaratilgan klinika 189,000 UZS. Landingdagi Pro (1,990,000) va Klinika (3,490,000) shu tarifga tushadi.',
  },
};

export const PLAN_MAPPING_NOTE =
  'Landing: Start 990,000 → BASIC, Pro 1,990,000 → PRO, Klinika 3,490,000 → PRO, sinov 0 UZS. Qo\'lda klinika BASIC 99,000 / PRO 189,000. Boshqa oylik summa maxsus narx sifatida saqlanadi.';

export const METHOD_LABELS = {
  manual: 'Qo\'lda',
  payme: 'Payme',
  click: 'Click',
  mock: 'Mock',
  trial: 'Sinov',
};

export const WEBHOOK_LABELS = {
  not_required: 'Shart emas',
  not_configured: 'Sozlanmagan',
  waiting: 'Kutilmoqda',
  received: 'Qabul qilindi',
  failed: 'Xato',
};

export const SOURCE_LABELS = {
  manual: 'Qo\'lda',
  landing: 'Landing',
  telegram: 'Telegram',
  referral: 'Tavsiya',
  other: 'Boshqa',
};

export const LIFECYCLE_META = {
  trialing: { key: 'trialing', label: 'Sinov', badge: 'trial' },
  active: { key: 'active', label: 'Faol', badge: 'active' },
  expiring: { key: 'expiring', label: 'Tugayapti', badge: 'expiring' },
  past_due: { key: 'past_due', label: 'Qarzdor', badge: 'past_due' },
  expired: { key: 'expired', label: 'Tugagan', badge: 'expired' },
};

const DAY_MS = 86400000;

export function startOfDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function parseDay(value) {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed;
}

export function formatDay(value) {
  const date = value instanceof Date ? value : parseDay(value);
  if (!date || Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatMoney(value) {
  const amount = Number(value || 0);
  if (!Number.isFinite(amount)) return '0';
  return Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function catalogAmount(plan) {
  return plan === 'basic' ? PLAN_CATALOG.basic.catalogPrice : PLAN_CATALOG.pro.catalogPrice;
}

export function knownMonthlyFees(plan) {
  const key = plan === 'basic' ? 'basic' : 'pro';
  const fees = new Set([LEGACY_FEES[key]]);
  LANDING_TARIFFS.forEach((tariff) => {
    if (tariff.crmPlan === key) fees.add(tariff.priceUzs);
  });
  return fees;
}

export function isCustomMonthly(clinic) {
  const fee = Number(clinic?.monthly_fee);
  if (!Number.isFinite(fee)) return false;
  return !knownMonthlyFees(clinic?.plan).has(fee);
}

export function daysBetween(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
}

export function getTimeRemaining(expiryDateStr, now = new Date()) {
  if (!expiryDateStr) {
    return {
      text: 'Muddatsiz',
      color: 'text-slate-500',
      bg: 'bg-slate-500/10 border-slate-500/20',
      isUrgent: false,
      days: null,
    };
  }
  const expiry = parseDay(expiryDateStr);
  if (!expiry) {
    return {
      text: 'Noma\'lum',
      color: 'text-slate-500',
      bg: 'bg-slate-500/10 border-slate-500/20',
      isUrgent: false,
      days: null,
    };
  }
  const diffDays = daysBetween(now, expiry);

  if (diffDays < 0) {
    return { text: 'Muddati tugagan', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', isUrgent: true, days: diffDays };
  }
  if (diffDays === 0) {
    return { text: 'Bugun tugaydi', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', isUrgent: true, days: 0 };
  }
  if (diffDays <= 7) {
    return { text: `${diffDays} kun qoldi`, color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20', isUrgent: true, days: diffDays };
  }
  if (diffDays <= 15) {
    return { text: `${diffDays} kun qoldi`, color: 'text-teal-300', bg: 'bg-teal-500/10 border-teal-500/20', isUrgent: false, days: diffDays };
  }
  if (diffDays <= 30) {
    return { text: `${diffDays} kun qoldi`, color: 'text-teal-300', bg: 'bg-teal-500/10 border-teal-500/20', isUrgent: false, days: diffDays };
  }
  const months = Math.floor(diffDays / 30);
  const remainingDays = diffDays % 30;
  return {
    text: `${months} oy${remainingDays > 0 ? ` ${remainingDays} k` : ''}`,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    isUrgent: false,
    days: diffDays,
  };
}

/** Missing date stays "overdue" so the action list still flags never-paid termed clinics. */
export function isPaymentOverdue(lastPaymentStr, now = new Date()) {
  if (!lastPaymentStr) return true;
  const last = parseDay(lastPaymentStr);
  if (!last) return true;
  return Math.abs(daysBetween(last, now)) > 30;
}

export function isPaymentStale(lastPaymentStr, now = new Date()) {
  if (!lastPaymentStr) return false;
  return isPaymentOverdue(lastPaymentStr, now);
}

export function resolveLifecycle(clinic, now = new Date()) {
  const explicit = clinic?.subscription_status || '';
  const expiry = parseDay(clinic?.expires_at);
  const trialEnd = parseDay(clinic?.trial_ends_at);
  const today = startOfDay(now);
  const days = expiry ? daysBetween(today, expiry) : null;
  const expiredByDate = days !== null && days < 0;
  const trialStillOpen = Boolean(trialEnd && trialEnd >= today);
  const trialWindowClosed = explicit === 'trialing' && trialEnd && trialEnd < today;

  if (explicit === 'expired' || clinic?.status === 'Expired' || expiredByDate || trialWindowClosed) {
    return { ...LIFECYCLE_META.expired, trial: explicit === 'trialing' || trialWindowClosed, days };
  }

  const markedTrial = explicit === 'trialing' || (trialStillOpen && explicit !== 'active' && explicit !== 'past_due' && explicit !== 'expired');
  if (markedTrial && (trialStillOpen || !trialEnd)) {
    const trialDays = trialEnd ? daysBetween(today, trialEnd) : days;
    if (trialDays !== null && trialDays >= 0 && trialDays <= 7) {
      return { ...LIFECYCLE_META.expiring, label: 'Sinov tugayapti', trial: true, days: trialDays };
    }
    return { ...LIFECYCLE_META.trialing, trial: true, days: trialDays ?? days };
  }

  const neverPaidTerm = !clinic?.last_payment_date && days !== null && days >= 0;
  const stale = explicit !== 'active' && explicit !== 'trialing' && (isPaymentStale(clinic?.last_payment_date, now) || neverPaidTerm);
  if (explicit === 'past_due' || stale) {
    if (days === null || days >= 0) {
      return { ...LIFECYCLE_META.past_due, days };
    }
  }

  if (days !== null && days >= 0 && days <= 7) {
    return { ...LIFECYCLE_META.expiring, days };
  }

  if (clinic?.status && clinic.status !== 'Active') {
    return { ...LIFECYCLE_META.expired, label: 'Nofaol', days };
  }

  return { ...LIFECYCLE_META.active, days };
}

export function extendExpiry(currentExpiry, days, now = new Date()) {
  const today = startOfDay(now);
  const current = parseDay(currentExpiry);
  const base = current && current > today ? current : today;
  const next = new Date(base.getTime());
  next.setDate(next.getDate() + Number(days || 0));
  return formatDay(next);
}

export function webhookStatusFor(clinic, method) {
  if (method === 'manual' || method === 'mock' || !method) return 'not_required';
  if (method === 'payme') return clinic?.payme_merchant_id ? 'received' : 'not_configured';
  if (method === 'click') return (clinic?.click_service_id || clinic?.click_merchant_id) ? 'received' : 'not_configured';
  return 'not_required';
}

export function buildPaymentEntry({ clinic, amount, method, periodDays, status = 'paid', note = '', now = new Date() }) {
  const webhook = webhookStatusFor(clinic, method);
  const days = Number(periodDays) || 0;
  const date = formatDay(now);
  const paid = Number(amount) || 0;
  const safeMethod = METHOD_LABELS[method] ? method : 'manual';
  return {
    id: `pay_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    clinic_id: clinic?.id || '',
    clinic_name: clinic?.name || clinic?.id || '',
    date,
    paidAt: date,
    amount: paid,
    amountUzs: paid,
    method: safeMethod,
    status,
    subscriptionStatus: status === 'paid' ? 'active' : status,
    orderId: null,
    period_days: days,
    period_label: days > 0 ? `+${days} kun` : '—',
    webhook_status: webhook,
    note: note || (days > 0 ? `Obuna +${days} kun` : 'To\'lov qabul qilindi'),
    created_at: now.toISOString(),
  };
}

function presentLedgerEntry(entry, clinic) {
  const date = entry.date || String(entry.paidAt || '').slice(0, 10);
  const amount = Number(entry.amount ?? entry.amountUzs ?? 0);
  const method = entry.method || 'manual';
  let status = entry.status;
  if (!status) {
    if (entry.subscriptionStatus === 'trialing') status = 'trial';
    else if (entry.subscriptionStatus === 'expired') status = 'failed';
    else status = 'paid';
  }
  const webhook = entry.webhook_status || (
    method === 'payme' || method === 'click'
      ? 'received'
      : (method === 'manual' || method === 'mock' || method === 'trial' ? 'not_required' : '')
  );
  return {
    ...entry,
    clinic_id: entry.clinic_id || clinic?.id || '',
    clinic_name: entry.clinic_name || clinic?.name || entry.clinic_id || '',
    date,
    paidAt: entry.paidAt || date,
    amount,
    amountUzs: Number(entry.amountUzs ?? amount) || 0,
    method,
    status,
    period_label: entry.period_label || entry.note || '—',
    webhook_status: webhook,
    created_at: entry.created_at || entry.paidAt || date,
  };
}

export function mergeLedgers(clinics, stored = []) {
  const map = new Map();
  const put = (entry, clinic) => {
    if (!entry || !entry.id) return;
    map.set(entry.id, presentLedgerEntry(entry, clinic));
  };
  (clinics || []).forEach((clinic) => {
    const rows = Array.isArray(clinic?.payment_ledger) ? clinic.payment_ledger : [];
    rows.forEach((entry) => put(entry, clinic));
  });
  (stored || []).forEach((entry) => put(entry, null));
  return Array.from(map.values()).sort((a, b) => String(b.created_at || b.date || '').localeCompare(String(a.created_at || a.date || '')));
}

export function readLedger(storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return [];
  try {
    const parsed = JSON.parse(store.getItem(LEDGER_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeLedger(entries, storage) {
  const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (!store) return;
  try {
    store.setItem(LEDGER_STORAGE_KEY, JSON.stringify((entries || []).slice(0, 300)));
  } catch {
    // Backup JSON still carries the ledger if storage is full.
  }
}

export function stripAdminFields(clinic) {
  const copy = { ...clinic };
  delete copy.admin_password;
  delete copy.admin_username;
  delete copy.admin_name;
  return copy;
}

export function normalizeClinicBilling(form, now = new Date()) {
  const next = { ...form };
  const life = next.subscription_status || 'auto';
  if (life === 'auto') next.subscription_status = '';

  if (life === 'trialing') {
    if (!next.trial_ends_at) {
      const trialEnd = startOfDay(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      next.trial_ends_at = formatDay(trialEnd);
    }
    if (!next.expires_at || next.expires_at > next.trial_ends_at) {
      next.expires_at = next.trial_ends_at;
    }
    if (next.status !== 'Inactive') next.status = 'Active';
    next.subscription_status = 'trialing';
  }

  if (life === 'expired') {
    const today = startOfDay(now);
    const expiry = parseDay(next.expires_at);
    if (!expiry || expiry >= today) {
      const yesterday = new Date(today.getTime());
      yesterday.setDate(yesterday.getDate() - 1);
      next.expires_at = formatDay(yesterday);
    }
    next.subscription_status = 'expired';
  }

  if (life === 'active') {
    next.subscription_status = 'active';
    if (next.status !== 'Inactive') next.status = 'Active';
  }

  if (life === 'past_due') next.subscription_status = 'past_due';

  next.monthly_fee = Number(next.monthly_fee || 0);
  next.plan = next.plan === 'basic' ? 'basic' : 'pro';
  if (!next.signup_source) next.signup_source = (next.tariff || next.email) ? 'landing' : 'manual';
  if (!next.payment_provider) {
    const method = next.payment_method;
    next.payment_provider = ['manual', 'payme', 'click', 'mock'].includes(method) ? method : 'manual';
  }
  return next;
}

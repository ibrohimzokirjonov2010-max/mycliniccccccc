import { useEffect, useState } from 'react';
import { CreditCard } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { FEATURE_LABELS, PLAN_FEATURES, resolveClinicPlan } from '@/lib/clinicPlan';
import { isCustomMonthly, LEGACY_FEES } from '@/utils/superAdminBilling';

function formatSoom(value) {
  const amount = Math.round(Number(value) || 0);
  return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function formatExpiry(value) {
  if (!value) return 'Muddatsiz';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${date.getFullYear()}`;
}

function daysLeft(value) {
  if (!value) return null;
  const end = new Date(value);
  if (Number.isNaN(end.getTime())) return null;
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}

export default function TariffCard() {
  const [clinic, setClinic] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const id = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id');
      if (!id) return;
      const row = await base44.clinic.getById(id);
      if (!cancelled) setClinic(row);
    })();
    return () => { cancelled = true; };
  }, []);

  if (!clinic) return null;

  const plan = resolveClinicPlan(clinic);
  const custom = isCustomMonthly({ ...clinic, plan });
  const catalogFee = plan === 'basic' ? LEGACY_FEES.basic : LEGACY_FEES.pro;
  const fee = custom ? Number(clinic.monthly_fee) : (Number(clinic.monthly_fee) || catalogFee);
  const planTitle = custom ? 'Maxsus' : (plan === 'basic' ? 'BASIC' : 'PRO');
  const remaining = daysLeft(clinic.expires_at);
  const sections = (PLAN_FEATURES[plan] || []).map((key) => FEATURE_LABELS[key] || key);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
          <CreditCard className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tarif</p>
          <h2 className="text-lg font-black tracking-tight text-slate-900">
            {planTitle} · {formatSoom(fee)} so'm
          </h2>
          <p className="mt-1 text-xs font-medium text-slate-500">
            Oylik to'lov · amal qilish muddati {formatExpiry(clinic.expires_at)}
            {remaining == null ? '' : remaining < 0 ? ' · muddati tugagan' : ` · ${remaining} kun qoldi`}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {sections.map((label) => (
          <span key={label} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
            {label}
          </span>
        ))}
      </div>
    </section>
  );
}

import { useEffect, useState } from 'react';
import { CreditCard, X } from 'lucide-react';
import { resolveClinicPlan } from '@/lib/clinicPlan';
import { isCustomMonthly, LEGACY_FEES } from '@/utils/superAdminBilling';
import {
  daysUntilExpiry,
  formatExpiryDate,
  markTariffReminderShown,
  shouldShowTariffReminder,
  supportContacts,
} from '@/lib/clinicExpiry';

function planTitle(clinic) {
  const plan = resolveClinicPlan(clinic);
  if (isCustomMonthly({ ...clinic, plan })) return 'Maxsus';
  return plan === 'basic' ? 'BASIC' : 'PRO';
}

function priceLabel(clinic) {
  const plan = resolveClinicPlan(clinic);
  const catalog = plan === 'basic' ? LEGACY_FEES.basic : LEGACY_FEES.pro;
  const custom = isCustomMonthly({ ...clinic, plan });
  const fee = custom ? Number(clinic.monthly_fee) : (Number(clinic.monthly_fee) || catalog);
  return `${Math.round(fee || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}

export default function TariffReminder({ clinic }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!clinic?.id || !shouldShowTariffReminder(clinic)) return;
    markTariffReminderShown(clinic.id);
    setOpen(true);
  }, [clinic]);

  if (!open || !clinic) return null;

  const days = daysUntilExpiry(clinic.expires_at);
  const contacts = supportContacts();
  const dayText = days === 0 ? 'bugun tugaydi' : `${days} kun qoldi`;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-widest text-amber-600">Tarif eslatmasi</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">{planTitle(clinic)} · {priceLabel(clinic)}</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100" aria-label="Yopish">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-4 text-sm font-medium leading-relaxed text-slate-600">
          {planTitle(clinic)} tarifi {formatExpiryDate(clinic.expires_at)} sanasida tugaydi. {dayText}.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          <a
            href={contacts.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white"
          >
            <CreditCard className="h-4 w-4" />
            To'lov qilish
          </a>
          <a href={`tel:${contacts.phone}`} className="text-center text-xs font-semibold text-slate-500">
            Texnik yordam: {contacts.phone}
          </a>
          <button type="button" onClick={() => setOpen(false)} className="h-10 text-sm font-semibold text-slate-500">
            Yopish
          </button>
        </div>
      </div>
    </div>
  );
}

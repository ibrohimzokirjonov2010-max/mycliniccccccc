import { CreditCard, LogOut, Phone } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { resolveClinicPlan } from '@/lib/clinicPlan';
import { formatExpiryDate, supportContacts } from '@/lib/clinicExpiry';

export default function SubscriptionBlockedView({ clinic }) {
  const { logout } = useAuth();
  const contacts = supportContacts();
  const plan = clinic ? (resolveClinicPlan(clinic) === 'basic' ? 'BASIC' : 'PRO') : '';
  const when = clinic?.expires_at ? formatExpiryDate(clinic.expires_at) : '';

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Tarif muddati tugagan</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600">
          {plan ? `${plan} tarifi ${when} sanasida tugagan. ` : ''}
          Klinika ma'lumotlari yopiq. Muddatni uzaytirish uchun to'lov qiling.
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a
            href={contacts.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-slate-900 text-sm font-bold text-white"
          >
            <CreditCard className="h-4 w-4" />
            To'lov qilish
          </a>
          <a
            href={`tel:${contacts.phone}`}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 text-sm font-bold text-slate-700"
          >
            <Phone className="h-4 w-4" />
            {contacts.phone}
          </a>
          <button
            type="button"
            onClick={logout}
            className="mt-2 inline-flex h-10 items-center justify-center gap-2 text-sm font-semibold text-slate-500"
          >
            <LogOut className="h-4 w-4" />
            Chiqish
          </button>
        </div>
      </div>
    </div>
  );
}

// payment-detail-plans-v1: /payments to'lov oynasida bemorning davolash rejalari
// (profil "Davolash rejalari" tabidagidek). Reja bosilsa hisob-faktura faqat o'qish
// rejimida ochiladi (skroll + Chop etish).
import { useEffect, useMemo, useState } from 'react';
import { FileText, ChevronRight, Calendar, ClipboardList } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import StatusBadge from '@/components/ui/StatusBadge';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { displayServiceName } from '@/lib/displayText';

const fmt = (n) => (Number(n) || 0).toLocaleString('ru-RU');
const planTitle = (plan) => {
  const raw = String(plan?.name || plan?.title || '').trim();
  return raw || 'Davolash rejasi';
};
const planDate = (plan) => {
  const d = plan?.created_date || plan?.created_at || plan?.start_date;
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
};

export default function PaymentPatientPlans({ patientId, compact = false }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoicePlan, setInvoicePlan] = useState(null);

  useEffect(() => {
    let alive = true;
    setPlans([]);
    if (!patientId) return undefined;
    setLoading(true);
    base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 100)
      .then((rows) => { if (alive) setPlans(rows || []); })
      .catch(() => { if (alive) setPlans([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [patientId]);

  const sorted = useMemo(() => [...plans].sort((a, b) => {
    const da = new Date(a.created_date || a.created_at || a.start_date || 0).getTime();
    const db = new Date(b.created_date || b.created_at || b.start_date || 0).getTime();
    return db - da;
  }), [plans]);

  const totals = useMemo(() => sorted.reduce((acc, p) => {
    const total = Number(p.total_price) || 0;
    const paid = Number(p.paid_amount) || 0;
    acc.total += total;
    acc.remaining += Math.max(0, total - paid);
    return acc;
  }, { total: 0, remaining: 0 }), [sorted]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden" data-testid="payment-patient-plans">
      <div className="bg-slate-100/90 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between gap-2">
        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5 text-[#1499AD]" />
          Davolash rejalari
          {sorted.length > 0 && (
            <span className="px-1.5 bg-slate-200 text-slate-700 text-[9px] font-black rounded-full">{sorted.length}</span>
          )}
        </span>
        {sorted.length > 0 && (
          <span className="text-[9.5px] font-bold text-slate-500 whitespace-nowrap">
            Jami: {fmt(totals.total)} · Qarz: <span className={totals.remaining > 0 ? 'text-rose-600' : 'text-emerald-600'}>{fmt(totals.remaining)}</span>
          </span>
        )}
      </div>

      {loading ? (
        <div className="py-6 text-center text-xs text-slate-400">Yuklanmoqda...</div>
      ) : sorted.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400 italic">Davolash rejalari yo'q</div>
      ) : (
        <ul className={`p-2.5 grid gap-2.5 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
          {sorted.map((plan) => {
            const total = Number(plan.total_price) || 0;
            const remaining = Math.max(0, total - (Number(plan.paid_amount) || 0));
            const discount = Number(plan.discount_amount) || 0;
            const names = (plan.services || []).map((s) => displayServiceName(s.service_name || s.name)).filter(Boolean);
            return (
              <li key={plan.id}>
                <button
                  type="button"
                  onClick={() => setInvoicePlan(plan)}
                  data-testid="payment-plan-card"
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-3 hover:border-[#1499AD] hover:shadow-sm transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[12.5px] font-black text-slate-900 uppercase leading-5 break-words min-w-0">{planTitle(plan)}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <StatusBadge status={plan.status} />
                      <ChevronRight className="w-4 h-4 text-slate-300" />
                    </div>
                  </div>
                  {names.length > 0 ? (
                    <p className="text-[10px] font-semibold text-slate-500 mt-1 leading-snug line-clamp-2">{names.join(' • ')}</p>
                  ) : (
                    <p className="text-[10px] text-slate-300 italic mt-1">Xizmatlar yo'q</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-2.5 py-1.5">
                      <p className="text-[8.5px] font-black text-emerald-600 uppercase tracking-widest">Reja jami</p>
                      <p className="text-[13px] font-black text-emerald-700 whitespace-nowrap">{fmt(total)}</p>
                    </div>
                    <div className="rounded-lg bg-rose-50 border border-rose-100 px-2.5 py-1.5">
                      <p className="text-[8.5px] font-black text-rose-600 uppercase tracking-widest">Qarz</p>
                      <p className="text-[13px] font-black text-rose-700 whitespace-nowrap">{fmt(remaining)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 border border-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                      <Calendar className="w-3 h-3 text-blue-400" /> {planDate(plan)}
                    </span>
                    {discount > 0 && (
                      <span className="inline-flex items-center rounded-full bg-rose-50 border border-rose-100 px-2 py-0.5 text-[9px] font-black text-rose-600">
                        Chegirma: {fmt(discount)}
                      </span>
                    )}
                    <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black text-indigo-700">
                      <FileText className="w-3.5 h-3.5" /> Hisob-faktura
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {invoicePlan && (
        <TreatmentPlanInvoice open={!!invoicePlan} onClose={() => setInvoicePlan(null)} plan={invoicePlan} />
      )}
    </div>
  );
}

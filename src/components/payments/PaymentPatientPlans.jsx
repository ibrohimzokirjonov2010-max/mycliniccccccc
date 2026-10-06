// payment-detail-plans-v2: /payments to'lov oynasida "Davolash rejasi & hisob-kitob" o'rniga
// bemorning rejalari (profil "Davolash rejalari" jadvalidek, ixchamroq). Faqat o'qish:
// qator bosilsa shu rejaning hisob-fakturasi ochiladi (skroll + Chop etish), yopilsa oynaga qaytadi.
import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, ClipboardList } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import TreatmentPlanInvoice from '@/components/treatments/TreatmentPlanInvoice';
import { numberPlans, planPaid, planStatusKey, planTitle, planTotal } from '@/lib/planGroups';

const fmt = (n) => (Number(n) || 0).toLocaleString('ru-RU').replace(/[\s,\u00a0\u202f]/g, ' ');
const fmtDate = (value) => {
  const dt = value ? new Date(value) : null;
  if (!dt || Number.isNaN(dt.getTime())) return '—';
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
};

function StatusBadge({ status }) {
  const s = String(status || '').toLowerCase();
  const base = 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border font-bold text-[8.5px] uppercase tracking-wide whitespace-nowrap';
  if (s === 'completed' || s === 'bajarildi' || s === 'bajarilgan') {
    return <span className={`${base} bg-emerald-50 text-emerald-700 border-emerald-200`}><CheckCircle2 className="w-2.5 h-2.5" />Bajarildi</span>;
  }
  if (s === 'in_progress' || s === 'jarayonda') {
    return <span className={`${base} bg-amber-50 text-amber-700 border-amber-200`}><Clock className="w-2.5 h-2.5" />Jarayonda</span>;
  }
  return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}><ClipboardList className="w-2.5 h-2.5" />Rejada</span>;
}

export default function PaymentPatientPlans({ patientId, patient }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [invoicePlan, setInvoicePlan] = useState(null);
  const [incomes, setIncomes] = useState(0);

  useEffect(() => {
    let alive = true;
    setPlans([]);
    setIncomes(0);
    if (!patientId) return undefined;
    setLoading(true);
    Promise.all([
      base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 200),
      base44.entities.Payment.filter({ patient_id: patientId }, 'date', 5000).catch(() => []),
    ])
      .then(([rows, pays]) => {
        if (!alive) return;
        setPlans(Array.isArray(rows) ? rows : []);
        // Same "to'langan" source as the profile: sum of Income payments.
        setIncomes((pays || []).filter((p) => String(p.type || '').toLowerCase() === 'income')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0));
      })
      .catch(() => { if (alive) setPlans([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [patientId]);

  // Same numbers as the profile "Davolash rejalari" table (planGroups helpers).
  const rows = useMemo(() => {
    const totalPaid = Math.max(incomes, Number(patient?.total_paid || 0));
    const numberOf = numberPlans(plans);
    return plans.map((plan, idx) => {
      const number = numberOf(plan, idx);
      const total = planTotal(plan);
      const paid = planPaid(plan, plans, totalPaid);
      return {
        id: plan.id ?? `idx-${idx}`,
        number,
        title: planTitle(number, plan),
        sub: plan.name || '',
        date: plan.created_date || plan.date || '',
        services: (plan.services || []).length,
        total,
        paid,
        debt: Math.max(0, total - paid),
        status: planStatusKey(plan),
        planObj: { ...plan, paid_amount: paid },
      };
    }).sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime() || b.number - a.number);
  }, [plans, patient, incomes]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    acc.total += r.total; acc.paid += r.paid; acc.debt += r.debt; return acc;
  }, { total: 0, paid: 0, debt: 0 }), [rows]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col h-full" data-testid="payment-patient-plans">
      <div className="bg-slate-100/90 px-3.5 py-1.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ClipboardList className="w-3.5 h-3.5 text-emerald-600" />
          Rejalar
          {rows.length > 0 && <span className="px-1.5 bg-slate-200 text-slate-700 text-[9px] font-black rounded-full">{rows.length}</span>}
        </span>
        <span className="text-[9.5px] font-bold text-slate-500">UZS (So'm)</span>
      </div>

      {loading ? (
        <div className="py-5 text-center text-[11px] text-slate-400">Yuklanmoqda...</div>
      ) : rows.length === 0 ? (
        <div className="py-5 text-center text-[11px] text-slate-400 italic">Davolash rejalari yo'q</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[9px]">
                <th className="w-7 py-1.5 px-1.5 text-center border-r border-slate-200">№</th>
                <th className="py-1.5 px-2 text-left border-r border-slate-200">Reja / paket</th>
                <th className="py-1.5 px-2 text-center border-r border-slate-200">Sana</th>
                <th className="py-1.5 px-1.5 text-center border-r border-slate-200" title="Xizmatlar">Xiz.</th>
                <th className="py-1.5 px-2 text-right border-r border-slate-200">Jami</th>
                <th className="py-1.5 px-2 text-right">To'langan / qarz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/80 text-[11px]">
              {rows.map((r, i) => (
                <tr
                  key={r.id}
                  data-testid="payment-plan-row"
                  onClick={() => setInvoicePlan(r.planObj)}
                  className="hover:bg-slate-50/80 cursor-pointer"
                  title="Hisob-fakturani ochish"
                >
                  <td className="text-center font-bold text-slate-400 border-r border-slate-200 py-1.5">{String(i + 1).padStart(2, '0')}</td>
                  <td className="px-2 py-1.5 border-r border-slate-200 min-w-0">
                    <div className="flex items-start justify-between gap-1">
                      <span className="font-bold text-slate-800 leading-tight break-words min-w-0">{r.title}</span>
                      <StatusBadge status={r.status} />
                    </div>
                    {r.sub && r.sub !== r.title && <div className="text-[9.5px] text-slate-400 leading-tight truncate max-w-[200px]">{r.sub}</div>}
                  </td>
                  <td className="px-2 py-1.5 text-center font-mono text-[10px] text-slate-500 border-r border-slate-200 whitespace-nowrap">{fmtDate(r.date)}</td>
                  <td className="px-1.5 py-1.5 text-center border-r border-slate-200">
                    <span className="inline-flex min-w-5 justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">{r.services}</span>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-[10.5px] font-black text-slate-900 border-r border-slate-200 whitespace-nowrap">{fmt(r.total)}</td>
                  <td className="px-2 py-1.5 text-right font-mono text-[10.5px] whitespace-nowrap leading-tight">
                    <div className="font-bold text-emerald-600">{fmt(r.paid)}</div>
                    <div className={r.debt > 0 ? 'font-bold text-rose-600' : 'text-slate-400'}>
                      {r.debt > 0 ? fmt(r.debt) : "Qarz yo'q"}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t border-slate-200 text-[10px] font-black">
                <td colSpan={4} className="px-2 py-1.5 text-slate-600 uppercase border-r border-slate-200">Jami</td>
                <td className="px-2 py-1.5 text-right font-mono text-slate-900 border-r border-slate-200 whitespace-nowrap">{fmt(totals.total)}</td>
                <td className="px-2 py-1.5 text-right font-mono whitespace-nowrap leading-tight">
                  <div className="text-emerald-600">{fmt(totals.paid)}</div>
                  <div className={totals.debt > 0 ? 'text-rose-600' : 'text-slate-400'}>{totals.debt > 0 ? fmt(totals.debt) : "Qarz yo'q"}</div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {invoicePlan && (
        <TreatmentPlanInvoice open={!!invoicePlan} onClose={() => setInvoicePlan(null)} plan={invoicePlan} />
      )}
    </div>
  );
}

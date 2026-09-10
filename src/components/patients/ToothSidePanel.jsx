import { useMemo, useState, useEffect } from 'react';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEAL = '#14b8a6';
const TEAL_DARK = '#0d9488';
const QUICK_STATUSES = [
  { key: 'caries', label: 'Karies', color: '#ef4444', bg: 'bg-rose-50', border: 'border-rose-200' },
  { key: 'filling', label: 'Plomba', color: '#3b82f6', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'crown', label: 'Koronka', color: '#eab308', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'implant', label: 'Implant', color: '#94a3b8', bg: 'bg-slate-100', border: 'border-slate-300' },
  { key: 'extracted', label: "Yo'q", color: '#0f172a', bg: 'bg-slate-200', border: 'border-slate-400' },
  { key: 'other', label: 'Boshqa', color: TEAL, bg: 'bg-teal-50', border: 'border-teal-200' },
];

const STATUS_LABEL = {
  caries: 'Karies',
  filling: 'Plomba',
  crown: 'Koronka',
  implant: 'Implant',
  extracted: "Yo'q",
  missing: "Yo'q",
  healthy: "Sog'lom",
  completed: 'Davolangan',
  in_progress: 'Jarayonda',
  planned: 'Rejalashtirilgan',
};

/**
 * Chairside tooth detail side panel — teal header, history timeline, quick-add grid, notes.
 */
export default function ToothSidePanel({
  tooth,
  plans = [],
  toothStatuses = {},
  toothRecords = [],
  implants = [],
  doctors = [],
  onClose,
  onQuickStatus,
  onSaveNote,
  pendingNotes = '',
}) {
  const [note, setNote] = useState(pendingNotes || '');
  const [activeQuick, setActiveQuick] = useState(null);

  useEffect(() => {
    setNote(pendingNotes || '');
    setActiveQuick(null);
  }, [tooth?.fdi, tooth?.id, pendingNotes]);

  const fdi = String(tooth?.fdi || '').trim();
  const toothId = tooth?.id;

  const statusObj = useMemo(() => {
    if (!toothId && !fdi) return null;
    return toothStatuses[toothId] || toothStatuses[fdi] || null;
  }, [toothStatuses, toothId, fdi]);

  const statusKey = statusObj?.status || 'healthy';
  const statusLabel = STATUS_LABEL[statusKey] || statusObj?.diagnosis || 'Koronka';

  const history = useMemo(() => {
    const items = [];
    const selectedFdi = fdi;

    (plans || []).forEach((plan) => {
      const planServices = plan.services || [];
      const planTooth = String(plan.tooth_number || '').trim();
      const planDateRaw = plan.updated_at || plan.created_date || plan.created_at || plan.date;
      const planDate = planDateRaw ? new Date(planDateRaw) : null;
      const dateStr = planDate && !isNaN(planDate)
        ? `${String(planDate.getDate()).padStart(2, '0')}.${String(planDate.getMonth() + 1).padStart(2, '0')}.${planDate.getFullYear()}`
        : '—';
      const doctorName = (doctors || []).find((d) => String(d.id) === String(plan.doctor_id || plan.created_by))?.full_name
        || plan.doctor_name
        || '';

      planServices.forEach((s) => {
        const serviceTooth = String(s.tooth_number || s.tooth_id || planTooth || '').trim().replace(/^#/, '');
        if (serviceTooth !== selectedFdi) return;
        const name = s.service_name || s.name || plan.name || 'Muolaja';
        const st = (s.status || plan.status || '').toLowerCase();
        items.push({
          id: `${plan.id}-${s.id || name}-${dateStr}`,
          date: dateStr,
          title: name,
          doctor: doctorName,
          highlight: st.includes('caries') || st.includes('karies') || /karies/i.test(name),
          status: st,
        });
      });

      if (planServices.length === 0 && planTooth === selectedFdi) {
        items.push({
          id: `plan-${plan.id}`,
          date: dateStr,
          title: plan.name || plan.title || 'Davolash',
          doctor: doctorName,
          highlight: /karies/i.test(plan.name || ''),
          status: (plan.status || '').toLowerCase(),
        });
      }
    });

    (toothRecords || [])
      .filter((r) => String(r.tooth_number) === selectedFdi)
      .forEach((r) => {
        const d = r.created_date || r.updated_at;
        const dt = d ? new Date(d) : null;
        const dateStr = dt && !isNaN(dt)
          ? `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`
          : '—';
        items.push({
          id: `rec-${r.id}`,
          date: dateStr,
          title: [r.condition, r.treatment].filter(Boolean).join(' · ') || r.notes || 'Yozuv',
          doctor: r.doctor || '',
          highlight: /karies|caries/i.test(`${r.condition} ${r.treatment}`),
          status: '',
        });
      });

    return items.slice(0, 12);
  }, [plans, toothRecords, doctors, fdi]);

  const implantForTooth = (implants || []).filter((imp) =>
    (imp.tooth_numbers || [imp.tooth_number]).map(String).includes(fdi)
  );

  const handleQuick = (key) => {
    setActiveQuick(key);
    if (onQuickStatus) onQuickStatus(fdi, toothId, key);
  };

  const handleSave = () => {
    if (onSaveNote) onSaveNote(fdi, toothId, note, activeQuick);
  };

  if (!tooth) return null;

  return (
    <aside className="w-full xl:w-[300px] shrink-0 bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] flex flex-col max-h-[calc(100vh-160px)] sticky top-[76px] overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3.5 text-white shrink-0"
        style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)` }}
      >
        <div className="min-w-0">
          <h3 className="text-sm font-black truncate tracking-tight">
            Tish #{fdi} <span className="font-bold opacity-90">({statusLabel})</span>
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg hover:bg-white/15 text-white flex items-center justify-center cursor-pointer shrink-0"
          aria-label="Yopish"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
        <section>
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
            Tish tarixi
          </h4>
          {history.length === 0 && implantForTooth.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center">
              <p className="text-xs font-semibold text-slate-400">Tarix yo&apos;q</p>
            </div>
          ) : (
            <div className="relative pl-3 space-y-3 before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-px before:bg-slate-200">
              {history.map((item) => (
                <div key={item.id} className="relative pl-4">
                  <span className={cn(
                    'absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm',
                    item.highlight ? 'bg-rose-500' : ''
                  )} style={!item.highlight ? { backgroundColor: TEAL } : undefined} />
                  <p className="text-[10px] font-bold text-slate-400">{item.date}</p>
                  <p className={cn('text-xs font-bold leading-snug', item.highlight ? 'text-rose-600' : 'text-slate-800')}>
                    {item.title}
                  </p>
                  {item.doctor ? (
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">{item.doctor}</p>
                  ) : null}
                </div>
              ))}
              {implantForTooth.map((imp) => (
                <div key={imp.id || imp.tooth_number} className="relative pl-4">
                  <span className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-slate-400 border-2 border-white shadow-sm" />
                  <p className="text-xs font-bold text-slate-800">Implant</p>
                  <p className="text-[10px] text-slate-400">{imp.brand || imp.system || '—'}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">
            Tez qo&apos;shish
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_STATUSES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => handleQuick(s.key)}
                className={cn(
                  'flex flex-col items-center gap-1.5 rounded-xl border px-2 py-2.5 text-[10px] font-black transition-all cursor-pointer',
                  activeQuick === s.key
                    ? 'ring-2 ring-teal-400/50 border-teal-500 bg-teal-50/80'
                    : `${s.bg} ${s.border} hover:shadow-sm`
                )}
              >
                <span
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-black shadow-sm"
                  style={{ backgroundColor: s.color }}
                >
                  {s.key === 'extracted' ? '×' : s.label[0]}
                </span>
                <span className="text-slate-700">{s.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2">
            Eslatma <span className="normal-case tracking-normal font-semibold text-slate-300">(ixtiyoriy)</span>
          </h4>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Tish haqida eslatma yozing..."
            className="w-full min-h-[88px] rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/25 focus:border-teal-500 resize-none"
          />
        </section>

        {statusKey === 'caries' || activeQuick === 'caries' ? (
          <div className="flex items-start gap-2 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0 mt-0.5" />
            <p className="text-[10px] font-semibold text-rose-600 leading-snug">Karies holati belgilandi</p>
          </div>
        ) : null}
      </div>

      <div className="p-3 border-t border-slate-100 shrink-0">
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-2.5 rounded-xl text-white text-xs font-black shadow-sm active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:opacity-95"
          style={{ backgroundColor: TEAL }}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Saqlash
        </button>
      </div>
    </aside>
  );
}

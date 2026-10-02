import { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { cn } from '@/lib/utils';
import ProfessionalOdontogram from '@/components/patients/ProfessionalOdontogram';
import { internalIdToFdi } from '@/lib/fdiNotation';
import { buildImplantChartStatuses } from '@/lib/implantChartStatuses';

/**
 * Read-only "Tish joyi (FDI)" chart for the Implant detail page.
 *
 * Re-uses the patient profile's ProfessionalOdontogram (real Dizyner tooth
 * drawings, upper/lower jaw, cross layout) WITHOUT modifying it: the wrapper
 * only feeds it `toothStatuses` read from the patient's chart data and styles
 * the rendered `[data-fdi]` cells with scoped CSS (FDI numbers, teal implant
 * highlight, "#11" badge). Nothing here writes to the database.
 */

const TEAL = '#14b8a6';
const TEAL_DARK = '#0d9488';

const COPY = {
  uz: {
    implant: 'Implant joylashgan',
    natural: 'Tabiiy tish',
    missing: "Yo'q / olingan",
    right: "O'NG",
    hint: 'Boshqa tishlar bemorning tish kartasidan olingan',
  },
  ru: {
    implant: 'Имплант установлен',
    natural: 'Естественный зуб',
    missing: 'Отсутствует / удалён',
    hint: 'Остальные зубы взяты из зубной карты пациента',
  },
};

function scopedCss(scope, caseFdis, activeFdi, otherImplantFdis) {
  const cell = (f) => `.${scope} .odontogram-tooth[data-fdi="${f}"]`;
  const rules = [`
.${scope} .odontogram-tooth{filter:none !important;cursor:default;}
.${scope} .odontogram-tooth::before,.${scope} .odontogram-tooth::after{
  display:block;box-sizing:border-box;width:fit-content;max-width:100%;margin:0 auto;
  font:800 10px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:-0.02em;
  color:#475569;padding:3px 2px;border-radius:6px;flex:0 0 auto;
}
.${scope} .odonto-jaw-upper .odontogram-tooth::after{content:attr(data-fdi);margin-top:2px;}
.${scope} .odonto-jaw-lower .odontogram-tooth::before{content:attr(data-fdi);margin-bottom:2px;}
.${scope} .odontogram-tooth .tooth-status-dot{display:none;}
@media (max-width:767px){
  .${scope} .odontogram-tooth::before,.${scope} .odontogram-tooth::after{font-size:11px;}
}`];
  caseFdis.forEach((f) => {
    const on = f === activeFdi;
    rules.push(`
${cell(f)}{border-radius:10px;background:rgba(20,184,166,${on ? '0.20' : '0.10'});
  box-shadow:inset 0 0 0 ${on ? '2.5px' : '1.5px'} ${on ? TEAL_DARK : TEAL};}
.${scope} .odonto-jaw-upper ${cell(f).replace(`.${scope} `, '')}::after,
.${scope} .odonto-jaw-lower ${cell(f).replace(`.${scope} `, '')}::before{
  content:"#" attr(data-fdi);background:${on ? TEAL_DARK : TEAL};color:#fff;padding:3px 5px;
  font-size:11px;box-shadow:0 1px 2px rgba(15,118,110,.35);}
${cell(f)}{cursor:pointer;}`);
  });
  otherImplantFdis.forEach((f) => {
    rules.push(`
${cell(f)}{border-radius:10px;background:rgba(20,184,166,0.06);box-shadow:inset 0 0 0 1px rgba(20,184,166,0.55);}
.${scope} .odonto-jaw-upper ${cell(f).replace(`.${scope} `, '')}::after,
.${scope} .odonto-jaw-lower ${cell(f).replace(`.${scope} `, '')}::before{color:${TEAL_DARK};}`);
  });
  return rules.join('\n');
}

export default function ImplantToothChart({
  patientId,
  implants = [],
  caseFdis = [],
  activeFdi = '',
  onSelectTooth,
  language = 'uz',
  className,
}) {
  const t = COPY[language] || COPY.uz;
  const scope = useRef(`ifc-${Math.random().toString(36).slice(2, 8)}`).current;
  const frameRef = useRef(null);
  const [plans, setPlans] = useState([]);
  const [toothRecords, setToothRecords] = useState([]);

  // Read-only: the patient's tooth-chart sources (same entities the profile card uses).
  useEffect(() => {
    let alive = true;
    if (!patientId) { setPlans([]); setToothRecords([]); return undefined; }
    (async () => {
      const [p, r] = await Promise.all([
        base44.entities.TreatmentPlan.filter({ patient_id: patientId }, '-created_date', 100).catch(() => []),
        base44.entities.ToothRecord.filter({ patient_id: patientId }, '-created_date', 100).catch(() => []),
      ]);
      if (!alive) return;
      setPlans(Array.isArray(p) ? p : []);
      setToothRecords(Array.isArray(r) ? r : []);
    })();
    return () => { alive = false; };
  }, [patientId]);

  const { statuses, implantFdis } = useMemo(
    () => buildImplantChartStatuses({ plans, toothRecords, implants }),
    [plans, toothRecords, implants],
  );

  const caseSet = useMemo(() => new Set((caseFdis || []).map(String)), [caseFdis]);
  const caseList = useMemo(() => [...caseSet], [caseSet]);
  const otherImplants = useMemo(() => implantFdis.filter((f) => !caseSet.has(f)), [implantFdis, caseSet]);

  // Child (primary) dentition only when the implant itself sits on a 51–85 tooth.
  const patientType = useMemo(
    () => (caseList.some((f) => Number(f) >= 51 && Number(f) <= 85) ? 'child' : 'adult'),
    [caseList],
  );

  const css = useMemo(
    () => scopedCss(scope, caseList, String(activeFdi || ''), otherImplants),
    [scope, caseList, activeFdi, otherImplants],
  );

  // Phones scroll the arch horizontally: bring the active implant into view.
  useEffect(() => {
    const root = frameRef.current;
    if (!root) return;
    const scroller = root.querySelector('.odonto-scroll');
    const cell = root.querySelector(`[data-fdi="${activeFdi}"]`);
    if (!scroller || !cell || scroller.scrollWidth <= scroller.clientWidth + 2) return;
    const left = cell.offsetLeft + cell.offsetWidth / 2 - scroller.clientWidth / 2;
    scroller.scrollLeft = Math.max(0, left);
  }, [activeFdi, statuses, patientType]);

  const handleClick = (toothId) => {
    const fdi = internalIdToFdi(toothId) || String(toothId);
    if (caseSet.has(fdi)) onSelectTooth?.(fdi);
  };

  return (
    <div ref={frameRef} className={cn(scope, 'w-full min-w-0', className)} data-testid="implant-tooth-chart">
      <style>{css}</style>
      <div className="mx-auto w-full max-w-3xl min-w-0">
        <ProfessionalOdontogram
          toothStatuses={statuses}
          patientType={patientType}
          onToothClick={handleClick}
          hideHeader
          hideLegend
          hideStats
          hideTooltip
          compact
        />
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 border-t border-slate-100 px-1 pt-3 text-[11px] font-bold">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-flex h-4 w-4 items-center justify-center rounded-md"
            style={{ background: 'rgba(20,184,166,0.2)', boxShadow: `inset 0 0 0 2px ${TEAL}` }}
          />
          <span className="font-semibold text-slate-700">{t.implant}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded-md border border-slate-300 bg-white" />
          <span className="font-semibold text-slate-500">{t.natural}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-md border border-slate-300 bg-slate-50 text-[11px] leading-none text-rose-500">✕</span>
          <span className="font-semibold text-slate-500">{t.missing}</span>
        </div>
      </div>
      <p className="mt-1.5 text-center text-[10px] font-semibold text-slate-400">{t.hint}</p>
    </div>
  );
}

import { useEffect, useState } from 'react';
import ProfessionalOdontogram from '@/components/patients/ProfessionalOdontogram';
import MobileCompactOdontogram from '@/components/patients/MobileCompactOdontogram';

/** Mixed chart so treated, implant, and healthy teeth are visible together. */
const PREVIEW_STATUSES = {
  ur6: { status: 'in_progress', illustrationKind: 'endo', condition: 'Pulpit', treatment: 'Kanal davolash' },
  ul1: { status: 'caries', illustrationKind: 'caries', condition: 'Kariyes' },
  ul6: { status: 'completed', illustrationKind: 'plomba', treatment: 'Plomba' },
  ll6: { status: 'implant', hasImplant: true, illustrationKind: 'implant', treatment: 'Implant' },
  lr6: { status: 'extracted', isExtracted: true, illustrationKind: 'missing' },
};

function usePhoneChart() {
  const [phone, setPhone] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
  ));
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = () => setPhone(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return phone;
}

/** DEV-only: patient-profile tooth card without auth, for layout checks. */
export default function OdontogramCardPreview() {
  const phone = usePhoneChart();
  return (
    <div className="min-h-screen bg-[#f4f6f8] p-3" data-testid="odonto-card-preview">
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] overflow-hidden max-w-[1100px] mx-auto min-w-0">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
          <h1 className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-900">
            Odontogramma (FDI, katta yosh)
          </h1>
          <span className="text-[10px] font-bold text-slate-400">{phone ? '390' : 'desktop'}</span>
        </div>
        <div className="p-1.5 sm:p-3 overflow-hidden min-w-0 w-full bg-white">
          {phone ? (
            <MobileCompactOdontogram
              selectedFdi="16"
              toothStatuses={PREVIEW_STATUSES}
              onSelect={() => {}}
            />
          ) : (
            <ProfessionalOdontogram
              selectedTeeth={['ur6']}
              onChange={() => {}}
              toothStatuses={PREVIEW_STATUSES}
              patientType="adult"
              hideHeader
              hideLegend
              hideStats
              hideTooltip
              showOcclusal={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}

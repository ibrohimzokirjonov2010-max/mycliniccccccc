import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Phone } from 'lucide-react';
import ToothChartCard from '@/components/patients/ToothChartCard';
import MobileCompactOdontogram from '@/components/patients/MobileCompactOdontogram';
import ChairsidePatientProfile from '@/components/patients/ChairsidePatientProfile';
import { fmtMoney } from '@/utils/clinicMetrics';
import { supabase } from '@/api/supabaseClient';
import { assertClinicNotExpired } from '@/lib/clinicExpiry';
import { internalIdToFdi } from '@/lib/fdiNotation';
import { matchIllustrationKind } from '@/utils/toothIllustration';

function previewFdi(raw) {
  const text = String(raw || '').trim().replace(/^#/, '');
  if (!text) return '';
  return internalIdToFdi(text) || (text.replace(/[^\d]/g, '').length >= 2 ? text.replace(/[^\d]/g, '') : '');
}

function coloredTeeth(plan) {
  const teeth = new Set();
  const raw = Array.isArray(plan.services) ? plan.services : [];
  const rows = [];
  raw.forEach((item) => {
    if (item && Array.isArray(item.items)) rows.push(...item.items.map((svc) => ({ ...svc, tooth_number: svc.tooth_number || svc.tooth || item.tooth || plan.tooth_number })));
    else if (item) rows.push(item);
  });
  rows.forEach((svc) => {
    const blob = `${svc.service_name || ''} ${svc.name || ''} ${plan.name || ''} ${svc.category || ''}`;
    if (!matchIllustrationKind(blob, svc.category)) return;
    String(svc.tooth_number || svc.tooth || plan.tooth_number || '').split(/[,·]/).forEach((part) => {
      const fdi = previewFdi(part);
      if (fdi) teeth.add(fdi);
    });
  });
  return teeth;
}

/**
 * DEV-only layout route. Loads one real clinic patient who already has
 * treatment plans so the tooth chart can be checked without signing in.
 * The profile itself never injects sample rows.
 */
export default function OdontogramCardPreview() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await assertClinicNotExpired();
      const { data: plans, error: planError } = await supabase
        .from('treatment_plans')
        .select('id,patient_id,patient_name,name,status,tooth_number,services,total_price,notes,created_date,updated_date')
        .not('tooth_number', 'is', null)
        .limit(200);
      if (planError) throw planError;
      const groups = new Map();
      (plans || []).forEach((plan) => {
        if (!plan.patient_id) return;
        const bucket = groups.get(plan.patient_id) || [];
        bucket.push(plan);
        groups.set(plan.patient_id, bucket);
      });
      let best = null;
      groups.forEach((rows, patientId) => {
        const teeth = new Set();
        rows.forEach((plan) => coloredTeeth(plan).forEach((fdi) => teeth.add(fdi)));
        if (!best || teeth.size > best.teeth) best = { patientId, rows, teeth: teeth.size };
      });
      if (!best) throw new Error('Davolash rejasida tish raqami yo‘q');
      const { data: patients } = await supabase
        .from('patients')
        .select('id,full_name,phone')
        .eq('id', best.patientId)
        .limit(1);
      const apptRes = await supabase
        .from('appointments')
        .select('id,date,appointment_date,status,patient_id')
        .eq('patient_id', best.patientId)
        .limit(30);
      const appointments = apptRes.error ? [] : (apptRes.data || []);
      if (cancelled) return;
      setPayload({
        patient: patients?.[0] || { id: best.patientId, full_name: best.rows[0]?.patient_name || '' },
        plans: best.rows,
        appointments: appointments || [],
      });
    })().catch((err) => {
      if (!cancelled) setError(err?.message || 'Yuklanmadi');
    });
    return () => { cancelled = true; };
  }, []);

  const layout = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('layout') : '';
  const chairside = layout === 'chairside';
  const phoneShell = layout === 'phone';
  const reports = layout === 'reports';
  const mini = layout === 'mini';

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f6f8]" data-testid="odonto-card-preview">
      {error && <p className="p-3 text-sm font-semibold text-rose-600">{error}</p>}
      {!payload && !error && <p className="p-3 text-sm font-semibold text-slate-500">Yuklanmoqda…</p>}
      {payload && chairside && (
        <div className="flex h-screen overflow-hidden bg-[#F8FAFC]">
          <aside className="hidden w-60 shrink-0 bg-[#0C1222] lg:block" />
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex h-14 shrink-0 items-center border-b border-slate-200 bg-white px-4 text-sm font-black text-slate-800">Ibrohim Dent</div>
            <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden">
              <ChairsidePatientProfile
                patient={payload.patient}
                plans={payload.plans}
                payments={[]}
                appointments={payload.appointments}
                doctors={[]}
                services={[]}
                implants={[]}
                toothRecords={[]}
                onReload={async () => {}}
                onBack={() => {}}
                onPay={() => {}}
                onAppointment={() => {}}
                onNewPlan={() => {}}
                profileViewMode="chairside"
                setProfileViewMode={() => {}}
              />
            </main>
          </div>
        </div>
      )}
      {reports && (
        <div className="grid grid-cols-2 gap-3 p-4 xl:grid-cols-4">
          <article className="flex min-w-0 flex-col gap-1.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
            <span className="text-[10.5px] font-bold uppercase tracking-wide text-slate-400">Umumiy daromad</span>
            <div className="break-words text-[22px] font-extrabold leading-tight tracking-tight [&_small]:ml-1 [&_small]:text-[11px] [&_small]:font-bold [&_small]:text-slate-400">
              {fmtMoney(68750000)} <small>UZS</small>
            </div>
          </article>
        </div>
      )}
      {payload && phoneShell && (
        <div className="min-h-screen bg-[#F3F6F8] pb-24">
          <div data-patient-header="true" className="sticky top-0 z-30 text-white" style={{ background: 'linear-gradient(165deg, #0f766e 0%, #14b8a6 55%, #0d9488 100%)' }}>
            <div className="flex items-start gap-2 px-3 pb-2 pt-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/18">
                <ArrowLeft className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 text-left">
                <h1 className="break-words text-[18px] font-black leading-tight">{payload.patient.full_name || 'Test Bemor Qa'}</h1>
                <p className="mt-0.5 break-words text-[11px] font-semibold text-white/80">Erkak · 34 yosh · Ibrohim Dent</p>
              </div>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/20 text-[11px] font-black">TB</span>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/18">
                <Phone className="h-5 w-5" />
              </span>
            </div>
            <div className="mx-3 mb-2 flex flex-col gap-0.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-white/90">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                Qarzdorlik
              </span>
              <span className="text-[16px] font-black tabular-nums leading-tight text-amber-200">6 400 000 so‘m</span>
            </div>
          </div>
          <div className="px-3 pb-24 pt-3">
            <ToothChartCard
              patient={payload.patient}
              plans={payload.plans}
              payments={[]}
              appointments={payload.appointments}
              doctors={[]}
              services={[]}
              implants={[]}
              toothRecords={[]}
              onReload={async () => {}}
              onBookAppointment={() => {}}
              sheetOffset={58}
            />
          </div>
          <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-[54px] items-center justify-around border-t border-slate-200 bg-white text-[11px] font-bold text-slate-500">
            <span>Navbat</span><span>Bemorlar</span><span>Qabul</span><span>To‘lov</span>
          </nav>
        </div>
      )}
      {payload && mini && (
        <div className="mx-auto max-w-[420px] p-3" data-testid="profile-mini-chart">
          <MobileCompactOdontogram selectedFdi="" toothStatuses={{}} onSelect={() => {}} />
        </div>
      )}
      {payload && !chairside && !phoneShell && !mini && (
        <div className="p-3">
          <ToothChartCard
            patient={payload.patient}
            plans={payload.plans}
            payments={[]}
            appointments={payload.appointments}
            doctors={[]}
            services={[]}
            implants={[]}
            toothRecords={[]}
            onReload={async () => {}}
            onBookAppointment={() => {}}
            sheetOffset={0}
          />
        </div>
      )}
    </div>
  );
}

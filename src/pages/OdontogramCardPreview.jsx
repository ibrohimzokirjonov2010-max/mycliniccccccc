import { useEffect, useState } from 'react';
import ToothChartCard from '@/components/patients/ToothChartCard';
import { supabase } from '@/api/supabaseClient';
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f4f6f8] p-3" data-testid="odonto-card-preview">
      {error && <p className="text-sm font-semibold text-rose-600">{error}</p>}
      {!payload && !error && <p className="text-sm font-semibold text-slate-500">Yuklanmoqda…</p>}
      {payload && (
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
      )}
    </div>
  );
}

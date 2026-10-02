/**
 * Read-only tooth statuses for the Implant detail "Tish joyi (FDI)" chart.
 *
 * Builds the same `toothStatuses` shape that ProfessionalOdontogram consumes
 * (keyed by FDI string) from the patient's own tooth-chart data:
 *   treatment plans  →  saved tooth records  →  implants (last, wins).
 * Pure UI helper: it never writes anything and has no schema dependency.
 */
import { internalIdToFdi } from '@/lib/fdiNotation';
import { matchIllustrationKind, pickIllustrationKindFromServices } from '@/utils/toothIllustration';

/** "ur1" / "#11" / 11 → "11". Empty string when it is not a tooth token. */
export function chartToothFdi(raw) {
  const text = String(raw ?? '').trim().replace(/^#/, '');
  if (!text) return '';
  const internal = internalIdToFdi(text);
  if (internal) return internal;
  const digits = text.replace(/[^\d]/g, '');
  return digits.length === 2 ? digits : '';
}

function splitTeeth(raw) {
  if (Array.isArray(raw)) return raw.flatMap(splitTeeth);
  return String(raw ?? '').split(/[,·;/\s]+/).map(chartToothFdi).filter(Boolean);
}

const NON_TOOTH_KINDS = new Set(['healthy']);

function statusForKind(kind) {
  if (kind === 'missing') return 'missing';
  if (kind === 'caries') return 'caries';
  if (kind === 'implant' || kind === 'protez-implant') return 'implant';
  return 'completed';
}

function put(map, fdi, kind, name) {
  if (!fdi || !kind || NON_TOOTH_KINDS.has(kind)) return;
  const status = statusForKind(kind);
  map[fdi] = {
    status,
    illustrationKind: kind,
    isExtracted: kind === 'missing',
    // Plan / record "implant" art is shown, but only real Implant rows are marked as placed.
    hasImplant: false,
    serviceName: name || '',
    treatment: name || '',
  };
}

function planServices(plan) {
  const raw = Array.isArray(plan?.services) ? plan.services : [];
  const rows = [];
  raw.forEach((item) => {
    if (item && Array.isArray(item.items)) {
      item.items.forEach((svc) => rows.push({ ...svc, __parent: item }));
    } else if (item) {
      rows.push(item);
    }
  });
  if (!rows.length && (plan?.tooth_number || plan?.name)) {
    rows.push({ service_name: plan.name || plan.title || '', tooth_number: plan.tooth_number });
  }
  return rows;
}

/**
 * @param {object} p
 * @param {Array}  p.plans        TreatmentPlan rows of the patient
 * @param {Array}  p.toothRecords ToothRecord rows of the patient
 * @param {Array}  p.implants     Implant rows of the patient (placed implants)
 * @returns {{ statuses: Record<string, object>, implantFdis: string[] }}
 */
export function buildImplantChartStatuses({ plans = [], toothRecords = [], implants = [] } = {}) {
  const statuses = {};

  // 1) Treatment plans: group services per tooth, pick art by clinical priority.
  const perTooth = {};
  (plans || []).forEach((plan) => {
    planServices(plan).forEach((svc) => {
      const parent = svc.__parent || {};
      const teeth = splitTeeth(
        svc.tooth_number || svc.tooth_id || svc.tooth || parent.tooth_number || parent.tooth_id || plan?.tooth_number,
      );
      if (!teeth.length) return;
      const name = svc.service_name || svc.name || parent.service_name || plan?.name || plan?.title || '';
      const category = svc.category || parent.category || plan?.category;
      teeth.forEach((fdi) => {
        (perTooth[fdi] = perTooth[fdi] || []).push({ service_name: name, category });
      });
    });
  });
  Object.entries(perTooth).forEach(([fdi, items]) => {
    const kind = pickIllustrationKindFromServices(items, { preferLast: false });
    put(statuses, fdi, kind, items.map((i) => i.service_name).filter(Boolean).join(', '));
  });

  // 2) Saved tooth records (chart edits) override plan guesses.
  (toothRecords || []).forEach((rec) => {
    const fdi = chartToothFdi(rec?.tooth_number);
    if (!fdi) return;
    const text = `${rec.condition || ''} ${rec.treatment || ''}`;
    if (/healthy|sog['’ʻ`]?lom/i.test(text) && !matchIllustrationKind(text)) {
      delete statuses[fdi];
      return;
    }
    const kind = matchIllustrationKind(text);
    if (kind) put(statuses, fdi, kind, rec.treatment || rec.condition || '');
  });

  // 3) Placed implants (patient implant rows) always win on their own tooth.
  const implantFdis = [];
  (implants || []).forEach((imp) => {
    const teeth = splitTeeth([
      ...(Array.isArray(imp?.tooth_numbers) ? imp.tooth_numbers : String(imp?.tooth_numbers || '').split(/[,·]/)),
      imp?.tooth_number,
      imp?.tooth_id,
    ].filter(Boolean));
    teeth.forEach((fdi) => {
      if (!implantFdis.includes(fdi)) implantFdis.push(fdi);
      statuses[fdi] = {
        status: 'implant',
        illustrationKind: 'implant',
        isExtracted: false,
        hasImplant: true,
        serviceName: `${imp?.firma || ''} Implant`.trim(),
        treatment: 'Implant',
      };
    });
  });

  return { statuses, implantFdis };
}

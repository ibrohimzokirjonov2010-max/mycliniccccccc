/**
 * Clinical chart + informed consent helpers stored inside existing patient.notes JSON markers.
 * Does NOT add DB columns — packs into notes with reversible markers.
 *
 * Markers used:
 *   [CLINICAL_CHART_V1]{...json...}[/CLINICAL_CHART_V1]
 *   [CONSENT_V1]{...json...}[/CONSENT_V1]
 *
 * JSON shapes:
 *   clinical: { entries: [{ id, diagnosis, code, procedure, materials, complications, tooth, created_at }] }
 *   consent:  { given: boolean, date: 'YYYY-MM-DD'|null, note: string, updated_at: ISO }
 */

const CLINICAL_RE = /\[CLINICAL_CHART_V1\]([\s\S]*?)\[\/CLINICAL_CHART_V1\]/;
const CONSENT_RE = /\[CONSENT_V1\]([\s\S]*?)\[\/CONSENT_V1\]/;

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function parseClinicalChart(notes = '') {
  const m = String(notes || '').match(CLINICAL_RE);
  if (!m) return { entries: [] };
  const data = safeParse(m[1], { entries: [] });
  return { entries: Array.isArray(data.entries) ? data.entries : [] };
}

export function parseConsent(notes = '') {
  const m = String(notes || '').match(CONSENT_RE);
  if (!m) return { given: false, date: null, note: '', updated_at: null };
  const data = safeParse(m[1], {});
  return {
    given: !!data.given,
    date: data.date || null,
    note: data.note || '',
    updated_at: data.updated_at || null,
  };
}

export function stripClinicalMarkers(notes = '') {
  return String(notes || '')
    .replace(CLINICAL_RE, '')
    .replace(CONSENT_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildNotesWithClinical(notes, clinical, consent) {
  const base = stripClinicalMarkers(notes);
  const parts = [];
  if (base) parts.push(base);
  parts.push(`[CLINICAL_CHART_V1]${JSON.stringify({ entries: clinical?.entries || [] })}[/CLINICAL_CHART_V1]`);
  parts.push(`[CONSENT_V1]${JSON.stringify({
    given: !!consent?.given,
    date: consent?.date || null,
    note: consent?.note || '',
    updated_at: consent?.updated_at || new Date().toISOString(),
  })}[/CONSENT_V1]`);
  return parts.join('\n\n');
}

export function createClinicalEntry(partial = {}) {
  return {
    id: `clin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    diagnosis: partial.diagnosis || '',
    code: partial.code || '',
    procedure: partial.procedure || '',
    materials: partial.materials || '',
    complications: partial.complications || '',
    tooth: partial.tooth || null,
    created_at: new Date().toISOString(),
  };
}

export default {
  parseClinicalChart,
  parseConsent,
  stripClinicalMarkers,
  buildNotesWithClinical,
  createClinicalEntry,
};

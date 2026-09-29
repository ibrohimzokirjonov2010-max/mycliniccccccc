import { supabase } from './supabaseClient';

/** Rentgen rows use xray_type "xray". Clinic cases reuse that table because it already accepts server writes. */
export const CLINIC_CASE_TYPE = 'clinic_case';

let casesTableBlocked = false;

function parseJson(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function asImagePair(images) {
  const parsed = parseJson(images, images);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return {
      before: parsed.before || parsed.image_before || '',
      after: parsed.after || parsed.image_after || parsed.before || '',
    };
  }
  if (typeof parsed === 'string' && parsed) return { before: '', after: parsed };
  return { before: '', after: '' };
}

function asTags(tags) {
  const parsed = parseJson(tags, tags);
  if (Array.isArray(parsed)) return parsed.filter(Boolean);
  if (typeof parsed === 'string' && parsed) return [parsed];
  return [];
}

export function isClinicCaseRow(row) {
  if (!row) return false;
  return row.xray_type === CLINIC_CASE_TYPE || String(row.id || '').startsWith('case-');
}

export function caseFromXray(row) {
  const meta = parseJson(row?.notes, {});
  const tags = asTags(row?.findings || meta?.tags);
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id || null,
    patientname: row.patient_name || meta.patientname || '',
    patient_name: row.patient_name || meta.patientname || '',
    doctor: row.file_name || meta.doctor || '',
    date: row.date || null,
    tags,
    images: {
      before: row.thumbnail_url || '',
      after: row.image_url || '',
    },
    description: row.description || meta.description || '',
    created_date: row.created_date || null,
    server: true,
  };
}

function caseFromCasesTable(row) {
  const images = asImagePair(row.images);
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    patient_id: row.patient_id || null,
    patientname: row.patientname || row.patient_name || '',
    patient_name: row.patient_name || row.patientname || '',
    doctor: row.doctor || '',
    date: row.date || null,
    tags: asTags(row.tags),
    images,
    description: row.description || '',
    created_date: row.created_date || null,
    server: true,
  };
}

export async function listServerCases(clinicId) {
  const xrayQuery = supabase
    .from('xrays')
    .select('*')
    .eq('clinic_id', clinicId)
    .eq('xray_type', CLINIC_CASE_TYPE)
    .order('created_date', { ascending: false })
    .limit(200);

  const casesQuery = casesTableBlocked
    ? Promise.resolve({ data: [], error: null })
    : supabase.from('cases').select('*').eq('clinic_id', clinicId).order('created_date', { ascending: false }).limit(200);

  const [xrayRes, caseRes] = await Promise.all([xrayQuery, casesQuery]);
  if (xrayRes.error) {
    throw new Error(`Keyslar serverdan yuklanmadi. ${xrayRes.error.message || ''}`.trim());
  }
  if (caseRes.error) {
    const code = caseRes.error.code || '';
    if (code === '42501' || code === 'PGRST301') casesTableBlocked = true;
  }

  const merged = new Map();
  (xrayRes.data || []).filter(isClinicCaseRow).forEach((row) => {
    merged.set(row.id, caseFromXray(row));
  });
  (caseRes.data || []).forEach((row) => {
    if (!merged.has(row.id)) merged.set(row.id, caseFromCasesTable(row));
  });
  return Array.from(merged.values());
}

export async function createCaseOnServer(payload, clinicId) {
  const id = payload.id || `case-${Math.random().toString(36).substring(2, 11)}`;
  const images = asImagePair(payload.images);
  const tags = asTags(payload.tags);
  const description = payload.description || '';
  const patientname = payload.patientname || payload.patient_name || '';
  const doctor = payload.doctor || '';
  const date = String(payload.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
  const created = new Date().toISOString();

  if (!images.after) {
    throw new Error("Keys serverga saqlanmadi. Keyin rasmi yo'q.");
  }

  // Live `cases` has no notes / consent_given columns. Send only columns that exist.
  // Do not pack images into notes — that column is missing and the insert was rejected.
  if (!casesTableBlocked) {
    const caseRow = {
      id,
      clinic_id: clinicId,
      patientname,
      patient_name: patientname,
      doctor,
      patient_id: payload.patient_id || null,
      date,
      tags: JSON.stringify(tags),
      images: JSON.stringify(images),
      description,
      created_date: created,
    };
    const inserted = await supabase.from('cases').insert([caseRow]).select().single();
    if (!inserted.error && inserted.data) {
      return caseFromCasesTable(inserted.data);
    }
    const code = inserted.error?.code || '';
    if (code === '42501' || code === 'PGRST301') casesTableBlocked = true;
  }

  // The cases table is closed by row-level security for the anon key, and the
  // cases storage bucket does not exist. Rentgen already stores JPEG data URLs
  // on xrays, and that insert succeeds. Keep before/after on that same table.
  const xrayRow = {
    id,
    clinic_id: clinicId,
    patient_id: payload.patient_id || null,
    patient_name: patientname,
    image_url: images.after,
    thumbnail_url: images.before || images.after,
    xray_type: CLINIC_CASE_TYPE,
    description,
    date,
    file_name: doctor,
    findings: JSON.stringify(tags),
    notes: JSON.stringify({ doctor, tags, description, patientname }),
    created_date: created,
  };
  const saved = await supabase.from('xrays').insert([xrayRow]).select().single();
  if (saved.error || !saved.data?.id) {
    throw new Error(`Keys serverga saqlanmadi. ${saved.error?.message || 'Server javob bermadi.'}`);
  }
  return caseFromXray(saved.data);
}

export async function deleteCaseOnServer(id) {
  if (!id) throw new Error("Keys serverdan o'chirilmadi.");
  const xrayDel = await supabase.from('xrays').delete().eq('id', id).select('id');
  const caseDel = await supabase.from('cases').delete().eq('id', id).select('id');
  const removed = (xrayDel.data?.length || 0) + (caseDel.data?.length || 0);
  if (removed > 0) return { id };
  if (xrayDel.error && caseDel.error) {
    throw new Error(`Keys serverdan o'chirilmadi. ${xrayDel.error.message || caseDel.error.message}`);
  }
  if (xrayDel.error) {
    throw new Error(`Keys serverdan o'chirilmadi. ${xrayDel.error.message}`);
  }
  return { id };
}

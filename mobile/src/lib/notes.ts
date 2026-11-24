/**
 * The web CRM stores some fields inside notes as [TECH_DATA]{...}[END_TECH].
 * Keep this codec in the mobile API layer so a web schema change stays local.
 */

export function decodeNotes<T extends { notes?: string | null }>(record: T): T {
  const notes = record?.notes;
  if (typeof notes !== 'string' || !notes.startsWith('[TECH_DATA]')) return record;
  const end = notes.indexOf('[END_TECH]');
  if (end === -1) return record;
  try {
    const tech = JSON.parse(notes.slice('[TECH_DATA]'.length, end)) as Record<string, unknown>;
    const userNotes = notes.slice(end + '[END_TECH]'.length).replace(/^\n/, '');
    const merged: Record<string, unknown> = { ...record, notes: userNotes };
    Object.entries(tech).forEach(([key, value]) => {
      if (merged[key] == null || merged[key] === '') merged[key] = value;
    });
    return merged as T;
  } catch {
    return record;
  }
}

export function encodeNotes<T extends { notes?: string | null }>(payload: T, fields: readonly string[]): T {
  const source = payload as Record<string, unknown>;
  const tech: Record<string, unknown> = {};
  fields.forEach((field) => {
    const value = source[field];
    if (value !== undefined && value !== null && value !== '') tech[field] = value;
  });
  if (!Object.keys(tech).length) return payload;
  const existing = typeof payload.notes === 'string' ? payload.notes : '';
  const userNotes = existing.startsWith('[TECH_DATA]') ? '' : existing;
  const notes = `[TECH_DATA]${JSON.stringify(tech)}[END_TECH]${userNotes ? `\n${userNotes}` : ''}`;
  return { ...payload, notes };
}

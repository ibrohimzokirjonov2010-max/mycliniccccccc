/**
 * implant-case-isolation-v1
 *
 * A patient can have several implant cases (one Implant row each, e.g. case A
 * on #11 and later case B on #12). The detail page shows every tooth of the
 * patient, but each tooth stays bound to the row it belongs to (`realId`), so
 * services, passport fields, stage photos and stage changes are read from and
 * written to that row only. Stage photos live per tooth in
 * `tooth_data_map[tooth].stage_media`, except the case's first tooth, which
 * keeps the case-level photos (where every photo saved before this change is).
 */
import { toImplantFdi, uniqueImplantToothKeys } from '../../lib/fdiNotation.js';

const STAGE_KEYS = ['preop', 'postop', 'healing', 'final'];

export function recordToothKeys(rec) {
  const teeth = rec?.tooth_numbers || (rec?.tooth_number ? [rec.tooth_number] : (rec?.tooth_id ? [rec.tooth_id] : []));
  return uniqueImplantToothKeys(Array.isArray(teeth) ? teeth : String(teeth || '').split(/[,·]/));
}

function fdiOf(key) {
  return String(toImplantFdi(key) || key || '');
}

function toothEntry(rec, key) {
  const map = rec?.tooth_data_map && typeof rec.tooth_data_map === 'object' ? rec.tooth_data_map : {};
  return map[key] || map[fdiOf(key)] || null;
}

function hasAnyStagePhoto(media) {
  return !!media && typeof media === 'object' && STAGE_KEYS.some((k) => !!media[k]);
}

function recordLevelMedia(rec) {
  const stage = rec?.stage_media && typeof rec.stage_media === 'object' ? rec.stage_media : null;
  const xrays = Array.isArray(rec?.xray_urls) ? rec.xray_urls : [];
  return { stage_media: stage, xray_urls: xrays };
}

/** True when `key` is the first tooth of the case (legacy case photos belong to it). */
export function isFirstToothOfRecord(rec, key) {
  const keys = recordToothKeys(rec);
  if (keys.length <= 1) return true;
  return fdiOf(keys[0]) === fdiOf(key);
}

/**
 * Stage photos of one tooth. The case's first tooth uses the case-level photos
 * (stage_media / xray_urls, where every photo saved before lived); every other
 * tooth keeps its own photos in tooth_data_map[tooth].stage_media.
 */
export function toothStageMedia(rec, key) {
  if (isFirstToothOfRecord(rec, key)) return recordLevelMedia(rec);
  const entry = toothEntry(rec, key);
  if (entry && hasAnyStagePhoto(entry.stage_media)) {
    return { stage_media: entry.stage_media, xray_urls: [] };
  }
  return { stage_media: null, xray_urls: [] };
}

/** Update payload for saving one stage photo on one tooth of `rec`. */
export function stagePhotoPayload(rec, key, slotKey, slotIndex, url) {
  if (isFirstToothOfRecord(rec, key)) {
    const existing = Array.isArray(rec?.xray_urls) ? [...rec.xray_urls] : [];
    const xray = [0, 1, 2, 3].map((i) => {
      const cur = existing[i];
      if (i === slotIndex) return url;
      if (typeof cur === 'string') return cur || null;
      if (cur && typeof cur === 'object' && cur.url) return cur.url;
      return null;
    });
    for (let i = 4; i < existing.length; i += 1) xray.push(existing[i]);
    return {
      xray_urls: xray,
      stage_media: { ...(rec?.stage_media && typeof rec.stage_media === 'object' ? rec.stage_media : {}), [slotKey]: url },
    };
  }
  const fdi = fdiOf(key);
  const map = rec?.tooth_data_map && typeof rec.tooth_data_map === 'object' ? { ...rec.tooth_data_map } : {};
  const entry = { ...(toothEntry(rec, key) || {}) };
  entry.stage_media = { ...(entry.stage_media && typeof entry.stage_media === 'object' ? entry.stage_media : {}), [slotKey]: url };
  map[key] = entry;
  if (fdi && fdi !== String(key)) map[fdi] = entry;
  return { tooth_data_map: map };
}

/** Every implant tooth of the patient, each bound to its own row (`realId`). */
export function expandPatientTeeth(records, current) {
  const list = Array.isArray(records) && records.length > 0 ? [...records] : (current ? [current] : []);
  if (current && !list.some((r) => String(r.id) === String(current.id))) list.push(current);
  return list.flatMap((rec) => {
    const keys = recordToothKeys(rec);
    if (keys.length <= 1) {
      const key = keys[0] || rec.tooth_id || rec.tooth_number || '';
      return [{
        ...rec,
        realId: rec.id,
        syntheticToothKey: null,
        tooth_id: key || rec.tooth_id,
        tooth_number: fdiOf(key) || rec.tooth_number,
        tooth_numbers: key ? [key] : [],
      }];
    }
    return keys.map((key) => ({
      ...rec,
      id: `${rec.id}__${key}`,
      realId: rec.id,
      syntheticToothKey: key,
      tooth_id: key,
      tooth_number: fdiOf(key),
      tooth_numbers: [key],
    }));
  });
}

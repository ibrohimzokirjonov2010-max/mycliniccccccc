// Local safety net for staff settings (working days, page access).
// The primary store is the users row (tech fields packed into users.notes). When the database
// does not keep a value (readback after the write differs), the value is remembered here so the
// admin does not see it revert, and it is applied to every user read on this device.
import { safeLocalStorage as storage } from '@/utils/safeStorage';

const KEY = 'staff_overrides_v1';

function readAll() {
  try {
    const parsed = JSON.parse(storage.getItem(KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(all) {
  try {
    storage.setItem(KEY, JSON.stringify(all));
  } catch { /* storage full or blocked */ }
}

export function setStaffOverride(userId, patch) {
  if (!userId || !patch) return;
  const all = readAll();
  const prev = all[userId] || { values: {} };
  all[userId] = { at: Date.now(), values: { ...prev.values, ...patch } };
  writeAll(all);
}

export function clearStaffOverride(userId, fields) {
  const all = readAll();
  const entry = all[userId];
  if (!entry) return;
  const values = { ...entry.values };
  (fields || Object.keys(values)).forEach((f) => { delete values[f]; });
  if (Object.keys(values).length) all[userId] = { ...entry, values };
  else delete all[userId];
  writeAll(all);
}

/** Overlay locally remembered values unless the server row was changed after they were stored. */
export function applyStaffOverride(record) {
  if (!record || !record.id) return record;
  const entry = readAll()[record.id];
  if (!entry || !entry.values) return record;
  const updatedAt = Date.parse(record.updated_date || record.updated_at || '');
  if (Number.isFinite(updatedAt) && updatedAt > entry.at + 2000) return record;
  return { ...record, ...entry.values };
}

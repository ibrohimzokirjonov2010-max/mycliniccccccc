/**
 * Yagona funksiya (Vercel Hobby 12-funksiya limiti):
 *  - Ovozli AI agent uchun CRM API (X-Agent-Key bilan):  ?action=services|doctors|hours|slots|patient|appointment
 *  - Brauzer reminder servisi uchun Telegram proksi (faqat shu sayt origin'idan): ?action=telegram-send|telegram-updates
 * Klinika faqat AGENT_CLINIC_ID env'dan olinadi, hech qachon so'rovdan emas.
 */
import crypto from 'node:crypto';
import { supabaseAdmin } from './_lib/supabaseAdmin.js';
import { send, bodyOf } from './_lib/http.js';
import { decodeExt } from './_lib/clinicExt.js';
import { botToken } from './_lib/telegram.js';

const TZ_OFFSET_MIN = 5 * 60; // Asia/Tashkent, DST yo'q
const SLOT = 30;
const INACTIVE = ['cancelled', 'no-show', 'noshow', 'no_show'];
const hits = new Map();

const err = (res, status, error, message) => send(res, status, { ok: false, error, message });

function rateLimit(req, bucket, limit, windowMs = 60_000) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'ip').split(',')[0].trim();
  const key = `${bucket}|${ip}`;
  const now = Date.now();
  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) return false;
  arr.push(now);
  hits.set(key, arr);
  return true;
}

function keyOk(provided, expected) {
  const a = crypto.createHash('sha256').update(String(provided || '')).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b) && String(provided || '').length === String(expected).length;
}

function decodeTech(notes) {
  const s = typeof notes === 'string' ? notes : '';
  if (!s.startsWith('[TECH_DATA]')) return { tech: {}, userNotes: s };
  const end = s.indexOf('[END_TECH]');
  if (end === -1) return { tech: {}, userNotes: s };
  try {
    return { tech: JSON.parse(s.substring(11, end)) || {}, userNotes: s.substring(end + 10).replace(/^\n/, '') };
  } catch {
    return { tech: {}, userNotes: s };
  }
}
function withTech(row) {
  const { tech, userNotes } = decodeTech(row.notes);
  const m = { ...row, notes: userNotes };
  for (const [k, v] of Object.entries(tech)) if (m[k] == null || m[k] === '') m[k] = v;
  return m;
}

const pad = (n) => String(n).padStart(2, '0');
const toMin = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ''));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const fromMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const dayOf = (d) => String(d || '').slice(0, 10);
function tashkentNow() {
  const d = new Date(Date.now() + TZ_OFFSET_MIN * 60_000);
  return { date: d.toISOString().slice(0, 10), min: d.getUTCHours() * 60 + d.getUTCMinutes() };
}
function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ''))) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const last9 = (p) => String(p || '').replace(/\D/g, '').slice(-9);
const fmtPhone = (l9) => `+998 ${l9.slice(0, 2)} ${l9.slice(2, 5)} ${l9.slice(5, 7)} ${l9.slice(7, 9)}`;

function normalizeWorkHours(start, end) {
  let s = Number.parseInt(start, 10);
  let e = Number.parseInt(end, 10);
  if (!Number.isFinite(s) || s < 0 || s > 23) s = 8;
  if (!Number.isFinite(e) || e < 1 || e > 24) e = 24;
  if (e <= s) e = Math.min(24, s + 1);
  return { start: s, end: e };
}

async function loadClinic(db, clinicId) {
  const { data, error } = await db.from('clinics').select('id,name,logo,status,expires_at').eq('id', clinicId).maybeSingle();
  if (error || !data) return null;
  const { ext } = decodeExt(data.logo);
  return { ...data, ext };
}
function clinicHours(clinic) {
  const ext = clinic.ext || {};
  let h;
  if (ext.calendar_start_hour != null || ext.calendar_end_hour != null) {
    h = normalizeWorkHours(ext.calendar_start_hour, ext.calendar_end_hour);
  } else {
    const m = /(\d{1,2})[:.](\d{2})\s*[-–—]\s*(\d{1,2})[:.](\d{2})/.exec(String(ext.working_hours || ''));
    h = m ? normalizeWorkHours(m[1], Number(m[3]) === 0 ? 24 : m[3]) : normalizeWorkHours(undefined, undefined);
  }
  return { startMin: h.start * 60, endMin: h.end * 60, start: `${pad(h.start)}:00`, end: `${pad(h.end)}:00` };
}

async function dayAppointments(db, clinicId, doctorId, date) {
  const { data, error } = await db
    .from('appointments')
    .select('id,doctor_id,date,time,duration,duration_minutes,status,notes')
    .eq('clinic_id', clinicId)
    .eq('doctor_id', doctorId)
    .gte('date', `${date}T00:00:00+00:00`)
    .lte('date', `${date}T23:59:59+00:00`);
  if (error) throw error;
  return (data || [])
    .map(withTech)
    .filter((a) => dayOf(a.date) === date && !INACTIVE.includes(String(a.status || '').toLowerCase()))
    .map((a) => {
      const s = toMin(a.time);
      return s == null ? null : { start: s, end: s + (parseInt(a.duration, 10) || 30) };
    })
    .filter(Boolean);
}
function freeSlots(hours, busy, date, dur) {
  const now = tashkentNow();
  const out = [];
  for (let t = hours.startMin; t + dur <= hours.endMin; t += SLOT) {
    if (date === now.date && t <= now.min) continue;
    if (busy.some((b) => t < b.end && t + dur > b.start)) continue;
    out.push(fromMin(t));
  }
  return out;
}

async function getDoctor(db, clinicId, id) {
  const { data, error } = await db.from('users').select('id,name,full_name,specialty,role').eq('clinic_id', clinicId).eq('id', String(id || '')).maybeSingle();
  if (error) throw error;
  return data && data.role === 'doctor' ? data : null;
}
async function getService(db, clinicId, id) {
  if (!id) return null;
  const { data, error } = await db.from('services').select('id,name,category,price,duration,duration_minutes,is_active').eq('clinic_id', clinicId).eq('id', String(id)).maybeSingle();
  if (error) throw error;
  return data || null;
}
const svcDur = (s) => parseInt(s?.duration, 10) || parseInt(s?.duration_minutes, 10) || 30;

async function findPatient(db, clinicId, l9) {
  // Telefonlar normallashtirilmagan ('+998 90 123 45 67', '901234567', ...): oxirgi 9 raqam bo'yicha JS'da solishtiramiz
  const rows = [];
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await db.from('patients').select('id,full_name,phone,notes,updated_date,created_date')
      .eq('clinic_id', clinicId).order('id', { ascending: true }).range(from, from + 999);
    if (error) throw error;
    for (const p of data || []) {
      const m = p.phone ? p : withTech(p);
      if (last9(m.phone) === l9) rows.push(m);
    }
    if (!data || data.length < 1000) break;
  }
  rows.sort((a, b) => String(b.updated_date || b.created_date || '').localeCompare(String(a.updated_date || a.created_date || '')));
  return { patient: rows[0] || null, multiple: rows.length > 1 };
}

/* ---------------- Agent actions ---------------- */

async function actServices(db, cid, req, res) {
  const { data, error } = await db.from('services').select('id,name,category,price,duration,duration_minutes,is_active').eq('clinic_id', cid);
  if (error) throw error;
  const q = String(req.query.q || '').toLowerCase();
  const cat = String(req.query.category || '').toLowerCase();
  const services = (data || [])
    .filter((s) => s.is_active !== false)
    .filter((s) => (!q || String(s.name).toLowerCase().includes(q)) && (!cat || String(s.category || '').toLowerCase() === cat))
    .map((s) => ({ id: s.id, name: s.name, category: s.category || null, price: Number(s.price) || 0, duration_minutes: svcDur(s) }))
    .sort((a, b) => String(a.category || '').localeCompare(String(b.category || '')) || String(a.name).localeCompare(String(b.name)));
  send(res, 200, { ok: true, currency: 'UZS', services });
}

async function actDoctors(db, cid, req, res) {
  const { data, error } = await db.from('users').select('id,name,full_name,specialty,role').eq('clinic_id', cid).eq('role', 'doctor');
  if (error) throw error;
  const doctors = (data || []).map((u) => ({ id: u.id, name: u.full_name || u.name, specialty: u.specialty || null }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
  send(res, 200, { ok: true, doctors });
}

async function actHours(db, cid, clinic, req, res) {
  const h = clinicHours(clinic);
  const ext = clinic.ext || {};
  send(res, 200, {
    ok: true,
    timezone: 'Asia/Tashkent',
    clinic: { name: clinic.name, address: ext.address || null, phone: ext.phone || null },
    work_hours: { start: h.start, end: h.end },
    calendar_start_hour: h.startMin / 60,
    calendar_end_hour: h.endMin / 60,
    working_hours_text: ext.working_hours || null,
    slot_minutes: SLOT,
    chairs_count: Number(ext.chairs_count) || null,
  });
}

async function actSlots(db, cid, clinic, req, res) {
  const { doctor_id: doctorId, date } = req.query;
  if (!doctorId || !validDate(date)) return err(res, 400, 'bad_request', "doctor_id va date (YYYY-MM-DD) kerak");
  if (date < tashkentNow().date) return err(res, 400, 'bad_request', "O'tgan sana");
  const doc = await getDoctor(db, cid, doctorId);
  if (!doc) return err(res, 404, 'not_found', 'Shifokor topilmadi');
  let dur = parseInt(req.query.duration, 10) || 0;
  if (req.query.service_id) {
    const s = await getService(db, cid, req.query.service_id);
    if (!s) return err(res, 404, 'not_found', 'Xizmat topilmadi');
    if (!dur) dur = svcDur(s);
  }
  if (!dur) dur = 30;
  if (dur < 5 || dur > 600) return err(res, 400, 'bad_request', 'duration noto‘g‘ri');
  const hours = clinicHours(clinic);
  const busy = await dayAppointments(db, cid, doc.id, date);
  send(res, 200, {
    ok: true, doctor_id: doc.id, date, duration_minutes: dur,
    work_hours: { start: hours.start, end: hours.end },
    free: freeSlots(hours, busy, date, dur),
    busy: busy.sort((a, b) => a.start - b.start).map((b) => ({ start: fromMin(b.start), end: fromMin(b.end) })),
  });
}

async function upcomingFor(db, cid, patientId) {
  const today = tashkentNow().date;
  const { data } = await db.from('appointments')
    .select('id,date,time,doctor_name,service_name,service,status,notes,duration')
    .eq('clinic_id', cid).eq('patient_id', patientId).gte('date', `${today}T00:00:00+00:00`).order('date', { ascending: true }).limit(20);
  return (data || []).map(withTech)
    .filter((a) => !INACTIVE.includes(String(a.status || '').toLowerCase()) && String(a.status || '') !== 'Completed')
    .map((a) => ({ id: a.id, date: dayOf(a.date), time: a.time || null, doctor_name: a.doctor_name || null, service_name: a.service_name || a.service || null, status: a.status || 'Scheduled' }))
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

async function actPatient(db, cid, req, res) {
  const l9 = last9(req.query.phone);
  if (l9.length < 9) return err(res, 400, 'bad_request', 'Telefon raqam kamida 9 raqam');
  const { patient, multiple } = await findPatient(db, cid, l9);
  if (!patient) return send(res, 200, { ok: true, found: false });
  const out = { ok: true, found: true, patient: { id: patient.id, full_name: patient.full_name, phone: patient.phone }, upcoming: await upcomingFor(db, cid, patient.id) };
  if (multiple) out.multiple = true;
  send(res, 200, out);
}

async function actAppointment(db, cid, clinic, req, res) {
  const b = bodyOf(req);
  const name = String(b.name || b.full_name || '').trim().slice(0, 120);
  const l9 = last9(b.phone);
  const date = String(b.date || '');
  const time = String(b.time || '');
  const idem = String(b.idempotency_key || '').trim().slice(0, 120);
  if (!name || l9.length < 9 || !b.doctor_id || !validDate(date) || !/^\d{2}:\d{2}$/.test(time) || !idem) {
    return err(res, 400, 'bad_request', 'name, phone, doctor_id, date (YYYY-MM-DD), time (HH:MM), idempotency_key kerak');
  }
  // Idempotentlik: kalit TECH_DATA ichida saqlanadi
  const idemNeedle = `"agent_idempotency_key":${JSON.stringify(idem)}`;
  const { data: dup } = await db.from('appointments').select('*').eq('clinic_id', cid).like('notes', `%${idemNeedle.replace(/[%_\\]/g, '\\$&')}%`).limit(1);
  if (dup && dup.length) {
    const a = withTech(dup[0]);
    return send(res, 200, { ok: true, idempotent_replay: true, created_patient: false, appointment: apptOut(a) });
  }
  const doc = await getDoctor(db, cid, b.doctor_id);
  if (!doc) return err(res, 404, 'not_found', 'Shifokor topilmadi');
  let svc = null;
  if (b.service_id) {
    svc = await getService(db, cid, b.service_id);
    if (!svc || svc.is_active === false) return err(res, 404, 'not_found', 'Xizmat topilmadi');
  }
  const dur = parseInt(b.duration_minutes, 10) || (svc ? svcDur(svc) : 30);
  const hours = clinicHours(clinic);
  const start = toMin(time);
  const now = tashkentNow();
  if (start == null || start % 1 !== 0) return err(res, 400, 'bad_request', 'time noto‘g‘ri');
  if (date < now.date || (date === now.date && start <= now.min)) return err(res, 400, 'bad_request', "O'tgan vaqt");
  const busy = await dayAppointments(db, cid, doc.id, date);
  const outside = start < hours.startMin || start + dur > hours.endMin;
  if (outside || busy.some((x) => start < x.end && start + dur > x.start)) {
    return send(res, 409, { ok: false, error: 'slot_taken', message: outside ? 'Ish vaqtidan tashqarida' : 'Bu vaqt band', alternatives: freeSlots(hours, busy, date, dur).slice(0, 6) });
  }

  let { patient } = await findPatient(db, cid, l9);
  let createdPatient = false;
  const nowIso = new Date().toISOString();
  if (!patient) {
    const parts = name.split(/\s+/);
    const row = { id: `patient-${crypto.randomUUID()}`, clinic_id: cid, full_name: name, first_name: parts[0] || name, last_name: parts.slice(1).join(' ') || null, phone: fmtPhone(l9), status: 'Active', source: 'AI Voice', created_date: nowIso, updated_date: nowIso };
    const { data, error } = await db.from('patients').insert(row).select('id,full_name,phone').single();
    if (error) throw error;
    patient = data;
    createdPatient = true;
  }
  const userNotes = `[AI ovozli agent]${b.notes ? ' ' + String(b.notes).slice(0, 500) : ''}`;
  const price = svc ? Number(svc.price) || 0 : 0;
  const tech = {
    patient_name: patient.full_name, patient_phone: patient.phone || fmtPhone(l9), doctor_name: doc.full_name || doc.name,
    ...(svc ? { service_name: svc.name } : {}), price, duration: dur, status: 'Scheduled', notes: userNotes, date, time,
    agent_idempotency_key: idem,
  };
  const appt = {
    id: `appointment-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`,
    clinic_id: cid, patient_id: patient.id, patient_name: tech.patient_name, patient_phone: tech.patient_phone,
    doctor_id: doc.id, doctor_name: tech.doctor_name, service_id: svc?.id || null, service_name: svc?.name || null, service: svc?.name || null,
    price, date, time, duration: dur, duration_minutes: dur, status: 'Scheduled',
    notes: `[TECH_DATA]${JSON.stringify(tech)}[END_TECH]\n${userNotes}`,
    created_date: nowIso, updated_date: nowIso,
  };
  // Poyga holati uchun oxirgi tekshiruv
  const busy2 = await dayAppointments(db, cid, doc.id, date);
  if (busy2.some((x) => start < x.end && start + dur > x.start)) {
    return send(res, 409, { ok: false, error: 'slot_taken', message: 'Bu vaqt band', alternatives: freeSlots(hours, busy2, date, dur).slice(0, 6) });
  }
  const { data: ins, error } = await db.from('appointments').insert(appt).select('*').single();
  if (error) throw error;
  console.log('[agent] appointment created', ins.id);
  send(res, 201, { ok: true, created_patient: createdPatient, appointment: apptOut(withTech(ins)) });
}
function apptOut(a) {
  return { id: a.id, patient_id: a.patient_id, doctor_id: a.doctor_id, doctor_name: a.doctor_name || null, service_name: a.service_name || null, price: Number(a.price) || 0, date: dayOf(a.date), time: a.time, duration_minutes: parseInt(a.duration, 10) || 30, status: a.status };
}

/* ---------------- Telegram proksi (brauzer reminder servisi uchun) ---------------- */

function sameOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const src = req.headers.origin || req.headers.referer;
  if (!host || !src) return false;
  try { return new URL(src).host === host; } catch { return false; }
}

async function tgSend(req, res) {
  if (req.method !== 'POST') return err(res, 405, 'method_not_allowed');
  if (!rateLimit(req, 'tg-send', 60)) return err(res, 429, 'too_many_requests');
  const b = bodyOf(req);
  const chatId = String(b.chat_id || '').trim();
  const text = String(b.text || '');
  if (!/^-?\d{3,20}$/.test(chatId) || !text || text.length > 4000) return err(res, 400, 'bad_request');
  const payload = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (b.reply_markup && typeof b.reply_markup === 'object') payload.reply_markup = b.reply_markup;
  const r = await fetch(`https://api.telegram.org/bot${botToken()}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  const d = await r.json().catch(() => ({}));
  if (d.ok) return send(res, 200, { ok: true, message_id: d.result?.message_id ?? null });
  send(res, r.status === 401 ? 401 : 502, { ok: false, error: 'telegram_failed', telegram_status: r.status, description: d.description || null });
}

async function tgUpdates(req, res) {
  if (req.method !== 'GET') return err(res, 405, 'method_not_allowed');
  if (!rateLimit(req, 'tg-upd', 30)) return err(res, 429, 'too_many_requests');
  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const url = `https://api.telegram.org/bot${botToken()}/getUpdates?offset=${offset}&timeout=0&limit=20&allowed_updates=${encodeURIComponent('["message","callback_query"]')}`;
  const r = await fetch(url);
  if (!r.ok) return send(res, 200, { ok: false, telegram_status: r.status });
  const d = await r.json().catch(() => ({}));
  // Minimal ma'lumot: faqat /start xabarlari uchun chat_id va ism
  const updates = (Array.isArray(d.result) ? d.result : []).map((u) => {
    const m = u.message;
    const isStart = m && typeof m.text === 'string' && m.text.trim().startsWith('/start');
    return isStart ? { update_id: u.update_id, chat_id: m.chat?.id ?? null, first_name: m.from?.first_name || m.chat?.first_name || '', text: '/start' } : { update_id: u.update_id };
  });
  send(res, 200, { ok: true, updates });
}

/* ---------------- Router ---------------- */

export default async function handler(req, res) {
  const action = String(req.query?.action || '');
  try {
    if (action === 'telegram-send' || action === 'telegram-updates') {
      if (!sameOrigin(req)) return err(res, 403, 'forbidden_origin');
      if (!botToken()) return send(res, 200, { ok: false, error: 'not_configured', telegram_status: 409 });
      return action === 'telegram-send' ? await tgSend(req, res) : await tgUpdates(req, res);
    }

    const expected = process.env.AGENT_API_KEY;
    const cid = process.env.AGENT_CLINIC_ID;
    if (!expected || !cid) return err(res, 503, 'not_configured', 'Agent API sozlanmagan');
    if (!keyOk(req.headers['x-agent-key'], expected)) return err(res, 401, 'unauthorized', 'Kalit noto‘g‘ri');
    if (!rateLimit(req, 'agent', 120)) return err(res, 429, 'too_many_requests');

    const db = supabaseAdmin();
    if (!db) return err(res, 503, 'not_configured', 'DB sozlanmagan');
    const clinic = await loadClinic(db, cid);
    if (!clinic) return err(res, 503, 'not_configured', 'Klinika topilmadi');
    if (String(clinic.status || 'Active') !== 'Active' || (clinic.expires_at && dayOf(clinic.expires_at) < tashkentNow().date)) {
      return err(res, 403, 'clinic_inactive', 'Klinika faol emas');
    }

    const isGet = req.method === 'GET';
    if (action === 'appointment') {
      if (req.method !== 'POST') return err(res, 405, 'method_not_allowed');
      return await actAppointment(db, cid, clinic, req, res);
    }
    if (!isGet) return err(res, 405, 'method_not_allowed');
    switch (action) {
      case 'services': return await actServices(db, cid, req, res);
      case 'doctors': return await actDoctors(db, cid, req, res);
      case 'hours': return await actHours(db, cid, clinic, req, res);
      case 'slots': return await actSlots(db, cid, clinic, req, res);
      case 'patient': return await actPatient(db, cid, req, res);
      default: return err(res, 400, 'bad_request', 'Noma’lum action');
    }
  } catch (e) {
    console.error('[agent] error', action, e?.message || e);
    return err(res, 500, 'server_error', 'Server xatosi');
  }
}

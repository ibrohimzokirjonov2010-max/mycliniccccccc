/**
 * Printable "Davolash rejasi" PDF (plan-pdf-1014 design).
 * Renders an off-screen HTML A4 sheet (browser fonts → correct o‘ / g‘ / Cyrillic),
 * rasterises it with html2canvas and saves it with jsPDF as Reja-<name>.pdf.
 * Read-only: it never writes plan / patient / payment data.
 */
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { base44 } from '@/api/base44Client';
import { internalIdToFdi } from '@/lib/fdiNotation';
import { formatDoctorName } from '@/lib/displayText';
import { planAllocatedPaid } from '@/lib/treatmentDelete';

const TEAL = '#0d9488';
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0|\u202f|,/g, ' ');
const fmtDate = (v) => {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};
const fmtPhone = (v) => {
  const raw = String(v || '').trim();
  const d = raw.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 9) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  return raw;
};
const ageOf = (v) => {
  const d = new Date(v);
  if (!v || Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a -= 1;
  return a >= 0 && a < 130 ? a : null;
};

export function planStatusLabel(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('complete') || s.includes('yakun') || s.includes('bajar')) return { label: 'Yakunlangan', bg: '#dcfce7', fg: '#15803d' };
  if (s.includes('progress') || s.includes('jarayon')) return { label: 'Jarayonda', bg: '#fef3c7', fg: '#b45309' };
  return { label: 'Rejalashtirilgan', bg: '#dbeafe', fg: '#1d4ed8' };
}

/** Service / plan tooth value → FDI label ("22", "general" → ''). */
function toothLabel(v) {
  const raw = String(v ?? '').trim();
  if (!raw || raw === 'general') return '';
  return internalIdToFdi(raw) || raw;
}

/** Chart position for an FDI number (primary teeth map to the same adult slot). */
function chartSlot(n) {
  const q = Math.floor(n / 10);
  const d = n % 10;
  const map = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 1, 6: 2, 7: 3, 8: 4 };
  if (!map[q] || d < 1 || d > 8) return null;
  return map[q] * 10 + d;
}

function plannedTeeth(plan) {
  const set = new Set();
  const add = (s) => String(s || '').split(/[^0-9a-z]+/i).forEach((part) => {
    const lbl = toothLabel(part);
    const n = parseInt(lbl, 10);
    const slot = Number.isFinite(n) ? chartSlot(n) : null;
    if (slot) set.add(slot);
  });
  add(plan.tooth_number);
  (plan.services || []).forEach((s) => add(s.tooth_number || s.tooth));
  return set;
}

const imgCache = new Map();
function loadImg(src) {
  if (!imgCache.has(src)) {
    imgCache.set(src, new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    }));
  }
  return imgCache.get(src);
}

/** Tooth PNG → data URL, optionally tinted (planned / legend colours). */
async function toothDataUrl(fdi, tint) {
  const img = await loadImg(`/teeth/healthy/${fdi}.png`);
  if (!img) return '';
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  if (tint) {
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = tint.alpha;
    ctx.fillStyle = tint.color;
    ctx.fillRect(0, 0, c.width, c.height);
  }
  return c.toDataURL('image/png');
}

async function loadClinic() {
  let cached = {};
  try { cached = JSON.parse(localStorage.getItem('clinic_settings') || '{}') || {}; } catch { /* ignore */ }
  let clinic = null;
  try {
    const id = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id');
    if (id) clinic = await base44.clinic.getById(id);
  } catch { /* offline: use cache */ }
  const c = { ...cached, ...(clinic || {}) };
  return {
    name: c.name || 'My Clinic',
    subtitle: c.subtitle || 'Stomatologiya tizimi',
    address: c.address || '',
    phone: fmtPhone(c.phone),
    email: c.email || '',
    website: c.website || c.site || '',
  };
}

async function loadPatient(plan, patients) {
  let p = (patients || []).find((x) => String(x.id) === String(plan.patient_id));
  if (!p && plan.patient_id) {
    try { p = await base44.entities.Patient.get(plan.patient_id); } catch { p = null; }
  }
  return p || {};
}

const ICONS = {
  pin: `<svg width="14" height="14" viewBox="0 0 24 24" fill="${TEAL}"><path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>`,
  phone: `<svg width="14" height="14" viewBox="0 0 24 24" fill="${TEAL}"><path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1z"/></svg>`,
  mail: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${TEAL}" stroke-width="2"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  web: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${TEAL}" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18"/></svg>`,
  user: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${TEAL}" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/></svg>`,
  doc: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${TEAL}" stroke-width="2"><path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>`,
  tooth: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${TEAL}" stroke-width="2"><path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7 .5 3 1 6.5 3 6.5s2-5 4-5 2 5 4 5 2.5-3.5 3-6.5c.5-2.5 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z"/></svg>`,
  toothFill: `<svg width="18" height="18" viewBox="0 0 24 24" fill="${TEAL}"><path d="M7 3c-2.5 0-4 2-4 4.5 0 3 1.5 4.5 2 7 .5 3 1 6.5 3 6.5s2-5 4-5 2 5 4 5 2.5-3.5 3-6.5c.5-2.5 2-4 2-7C21 5 19.5 3 17 3c-2 0-3 1-5 1S9 3 7 3z"/></svg>`,
  sm: (d) => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2">${d}</svg>`,
};
const SMALL = {
  user: ICONS.sm('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>'),
  phone: ICONS.sm('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>'),
  cal: ICONS.sm('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>'),
  doctor: ICONS.sm('<circle cx="12" cy="7" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2M9 15l3 3 3-3"/>'),
  doc: ICONS.sm('<path d="M14 3H6v18h12V7z"/><path d="M9 13h6M9 17h6"/>'),
  status: ICONS.sm('<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m9 12 2 2 4-4"/>'),
  teeth: ICONS.sm('<path d="M7 4c-2 0-3 1.5-3 3.5 0 2.5 1 3.5 1.5 5.5S6 18 7.5 18 9 14 12 14s3 4 4.5 4 1.5-3 2-5 1.5-3 1.5-5.5C20 5.5 19 4 17 4c-1.5 0-2.5.8-5 .8S8.5 4 7 4z"/>'),
  clock: ICONS.sm('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
};

function logoSvg() {
  return `<svg width="52" height="52" viewBox="0 0 64 64"><defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14b8a6"/><stop offset="1" stop-color="#0f766e"/></linearGradient></defs>
  <path d="M18 6C9 6 4 13 4 22c0 10 5 15 7 24 2 9 3 14 8 14 6 0 5-16 13-16s7 16 13 16c5 0 6-5 8-14 2-9 7-14 7-24 0-9-5-16-14-16-6 0-9 3-14 3S24 6 18 6z" fill="url(#lg)"/>
  <path d="M22 14c-6 0-9 4-9 9 0 7 4 10 5 17 1 6 2 9 4 9 3 0 3-11 10-11s7 11 10 11c2 0 3-3 4-9 1-7 5-10 5-17 0-5-3-9-9-9-4 0-6 2-10 2s-6-2-10-2z" fill="#fff"/></svg>`;
}

function buildHtml(d) {
  const row = (icon, k, v, bold) => `<tr><td style="width:22px;padding:5px 0">${icon}</td><td style="color:#475569;width:125px;padding:5px 0">${k}</td><td style="color:#0f172a;padding:5px 0;${bold ? 'font-weight:700' : 'font-weight:500'}">${v}</td></tr>`;
  const card = (icon, title, body, extra = '') => `<div style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#fff;${extra}">
    <div style="background:#f0f9fb;padding:9px 14px;display:flex;align-items:center;gap:10px;font-weight:700;font-size:12.5px;color:#0f3b4a;letter-spacing:.3px">${icon}<span>${title}</span></div>
    <div style="padding:8px 14px 10px">${body}</div></div>`;

  const toothCell = (fdi, upper) => {
    const on = d.planned.has(fdi);
    const img = d.toothImgs[fdi] ? `<img src="${d.toothImgs[fdi]}" style="height:56px;max-width:27px;object-fit:contain;display:block;margin:0 auto"/>` : '';
    const num = `<div style="font-size:9.5px;color:${on ? TEAL : '#475569'};font-weight:${on ? 800 : 500};text-align:center;height:14px">${fdi}</div>`;
    return `<td style="width:28.5px;padding:0;vertical-align:${upper ? 'bottom' : 'top'};${fdi === 21 || fdi === 31 ? 'border-left:1px solid #cbd5e1;' : ''}">${upper ? num + img : img + num}</td>`;
  };
  const chart = `<table style="border-collapse:collapse"><tr><td style="font-size:11px;color:#334155;width:42px;vertical-align:middle">Yuqori<br/>jag‘</td>${UPPER.map((f) => toothCell(f, true)).join('')}</tr>
    <tr><td style="height:8px"></td></tr>
    <tr><td style="font-size:11px;color:#334155;vertical-align:middle">Pastki<br/>jag‘</td>${LOWER.map((f) => toothCell(f, false)).join('')}</tr></table>`;
  const legendItem = (src, t) => `<div style="display:flex;align-items:center;gap:8px;margin:9px 0;font-size:10.5px;color:#334155">${src ? `<img src="${src}" style="height:24px;width:14px;object-fit:contain"/>` : ''}<span>${t}</span></div>`;
  const legend = `<div style="border-left:1px solid #e2e8f0;padding-left:12px;width:140px"><div style="font-weight:700;font-size:11px;margin-bottom:4px">Belgilar:</div>
    ${legendItem(d.legend.planned, 'Davolash rejadagi tish')}${legendItem(d.legend.healthy, 'Sog‘lom tish')}${legendItem(d.legend.treated, 'Davolangan tish')}${legendItem(d.legend.problem, 'Muammoli tish')}</div>`;

  const th = (t, align = 'left', w = '') => `<th style="text-align:${align};padding:8px 10px;font-weight:600;color:#334155;${w ? `width:${w};` : ''}border-bottom:1px solid #e2e8f0;background:#f8fafc">${t}</th>`;
  const td = (t, align = 'left') => `<td style="text-align:${align};padding:6px 10px;border-bottom:1px solid #eef2f7;color:#0f172a">${t}</td>`;
  const rows = d.services.length
    ? d.services.map((s, i) => `<tr>${td(i + 1)}${td(esc(s.name))}${td(esc(s.tooth || '—'), 'center')}${td(s.qty, 'center')}${td(money(s.price), 'right')}${td(money(s.sum), 'right')}</tr>`).join('')
    : `<tr>${td('—')}<td colspan="5" style="padding:8px 10px;color:#94a3b8">Xizmatlar kiritilmagan</td></tr>`;

  const contact = (icon, text) => text ? `<div style="display:flex;align-items:flex-start;gap:8px;margin:3px 0">${icon}<span>${esc(text)}</span></div>` : '';
  const footItem = (icon, text) => text ? `<div style="display:flex;align-items:center;gap:6px">${icon}<span>${esc(text)}</span></div>` : '';
  const st = d.status;

  return `<div style="width:794px;min-height:1123px;box-sizing:border-box;padding:22px 34px 18px;background:#fff;font-family:Inter,'Segoe UI',Roboto,Arial,sans-serif;font-size:11.5px;color:#0f172a;position:relative;overflow:hidden;display:flex;flex-direction:column">
  <div style="position:absolute;right:-60px;top:-80px;width:330px;height:190px;border-radius:50%;background:#eef8fa"></div>
  <div style="position:relative;display:flex;align-items:center;padding-bottom:12px;border-bottom:2px solid ${TEAL}">
    <div style="display:flex;align-items:center;gap:10px;padding-right:18px;border-right:1px solid #e2e8f0">${logoSvg()}
      <div><div style="font-size:24px;font-weight:800;color:#0f4c5c;line-height:1">${esc(d.clinic.name)}</div><div style="font-size:9.5px;letter-spacing:1.6px;color:${TEAL};font-weight:700;margin-top:5px;text-transform:uppercase">${esc(d.clinic.subtitle)}</div></div></div>
    <div style="padding-left:18px;font-size:10.5px;color:#334155;flex:1">${contact(ICONS.pin, d.clinic.address)}${contact(ICONS.phone, d.clinic.phone)}${contact(ICONS.mail, d.clinic.email)}</div>
    <div style="font-family:'Brush Script MT','Segoe Script',cursive;font-style:italic;color:#475569;font-size:19px;transform:rotate(-8deg);text-align:right;line-height:1.15">Sog‘lom tabassum<br/>— baxtli hayot!</div>
  </div>

  <div style="position:relative;display:flex;justify-content:space-between;align-items:center;margin:16px 0 14px">
    <div><div style="font-size:27px;font-weight:800;letter-spacing:.3px;color:#0b1f33">DAVOLASH REJASI</div><div style="color:#64748b;font-size:12.5px;margin-top:2px">Bemor uchun individual davolash rejasi</div></div>
    <div style="background:#eef6f9;border-radius:10px;padding:10px 18px;display:flex;gap:12px;align-items:center"><div style="background:#d5eef0;border-radius:8px;padding:6px">${ICONS.doc}</div>
      <div><div style="font-weight:700;font-size:12px">Reja raqami: ${esc(d.docNo)}</div><div style="color:#475569;margin-top:3px">Sana: ${esc(d.date)}</div></div></div>
  </div>

  <div style="display:flex;gap:12px">
    ${card(ICONS.user, 'BEMOR MA’LUMOTLARI', `<table style="border-collapse:collapse;width:100%">${row(SMALL.user, 'Bemor:', esc(d.patient.name).toUpperCase())}${row(SMALL.phone, 'Telefon:', esc(d.patient.phone || '—'))}${row(SMALL.cal, 'Tug‘ilgan sana:', esc(d.patient.birth || '—'))}${row(SMALL.doctor, 'Shifokor:', esc(d.doctor || '—'), true)}</table>`, 'flex:1')}
    ${card(ICONS.doc, 'REJA MA’LUMOTLARI', `<table style="border-collapse:collapse;width:100%">${row(SMALL.doc, 'Reja nomi:', esc(d.planName), true)}${row(SMALL.status, 'Holat:', `<span style="background:${st.bg};color:${st.fg};padding:3px 10px;border-radius:999px;font-weight:600;font-size:10.5px">${st.label}</span>`)}${row(SMALL.teeth, 'Tishlar:', esc(d.teeth || '—'))}${row(SMALL.clock, 'Reja tuzilgan sana:', esc(d.created || '—'))}</table>`, 'flex:1')}
  </div>

  <div style="margin-top:12px">${card(ICONS.tooth, 'DAVOLANADIGAN TISHLAR', `<div style="display:flex;align-items:center;justify-content:space-between">${chart}${legend}</div>`)}</div>

  <div style="margin-top:12px">${card(ICONS.toothFill, 'DAVOLASH XIZMATLARI', `<table style="border-collapse:collapse;width:100%;font-size:11px;margin:-2px 0"><tr>${th('№', 'left', '34px')}${th('Xizmat nomi')}${th('Tish', 'center', '70px')}${th('Soni', 'center', '60px')}${th('Narx (UZS)', 'right', '95px')}${th('Summa (UZS)', 'right', '105px')}</tr>${rows}</table>`)}</div>

  <div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="width:330px;border-radius:12px;background:#ecfbf8;border:1px solid #cdeee8;overflow:hidden">
    <div style="padding:10px 14px 4px;display:flex;justify-content:space-between;font-weight:700;color:#0f3b4a"><span>Jami summa:</span><span>${money(d.subtotal)} UZS</span></div>
    ${d.discount > 0 ? `<div style="padding:4px 14px;display:flex;justify-content:space-between;font-weight:700;color:${TEAL}"><span>Chegirma${d.discountPct ? ` (${d.discountPct}%)` : ''}:</span><span>- ${money(d.discount)} UZS</span></div>` : ''}
    <div style="margin-top:6px;padding:10px 14px;background:#d3f3ee;display:flex;justify-content:space-between;align-items:center;font-weight:800;color:#0f3b4a"><span style="font-size:14px">Yakuniy summa:</span><span style="font-size:18px">${money(d.total)} UZS</span></div></div></div>

  <div style="display:flex;gap:12px;margin-top:12px">
    <div style="flex:1;border-radius:12px;background:#ecfbf8;padding:12px 16px;display:flex;align-items:center;gap:14px"><div style="background:#d3f3ee;border-radius:8px;padding:6px">${ICONS.user}</div><div><div style="font-weight:600;color:#0f3b4a">To‘langan summa:</div><div style="font-size:15px;font-weight:800;margin-top:3px">${money(d.paid)} UZS</div></div></div>
    <div style="flex:1;border-radius:12px;background:#fff6eb;padding:12px 16px;display:flex;align-items:center;gap:14px"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><div><div style="font-weight:600;color:#ea8a0c">Qarz (qolgan summa):</div><div style="font-size:15px;font-weight:800;margin-top:3px;color:#ea8a0c">${money(d.remaining)} UZS</div></div></div>
  </div>

  <div style="margin-top:12px;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;display:flex;gap:14px;min-height:46px"><div style="background:#eef6f9;border-radius:8px;padding:6px;height:18px">${ICONS.doc}</div>
    <div><div style="font-weight:700;margin-bottom:4px">Izohlar</div><div style="color:#334155;line-height:1.55;white-space:pre-wrap">${esc(d.notes || '—')}</div></div></div>

  <div style="display:flex;justify-content:space-between;margin:26px 30px 0">
    <div><div style="display:flex;align-items:flex-end;gap:20px"><b>Shifokor:</b><div style="width:150px;border-bottom:1px solid #64748b"></div></div><div style="margin:8px 0 0 75px;color:#334155">${esc(d.doctor || '')}</div></div>
    <div><div style="display:flex;align-items:flex-end;gap:20px"><b>Bemor:</b><div style="width:170px;border-bottom:1px solid #64748b"></div></div><div style="margin:8px 0 0 58px;color:#334155">${esc(d.patient.name).toUpperCase()}</div></div>
  </div>

  <div style="margin-top:auto;padding-top:18px"></div><div style="border-top:2px solid ${TEAL};padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#334155">
    ${footItem(ICONS.pin, d.clinic.address)}${footItem(ICONS.phone, d.clinic.phone)}${footItem(ICONS.mail, d.clinic.email)}${footItem(ICONS.web, d.clinic.website)}</div>
</div>`;
}

/** Collects real data for the plan and builds the template data object. */
export async function collectPlanPdfData(plan, { patients } = {}) {
  const [clinic, patient, paidInfo] = await Promise.all([
    loadClinic(),
    loadPatient(plan, patients),
    planAllocatedPaid(plan).catch(() => ({ paidAmount: 0 })),
  ]);
  const services = (plan.services || []).map((s) => {
    const qty = Math.max(1, Number(s.quantity || s.qty || s.count) || 1);
    const price = Number(s.price) || 0;
    return { name: s.service_name || s.name || 'Xizmat', tooth: toothLabel(s.tooth_number || s.tooth), qty, price, sum: price * qty };
  });
  const servicesSum = services.reduce((a, s) => a + s.sum, 0);
  const discount = Math.max(0, Number(plan.discount_amount) || 0);
  const total = Number(plan.total_price) || Math.max(0, servicesSum - discount);
  const subtotal = discount > 0 ? total + discount : (servicesSum || total);
  const paid = Number(paidInfo?.paidAmount) || 0;
  const birthRaw = patient.birth_date || patient.date_of_birth || '';
  const age = ageOf(birthRaw);
  const planned = plannedTeeth(plan);

  const tints = { planned: { color: TEAL, alpha: 0.75 }, treated: { color: '#94a3b8', alpha: 0.7 }, problem: { color: '#f472b6', alpha: 0.6 } };
  const fdis = [...UPPER, ...LOWER];
  const urls = await Promise.all(fdis.map((f) => toothDataUrl(f, planned.has(f) ? tints.planned : null)));
  const toothImgs = Object.fromEntries(fdis.map((f, i) => [f, urls[i]]));
  const [lp, lh, lt, lpr] = await Promise.all([toothDataUrl(11, tints.planned), toothDataUrl(11), toothDataUrl(11, tints.treated), toothDataUrl(11, tints.problem)]);

  const created = plan.created_date || plan.created_at;
  return {
    clinic,
    docNo: plan.plan_number || plan.number || String(plan.id || '').replace(/^.*[-_]/, '').slice(-6).toUpperCase() || '—',
    date: fmtDate(new Date()),
    patient: {
      name: patient.full_name || plan.patient_name || '—',
      phone: fmtPhone(patient.phone || patient.phone_number || ''),
      birth: birthRaw ? `${fmtDate(birthRaw)}${age != null ? ` (${age} yosh)` : ''}` : '',
    },
    doctor: plan.doctor_name ? formatDoctorName(plan.doctor_name) : '',
    planName: plan.name || 'Davolash rejasi',
    status: planStatusLabel(plan.status),
    teeth: plan.tooth_number || [...new Set(services.map((s) => s.tooth).filter(Boolean))].join(', '),
    created: fmtDate(created),
    services, subtotal, discount, discountPct: Number(plan.discount_percent) || 0, total, paid,
    remaining: Math.max(0, total - paid),
    notes: plan.description || plan.notes || '',
    planned, toothImgs,
    legend: { planned: lp, healthy: lh, treated: lt, problem: lpr },
  };
}

/** Builds the PDF; returns the jsPDF doc (does not save). */
export async function buildPlanPdf(plan, opts = {}) {
  const data = await collectPlanPdfData(plan, opts);
  const host = document.createElement('div');
  host.setAttribute('data-testid', 'plan-pdf-sheet');
  host.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;background:#fff';
  host.innerHTML = buildHtml(data);
  document.body.appendChild(host);
  try {
    if (document.fonts?.ready) await document.fonts.ready;
    const sheet = host.firstElementChild;
    // One A4 sheet when content fits; longer plans flow onto extra pages.
    if (sheet.scrollHeight <= 1123) sheet.style.height = '1123px';
    const top = sheet.getBoundingClientRect().top;
    const breaks = [...sheet.querySelectorAll('tr, :scope > div')].map((el) => el.getBoundingClientRect().bottom - top).sort((a, b) => a - b);
    const canvas = await html2canvas(host.firstElementChild, { scale: 2, backgroundColor: '#ffffff', useCORS: true, logging: false });
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210; const pageH = 297;
    const fullH = (canvas.height * pageW) / canvas.width;
    if (fullH <= pageH * 1.45) {
      // Fits on one sheet (long plans are scaled down slightly, centred).
      const scale = Math.min(1, pageH / fullH);
      const w = pageW * scale;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', (pageW - w) / 2, 0, w, fullH * scale);
    } else {
      const pxPerPage = Math.floor(canvas.width * (pageH / pageW));
      const k = canvas.width / sheet.offsetWidth;
      const cuts = breaks.map((b) => Math.round(b * k));
      for (let y = 0, page = 0; y < canvas.height - 4; page += 1) {
        let h = Math.min(pxPerPage, canvas.height - y);
        if (y + h < canvas.height) {
          const cut = cuts.filter((c) => c > y + pxPerPage * 0.5 && c <= y + pxPerPage).pop();
          if (cut) h = cut - y;
        }
        const slice = document.createElement('canvas');
        slice.width = canvas.width; slice.height = h;
        slice.getContext('2d').drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
        if (page > 0) pdf.addPage();
        pdf.addImage(slice.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pageW, (h * pageW) / canvas.width);
        y += h;
      }
    }
    return pdf;
  } finally {
    host.remove();
  }
}

export function planPdfFileName(plan) {
  return `Reja-${(plan.name || 'plan').replace(/\s+/g, '_')}.pdf`;
}

export async function downloadPlanPdf(plan, opts = {}) {
  const pdf = await buildPlanPdf(plan, opts);
  pdf.save(planPdfFileName(plan));
}

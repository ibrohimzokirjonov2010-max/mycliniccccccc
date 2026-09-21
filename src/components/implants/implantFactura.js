/** Implant Center-style treatment plan / factura helpers for wizard step 3. */

import { getServiceLabel, normalizeServiceId, looksLikeI18nKey } from './implantWizardLabels.js';

export const IMPLANT_WIZARD_FACTURA_MARKER = 'implant-step3-factura-v1-0d9488';

export const FAKTURA_JSON_START = '[FAKTURA_JSON]';
export const FAKTURA_JSON_END = '[/FAKTURA_JSON]';
export const FAKTURA_TEXT_START = '--- FAKTURA / DAVOLASH REJASI ---';
export const FAKTURA_TEXT_END = '--- /FAKTURA ---';

export const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_FDI = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

const STAGE2_IDS = new Set([
  'zirkon_crown',
  'zircon_crown',
  'metal_crown',
  'emax_crown',
  'veneer',
  'titan_frame',
  'zircon_std',
  'zircon_est',
  'zircon_pre',
]);

const PER_TOOTH_IDS = new Set([
  'implant',
  'zirkon_crown',
  'zircon_crown',
  'metal_crown',
  'emax_crown',
  'temp_crown',
  'veneer',
  'abutment',
  'standard_abutment',
  'zirkon_abutment',
  'healing_abutment',
  'formik',
  'cover_screw',
  'multi_unit',
  'extraction',
  'zircon_std',
  'zircon_est',
  'zircon_pre',
]);

const GENERIC_CLINIC = /^(shifocrm|my clinic|myclinic|dentacrm|denta crm|demo clinic)$/i;

export function formatSom(n) {
  const v = Math.round(Number(n) || 0);
  return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

export function toDMY(iso) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}.${m}.${y}`;
}

export function resolveClinicTitle(clinicName) {
  const raw = String(clinicName || '').trim();
  if (!raw || GENERIC_CLINIC.test(raw)) return 'Implant Center';
  return raw;
}

export function isStage2Service(id) {
  return STAGE2_IDS.has(normalizeServiceId(id));
}

export function defaultLineQty(id, teethCount, { selected = true, placeholder = false } = {}) {
  const n = normalizeServiceId(id);
  const teeth = Math.max(0, Number(teethCount) || 0);
  if (placeholder && !selected) return 0;
  if (n === 'operation_fee') return 1;
  if (n === 'titan_frame') return selected ? (teeth || 1) : 0;
  if (n === 'implant' || PER_TOOTH_IDS.has(n)) return teeth;
  return selected ? 1 : 0;
}

function catalogPrice(serviceId, extraServicesList, extraServicePrices) {
  const id = normalizeServiceId(serviceId);
  if (extraServicePrices && extraServicePrices[id] !== undefined) {
    return Number(extraServicePrices[id]) || 0;
  }
  if (extraServicePrices && extraServicePrices[serviceId] !== undefined) {
    return Number(extraServicePrices[serviceId]) || 0;
  }
  const found = (extraServicesList || []).find(
    (s) => normalizeServiceId(s.id) === id || s.id === serviceId
  );
  return Number(found?.defaultPrice ?? found?.price) || 0;
}

function lineTotal(unitPrice, qty) {
  return Math.max(0, Math.round(Number(unitPrice) || 0) * Math.max(0, Number(qty) || 0));
}

function applyEdit(base, edit) {
  const next = { ...base };
  if (edit && edit.unitPrice !== undefined && edit.unitPrice !== null && edit.unitPrice !== '') {
    next.unitPrice = Number(edit.unitPrice) || 0;
  }
  if (edit && edit.qty !== undefined && edit.qty !== null && edit.qty !== '') {
    next.qty = Math.max(0, Number(edit.qty) || 0);
  }
  next.total = lineTotal(next.unitPrice, next.qty);
  return next;
}

function makeLine({ id, label, unitPrice, qty, stage, source }) {
  return {
    id,
    label: looksLikeI18nKey(label) ? 'Xizmat' : String(label || 'Xizmat'),
    unitPrice: Number(unitPrice) || 0,
    qty: Math.max(0, Number(qty) || 0),
    total: lineTotal(unitPrice, qty),
    stage,
    source: source || 'auto',
  };
}

export function mapLineToExtraId(lineId) {
  const id = normalizeServiceId(lineId);
  if (!id || id === 'implant' || id === 'operation_fee' || id === 'titan_frame') return null;
  if (id === 'zircon_std' || id === 'zircon_est' || id === 'zircon_pre' || id === 'zircon_crown') {
    return 'zirkon_crown';
  }
  return id;
}

function zirconPlaceholders(t) {
  const label = (key, fallback) => {
    if (typeof t === 'function') {
      const v = t(`implants.wizard.factura.${key}`, fallback);
      return looksLikeI18nKey(v) ? fallback : v;
    }
    return fallback;
  };
  return [
    { id: 'zircon_std', label: label('zirconStd', 'Sirkoniy karonka (standart)'), defaultPrice: 1200000 },
    { id: 'zircon_est', label: label('zirconEst', 'Sirkoniy karonka (estetik)'), defaultPrice: 1500000 },
    { id: 'zircon_pre', label: label('zirconPre', 'Sirkoniy karonka (premium)'), defaultPrice: 2200000 },
  ];
}

/**
 * Build a filled IMPLANT CENTER factura document from wizard state.
 */
export function buildFacturaDocument({
  date,
  patientName,
  clinicName,
  selectedFdis = [],
  brandLabel,
  implantUnitPrice,
  extraServicesList = [],
  selectedServiceIds = [],
  extraServicePrices = {},
  edits = {},
  t,
} = {}) {
  const teeth = [...new Set((selectedFdis || []).map((n) => String(n).replace(/^#/, '')).filter(Boolean))];
  const teethCount = teeth.length;
  const selected = new Set((selectedServiceIds || []).map(normalizeServiceId).filter(Boolean));
  const used = new Set();

  const labelFor = (service, fallback) => {
    const fromHelper = getServiceLabel(service, t);
    if (fromHelper && !looksLikeI18nKey(fromHelper)) return fromHelper;
    return fallback;
  };

  const stage1 = [];
  const implantLine = applyEdit(
    makeLine({
      id: 'implant',
      label: brandLabel || 'Implant',
      unitPrice: Number(implantUnitPrice) || 0,
      qty: defaultLineQty('implant', teethCount, { selected: true }),
      stage: 1,
      source: 'implant',
    }),
    edits.implant
  );
  stage1.push(implantLine);

  (selectedServiceIds || []).forEach((rawId) => {
    const id = normalizeServiceId(rawId);
    if (!id || isStage2Service(id) || used.has(id)) return;
    used.add(id);
    const service = (extraServicesList || []).find((s) => normalizeServiceId(s.id) === id) || { id };
    const line = applyEdit(
      makeLine({
        id,
        label: labelFor(service, service.label || service.name || id),
        unitPrice: catalogPrice(id, extraServicesList, extraServicePrices),
        qty: defaultLineQty(id, teethCount, { selected: true }),
        stage: 1,
        source: 'extra',
      }),
      edits[id] || edits[rawId]
    );
    stage1.push(line);
  });

  const opLabel = typeof t === 'function'
    ? t('implants.wizard.factura.operationFee', 'Operatsion xarajatlar')
    : 'Operatsion xarajatlar';
  const operationLine = applyEdit(
    makeLine({
      id: 'operation_fee',
      label: looksLikeI18nKey(opLabel) ? 'Operatsion xarajatlar' : opLabel,
      unitPrice: catalogPrice('operation_fee', extraServicesList, extraServicePrices),
      qty: defaultLineQty('operation_fee', teethCount, { selected: true }),
      stage: 1,
      source: 'placeholder',
    }),
    edits.operation_fee
  );
  stage1.push(operationLine);

  const stage2 = [];
  (selectedServiceIds || []).forEach((rawId) => {
    const id = normalizeServiceId(rawId);
    if (!id || !isStage2Service(id) || used.has(id)) return;
    used.add(id);
    const service = (extraServicesList || []).find((s) => normalizeServiceId(s.id) === id) || { id };
    const line = applyEdit(
      makeLine({
        id,
        label: labelFor(service, service.label || service.name || id),
        unitPrice: catalogPrice(id, extraServicesList, extraServicePrices),
        qty: defaultLineQty(id, teethCount, { selected: true }),
        stage: 2,
        source: 'extra',
      }),
      edits[id] || edits[rawId]
    );
    stage2.push(line);
  });

  const titanLabel = typeof t === 'function'
    ? t('implants.wizard.factura.titanFrame', 'Titan karkas')
    : 'Titan karkas';
  if (![...used].some((id) => id === 'titan_frame')) {
    stage2.push(applyEdit(
      makeLine({
        id: 'titan_frame',
        label: looksLikeI18nKey(titanLabel) ? 'Titan karkas' : titanLabel,
        unitPrice: extraServicePrices.titan_frame !== undefined
          ? Number(extraServicePrices.titan_frame) || 0
          : 250000,
        qty: defaultLineQty('titan_frame', teethCount, { selected: false, placeholder: true }),
        stage: 2,
        source: 'placeholder',
      }),
      edits.titan_frame
    ));
  }

  if (!selected.has('veneer')) {
    const veneerService = (extraServicesList || []).find((s) => normalizeServiceId(s.id) === 'veneer');
    const veneerLabel = labelFor(veneerService || { id: 'veneer', label: 'Vinir' }, 'Vinir');
    stage2.push(applyEdit(
      makeLine({
        id: 'veneer',
        label: veneerLabel,
        unitPrice: catalogPrice('veneer', extraServicesList, extraServicePrices),
        qty: defaultLineQty('veneer', teethCount, { selected: false, placeholder: true }),
        stage: 2,
        source: 'placeholder',
      }),
      edits.veneer
    ));
  }

  if (!selected.has('metal_crown')) {
    const metalService = (extraServicesList || []).find((s) => normalizeServiceId(s.id) === 'metal_crown');
    stage2.push(applyEdit(
      makeLine({
        id: 'metal_crown',
        label: labelFor(metalService || { id: 'metal_crown', label: 'Metallokeramika' }, 'Metallokeramika'),
        unitPrice: catalogPrice('metal_crown', extraServicesList, extraServicePrices),
        qty: defaultLineQty('metal_crown', teethCount, { selected: false, placeholder: true }),
        stage: 2,
        source: 'placeholder',
      }),
      edits.metal_crown
    ));
  }

  const zirconSelected = selected.has('zirkon_crown') || selected.has('zircon_crown');
  if (!zirconSelected) {
    zirconPlaceholders(t).forEach((tier) => {
      stage2.push(applyEdit(
        makeLine({
          id: tier.id,
          label: tier.label,
          unitPrice: extraServicePrices[tier.id] !== undefined
            ? Number(extraServicePrices[tier.id]) || 0
            : catalogPrice('zirkon_crown', extraServicesList, extraServicePrices) || tier.defaultPrice,
          qty: defaultLineQty(tier.id, teethCount, { selected: false, placeholder: true }),
          stage: 2,
          source: 'placeholder',
        }),
        edits[tier.id]
      ));
    });
  }

  const stage1Total = stage1.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  const stage2Total = stage2.reduce((sum, line) => sum + (Number(line.total) || 0), 0);

  return {
    v: 1,
    date: date || '',
    patient_name: patientName || '',
    clinic: resolveClinicTitle(clinicName),
    teeth,
    brand: brandLabel || '',
    implant_unit_price: Number(implantLine.unitPrice) || 0,
    implant_qty: Number(implantLine.qty) || 0,
    stage1,
    stage2,
    stage1Total,
    stage2Total,
    grandTotal: stage1Total + stage2Total,
  };
}

export function extraIdsFromFactura(snapshot) {
  const ids = [];
  const prices = {};
  [...(snapshot?.stage1 || []), ...(snapshot?.stage2 || [])].forEach((line) => {
    if (!line || !(Number(line.qty) > 0)) return;
    const extraId = mapLineToExtraId(line.id);
    if (!extraId) return;
    if (!ids.includes(extraId)) ids.push(extraId);
    prices[extraId] = Number(line.unitPrice) || 0;
  });
  return { extraIds: ids, extraPrices: prices };
}

export function snapshotToEdits(snapshot) {
  const edits = {};
  [...(snapshot?.stage1 || []), ...(snapshot?.stage2 || [])].forEach((line) => {
    if (!line?.id) return;
    edits[line.id] = {
      qty: Number(line.qty) || 0,
      unitPrice: Number(line.unitPrice) || 0,
    };
  });
  return edits;
}

export function formatFacturaText(snapshot) {
  if (!snapshot) return '';
  const lines = [
    FAKTURA_TEXT_START,
    `Sana: ${snapshot.date || ''}`,
    `Bemor: ${snapshot.patient_name || ''}`,
    `Klinika: ${snapshot.clinic || 'Implant Center'}`,
    `Tishlar: ${(snapshot.teeth || []).map((n) => `#${n}`).join(', ') || '—'}`,
    `Brend: ${snapshot.brand || ''}`,
    '1-bosqich (jarrohlik / hozir):',
  ];
  (snapshot.stage1 || []).forEach((line) => {
    if (!line) return;
    lines.push(`  - ${line.label}: ${formatSom(line.unitPrice)} × ${line.qty} = ${formatSom(line.total)} so'm`);
  });
  lines.push(`  Jami 1-bosqich: ${formatSom(snapshot.stage1Total)} so'm`);
  lines.push("2-bosqich (2–3 oydan so'ng, narx aniqlashtiriladi):");
  (snapshot.stage2 || []).forEach((line) => {
    if (!line) return;
    lines.push(`  - ${line.label}: ${formatSom(line.unitPrice)} × ${line.qty} = ${formatSom(line.total)} so'm`);
  });
  lines.push(`  Jami 2-bosqich: ${formatSom(snapshot.stage2Total)} so'm`);
  lines.push("Eslatma: 1-bosqichdagi hisob 3 oy amal qiladi; 2-bosqich narxi implantatsiyadan so'ng 2–3 oy o'tib ish boshlanayotganda maslahatlashib aniqlanadi.");
  lines.push(FAKTURA_TEXT_END);
  return lines.join('\n');
}

export function encodeFacturaNotes(userNotes, snapshot) {
  const clean = stripFacturaFromNotes(userNotes);
  if (!snapshot) return clean;
  const jsonBlock = `${FAKTURA_JSON_START}${JSON.stringify(snapshot)}${FAKTURA_JSON_END}`;
  const textBlock = formatFacturaText(snapshot);
  return [clean, jsonBlock, textBlock].filter(Boolean).join('\n\n').trim();
}

export function stripFacturaFromNotes(notes) {
  let text = String(notes || '');
  const jsonStart = text.indexOf(FAKTURA_JSON_START);
  if (jsonStart >= 0) {
    const jsonEnd = text.indexOf(FAKTURA_JSON_END, jsonStart);
    if (jsonEnd >= 0) {
      text = text.slice(0, jsonStart) + text.slice(jsonEnd + FAKTURA_JSON_END.length);
    }
  }
  const textStart = text.indexOf(FAKTURA_TEXT_START);
  if (textStart >= 0) {
    const textEnd = text.indexOf(FAKTURA_TEXT_END, textStart);
    if (textEnd >= 0) {
      text = text.slice(0, textStart) + text.slice(textEnd + FAKTURA_TEXT_END.length);
    }
  }
  return text.replace(/\n{3,}/g, '\n\n').trim();
}

export function parseFacturaSnapshot(record) {
  if (!record) return null;
  if (record.factura && typeof record.factura === 'object' && Array.isArray(record.factura.stage1)) {
    return record.factura;
  }
  const notes = String(record.notes || '');
  const start = notes.indexOf(FAKTURA_JSON_START);
  if (start < 0) return null;
  const end = notes.indexOf(FAKTURA_JSON_END, start);
  if (end < 0) return null;
  try {
    const parsed = JSON.parse(notes.slice(start + FAKTURA_JSON_START.length, end));
    if (parsed && Array.isArray(parsed.stage1)) return parsed;
  } catch {
    return null;
  }
  return null;
}

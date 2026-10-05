/** Implant Center-style treatment plan / factura helpers for wizard step 3. */

import { getServiceLabel, normalizeServiceId, looksLikeI18nKey } from './implantWizardLabels.js';
import { toImplantFdi } from '../../lib/fdiNotation.js';

export const IMPLANT_WIZARD_FACTURA_MARKER = 'implant-step3-factura-overlay-v2-0d9488';

export const FAKTURA_JSON_START = '[FAKTURA_JSON]';
export const FAKTURA_JSON_END = '[/FAKTURA_JSON]';
export const FAKTURA_TEXT_START = '--- FAKTURA / DAVOLASH REJASI ---';
export const FAKTURA_TEXT_END = '--- /FAKTURA ---';

export const UPPER_FDI = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
export const LOWER_FDI = [38, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47, 48];

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

export function formatImplantSize(diameter, length) {
  const d = String(diameter ?? '').trim().replace(/^[Øø]\s*/u, '');
  const l = String(length ?? '').trim().replace(/^[Ll]\s*/, '');
  if (d && l) return `Ø${d}×L${l}`;
  if (d) return `Ø${d}`;
  if (l) return `L${l}`;
  return '';
}

export function summarizeToothLines(rows = []) {
  return (rows || []).map((row) => {
    const fdi = String(row?.fdi || '').replace(/^#/, '');
    const brand = String(row?.brand || '').trim();
    const diameter = String(row?.diameter ?? '').trim();
    const length = String(row?.length ?? '').trim();
    return {
      fdi,
      brand,
      diameter,
      length,
      size: formatImplantSize(diameter, length),
    };
  }).filter((row) => row.fdi);
}

function implantLineLabel(brandLabel, lines) {
  const brands = [...new Set((lines || []).map((row) => row.brand).filter(Boolean))];
  const sizes = [...new Set((lines || []).map((row) => row.size).filter(Boolean))];
  const brand = brands.length <= 1 ? (brands[0] || brandLabel || 'Implant') : (brandLabel || brands[0] || 'Implant');
  if (sizes.length === 1) return `${brand} · ${sizes[0]}`;
  return brand || 'Implant';
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

/** Stage-2 crown choices. One tooth gets one of these unless the clinician picked a smaller set on purpose. */
export const EXCLUSIVE_CROWN_IDS = ['metal_crown', 'zirkon_crown', 'emax_crown'];

/** Untouched catalog stickers. All three at these prices means the option list was saved as if it were selected. */
export const CROWN_CATALOG_STICKER = {
  metal_crown: 800000,
  zirkon_crown: 1500000,
  emax_crown: 1800000,
};

export function exclusiveCrownId(raw) {
  const id = normalizeServiceId(raw);
  if (id === 'zircon_crown' || id === 'zircon_std' || id === 'zircon_est' || id === 'zircon_pre') return 'zirkon_crown';
  return EXCLUSIVE_CROWN_IDS.includes(id) ? id : '';
}

/**
 * Metal + zirkon + emax all charged at the catalog sticker is not a choice.
 * One crown, or any pair, or a custom price, stays.
 */
export function unchosenCatalogCrownIds(lines) {
  const priceById = new Map();
  (lines || []).forEach((line) => {
    const id = exclusiveCrownId(line?.id || line?.service_id);
    if (!id || priceById.has(id)) return;
    const qty = line?.qty == null ? 1 : Number(line.qty) || 0;
    if (qty <= 0) return;
    priceById.set(id, Number(line.unitPrice ?? line.price) || 0);
  });
  if (priceById.size < EXCLUSIVE_CROWN_IDS.length) return new Set();
  const allStickers = EXCLUSIVE_CROWN_IDS.every((id) => priceById.get(id) === CROWN_CATALOG_STICKER[id]);
  return allStickers ? new Set(EXCLUSIVE_CROWN_IDS) : new Set();
}

export function blankUnchosenCatalogCrowns(snapshot) {
  if (!snapshot) return snapshot;
  const drop = unchosenCatalogCrownIds([...(snapshot.stage1 || []), ...(snapshot.stage2 || [])]);
  if (drop.size === 0) return snapshot;
  const blank = (line) => {
    const id = exclusiveCrownId(line?.id);
    if (!id || !drop.has(id)) return line;
    return { ...line, qty: 0, total: 0, source: 'placeholder' };
  };
  const stage1 = (snapshot.stage1 || []).map(blank);
  const stage2 = (snapshot.stage2 || []).map(blank);
  const stage1Total = stage1.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  const stage2Total = stage2.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
  return {
    ...snapshot,
    stage1,
    stage2,
    stage1Total,
    stage2Total,
    grandTotal: stage1Total + stage2Total,
  };
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
    { id: 'zircon_std', label: label('zirconStd', 'Standard') },
    { id: 'zircon_est', label: label('zirconEst', 'High') },
    { id: 'zircon_pre', label: label('zirconPre', 'Premium') },
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
  toothLines = [],
  extractionFdis,
  t,
} = {}) {
  const teeth = [...new Set((selectedFdis || []).map((n) => String(n).replace(/^#/, '')).filter(Boolean))];
  const lines = summarizeToothLines(toothLines);
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
      label: implantLineLabel(brandLabel, lines),
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
    // Extraction is charged only for the teeth where the doctor agreed to a paid extraction.
    const extractionQty = id === 'extraction' && Array.isArray(extractionFdis) && extractionFdis.length > 0
      ? extractionFdis.length
      : null;
    const line = applyEdit(
      makeLine({
        id,
        label: labelFor(service, service.label || service.name || id),
        unitPrice: catalogPrice(id, extraServicesList, extraServicePrices),
        qty: extractionQty ?? defaultLineQty(id, teethCount, { selected: true }),
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
        unitPrice: catalogPrice('titan_frame', extraServicesList, extraServicePrices),
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
            : 0,
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
  return blankUnchosenCatalogCrowns({
    v: 1,
    date: date || '',
    patient_name: patientName || '',
    clinic: resolveClinicTitle(clinicName),
    teeth,
    toothLines: lines,
    brand: brandLabel || '',
    implant_unit_price: Number(implantLine.unitPrice) || 0,
    implant_qty: Number(implantLine.qty) || 0,
    stage1,
    stage2,
    stage1Total,
    stage2Total,
    grandTotal: stage1Total + stage2Total,
  });
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
    ...((snapshot.toothLines || []).map((row) => {
      const bits = [`#${row.fdi}`, row.brand, row.size].filter(Boolean);
      return bits.length ? `  ${bits.join(' ')}` : '';
    }).filter(Boolean)),
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

export function isDesktopViewport() {
  return typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
}

/** Placeholder prices that were hardcoded and are not a catalog or case value. */
const INVENTED_PLACEHOLDER_PRICES = {
  titan_frame: 250000,
  zircon_std: 1200000,
  zircon_est: 1500000,
  zircon_pre: 2200000,
};

const SERVICE_NAME_RULES = [
  [/multi[\s-]?unit/i, 'multi_unit'],
  [/vaqtinchalik|pmma|provisional|temp(?:orary)?\s*(crown|toj|koronka)/i, 'temp_crown'],
  [/tish olish|atravmatik|extraction/i, 'extraction'],
  [/suyak|bone\s*graft|greft/i, 'bone_graft'],
  [/membrana/i, 'membrane'],
  [/metallokeramika|metal[\s-]?ceramic/i, 'metal_crown'],
  [/e-?max/i, 'emax_crown'],
  [/zirkon|zircon|sirkon/i, 'zirkon_crown'],
  [/vinir|veneer/i, 'veneer'],
  [/titan/i, 'titan_frame'],
  [/operatsion/i, 'operation_fee'],
  [/davolash/i, 'davolash'],
  [/shablon|surgical\s*guide/i, 'surgical_guide'],
  [/sinus/i, 'open_sinus'],
];

function positivePrice(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function guessServiceId(name) {
  const text = String(name || '');
  for (const [pattern, id] of SERVICE_NAME_RULES) {
    if (pattern.test(text)) return id;
  }
  return '';
}

export function stripInventedPlaceholderPrices(snapshot) {
  if (!snapshot) return snapshot;
  const cleanLine = (line) => {
    if (!line) return line;
    const invented = INVENTED_PLACEHOLDER_PRICES[line.id];
    const qty = Number(line.qty) || 0;
    const price = Number(line.unitPrice) || 0;
    const unselectedPlaceholder = qty === 0 && price > 0 && line.source === 'placeholder';
    const inventedBlank = qty === 0 && invented && price === invented && line.source !== 'extra';
    if (unselectedPlaceholder || inventedBlank) {
      return { ...line, unitPrice: 0, total: 0 };
    }
    return line;
  };
  return {
    ...snapshot,
    stage1: (snapshot.stage1 || []).map(cleanLine),
    stage2: (snapshot.stage2 || []).map(cleanLine),
  };
}

function fdisFromRecord(record) {
  const raw = record?.tooth_numbers || (record?.tooth_number ? [record.tooth_number] : (record?.tooth_id ? [record.tooth_id] : []));
  const list = Array.isArray(raw) ? raw : String(raw || '').split(/[,·]/);
  return [...new Set(list.map((item) => toImplantFdi(item)).filter(Boolean))];
}

function toothLinesFromRecord(record, teeth) {
  const map = record?.tooth_data_map || {};
  return teeth.map((fdi) => {
    const entry = map[fdi] || map[String(fdi)] || {};
    const firma = entry.firma || record.firma || '';
    const brand = firma === 'Boshqa'
      ? (entry.firma_custom || entry.brend || record.firma_custom || record.brend || '')
      : (entry.brend || firma || record.brend || '');
    const diameter = entry.diameter != null && entry.diameter !== '' ? entry.diameter : (record.diameter || '');
    const length = entry.length != null && entry.length !== '' ? entry.length : (record.length || '');
    return { fdi, brand, diameter, length };
  });
}

function implantUnitFromRecord(record, teeth) {
  const map = record?.tooth_data_map || {};
  const perTooth = teeth.map((fdi) => {
    const entry = map[fdi] || map[String(fdi)] || {};
    return positivePrice(entry.price);
  }).filter((n) => n != null);
  if (perTooth.length && perTooth.every((n) => n === perTooth[0])) return perTooth[0];
  if (teeth.length <= 1) return positivePrice(record?.price) || positivePrice(record?.narxi) || 0;
  return 0;
}

function servicesFromRecord(record) {
  const ids = [];
  const prices = {};
  const list = [];
  const add = (rawId, price, label) => {
    const id = normalizeServiceId(rawId);
    if (!id || id === 'implant') return;
    if (!ids.includes(id)) ids.push(id);
    const n = positivePrice(price);
    if (n != null && prices[id] == null) prices[id] = n;
    if (!list.some((row) => row.id === id)) {
      list.push({ id, label: label || id, defaultPrice: n || 0 });
    }
  };
  (record?.extra_services || []).forEach((rawId) => {
    const id = normalizeServiceId(rawId);
    const stored = record?.extra_service_prices?.[id] ?? record?.extra_service_prices?.[rawId];
    add(id, stored);
  });
  (record?.services_list || []).forEach((row) => {
    const named = guessServiceId(row?.service_name || row?.name || row?.label);
    const id = normalizeServiceId(row?.id || row?.service_id) || named;
    if (!id) return;
    add(id, row?.price, row?.service_name || row?.name || row?.label);
  });
  const crownId = guessServiceId(record?.crown_type);
  if (crownId && positivePrice(record?.crown_price) != null) {
    add(crownId, record.crown_price, record.crown_type);
  }
  return { ids, prices, list };
}

/**
 * Print snapshot for an existing implant. Prefers a saved factura.
 * Never fills a missing price with a hardcoded default.
 */
export function facturaFromImplantRecord(record, { clinicName } = {}) {
  if (!record) return null;
  const saved = parseFacturaSnapshot(record);
  if (saved) return stripInventedPlaceholderPrices(blankUnchosenCatalogCrowns(saved));
  const teeth = fdisFromRecord(record);
  const firma = record.firma === 'Boshqa' ? (record.firma_custom || '') : (record.firma || '');
  const brandLabel = String(firma || record.brend || '').trim();
  const services = servicesFromRecord(record);
  return buildFacturaDocument({
    date: record.placement_date || '',
    patientName: record.patient_name || '',
    clinicName: clinicName || '',
    selectedFdis: teeth,
    brandLabel,
    implantUnitPrice: implantUnitFromRecord(record, teeth),
    extraServicesList: services.list,
    selectedServiceIds: services.ids,
    extraServicePrices: services.prices,
    toothLines: toothLinesFromRecord(record, teeth),
    extractionFdis: Array.isArray(record.extraction_fdis) ? record.extraction_fdis : undefined,
  });
}

let printCleanupTimer = 0;
let printCleanupFn = null;

export function printImplantFactura() {
  if (typeof window === 'undefined' || typeof window.print !== 'function') return false;
  const root = document.documentElement;
  const overlay = document.querySelector('.implant-wizard-factura-overlay');
  if (printCleanupFn) printCleanupFn();
  const cleanup = () => {
    root.classList.remove('printing-implant-factura', 'printing-implant-factura-overlay');
    window.removeEventListener('afterprint', cleanup);
    if (printCleanupTimer) {
      window.clearTimeout(printCleanupTimer);
      printCleanupTimer = 0;
    }
    printCleanupFn = null;
  };
  printCleanupFn = cleanup;
  if (overlay) root.classList.add('printing-implant-factura-overlay');
  root.classList.add('printing-implant-factura');
  window.addEventListener('afterprint', cleanup);
  printCleanupTimer = window.setTimeout(cleanup, 8000);
  window.print();
  return true;
}


/** Passport "Xizmatlar (bog'langan)" rows from wizard step 2.

 * Step 2 stores extras on the factura / extra_services, not on services_list.
 * The passport reads this model so those services show with the tooth they
 * belong to, and manual passport rows are kept without being counted twice.
 */

import {
  defaultLineQty,
  exclusiveCrownId,
  mapLineToExtraId,
  parseFacturaSnapshot,
  unchosenCatalogCrownIds,
} from './implantFactura.js';
import { getServiceLabel, looksLikeI18nKey, normalizeServiceId } from './implantWizardLabels.js';
import { toImplantFdi, uniqueImplantToothKeys } from '../../lib/fdiNotation.js';

const CROWN_RE = /crown|karonka|koronka|zirkon|zircon|keramika|e-?max|vinir|veneer/i;

function readPrice(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function serviceDate(implant, factura) {
  const raw = implant?.placement_date || factura?.date || implant?.created_date || '';
  const text = String(raw).trim();
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : text;
}

function toothKeysOf(implant) {
  const teeth = implant?.tooth_numbers
    || (implant?.tooth_number ? [implant.tooth_number] : (implant?.tooth_id ? [implant.tooth_id] : []));
  const list = Array.isArray(teeth) ? teeth : String(teeth || '').split(/[,·]/);
  return uniqueImplantToothKeys(list);
}

function lineLabel(line) {
  const id = normalizeServiceId(line?.id);
  const raw = String(line?.label || '').trim();
  if (raw && !looksLikeI18nKey(raw)) return raw;
  return getServiceLabel({ id, label: raw });
}

function isPerToothService(id) {
  return defaultLineQty(id, 2, { selected: true }) === 2;
}

function dedupeKey(row) {
  const id = normalizeServiceId(row?.service_id || row?.id);
  const tooth = row?.tooth_number ? String(toImplantFdi(row.tooth_number) || row.tooth_number) : '';
  if (id && id !== 'manual') return `${id}|${tooth}`;
  const name = String(row?.service_name || '').trim().toLowerCase();
  return `name:${name}|${tooth}`;
}

function pushRow(rows, seen, row) {
  const key = dedupeKey(row);
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(row);
}

function facturaLines(factura) {
  if (!factura) return [];
  return [...(factura.stage1 || []), ...(factura.stage2 || [])].filter((line) => {
    if (!line) return false;
    const id = normalizeServiceId(line.id);
    if (!id || id === 'implant') return false;
    const qty = Number(line.qty) || 0;
    const total = Number(line.total) || 0;
    const unit = Number(line.unitPrice) || 0;
    if (qty <= 0) return false;
    if (line.source === 'placeholder' && total <= 0 && unit <= 0) return false;
    return true;
  });
}

function extraFallbackLines(implant, teethCount, covered) {
  const prices = implant?.extra_service_prices && typeof implant.extra_service_prices === 'object'
    ? implant.extra_service_prices
    : {};
  const lines = [];
  (implant?.extra_services || []).forEach((raw) => {
    const id = normalizeServiceId(raw);
    if (!id || covered.has(id)) return;
    const unit = readPrice(prices[id]) ?? readPrice(prices[raw]) ?? 0;
    const qty = defaultLineQty(id, teethCount || 1, { selected: true });
    if (qty <= 0) return;
    lines.push({
      id,
      label: getServiceLabel({ id }),
      unitPrice: unit,
      qty,
      total: unit * qty,
      source: 'extra',
    });
    covered.add(id);
  });
  return lines;
}

function rowsFromLine(line, fdis, extractionFdis = []) {
  const id = normalizeServiceId(mapLineToExtraId(line.id) || line.id);
  const teethCount = fdis.length;
  const qty = Number(line.qty) || 0;
  const unit = Number(line.unitPrice) || 0;
  const total = Number(line.total) || unit * qty;
  const label = lineLabel({ ...line, id });
  const perTooth = teethCount > 1 && isPerToothService(id) && qty === teethCount;

  // Paid extraction is linked to exactly the teeth it was agreed for.
  if (id === 'extraction' && extractionFdis.length > 0 && qty === extractionFdis.length) {
    return extractionFdis.map((fdi) => ({
      id: `extra-${id}-${fdi}`,
      service_id: id,
      service_name: label,
      tooth_number: fdi,
      price: unit,
      scope: 'tooth',
      is_primary: false,
      deletable: false,
      origin: 'factura',
    }));
  }

  if (perTooth) {
    return fdis.map((fdi) => ({
      id: `extra-${id}-${fdi}`,
      service_id: id,
      service_name: label,
      tooth_number: fdi,
      price: unit,
      scope: 'tooth',
      is_primary: false,
      deletable: false,
      origin: 'factura',
    }));
  }

  if (teethCount === 1) {
    const fdi = fdis[0];
    return [{
      id: `extra-${id}-${fdi}`,
      service_id: id,
      service_name: label,
      tooth_number: fdi,
      price: total,
      scope: 'tooth',
      is_primary: false,
      deletable: false,
      origin: 'factura',
    }];
  }

  return [{
    id: `extra-${id}-case`,
    service_id: id,
    service_name: label,
    tooth_number: '',
    price: total,
    scope: 'case',
    is_primary: false,
    deletable: false,
    origin: 'factura',
  }];
}

function rank(row) {
  if (row.is_primary) return 0;
  if (row.origin === 'manual') return 3;
  if (row.scope === 'case') return 2;
  return 1;
}

export function buildLinkedServiceModel(implant) {
  if (!implant) return { teeth: [], rows: [], date: '' };
  const factura = parseFacturaSnapshot(implant);
  const keys = toothKeysOf(implant);
  const fdis = keys.map((key) => String(toImplantFdi(key) || key)).filter(Boolean);
  const date = serviceDate(implant, factura);
  const rows = [];
  const seen = new Set();
  const teethCount = fdis.length;

  const addPrimary = (fdi, key) => {
    const tData = (key && implant.tooth_data_map?.[key]) || implant.tooth_data_map?.[fdi] || {};
    let price = readPrice(tData.price);
    if (price == null && teethCount <= 1) {
      price = readPrice(implant.price) ?? readPrice(implant.narxi) ?? 1500000;
    }
    if (price == null) {
      price = readPrice(factura?.implant_unit_price) ?? 0;
    }
    const name = tData.service_name || implant.service_name || implant.hizmat_turi || 'Implant';
    pushRow(rows, seen, {
      id: `primary-${fdi || 'implant'}`,
      service_id: 'implant',
      service_name: name,
      date,
      tooth_number: fdi || '',
      price,
      scope: 'tooth',
      is_primary: true,
      deletable: false,
      origin: 'primary',
      firma: tData.firma || implant.firma || '',
    });
  };

  if (fdis.length === 0) addPrimary('', '');
  keys.forEach((key, index) => addPrimary(fdis[index], key));

  const extractionFdis = fdis.filter((fdi) => (
    (implant.tooth_data_map?.[fdi] || implant.tooth_data_map?.[toImplantFdi(fdi)])?.extraction === 'paid'
  ));
  const fromFactura = facturaLines(factura);
  const covered = new Set(fromFactura.map((line) => normalizeServiceId(mapLineToExtraId(line.id) || line.id)));
  const prices = implant?.extra_service_prices && typeof implant.extra_service_prices === 'object'
    ? implant.extra_service_prices
    : {};
  const lines = [...fromFactura, ...extraFallbackLines(implant, teethCount, covered)];
  const dropCrowns = unchosenCatalogCrownIds([
    ...lines,
    ...(implant?.extra_services || []).map((raw) => {
      const id = normalizeServiceId(raw);
      return { id, qty: 1, unitPrice: readPrice(prices[id]) ?? readPrice(prices[raw]) ?? 0 };
    }),
  ]);
  lines.filter((line) => {
    const crown = exclusiveCrownId(line.id);
    return !crown || !dropCrowns.has(crown);
  }).forEach((line) => {
    rowsFromLine(line, fdis, extractionFdis).forEach((row) => {
      pushRow(rows, seen, { ...row, date, firma: implant.firma || '' });
    });
  });

  (Array.isArray(implant.services_list) ? implant.services_list : []).forEach((svc) => {
    if (!svc || svc.is_primary || svc.deletable === false) return;
    const tooth = svc.tooth_number ? String(toImplantFdi(svc.tooth_number) || svc.tooth_number) : '';
    pushRow(rows, seen, {
      id: svc.id || `manual-${dedupeKey(svc)}`,
      service_id: normalizeServiceId(svc.service_id || ''),
      service_name: svc.service_name || getServiceLabel({ id: svc.service_id }),
      date: svc.date || date,
      tooth_number: tooth,
      price: Number(svc.price) || 0,
      scope: svc.scope === 'case' || !tooth ? (svc.scope || (tooth ? 'tooth' : 'case')) : (svc.scope || 'tooth'),
      is_primary: false,
      deletable: svc.deletable !== false,
      origin: 'manual',
      firma: svc.firma || '',
      notes: svc.notes || '',
    });
  });

  const hasCrown = rows.some((row) => CROWN_RE.test(`${row.service_id || ''} ${row.service_name || ''}`));
  if (!hasCrown && implant.crown_type) {
    const fdi = fdis[0] || '';
    pushRow(rows, seen, {
      id: 'legacy-crown',
      service_id: 'crown',
      service_name: `${implant.crown_type} Karonka`,
      date,
      tooth_number: fdi,
      price: readPrice(implant.crown_price) ?? (implant.crown_type === 'Metallokeramika' ? 800000 : 1500000),
      scope: fdi ? 'tooth' : 'case',
      is_primary: false,
      deletable: false,
      origin: 'factura',
      firma: implant.firma || '',
    });
  }

  rows.sort((a, b) => rank(a) - rank(b));
  return { teeth: fdis, rows, date };
}

export function linkedServicesForTooth(model, fdi) {
  const key = String(toImplantFdi(fdi) || fdi || '');
  return (model?.rows || []).filter((row) => {
    if (row.scope === 'case' || !row.tooth_number) return true;
    if (!key) return true;
    return String(row.tooth_number) === key;
  });
}

export function toothServicesTotal(rows) {
  return (rows || [])
    .filter((row) => row.scope !== 'case')
    .reduce((sum, row) => sum + (Number(row.price) || 0), 0);
}

export function caseServicesGrandTotal(modelOrRows) {
  const rows = Array.isArray(modelOrRows) ? modelOrRows : (modelOrRows?.rows || []);
  return rows.reduce((sum, row) => sum + (Number(row.price) || 0), 0);
}

/** List "Narxi", detail Jami, and the implant plan all use this total. */
export function implantCasePrice(implant) {
  const total = caseServicesGrandTotal(buildLinkedServiceModel(implant));
  if (total > 0) return total;
  return readPrice(implant?.price) ?? readPrice(implant?.narxi) ?? 0;
}

/** Non-primary rows to store on the implant so the link exists after the next save. */
export function persistedServicesList(model) {
  return (model?.rows || [])
    .filter((row) => !row.is_primary)
    .map((row) => ({
      id: row.id,
      service_id: row.service_id || '',
      service_name: row.service_name,
      date: row.date || '',
      tooth_number: row.tooth_number || '',
      price: Number(row.price) || 0,
      scope: row.scope === 'case' ? 'case' : 'tooth',
      is_primary: false,
      deletable: row.deletable !== false,
      ...(row.firma ? { firma: row.firma } : {}),
      ...(row.notes ? { notes: row.notes } : {}),
    }));
}

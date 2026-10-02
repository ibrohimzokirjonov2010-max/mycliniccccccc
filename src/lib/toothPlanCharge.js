import { jawFamily, jawScopeFromLabel } from './jawServices.js';

/**
 * Group treatments on the tooth chart.
 * A braces system or one bridge is a single fee. Fillings, implants and
 * "the same treatment" are priced per selected tooth.
 * A jaw service is one fee for that jaw, so two jaws stay two fees.
 */
export function toothGroupBilling(kind) {
  if (kind === 'breket' || kind === 'bridge') return 'once';
  return 'each';
}

export function toothGroupCharge(unitPrice, toothCount, billing = 'each') {
  const price = Math.max(0, Number(unitPrice) || 0);
  const count = Math.max(0, Number(toothCount) || 0);
  if (billing === 'once') {
    return {
      billing: 'once',
      total: count > 0 ? price : 0,
      linePrices: Array.from({ length: count }, (_, index) => (index === 0 ? price : 0)),
    };
  }
  return {
    billing: 'each',
    total: price * count,
    linePrices: Array.from({ length: count }, () => price),
  };
}

function serviceLabel(row) {
  return `${row?.service_name || row?.name || ''} ${row?.category || ''}`;
}

/** Braces and a bridge are one fee. Crowns and fillings are not. */
export function onceGroupKind(label) {
  const blob = String(label || '').toLowerCase();
  const scope = jawScopeFromLabel(blob);
  if (scope) return `jaw:${scope}:${jawFamily(blob) || 'jaw'}`;
  if (/karonka|koronka|корон/.test(blob)) return null;
  if (/breket|braces|bracket|брекет/.test(blob)) return 'breket';
  if (/ko['’ʻ`‘]?prik|koprik|\bbridge\b|мост/.test(blob)) return 'bridge';
  return null;
}

function eachServiceRow(services, visit) {
  (services || []).forEach((item) => {
    if (!item || typeof item !== 'object') return;
    if (Array.isArray(item.items)) eachServiceRow(item.items, visit);
    else visit(item);
  });
}

function rewriteServiceRows(services, mapRow) {
  return (services || []).map((item) => {
    if (!item || typeof item !== 'object') return item;
    if (Array.isArray(item.items)) return { ...item, items: rewriteServiceRows(item.items, mapRow) };
    return mapRow(item);
  });
}

/**
 * A braces/bridge plan saved as catalogPrice × toothCount is one fee.
 * The first line keeps that fee and the other lines stay on the chart at 0.
 * Mixed plans and per-tooth treatments are returned unchanged.
 */
export function normalizeOncePricedPlan(plan) {
  if (!plan || !Array.isArray(plan.services) || plan.services.length < 2) return plan;
  const rows = [];
  eachServiceRow(plan.services, (row) => rows.push(row));
  if (rows.length < 2) return plan;

  const kinds = rows.map((row) => onceGroupKind(serviceLabel(row).trim() || `${plan.name || ''} ${plan.category || ''}`));
  if (kinds.some((kind) => !kind) || new Set(kinds).size !== 1) return plan;

  const prices = rows.map((row) => Math.max(0, Number(row.price ?? row.cost) || 0));
  const units = [...new Set(prices.filter((price) => price > 0))];
  if (units.length !== 1) return plan;
  const unit = units[0];
  if (prices.filter((price) => price === unit).length < 2) return plan;

  const stored = Number(plan.total_price) || 0;
  const total = stored > 0 && stored < unit ? stored : unit;
  let kept = false;
  const services = rewriteServiceRows(plan.services, (row) => {
    const price = Math.max(0, Number(row.price ?? row.cost) || 0);
    if (!kept && price === unit) {
      kept = true;
      return { ...row, price: total };
    }
    return { ...row, price: 0 };
  });
  return { ...plan, services, total_price: total };
}

export function withOncePricing(plans) {
  return (plans || []).map((plan) => normalizeOncePricedPlan(plan));
}

/** Notes can keep catalogPrice × toothCount after the table column was corrected. */
export function staleEncodedOnceTotal(rawNotes, plan) {
  if (!plan || typeof rawNotes !== 'string' || !rawNotes.startsWith('[TECH_DATA]')) return false;
  const kind = onceGroupKind(`${plan.name || ''} ${plan.category || ''}`);
  if (!kind) return false;
  const end = rawNotes.indexOf('[END_TECH]');
  if (end < 0) return false;
  try {
    const tech = JSON.parse(rawNotes.slice('[TECH_DATA]'.length, end));
    const encoded = Number(tech.total_price) || 0;
    const current = Number(plan.total_price) || 0;
    if (encoded > current && current > 0) return true;
    const rows = [];
    eachServiceRow(tech.services, (row) => rows.push(row));
    const unit = Math.max(0, ...rows.map((row) => Number(row.price) || 0));
    const repeated = rows.filter((row) => unit > 0 && Number(row.price) === unit).length;
    return repeated > 1 && unit >= current;
  } catch {
    return false;
  }
}

export function oncePricingChanged(before, after) {
  if (!before || !after || before === after) return false;
  if (Number(before.total_price) !== Number(after.total_price)) return true;
  return JSON.stringify(before.services || []) !== JSON.stringify(after.services || []);
}

const oncePricingDirty = new WeakSet();

export function markOncePricingDirty(plan) {
  if (plan) oncePricingDirty.add(plan);
  return plan;
}

export function isOncePricingDirty(plan) {
  return Boolean(plan && oncePricingDirty.has(plan));
}

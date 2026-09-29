/**
 * Braces and removable dentures are one fee per jaw.
 * A fixed bridge stays a per-tooth selection.
 */

export const JAW_UPPER_KEY = '__jaw_upper';
export const JAW_LOWER_KEY = '__jaw_lower';

export const ADULT_JAW_TEETH = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
};

export const CHILD_JAW_TEETH = {
  upper: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  lower: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75],
};

export function normServiceName(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[–—−]/g, '-')
    .replace(/['’ʻ`‘]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function jawLabel(jaw) {
  return jaw === 'lower' ? "Pastki jag'" : "Tepa jag'";
}

export function jawFamilyTitle(family) {
  if (family === 'babochka') return 'Babochka protez';
  if (family === 'protez') return 'Protez';
  return 'Breket';
}

export function jawServiceName(family, jaw) {
  return `${jawFamilyTitle(family)} — ${jaw === 'lower' ? "pastki jag'" : "tepa jag'"}`;
}

export function jawStorageKey(jaw) {
  return jaw === 'lower' ? JAW_LOWER_KEY : JAW_UPPER_KEY;
}

export function isJawStorageKey(value) {
  return value === JAW_UPPER_KEY || value === JAW_LOWER_KEY;
}

export function toothSlotLabel(toothId) {
  if (toothId === JAW_UPPER_KEY) return "Tepa jag'";
  if (toothId === JAW_LOWER_KEY) return "Pastki jag'";
  return '';
}

export function jawFromFdi(fdi) {
  const n = Number(String(fdi ?? '').replace(/\D/g, ''));
  if (!n) return null;
  const quad = Math.floor(n / 10);
  if (quad === 1 || quad === 2 || quad === 5 || quad === 6) return 'upper';
  if (quad === 3 || quad === 4 || quad === 7 || quad === 8) return 'lower';
  return null;
}

export function jawScopeFromLabel(label) {
  const blob = normServiceName(label);
  const upper = /tepa\s*jag|yuqori\s*jag/.test(blob);
  const lower = /pastki\s*jag|quyi\s*jag/.test(blob);
  if (upper && lower) return null;
  if (upper) return 'upper';
  if (lower) return 'lower';
  return null;
}

/** Fixed bridges are not jaw services. */
export function jawFamily(label) {
  const blob = normServiceName(label);
  if (!blob) return null;
  if (/ko'?prik|koprik|\bbridge\b|мост/.test(blob)) return null;
  if (/babochka|butterfly|бабочк/.test(blob)) return 'babochka';
  if (/breket|braces|bracket|брекет/.test(blob)) return 'breket';
  if (/protez|prosthes|протез/.test(blob) && !/karonka|koronka|sirkon|zirkon|metal|implant|vinir|\btoj\b/.test(blob)) {
    return 'protez';
  }
  return null;
}

export function jawIllustration(family) {
  if (family === 'breket') return 'breket';
  if (family === 'babochka') return 'protez-babochka';
  return 'protez-syomniy';
}

export function jawLegendKind(family) {
  if (family === 'breket') return 'breket';
  if (family === 'babochka') return 'babochka';
  return 'protez';
}

/** Scope comes from the service line. A both-jaws plan name mentions both jaws. */
export function jawMarkForService(service, plan) {
  const line = `${service?.service_name || ''} ${service?.name || ''} ${service?.tooth_number || ''}`;
  const scope = jawScopeFromLabel(line);
  const family = jawFamily(line);
  if (!scope || !family) return null;
  return { scope, family, planId: plan?.id || '' };
}

export function expandJawToothNumbers(jaw) {
  const side = jaw === 'lower' ? 'lower' : 'upper';
  return [...ADULT_JAW_TEETH[side], ...CHILD_JAW_TEETH[side]];
}

function findNamed(services, name) {
  const key = normServiceName(name);
  return (services || []).find((row) => normServiceName(row?.name) === key) || null;
}

/**
 * Exact jaw-service price wins. Otherwise reuse the live braces fee
 * (keramik / 7 000 000) or "olinadigan protez". Babochka has no catalog
 * price until the clinic types one.
 */
export function priceForJawService(services, family, jaw) {
  const exact = findNamed(services, jawServiceName(family, jaw));
  if (exact && Number(exact.price) > 0) return Number(exact.price);
  if (family === 'breket') {
    const keramik = (services || []).find((row) => /keramik\s+breket/i.test(row?.name || '') && Number(row.price) > 0);
    if (keramik) return Number(keramik.price);
    const seven = (services || []).find((row) => /breket|braces|bracket/i.test(row?.name || '') && Number(row.price) === 7000000);
    if (seven) return 7000000;
    return 7000000;
  }
  if (family === 'protez') {
    const full = (services || []).find((row) => (
      /olinadigan\s+protez|to'?liq\s+protez|protez\s*\(\s*to/i.test(row?.name || '')
      && Number(row.price) > 0
    ));
    if (full) return Number(full.price);
  }
  return 0;
}

export function jawLine(family, jaw, services) {
  const name = jawServiceName(family, jaw);
  const catalog = findNamed(services, name);
  return {
    service_id: catalog?.id || `jaw-${family}-${jaw}`,
    service_name: name,
    name,
    price: priceForJawService(services, family, jaw),
    category: family === 'breket' ? 'ORTODONTIYA' : 'ORTOPEDIYA',
    jaw,
    tooth_number: jawLabel(jaw),
    status: 'planned',
  };
}

export function buildJawPlanLines(family, choice, services = []) {
  const jaws = choice === 'both' ? ['upper', 'lower'] : [choice === 'lower' ? 'lower' : 'upper'];
  return jaws.map((jaw) => jawLine(family, jaw, services));
}

export function jawPlanTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + (Number(line?.price) || 0), 0);
}

export function collectJawRows(toothData) {
  return ['upper', 'lower'].flatMap((jaw) => (
    (toothData?.[jawStorageKey(jaw)]?.services || []).map((row) => ({
      ...row,
      tooth_number: row.tooth_number || jawLabel(jaw),
      tooth: jawLabel(jaw),
    }))
  ));
}

export function jawServiceSelected(service, toothData) {
  const family = jawFamily(service?.name || service?.service_name);
  if (!family) return false;
  const scope = jawScopeFromLabel(service?.name || service?.service_name);
  const has = (jaw) => (toothData?.[jawStorageKey(jaw)]?.services || [])
    .some((row) => jawFamily(row.service_name || row.name) === family);
  if (scope) return has(scope);
  return has('upper') || has('lower');
}

export function jawsCoveringFdi(toothData, fdi) {
  const jaw = jawFromFdi(fdi);
  if (!jaw) return [];
  return toothData?.[jawStorageKey(jaw)]?.services || [];
}

export function applyJawChoice(toothData, family, choice, services) {
  const jaws = choice === 'both' ? ['upper', 'lower'] : [choice === 'lower' ? 'lower' : 'upper'];
  const next = { ...(toothData || {}) };
  const had = (jaw) => (next[jawStorageKey(jaw)]?.services || [])
    .some((row) => jawFamily(row.service_name || row.name) === family);
  const clear = jaws.every(had);
  jaws.forEach((jaw) => {
    const key = jawStorageKey(jaw);
    const current = next[key]?.services || [];
    const rest = current.filter((row) => jawFamily(row.service_name || row.name) !== family);
    const servicesNext = clear || had(jaw)
      ? (clear ? rest : current)
      : [...rest, jawLine(family, jaw, services)];
    next[key] = { ...(next[key] || {}), services: servicesNext, expanded: true };
  });
  return next;
}

export function jawCatalogSpecs(services) {
  return ['breket', 'protez', 'babochka'].flatMap((family) => (
    ['upper', 'lower'].map((jaw) => ({
      name: jawServiceName(family, jaw),
      category: family === 'breket' ? 'ORTODONTIYA' : 'ORTOPEDIYA',
      price: priceForJawService(services, family, jaw),
      duration: 60,
      is_active: true,
      requires_tooth: false,
      tooth_numbers: [],
    }))
  ));
}

export async function ensureJawCatalog(serviceEntity, existing) {
  const created = [];
  if (!serviceEntity?.create) return created;
  for (const spec of jawCatalogSpecs(existing)) {
    const found = (existing || []).some((row) => normServiceName(row?.name) === normServiceName(spec.name));
    if (found) continue;
    try {
      const row = await serviceEntity.create(spec);
      if (row && !row.error) created.push(row);
    } catch (err) {
      console.error('Jaw service create failed', spec.name, err);
    }
  }
  return created;
}

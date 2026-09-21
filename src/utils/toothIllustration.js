/**
 * Dizyner Tish illustrations — public/teeth/{treatment}/{fdi}.png
 * FDI 11–48 (deciduous 51–85 map to the matching adult type).
 * Does not change how tooth selection or save APIs work.
 */

export const TOOTH_ILLUSTRATION_KINDS = [
  'endo',
  'caries',
  'implant',
  'plomba',
  'shtift',
  'breket',
  'metal-keramika',
  'sirkon',
  'healthy',
];

/** Visual priority when several treatments exist on one saved tooth. */
export const TOOTH_ILLUSTRATION_PRIORITY = [
  'implant',
  'metal-keramika',
  'sirkon',
  'breket',
  'shtift',
  'endo',
  'plomba',
  'caries',
];

const ADULT_FDI = new Set(
  [1, 2, 3, 4].flatMap((q) => Array.from({ length: 8 }, (_, i) => String(q * 10 + (i + 1))))
);

/**
 * Normalize any tooth token (11, "ur6", 51, "#36") to adult FDI "11"–"48".
 */
export function normalizeFdi(raw) {
  if (raw == null || raw === '') return null;
  const str = String(raw).trim();

  const internal = str.match(/^(ur|ul|lr|ll)(\d+)(c)?$/i);
  if (internal) {
    const quad = internal[1].toLowerCase();
    const num = Number(internal[2]);
    const child = Boolean(internal[3]);
    const qMap = child
      ? { ur: 5, ul: 6, ll: 7, lr: 8 }
      : { ur: 1, ul: 2, ll: 3, lr: 4 };
    return normalizeFdi(`${qMap[quad]}${num}`);
  }

  const digits = str.replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = parseInt(digits, 10);
  if (Number.isNaN(n)) return null;

  if (n >= 11 && n <= 48 && ADULT_FDI.has(String(n))) return String(n);
  if (n >= 51 && n <= 55) return String(10 + (n % 10));
  if (n >= 61 && n <= 65) return String(20 + (n % 10));
  if (n >= 71 && n <= 75) return String(30 + (n % 10));
  if (n >= 81 && n <= 85) return String(40 + (n % 10));
  return null;
}

function isEndodonticsCategory(category) {
  const c = String(category || '').trim().toUpperCase();
  if (!c) return false;
  if (c === 'ENDODONTIYA' || c === 'ENDODONTICS' || c === 'ENDODONTIYA / KANAL') return true;
  if (c.includes('ENDODONT')) return true;
  // Do NOT treat "TERAPIYA (ENDO + PLOMBA)" as endo by category alone.
  return false;
}

/**
 * Map service/status text + optional catalog category to an illustration folder.
 * Returns null when nothing matches (caller may fall back to healthy).
 */
export function matchIllustrationKind(text, category) {
  const s = String(text || '').toLowerCase();
  const cat = String(category || '');

  if (isEndodonticsCategory(cat)) return 'endo';
  if (!s.trim() && !cat.trim()) return null;

  if (/implant|имплант/.test(s) || /implant|имплант/i.test(cat)) return 'implant';

  if (
    /metal[- _]?keram|metallokeram|metalkeram|metal.?ceram|металлокерам/.test(s)
  ) {
    return 'metal-keramika';
  }

  if (/sirkon|zirkon|tsirkon|zircon|цирко/.test(s)) return 'sirkon';

  if (/breket|braces|bracket|брекет/.test(s)) return 'breket';

  if (/shtift|shtif|штифт|post and core|shpin/.test(s)) return 'shtift';

  if (
    /endodont|канал давол|kanal davol|root canal|pulpit|пульпит|depulp|\bendo\b|эндо/.test(s)
    || (/(^|[^a-zа-я])kanal([^a-zа-я]|$)/.test(s) && !/kanalizats/.test(s))
  ) {
    return 'endo';
  }

  if (/plomba|пломб|filling|kompozit|композит|restavratsiya|реставрац/.test(s)) {
    return 'plomba';
  }

  if (/karies|caries|kariyes|кариес|cavity|decay/.test(s)) return 'caries';

  return null;
}

/**
 * Pick one illustration from a list of services.
 * preferLast=true (chairside live select): last clicked service wins, so ENDO
 * immediately replaces the tooth art. preferLast=false: clinical priority.
 */
export function pickIllustrationKindFromServices(services = [], { preferLast = true } = {}) {
  const kinds = [];
  (services || []).forEach((svc) => {
    const kind = matchIllustrationKind(
      `${svc?.service_name || svc?.name || ''} ${svc?.title || ''}`,
      svc?.category
    );
    if (kind) kinds.push(kind);
  });
  if (!kinds.length) return null;
  if (preferLast) return kinds[kinds.length - 1];
  for (const p of TOOTH_ILLUSTRATION_PRIORITY) {
    if (kinds.includes(p)) return p;
  }
  return kinds[0];
}

/**
 * Resolve which PNG folder a toothStatus object should use.
 * extracted/missing → null (caller keeps dashed/empty rendering).
 */
export function resolveToothIllustrationKind(toothStatus) {
  if (!toothStatus) return 'healthy';
  const statusKey = String(toothStatus.status || '').toLowerCase();
  if ((statusKey === 'extracted' || statusKey === 'missing') && !toothStatus.hasImplant) {
    return null;
  }
  const explicit = String(toothStatus.illustrationKind || toothStatus.illustration_kind || '').trim();
  if (explicit && TOOTH_ILLUSTRATION_KINDS.includes(explicit)) return explicit;

  const fromServices = pickIllustrationKindFromServices(toothStatus.services || [], {
    preferLast: toothStatus.preferLastIllustration !== false,
  });
  if (fromServices) return fromServices;

  const fromText = matchIllustrationKind(
    [
      toothStatus.condition,
      toothStatus.treatment,
      toothStatus.serviceName,
      toothStatus.service_name,
      ...(toothStatus.treatments || []),
      ...(toothStatus.conditions || []),
      statusKey,
    ].filter(Boolean).join(' '),
    toothStatus.category
  );
  if (fromText) return fromText;

  if (statusKey === 'implant' || toothStatus.hasImplant) return 'implant';
  if (statusKey === 'caries' || statusKey === 'cavity') return 'caries';
  return 'healthy';
}

export function getToothIllustrationSrc(fdi, kind = 'healthy') {
  const n = normalizeFdi(fdi);
  if (!n) return null;
  const folder = TOOTH_ILLUSTRATION_KINDS.includes(kind) ? kind : 'healthy';
  return `/teeth/${folder}/${n}.png`;
}

export function getToothIllustrationSrcFromStatus(fdi, toothStatus) {
  const kind = resolveToothIllustrationKind(toothStatus);
  if (!kind) return null;
  return getToothIllustrationSrc(fdi, kind);
}

export default {
  TOOTH_ILLUSTRATION_KINDS,
  TOOTH_ILLUSTRATION_PRIORITY,
  normalizeFdi,
  matchIllustrationKind,
  pickIllustrationKindFromServices,
  resolveToothIllustrationKind,
  getToothIllustrationSrc,
  getToothIllustrationSrcFromStatus,
};

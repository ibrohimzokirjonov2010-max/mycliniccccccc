/**
 * Tezkor qo'shish (tooth chart quick-add) narxi.
 *
 * Narx Services katalogidan olinadi: nom bo'yicha aniq moslik, so'ng nom
 * qismi, so'ng tezkor tugmaning sinonimlari / kategoriyasi bo'yicha.
 * Katalogda narx bo'lmasa (0 yoki bo'sh) - 0 qaytadi va UI "narx belgilanmagan"
 * deb ko'rsatib, narxni qo'lda kiritishni so'raydi.
 */
import { normServiceName } from '@/lib/jawServices';

// Tezkor tugma id -> katalogdagi nom/kategoriya sinonimlari.
const QUICK_ALIASES = {
  caries: { name: /karies|caries|кариес/, category: /karies|terapiya|therapy|терапи/ },
  plomba: { name: /plomb|пломб|filling/, category: /plomba|terapiya|therapy|терапи/ },
  endo: { name: /kanal|endo|pulpit|канал|эндо/, category: /endo|эндо/ },
  sirkon: { name: /sirkon|zirkon|tsirkon|циркон|\btoj\b|koronka|коронк|crown|metall?\s*keramik/, category: /ortoped|protez|ортопед/ },
  implant: { name: /implant|имплант/, category: /implant|имплант/ },
  missing: { name: /tish\s*(olish|olib|chiqar|sug.?ur)|olib\s*tashla|ekstrak|extract|удален/, category: /xirurg|surgery|хирург/ },
};

const PRICE_FIELDS = ['price', 'default_price', 'base_price', 'narx', 'cost', 'amount'];

function positive(value) {
  const n = Number(String(value ?? '').replace(/[\s,]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/** Xizmatning narxi (shifokorga alohida narx belgilangan bo'lsa - o'sha). */
export function servicePrice(service, doctorId) {
  if (!service) return 0;
  const doc = doctorId == null ? '' : String(doctorId);
  if (doc) {
    const map = service.doctor_prices || service.doctorPrices;
    if (Array.isArray(map)) {
      const hit = map.find((row) => String(row?.doctor_id ?? row?.doctorId ?? '') === doc);
      const price = positive(hit?.price ?? hit?.amount);
      if (price) return price;
    } else if (map && typeof map === 'object') {
      const entry = map[doc];
      const price = positive(entry && typeof entry === 'object' ? (entry.price ?? entry.amount) : entry);
      if (price) return price;
    }
  }
  for (const field of PRICE_FIELDS) {
    const price = positive(service[field]);
    if (price) return price;
  }
  return 0;
}

function isActive(service) {
  if (!service) return false;
  if (service.is_active === false || service.active === false) return false;
  return true;
}

function nameScore(serviceName, label, alias) {
  const name = normServiceName(serviceName);
  const query = normServiceName(label);
  if (!name) return 0;
  if (query) {
    if (name === query) return 100;
    // Qisqa umumiy nomlar ("Tish") boshqa xizmatga yopishib qolmasin.
    const specific = name.length >= 6 || name.includes(' ');
    if (name.startsWith(query) || (specific && query.startsWith(name))) return 80;
    if (query.length >= 3 && name.includes(query)) return 70;
    if (specific && query.includes(name)) return 60;
  }
  if (alias?.name && alias.name.test(name)) return 50;
  return 0;
}

/**
 * Katalogdan xizmat topadi.
 * @returns {{ service: object|null, price: number }} price 0 bo'lsa - narx belgilanmagan.
 */
export function findCatalogService(services, label, { kindHint = '', doctorId = '' } = {}) {
  const alias = QUICK_ALIASES[kindHint] || null;
  const candidates = [];
  (services || []).forEach((service) => {
    if (!isActive(service)) return;
    let score = nameScore(service.name || service.service_name, label, alias);
    if (!score && alias?.category && alias.category.test(normServiceName(service.category)) && alias.name.test(normServiceName(service.name))) score = 40;
    if (!score) return;
    candidates.push({ service, score, price: servicePrice(service, doctorId) });
  });
  if (!candidates.length) return { service: null, price: 0 };
  const priced = candidates.filter((c) => c.price > 0);
  const pool = priced.length ? priced : candidates;
  pool.sort((a, b) => (b.score - a.score) || (a.price - b.price));
  return { service: pool[0].service, price: pool[0].price };
}

export function catalogPriceFor(services, label, options) {
  return findCatalogService(services, label, options).price;
}

/** Qo'lda kiritilgan narx ("150 000", "150000") -> raqam. */
export function parsePriceInput(raw) {
  return positive(String(raw ?? '').replace(/\D/g, ''));
}

export const PRICE_MISSING_LABEL = 'Narx belgilanmagan';

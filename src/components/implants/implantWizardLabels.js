/** Human labels for implant extra services — never render raw i18n keys. */

export const IMPLANT_WIZARD_STEP2_MARKER = 'implant-step2-teal-v2-240px-0d9488';

export const SERVICE_FALLBACKS = {
  surgical_guide: 'Jarrohlik shabloni',
  zirkon_crown: 'Zirkon karonka',
  zircon_crown: 'Zirkon karonka',
  metal_crown: 'Metallokeramika karonka',
  emax_crown: 'E-Max karonka',
  temp_crown: 'Vaqtinchalik toj',
  veneer: 'Vinir',
  abutment: 'Standart abutment',
  standard_abutment: 'Standart abutment',
  zirkon_abutment: 'Individual zirkon abutment',
  healing_abutment: 'Formik',
  formik: 'Formik',
  cover_screw: 'Zaglushka',
  multi_unit: 'Multi-unit abutment',
  sinus_open: 'Ochiq sinus-lifting',
  sinus_closed: 'Yopiq sinus-lifting',
  open_sinus: 'Ochiq sinus-lifting',
  closed_sinus: 'Yopiq sinus-lifting',
  sst_transplant: "SST ko'chirish",
  sst: "SST ko'chirish",
  piezosurgery: 'Piezosurgery',
  piezo: 'Piezosurgery',
  bone_graft: 'Bone graft',
  membrane: "Membrana qo'yish",
  prf: 'PRF',
  nkr: "NKR qo'yish",
  extraction: 'Atravmatik tish olish',
  gingivoplasty: 'Gingivoplastika',
  explantation: "Implantni olib tashlash",
};

export function normalizeServiceId(raw) {
  return String(raw || '')
    .replace(/^implants\.services\./i, '')
    .trim();
}

export function looksLikeI18nKey(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (s.startsWith('implants.')) return true;
  if (/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/i.test(s)) return true;
  return false;
}

export function getServiceLabel(service, t) {
  const id = normalizeServiceId(service?.id || service?.service_id);
  const fromI18n = id && typeof t === 'function' ? t(`implants.services.${id}`, '') : '';
  const candidates = [fromI18n, SERVICE_FALLBACKS[id], service?.label, service?.name];
  for (const c of candidates) {
    if (c && !looksLikeI18nKey(c)) return String(c);
  }
  if (id) {
    const human = id.replace(/_/g, ' ').trim();
    if (human && !looksLikeI18nKey(human)) {
      return human.charAt(0).toUpperCase() + human.slice(1);
    }
  }
  return 'Xizmat';
}

export function mergeExtraServicesCatalog(clinicList, defaults) {
  const byId = new Map();
  (defaults || []).forEach((s) => {
    const id = normalizeServiceId(s.id);
    if (!id) return;
    byId.set(id, {
      id,
      label: s.label || s.name || SERVICE_FALLBACKS[id] || id,
      defaultPrice: Number(s.defaultPrice ?? s.price) || 0,
      category: s.category || 'Boshqa',
    });
  });
  (clinicList || []).forEach((s) => {
    const id = normalizeServiceId(s.id || s.service_id);
    if (!id) return;
    const prev = byId.get(id) || {};
    const rawName = s.name || s.label;
    byId.set(id, {
      id,
      label: looksLikeI18nKey(rawName) ? (prev.label || SERVICE_FALLBACKS[id] || rawName) : rawName,
      defaultPrice: Number(s.price ?? s.defaultPrice ?? prev.defaultPrice) || 0,
      category: s.category || prev.category || 'Boshqa',
    });
  });
  return [...byId.values()];
}

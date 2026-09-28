/**
 * Clinical chart + informed consent helpers stored inside existing patient.notes JSON markers.
 * Does NOT add DB columns — packs into notes with reversible markers.
 *
 * Markers used:
 *   [CLINICAL_CHART_V1]{...json...}[/CLINICAL_CHART_V1]
 *   [CONSENT_V1]{...json...}[/CONSENT_V1]
 *
 * JSON shapes:
 *   clinical: { entries: [{ id, diagnosis, code, procedure, materials, complications, tooth, created_at }] }
 *   consent:  {
 *     given, date: 'YYYY-MM-DD'|null, date_display: 'dd.mm.yyyy',
 *     template_id, template_title, text, note,
 *     patient_signature, doctor_signature, updated_at
 *   }
 */

export const CONSENT_TEMPLATES = [
  {
    id: 'general',
    title: { uz: 'Umumiy davolash', ru: 'Общее лечение', en: 'General treatment' },
    text: {
      uz: "Men, bemor, shifokor tomonidan taklif etilgan stomatologik davolash rejasini, uning maqsadi, bosqichlari va kutilayotgan natijasini tushunganimni tasdiqlayman. Og'riq, shish, sezuvchanlik va infeksiya kabi mumkin bo'lgan asoratlar tushuntirildi. Savollarimga javob oldim. Davolashni o'z xohishim bilan qabul qilaman va roziligimni istalgan vaqtda bekor qilish huquqim borligini bilaman.",
      ru: 'Я подтверждаю, что врач объяснил план стоматологического лечения, его цель, этапы, ожидаемый результат и возможные осложнения. На мои вопросы ответили. Я соглашаюсь на лечение добровольно и знаю, что могу отозвать согласие.',
      en: 'I confirm that the dentist explained the treatment plan, its purpose, stages, expected result, and possible complications. My questions were answered. I consent voluntarily and know I may withdraw consent.',
    },
  },
  {
    id: 'implant',
    title: { uz: 'Implantatsiya', ru: 'Имплантация', en: 'Implant' },
    text: {
      uz: "Men implant o'rnatish bo'yicha og'zaki va yozma tushuntirish oldim: suyak hajmi, operatsiya, integratsiya muddati, protez bosqichi, og'riq, shish, infeksiya, implant tutmasligi va qayta aralashuv xavfi. Muqobil davolash (ko'prik, protez) aytilgan. Men implantatsiyaga ongli rozilik beraman.",
      ru: 'Мне объяснили установку импланта: объём кости, операцию, срок интеграции, протезирование и риски (боль, отёк, инфекция, неприживление, повторное вмешательство). Альтернативы названы. Я даю осознанное согласие на имплантацию.',
      en: 'I was told about implant placement: bone volume, surgery, integration time, the crown stage, and risks including pain, swelling, infection, failure, and revision. Alternatives were explained. I give informed consent for implant treatment.',
    },
  },
  {
    id: 'extraction',
    title: { uz: 'Tish olish', ru: 'Удаление зуба', en: 'Extraction' },
    text: {
      uz: "Men tishni olish sababi, usuli va oqibatlarini tushundim: qon ketishi, shish, og'riq, qo'zniq nervning vaqtincha yoki doimiy ta'sirlanishi, quruq luna, qo'shni tishga ta'sir. Men tish olishga roziman.",
      ru: 'Я понимаю причину и последствия удаления: кровотечение, отёк, боль, воздействие на соседний нерв, сухая лунка, влияние на соседний зуб. Я согласен(на) на удаление.',
      en: 'I understand the reason and consequences of extraction: bleeding, swelling, pain, nerve effects, dry socket, and effects on a neighbouring tooth. I consent to extraction.',
    },
  },
  {
    id: 'endo',
    title: { uz: 'Endodontiya', ru: 'Эндодонтия', en: 'Endodontics' },
    text: {
      uz: "Men kanal davolash maqsadi va cheklovlarini tushundim: kanal to'liq tozalanmasligi, og'riq, infeksiya, tish devorining yorilishi, qayta davolash yoki tishni olish ehtiyoji. Men endodontik davolashga roziman.",
      ru: 'Я понимаю цель и пределы лечения каналов: неполная очистка, боль, инфекция, трещина стенки, повторное лечение или удаление. Я согласен(на) на эндодонтическое лечение.',
      en: 'I understand the purpose and limits of root-canal treatment: incomplete cleaning, pain, infection, fracture, retreatment, or extraction. I consent to endodontic treatment.',
    },
  },
  {
    id: 'anesthesia',
    title: { uz: 'Anesteziya', ru: 'Анестезия', en: 'Anesthesia' },
    text: {
      uz: "Men mahalliy og'riqsizlantirish haqida ogohlantirildim: ukol joyida og'riq, shish, gematoma, allergik reaksiya, vaqtincha lab yoki til uvishishi. Allergiya va dori haqidagi ma'lumotim to'g'ri. Men anesteziyaga roziman.",
      ru: 'Меня предупредили о местной анестезии: боль в месте укола, отёк, гематома, аллергия, временное онемение губы или языка. Сведения об аллергии верны. Я согласен(на) на анестезию.',
      en: 'I was warned about local anesthesia: pain at the injection site, swelling, bruising, allergy, and temporary numbness of the lip or tongue. My allergy history is accurate. I consent to anesthesia.',
    },
  },
];

export function consentTemplateById(id) {
  return CONSENT_TEMPLATES.find((row) => row.id === id) || CONSENT_TEMPLATES[0];
}

export function consentTemplateTitle(id, language = 'uz') {
  const row = consentTemplateById(id);
  return row.title[language] || row.title.uz;
}

export function consentTemplateText(id, language = 'uz') {
  const row = consentTemplateById(id);
  return row.text[language] || row.text.uz;
}

export function toDisplayDate(value) {
  if (!value) return '';
  const raw = String(value).trim();
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const dmy = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return dmy ? raw : '';
}

export function toIsoDate(display) {
  const dmy = String(display || '').trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!dmy) return null;
  const day = Number(dmy[1]);
  const month = Number(dmy[2]);
  const year = Number(dmy[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;
  return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
}

export function maskDisplayDate(raw) {
  const digits = String(raw || '').replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('.');
}

const CLINICAL_RE = /\[CLINICAL_CHART_V1\]([\s\S]*?)\[\/CLINICAL_CHART_V1\]/;
const CONSENT_RE = /\[CONSENT_V1\]([\s\S]*?)\[\/CONSENT_V1\]/;

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function parseClinicalChart(notes = '') {
  const m = String(notes || '').match(CLINICAL_RE);
  if (!m) return { entries: [] };
  const data = safeParse(m[1], { entries: [] });
  return { entries: Array.isArray(data.entries) ? data.entries : [] };
}

export function emptyConsent() {
  return {
    given: false,
    date: null,
    date_display: '',
    template_id: 'general',
    template_title: '',
    text: '',
    note: '',
    patient_signature: '',
    doctor_signature: '',
    updated_at: null,
  };
}

export function parseConsent(notes = '') {
  const m = String(notes || '').match(CONSENT_RE);
  if (!m) return emptyConsent();
  const data = safeParse(m[1], {});
  const dateDisplay = data.date_display || toDisplayDate(data.date);
  return {
    given: !!data.given,
    date: data.date || toIsoDate(dateDisplay),
    date_display: dateDisplay,
    template_id: data.template_id || 'general',
    template_title: data.template_title || '',
    text: data.text || '',
    note: data.note || '',
    patient_signature: data.patient_signature || '',
    doctor_signature: data.doctor_signature || '',
    updated_at: data.updated_at || null,
  };
}

export function stripClinicalMarkers(notes = '') {
  return String(notes || '')
    .replace(CLINICAL_RE, '')
    .replace(CONSENT_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function buildNotesWithClinical(notes, clinical, consent) {
  const base = stripClinicalMarkers(notes);
  const parts = [];
  if (base) parts.push(base);
  parts.push(`[CLINICAL_CHART_V1]${JSON.stringify({ entries: clinical?.entries || [] })}[/CLINICAL_CHART_V1]`);
  parts.push(`[CONSENT_V1]${JSON.stringify({
    given: !!consent?.given,
    date: consent?.date || null,
    date_display: consent?.date_display || toDisplayDate(consent?.date) || '',
    template_id: consent?.template_id || 'general',
    template_title: consent?.template_title || '',
    text: consent?.text || '',
    note: consent?.note || '',
    patient_signature: consent?.patient_signature || '',
    doctor_signature: consent?.doctor_signature || '',
    updated_at: consent?.updated_at || new Date().toISOString(),
  })}[/CONSENT_V1]`);
  return parts.join('\n\n');
}

export function createClinicalEntry(partial = {}) {
  return {
    id: `clin-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    diagnosis: partial.diagnosis || '',
    code: partial.code || '',
    procedure: partial.procedure || '',
    materials: partial.materials || '',
    complications: partial.complications || '',
    tooth: partial.tooth || null,
    created_at: new Date().toISOString(),
  };
}

export default {
  parseClinicalChart,
  parseConsent,
  stripClinicalMarkers,
  buildNotesWithClinical,
  createClinicalEntry,
  CONSENT_TEMPLATES,
};

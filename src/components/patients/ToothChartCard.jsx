import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check, Layers, Plus, Printer, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { cn, formatCurrency, formatMoneyAmount } from '@/lib/utils';
import { fdiCrownDown, fdiGridTemplate, fdiLengthWeight, fdiWidthWeight, internalIdToFdi } from '@/lib/fdiNotation';
import { getToothIllustrationSrc, matchIllustrationKind } from '@/utils/toothIllustration';
import { displayServiceName, formatDoctorName } from '@/lib/displayText';
import { implantStatusLabel, normalizeImplantStatus } from '@/lib/implantStatus';
import { toothGroupBilling, toothGroupCharge, withOncePricing } from '@/lib/toothPlanCharge';
import { paymentsForPlan } from '@/lib/treatmentDelete';
import JawChoice from '@/components/patients/JawChoice';
import {
  buildJawPlanLines,
  expandJawToothNumbers,
  jawFamilyTitle,
  jawFromFdi,
  jawIllustration,
  jawLegendKind,
  jawMarkForService,
  jawPlanTotal,
  jawServiceName,
  priceForJawService,
} from '@/lib/jawServices';

const ADULT_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const ADULT_LOWER = [38, 37, 36, 35, 34, 33, 32, 31, 41, 42, 43, 44, 45, 46, 47, 48];
const CHILD_UPPER = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65];
const CHILD_LOWER = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75];

const LEGEND = [
  { id: 'caries', label: 'Karies', color: '#E11D48' },
  { id: 'plomba', label: 'Plomba', color: '#2563EB' },
  { id: 'endo', label: 'Endo (kanal)', color: '#7C3AED' },
  { id: 'sirkon', label: 'Toj / sirkon', color: '#CA8A04' },
  { id: 'implant', label: 'Implant', color: '#64748B' },
  { id: 'missing', label: 'Olib tashlangan', color: '#94A3B8' },
  { id: 'breket', label: 'Breket', color: '#DB2777' },
  { id: 'protez', label: 'Protez', color: '#0F766E' },
  { id: 'babochka', label: 'Babochka', color: '#C2410C' },
];

const QUICK = [
  { id: 'caries', label: 'Karies', service: 'Karies' },
  { id: 'plomba', label: 'Plomba', service: 'Plomba' },
  { id: 'endo', label: 'Endo', service: 'Kanal davolash' },
  { id: 'sirkon', label: 'Toj / sirkon', service: 'Sirkon toj' },
  { id: 'implant', label: 'Implant', service: 'Implant' },
  { id: 'missing', label: 'Olib tashlash', service: 'Tish olish' },
  { id: 'breket', label: 'Breket', service: 'Breket', jaw: 'breket' },
  { id: 'protez', label: 'Protez', service: 'Protez', jaw: 'protez' },
  { id: 'babochka', label: 'Babochka', service: 'Babochka protez', jaw: 'babochka' },
];

const KIND_COLOR = Object.fromEntries(LEGEND.map((k) => [k.id, k.color]));

const TOOTH_NAME = {
  1: 'markaziy kurak', 2: 'yon kurak', 3: 'qoziq tish',
  4: 'birinchi kichik oziq', 5: 'ikkinchi kichik oziq',
  6: 'birinchi katta oziq', 7: 'ikkinchi katta oziq', 8: 'aql tishi',
};

function legendOf(kind) {
  if (!kind || kind === 'healthy') return null;
  if (kind === 'metal-keramika' || kind === 'protez-syomniy' || kind === 'protez-babochka') return 'sirkon';
  if (kind === 'protez-implant') return 'implant';
  if (kind === 'shtift') return 'endo';
  return LEGEND.some((k) => k.id === kind) ? kind : null;
}

function isDoneStatus(status) {
  const s = String(status || '').toLowerCase().trim();
  return s === 'completed' || s === 'bajarildi' || s === 'bajarilgan' || s === 'paid' || s === 'done' || s === 'yakunlangan' || s === 'yakunlandi';
}

function serviceIsDone(svc, plan) {
  if (svc?.completed === true) return true;
  if (isDoneStatus(svc?.status) || isDoneStatus(svc?.payment_status)) return true;
  if (svc?.status || svc?.payment_status) return false;
  return isDoneStatus(plan?.status);
}

function tokenToFdi(raw) {
  const text = String(raw || '').trim().replace(/^#/, '');
  if (!text) return '';
  const internal = internalIdToFdi(text);
  if (internal) return internal;
  const digits = text.replace(/[^\d]/g, '');
  return digits.length >= 2 ? digits : '';
}

function flattenPlanServices(plan) {
  const raw = Array.isArray(plan?.services) ? plan.services : [];
  const rows = [];
  if (!raw.length) {
    if (plan?.tooth_number || plan?.name) {
      rows.push({
        service_name: plan.name || plan.title || '',
        status: plan.status,
        price: plan.total_price,
        tooth_number: plan.tooth_number,
        notes: plan.notes,
        category: plan.category,
        path: null,
      });
    }
    return rows;
  }
  raw.forEach((item, parent) => {
    if (item && Array.isArray(item.items)) {
      item.items.forEach((svc, itemIndex) => {
        rows.push({
          ...svc,
          service_name: svc.service_name || svc.name || item.service_name || plan.name,
          tooth_number: svc.tooth_number || svc.tooth_id || svc.tooth || item.tooth_number || item.tooth_id || item.tooth || plan.tooth_number,
          status: svc.status || item.status,
          payment_status: svc.payment_status || item.payment_status,
          price: svc.price ?? item.price,
          notes: svc.notes || item.notes || '',
          category: svc.category || item.category || plan.category,
          path: { parent, item: itemIndex },
        });
      });
      return;
    }
    if (!item) return;
    rows.push({
      ...item,
      service_name: item.service_name || item.name || plan.name,
      tooth_number: item.tooth_number || item.tooth_id || item.tooth || plan.tooth_number,
      category: item.category || plan.category,
      notes: item.notes || '',
      path: { parent, item: null },
    });
  });
  return rows;
}

function parseSurfaces(text) {
  const m = String(text || '').match(/yuza:\s*([vmodl,\s]+)/i);
  if (!m) return [];
  return m[1].split(/[,\s]+/).map((s) => s.trim().toUpperCase()).filter((s) => ['V', 'M', 'O', 'D', 'L'].includes(s));
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

function money(n) {
  const v = Number(n) || 0;
  if (v <= 0) return null;
  return formatCurrency(v);
}

function toothTitle(fdi) {
  const n = Number(fdi);
  const pos = n % 10;
  const q = Math.floor(n / 10);
  const jaw = q === 1 || q === 2 || q === 5 || q === 6 ? 'yuqori' : 'pastki';
  const side = q === 1 || q === 4 || q === 5 || q === 8 ? 'o‘ng' : 'chap';
  const raw = TOOTH_NAME[pos] || 'tish';
  const named = raw.charAt(0).toUpperCase() + raw.slice(1);
  const title = /tish$/i.test(named) ? named : `${named} tish`;
  return `${title} · ${jaw} ${side}`;
}

function withSurfaceNote(notes, surfaces) {
  const base = String(notes || '')
    .replace(/yuza:\s*[vmodl,\s]*/ig, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.\s*\./g, '.')
    .trim()
    .replace(/[.\s]+$/, '');
  const tag = surfaces.length ? `Yuza: ${surfaces.join(', ')}` : '';
  return [base, tag].filter(Boolean).join('. ');
}

function patchServiceNotes(services, servicePath, nextNotes) {
  return (services || []).map((svc, index) => {
    if (Array.isArray(svc?.items)) {
      return {
        ...svc,
        items: svc.items.map((inner, itemIndex) => (
          servicePath?.parent === index && servicePath?.item === itemIndex
            ? { ...inner, notes: nextNotes }
            : inner
        )),
      };
    }
    if (servicePath?.parent === index && servicePath?.item == null) {
      return { ...svc, notes: nextNotes };
    }
    return svc;
  });
}

function patientAgeYears(patient, today = new Date()) {
  const raw = patient?.birth_date;
  if (raw != null && String(raw).trim()) {
    const dateStr = String(raw).trim();
    if (/^\d{4}$/.test(dateStr)) return today.getFullYear() - parseInt(dateStr, 10);
    const parsed = new Date(dateStr);
    if (!Number.isNaN(parsed.getTime())) {
      let age = today.getFullYear() - parsed.getFullYear();
      const month = today.getMonth() - parsed.getMonth();
      if (month < 0 || (month === 0 && today.getDate() < parsed.getDate())) age -= 1;
      return age;
    }
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) return today.getFullYear() - parseInt(yearMatch[0], 10);
  }
  const numeric = Number(patient?.age);
  if (Number.isFinite(numeric) && numeric >= 0 && numeric < 130) return Math.floor(numeric);
  return null;
}

function dentitionForAge(age) {
  if (age == null) return 'adult';
  return age < 12 ? 'child' : 'adult';
}

function dentitionHint(age) {
  if (age == null) return '';
  if (age < 12) return `Yoshiga ko‘ra: sut tishlari (${age} yosh)`;
  return `Yoshiga ko‘ra: doimiy tishlar (${age} yosh)`;
}

function collectEntries(plans, implants, toothRecords) {
  const byTooth = {};
  const add = (fdiRaw, entry) => {
    String(fdiRaw || '').split(/[,·]/).forEach((part) => {
      const fdi = tokenToFdi(part);
      if (!fdi) return;
      if (!byTooth[fdi]) byTooth[fdi] = [];
      byTooth[fdi].push(entry);
    });
  };

  (plans || []).forEach((plan) => {
    flattenPlanServices(plan).forEach((svc) => {
      const blob = `${svc.service_name || ''} ${svc.name || ''} ${plan.name || ''} ${svc.category || ''} ${plan.category || ''} ${svc.tooth_number || ''}`;
      const jawMark = jawMarkForService(svc, plan);
      const jawScope = jawMark?.scope || null;
      const jawKind = jawMark?.family || null;
      const illustration = jawKind ? jawIllustration(jawKind) : matchIllustrationKind(blob, svc.category || plan.category);
      const kind = jawKind ? jawLegendKind(jawKind) : legendOf(illustration);
      const entry = {
        kind,
        illustration: illustration || kind,
        done: serviceIsDone(svc, plan),
        name: displayServiceName(svc.service_name || svc.name || plan.name || kind || 'Yozuv'),
        price: Number(svc.price || svc.cost || 0),
        doctor: formatDoctorName(plan.doctor_name || ''),
        date: svc.completion_date || plan.updated_date || plan.updated_at || plan.created_date || plan.date,
        planId: plan.id,
        servicePath: svc.path,
        surfaces: parseSurfaces(`${svc.notes || ''} ${plan.notes || ''}`),
        notes: svc.notes || '',
      };
      if (jawScope && jawKind) {
        const chargeKey = `${plan.id || ''}:${entry.name}:${jawScope}`;
        expandJawToothNumbers(jawScope).forEach((fdi) => {
          add(fdi, { ...entry, chargeKey });
        });
        return;
      }
      add(svc.tooth_number || plan.tooth_number, entry);
    });
  });

  (implants || []).forEach((imp) => {
    const nums = Array.isArray(imp.tooth_numbers)
      ? imp.tooth_numbers
      : String(imp.tooth_numbers || imp.tooth_number || '').split(',');
    const statusCode = normalizeImplantStatus(imp.lifecycle_status || imp.status);
    nums.forEach((num) => add(num, {
      kind: 'implant',
      illustration: 'implant',
      done: statusCode === 'completed',
      statusCode,
      statusLabel: implantStatusLabel(statusCode),
      name: 'Implant',
      price: 0,
      doctor: formatDoctorName(imp.doctor || imp.doctor_name || ''),
      date: imp.placement_date || imp.created_date,
      planId: null,
      surfaces: [],
      notes: '',
    }));
  });

  (toothRecords || []).forEach((rec) => {
    const blob = `${rec.condition || ''} ${rec.treatment || ''} ${rec.notes || ''}`;
    const illustration = matchIllustrationKind(blob);
    const kind = legendOf(illustration);
    const finding = /\[finding\]/i.test(String(rec.notes || ''));
    add(rec.tooth_number, {
      kind,
      illustration: illustration || kind,
      finding,
      done: finding ? false : (isDoneStatus(rec.status) || !/reja|plan/i.test(String(rec.status || ''))),
      name: displayServiceName(rec.treatment || rec.condition || rec.notes || kind || 'Yozuv'),
      price: finding ? 0 : Number(rec.price || 0),
      doctor: formatDoctorName(rec.doctor || ''),
      date: rec.updated_date || rec.created_date,
      planId: null,
      surfaces: parseSurfaces(rec.notes),
      notes: rec.notes || '',
    });
  });

  return byTooth;
}

function primaryEntry(entries, filter) {
  const list = (entries || []).filter((e) => {
    if (!e.kind) return false;
    if (filter === 'plan') return !e.done && !e.finding;
    if (filter === 'done') return e.done && !e.finding;
    return true;
  });
  if (!list.length) return null;
  const rank = { implant: 8, missing: 7, breket: 6, babochka: 6, protez: 6, sirkon: 5, endo: 4, plomba: 3, caries: 2 };
  return [...list].sort((a, b) => (rank[b.kind] || 0) - (rank[a.kind] || 0))[0];
}

function mentionsTooth(text, fdi) {
  return new RegExp(`(^|[^\\d])${fdi}([^\\d]|$)`).test(String(text || ''));
}

export default function ToothChartCard({
  patient,
  plans = [],
  payments = [],
  appointments = [],
  doctors = [],
  services = [],
  implants = [],
  toothRecords = [],
  onReload,
  onBookAppointment,
  onOpenPlan,
  sheetOffset = 0,
  search = '',
  sideRailId = '',
}) {
  const { user } = useAuth();
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches);
  const [wideDesktop, setWideDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches);
  const ageYears = patientAgeYears(patient);
  const dentitionTouched = useRef(false);
  const [dentition, setDentition] = useState(() => dentitionForAge(patientAgeYears(patient)));
  const [filter, setFilter] = useState('all');
  const [multi, setMulti] = useState(false);
  const [selected, setSelected] = useState([]);
  const [active, setActive] = useState(null);
  const [surfaces, setSurfaces] = useState([]);
  const [groupAction, setGroupAction] = useState('breket');
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [jawPrompt, setJawPrompt] = useState(null);
  const [xrays, setXrays] = useState([]);
  const [viewer, setViewer] = useState(null);
  const archScrollRef = useRef(null);
  const [archHalf, setArchHalf] = useState('right');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const wide = window.matchMedia('(min-width: 1280px)');
    const onChange = () => {
      setPhone(mq.matches);
      setWideDesktop(wide.matches);
    };
    mq.addEventListener('change', onChange);
    wide.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      wide.removeEventListener('change', onChange);
    };
  }, []);

  const useExternalRail = Boolean(sideRailId) && wideDesktop && !phone;
  const [railNode, setRailNode] = useState(null);
  useLayoutEffect(() => {
    if (!useExternalRail) {
      setRailNode(null);
      return;
    }
    setRailNode(document.getElementById(sideRailId));
  }, [useExternalRail, sideRailId]);

  useEffect(() => {
    if (!active || phone || wideDesktop) return;
    const panel = document.querySelector('[data-tooth-panel]');
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const fullyIn = rect.top >= 72 && rect.bottom <= window.innerHeight - 12;
    if (fullyIn) return;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [active, phone, wideDesktop]);

  const loadXrays = useCallback(async () => {
    if (!patient?.id) return;
    try {
      const rows = await base44.entities.Xray.filter({ patient_id: patient.id }, '-created_date', 200);
      setXrays(rows || []);
    } catch {
      setXrays([]);
    }
  }, [patient?.id]);

  useEffect(() => { loadXrays(); }, [loadXrays]);

  useEffect(() => {
    dentitionTouched.current = false;
    setDentition(dentitionForAge(patientAgeYears(patient)));
  }, [patient?.id]);

  useEffect(() => {
    if (dentitionTouched.current) return;
    setDentition(dentitionForAge(ageYears));
  }, [patient?.id, patient?.birth_date, patient?.age, ageYears]);

  const pricedPlans = useMemo(() => withOncePricing(plans), [plans]);
  const byTooth = useMemo(
    () => collectEntries(pricedPlans, implants, toothRecords),
    [pricedPlans, implants, toothRecords],
  );

  const upper = dentition === 'child' ? CHILD_UPPER : ADULT_UPPER;
  const lower = dentition === 'child' ? CHILD_LOWER : ADULT_LOWER;

  const entryFor = useCallback((fdi) => primaryEntry(byTooth[String(fdi)], filter), [byTooth, filter]);

  const summary = useMemo(() => {
    const teeth = new Set([...upper, ...lower].map(String));
    let done = 0;
    let planned = 0;
    let plannedSum = 0;
    const seenCharges = new Set();
    teeth.forEach((fdi) => {
      const list = byTooth[fdi] || [];
      if (list.some((e) => e.done && !e.finding)) done += 1;
      const open = list.filter((e) => !e.done && !e.finding);
      if (open.length) {
        planned += 1;
        open.forEach((entry) => {
          if (entry.chargeKey) {
            if (seenCharges.has(entry.chargeKey)) return;
            seenCharges.add(entry.chargeKey);
          }
          plannedSum += Number(entry.price) || 0;
        });
      }
    });
    const dateKey = (value) => {
      const raw = String(value || '');
      const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
      const dmy = raw.match(/(\d{2})\.(\d{2})\.(\d{4})/);
      if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return '';
      return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
    };
    const dates = [
      ...(appointments || []).map((a) => a.date || a.appointment_date || a.start_time),
      ...(plans || []).map((p) => p.start_date || p.date || p.created_date),
      patient?.last_visit,
    ].map(dateKey).filter(Boolean).sort();
    const lastVisit = dates.length ? dates[dates.length - 1] : null;
    return { done, planned, plannedSum, lastVisit };
  }, [byTooth, appointments, plans, patient?.last_visit, upper, lower]);

  const plannedItem = useMemo(() => {
    const pool = [];
    Object.entries(byTooth).forEach(([fdi, list]) => {
      list.filter((e) => !e.done).forEach((e) => pool.push({ fdi, ...e }));
    });
    if (active) {
      const mine = pool.find((e) => e.fdi === String(active));
      if (mine) return mine;
    }
    return pool[0] || null;
  }, [byTooth, active]);

  const history = useMemo(() => {
    if (!active) return [];
    const fdi = String(active);
    const rows = (byTooth[fdi] || []).map((e, i) => ({
      id: `${e.planId || 'rec'}-${i}`,
      color: KIND_COLOR[e.kind] || '#64748B',
      title: e.surfaces?.length ? `${e.name} (${e.surfaces.join(', ')})` : e.name,
      price: e.price,
      doctor: formatDoctorName(e.doctor || ''),
      status: e.statusLabel || (e.done ? 'bajarildi' : 'reja'),
      dateLabel: fmtDate(e.date),
      date: e.date || '',
    }));
    (payments || []).forEach((p) => {
      const type = String(p.type || '').toLowerCase();
      if (type === 'debt' || type === 'discount') return;
      const notes = String(p.notes || '');
      if (/linked to plan/i.test(notes)) return;
      const blob = `${p.category || ''} ${notes} ${p.tooth_number || ''}`;
      if (!mentionsTooth(blob, fdi)) return;
      rows.push({
        id: `pay-${p.id}`,
        color: '#0F172A',
        title: p.category || p.service_name || p.type || "To'lov",
        price: p.amount,
        doctor: formatDoctorName(p.doctor_name || ''),
        status: p.type || "to'lov",
        dateLabel: fmtDate(p.date),
        date: p.date || '',
      });
    });
    return rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }, [active, byTooth, payments]);

  const toothXrays = useMemo(() => (
    xrays.filter((x) => String(x.tooth_number || '') === String(active))
  ), [xrays, active]);

  const surfaceSave = useRef(Promise.resolve());

  const writeSurfaces = async (fdi, next) => {
    if (!patient?.id || !fdi) return;
    const entry = primaryEntry(byTooth[String(fdi)], 'all');
    const note = withSurfaceNote(entry?.notes || '', next);
    if (entry?.planId && entry.servicePath) {
      const plan = (plans || []).find((p) => p.id === entry.planId);
      if (!plan) return;
      await base44.entities.TreatmentPlan.update(plan.id, {
        services: patchServiceNotes(plan.services, entry.servicePath, note),
      });
    } else {
      const existing = (toothRecords || []).find((r) => String(r.tooth_number) === String(fdi));
      const payload = {
        patient_id: patient.id,
        clinic_id: patient.clinic_id || user?.clinic_id || 'default_clinic',
        tooth_number: String(fdi),
        notes: note,
        condition: existing?.condition || null,
        treatment: existing?.treatment || null,
        status: existing?.status || 'planned',
      };
      if (existing?.id) await base44.entities.ToothRecord.update(existing.id, payload);
      else if (next.length) await base44.entities.ToothRecord.create(payload);
    }
    if (onReload) await onReload();
  };

  const toggleSurface = (s) => {
    if (!active) return;
    const next = surfaces.includes(s) ? surfaces.filter((x) => x !== s) : [...surfaces, s];
    setSurfaces(next);
    const fdi = active;
    surfaceSave.current = surfaceSave.current
      .then(() => writeSurfaces(fdi, next))
      .catch((err) => {
        console.error(err);
        toast.error('Yuza saqlanmadi');
      });
  };

  const onTooth = (fdi) => {
    if (multi) {
      setSelected((prev) => (prev.includes(fdi) ? prev.filter((n) => n !== fdi) : [...prev, fdi]));
      setActive(null);
      return;
    }
    setActive(fdi);
    const e = primaryEntry(byTooth[String(fdi)], 'all');
    setSurfaces(e?.surfaces || []);
    setNoteOpen(false);
  };

  const catalogPrice = (label) => {
    const q = String(label || '').toLowerCase();
    const hit = (services || []).find((s) => {
      const name = String(s.name || '').toLowerCase();
      return name && (name.includes(q) || q.includes(name));
    });
    return Number(hit?.price || hit?.cost || 0) || 0;
  };

  const doctorFields = () => {
    const doc = (doctors || []).find((d) => String(d.id) === String(user?.id)) || (doctors || [])[0];
    return {
      doctor_id: doc?.id || user?.id || '',
      doctor_name: doc?.name || doc?.full_name || user?.full_name || user?.name || '',
    };
  };

  const syncPatientBalance = async (patientId) => {
    const allPays = await base44.entities.Payment.filter({ patient_id: patientId }, 'date', 5000);
    const totalOf = (type) => (allPays || [])
      .filter((p) => String(p.type || '').toLowerCase() === type)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalDebts = totalOf('debt');
    const totalIncomes = totalOf('income');
    const totalRefunds = totalOf('refund');
    const totalDiscounts = (allPays || [])
      .filter((p) => String(p.type || '').toLowerCase() === 'discount')
      .reduce((sum, p) => sum + Math.abs(Number(p.amount) || 0), 0);
    await base44.entities.Patient.update(patientId, {
      total_paid: totalIncomes,
      total_debt: Math.max(0, (totalDebts + totalRefunds) - (totalIncomes + totalDiscounts)),
    });
  };

  const openPlanComposer = () => {
    if (typeof onOpenPlan === 'function') onOpenPlan();
    else toast.error('Yangi reja oynasini ochib bo‘lmadi');
  };

  const pickActivePlan = () => {
    const open = (plans || []).filter((plan) => {
      const status = String(plan?.status || '').toLowerCase();
      return status !== 'completed' && status !== 'cancelled' && status !== 'canceled';
    });
    if (open.length !== 1) return null;
    return open[0];
  };

  const visibleJawTeeth = (scope) => {
    const child = dentition === 'child';
    return expandJawToothNumbers(scope).filter((fdi) => {
      const quad = Math.floor(Number(fdi) / 10);
      return child ? quad >= 5 : quad >= 1 && quad <= 4;
    });
  };

  const saveFinding = async (fdi, serviceName, kindHint) => {
    const tooth = String(fdi);
    const surfaceNote = surfaces.length && tooth === String(active) ? `Yuza: ${surfaces.join(', ')}` : '';
    const existing = (toothRecords || []).find((row) => (
      String(row.tooth_number) === tooth
      && /\[finding\]/i.test(String(row.notes || ''))
      && (row.condition === kindHint || row.treatment === serviceName)
    ));
    const payload = {
      patient_id: patient.id,
      clinic_id: patient.clinic_id || user?.clinic_id || 'default_clinic',
      tooth_number: tooth,
      condition: kindHint || '',
      treatment: serviceName,
      notes: ['[finding]', surfaceNote].filter(Boolean).join(' '),
    };
    if (existing?.id) await base44.entities.ToothRecord.update(existing.id, payload);
    else await base44.entities.ToothRecord.create(payload);
  };

  const markFindings = async (fdis, serviceName, kindHint) => {
    if (!patient?.id || patient.id === 'patient-y2ii8ynf2') return;
    const teeth = [...new Set((fdis || []).map((fdi) => String(fdi)).filter(Boolean))];
    if (!teeth.length) return;
    setBusy(true);
    try {
      for (const fdi of teeth) {
        await saveFinding(fdi, serviceName, kindHint);
      }
      toast.success('Tish holati saqlandi');
      setNoteOpen(false);
      setNoteText('');
      setJawPrompt(null);
      if (onReload) await onReload();
    } catch (err) {
      console.error(err);
      toast.error('Tish holati saqlanmadi');
    } finally {
      setBusy(false);
    }
  };

  const appendLinesToActivePlan = async (lines, total) => {
    if (!patient?.id || patient.id === 'patient-y2ii8ynf2') return;
    const doc = doctorFields();
    if (!doc.doctor_id) {
      toast.error('Shifokor tanlanmagan');
      return;
    }
    const openCount = (plans || []).filter((plan) => {
      const status = String(plan?.status || '').toLowerCase();
      return status !== 'completed' && status !== 'cancelled' && status !== 'canceled';
    }).length;
    const plan = pickActivePlan();
    if (!plan) {
      toast.message(openCount > 1
        ? 'Bir nechta faol reja bor. Yangi reja oynasida qo‘shing.'
        : 'Faol reja yo‘q. Yangi reja ochildi.');
      openPlanComposer();
      return;
    }
    const rows = (lines || []).map((row) => ({
      ...row,
      tooth: row.tooth || row.tooth_number,
      status: row.status || 'planned',
    }));
    const prevTeeth = String(plan.tooth_number || '').split(/[,·]/).map((part) => part.trim()).filter(Boolean);
    const toothLabel = [...prevTeeth];
    rows.forEach((row) => {
      const label = String(row.tooth_number || '').trim();
      if (label && !toothLabel.includes(label)) toothLabel.push(label);
    });
    setBusy(true);
    try {
      await base44.entities.TreatmentPlan.update(plan.id, {
        services: [...(plan.services || []), ...rows],
        total_price: (Number(plan.total_price) || 0) + (Number(total) || 0),
        tooth_number: toothLabel.join(', '),
      });
      if (total > 0) {
        const linked = await paymentsForPlan(patient.id, plan.id);
        const debt = linked.find((payment) => String(payment.type || '').toLowerCase() === 'debt');
        if (debt?.id) {
          await base44.entities.Payment.update(debt.id, {
            amount: (Number(debt.amount) || 0) + total,
          });
        } else {
          await base44.entities.Payment.create({
            patient_id: patient.id,
            patient_name: patient.full_name || '',
            doctor_id: doc.doctor_id,
            type: 'Debt',
            category: `Reja: ${toothLabel.join(', ')}`,
            amount: total,
            method: '—',
            date: new Date().toISOString().split('T')[0],
            notes: `Linked to Plan: ${plan.id}`,
          });
        }
        await syncPatientBalance(patient.id);
      }
      toast.success(`«${plan.name || 'Reja'}» rejasiga qo‘shildi`);
      setNoteOpen(false);
      setNoteText('');
      setJawPrompt(null);
      if (onReload) await onReload();
    } catch (err) {
      console.error(err);
      toast.error('Rejaga qo‘shib bo‘lmadi');
    } finally {
      setBusy(false);
    }
  };

  const addToActivePlan = async (fdis, serviceName, kindHint, billing = 'each') => {
    const teeth = (fdis || []).map(String).filter(Boolean);
    if (!teeth.length) return;
    const price = catalogPrice(serviceName);
    const charge = toothGroupCharge(price, teeth.length, billing);
    const surfaceNote = surfaces.length ? `Yuza: ${surfaces.join(', ')}` : '';
    const lines = teeth.map((fdi, index) => ({
      service_name: serviceName,
      tooth_number: fdi,
      price: charge.linePrices[index] || 0,
      status: 'planned',
      category: kindHint || '',
      notes: surfaceNote,
    }));
    await appendLinesToActivePlan(lines, charge.total);
  };

  const openJawPrompt = (family, fdi, mode = 'finding') => {
    setJawPrompt({
      family,
      title: jawFamilyTitle(family),
      preset: jawFromFdi(fdi),
      mode,
    });
  };

  const applyJawChoice = async (family, choice, mode) => {
    if (mode === 'plan') {
      const lines = buildJawPlanLines(family, choice, services);
      await appendLinesToActivePlan(lines, jawPlanTotal(lines));
      return;
    }
    const scopes = choice === 'both' ? ['upper', 'lower'] : [choice === 'lower' ? 'lower' : 'upper'];
    const teeth = scopes.flatMap((scope) => visibleJawTeeth(scope));
    const label = scopes.length === 1 ? jawServiceName(family, scopes[0]) : jawFamilyTitle(family);
    await markFindings(teeth, label, family);
  };

  const markDone = async (item) => {
    if (!item?.planId) {
      toast.error('Bu yozuvni rejadan yopib bo‘lmaydi');
      return;
    }
    const plan = (plans || []).find((p) => p.id === item.planId);
    if (!plan) return;
    const markRow = (svc) => ({ ...svc, status: 'completed', completed: true });
    const services = (plan.services || []).map((svc, index) => {
      if (Array.isArray(svc.items)) {
        return {
          ...svc,
          items: svc.items.map((inner, itemIndex) => (
            item.servicePath && item.servicePath.parent === index && item.servicePath.item === itemIndex
              ? markRow(inner)
              : inner
          )),
        };
      }
      const hit = item.servicePath
        ? item.servicePath.parent === index && item.servicePath.item == null
        : false;
      return hit ? markRow(svc) : svc;
    });
    const allDone = flattenPlanServices({ ...plan, services }).every((row) => row.completed === true || isDoneStatus(row.status) || isDoneStatus(row.payment_status));
    setBusy(true);
    try {
      await base44.entities.TreatmentPlan.update(plan.id, {
        services,
        status: allDone || services.length === 0 ? 'completed' : plan.status,
      });
      toast.success('Bajarildi');
      if (onReload) await onReload();
    } catch (err) {
      console.error(err);
      toast.error('Yangilab bo‘lmadi');
    } finally {
      setBusy(false);
    }
  };

  const uploadXray = async (file) => {
    if (!file || !patient?.id || !active) return;
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    setBusy(true);
    try {
      await base44.entities.Xray.create({
        patient_id: patient.id,
        image_url: dataUrl,
        description: `${active}-tish rentgeni`,
        tooth_number: String(active),
        date: new Date().toISOString().split('T')[0],
      });
      toast.success('Rentgen yuklandi');
      await loadXrays();
      if (onReload) await onReload();
    } catch (err) {
      console.error(err);
      toast.error('Rentgen yuklanmadi');
    } finally {
      setBusy(false);
    }
  };

  const createRecord = async () => {
    if (!patient?.id || !active) return;
    const text = noteText.trim() || 'Yangi yozuv';
    const surfaceNote = surfaces.length ? `Yuza: ${surfaces.join(', ')}` : '';
    setBusy(true);
    try {
      await base44.entities.ToothRecord.create({
        patient_id: patient.id,
        clinic_id: patient.clinic_id || user?.clinic_id || 'default_clinic',
        tooth_number: String(active),
        treatment: text,
        notes: [text, surfaceNote].filter(Boolean).join('. '),
        status: 'planned',
        doctor: doctorFields().doctor_name,
      });
      toast.success('Yozuv qo‘shildi');
      setNoteOpen(false);
      setNoteText('');
      if (onReload) await onReload();
    } catch (err) {
      console.error(err);
      toast.error('Yozuv saqlanmadi');
    } finally {
      setBusy(false);
    }
  };

  const activeEntry = active ? primaryEntry(byTooth[String(active)], 'all') : null;
  const showPanel = !phone;
  const showSheet = phone && (active || (multi && selected.length > 0));
  const doctorLabel = doctorFields().doctor_name || '';
  const query = String(search || '').trim().toLowerCase().replace(/^#/, '');
  const toothMatches = (fdi, entry) => {
    if (!query) return true;
    if (String(fdi).includes(query)) return true;
    return `${entry?.name || ''} ${entry?.kind || ''}`.toLowerCase().includes(query);
  };

  const printChart = () => {
    const node = document.getElementById('tooth-chart-print');
    if (!node) return;
    const host = document.createElement('div');
    host.id = 'tooth-chart-print-host';
    host.appendChild(node.cloneNode(true));
    document.body.appendChild(host);
    document.body.classList.add('printing-tooth-chart');
    const cleanup = () => {
      document.body.classList.remove('printing-tooth-chart');
      host.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    window.print();
  };

  const renderHalf = (fdis, isUpper) => (
    <div
      className="odonto-quad"
      style={{
        gridTemplateColumns: phone
          ? fdis.map((n) => `minmax(40px, ${fdiWidthWeight(n)}fr)`).join(' ')
          : fdiGridTemplate(fdis),
      }}
    >
      {fdis.map((n) => {
        const entry = entryFor(n);
        return (
          <ToothCell
            key={n}
            fdi={n}
            isUpper={isUpper}
            entry={entry}
            active={active === n}
            picked={selected.includes(n)}
            dim={!toothMatches(n, entry)}
            onClick={() => onTooth(n)}
          />
        );
      })}
    </div>
  );

  const splitAt = (list) => Math.ceil(list.length / 2);

  return (
    <div id="tooth-chart-print" className="tooth-chart-root min-w-0 max-w-full overflow-x-hidden">
      <div className={cn('tooth-chart-grid min-w-0', phone && 'grid gap-3', railNode && 'tooth-chart-grid--solo')}>
        <div className="tooth-chart-main min-w-0 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm sm:p-3">
          <div className="tooth-chart-toolbar">
          <div className="flex flex-wrap items-center gap-2">
            {!phone && <h3 className="mr-1 text-sm font-extrabold text-slate-900">Tish kartasi</h3>}
            <Seg
              testid="dentition-toggle"
              value={dentition}
              onChange={(id) => {
                dentitionTouched.current = true;
                setDentition(id);
              }}
              options={[
                { id: 'adult', label: 'Doimiy' },
                { id: 'child', label: 'Sut tishlari' },
              ]}
            />
            {dentitionHint(ageYears) && (
              <p className="basis-full text-[11px] font-semibold text-slate-500" data-testid="dentition-age-hint">
                {dentitionHint(ageYears)}
              </p>
            )}
            <button
              type="button"
              onClick={() => { setMulti((v) => !v); setSelected([]); }}
              className={cn(
                'compact-hit inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-bold',
                multi ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700',
              )}
            >
              <Layers className="h-3.5 w-3.5" />
              Ko‘p tanlash{selected.length ? ` · ${selected.length}` : ''}
            </button>
            {!phone && (
              <div className="ml-auto flex items-center gap-2">
                <Seg
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { id: 'all', label: 'Hammasi' },
                    { id: 'plan', label: 'Reja' },
                    { id: 'done', label: 'Bajarilgan' },
                  ]}
                />
                <button type="button" onClick={printChart} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600" aria-label="Chop etish">
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {phone && (
            <div className="mt-2 min-w-0 max-w-full overflow-x-auto">
              <div className="flex w-max items-center gap-2">
                <Seg
                  value={filter}
                  onChange={setFilter}
                  options={[
                    { id: 'all', label: 'Hammasi' },
                    { id: 'plan', label: 'Reja' },
                    { id: 'done', label: 'Bajarilgan' },
                  ]}
                />
                <button type="button" onClick={printChart} className="compact-hit grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-600" aria-label="Chop etish">
                  <Printer className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div className={cn('tooth-legend mt-2', phone && 'chip-rail')}>
            <div className={cn(phone ? 'chip-rail-scroll' : 'tooth-legend-row flex flex-wrap gap-1.5')}>
              {LEGEND.map((k) => (
                <span key={k.id} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-solid border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600">
                  <i className="h-2 w-2 rounded-sm" style={{ background: k.color }} />
                  {k.label}
                </span>
              ))}
            </div>
          </div>
          </div>

          <div className="odonto-fit-frame mt-2" data-compact={phone ? 'true' : 'false'}>
              <div className={cn('odonto-scroll-shell', phone && 'is-hint')}>
                {phone && (
                  <>
                    <div className="mb-2 grid grid-cols-2 gap-1.5" data-testid="arch-half-tabs">
                      <button
                        type="button"
                        data-testid="arch-half-right"
                        onClick={() => {
                          setArchHalf('right');
                          archScrollRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
                        }}
                        className={cn(
                          'h-9 rounded-xl text-[12px] font-extrabold',
                          archHalf === 'right' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {dentition === 'child' ? 'O‘ng · 55–51' : 'O‘ng · 18–11'}
                      </button>
                      <button
                        type="button"
                        data-testid="arch-half-left"
                        onClick={() => {
                          setArchHalf('left');
                          const node = archScrollRef.current;
                          if (!node) return;
                          node.scrollTo({ left: Math.max(0, node.scrollWidth - node.clientWidth), behavior: 'smooth' });
                        }}
                        className={cn(
                          'h-9 rounded-xl text-[12px] font-extrabold',
                          archHalf === 'left' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700',
                        )}
                      >
                        {dentition === 'child' ? 'Chap · 61–65' : 'Chap · 21–28'}
                      </button>
                    </div>
                    <p className="odonto-scroll-hint">
                      {dentition === 'child'
                        ? 'Chap yarmi yashirin. «Chap · 61–65» ni bosing yoki suring →'
                        : 'Chap yarmi yashirin. «Chap · 21–28» ni bosing yoki suring →'}
                    </p>
                  </>
                )}
                <div
                  ref={archScrollRef}
                  className="odonto-scroll"
                  data-arch="scroll"
                  onScroll={(event) => {
                    if (!phone) return;
                    const node = event.currentTarget;
                    const max = node.scrollWidth - node.clientWidth;
                    if (max <= 8) return;
                    setArchHalf(node.scrollLeft > max / 2 ? 'left' : 'right');
                  }}
                >
                  <div className="odonto-cross">
                    <div className="odonto-jaw-band">
                      <span className="odonto-side odonto-side-r">O‘NG</span>
                      <span className="odonto-side odonto-side-l">CHAP</span>
                      <div className="odonto-jaw odonto-jaw-upper">
                        {renderHalf(upper.slice(0, splitAt(upper)), true)}
                        <div className="odonto-midline" aria-hidden="true" />
                        {renderHalf(upper.slice(splitAt(upper)), true)}
                      </div>
                    </div>
                    <div className="odonto-bite-line" aria-hidden="true" />
                    <div className="odonto-jaw-band">
                      <span className="odonto-side odonto-side-r">{dentition === 'child' ? 'O‘NG' : 'CHAP'}</span>
                      <span className="odonto-side odonto-side-l">{dentition === 'child' ? 'CHAP' : 'O‘NG'}</span>
                      <div className="odonto-jaw odonto-jaw-lower">
                        {renderHalf(lower.slice(0, splitAt(lower)), false)}
                        <div className="odonto-midline" aria-hidden="true" />
                        {renderHalf(lower.slice(splitAt(lower)), false)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
          </div>
          {phone && (summary.planned > 0 || summary.done > 0) && (
            <p className="mt-1 px-1 text-[11px] text-slate-500">
              {summary.planned > 0 && <b className="text-rose-600">{summary.planned} reja</b>}
              {summary.planned > 0 && summary.done > 0 ? ' · ' : ''}
              {summary.done > 0 ? `${summary.done} bajarilgan` : ''}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Stat label="Bajarilgan" value={`${summary.done}`} unit="tish" />
              <Stat label="Reja" value={`${summary.planned}`} unit="tish" accent="#E11D48" />
              <Stat label="Reja summasi" value={summary.plannedSum > 0 ? formatMoneyAmount(summary.plannedSum) : '0'} unit="so'm" />
              <Stat label="Oxirgi tashrif" value={summary.lastVisit ? fmtDate(summary.lastVisit) : '—'} />
            </div>

          {plannedItem && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-100 bg-rose-50/70 px-2 py-2">
              <span className="rounded-md bg-rose-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white">{plannedItem.fdi}</span>
              <b className="text-xs font-bold text-slate-900">{plannedItem.name}</b>
              <span className="text-[11px] text-slate-500">
                Reja{plannedItem.doctor ? ` · ${plannedItem.doctor}` : ''}{money(plannedItem.price) ? ` · ${money(plannedItem.price)}` : ''}
              </span>
              <span className="ml-auto flex gap-1.5">
                <button type="button" onClick={() => onBookAppointment && onBookAppointment(plannedItem)} className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700">Qabulga yozish</button>
                <button type="button" disabled={busy} onClick={() => markDone(plannedItem)} className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white disabled:opacity-60">
                  <Check className="h-3.5 w-3.5" /> Bajarildi
                </button>
              </span>
            </div>
          )}

          {!plannedItem && (
            <p className="mt-2 rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-400">Rejadagi ish yo‘q</p>
          )}

          {multi && selected.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-white">
              <Layers className="h-4 w-4" />
              <div className="min-w-0">
                <b className="block text-xs">{selected.length} ta tish tanlandi</b>
                <span className="text-[11px] text-white/70">{selected.join(', ')}</span>
              </div>
              <span className="ml-auto flex flex-wrap gap-1.5">
                <button type="button" onClick={() => setSelected([])} className="h-8 rounded-lg bg-white/10 px-2 text-xs font-bold">Bekor qilish</button>
                <button type="button" disabled={busy} onClick={() => addToActivePlan(selected, 'Bir xil davolash', 'plomba', 'each')} className="h-8 rounded-lg bg-white/10 px-2 text-xs font-bold">Bir xil davolash</button>
                <button type="button" disabled={busy} onClick={() => addToActivePlan(selected, "Ko‘prik (protez)", 'sirkon', 'once')} className="h-8 rounded-lg bg-white/10 px-2 text-xs font-bold">Ko‘prik (protez)</button>
                <button type="button" disabled={busy} onClick={() => openJawPrompt('breket', selected[0], 'plan')} className="h-8 rounded-lg bg-pink-600 px-2 text-xs font-bold">Breket — jag'</button>
              </span>
            </div>
          )}
        </div>

        {showPanel && !phone && !railNode && (
          <SidePanel
            active={active}
            activeEntry={activeEntry}
            multi={multi}
            selected={selected}
            groupAction={groupAction}
            setGroupAction={setGroupAction}
            surfaces={surfaces}
            toggleSurface={toggleSurface}
            history={history}
            toothXrays={toothXrays}
            busy={busy}
            noteOpen={noteOpen}
            noteText={noteText}
            setNoteText={setNoteText}
            setNoteOpen={setNoteOpen}
            onClose={() => { setActive(null); setSelected([]); }}
            onQuick={(item) => (item.jaw ? openJawPrompt(item.jaw, active, 'finding') : markFindings([active], item.service, item.id))}
            onNote={() => markFindings([active], noteText.trim() || 'Izoh', 'note')}
            onGroup={() => {
              if (groupAction === 'breket') {
                openJawPrompt('breket', selected[0], 'plan');
                return;
              }
              const map = {
                bridge: ["Ko‘prik (protez)", 'sirkon', 'once'],
                same: ['Bir xil davolash', 'plomba', 'each'],
                implant: ['Implant', 'implant', 'each'],
              };
              const [name, kind, billing] = map[groupAction];
              addToActivePlan(selected, name, kind, billing);
            }}
            doctorName={doctorLabel}
            unitPrice={groupAction === 'breket'
              ? priceForJawService(services, 'breket', 'upper')
              : catalogPrice(({ bridge: "Ko‘prik (protez)", same: 'Plomba', implant: 'Implant' })[groupAction] || '')}
            jawPrompt={jawPrompt}
            onJawChoose={(choice) => jawPrompt && applyJawChoice(jawPrompt.family, choice, jawPrompt.mode)}
            onJawClose={() => setJawPrompt(null)}
            onUpload={uploadXray}
            onView={setViewer}
            onAddToPlan={() => addToActivePlan([active], activeEntry?.name || 'Davolash', activeEntry?.kind || '')}
            onNewRecord={createRecord}
          />
        )}
      </div>
      {showPanel && !phone && railNode && createPortal(
        <SidePanel
          embedded
          active={active}
          activeEntry={activeEntry}
          multi={multi}
          selected={selected}
          groupAction={groupAction}
          setGroupAction={setGroupAction}
          surfaces={surfaces}
          toggleSurface={toggleSurface}
          history={history}
          toothXrays={toothXrays}
          busy={busy}
          noteOpen={noteOpen}
          noteText={noteText}
          setNoteText={setNoteText}
          setNoteOpen={setNoteOpen}
          onClose={() => { setActive(null); setSelected([]); }}
          onQuick={(item) => (item.jaw ? openJawPrompt(item.jaw, active, 'finding') : markFindings([active], item.service, item.id))}
          onNote={() => markFindings([active], noteText.trim() || 'Izoh', 'note')}
          onGroup={() => {
            if (groupAction === 'breket') {
              openJawPrompt('breket', selected[0], 'plan');
              return;
            }
            const map = {
              bridge: ["Ko‘prik (protez)", 'sirkon', 'once'],
              same: ['Bir xil davolash', 'plomba', 'each'],
              implant: ['Implant', 'implant', 'each'],
            };
            const [name, kind, billing] = map[groupAction];
            addToActivePlan(selected, name, kind, billing);
          }}
          doctorName={doctorLabel}
          unitPrice={groupAction === 'breket'
            ? priceForJawService(services, 'breket', 'upper')
            : catalogPrice(({ bridge: "Ko‘prik (protez)", same: 'Plomba', implant: 'Implant' })[groupAction] || '')}
          jawPrompt={jawPrompt}
          onJawChoose={(choice) => jawPrompt && applyJawChoice(jawPrompt.family, choice, jawPrompt.mode)}
          onJawClose={() => setJawPrompt(null)}
          onUpload={uploadXray}
          onView={setViewer}
          onAddToPlan={() => addToActivePlan([active], activeEntry?.name || 'Davolash', activeEntry?.kind || '')}
          onNewRecord={createRecord}
        />,
        railNode,
      )}

      {showSheet && (
        <div className="fixed inset-x-0 z-[60] mx-auto flex max-h-[70vh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl bg-white shadow-[0_-12px_40px_rgba(15,23,42,0.25)]" style={{ bottom: sheetOffset }}>
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200" />
          <SidePanel
            sheet
            active={active}
            activeEntry={activeEntry}
            multi={multi}
            selected={selected}
            groupAction={groupAction}
            setGroupAction={setGroupAction}
            surfaces={surfaces}
            toggleSurface={toggleSurface}
            history={history}
            toothXrays={toothXrays}
            busy={busy}
            noteOpen={noteOpen}
            noteText={noteText}
            setNoteText={setNoteText}
            setNoteOpen={setNoteOpen}
            onClose={() => { setActive(null); setSelected([]); }}
            onQuick={(item) => (item.jaw ? openJawPrompt(item.jaw, active, 'finding') : markFindings([active], item.service, item.id))}
            onNote={() => markFindings([active], noteText.trim() || 'Izoh', 'note')}
            onGroup={() => {
              if (groupAction === 'breket') {
                openJawPrompt('breket', selected[0], 'plan');
                return;
              }
              const map = {
                bridge: ["Ko‘prik (protez)", 'sirkon', 'once'],
                same: ['Bir xil davolash', 'plomba', 'each'],
                implant: ['Implant', 'implant', 'each'],
              };
              const [name, kind, billing] = map[groupAction];
              addToActivePlan(selected, name, kind, billing);
            }}
            doctorName={doctorLabel}
            unitPrice={groupAction === 'breket'
              ? priceForJawService(services, 'breket', 'upper')
              : catalogPrice(({ bridge: "Ko‘prik (protez)", same: 'Plomba', implant: 'Implant' })[groupAction] || '')}
            jawPrompt={jawPrompt}
            onJawChoose={(choice) => jawPrompt && applyJawChoice(jawPrompt.family, choice, jawPrompt.mode)}
            onJawClose={() => setJawPrompt(null)}
            onUpload={uploadXray}
            onView={setViewer}
            onAddToPlan={() => addToActivePlan([active], activeEntry?.name || 'Davolash', activeEntry?.kind || '')}
            onNewRecord={createRecord}
          />
        </div>
      )}

      {viewer && (
        <button type="button" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={() => setViewer(null)}>
          <img src={viewer} alt="Rentgen" className="max-h-[80vh] max-w-full rounded-xl" />
        </button>
      )}
    </div>
  );
}

function Seg({ value, onChange, options, testid }) {
  return (
    <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5" data-testid={testid}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          data-testid={testid ? `${testid}-${o.id}` : undefined}
          onClick={() => onChange(o.id)}
          className={cn('compact-hit h-7 shrink-0 rounded-md px-2 text-[11px] font-bold whitespace-nowrap', value === o.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Stat({ label, value, unit, accent }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-2.5 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-extrabold tabular-nums" style={{ color: accent || '#0F172A' }}>
        {value} {unit && <small className="text-[10px] font-bold text-slate-400">{unit}</small>}
      </div>
    </div>
  );
}

function ToothCell({ fdi, isUpper, entry, active, picked, dim, onClick }) {
  const color = entry ? KIND_COLOR[entry.kind] : null;
  const src = getToothIllustrationSrc(fdi, entry?.illustration && entry.illustration !== 'missing' ? entry.illustration : (entry?.kind === 'missing' ? 'missing' : 'healthy'));
  const crownDown = fdiCrownDown(fdi);
  const label = `${fdi}-tish`;
  return (
    <button
      type="button"
      onClick={onClick}
      data-fdi={fdi}
      aria-label={label}
      title={label}
      className={cn('compact-hit flex w-full min-w-0 max-w-full flex-col', isUpper ? 'justify-end' : 'justify-start', dim && 'opacity-30')}
      style={{ '--fdi-len': fdiLengthWeight(fdi) }}
    >
      <span
        className="tooth-face relative flex w-full max-w-full items-center justify-center overflow-hidden rounded-md"
        style={{
          boxSizing: 'border-box',
          border: '2px solid transparent',
          opacity: entry?.kind === 'missing' ? 0.45 : 1,
          boxShadow: active || picked ? 'inset 0 0 0 2px #0F172A' : 'none',
          alignItems: crownDown ? 'flex-end' : 'flex-start',
        }}
      >
        {src && (
          <img
            src={src}
            alt=""
            draggable={false}
            className="h-[94%] w-full max-w-full min-w-0 object-contain"
            style={{ objectPosition: crownDown ? 'center bottom' : 'center top' }}
          />
        )}
        {color && (
          <span
            className={cn('tooth-status-dot', crownDown ? 'is-upper' : 'is-lower')}
            style={{ background: color }}
            aria-hidden="true"
          />
        )}
        {entry?.kind === 'missing' && (
          <X className="absolute h-5 w-5 text-slate-500" strokeWidth={2.5} />
        )}
      </span>
    </button>
  );
}

function SidePanel(props) {
  const {
    sheet, embedded, active, activeEntry, multi, selected, groupAction, setGroupAction,
    surfaces, toggleSurface, history, toothXrays, busy, noteOpen, noteText,
    setNoteText, setNoteOpen, onClose, onQuick, onNote, onGroup, onUpload, onView,
    doctorName, unitPrice, onAddToPlan, onNewRecord,
    jawPrompt, onJawChoose, onJawClose,
  } = props;
  const [showAllHistory, setShowAllHistory] = useState(false);
  useEffect(() => { setShowAllHistory(false); }, [active]);
  const group = multi && selected.length > 0 && !active;
  const groupCharge = toothGroupCharge(unitPrice, selected.length, toothGroupBilling(groupAction));
  const historyRows = showAllHistory ? history : history.slice(0, 3);
  const statusLabel = activeEntry
    ? (LEGEND.find((k) => k.id === activeEntry.kind)?.label || activeEntry.name)
    : '';
  return (
    <aside data-tooth-panel={sheet ? 'sheet' : 'side'} className={cn('flex min-w-0 flex-col self-start bg-white', sheet ? 'max-h-[72vh] overflow-hidden rounded-none border-0' : embedded ? 'h-full min-h-0 max-h-full overflow-hidden rounded-2xl border border-slate-200' : 'max-h-[min(760px,calc(100dvh-8rem))] overflow-hidden rounded-2xl border border-slate-200')}>
      <div className="flex items-start gap-2 border-b border-slate-100 p-3">
        {active && !group && (
          <img
            src={getToothIllustrationSrc(active, activeEntry?.illustration && activeEntry.illustration !== 'missing' ? activeEntry.illustration : (activeEntry?.kind === 'missing' ? 'missing' : (activeEntry?.kind || 'healthy')))}
            alt=""
            className="h-16 w-11 shrink-0 object-contain"
            style={{ objectPosition: fdiCrownDown(active) ? 'center bottom' : 'center top' }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="text-sm font-extrabold text-slate-900">
              {group ? `Guruh amali · ${selected.length} ta tish` : active ? `${active}-tish` : 'Tish kartasi'}
            </h4>
            {(active || group) && (
              <button type="button" onClick={onClose} className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-slate-200" aria-label="Yopish">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="text-[11px] leading-snug text-slate-500">
            {group ? selected.join(' · ') : active ? toothTitle(active) : 'Tishni tanlang'}
          </p>
          {activeEntry && !group && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span data-testid="tooth-status-label" className="rounded-full px-2 py-0.5 text-[10px] font-extrabold text-white" style={{ background: KIND_COLOR[activeEntry.kind] || '#64748B' }}>
                {activeEntry.kind === 'implant'
                  ? (activeEntry.statusLabel || 'Rejalashtirilgan')
                  : `${statusLabel} · ${activeEntry.done ? 'bajarildi' : 'reja'}`}
              </span>
            </div>
          )}
          {active && !group && (
            <div className="mt-2 flex gap-1">
              {['V', 'M', 'O', 'D', 'L'].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSurface(s)}
                  className={cn('grid h-7 w-7 place-items-center rounded-md border text-[11px] font-extrabold', surfaces.includes(s) ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 text-slate-600')}
                  aria-pressed={surfaces.includes(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {jawPrompt && (
          <JawChoice
            title={jawPrompt.title}
            preset={jawPrompt.preset}
            busy={busy}
            onChoose={onJawChoose}
            onClose={onJawClose}
          />
        )}
        {!active && !group && (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs font-semibold text-slate-400">Tishni tanlang</p>
        )}
        {group && (
          <div className="space-y-1.5">
            {[
              ['breket', '#DB2777', 'Breket', "Butun jag' — bir marta"],
              ['bridge', '#CA8A04', "Ko‘prik (protez)", 'Tayanch va oraliq tishlar'],
              ['same', '#2563EB', 'Bir xil davolash', 'Bitta reja, har bir tishga'],
              ['implant', '#64748B', 'Implantlar seriyasi', 'Har bir tishga implant'],
            ].map(([id, color, title, sub]) => (
              <button key={id} type="button" onClick={() => setGroupAction(id)} className="flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left" style={{ borderColor: groupAction === id ? color : '#E2E8F0' }}>
                <i className="h-3 w-3 rounded" style={{ background: color }} />
                <span className="min-w-0 flex-1">
                  <b className="block text-xs font-bold">{title}</b>
                  <span className="text-[11px] text-slate-500">{sub}</span>
                </span>
                {groupAction === id && <Check className="h-4 w-4" style={{ color }} />}
              </button>
            ))}
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              <div className="rounded-lg border border-slate-100 px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">Shifokor</div>
                <div className="truncate text-xs font-bold">{doctorName || '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-100 px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">Holat</div>
                <div className="text-xs font-bold">Reja</div>
              </div>
              <div className="rounded-lg border border-slate-100 px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">Narx</div>
                <div className="text-xs font-bold">{groupCharge.total > 0 ? (groupCharge.billing === 'once' ? money(unitPrice) : `${selected.length} × ${unitPrice.toLocaleString('uz-UZ')}`) : '—'}</div>
              </div>
              <div className="rounded-lg border border-slate-100 px-2 py-1.5">
                <div className="text-[10px] font-bold uppercase text-slate-400">Jami</div>
                <div className="text-xs font-bold">{groupCharge.total > 0 ? money(groupCharge.total) : '—'}</div>
              </div>
            </div>
          </div>
        )}
        {active && !group && (
          <>
            <div>
              <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">Tezkor qo‘shish</div>
              <div className="grid grid-cols-4 gap-1.5">
                {QUICK.map((item) => (
                  <button key={item.id} type="button" disabled={busy} onClick={() => onQuick(item)} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 px-0.5 py-1 text-center text-[9px] font-bold leading-tight text-slate-700 disabled:opacity-50">
                    <i className="h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[item.id] }} />
                    {item.label}
                  </button>
                ))}
                <button type="button" onClick={() => setNoteOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl border border-slate-200 px-0.5 py-1 text-center text-[9px] font-bold leading-tight text-slate-700">
                  <i className="h-2.5 w-2.5 rounded-sm bg-slate-900" />
                  Izoh
                </button>
              </div>
              {noteOpen && (
                <div className="mt-2 flex gap-1.5">
                  <input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Izoh" className="h-8 min-w-0 flex-1 rounded-lg border border-slate-200 px-2 text-xs" />
                  <button type="button" disabled={busy || !noteText.trim()} onClick={onNote} className="h-8 rounded-lg bg-slate-900 px-2 text-xs font-bold text-white disabled:opacity-50">Saqlash</button>
                </div>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                <span>Tish tarixi</span>
                {history.length > 0 && (
                  <button type="button" onClick={() => setShowAllHistory((v) => !v)} className="font-bold normal-case tracking-normal text-sky-600">
                    Hammasi ({history.length})
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">Bu tishda yozuv yo‘q</p>
              ) : (
                <div className="space-y-2">
                  {historyRows.map((row) => (
                    <div key={row.id} className="border-l-2 pl-2" style={{ borderColor: row.color }}>
                      <div className="flex items-baseline justify-between gap-2">
                        <b className="text-xs font-bold text-slate-900">{row.title}</b>
                        {money(row.price) && <span className="shrink-0 text-[11px] font-bold tabular-nums">{money(row.price)}</span>}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {[row.dateLabel, row.doctor, row.status].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                <span>Rentgen / RVG</span>
                <label className="cursor-pointer font-bold normal-case tracking-normal text-sky-600">
                  + Yuklash
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ''; }} />
                </label>
              </div>
              {toothXrays.length === 0 ? (
                <div data-testid="xray-empty" className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center">
                  <p className="text-xs font-bold text-slate-600">Hali rentgen yoki RVG yo‘q</p>
                  <p className="mt-1 text-[11px] text-slate-400">Rasm qo‘shish uchun Yuklash tugmasidan foydalaning.</p>
                </div>
              ) : (
                <div className="flex gap-2 overflow-x-auto">
                  {toothXrays.map((x) => (
                    <button key={x.id} type="button" onClick={() => onView(x.image_url)} className="w-16 shrink-0">
                      <img src={x.image_url} alt="" className="h-14 w-16 rounded-lg object-cover" />
                      <span className="mt-0.5 block truncate text-[10px] text-slate-500">{fmtDate(x.date)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      {group && (
        <div className="flex gap-2 border-t border-slate-100 bg-white p-3">
          <button type="button" onClick={onClose} className="h-9 flex-1 rounded-xl border border-slate-200 text-xs font-bold">Bekor qilish</button>
          <button type="button" disabled={busy} onClick={onGroup} className="inline-flex h-9 flex-[1.4] items-center justify-center gap-1 rounded-xl bg-slate-900 text-xs font-bold text-white disabled:opacity-60">
            <Plus className="h-3.5 w-3.5" /> Rejaga qo‘shish ({selected.length})
          </button>
        </div>
      )}
      {active && !group && (
        <div className="tooth-sheet-actions flex gap-2 border-t border-slate-100 bg-white px-4 py-3">
          <button type="button" disabled={busy} onClick={onAddToPlan} className="h-9 flex-1 rounded-xl bg-slate-900 text-xs font-bold text-white disabled:opacity-60">
            Rejaga qo‘shish
          </button>
          <button type="button" disabled={busy} onClick={onNewRecord} className="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 disabled:opacity-60">
            <Plus className="h-3.5 w-3.5" /> Yangi yozuv
          </button>
        </div>
      )}
    </aside>
  );
}

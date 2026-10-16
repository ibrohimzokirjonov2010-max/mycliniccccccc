import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle, Banknote, Calendar, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock,
  CreditCard, FileText, Home, ImagePlus, Info, Loader2, Percent, Play, Plus, Receipt, Search, Send, Stethoscope,
  Trash2, User, Wallet, X, ClipboardCheck,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { resolveTreatingDoctor } from '@/lib/treatingDoctor';
import { tashkentToday, addDaysKey, formatClinicDate } from '@/lib/clinicTime';
import { getPatientTelegramChatId, sendTelegramMessage } from '@/lib/telegramReminderService';
import { createAppointmentSafely, scheduleAppointmentNotifications } from '@/components/appointments/AppointmentModal';
import {
  pendingPlanRows, rowDiscount, svcPrice, markPlanRowsDone, createDonePlan, saveVisitIncome, currentPatientDebt,
} from '@/lib/visitFlow';

const LOCKED = 'patient-y2ii8ynf2';
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];
const ALL_TEETH = [...UPPER, ...LOWER];
const METHODS = [
  { id: 'Cash', label: 'Naqd', icon: Banknote, tone: 'text-emerald-600 bg-emerald-50' },
  { id: 'Card', label: 'Karta', icon: CreditCard, tone: 'text-blue-600 bg-blue-50' },
  { id: 'Click', label: 'Click', icon: Wallet, tone: 'text-sky-600 bg-sky-50' },
  { id: 'Payme', label: 'Payme', icon: Wallet, tone: 'text-teal-600 bg-teal-50' },
];
const WEEK = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];
const WEEKDAY_FULL = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
const SLOTS = Array.from({ length: 18 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`);

const fmt = (n) => `${Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0|,/g, ' ')} so'm`;
const fmtNum = (n) => Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/\u00a0|,/g, ' ');
const parseNum = (s) => Number(String(s || '').replace(/\D/g, '')) || 0;
const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const fmtPhone = (ph) => {
  const d = String(ph || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.length === 9) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  return ph || '';
};
const ageOf = (bd) => {
  if (!bd) return null;
  const b = new Date(bd);
  if (Number.isNaN(b.getTime())) return null;
  const n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a -= 1;
  return a >= 0 && a < 130 ? a : null;
};
const importantInfo = (p) => {
  const m = String(p?.notes || '').match(/MUHIM OGOHLANTIRISH:\s*([^\n]+)/i);
  const v = (m?.[1] || p?.important_info || '').trim();
  return v && v.toLowerCase() !== 'ikkiqat' ? v : '';
};
const dateLabel = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
};

const card = 'bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.04)]';

function PatientHeader({ patient, onProfile }) {
  const age = ageOf(patient?.birth_date);
  const info = importantInfo(patient);
  return (
    <div className={`${card} p-4`} data-testid="visit-patient">
      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 font-black text-[18px] flex items-center justify-center shrink-0">{initials(patient?.full_name)}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[17px] font-black text-slate-900 truncate">{patient?.full_name || '—'}</p>
          <p className="text-[13px] text-slate-500 truncate">{[age != null ? `${age} yosh` : null, fmtPhone(patient?.phone)].filter(Boolean).join('  •  ')}</p>
        </div>
        <button type="button" onClick={onProfile} className="h-11 px-3 rounded-xl bg-slate-50 border border-slate-100 text-[14px] font-semibold text-slate-700 flex items-center gap-1.5 shrink-0">
          <User className="w-4 h-4" />Profil<ChevronRight className="w-4 h-4 text-blue-500" />
        </button>
      </div>
      {info ? (
        <div className="mt-3 rounded-xl bg-rose-50 border border-rose-100 px-3 py-2.5 flex items-center gap-2 text-[14px] font-bold text-rose-600">
          <AlertTriangle className="w-4 h-4 shrink-0" /><span className="truncate">{info}</span>
        </div>
      ) : null}
    </div>
  );
}

function ServiceRow({ name, sub, price, tooth, checked, onToggle, right }) {
  return (
    <div className="flex items-center gap-3 py-3 min-h-[56px]">
      {onToggle ? (
        <button type="button" aria-label="Bajarildi" onClick={onToggle} className="w-11 h-11 -ml-2 flex items-center justify-center shrink-0">
          <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${checked ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>{checked ? <Check className="w-4 h-4" /> : null}</span>
        </button>
      ) : null}
      <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Stethoscope className="w-5 h-5" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-slate-900 truncate">{tooth ? `Tish #${tooth}` : name}</p>
        <p className="text-[13px] text-slate-500 truncate">{tooth ? name : sub}</p>
      </div>
      <span className="text-[14px] font-bold text-slate-900 shrink-0">{fmt(price)}</span>
      {right}
    </div>
  );
}

function MiniChart({ marked, active, onPick }) {
  const row = (list, top) => (
    <div className="flex gap-[2px]">
      {list.map((n) => {
        const on = marked.includes(String(n));
        const act = String(active) === String(n);
        return (
          <button key={n} type="button" onClick={() => onPick(String(n))} className="flex-1 min-w-0 flex flex-col items-center gap-1 min-h-[44px]">
            {top ? <span className={`text-[10px] ${act ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>{n}</span> : null}
            <span className={`w-full h-7 rounded-[8px] border ${act ? 'bg-emerald-600 border-emerald-700' : on ? 'bg-emerald-100 border-emerald-300' : 'bg-white border-slate-300'}`} />
            {!top ? <span className={`text-[10px] ${act ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
  return <div className="space-y-2" data-testid="visit-mini-chart">{row(UPPER, true)}{row(LOWER, false)}</div>;
}

export default function MobileVisitFlow() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [appt, setAppt] = useState(null);
  const [patient, setPatient] = useState(null);
  const [plans, setPlans] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [hasXray, setHasXray] = useState(false);
  const [step, setStep] = useState('qabul');
  const [checked, setChecked] = useState([]);
  const [added, setAdded] = useState([]);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [activeTooth, setActiveTooth] = useState('');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [committed, setCommitted] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Cash');
  const [paidResult, setPaidResult] = useState({ paid: 0 });
  const [nextAppt, setNextAppt] = useState(null);
  const fileRef = useRef(null);
  const startKey = `visit-start:${appointmentId}`;

  const load = useCallback(async () => {
    try {
      const [a] = await base44.entities.Appointment.filter({ id: appointmentId });
      if (!a) { toast.error('Uchrashuv topilmadi'); navigate('/'); return; }
      const [p] = a.patient_id ? await base44.entities.Patient.filter({ id: a.patient_id }) : [];
      const [pl, svc, users, xr] = await Promise.all([
        a.patient_id ? base44.entities.TreatmentPlan.filter({ patient_id: a.patient_id }, 'created_date', 50) : [],
        base44.entities.Service.list('name', 300).catch(() => []),
        base44.entities.User.list('name', 50).catch(() => []),
        a.patient_id && base44.entities.Xray ? base44.entities.Xray.filter({ patient_id: a.patient_id }).catch(() => []) : [],
      ]);
      setAppt(a); setPatient(p || null); setPlans(pl || []);
      setCatalog((svc || []).filter((s) => s.is_active !== false));
      setDoctors((users || []).filter((u) => u.role === 'doctor' || u.role === 'admin'));
      setHasXray(!!base44.entities.Xray && Array.isArray(xr));
      if (p?.id !== LOCKED && !['In Progress', 'Completed'].includes(a.status)) {
        await base44.entities.Appointment.update(a.id, { status: 'In Progress' });
        setAppt({ ...a, status: 'In Progress' });
      }
      if (!localStorage.getItem(startKey)) localStorage.setItem(startKey, String(Date.now()));
    } catch (err) {
      console.error(err); toast.error('Yuklab bo‘lmadi');
    } finally { setLoading(false); }
  }, [appointmentId, navigate, startKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [step]);

  const pending = useMemo(() => pendingPlanRows(plans), [plans]);
  const doneRows = pending.filter((r) => checked.includes(r.key));
  const doctor = useMemo(() => {
    const d = doctors.find((x) => String(x.id) === String(appt?.doctor_id));
    if (d) return { ...d, name: d.name || d.full_name };
    if (appt?.doctor_id) return { id: appt.doctor_id, name: appt.doctor_name };
    // Qabulda shifokor yo'q: bemorning shifokori > rejalaridagi > kirgan foydalanuvchi (faqat shifokor bo'lsa).
    return resolveTreatingDoctor({ patient, plans, doctors, user });
  }, [doctors, appt, user, patient, plans]);

  const servicesTotal = doneRows.reduce((s, r) => s + svcPrice(r.svc), 0) + added.reduce((s, r) => s + svcPrice(r), 0);
  const discount = doneRows.reduce((s, r) => s + rowDiscount(r.plan, svcPrice(r.svc)), 0);
  const total = Math.max(0, servicesTotal - discount);
  const doneCount = doneRows.length + added.length;
  const started = Number(localStorage.getItem(startKey)) || now;
  const elapsed = Math.max(0, Math.floor((now - started) / 1000));
  const timer = `${String(Math.floor(elapsed / 3600)).padStart(2, '0')}:${String(Math.floor(elapsed / 60) % 60).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const marked = [...new Set([...pending.map((r) => String(r.svc.tooth_number || r.svc.tooth || '')), ...added.map((r) => String(r.tooth_number || ''))].filter(Boolean))];
  const toggle = (key) => setChecked((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));
  const goProfile = () => patient?.id && navigate(`/patients/${patient.id}`);

  const pickPhoto = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setPhoto(r.result);
    r.readAsDataURL(f);
    e.target.value = '';
  };

  // Summary -> payment: write done rows, added services and the photo (once).
  const commitWork = async () => {
    if (!patient?.id || patient.id === LOCKED) { toast.error('Bu bemorni o‘zgartirib bo‘lmaydi'); return; }
    if (!doneCount) { toast.error('Kamida bitta xizmatni belgilang'); return; }
    setBusy(true);
    try {
      if (!committed) {
        if (doneRows.length) await markPlanRowsDone(doneRows);
        if (added.length) await createDonePlan({ patient, doctor, lines: added });
        if (photo && base44.entities.Xray) {
          await base44.entities.Xray.create({ patient_id: patient.id, image_url: photo, description: 'Qabul surati', tooth_number: String(activeTooth || ''), date: new Date().toISOString().split('T')[0] });
        }
        setCommitted(true);
      }
      const { debt } = await currentPatientDebt(patient.id);
      setAmount(String(Math.min(total, debt) || 0));
      setStep('pay');
    } catch (err) {
      console.error(err); toast.error('Saqlab bo‘lmadi');
    } finally { setBusy(false); }
  };

  const pay = async () => {
    const value = parseNum(amount);
    if (!value) { toast.error('Summani kiriting'); return; }
    setBusy(true);
    try {
      const names = [...doneRows.map((r) => r.svc.service_name || r.svc.name), ...added.map((r) => r.service_name)].filter(Boolean).join(', ');
      const planId = doneRows[0]?.plan?.id || '';
      const res = await saveVisitIncome({ patient, doctor, amount: value, method, category: names || 'Treatment', notes: `Qabul: ${names}`, planId });
      setPaidResult(res);
      toast.success('To‘lov saqlandi');
      setStep('next');
    } catch (err) {
      console.error(err);
      toast.error(err?.message === 'no-debt' ? 'Bemorning qarzi yo‘q' : 'To‘lov saqlanmadi');
    } finally { setBusy(false); }
  };

  const finish = async (next) => {
    setBusy(true);
    try {
      const notes = [appt?.notes, note.trim() ? `Shifokor izohi: ${note.trim()}` : ''].filter(Boolean).join('\n');
      if (patient?.id !== LOCKED) await base44.entities.Appointment.update(appt.id, { status: 'Completed', notes });
      localStorage.removeItem(startKey);
      setNextAppt(next || null);
      setStep('done');
    } catch (err) {
      console.error(err); toast.error('Yakunlab bo‘lmadi');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="min-h-[60vh] flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>;
  if (!appt) return null;

  const header = <PatientHeader patient={patient} onProfile={goProfile} />;
  const billing = (
    <div className="space-y-1">
      <div className="flex justify-between text-[14px] py-2"><span className="text-slate-600">Xizmatlar jami ({doneCount} ta)</span><span className="font-bold text-slate-900">{fmt(servicesTotal)}</span></div>
      <div className="flex justify-between items-center text-[14px] py-2 px-3 rounded-xl bg-emerald-50/60"><span className="text-emerald-700 flex items-center gap-1.5"><Percent className="w-4 h-4" />Chegirma</span><span className="font-bold text-emerald-700">- {fmt(discount)}</span></div>
      <div className="flex justify-between items-center py-3 px-3 rounded-xl bg-emerald-50 mt-2"><span className="text-[16px] font-bold text-emerald-800">Jami to'lov</span><span className="text-[20px] font-black text-emerald-700" data-testid="visit-total">{fmt(total)}</span></div>
    </div>
  );
  const allLines = [
    ...doneRows.map((r) => ({ key: r.key, name: r.svc.service_name || r.svc.name, tooth: r.svc.tooth_number || r.svc.tooth, price: svcPrice(r.svc), sub: r.svc.category })),
    ...added.map((r, i) => ({ key: `a${i}`, idx: i, name: r.service_name, tooth: r.tooth_number, price: svcPrice(r), sub: r.category })),
  ];
  const bottomBar = (left, right) => <div className="grid grid-cols-2 gap-3 pt-1 pb-4">{left}{right}</div>;
  const btnGhost = 'h-14 rounded-2xl bg-slate-100 text-slate-700 font-bold text-[15px] active:scale-[0.98] disabled:opacity-60';
  const btnMain = 'h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-700 text-white font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-60';

  return (
    <div className="px-4 pt-3 pb-28 space-y-3 bg-slate-50 min-h-screen" data-testid={`visit-step-${step}`}>
      {step !== 'qabul' && step !== 'done' ? (
        <div className="pt-1">
          <h1 className="text-[24px] font-black text-slate-900">{step === 'summary' ? 'Qabulni yakunlash' : step === 'pay' ? "To'lov" : 'Keyingi uchrashuv'}</h1>
          <p className="text-[13px] text-slate-500">{step === 'summary' ? 'Muolaja yakunlandi. Hisobni rasmiylashtiring.' : step === 'pay' ? "Xizmatlar uchun to'lovni rasmiylashtiring." : 'Keyingi qabul sanasini belgilang.'}</p>
        </div>
      ) : null}

      {step === 'qabul' && (
        <>
          {header}
          <div className="rounded-[20px] border border-emerald-100 bg-emerald-50/70 p-4 flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 ring-4 ring-emerald-100"><Play className="w-6 h-6 fill-current" /></div>
            <div className="flex-1 min-w-0"><p className="text-[13px] font-black tracking-wider text-emerald-700">QABUL BOSHLANDI</p><p className="text-[14px] text-slate-600">Jarayonda</p></div>
            <div className="h-14 px-3 rounded-2xl bg-emerald-100 flex items-center gap-2 text-emerald-800"><Clock className="w-5 h-5" /><span className="text-[20px] font-black tabular-nums" data-testid="visit-timer">{timer}</span></div>
          </div>

          <div className={`${card} px-4 pt-3 pb-1`}>
            <div className="flex items-center justify-between py-1"><p className="text-[16px] font-bold text-slate-900 flex items-center gap-2"><CalendarDays className="w-5 h-5 text-emerald-600" />Bugungi rejadagi muolajalar</p><span className="px-2.5 py-1 rounded-full bg-slate-100 text-[13px] font-bold text-slate-600">{pending.length + added.length} ta</span></div>
            <div className="divide-y divide-slate-100">
              {pending.length + added.length === 0 ? <p className="py-4 text-[14px] text-slate-500">Faol rejada bajarilmagan muolaja yo'q. Xizmat qo'shing.</p> : null}
              {pending.map((r) => <ServiceRow key={r.key} name={r.svc.service_name || r.svc.name} sub={r.svc.category} tooth={r.svc.tooth_number || r.svc.tooth} price={svcPrice(r.svc)} checked={checked.includes(r.key)} onToggle={() => toggle(r.key)} />)}
              {added.map((r, i) => <ServiceRow key={`a${i}`} name={r.service_name} sub={r.category} tooth={r.tooth_number} price={svcPrice(r)} checked onToggle={() => setAdded((x) => x.filter((_, j) => j !== i))} />)}
            </div>
          </div>

          <div className={`${card} p-4`}>
            <div className="flex items-center justify-between mb-3"><p className="text-[16px] font-bold text-slate-900">Tish kartasi</p>{activeTooth ? <span className="px-3 h-8 rounded-full bg-blue-50 text-blue-700 text-[13px] font-bold flex items-center">Tish #{activeTooth}</span> : null}</div>
            <MiniChart marked={marked} active={activeTooth} onPick={(t) => setActiveTooth((a) => (a === t ? '' : t))} />
          </div>

          <div className={`grid ${hasXray ? 'grid-cols-3' : 'grid-cols-2'} gap-2.5`}>
            <button type="button" onClick={() => setSheet(true)} className="h-24 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold text-[14px] flex flex-col items-center justify-center gap-2"><Plus className="w-6 h-6" />Xizmat qo'shish</button>
            {hasXray ? <button type="button" onClick={() => fileRef.current?.click()} className="h-24 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 font-bold text-[14px] flex flex-col items-center justify-center gap-2"><ImagePlus className="w-6 h-6" />{photo ? 'Rasm tanlandi' : 'Rentgen / Foto'}</button> : null}
            <button type="button" onClick={() => setNoteOpen((v) => !v)} className="h-24 rounded-2xl bg-purple-50 border border-purple-100 text-purple-700 font-bold text-[14px] flex flex-col items-center justify-center gap-2"><FileText className="w-6 h-6" />Izoh qo'shish</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
          {noteOpen ? <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Shifokor izohi..." className="w-full min-h-[96px] rounded-2xl border border-slate-200 p-3 text-[15px]" /> : null}

          <button type="button" data-testid="visit-finish" onClick={() => (doneCount ? setStep('summary') : toast.error('Bajarilgan xizmatni belgilang'))} className={`${btnMain} w-full h-16 text-[17px]`}><Check className="w-6 h-6" />Qabulni yakunlash</button>
        </>
      )}

      {step === 'summary' && (
        <>
          {header}
          <div className={`${card} px-4 pt-3 pb-1`}>
            <div className="flex items-center justify-between py-1"><p className="text-[16px] font-bold text-slate-900 flex items-center gap-2"><ClipboardCheck className="w-5 h-5 text-emerald-600" />Bajarilgan xizmatlar ({doneCount})</p>
              {!committed ? <button type="button" onClick={() => setSheet(true)} className="h-11 px-3 rounded-full bg-blue-50 text-blue-700 text-[13px] font-bold flex items-center gap-1"><Plus className="w-4 h-4" />Xizmat qo'shish</button> : null}</div>
            <div className="divide-y divide-slate-100">
              {allLines.map((l) => <ServiceRow key={l.key} name={l.name} sub={l.sub} tooth={l.tooth} price={l.price} right={!committed && l.idx != null ? <button type="button" aria-label="O'chirish" onClick={() => setAdded((x) => x.filter((_, j) => j !== l.idx))} className="w-11 h-11 flex items-center justify-center text-slate-400"><Trash2 className="w-4 h-4" /></button> : null} />)}
            </div>
          </div>
          <div className={`${card} p-4`}><p className="text-[16px] font-bold text-slate-900 flex items-center gap-2 mb-2"><Wallet className="w-5 h-5 text-emerald-600" />Hisob-kitob</p>{billing}</div>
          <div className={`${card} p-4`}>
            <p className="text-[16px] font-bold text-slate-900 flex items-center gap-2 mb-2"><FileText className="w-5 h-5 text-blue-600" />Shifokor izohi</p>
            <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="Davolash haqida izoh..." className="w-full min-h-[96px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-[15px]" />
            <p className="text-right text-[13px] text-slate-400">{note.length}/500</p>
          </div>
          {hasXray ? (
            <div className={`${card} p-4`}>
              <div className="flex items-center justify-between mb-3"><p className="text-[16px] font-bold text-slate-900 flex items-center gap-2"><ImagePlus className="w-5 h-5 text-blue-600" />Rentgen / Foto <span className="text-[13px] font-normal text-slate-400">(ixtiyoriy)</span></p>
                {!committed ? <button type="button" onClick={() => fileRef.current?.click()} className="h-11 px-3 rounded-full bg-blue-50 text-blue-700 text-[13px] font-bold flex items-center gap-1"><Plus className="w-4 h-4" />Yuklash</button> : null}</div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={pickPhoto} />
              {photo ? <div className="relative w-28 h-24"><img src={photo} alt="" className="w-28 h-24 object-cover rounded-xl" />{!committed ? <button type="button" aria-label="O'chirish" onClick={() => setPhoto(null)} className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center"><X className="w-4 h-4" /></button> : null}</div> : <p className="text-[13px] text-slate-400">Rasm qo'shilmagan</p>}
            </div>
          ) : null}
          {bottomBar(
            <button type="button" disabled={busy || committed} onClick={() => setStep('qabul')} className={btnGhost}>Bekor qilish</button>,
            <button type="button" data-testid="visit-to-pay" disabled={busy} onClick={commitWork} className={btnMain}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}To'lovga o'tish</button>,
          )}
        </>
      )}

      {step === 'pay' && (
        <>
          {header}
          <div className={`${card} p-4`}><p className="text-[16px] font-bold text-slate-900 flex items-center gap-2 mb-2"><Receipt className="w-5 h-5 text-emerald-600" />Hisob-kitob</p>{billing}</div>
          <div className={`${card} p-4`}>
            <p className="text-[16px] font-bold text-slate-900 flex items-center gap-2 mb-3"><Wallet className="w-5 h-5 text-emerald-600" />To'lov miqdori</p>
            <div className="h-14 rounded-2xl border border-slate-200 flex items-center px-4 gap-2">
              <input data-testid="visit-amount" inputMode="numeric" value={fmtNum(parseNum(amount))} onChange={(e) => setAmount(String(parseNum(e.target.value)))} className="flex-1 min-w-0 text-[22px] font-bold text-slate-900 outline-none bg-transparent" />
              <span className="text-[14px] text-slate-400">so'm</span>
              <button type="button" aria-label="Tozalash" onClick={() => setAmount('')} className="w-11 h-11 -mr-2 flex items-center justify-center text-slate-400"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-4 gap-2 mt-3">
              {[50000, 100000, 200000].map((v) => <button key={v} type="button" onClick={() => setAmount(String(v))} className={`h-11 rounded-xl text-[13px] font-semibold ${parseNum(amount) === v ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'}`}>{fmtNum(v)}</button>)}
              <button type="button" onClick={() => setAmount(String(total))} className={`h-11 rounded-xl text-[13px] font-semibold ${parseNum(amount) === total ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-700'}`}>To'liq summa</button>
            </div>
          </div>
          <div className={`${card} p-4`}>
            <p className="text-[16px] font-bold text-slate-900 flex items-center gap-2 mb-3"><CreditCard className="w-5 h-5 text-emerald-600" />To'lov usuli</p>
            <div className="grid grid-cols-2 gap-2.5">
              {METHODS.map((m) => {
                const on = method === m.id; const Icon = m.icon;
                return (
                  <button key={m.id} type="button" onClick={() => setMethod(m.id)} className={`h-16 rounded-2xl border px-3 flex items-center gap-2.5 ${on ? 'border-emerald-500 bg-emerald-50/60' : 'border-slate-200 bg-white'}`}>
                    <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${m.tone}`}><Icon className="w-5 h-5" /></span>
                    <span className="flex-1 text-left text-[15px] font-bold text-slate-900">{m.label}</span>
                    <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>{on ? <Check className="w-4 h-4" /> : null}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="rounded-2xl bg-blue-50 border border-blue-100 p-3.5 flex gap-2.5">
            <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div><p className="text-[14px] font-bold text-blue-800">Qolgani qarzga yoziladi: {fmt(Math.max(0, total - parseNum(amount)))}</p><p className="text-[13px] text-slate-500">To'langan summa jami summadan kam bo'lsa, qolgan qismi bemor qarzi sifatida saqlanadi.</p></div>
          </div>
          {bottomBar(
            <button type="button" data-testid="visit-pay" disabled={busy} onClick={pay} className={btnMain}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}Qabul qilish</button>,
            <button type="button" disabled={busy} onClick={() => { setPaidResult({ paid: 0 }); setStep('next'); }} className={`${btnGhost} bg-white border border-slate-200`}>To'lovsiz yakunlash</button>,
          )}
        </>
      )}

      {step === 'next' && <NextVisit patient={patient} doctors={doctors} doctor={doctor} busy={busy} setBusy={setBusy} onSkip={() => finish(null)} onSaved={(n) => finish(n)} header={header} btnGhost={btnGhost} btnMain={btnMain} />}

      {step === 'done' && (
        <DoneView patient={patient} header={header} lines={allLines} servicesTotal={servicesTotal} discount={discount} total={total} paid={paidResult.paid || 0} nextAppt={nextAppt} btnGhost={btnGhost} btnMain={btnMain} navigate={navigate} appt={appt} />
      )}

      {sheet && <AddServiceSheet catalog={catalog} defaultTooth={activeTooth} onClose={() => setSheet(false)} onAdd={(rows) => { setAdded((x) => [...x, ...rows]); setSheet(false); }} />}
    </div>
  );
}

function AddServiceSheet({ catalog, defaultTooth, onClose, onAdd }) {
  const [q, setQ] = useState('');
  const [tooth, setTooth] = useState(defaultTooth || '');
  const [cat, setCat] = useState('');
  const [sel, setSel] = useState([]);
  const cats = [...new Set(catalog.map((s) => s.category).filter(Boolean))];
  const list = catalog.filter((s) => (!cat || s.category === cat) && (!q.trim() || String(s.name || '').toLowerCase().includes(q.trim().toLowerCase())));
  const submit = () => {
    const rows = catalog.filter((s) => sel.includes(s.id)).map((s) => ({ service_id: s.id, service_name: s.name, tooth_number: tooth || '', price: Number(s.price) || 0, price_source: 'catalog', category: s.category || '', notes: '' }));
    if (!rows.length) { toast.error('Xizmatni tanlang'); return; }
    onAdd(rows);
  };
  return (
    <div className="fixed inset-0 z-[80]" data-testid="visit-add-sheet">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] bg-white rounded-t-[28px] flex flex-col">
        <div className="w-12 h-1.5 rounded-full bg-slate-200 mx-auto mt-2.5" />
        <div className="flex items-center justify-between px-5 pt-2"><p className="text-[20px] font-black text-slate-900">Xizmat qo'shish</p><button type="button" aria-label="Yopish" onClick={onClose} className="w-11 h-11 flex items-center justify-center text-slate-500"><X className="w-6 h-6" /></button></div>
        <div className="px-5 overflow-y-auto flex-1 pb-3">
          <div className="h-12 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2 px-3 mt-1"><Search className="w-5 h-5 text-slate-400" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Xizmat nomi bo'yicha qidirish..." className="flex-1 bg-transparent outline-none text-[15px]" /></div>
          <div className="flex items-center justify-between mt-4"><p className="text-[15px] font-bold text-slate-900">Tish tanlash</p><button type="button" onClick={() => setTooth('')} className="h-11 px-2 text-[13px] text-slate-500">Tozalash</button></div>
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {ALL_TEETH.map((n) => <button key={n} type="button" onClick={() => setTooth(String(n))} className={`shrink-0 w-11 h-11 rounded-xl text-[14px] font-semibold ${tooth === String(n) ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'}`}>{n}</button>)}
          </div>
          <div className="flex items-center justify-between mt-4 mb-1"><p className="text-[15px] font-bold text-slate-900">Xizmatlar</p>
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="h-11 rounded-xl bg-slate-100 px-2 text-[13px] max-w-[55%]"><option value="">Barchasi</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div className="divide-y divide-slate-100">
            {list.map((s) => {
              const on = sel.includes(s.id);
              return (
                <button key={s.id} type="button" onClick={() => setSel((x) => (on ? x.filter((i) => i !== s.id) : [...x, s.id]))} className={`w-full flex items-center gap-3 py-3 px-2 rounded-xl text-left min-h-[56px] ${on ? 'bg-emerald-50' : ''}`}>
                  <span className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>{on ? <Check className="w-4 h-4" /> : null}</span>
                  <span className="flex-1 min-w-0"><span className="block text-[15px] font-bold text-slate-900 truncate">{s.name}</span><span className="block text-[13px] text-slate-500 truncate">{s.category || ''}</span></span>
                  <span className="text-[14px] font-bold text-slate-900 shrink-0">{fmt(s.price)}</span>
                </button>
              );
            })}
            {!list.length ? <p className="py-4 text-[14px] text-slate-500">Xizmat topilmadi</p> : null}
          </div>
        </div>
        <div className="px-5 pt-2 pb-5 border-t border-slate-100"><button type="button" data-testid="visit-add-submit" onClick={submit} className="w-full h-14 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-700 text-white font-bold text-[16px] flex items-center justify-center gap-2"><Plus className="w-5 h-5" />Xizmatni qo'shish{sel.length ? ` (${sel.length})` : ''}</button></div>
      </div>
    </div>
  );
}

function NextVisit({ patient, doctors, doctor, busy, setBusy, onSkip, onSaved, header, btnGhost, btnMain }) {
  const today = tashkentToday();
  const [date, setDate] = useState(addDaysKey(today, 7));
  const [time, setTime] = useState('');
  const [docId, setDocId] = useState(doctor?.id || '');
  const [notes, setNotes] = useState('');
  const [busySlots, setBusySlots] = useState([]);
  const [month, setMonth] = useState(addDaysKey(today, 7).slice(0, 7));
  const [remind, setRemind] = useState(!!getPatientTelegramChatId(patient));
  const hasTg = !!getPatientTelegramChatId(patient);
  const quick = [{ l: '3 kun', d: 3 }, { l: '1 hafta', d: 7 }, { l: '2 hafta', d: 14 }];

  useEffect(() => {
    let alive = true;
    base44.entities.Appointment.filter({ date }).then((rows) => {
      if (!alive) return;
      setBusySlots((rows || []).filter((a) => !['Cancelled', 'No-Show'].includes(a.status) && (!docId || String(a.doctor_id) === String(docId))).map((a) => String(a.time || '').slice(0, 5)));
    }).catch(() => setBusySlots([]));
    return () => { alive = false; };
  }, [date, docId]);

  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`)];
  const shiftMonth = (d) => { const dt = new Date(Date.UTC(y, m - 1 + d, 1)); setMonth(`${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`); };
  const choose = (key) => { setDate(key); setTime(''); setMonth(key.slice(0, 7)); };
  const wd = WEEKDAY_FULL[new Date(`${date}T12:00:00Z`).getUTCDay()];

  const save = async () => {
    if (!time) { toast.error('Vaqtni tanlang'); return; }
    const doc = doctors.find((d) => String(d.id) === String(docId)) || doctor;
    setBusy(true);
    try {
      const form = { patient_id: patient.id, patient_name: patient.full_name || '', patient_phone: patient.phone || '', doctor_id: doc?.id || '', doctor_name: doc?.name || doc?.full_name || '', date, time, duration: 30, status: 'Scheduled', notes };
      const res = await createAppointmentSafely(form);
      if (remind && hasTg) await scheduleAppointmentNotifications(res, form);
      toast.success('Uchrashuv yaratildi');
      await onSaved({ date, time, id: res?.id });
    } catch (err) {
      console.error(err); toast.error('Uchrashuv saqlanmadi'); setBusy(false);
    }
  };

  return (
    <>
      {header}
      <div className={`${card} p-4`}>
        <p className="text-[16px] font-bold text-slate-900 flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-blue-600" />Tez tanlash</p>
        <div className="grid grid-cols-4 gap-2">
          {quick.map((qk) => { const key = addDaysKey(today, qk.d); const on = date === key; return (
            <button key={qk.l} type="button" onClick={() => choose(key)} className={`h-14 rounded-xl border text-center ${on ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-700'}`}><span className="block text-[14px] font-bold">{qk.l}</span><span className="block text-[11px] text-slate-400">{dateLabel(key)}</span></button>
          ); })}
          <button type="button" onClick={() => document.getElementById('visit-cal')?.scrollIntoView({ behavior: 'smooth' })} className="h-14 rounded-xl border border-slate-200 text-[13px] font-bold text-slate-700 flex flex-col items-center justify-center"><Calendar className="w-4 h-4 text-blue-600" />Boshqa sana</button>
        </div>
      </div>
      <div className={`${card} p-4`} id="visit-cal">
        <p className="text-[16px] font-bold text-slate-900 flex items-center gap-2 mb-3"><CalendarDays className="w-5 h-5 text-blue-600" />Sana va vaqt</p>
        <div className="flex items-center justify-between mb-2">
          <button type="button" aria-label="Oldingi oy" onClick={() => shiftMonth(-1)} className="w-11 h-11 flex items-center justify-center"><ChevronLeft className="w-5 h-5" /></button>
          <p className="text-[15px] font-bold">{MONTHS[m - 1]} {y}</p>
          <button type="button" aria-label="Keyingi oy" onClick={() => shiftMonth(1)} className="w-11 h-11 flex items-center justify-center"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="grid grid-cols-7 text-center text-[12px] text-slate-400 mb-1">{WEEK.map((w) => <span key={w}>{w}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-1">
          {cells.map((key, i) => key ? (
            <button key={key} type="button" disabled={key < today} onClick={() => choose(key)} className={`h-11 mx-auto w-11 rounded-full text-[14px] ${date === key ? 'bg-emerald-600 text-white font-bold' : key < today ? 'text-slate-300' : 'text-slate-800'}`}>{Number(key.slice(8))}</button>
          ) : <span key={`e${i}`} />)}
        </div>
        <p className="text-[15px] font-bold text-slate-900 mt-4 mb-2">{dateLabel(date)}, {wd}</p>
        <div className="grid grid-cols-3 gap-2" data-testid="visit-slots">
          {SLOTS.map((s) => { const taken = busySlots.includes(s); const on = time === s; return (
            <button key={s} type="button" disabled={taken} onClick={() => setTime(s)} className={`h-11 rounded-xl border text-[14px] font-semibold ${on ? 'bg-emerald-600 border-emerald-600 text-white' : taken ? 'bg-slate-50 border-slate-100 text-slate-300 line-through' : 'border-slate-200 text-slate-700'}`}>{s}</button>
          ); })}
        </div>
      </div>
      <div className={`${card} p-4 flex items-center gap-3`}>
        <p className="text-[15px] font-bold text-slate-900 flex items-center gap-2 shrink-0"><User className="w-5 h-5 text-blue-600" />Shifokor</p>
        <select value={docId} onChange={(e) => setDocId(e.target.value)} className="flex-1 min-w-0 h-12 rounded-xl border border-slate-200 bg-white px-3 text-[15px]">
          {doctor && !doctors.some((d) => String(d.id) === String(doctor.id)) ? <option value={doctor.id}>{doctor.name}</option> : null}
          {doctors.map((d) => <option key={d.id} value={d.id}>{d.name || d.full_name}</option>)}
        </select>
      </div>
      {hasTg ? (
        <button type="button" onClick={() => setRemind((v) => !v)} className={`${card} w-full p-4 flex items-center gap-3 text-left`}>
          <Send className="w-5 h-5 text-sky-500" /><span className="flex-1"><span className="block text-[15px] font-bold">Telegram eslatma</span><span className="block text-[13px] text-slate-500">Bemorga avtomatik xabar</span></span>
          <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${remind ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300'}`}>{remind ? <Check className="w-4 h-4" /> : null}</span>
        </button>
      ) : null}
      <div className={`${card} p-4`}>
        <p className="text-[15px] font-bold text-slate-900 mb-2">Izoh <span className="text-[13px] font-normal text-slate-400">(ixtiyoriy)</span></p>
        <textarea value={notes} maxLength={200} onChange={(e) => setNotes(e.target.value)} placeholder="Keyingi uchrashuv bo'yicha izoh..." className="w-full min-h-[80px] rounded-xl border border-slate-200 bg-slate-50 p-3 text-[15px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 pb-4">
        <button type="button" disabled={busy} onClick={onSkip} className={btnGhost}>Keyinroq</button>
        <button type="button" data-testid="visit-next-save" disabled={busy} onClick={save} className={btnMain}>{busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarDays className="w-5 h-5" />}Saqlash</button>
      </div>
    </>
  );
}

function DoneView({ patient, header, lines, servicesTotal, discount, total, paid, nextAppt, btnGhost, btnMain, navigate, appt }) {
  const left = Math.max(0, total - paid);
  const chatId = getPatientTelegramChatId(patient);
  const [sent, setSent] = useState(false);
  const stamp = new Date();
  const stampText = `${formatClinicDate(stamp)}, ${stamp.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Tashkent' })}`;
  const sendReceipt = async () => {
    const text = [`🧾 Chek — ${patient?.full_name || ''}`, ...lines.map((l) => `• ${l.tooth ? `Tish #${l.tooth} ` : ''}${l.name}: ${fmt(l.price)}`), `Jami: ${fmt(servicesTotal)}`, discount ? `Chegirma: -${fmt(discount)}` : '', `To'lov: ${fmt(total)}`, `To'langan: ${fmt(paid)}`, left ? `Qarz: ${fmt(left)}` : '', nextAppt ? `Keyingi uchrashuv: ${dateLabel(nextAppt.date)}, ${nextAppt.time}` : ''].filter(Boolean).join('\n');
    const res = await sendTelegramMessage(chatId, text);
    if (res) { setSent(true); toast.success('Chek yuborildi'); } else toast.error('Yuborib bo‘lmadi');
  };
  return (
    <>
      <div className="flex flex-col items-center text-center pt-3 pb-1">
        <div className="w-20 h-20 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30"><CheckCircle2 className="w-10 h-10" /></div>
        <h1 className="mt-3 text-[24px] font-black text-slate-900">Qabul yakunlandi!</h1>
        <p className="text-[13px] text-slate-500">Bemor muvaffaqiyatli qabul qilindi va ma'lumotlar saqlandi.</p>
      </div>
      {header}
      <div className={`${card} p-4`}>
        <div className="flex items-start justify-between mb-2"><p className="text-[16px] font-bold text-slate-900 flex items-center gap-2"><Receipt className="w-5 h-5 text-emerald-600" />Chek</p><p className="text-[13px] text-slate-500 text-right">{stampText}<br /><span className="text-slate-400">Qabul № {String(appt?.id || '').slice(-6)}</span></p></div>
        <div className="flex justify-between text-[13px] text-slate-500 py-1 border-b border-slate-100"><span>Xizmat</span><span>Summa</span></div>
        <div className="divide-y divide-slate-100">{lines.map((l) => <ServiceRow key={l.key} name={l.name} sub={l.sub} tooth={l.tooth} price={l.price} />)}</div>
        <div className="border-t border-slate-100 pt-2">
          <div className="flex justify-between text-[14px] py-1.5"><span className="text-slate-600">Xizmatlar jami ({lines.length} ta)</span><span className="font-bold">{fmt(servicesTotal)}</span></div>
          <div className="flex justify-between text-[14px] py-1.5"><span className="text-slate-600">Chegirma</span><span className="font-bold text-emerald-700">- {fmt(discount)}</span></div>
          <div className="flex justify-between items-center py-3 px-3 rounded-xl bg-emerald-50 mt-1"><span className="text-[16px] font-bold text-emerald-800">Jami to'lov</span><span className="text-[20px] font-black text-emerald-700">{fmt(total)}</span></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div className={`${card} p-3.5 flex items-center gap-2.5`}><span className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0"><Wallet className="w-5 h-5" /></span><span className="min-w-0"><span className="block text-[13px] text-slate-500">To'langan summa</span><span className="block text-[16px] font-black text-slate-900" data-testid="visit-paid">{fmt(paid)}</span></span></div>
        <div className={`${card} p-3.5 flex items-center gap-2.5`}><span className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Clock className="w-5 h-5" /></span><span className="min-w-0"><span className="block text-[13px] text-slate-500">Qolgan qarz</span><span className="block text-[16px] font-black text-rose-600" data-testid="visit-left">{fmt(left)}</span></span></div>
      </div>
      <button type="button" onClick={() => navigate('/appointments')} className={`${card} w-full p-4 flex items-center gap-3 text-left`}>
        <span className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center"><CalendarDays className="w-6 h-6" /></span>
        <span className="flex-1"><span className="block text-[15px] font-bold text-slate-900">Keyingi uchrashuv</span><span className="block text-[14px] text-slate-500">{nextAppt ? `${dateLabel(nextAppt.date)}, ${nextAppt.time}` : 'Belgilanmagan'}</span></span>
        <ChevronRight className="w-5 h-5 text-slate-400" />
      </button>
      {chatId ? (
        <button type="button" disabled={sent} onClick={sendReceipt} className="w-full rounded-[20px] border border-blue-100 bg-blue-50 p-4 flex items-center gap-3 text-left">
          <Send className="w-6 h-6 text-blue-600" /><span className="flex-1"><span className="block text-[15px] font-bold text-slate-900">{sent ? 'Chek yuborildi' : 'Chekni yuborish (Telegram)'}</span><span className="block text-[13px] text-slate-500">Bemorga chek va davolash rejasini yuborish</span></span><ChevronRight className="w-5 h-5 text-slate-400" />
        </button>
      ) : null}
      <div className="space-y-2.5 pb-4">
        <button type="button" onClick={() => navigate('/')} className={`${btnMain} w-full`}><User className="w-5 h-5" />Keyingi bemor</button>
        <button type="button" onClick={() => navigate('/')} className={`${btnGhost} w-full flex items-center justify-center gap-2`}><Home className="w-5 h-5" />Bosh sahifa</button>
      </div>
    </>
  );
}

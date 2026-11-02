import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Check, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { applyPhoneMask, capitalizeName, capitalizeAsYouType, formatMoneyAmount, cn } from '@/lib/utils';
import { isTreatingClinician, clinicianDisplayName } from '@/lib/treatingDoctor';
import { isLinkedPlanInternal } from '@/lib/paymentDebt';

/** Global open event: window.dispatchEvent(new Event(OPEN_QUICK_PATIENT_EVENT)) */
export const OPEN_QUICK_PATIENT_EVENT = 'myclinic:open-tezkor';
export const openQuickPatient = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_QUICK_PATIENT_EVENT));
};

// Adult FDI rows in the same order as the approved mockup.
const TOOTH_ROWS = [
  [18, 17, 16, 15, 14, 13, 12, 11],
  [21, 22, 23, 24, 25, 26, 27, 28],
  [48, 47, 46, 45, 44, 43, 42, 41],
  [31, 32, 33, 34, 35, 36, 37, 38],
];

function todayDisplayDate() {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
}

function useIsPhone() {
  const q = '(max-width: 767px)';
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return m;
}

const serviceAllowsTooth = (svc, fdi) => {
  const allowed = Array.isArray(svc?.tooth_numbers) ? svc.tooth_numbers.map(Number) : [];
  return allowed.length === 0 || allowed.includes(Number(fdi));
};

/**
 * Tezkor — quick add patient (Ism, Familiya, Telefon) with an optional plan.
 * Uses the same Patient / TreatmentPlan / Payment(Debt) records as NewPatientFlow.
 */
export default function QuickPatientModal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isPhone = useIsPhone();
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('+998 ');
  const [withPlan, setWithPlan] = useState(false);
  const [teeth, setTeeth] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [showAllServices, setShowAllServices] = useState(false);
  const [services, setServices] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [doctorId, setDoctorId] = useState('');
  const [saving, setSaving] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(OPEN_QUICK_PATIENT_EVENT, on);
    return () => window.removeEventListener(OPEN_QUICK_PATIENT_EVENT, on);
  }, []);

  useEffect(() => {
    if (!open) return;
    setFirstName(''); setLastName(''); setPhone('+998 '); setWithPlan(false);
    setTeeth([]); setSelectedServiceIds([]); setShowAllServices(false); setSaving(false);
    setTimeout(() => firstRef.current?.focus(), 60);
    // Same staff source as NewPatientFlow.
    base44.entities.User.list('name', 100)
      .then(async (users) => {
        let list = (users || []).filter(u => isTreatingClinician(u) || String(u.role || '').toLowerCase() === 'admin');
        if (list.length === 0) list = await base44.entities.User.filter({ role: 'doctor' }, 'name').catch(() => []);
        list = list || [];
        setDoctors(list);
        const me = user && list.find(d => d.id === user.id);
        const pick = (me && isTreatingClinician(me) ? me : null) || list.find(isTreatingClinician) || me || list[0];
        setDoctorId(pick?.id || '');
      })
      .catch(() => {});
    // Clinic price list (same query as NewPatientFlow).
    base44.entities.Service.filter({ is_active: true }, 'name', 500).then((data) => {
      const seen = new Map();
      (data || []).forEach((s) => {
        const key = s.name?.toLowerCase().trim();
        if (key && !seen.has(key)) seen.set(key, s);
      });
      setServices(Array.from(seen.values()));
    }).catch(() => {});
  }, [open, user]);

  const close = useCallback(() => { if (!saving) setOpen(false); }, [saving]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const fName = capitalizeName(firstName);
  const lName = capitalizeName(lastName);
  const phoneDigits = phone.replace(/\D/g, '');
  const selectedServices = useMemo(
    () => selectedServiceIds.map(id => services.find(s => s.id === id)).filter(Boolean),
    [selectedServiceIds, services]
  );

  // One row per tooth × service, same shape as NewPatientFlow consolidatedServices.
  const planRows = useMemo(() => {
    if (!withPlan) return [];
    const rows = [];
    teeth.forEach((fdi) => {
      selectedServices.forEach((s) => {
        if (!serviceAllowsTooth(s, fdi)) return;
        rows.push({ service_id: s.id, service_name: s.name, price: s.price, tooth_number: String(fdi) });
      });
    });
    return rows;
  }, [withPlan, teeth, selectedServices]);
  const planTotal = planRows.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

  const toggleTooth = (n) => setTeeth(prev => prev.includes(n) ? prev.filter(x => x !== n) : [...prev, n]);
  const toggleService = (id) => setSelectedServiceIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleSubmit = useCallback(async () => {
    if (saving) return;
    if (!fName) { toast.error('Ismni kiriting'); return; }
    if (!lName) { toast.error('Familiyani kiriting'); return; }
    if (phoneDigits.length < 12) { toast.error("Telefon raqamini to'liq kiriting"); return; }
    if (!doctorId) { toast.error('Shifokorni tanlash majburiy'); return; }
    if (withPlan && planRows.length === 0) { toast.error('Tish va xizmat tanlang'); return; }
    setSaving(true);
    try {
      const fullName = `${lName} ${fName}`.trim();
      // Same payload shape as NewPatientFlow.persistPatient (clinic_id is set by the API client).
      const patient = await base44.entities.Patient.create({
        photo_url: '', first_name: fName, last_name: lName, full_name: fullName,
        status: 'New', phone: phoneDigits, phone_secondary: '', email: '', address: '',
        birth_date: '', important_info: '', comment: '', payer: '', discount_percent: 0,
        contact: '', main_treatment_provider: doctorId, card_number: '',
        registration_date: todayDisplayDate(), notes: '',
      });
      if (!patient?.id || patient?.error) throw new Error(patient?.error || 'Bemor yaratilmadi');

      if (withPlan && planRows.length > 0) {
        const today = new Date().toISOString();
        const doc = doctors.find(d => d.id === doctorId);
        const teethUsed = [...new Set(planRows.map(r => r.tooth_number))];
        const names = planRows.map(r => r.service_name).filter(Boolean);
        const serviceNames = names.length > 2 ? names.slice(0, 2).join(', ') + ` +& ${names.length - 2} ta` : names.join(', ');
        const displayCategory = `${serviceNames} (#${teethUsed.join(', ')})`;
        const stamp = Date.now();
        const consolidated = planRows.map((r, i) => ({ ...r, service_id: r.service_id || `svc_${r.tooth_number}_${i}_${stamp}` }));

        const plan = await base44.entities.TreatmentPlan.create({
          name: displayCategory, patient_id: patient.id, patient_name: patient.full_name || fullName,
          doctor_id: doctorId, doctor_name: clinicianDisplayName(doc),
          status: 'Planned', priority: 'Medium', total_price: planTotal,
          discount_amount: 0, discount_percent: 0, paid_amount: 0, notes: '',
          start_date: today, tooth_number: teethUsed.join(', '), services: consolidated, installment_plan: null,
        });
        if (!plan || plan.error) throw new Error(plan?.error || 'Reja yaratishda xatolik yuz berdi');

        if (planTotal > 0) {
          await base44.entities.Payment.create({
            patient_id: patient.id, patient_name: patient.full_name || fullName, doctor_id: doctorId,
            type: 'Debt', category: displayCategory, amount: planTotal, method: '—', date: today,
            notes: `Linked to Plan: ${plan.id}`,
          });
          const allPays = await base44.entities.Payment.filter({ patient_id: patient.id }, '-date', 500);
          const sum = (type) => allPays.filter(p => p.type?.toLowerCase() === type).reduce((s, p) => s + (p.amount || 0), 0);
          const discount = allPays
            .filter(p => p.type?.toLowerCase() === 'discount' && !isLinkedPlanInternal(p, 'discount'))
            .reduce((s, p) => s + Math.abs(Number(p.amount) || 0), 0);
          const paid = sum('income');
          await base44.entities.Patient.update(patient.id, {
            total_paid: paid,
            total_debt: Math.max(0, sum('debt') - paid + sum('refund') - discount),
          });
        }

        // Same pending implant records as NewPatientFlow.
        for (const r of consolidated) {
          const n = String(r.service_name || '').toLowerCase();
          const svc = services.find(s => s.id === r.service_id);
          if (!n.includes('implant') && !String(svc?.category || '').toLowerCase().includes('implant')) continue;
          try {
            await base44.entities.Implant.create({
              patient_id: patient.id, patient_name: patient.full_name || fullName, patient_phone: patient.phone || '',
              doctor: clinicianDisplayName(doc), doctor_id: doctorId,
              tooth_numbers: [r.tooth_number], tooth_number: r.tooth_number,
              service_name: r.service_name || "Implantat o'rnatish",
              price: r.price || 4000000, narxi: r.price || 4000000,
              lifecycle_status: 'planned', placement_date: today.split('T')[0],
              incomplete_data: true, needs_fill: true, created_at: today,
              notes: "Yangi bemor rejasi orqali yaratilgan — texnik ma'lumotlar kiritilishi kutilmoqda",
            });
          } catch (e) { console.error('Tezkor implant create failed:', e); }
        }
      }

      ['patients', 'patients-stats', 'payments', 'treatment-plans'].forEach(k => queryClient.invalidateQueries({ queryKey: [k] }));
      toast.success(withPlan ? 'Bemor va reja yaratildi' : 'Bemor yaratildi');
      setOpen(false);
      navigate(`/patients/${patient.id}`);
    } catch (error) {
      console.error('[Tezkor] create failed:', error);
      toast.error(error?.message || 'Xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  }, [saving, fName, lName, phoneDigits, doctorId, withPlan, planRows, planTotal, doctors, services, queryClient, navigate]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'BUTTON') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const visibleServices = showAllServices ? services : services.filter(s => selectedServiceIds.includes(s.id));
  const inputCls = 'w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-slate-50 text-[14px] font-semibold text-slate-900 outline-none focus:border-[#1499AD] focus:bg-white focus:ring-2 focus:ring-[#1499AD]/20 transition';
  const labelCls = 'block text-[10.5px] font-black uppercase tracking-[0.14em] text-slate-500 mb-1.5';

  const body = (
    <div onKeyDown={onKeyDown} data-testid="tezkor-modal">
      <div className="flex items-start justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-orange-500/25">
            <Zap className="w-5 h-5 text-white fill-white" />
          </div>
          <div>
            <h2 className="text-[17px] font-black text-slate-900 leading-tight">Tezkor bemor qo'shish</h2>
            <p className="text-[12px] font-medium text-slate-500">Faqat ism, familiya va telefon — 5 soniyada</p>
          </div>
        </div>
        <button type="button" onClick={close} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Yopish">
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Ism *</label>
          <input ref={firstRef} data-testid="tezkor-first-name" value={firstName}
            onChange={e => setFirstName(capitalizeAsYouType(e.target.value))}
            onBlur={e => setFirstName(capitalizeName(e.target.value))}
            placeholder="Ism" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Familiya *</label>
          <input data-testid="tezkor-last-name" value={lastName}
            onChange={e => setLastName(capitalizeAsYouType(e.target.value))}
            onBlur={e => setLastName(capitalizeName(e.target.value))}
            placeholder="Familiya" className={inputCls} />
        </div>
      </div>
      <div className="mt-3">
        <label className={labelCls}>Telefon *</label>
        <div className="relative">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px]" aria-hidden>🇺🇿</span>
          <input type="tel" inputMode="tel" data-testid="tezkor-phone" value={phone}
            onChange={e => setPhone(applyPhoneMask(e.target.value))}
            placeholder="+998 90 123 45 67" maxLength={19} className={cn(inputCls, 'pl-10')} />
        </div>
      </div>

      <button type="button" data-testid="tezkor-plan-toggle" onClick={() => setWithPlan(v => !v)}
        className={cn('mt-4 w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition',
          withPlan ? 'border-[#1499AD]/30 bg-cyan-50/40' : 'border-dashed border-slate-200 bg-white')}>
        <span>
          <span className="block text-[13.5px] font-black text-slate-900">Reja qo'shish</span>
          <span className="block text-[11.5px] font-medium text-slate-500">Ixtiyoriy · tish va xizmatlar</span>
        </span>
        <span className={cn('w-11 h-6 rounded-full p-0.5 transition', withPlan ? 'bg-[#1499AD]' : 'bg-slate-200')}>
          <span className={cn('block w-5 h-5 rounded-full bg-white shadow transition-transform', withPlan && 'translate-x-5')} />
        </span>
      </button>

      {withPlan && (
        <div className="mt-4 space-y-4">
          <div>
            <p className={labelCls}>Tish tanlang · {teeth.length} ta tanlandi</p>
            <div className="grid grid-cols-8 gap-1.5">
              {TOOTH_ROWS.flat().map(n => (
                <button key={n} type="button" data-testid={`tezkor-tooth-${n}`} onClick={() => toggleTooth(n)}
                  className={cn('h-8 rounded-lg border text-[12px] font-bold transition',
                    teeth.includes(n) ? 'bg-[#1499AD] border-[#1499AD] text-white shadow-sm' : 'bg-white border-slate-200 text-slate-700 hover:border-[#1499AD]/50')}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={labelCls}>Xizmatlar</p>
            <div className={cn('space-y-1.5', showAllServices && 'max-h-56 overflow-y-auto pr-1')}>
              {visibleServices.map(s => {
                const on = selectedServiceIds.includes(s.id);
                const count = teeth.filter(fdi => serviceAllowsTooth(s, fdi)).length;
                return (
                  <button key={s.id} type="button" data-testid="tezkor-service" onClick={() => toggleService(s.id)}
                    className={cn('w-full flex items-center justify-between gap-3 px-3.5 h-10 rounded-xl border text-[13px] font-bold transition',
                      on ? 'border-[#1499AD]/50 bg-cyan-50 text-slate-900' : 'border-slate-200 bg-white text-slate-700 hover:border-[#1499AD]/40')}>
                    <span className="flex items-center gap-2 min-w-0">
                      {on ? <Check className="w-4 h-4 text-[#1499AD] shrink-0" /> : <Plus className="w-4 h-4 text-slate-400 shrink-0" />}
                      <span className="truncate">{s.name}{on && count > 0 ? ` × ${count}` : ''}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatMoneyAmount((Number(s.price) || 0) * (on && count > 0 ? count : 1))}</span>
                  </button>
                );
              })}
              {services.length === 0 && <p className="text-[12px] text-slate-400 px-1">Narxlar ro'yxati bo'sh</p>}
            </div>
            {services.length > 0 && (
              <button type="button" onClick={() => setShowAllServices(v => !v)}
                className="mt-1.5 w-full flex items-center gap-2 px-3.5 h-10 rounded-xl border border-slate-200 bg-white text-[13px] font-bold text-slate-700 hover:border-[#1499AD]/40">
                {showAllServices ? <Check className="w-4 h-4 text-[#1499AD]" /> : <Plus className="w-4 h-4 text-slate-400" />}
                {showAllServices ? 'Tayyor' : "Xizmat qo'shish"}
              </button>
            )}
          </div>
          {doctors.length > 1 && (
            <div>
              <label className={labelCls}>Shifokor</label>
              <select value={doctorId} onChange={e => setDoctorId(e.target.value)} className={inputCls}>
                {doctors.map(d => <option key={d.id} value={d.id}>{clinicianDisplayName(d)}</option>)}
              </select>
            </div>
          )}
          <div className="flex items-center justify-between px-4 h-12 rounded-xl bg-slate-900" data-testid="tezkor-total">
            <span className="text-[14px] font-black text-white uppercase tracking-wider">Jami</span>
            <span className="text-[17px] font-black text-[#2dd4bf] tabular-nums">{formatMoneyAmount(planTotal)} so'm</span>
          </div>
        </div>
      )}

      <button type="button" data-testid="tezkor-submit" onClick={handleSubmit} disabled={saving}
        className="mt-5 w-full h-12 rounded-xl bg-gradient-to-r from-[#1499AD] to-[#0ea5e9] text-white text-[12.5px] font-black uppercase tracking-wider shadow-lg shadow-cyan-600/20 flex items-center justify-center gap-2 hover:brightness-105 disabled:opacity-70">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
        Yaratish va profilni ochish
      </button>
      <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
        {withPlan ? 'Reja bilan birga saqlanadi' : 'Bemor saqlanadi'} · Enter ↵
      </p>
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className={cn('fixed inset-0 z-[120] flex bg-slate-900/40 backdrop-blur-[2px]', isPhone ? 'items-end' : 'items-center justify-center p-4')}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <motion.div role="dialog" aria-modal="true" aria-label="Tezkor bemor qo'shish"
            className={cn('bg-white shadow-2xl overflow-y-auto',
              isPhone ? 'w-full max-h-[92vh] rounded-t-3xl px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]' : 'w-full max-w-[440px] max-h-[92vh] rounded-3xl p-6')}
            initial={isPhone ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 8 }}
            animate={isPhone ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
            exit={isPhone ? { y: '100%' } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', damping: 30, stiffness: 340 }}>
            {isPhone && <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200" />}
            {body}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

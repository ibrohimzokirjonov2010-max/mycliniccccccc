import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Phone, Calendar, Plus, Camera, Copy, Mail, Wallet, AlertTriangle, Pencil
} from 'lucide-react';
import { cn, formatCurrency, formatPhone } from '@/lib/utils';
import { patientGenderLabel } from '@/lib/patientGender';
import { formatBirthDate, resolveDoctorLabel } from '@/lib/displayText';
import ToothChartCard from './ToothChartCard';
import TodayPlanBar from './TodayPlanBar';
import { buildPlanStepperGroups } from './planStepperModel';
import ChairsideClinicalTools, { ChairsideClinicalTabBar } from './ChairsideClinicalTools';
import { withOncePricing } from '@/lib/toothPlanCharge';

const TEAL = '#14b8a6';
const TEAL_DARK = '#0d9488';
const NAVY = '#0f172a';

const MOCKUP_LEGEND = [
  { label: "Sog'lom", color: '#22c55e' },
  { label: 'Karies', color: '#ef4444' },
  { label: 'Plomba', color: '#3b82f6' },
  { label: 'Koronka', color: '#eab308' },
  { label: 'Implant', color: '#94a3b8' },
  { label: "Yo'q", color: '#0f172a' },
];

function getInitials(name) {
  return name?.split(' ')?.map((n) => n[0])?.join('')?.substring(0, 2)?.toUpperCase() || '?';
}

function alertLabel(alert, language) {
  if (!alert) return '';
  if (typeof alert === 'string') return alert;
  if (language === 'ru') return alert.labelRu || alert.labelUz || alert.type || '';
  if (language === 'en') return alert.labelEn || alert.labelUz || alert.type || '';
  return alert.labelUz || alert.labelRu || alert.type || '';
}

/**
 * Chairside-first desktop patient profile — pixel-matched to approved mockup.
 * Keeps existing ProfessionalOdontogram PNG assets (FDI 18/28/38/48 visible).
 */
export default function ChairsidePatientProfile({
  patient,
  age,
  totalDebt = 0,
  totalPrepayment = 0,
  medicalAlerts = [],
  selectedTooth,
  onSelectTooth,
  onClearTooth,
  toothStatuses = {},
  plans = [],
  payments = [],
  services = [],
  toothRecords = [],
  implants = [],
  doctors = [],
  appointments = [],
  onReload,
  odontogramSelectedTeeth = [],
  onOdontogramChange,
  handleInfoToothClick,
  patientType,
  setPatientType,
  chartView,
  showOcclusal,
  psrScores,
  occlusionNotes,
  handleOcclusionNotesChange,
  occlusionClass,
  handleOcclusionClassChange,
  onBack,
  backLabel,
  onPay,
  onAppointment,
  onNewPlan,
  onEditPatient,
  onAvatarUpload,
  onQuickStatus,
  onSaveToothNote,
  onOpenFullProfile,
  profileViewMode,
  setProfileViewMode,
  locationState,
  language = 'uz',
  onPatientUpdated,
}) {
  const todaySteps = useMemo(
    () => buildPlanStepperGroups({ appointments, plans, implants, language }),
    [appointments, plans, implants, language],
  );

  const [clinicalTab, setClinicalTab] = useState('tashxis');

  useEffect(() => {
    const header = document.querySelector('[data-chairside-header]');
    const plan = document.querySelector('[data-chairside-plan]');
    if (!header) return undefined;
    const scroller = header.closest('main');
    const apply = () => {
      const height = Math.ceil(header.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--chairside-header-h', `${height}px`);
      const planHeight = plan ? Math.ceil(plan.getBoundingClientRect().height) : 0;
      document.documentElement.style.setProperty('--chairside-plan-h', `${planHeight}px`);
      if (scroller) scroller.style.scrollPaddingTop = `${height + planHeight + 16}px`;
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    if (plan) observer.observe(plan);
    window.addEventListener('resize', apply);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', apply);
      if (scroller) scroller.style.scrollPaddingTop = '';
    };
  }, [todaySteps.groups.length, todaySteps.groups.reduce((sum, group) => sum + (group.steps?.length || 0), 0)]);

  const pricedPlans = useMemo(() => withOncePricing(plans), [plans]);
  const planRemainingTotal = useMemo(() => {
    return pricedPlans.reduce((sum, p) => {
      const st = (p.status || '').toLowerCase();
      if (st === 'cancelled' || st === 'canceled') return sum;
      const rem = Math.max(0, (Number(p.total_price) || 0) - (Number(p.paid_amount) || 0));
      return sum + rem;
    }, 0);
  }, [pricedPlans]);

  const activeStep = useMemo(() => {
    const steps = (todaySteps.groups || []).flatMap((group) => group.steps || []);
    return steps.find((step) => step.state === 'active') || steps.find((step) => step.state === 'pending') || null;
  }, [todaySteps]);

  const genderLabel = patientGenderLabel(patient?.gender, language);

  const debtAmount = formatCurrency(totalDebt || 0);
  const debtBadgeText = totalDebt > 0
    ? (language === 'ru' ? `Есть долг · ${debtAmount}` : language === 'en' ? `Has debt · ${debtAmount}` : `Qarz bor · ${debtAmount}`)
    : null;
  const birthLabel = formatBirthDate(patient?.birth_date);
  const allergyText = (medicalAlerts || []).map((alert) => alertLabel(alert, language)).filter(Boolean).join(', ')
    || String(patient?.important_info || '').trim();
  const addressLabel = String(patient?.address || '').trim();
  const doctorLabel = resolveDoctorLabel(
    patient?.doctor_name || patient?.main_treatment_provider,
    doctors,
    (plans || []).map((plan) => plan.doctor_name || plan.doctor).find((name) => name && !/^(usr|user)[-_]/i.test(String(name))) || '',
  );

  return (
    <div className="min-h-0 font-sans">
      {medicalAlerts?.length > 0 && (
        <div className="bg-rose-600 text-white px-4 py-2.5 flex flex-wrap items-center gap-2 sticky top-0 z-40 shadow-md">
          <AlertTriangle className="w-4 h-4 shrink-0 animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-wider">Allergiya / Tibbiy ogohlantirish:</span>
          {medicalAlerts.map((alert, idx) => (
            <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-lg bg-white/15 border border-white/25 text-white text-[9px] font-black uppercase tracking-wide">
              {alertLabel(alert, language)}
            </span>
          ))}
        </div>
      )}

      <div className="chairside-patient-header bg-white border-b border-slate-200/80 sticky top-0 z-40 overflow-visible shadow-[0_1px_0_rgba(15,23,42,0.06)]" data-chairside-header="true" data-patient-header="true">
        <div className="max-w-[1680px] mx-auto w-full min-w-0 px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-[18rem]">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border border-slate-200/60"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{backLabel || 'Orqaga'}</span>
            </button>

            <div
              className="w-11 h-11 rounded-full text-white flex items-center justify-center text-sm font-black shrink-0 shadow-sm overflow-hidden ring-2 ring-white"
              style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)` }}
            >
              {patient?.photo_url ? (
                <img src={patient.photo_url} alt="" className="w-full h-full object-cover" />
              ) : getInitials(patient?.full_name)}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight leading-tight break-words">
                  {patient?.full_name}
                </h1>
                {debtBadgeText && (
                  <span data-testid="debt-badge" className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[11px] font-bold shrink-0 shadow-sm">
                    {debtBadgeText}
                  </span>
                )}
                {typeof onEditPatient === 'function' && (
                  <button
                    type="button"
                    onClick={onEditPatient}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <Pencil className="h-3 w-3" />
                    Tahrirlash
                  </button>
                )}
              </div>
              <p className="text-[12px] font-semibold text-slate-500 mt-0.5 break-words">
                {patient?.phone ? formatPhone(patient.phone) : '—'}
              </p>
              <p data-testid="patient-card-header-meta" className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] font-semibold text-slate-600">
                <span className={allergyText ? 'font-black text-rose-600' : 'text-slate-400'}>
                  {allergyText ? `Allergiya: ${allergyText}` : 'Allergiya yo‘q'}
                </span>
                <span aria-hidden className="text-slate-300">·</span>
                <span>
                  {birthLabel
                    ? `Tug‘ilgan: ${birthLabel}${age != null ? ` (${age} yosh)` : ''}`
                    : (age != null ? `${age} yosh` : 'Tug‘ilgan sana yo‘q')}
                </span>
                <span aria-hidden className="text-slate-300">·</span>
                <span>{genderLabel || 'Jins ko‘rsatilmagan'}</span>
                <span aria-hidden className="text-slate-300">·</span>
                <span className="min-w-0 break-words">{addressLabel || 'Manzil yo‘q'}</span>
              </p>
            </div>
          </div>

          <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
            <button
                type="button"
                onClick={() => setProfileViewMode(profileViewMode === 'chairside' ? 'reyestr' : 'chairside')}
                className="hidden sm:inline-flex px-2 py-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer transition-colors mr-0.5"
                title="Reyestr / Chairside"
              >
                Reyestr
              </button>

            <button
              type="button"
              onClick={onPay}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-emerald-50 text-emerald-700 border-2 border-emerald-500/70 rounded-xl text-xs font-black transition-all cursor-pointer"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>To&apos;lov</span>
            </button>
            <button
              type="button"
              onClick={onAppointment}
              className="flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer hover:opacity-95"
              style={{ backgroundColor: TEAL }}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Uchrashuv</span>
            </button>
            <button
              type="button"
              onClick={onNewPlan}
              className="flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-xs font-black shadow-sm transition-all cursor-pointer hover:opacity-95"
              style={{ backgroundColor: NAVY }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yangi reja</span>
            </button>
          </div>
        </div>
        <div className="max-w-[1680px] mx-auto w-full min-w-0 px-3 sm:px-5 pb-2.5">
          <ChairsideClinicalTabBar
            activeTab={clinicalTab}
            onChange={setClinicalTab}
            language={language}
          />
        </div>
      </div>

      <div className="chairside-sheet max-w-[1680px] mx-auto p-3 sm:p-4 lg:p-5 space-y-3.5">
        <div className="flex flex-col xl:flex-row gap-3.5 items-start">
          <div className="chairside-profile-column w-full xl:w-[252px] shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_1px_3px_rgba(15,23,42,0.06)] p-4 flex flex-col gap-3.5 sticky top-[9.5rem]">
              <div className="flex flex-col items-center text-center">
                <div
                  className="relative group cursor-pointer"
                  onClick={() => { const inp = document.getElementById('avatar-upload-input-chair'); if (inp) inp.click(); }}
                  title="Profil rasmini o'zgartirish"
                >
                  {patient?.photo_url ? (
                    <img src={patient.photo_url} alt="" className="w-[72px] h-[72px] rounded-full object-cover border-2 border-white shadow-md ring-2 ring-slate-200/70" />
                  ) : (
                    <div
                      className="w-[72px] h-[72px] rounded-full flex items-center justify-center text-white text-xl font-black shadow-md"
                      style={{ background: `linear-gradient(135deg, ${TEAL} 0%, ${TEAL_DARK} 100%)` }}
                    >
                      {getInitials(patient?.full_name)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                    <Camera className="w-4 h-4" />
                  </div>
                </div>
                <input id="avatar-upload-input-chair" data-testid="profile-photo-input" type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
                <h2 className="text-[15px] font-black text-slate-900 mt-3 leading-snug">{patient?.full_name}</h2>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  {age != null ? `${age} yosh` : '—'}
                  {genderLabel ? ` · ${genderLabel}` : ''}
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: TEAL }} />
                  <a href={patient?.phone ? `tel:+${String(patient.phone).replace(/\D/g, '')}` : undefined} className="font-bold font-mono truncate hover:underline">
                    {patient?.phone ? formatPhone(patient.phone) : '—'}
                  </a>
                  {patient?.phone && (
                    <button
                      type="button"
                      className="p-0.5 text-slate-400 hover:text-slate-700 cursor-pointer ml-auto"
                      onClick={() => { navigator.clipboard.writeText(patient.phone); }}
                      title="Nusxalash"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-700">
                  <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: TEAL }} />
                  <span className="font-semibold truncate text-slate-500">{patient?.email || '—'}</span>
                </div>
              </div>

              <div className={cn(
                'rounded-xl p-3.5 text-center border',
                totalDebt > 0 ? 'bg-rose-50 border-rose-200' : totalPrepayment > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'
              )}>
                <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Balans / Qarz</p>
                {totalDebt > 0 ? (
                  <>
                    <p className="text-[1.35rem] font-black text-rose-600 font-mono leading-none tracking-tight">
                      -{formatCurrency(totalDebt)}
                    </p>
                    <p className="text-[10px] font-bold text-rose-500 mt-1">Qarz mavjud</p>
                  </>
                ) : totalPrepayment > 0 ? (
                  <>
                    <p className="text-[1.35rem] font-black text-emerald-700 font-mono leading-none tracking-tight">
                      +{formatCurrency(totalPrepayment)}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1">Oldindan to‘lov</p>
                  </>
                ) : (
                  <p className="text-[1.35rem] font-black text-slate-700 font-mono leading-none">{formatCurrency(0)}</p>
                )}
              </div>

              <button
                type="button"
                onClick={onOpenFullProfile || onEditPatient}
                className="w-full py-2.5 px-2.5 rounded-xl border-2 text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-1.5 hover:bg-teal-50"
                style={{ borderColor: `${TEAL}99`, color: TEAL_DARK }}
              >
                To&apos;liq profil ko&apos;rish
                <span aria-hidden>→</span>
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full flex flex-col gap-3.5">
            <div className="min-w-0 w-full" data-tooth-chart="chairside">
              <ToothChartCard
                patient={patient}
                plans={plans}
                payments={payments}
                appointments={appointments}
                doctors={doctors}
                services={services}
                implants={implants}
                toothRecords={toothRecords}
                onReload={onReload}
                onBookAppointment={onAppointment}
                onOpenPlan={onNewPlan}
              />
            </div>

            <ChairsideClinicalTools
              patient={patient}
              selectedTooth={selectedTooth?.fdi || selectedTooth?.id || selectedTooth}
              onPatientUpdated={onPatientUpdated}
              language={language}
              tabbed
              hideTabBar
              activeTab={clinicalTab}
              onTabChange={setClinicalTab}
              doctorName={doctorLabel}
              doctors={doctors}
            />

            <div className="chairside-plan-row" data-chairside-plan="true">
            <TodayPlanBar
              groups={todaySteps.groups}
              title={todaySteps.title}
              totalDebt={totalDebt}
              planRemaining={planRemainingTotal}
              onPay={onPay}
              onNextClinical={(step) => {
                const target = step || activeStep;
                setClinicalTab('tashxis');
                document.getElementById('chairside-clinical-tools')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (target?.tooth && typeof onSelectTooth === 'function') {
                  onSelectTooth({ fdi: String(target.tooth), id: String(target.tooth) });
                }
              }}
              onOpenPlan={onNewPlan}
            />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import {
  ArrowLeft, Phone, Calendar, Plus, Info, Camera, Copy, Mail, Wallet
} from 'lucide-react';
import { cn, formatPhone } from '@/lib/utils';
import ProfessionalOdontogram from './ProfessionalOdontogram';
import ToothSidePanel from './ToothSidePanel';
import TodayPlanBar from './TodayPlanBar';

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
  toothRecords = [],
  implants = [],
  doctors = [],
  appointments = [],
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
}) {
  const todaySteps = useMemo(() => {
    const steps = [];
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    (appointments || []).forEach((a) => {
      const raw = a.appointment_date || a.date || a.start_time || a.created_date;
      if (!raw) return;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (key !== todayKey) return;
      const st = (a.status || '').toLowerCase();
      let state = 'pending';
      if (st === 'completed' || st === 'bajarildi' || st === 'done') state = 'done';
      else if (st === 'in_progress' || st === 'inprogress' || st === 'jarayonda' || st === 'waiting' || st === 'confirmed') state = 'active';
      else if (st === 'scheduled' || st === 'pending') state = 'pending';
      steps.push({
        id: `appt-${a.id}`,
        title: a.service_name || a.notes || a.title || 'Uchrashuv',
        tooth: a.tooth_number || null,
        state,
      });
    });

    if (steps.length === 0) {
      (plans || []).forEach((p) => {
        const st = (p.status || '').toLowerCase();
        if (st === 'cancelled' || st === 'canceled') return;
        const services = Array.isArray(p.services) && p.services.length
          ? p.services
          : [{ service_name: p.name || p.title, status: p.status, tooth_number: p.tooth_number, completed: st === 'completed' }];
        services.forEach((s, idx) => {
          if (steps.length >= 3) return;
          const sst = (s.status || p.status || '').toLowerCase();
          let state = 'pending';
          if (s.completed || sst === 'completed' || sst === 'bajarildi') state = 'done';
          else if (sst.includes('progress') || sst === 'jarayonda' || sst === 'active') state = 'active';
          else if (st === 'completed') state = 'done';
          else if (st.includes('progress') || st === 'jarayonda' || st === 'active') state = idx === 0 ? 'active' : 'pending';
          const tooth = String(s.tooth_number || s.tooth_id || p.tooth_number || '').replace(/^#/, '') || null;
          steps.push({
            id: `plan-${p.id}-${idx}`,
            title: s.service_name || s.name || p.name || 'Muolaja',
            tooth: tooth && tooth !== 'general' ? tooth : null,
            state,
          });
        });
      });
    }

    if (steps.length && !steps.some((s) => s.state === 'active') && steps.some((s) => s.state === 'pending')) {
      const firstPending = steps.find((s) => s.state === 'pending');
      if (firstPending) firstPending.state = 'active';
    }

    return steps.slice(0, 3);
  }, [appointments, plans]);

  const genderLabel = patient?.gender === 'Female' || patient?.gender === 'female' || patient?.gender === 'Ayol'
    ? 'Ayol'
    : patient?.gender === 'Male' || patient?.gender === 'male' || patient?.gender === 'Erkak'
      ? 'Erkak'
      : (patient?.gender || '');

  const debtBadgeText = totalDebt > 0
    ? (language === 'ru' ? 'Есть долг' : language === 'en' ? 'Has debt' : 'ONE qarz bor')
    : null;

  return (
    <div className="min-h-0 font-sans">
      {medicalAlerts?.length > 0 && (
        <div className="bg-rose-50 border-b border-rose-100 px-4 py-2 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-600">Ogohlantirish:</span>
          {medicalAlerts.map((alert, idx) => (
            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-lg bg-rose-600 text-white text-[9px] font-black uppercase tracking-wide">
              {alertLabel(alert, language)}
            </span>
          ))}
        </div>
      )}

      <div className="bg-white border-b border-slate-200/90 sticky top-0 z-30 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="max-w-[1680px] mx-auto px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
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
                <h1 className="text-lg sm:text-xl font-black text-slate-900 truncate tracking-tight leading-tight">
                  {patient?.full_name}
                </h1>
                {debtBadgeText && (
                  <span className="px-2.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black uppercase tracking-wide shrink-0 shadow-sm">
                    {debtBadgeText}
                  </span>
                )}
              </div>
              <p className="text-[12px] font-semibold text-slate-500 truncate mt-0.5">
                {patient?.phone ? formatPhone(patient.phone) : '—'}
                {patient?.birth_date ? `  ·  Tug'ilgan: ${patient.birth_date}${age != null ? ` (${age} yosh)` : ''}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <div className="inline-flex p-0.5 bg-slate-100 rounded-xl border border-slate-200/70 mr-0.5">
              <button
                type="button"
                onClick={() => setProfileViewMode('chairside')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all',
                  profileViewMode === 'chairside' ? 'bg-white text-[#0d9488] shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Chairside
              </button>
              <button
                type="button"
                onClick={() => setProfileViewMode('reyestr')}
                className={cn(
                  'px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer transition-all',
                  profileViewMode === 'reyestr' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                Reyestr
              </button>
            </div>

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
      </div>

      <div className="max-w-[1680px] mx-auto p-3 sm:p-4 lg:p-5 space-y-3.5">
        <div className="flex flex-col xl:flex-row gap-3.5 items-start">
          <div className="w-full xl:w-[240px] shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col gap-3.5 sticky top-[76px]">
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
                <input id="avatar-upload-input-chair" type="file" accept="image/*" className="hidden" onChange={onAvatarUpload} />
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
                      -{Number(totalDebt).toLocaleString('uz-UZ')}
                    </p>
                    <p className="text-[10px] font-bold text-rose-500 mt-1">UZS · Qarz mavjud</p>
                  </>
                ) : totalPrepayment > 0 ? (
                  <>
                    <p className="text-[1.35rem] font-black text-emerald-700 font-mono leading-none tracking-tight">
                      +{Number(totalPrepayment).toLocaleString('uz-UZ')}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600 mt-1">UZS · Prepayment</p>
                  </>
                ) : (
                  <p className="text-[1.35rem] font-black text-slate-700 font-mono leading-none">0 UZS</p>
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

          <div className="flex-1 min-w-0 w-full">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-visible">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.08em] text-slate-900 truncate">
                    ODONTOGRAMMA (FDI{patientType === 'child' ? ', BOLALAR' : ', KATTA YOSH'})
                  </h3>
                  <Info className="w-3.5 h-3.5 text-slate-400 shrink-0" title="FDI tish xaritasi" />
                </div>
                {typeof setPatientType === 'function' && (
                  <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200/70 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPatientType('adult')}
                      className={cn(
                        'px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide cursor-pointer transition-all',
                        patientType !== 'child' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Katta
                    </button>
                    <button
                      type="button"
                      onClick={() => setPatientType('child')}
                      className={cn(
                        'px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-wide cursor-pointer transition-all',
                        patientType === 'child' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      Bolalar
                    </button>
                  </div>
                )}
              </div>
              <div className="p-2 sm:p-3 overflow-x-auto overflow-y-visible no-scrollbar min-w-0 w-full flex justify-center bg-white">
                <ProfessionalOdontogram
                  selectedTeeth={odontogramSelectedTeeth}
                  onChange={onOdontogramChange}
                  onToothClick={handleInfoToothClick}
                  multi={false}
                  toothStatuses={toothStatuses}
                  patientType={patientType}
                  onPatientTypeChange={setPatientType}
                  patientAge={age}
                  chartView={chartView}
                  quadrantFilter="all"
                  showOcclusal={showOcclusal}
                  psrScores={psrScores}
                  occlusionNotes={occlusionNotes}
                  onOcclusionNotesChange={handleOcclusionNotesChange}
                  occlusionClass={occlusionClass}
                  onOcclusionClassChange={handleOcclusionClassChange}
                  hideStats
                  hideLegend
                  compact={false}
                />
              </div>
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/60 flex flex-wrap items-center gap-x-5 gap-y-2">
                {MOCKUP_LEGEND.map((item) => (
                  <div key={item.label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-black/5" style={{ backgroundColor: item.color }} />
                    <span className="text-[10px] font-bold text-slate-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {selectedTooth ? (
            <ToothSidePanel
              tooth={selectedTooth}
              plans={plans}
              toothStatuses={toothStatuses}
              toothRecords={toothRecords}
              implants={implants}
              doctors={doctors}
              onClose={onClearTooth}
              onQuickStatus={onQuickStatus}
              onSaveNote={onSaveToothNote}
            />
          ) : (
            <div className="hidden xl:flex w-[300px] shrink-0 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm items-center justify-center px-6 py-16 sticky top-[76px]">
              <div className="text-center">
                <div
                  className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center mx-auto mb-3 font-black text-sm"
                  style={{ color: TEAL }}
                >
                  #
                </div>
                <p className="text-xs font-bold text-slate-500">Tishni tanlang</p>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">Tarix, tez holat va eslatma shu yerda ochiladi</p>
              </div>
            </div>
          )}
        </div>

        <TodayPlanBar
          steps={todaySteps}
          totalDebt={totalDebt}
          onPay={onPay}
        />
      </div>
    </div>
  );
}

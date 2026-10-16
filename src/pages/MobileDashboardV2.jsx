import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, Clock, ChevronRight, Play, CreditCard, Calendar, DollarSign, Users,
  UserPlus, CalendarPlus, ArrowRight, Activity, Stethoscope, CalendarDays,
} from 'lucide-react';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency, getTreatmentTypeLabel } from '@/lib/utils';
import { formatClinicDate, formatClinicDateWithWeekday, paymentStamp, tashkentToday, displayDoctorName } from '@/lib/clinicTime';
import { isDemoName } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { fetchDashboardStats } from '../utils/dashboardUtils';

/** Mobile home ("Bosh sahifa") — design audit-1012/01. Real data only. */
const hhmm = (t) => (t ? String(t).slice(0, 5) : '--:--');
const addMin = (t, m) => {
  if (!t) return '';
  const [h, mi] = String(t).split(':').map(Number);
  if (!Number.isFinite(h)) return '';
  const tot = h * 60 + (mi || 0) + (Number(m) || 30);
  return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
};
const initials = (n) => n?.trim().split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?';
const nowHHMM = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tashkent', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const statusLabel = (s) => {
  const v = String(s || '').toLowerCase();
  if (v === 'completed') return 'Yakunlandi';
  if (v === 'cancelled' || v === 'canceled') return 'Bekor';
  if (v.startsWith('no')) return 'Kelmadi';
  if (v === 'in_progress' || v === 'in-progress' || v === 'arrived') return 'Jarayonda';
  return 'Soatida';
};
const isDone = (a) => ['completed', 'cancelled', 'canceled', 'no-show', 'noshow', 'no_show'].includes(String(a?.status || '').toLowerCase());

export default function MobileDashboardV2() {
  const navigate = useNavigate();
  const { user, isDoctor } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [debt, setDebt] = useState({ count: 0, total: 0 });

  const loadData = useCallback(async () => {
    if (!user) return;
    try {
      const [d, pats] = await Promise.all([
        fetchDashboardStats(user, isDoctor, false),
        base44.entities.Patient.list('full_name', 1000).catch(() => []),
      ]);
      setData(d);
      let list = pats || [];
      if (isDoctor && user?.id) {
        list = list.filter((p) => [String(user.id), String(user.name)].includes(String(p.main_treatment_provider)) || String(p.created_by_id) === String(user.id));
      }
      const debtors = list.filter((p) => (Number(p.total_debt) || 0) > 0);
      setDebt({ count: debtors.length, total: debtors.reduce((s, p) => s + (Number(p.total_debt) || 0), 0) });
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, [user, isDoctor]);

  useEffect(() => { loadData(); }, [loadData]);

  const today = useMemo(() => {
    const l = [...(data?.todayApptsList || [])];
    return l.sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
  }, [data]);
  const next = useMemo(() => {
    const now = nowHHMM();
    const open = today.filter((a) => !isDone(a));
    return open.find((a) => hhmm(a.time) >= now) || open[0] || null;
  }, [today]);

  const activity = useMemo(() => {
    if (!data) return [];
    return [
      ...(data.payments || []).slice(0, 4).map((p) => ({ ...p, _t: 'payment' })),
      ...(data.appointments || []).slice(0, 4).map((a) => ({ ...a, _t: 'appt' })),
    ].sort((a, b) => new Date(b.created_date || b.date) - new Date(a.created_date || a.date)).slice(0, 4);
  }, [data]);

  const dayLabel = formatClinicDateWithWeekday(tashkentToday(), 'uz');
  const dayShort = formatClinicDate(tashkentToday());
  const nm = isDemoName(user?.full_name || user?.name) ? '' : (user?.full_name || user?.name || '');
  const greetName = nm ? (isDoctor ? `Dr. ${displayDoctorName(nm).split(' ')[0]}` : nm.split(' ')[0]) : '';
  const trend = data?.stats?.todayRevenueTrend;
  const openPatient = (a) => a?.patient_id ? navigate(`/patients/${a.patient_id}`) : navigate('/appointments');
  const isPhone = () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
  const startVisit = (a) => (a?.id && a?.patient_id && isPhone() ? navigate(`/visit/${a.id}`) : openPatient(a));
  const takePayment = (a) => navigate('/payments', {
    state: a?.patient_id
      ? { openAddModal: true, prefillPatient: a.patient_id, prefillPatientName: a.patient_name, prefillDoctor: a.doctor_id || a.doctor_name || '' }
      : { openAddModal: true },
  });

  const card = 'bg-white rounded-[20px] border border-slate-100 shadow-[0_2px_10px_rgba(15,23,42,0.04)]';

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-[#F4F7F9] px-3.5 pt-3 pb-28 space-y-3">
        {/* Welcome */}
        <div className={`${card} flex items-center gap-3.5 p-3.5`}>
          <div className="w-[60px] h-[60px] rounded-2xl bg-gradient-to-br from-[#1BA0B0] to-[#11808F] flex items-center justify-center text-white shadow-lg shadow-[#1499AD]/25 shrink-0">
            <Heart className="w-8 h-8 fill-current" />
          </div>
          <div className="min-w-0">
            <h1 className="text-[19px] font-extrabold text-slate-900 leading-tight truncate">Xush kelibsiz{greetName ? `, ${greetName}` : ''}! 👋</h1>
            <p className="text-[13px] font-medium text-slate-500 mt-1">Bugun {dayLabel}</p>
          </div>
        </div>

        {/* Next patient */}
        <div className="rounded-[20px] border border-emerald-200 bg-gradient-to-b from-emerald-50 to-[#F2FBF7] p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center"><Clock className="w-4 h-4" /></span>
              <span className="text-[13px] font-extrabold tracking-wider text-emerald-700 uppercase">Keyingi bemor</span>
            </div>
            {next && <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[13px] font-bold">{hhmm(next.time)} da</span>}
          </div>
          {loading ? (
            <div className="h-24 mt-3 rounded-xl bg-white/60 animate-pulse" />
          ) : next ? (
            <>
              <button onClick={() => openPatient(next)} className="w-full flex items-center gap-3 mt-3 text-left min-h-[56px]">
                <div className="w-14 h-14 rounded-full bg-white border-2 border-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-lg shrink-0">{initials(next.patient_name)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-[17px] font-extrabold text-slate-900 truncate">{next.patient_name}</p>
                  {next.patient_phone && <p className="text-[13px] font-semibold text-slate-600 truncate">{next.patient_phone}</p>}
                  <div className="flex items-center gap-3 mt-1 text-[13px] text-slate-600">
                    <span className="flex items-center gap-1 min-w-0 truncate"><Stethoscope className="w-3.5 h-3.5 shrink-0" />{getTreatmentTypeLabel(next.service_name || next.treatment_type, 'uz') || 'Uchrashuv'}</span>
                    <span className="flex items-center gap-1 shrink-0"><CalendarDays className="w-3.5 h-3.5" />{hhmm(next.time)} – {addMin(next.time, next.duration)}</span>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
              </button>
              <div className="grid grid-cols-2 gap-2.5 mt-3">
                <button onClick={() => startVisit(next)} className="h-12 rounded-2xl bg-emerald-100 text-emerald-800 font-bold text-[15px] flex items-center justify-center gap-2 active:scale-[0.98]"><Play className="w-5 h-5 fill-current" />Boshlash</button>
                <button onClick={() => takePayment(next)} className="h-12 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-[15px] flex items-center justify-center gap-2 shadow-md shadow-emerald-600/25 active:scale-[0.98]"><CreditCard className="w-5 h-5" />To'lov olish</button>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3 mt-3 py-2">
              <div className="w-12 h-12 rounded-full bg-white border border-emerald-100 flex items-center justify-center"><Calendar className="w-6 h-6 text-emerald-500" /></div>
              <div><p className="text-[15px] font-bold text-slate-800">Bugun navbatda bemor yo'q</p><p className="text-[13px] text-slate-500">Yangi uchrashuv qo'shishingiz mumkin</p></div>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => navigate('/appointments')} className={`${card} p-3 text-left min-h-[124px]`}>
            <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center"><Calendar className="w-[18px] h-[18px]" /></span>
            <p className="text-[11px] font-bold text-slate-500 uppercase mt-2 leading-tight">Bugungi uchrashuvlar</p>
            <p className="text-[22px] font-extrabold text-slate-900 leading-tight mt-1">{loading ? '…' : today.length}</p>
            <p className="text-[11px] text-slate-500">{dayShort}</p>
          </button>
          <button onClick={() => navigate('/payments')} className={`${card} p-3 text-left min-h-[124px]`}>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center"><DollarSign className="w-[18px] h-[18px]" /></span>
            <p className="text-[11px] font-bold text-slate-500 uppercase mt-2 leading-tight">Bugungi daromad</p>
            <p className="text-[17px] font-extrabold text-slate-900 leading-tight mt-1 break-words">{loading ? '…' : formatCurrency(data?.stats?.todayRevenue || 0).replace(/\s*so'm$/i, '')}</p>
            <div className="flex items-center justify-between gap-1"><span className="text-[11px] text-slate-500">so'm</span>{trend && trend !== '—' && trend !== '0%' && <span className={`text-[11px] font-bold ${trend.startsWith('-') ? 'text-rose-500' : 'text-emerald-600'}`}>{trend}</span>}</div>
          </button>
          <button onClick={() => navigate('/debts')} className={`${card} p-3 text-left min-h-[124px] relative`}>
            <ChevronRight className="w-4 h-4 text-slate-400 absolute right-2 top-3" />
            <span className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><Users className="w-[18px] h-[18px]" /></span>
            <p className="text-[11px] font-bold text-slate-500 uppercase mt-2 leading-tight">Qarzdorlar</p>
            <p className="text-[22px] font-extrabold text-slate-900 leading-tight mt-1">{loading ? '…' : debt.count}</p>
            <p className="text-[11px] text-slate-500 truncate">{formatCurrency(debt.total)}</p>
          </button>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: UserPlus, label: 'Yangi bemor', plus: true, cls: 'bg-emerald-50 border-emerald-100 text-emerald-700', go: () => navigate('/patients', { state: { openAddModal: true } }) },
            { icon: CalendarPlus, label: 'Yangi uchrashuv', plus: true, cls: 'bg-emerald-50 border-emerald-100 text-emerald-700', go: () => navigate('/appointments', { state: { openAddModal: true } }) },
            { icon: CreditCard, label: "To'lov olish", cls: 'bg-blue-50 border-blue-100 text-blue-700', go: () => takePayment(null) },
          ].map((q) => (
            <button key={q.label} onClick={q.go} className={`h-[84px] rounded-[18px] border ${q.cls} flex flex-col items-center justify-center gap-1.5 active:scale-[0.98]`}>
              <q.icon className="w-6 h-6" />
              <span className="text-[13px] font-bold leading-tight text-center">{q.plus ? '+ ' : ''}{q.label}</span>
            </button>
          ))}
        </div>

        {/* Today's queue */}
        <div className={`${card} p-3.5`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-2 text-[16px] font-extrabold italic text-slate-900"><Calendar className="w-5 h-5 text-slate-700" />Bugungi navbat ({today.length})</h2>
            <button onClick={() => navigate('/chairside')} className="h-9 px-3.5 rounded-full bg-blue-50 text-blue-700 text-[13px] font-bold flex items-center gap-1">Barchasi <ArrowRight className="w-4 h-4" /></button>
          </div>
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-slate-100 animate-pulse" />)}</div>
          ) : today.length === 0 ? (
            <div className="py-6 text-center"><Calendar className="w-9 h-9 text-slate-300 mx-auto mb-2" /><p className="text-[14px] font-semibold text-slate-500">Bugun uchrashuv yo'q</p></div>
          ) : (
            <div className="divide-y divide-slate-100">
              {today.slice(0, 6).map((a) => {
                const isNext = next && a.id === next.id;
                return (
                  <div key={a.id} onClick={() => openPatient(a)} className={`flex items-center gap-2.5 py-2 ${isNext ? 'bg-emerald-50/70 -mx-2 px-2 rounded-xl border-0' : ''}`}>
                    <div className={`w-[58px] shrink-0 rounded-xl py-1.5 text-center ${isNext ? 'bg-emerald-100' : 'bg-slate-50'}`}>
                      <p className="text-[14px] font-bold text-slate-900 leading-tight">{hhmm(a.time)}</p>
                      <p className="text-[12px] text-slate-500 leading-tight">{addMin(a.time, a.duration)}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700 text-[13px] font-bold flex items-center justify-center shrink-0">{initials(a.patient_name)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 truncate">{a.patient_name}</p>
                      <p className="text-[13px] text-slate-500 truncate">{getTreatmentTypeLabel(a.service_name || a.treatment_type, 'uz') || 'Uchrashuv'}</p>
                    </div>
                    {isNext ? (
                      <button onClick={(e) => { e.stopPropagation(); startVisit(a); }} className="h-11 px-3 rounded-xl bg-emerald-600 text-white text-[13px] font-bold flex items-center gap-1 shrink-0"><Play className="w-3.5 h-3.5 fill-current" />Boshlash</button>
                    ) : (
                      <span className="h-9 px-3 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-semibold flex items-center shrink-0">{statusLabel(a.status)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent activity */}
        <div className={`${card} p-3.5`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="flex items-center gap-2 text-[16px] font-extrabold text-slate-900"><Activity className="w-5 h-5 text-slate-700" />So'nggi harakatlar</h2>
            <button onClick={() => navigate('/payments')} className="h-9 px-3.5 rounded-full bg-blue-50 text-blue-700 text-[13px] font-bold flex items-center gap-1">Barchasi <ArrowRight className="w-4 h-4" /></button>
          </div>
          {activity.length === 0 ? (
            <p className="py-5 text-center text-[14px] font-semibold text-slate-500">{loading ? 'Yuklanmoqda…' : "Hozircha faoliyat yo'q"}</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activity.map((it, i) => {
                const pay = it._t === 'payment';
                return (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${pay ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>{pay ? <DollarSign className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-bold text-slate-900 truncate">{it.patient_name || (pay ? "To'lov" : 'Uchrashuv')}</p>
                      <p className="text-[13px] text-slate-500 truncate">{pay ? "To'lov qabul qilindi" : (getTreatmentTypeLabel(it.service_name, 'uz') || 'Uchrashuv')}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {pay && <p className="text-[14px] font-extrabold text-emerald-600">{formatCurrency(it.amount)}</p>}
                      <p className="text-[12px] text-slate-500">{pay ? paymentStamp(it).dateTime : `${formatClinicDate(it.date)} ${hhmm(it.time)}`}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PullToRefresh>
  );
}

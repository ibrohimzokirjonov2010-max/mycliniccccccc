import { useMemo, useState } from 'react';
import { profileState } from '@/hooks/useBack';
import { useRestorableState } from '@/hooks/useRestorableState';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  Play,
  Phone,
  Clock,
  ChevronRight,
  RefreshCw,
  UserRound,
  Stethoscope,
  AlertCircle,
  Search,
  Users,
  CheckCircle2,
  Loader,
  XCircle,
  Smile,
  CalendarDays,
  Plus,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/LanguageContext';
import { getTashkentDate } from '@/lib/telegramReminderService';
import { formatCurrency, cn } from '@/lib/utils';
import { formatClinicDateWithWeekday } from '@/lib/clinicTime';
import { QUERY_KEYS } from '@/lib/queryKeys';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';

function normalizeDate(value) {
  if (!value) return '';
  const raw = String(value);
  if (raw.includes('T')) return raw.split('T')[0];
  if (raw.includes(' ')) return raw.split(' ')[0];
  if (raw.includes('.')) {
    const parts = raw.split('.');
    if (parts.length === 3) {
      return parts[0].length === 4
        ? `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
        : `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return raw.slice(0, 10);
}

function normalizeTime(value) {
  if (!value) return '—';
  const parts = String(value).split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return String(value);
}

function matchesDoctor(appt, doctor) {
  if (!doctor) return true;
  const byId = appt.doctor_id != null && String(appt.doctor_id) === String(doctor.id);
  const doctorName = (doctor.name || doctor.full_name || '').trim().toLowerCase();
  const byName = doctorName && (appt.doctor_name || '').trim().toLowerCase() === doctorName;
  return byId || byName;
}

/**
 * Bugungi chairside navbat — today's appointments for chairside workflow.
 * Navigation/UI only; reuses existing Appointment + Patient APIs.
 */
export default function ChairsideToday() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, isDoctor, isAdmin } = useAuth();
  const today = getTashkentDate();
  const [doctorFilter, setDoctorFilter] = useRestorableState('doctorFilter', 'all');
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  const {
    data: appointments = [],
    isLoading: loadingAppts,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: [...QUERY_KEYS.appointments, 'chairside-today', today, user?.id],
    queryFn: () => base44.entities.Appointment.list('-date', 500),
    enabled: !!user,
    staleTime: 30_000,
  });

  const { data: patients = [], isLoading: loadingPatients } = useQuery({
    queryKey: [...QUERY_KEYS.patients, 'chairside-debt-map'],
    queryFn: () => base44.entities.Patient.list('-created_date', 500),
    enabled: !!user,
    staleTime: 60_000,
  });

  const { data: doctors = [] } = useQuery({
    queryKey: QUERY_KEYS.doctors,
    queryFn: async () => {
      const users = await base44.entities.User.list('name', 50);
      return (users || []).filter((u) => u.role === 'doctor' || u.role === 'admin');
    },
    enabled: !!isAdmin,
    staleTime: 5 * 60_000,
  });

  const patientById = useMemo(() => {
    const map = new Map();
    for (const p of patients) {
      if (p?.id != null) map.set(String(p.id), p);
    }
    return map;
  }, [patients]);

  const todayQueue = useMemo(() => {
    let list = (appointments || []).filter((a) => normalizeDate(a.date) === today);

    if (isDoctor && user) {
      list = list.filter((a) => matchesDoctor(a, user));
    } else if (isAdmin && doctorFilter !== 'all') {
      const doc = doctors.find((d) => String(d.id) === String(doctorFilter));
      list = list.filter((a) => matchesDoctor(a, doc || { id: doctorFilter }));
    }

    return list
      .map((a) => {
        const patient = a.patient_id != null ? patientById.get(String(a.patient_id)) : null;
        const debt = Number(patient?.total_debt) || 0;
        return {
          ...a,
          _patientName:
            a.patient_name ||
            patient?.full_name ||
            patient?.name ||
            t('chairside.unknownPatient'),
          _phone: a.patient_phone || patient?.phone || '',
          _debt: debt,
          _time: normalizeTime(a.time),
        };
      })
      .sort((a, b) => String(a._time).localeCompare(String(b._time)));
  }, [appointments, today, isDoctor, isAdmin, user, doctorFilter, doctors, patientById, t]);

  const loading = loadingAppts || loadingPatients;

  const statusKey = (st) => {
    const v = String(st || '').toLowerCase();
    if (['completed', 'done', 'bajarildi', 'finished'].includes(v)) return 'done';
    if (['cancelled', 'canceled', 'no-show', 'noshow', 'no_show', 'bekor'].includes(v)) return 'cancelled';
    return 'waiting';
  };
  const stats = useMemo(() => {
    const out = { total: todayQueue.length, done: 0, waiting: 0, cancelled: 0 };
    for (const a of todayQueue) out[statusKey(a.status)] += 1;
    return out;
  }, [todayQueue]);
  const visibleQueue = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return todayQueue;
    return todayQueue.filter((a) => `${a._patientName} ${a._phone} ${a.doctor_name || ''} ${a.service_name || ''}`.toLowerCase().includes(q));
  }, [todayQueue, query]);
  const fmtPhone = (ph) => {
    const d = String(ph || '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('998')) return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
    if (d.length === 9) return `+998 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
    return ph;
  };

  const openPatient = (appt) => {
    if (!appt.patient_id) return;
    navigate(`/patients/${appt.patient_id}`, { state: profileState() });
  };

  const startVisit = (appt) => {
    if (!appt.patient_id) return;
    if (window.matchMedia('(max-width: 768px)').matches) navigate(`/visit/${appt.id}`);
    else openPatient(appt);
  };

  const formatTodayLabel = () => {
    try {
      return formatClinicDateWithWeekday(today, 'uz');
    } catch {
      return today;
    }
  };

  return (
    <div className="space-y-4 pb-8 lg:space-y-2.5 lg:pb-1 max-w-3xl lg:max-w-5xl mx-auto w-full px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 lg:gap-2">
        <div className="flex items-start lg:items-center gap-3 lg:gap-2.5 min-w-0">
          <div className="w-11 h-11 max-md:w-14 max-md:h-14 lg:w-9 lg:h-9 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
            <CalendarClock className="w-5 h-5 max-md:w-7 max-md:h-7 lg:w-4 lg:h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl max-md:text-[22px] sm:text-2xl lg:text-lg lg:leading-tight font-black text-slate-900 tracking-tight truncate">
              {t('navigation.chairsideToday')}
            </h1>
            <p className="text-xs max-md:text-[13px] lg:text-[11px] font-bold text-teal-700/80 mt-1 lg:mt-0.5 capitalize truncate">
              {formatTodayLabel()}
              <span className="text-slate-400 font-black mx-1.5">·</span>
              <span className="text-slate-500">
                {todayQueue.length} {t('chairside.countLabel')}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap max-md:flex-nowrap">
          {isAdmin && (
            <div className="relative max-md:flex-1 max-md:min-w-0">
            <Users className="md:hidden absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-500 pointer-events-none" />
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="h-10 max-md:h-12 max-md:w-full max-md:pl-10 max-md:text-[14px] lg:h-8 rounded-xl border border-slate-200 bg-white px-3 lg:px-2.5 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              aria-label={t('chairside.doctorFilter')}
            >
              <option value="all">{t('chairside.allDoctors')}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.full_name || d.email}
                </option>
              ))}
            </select>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-10 max-md:h-12 max-md:px-4 max-md:text-[14px] lg:h-8 rounded-xl font-bold gap-2 lg:px-3"
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
          <button
            type="button"
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setQuery(''); }}
            className="md:hidden h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-white inline-flex items-center justify-center text-slate-700 shadow-sm"
            aria-label={t('common.search') || 'Qidirish'}
          >
            <Search className="w-5 h-5" />
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="md:hidden relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Bemor, telefon yoki shifokor..."
            className="w-full h-12 rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-[14px] focus:outline-none focus:ring-2 focus:ring-teal-500/30"
          />
        </div>
      )}

      <div className="md:hidden grid grid-cols-4 gap-2">
        {[
          { k: 'total', label: 'Bugungi navbat', Icon: Users, box: 'bg-emerald-50/70 border-emerald-100', ic: 'text-emerald-600' },
          { k: 'done', label: 'Bajarilgan', Icon: CheckCircle2, box: 'bg-emerald-50/40 border-slate-100', ic: 'text-emerald-500' },
          { k: 'waiting', label: 'Kutilmoqda', Icon: Loader, box: 'bg-blue-50/70 border-blue-100', ic: 'text-blue-600' },
          { k: 'cancelled', label: 'Bekor qilingan', Icon: XCircle, box: 'bg-rose-50/70 border-rose-100', ic: 'text-rose-500' },
        ].map(({ k, label, Icon, box, ic }) => (
          <div key={k} className={cn('rounded-2xl border p-2.5 min-h-[92px] flex flex-col', box)}>
            <Icon className={cn('w-5 h-5', ic)} />
            <span className="mt-1.5 text-[20px] font-black text-slate-900 leading-none tabular-nums">{stats[k]}</span>
            <span className="mt-1 text-[11px] leading-tight font-semibold text-slate-500">{label}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 lg:h-[72px] bg-white border border-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : visibleQueue.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          variant="emerald"
          title={t('chairside.emptyTitle')}
          description={isDoctor ? t('chairside.emptyDoctor') : t('chairside.emptyAdmin')}
          actionText={t('chairside.goAppointments')}
          onAction={() => navigate('/appointments')}
        />
      ) : (
        <div className="space-y-2.5 lg:space-y-0 lg:grid lg:grid-cols-2 lg:gap-2 lg:items-start">
          {visibleQueue.map((appt) => (
            <button
              key={appt.id}
              type="button"
              onClick={() => startVisit(appt)}
              disabled={!appt.patient_id}
              className={cn(
                'w-full text-left bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 lg:p-2.5 shadow-sm',
                'hover:border-teal-200 hover:shadow-md hover:shadow-teal-500/5 transition-all',
                'active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
                !appt.patient_id && 'opacity-70 cursor-not-allowed'
              )}
            >
              <div className="flex items-start gap-3 lg:gap-2.5">
                <div className="w-12 lg:w-11 shrink-0 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center py-2 lg:py-1.5 shadow-md">
                  <Clock className="w-3.5 h-3.5 text-teal-300 mb-0.5" />
                  <span className="text-sm font-black tabular-nums leading-none">{appt._time}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm sm:text-[15px] font-black text-slate-900 truncate flex items-center gap-1.5">
                        <UserRound className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {appt._patientName}
                      </p>
                      {appt._phone ? (
                        <p className="text-[11px] font-bold text-slate-500 mt-1 lg:mt-0.5 flex items-center gap-1.5 truncate">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span className="md:hidden text-[13px]">{fmtPhone(appt._phone)}</span>
                          <span className="max-md:hidden">{appt._phone}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 lg:gap-1 shrink-0">
                      <StatusBadge status={appt.status || 'Scheduled'} size="sm" />
                      {appt._debt > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black">
                          <AlertCircle className="w-3 h-3" />
                          {t('chairside.debt')}: {formatCurrency(appt._debt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="max-md:hidden mt-2.5 lg:mt-1.5 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 truncate">
                      <Stethoscope className="w-3 h-3 shrink-0" />
                      {appt.doctor_name || t('chairside.doctor')}
                      {appt.service_name ? ` · ${appt.service_name}` : ''}
                    </p>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-black text-teal-700 shrink-0">
                      {t('chairside.openProfile')}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="md:hidden mt-3 pt-3 border-t border-slate-100 flex items-center gap-3 text-[13px] text-slate-500 min-h-[28px]">
                <span className="flex items-center gap-1.5 min-w-0 uppercase font-semibold truncate">
                  <UserRound className="w-4 h-4 shrink-0" />
                  {appt.doctor_name || t('chairside.doctor')}
                </span>
                {appt.service_name ? (
                  <span className="flex items-center gap-1.5 min-w-0 truncate border-l border-slate-200 pl-3">
                    <Smile className="w-4 h-4 shrink-0" />
                    {appt.service_name}
                  </span>
                ) : null}
                <span className="ml-auto inline-flex items-center gap-1 h-11 px-3 rounded-xl bg-emerald-600 text-white text-[14px] font-bold shrink-0">
                  <Play className="w-4 h-4 fill-current" />
                  Boshlash
                </span>
              </div>
            </button>
          ))}
          <div className="md:hidden flex flex-col items-center text-center pt-16 pb-6">
            <div className="relative w-20 h-20 rounded-3xl bg-white shadow-lg shadow-slate-200/60 flex items-center justify-center">
              <CalendarDays className="w-9 h-9 text-blue-600" />
              <span className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center"><Plus className="w-4 h-4" /></span>
            </div>
            <p className="mt-5 text-[15px] font-black text-slate-900">Bugun boshqa uchrashuvlar yo'q</p>
            <p className="mt-1 text-[13px] text-slate-500">Tanlangan sana va filtr bo'yicha uchrashuvlar topilmadi.</p>
          </div>
        </div>
      )}
    </div>
  );
}

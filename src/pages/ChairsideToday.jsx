import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  CalendarClock,
  Phone,
  Clock,
  ChevronRight,
  RefreshCw,
  UserRound,
  Stethoscope,
  AlertCircle,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/LanguageContext';
import { getTashkentDate } from '@/lib/telegramReminderService';
import { formatCurrency, cn } from '@/lib/utils';
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
  const [doctorFilter, setDoctorFilter] = useState('all');

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

  const openPatient = (appt) => {
    if (!appt.patient_id) return;
    navigate(`/patients/${appt.patient_id}`);
  };

  const formatTodayLabel = () => {
    try {
      const [y, m, d] = today.split('-').map(Number);
      const date = new Date(y, m - 1, d);
      return date.toLocaleDateString('uz-UZ', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return today;
    }
  };

  return (
    <div className="space-y-4 pb-8 max-w-3xl mx-auto w-full px-1 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white flex items-center justify-center shadow-lg shadow-teal-500/20 shrink-0">
            <CalendarClock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
              {t('navigation.chairsideToday')}
            </h1>
            <p className="text-xs font-bold text-teal-700/80 mt-1 capitalize truncate">
              {formatTodayLabel()}
              <span className="text-slate-400 font-black mx-1.5">·</span>
              <span className="text-slate-500">
                {todayQueue.length} {t('chairside.countLabel')}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              aria-label={t('chairside.doctorFilter')}
            >
              <option value="all">{t('chairside.allDoctors')}</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name || d.full_name || d.email}
                </option>
              ))}
            </select>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="h-10 rounded-xl font-bold gap-2"
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-100 rounded-2xl" />
          ))}
        </div>
      ) : todayQueue.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          variant="emerald"
          title={t('chairside.emptyTitle')}
          description={isDoctor ? t('chairside.emptyDoctor') : t('chairside.emptyAdmin')}
          actionText={t('chairside.goAppointments')}
          onAction={() => navigate('/appointments')}
        />
      ) : (
        <div className="space-y-2.5">
          {todayQueue.map((appt) => (
            <button
              key={appt.id}
              type="button"
              onClick={() => openPatient(appt)}
              disabled={!appt.patient_id}
              className={cn(
                'w-full text-left bg-white border border-slate-100 rounded-2xl p-3.5 sm:p-4 shadow-sm',
                'hover:border-teal-200 hover:shadow-md hover:shadow-teal-500/5 transition-all',
                'active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40',
                !appt.patient_id && 'opacity-70 cursor-not-allowed'
              )}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 shrink-0 rounded-xl bg-slate-900 text-white flex flex-col items-center justify-center py-2 shadow-md">
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
                        <p className="text-[11px] font-bold text-slate-500 mt-1 flex items-center gap-1.5 truncate">
                          <Phone className="w-3 h-3 shrink-0" />
                          {appt._phone}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <StatusBadge status={appt.status || 'Scheduled'} size="sm" />
                      {appt._debt > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-black">
                          <AlertCircle className="w-3 h-3" />
                          {t('chairside.debt')}: {formatCurrency(appt._debt)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between gap-2">
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
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

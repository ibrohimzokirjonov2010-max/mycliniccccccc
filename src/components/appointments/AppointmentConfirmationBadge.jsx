import { useTranslation } from '@/i18n/LanguageContext';

const STATUS_STYLES = {
  confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  declined: 'bg-rose-50 text-rose-700 border-rose-200',
  no_response: 'bg-amber-50 text-amber-700 border-amber-200',
  pending: 'bg-slate-50 text-slate-600 border-slate-200',
  unknown: 'bg-slate-50 text-slate-400 border-slate-200',
};

export const getAppointmentConfirmationState = (appointment = {}) => {
  const rawStatus = String(appointment.confirmation_status || '').trim().toLowerCase();

  if (rawStatus === 'confirmed') return 'confirmed';
  if (rawStatus === 'declined') return 'declined';
  if (rawStatus === 'no_response') return 'no_response';
  if (rawStatus === 'pending') return 'pending';

  return 'unknown';
};

export default function AppointmentConfirmationBadge({ appointment, size = 'md', className = '' }) {
  const { t } = useTranslation();
  const state = getAppointmentConfirmationState(appointment);
  const styles = STATUS_STYLES[state] || STATUS_STYLES.unknown;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[9px] font-black uppercase tracking-wider',
    md: 'px-2.5 py-1 text-[10px] font-black uppercase tracking-wider',
  };

  const labelMap = {
    confirmed: t('appointments.confirmationLabels.confirmed'),
    declined: t('appointments.confirmationLabels.declined'),
    no_response: t('appointments.confirmationLabels.noResponse'),
    pending: t('appointments.confirmationLabels.pending'),
    unknown: '—',
  };

  return (
    <span
      className={`inline-flex items-center rounded-xl border ${styles} ${sizeClasses[size] || sizeClasses.md} ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-40 mr-1.5" />
      {labelMap[state] || labelMap.unknown}
    </span>
  );
}

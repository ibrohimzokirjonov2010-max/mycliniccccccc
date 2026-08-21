import { useMemo, memo } from 'react';
import StatusBadge from '../ui/StatusBadge';
import EmptyState from '../ui/EmptyState';
import AppointmentConfirmationBadge from '../appointments/AppointmentConfirmationBadge';
import { CalendarDays } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * PatientAppointments Component
 * 
 * Displays a table of patient appointments with status badges.
 * 
 * @param {Object} props
 * @param {Array} props.appointments - Array of appointment objects
 * @param {string} props.appointments[].id - Appointment ID
 * @param {string} props.appointments[].date - Appointment date
 * @param {string} props.appointments[].time - Appointment time
 * @param {string} props.appointments[].service_name - Service name
 * @param {string} props.appointments[].status - Appointment status
 */
function PatientAppointments({ appointments = [] }) {
  const { t } = useTranslation();
  
  // Sort appointments by date (newest first)
  const sortedAppointments = useMemo(() => {
    return [...appointments].sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.time}`);
      const dateB = new Date(`${b.date} ${b.time}`);
      return dateB - dateA;
    });
  }, [appointments]);

  // Empty state
  if (!appointments.length) {
    return (
      <EmptyState 
        icon={CalendarDays} 
        title="Uchrashuvlar yo'q" 
        description="Bu bemor uchun hali uchrashuvlar mavjud emas"
      />
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                Sana
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                Vaqt
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3 hidden sm:table-cell">
                Xizmat
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                Status
              </th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">
                {t('appointments.confirmation')}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAppointments.map((appointment) => {
              const dateParts = appointment.date ? appointment.date.split('T')[0].split('-') : [];
              const d = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : appointment.date;
              return (
                <tr 
                  key={appointment.id} 
                  className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors"
                >
                  <td className="px-5 py-4">
                    <p className="text-sm font-bold text-slate-700">{d}</p>
                    <p className="text-[10px] font-black text-slate-400 mt-1 sm:hidden truncate">
                      {appointment.tooth_number ? `${appointment.tooth_number}-tish: ` : ''}{appointment.service_name}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm font-black text-blue-600 tracking-tighter">
                    {appointment.time}
                  </td>
                  <td className="px-5 py-4 text-sm hidden sm:table-cell font-bold text-slate-600">
                    {appointment.tooth_number ? `${appointment.tooth_number}-tish: ` : ''}{appointment.service_name || '—'}
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <StatusBadge status={appointment.status} />
                  </td>
                  <td className="px-5 py-4 text-sm">
                    <AppointmentConfirmationBadge appointment={appointment} size="sm" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Summary footer */}
      <div className="px-5 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
        Jami: {appointments.length} ta uchrashuv
      </div>
    </div>
  );
}

export default memo(PatientAppointments);

import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';

/**
 * Prefetcher Utility
 * Starts loading data before the user even clicks the link
 * Fires on onMouseEnter (desktop) and onFocus/onClick (mobile)
 */
export const prefetchModuleData = (path) => {
  const clinicId = localStorage.getItem('current_clinic_id');
  if (!clinicId) return;

  switch (path) {
    case '/patients':
      queryClientInstance.prefetchQuery({
        queryKey: ['patients', '', 0],
        queryFn: () => base44.entities.Patient.list('-created_date', 50, 0),
        staleTime: 60000
      });
      break;
    case '/payments':
      // Pre-warm RequestCache so Payments.jsx load() resolves instantly
      base44.entities.Payment.list('-date', 50, 0);
      break;
    case '/leads':
      queryClientInstance.prefetchQuery({
        queryKey: ['leads', ''],
        queryFn: () => base44.entities.Lead.list('-created_date', 100),
        staleTime: 60000
      });
      break;
    case '/appointments':
      base44.entities.Appointment.list('-date', 50);
      base44.entities.Patient.list('full_name', 50);
      base44.entities.Service.filter({ is_active: true }, 'name', 100);
      base44.entities.User.list('name', 50);
      break;
    case '/treatment-plans':
      base44.entities.TreatmentPlan.list('-created_date', 50);
      base44.entities.Patient.list('full_name', 50);
      base44.entities.Service.list('name', 100);
      break;
    case '/debts':
      base44.entities.Patient.list('full_name', 100);
      base44.entities.Payment.list('-date', 200);
      break;
    case '/marketing':
      // Pre-warm clinic leads data — Marketing.jsx fetches directly from Supabase,
      // but we can pre-warm patient + service caches it later uses
      base44.entities.Lead.list('-created_date', 100);
      break;
    case '/reports':
      base44.entities.Patient.list('full_name', 50);
      base44.entities.Payment.list('-date', 100);
      base44.entities.Appointment.list('-date', 50);
      break;
    case '/services':
      base44.entities.Service.list('name', 100);
      break;
    case '/treatment-tracking':
      base44.entities.TreatmentPlan.list('-created_date', 100);
      base44.entities.Patient.list('full_name', 50);
      break;
    default:
      break;
  }
};

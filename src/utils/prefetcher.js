import { queryClientInstance } from '@/lib/query-client';
import { base44 } from '@/api/base44Client';

/**
 * Prefetcher Utility
 * Starts loading data before the user even clicks the link
 */
export const prefetchModuleData = (path) => {
  const clinicId = localStorage.getItem('current_clinic_id');
  if (!clinicId) return;

  switch (path) {
    case '/patients':
      queryClientInstance.prefetchQuery({
        queryKey: ['patients', '', 0], // Matches Patients.jsx queryKey
        queryFn: () => base44.entities.Patient.list('-created_date', 50, 0),
        staleTime: 60000
      });
      break;
    case '/payments':
      // Payments.jsx uses manual loading but relies on RequestCache.
      // Pre-fetching here stores the resolved promise in RequestCache so that
      // Payments.jsx load() resolves instantly (0s).
      base44.entities.Payment.list('-created_date', 50, 0); // Matches Payments.jsx list parameters
      break;
    case '/leads':
      queryClientInstance.prefetchQuery({
        queryKey: ['leads', ''], // Matches Leads.jsx queryKey
        queryFn: () => base44.entities.Lead.list('-created_date', 100), // Matches Leads.jsx limit
        staleTime: 60000
      });
      break;
    case '/appointments':
      // Prefetches the 4 parallel requests made by Appointments.jsx load()
      // so they resolve instantly from RequestCache on mount.
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
      base44.entities.Patient.list('-created_date', 200);
      base44.entities.Payment.list('-created_date', 500);
      break;
    default:
      break;
  }
};

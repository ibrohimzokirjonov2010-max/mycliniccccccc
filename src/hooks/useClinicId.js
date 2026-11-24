import { useEffect, useState } from 'react';

/** Clinic id for query keys. Updates when login or a clinic switch writes localStorage. */
export function useClinicId() {
  const read = () => {
    try {
      return localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || '';
    } catch {
      return '';
    }
  };
  const [clinicId, setClinicId] = useState(read);
  useEffect(() => {
    const sync = () => setClinicId(read());
    sync();
    window.addEventListener('crm-context-updated', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('crm-context-updated', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return clinicId;
}

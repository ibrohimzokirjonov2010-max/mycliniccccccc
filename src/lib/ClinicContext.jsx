/**
 * ClinicContext — Klinika Ma'lumotlari uchun Yagona Global Manba
 *
 * Ushbu context bir marta base44.clinic.getCurrentClinic() ni chaqiradi
 * va natijani barcha komponentlarga useClinic() hook orqali uzatadi.
 *
 * Bu orqali "DentaCRM" / "My Clinic" / "MY CLINIC" kabi hardcoded
 * qiymatlarga chek qo'yiladi — barcha joy sozlamalardan o'qiydi.
 */
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { CLINIC_SESSION_EVENT } from '@/lib/clinicPlan';
import { normalizeWorkHours } from '@/lib/clinicHours';

const ClinicContext = createContext({
  clinicName: 'ShifoCRM',
  clinicPhone: '',
  clinicAddress: '',
  clinicLogo: null,
  clinicSubtitle: '',
  workStartHour: 8,
  workEndHour: 24,
  chairsCount: 1,
  isLoading: true,
  refresh: () => {},
});

const pickExtras = (clinic) => ({
  workStartHour: normalizeWorkHours(clinic?.calendar_start_hour, clinic?.calendar_end_hour).start,
  workEndHour: normalizeWorkHours(clinic?.calendar_start_hour, clinic?.calendar_end_hour).end,
  chairsCount: Math.max(1, Number.parseInt(clinic?.chairs_count, 10) || 1),
});

/**
 * ClinicProvider — App.jsx ichida AuthProvider + LanguageProvider dan tashqarida ishlatiladi.
 */
export function ClinicProvider({ children }) {
  const [clinicData, setClinicData] = useState({
    clinicName: 'ShifoCRM',
    clinicPhone: '',
    clinicAddress: '',
    clinicLogo: null,
    clinicSubtitle: '',
    isLoading: true,
  });

  const fetchClinic = useCallback(async () => {
    const id = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id');
    if (!id) {
      setClinicData({
        clinicName: 'ShifoCRM',
        clinicPhone: '',
        clinicAddress: '',
        clinicLogo: null,
        clinicSubtitle: '',
        isLoading: false,
      });
      return;
    }
    try {
      const clinic = await base44.clinic.getById(id);
      const stillCurrent = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id');
      if (stillCurrent && stillCurrent !== id) return;
      if (clinic) {
        // localStorage'ga ham saqlaymiz — TreatmentPlanInvoice kabi
        // render-tashqari joylar uchun (PDF, print).
        try {
          localStorage.setItem('clinic_settings', JSON.stringify({
            name: clinic.name || 'ShifoCRM',
            phone: clinic.phone || '',
            address: clinic.address || '',
            logo: clinic.logo || null,
            subtitle: clinic.subtitle || '',
            calendar_start_hour: clinic.calendar_start_hour ?? null,
            calendar_end_hour: clinic.calendar_end_hour ?? null,
            chairs_count: clinic.chairs_count ?? null,
          }));
        } catch { /* localStorage unavailable */ }

        setClinicData({
          clinicName: clinic.name || 'ShifoCRM',
          clinicPhone: clinic.phone || '',
          clinicAddress: clinic.address || '',
          clinicLogo: clinic.logo || null,
          clinicSubtitle: clinic.subtitle || '',
          ...pickExtras(clinic),
          isLoading: false,
        });
      } else {
        setClinicData(prev => ({ ...prev, isLoading: false }));
      }
    } catch (err) {
      console.warn('[ClinicContext] Could not fetch clinic:', err?.message);
      // localStorage fallback
      try {
        const cached = JSON.parse(localStorage.getItem('clinic_settings') || '{}');
        if (cached.name) {
          setClinicData({
            clinicName: cached.name,
            clinicPhone: cached.phone || '',
            clinicAddress: cached.address || '',
            clinicLogo: cached.logo || null,
            clinicSubtitle: cached.subtitle || '',
            ...pickExtras(cached),
            isLoading: false,
          });
          return;
        }
      } catch { /* ignore */ }
      setClinicData(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    fetchClinic();
    const onSession = (event) => {
      const clinic = event.detail?.clinic;
      if (clinic?.id) {
        setClinicData({
          clinicName: clinic.name || 'ShifoCRM',
          clinicPhone: clinic.phone || '',
          clinicAddress: clinic.address || '',
          clinicLogo: clinic.logo || null,
          clinicSubtitle: clinic.subtitle || '',
          ...pickExtras(clinic),
          isLoading: false,
        });
        return;
      }
      fetchClinic();
    };
    window.addEventListener(CLINIC_SESSION_EVENT, onSession);
    return () => window.removeEventListener(CLINIC_SESSION_EVENT, onSession);
  }, [fetchClinic]);

  return (
    <ClinicContext.Provider value={{ ...clinicData, refresh: fetchClinic }}>
      {children}
    </ClinicContext.Provider>
  );
}

/**
 * useClinic — klinika ma'lumotlariga yagona kirish nuqtasi.
 *
 * @example
 * const { clinicName } = useClinic();
 */
export function useClinic() {
  return useContext(ClinicContext);
}

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

const ClinicContext = createContext({
  clinicName: 'ShifoCRM',
  clinicPhone: '',
  clinicAddress: '',
  clinicLogo: null,
  clinicSubtitle: '',
  isLoading: true,
  refresh: () => {},
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
    try {
      const clinic = await base44.clinic.getCurrentClinic();
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
          }));
        } catch { /* localStorage unavailable */ }

        setClinicData({
          clinicName: clinic.name || 'ShifoCRM',
          clinicPhone: clinic.phone || '',
          clinicAddress: clinic.address || '',
          clinicLogo: clinic.logo || null,
          clinicSubtitle: clinic.subtitle || '',
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

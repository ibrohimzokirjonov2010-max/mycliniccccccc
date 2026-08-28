import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

const REMINDER_INTERVAL_MS = 20 * 60 * 1000; // 20 daqiqa

/**
 * ImplantAlerter Component
 * Background worker that checks for incomplete implant records (from new patient wizard or treatments)
 * and sends an alert every 20 minutes reminding the doctor/staff to fill in the technical specs.
 */
export default function ImplantAlerter() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const timerRef = useRef(null);
  const initialTimerRef = useRef(null);

  const checkIncompleteImplants = async () => {
    if (!isAuthenticated || !user) return;

    try {
      const implants = await base44.entities.Implant.list('-created_at', 200).catch(() => []);
      if (!Array.isArray(implants) || implants.length === 0) return;

      const incompleteList = implants.filter(i => 
        i.incomplete_data === true || 
        i.needs_fill === true || 
        (!i.firma && !i.brend && !i.firma_custom)
      );

      if (incompleteList.length > 0) {
        const top = incompleteList[0];
        const toothNum = top.tooth_number || (top.tooth_numbers && top.tooth_numbers[0]) || '';
        const toothText = toothNum ? ` (Tish #${toothNum})` : '';
        const patientName = top.patient_name || 'Bemor';
        const moreCount = incompleteList.length > 1 ? ` va yana ${incompleteList.length - 1} ta` : '';

        toast.warning(`⚠️ Implant ma'lumotlarini kiritish kerak!`, {
          id: 'implant-incomplete-notification',
          description: `${patientName}${toothText}${moreCount} implant ma'lumotlari kiritilmagan. Iltimos, implant bo'limiga o'tib jarayonni yakunlang.`,
          action: {
            label: "Implantga o'tish",
            onClick: () => navigate('/implants')
          },
          duration: 15000,
        });
      }
    } catch (err) {
      console.error('Failed to check incomplete implants:', err);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    // Dastlabki tekshiruv 10 soniyadan so'ng
    initialTimerRef.current = setTimeout(checkIncompleteImplants, 10000);

    // Har 20 daqiqada eslatma berish
    timerRef.current = setInterval(checkIncompleteImplants, REMINDER_INTERVAL_MS);

    return () => {
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, user]);

  return null;
}

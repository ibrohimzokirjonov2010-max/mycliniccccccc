import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAppointmentCalendarPath } from '@/lib/alertRoutes';

const SESSION_KEY = 'implant-incomplete-toast-shown';

const isBlockingModalOpen = () => {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector('[data-radix-dialog-content], [role="dialog"][data-state="open"]')
  );
};

/**
 * ImplantAlerter Component
 * Background worker that checks for incomplete implant records (from new patient wizard or treatments)
 * and sends an alert every 20 minutes reminding the doctor/staff to fill in the technical specs.
 */
export default function ImplantAlerter() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initialTimerRef = useRef(null);

  const checkIncompleteImplants = async () => {
    if (!isAuthenticated || !user) return;

    try {
      const implants = await base44.entities.Implant.list('-created_date', 200).catch(() => []);
      if (!Array.isArray(implants) || implants.length === 0) return;

      const incompleteList = implants.filter(i => 
        i.incomplete_data === true || 
        i.needs_fill === true || 
        (!i.firma && !i.brend && !i.firma_custom)
      );

      if (incompleteList.length > 0) {
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        if (isBlockingModalOpen() || path.startsWith('/implants') || isAppointmentCalendarPath(path)) return;
        try {
          if (sessionStorage.getItem(SESSION_KEY)) return;
          sessionStorage.setItem(SESSION_KEY, '1');
        } catch {
          /* private mode still shows the toast once for this mount */
        }

        const top = incompleteList[0];
        const toothNum = top.tooth_number || (top.tooth_numbers && top.tooth_numbers[0]) || '';
        const toothText = toothNum ? ` (Tish #${toothNum})` : '';
        const patientName = top.patient_name || 'Bemor';
        const moreCount = incompleteList.length > 1 ? ` va yana ${incompleteList.length - 1} ta` : '';

        toast.warning('Implant ma\'lumotlari to\'liq emas', {
          id: 'implant-incomplete-notification',
          description: `${patientName}${toothText}${moreCount}`,
          action: {
            label: 'Ochish',
            onClick: () => navigate('/implants')
          },
          duration: 3200,
        });
      }
    } catch (err) {
      console.error('Failed to check incomplete implants:', err);
    }
  };

  useEffect(() => {
    if (isAppointmentCalendarPath(location.pathname)) {
      toast.dismiss('implant-incomplete-notification');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    initialTimerRef.current = setTimeout(checkIncompleteImplants, 2500);
    return () => {
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
    };
  }, [isAuthenticated, user]);

  return null;
}

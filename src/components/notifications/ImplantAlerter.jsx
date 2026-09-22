import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isAppointmentCalendarPath } from '@/lib/alertRoutes';

const REMINDER_INTERVAL_MS = 20 * 60 * 1000; // 20 daqiqa
const DISMISS_KEY = 'implant-incomplete-dismissed-at';
const SLOT_ID = 'mobile-implant-banner-slot';

const isBlockingModalOpen = () => {
  if (typeof document === 'undefined') return false;
  return Boolean(
    document.querySelector('[data-radix-dialog-content], [role="dialog"][data-state="open"]')
  );
};

const wasDismissedRecently = () => {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < REMINDER_INTERVAL_MS;
  } catch {
    return false;
  }
};

function shouldHideOnPath(pathname) {
  const path = String(pathname || '');
  return path.startsWith('/implants') || isAppointmentCalendarPath(path);
}

/**
 * Compact in-flow reminder. Renders into #mobile-implant-banner-slot when the
 * phone shell is mounted so it never covers patient cards, the odontogram, or
 * payment rows. Desktop falls back to a small top-end chip.
 */
function IncompleteImplantBanner({ notice, onOpen, onDismiss }) {
  return (
    <div
      className="implant-incomplete-banner mb-2 flex items-center gap-1 rounded-2xl border border-amber-200 bg-amber-50 px-2 py-1 shadow-sm"
      role="status"
      data-testid="implant-incomplete-banner"
      style={notice.safeTop ? { paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' } : undefined}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
      <div className="min-w-0 flex-1 py-1">
        <p className="text-[13px] font-bold leading-tight text-amber-950">
          Implant ma&apos;lumotlarini kiritish kerak!
        </p>
        <p className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-snug text-amber-900/85">
          {notice.detail}
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 px-2.5 text-center text-[11px] font-bold leading-tight text-white"
      >
        Implantga o&apos;tish
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Yopish"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-amber-950 active:bg-amber-100"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}

/**
 * ImplantAlerter Component
 * Background worker that checks for incomplete implant records (from new patient wizard or treatments)
 * and reminds the doctor/staff to fill in the technical specs.
 * The reminder is an inline banner, not a blocking toast.
 */
export default function ImplantAlerter() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const timerRef = useRef(null);
  const initialTimerRef = useRef(null);
  const [notice, setNotice] = useState(null);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode */
    }
    setNotice(null);
    toast.dismiss('implant-incomplete-notification');
  };

  const checkIncompleteImplants = async () => {
    if (!isAuthenticated || !user) return;
    if (wasDismissedRecently()) return;

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
        if (isBlockingModalOpen() || shouldHideOnPath(path)) return;

        const top = incompleteList[0];
        const toothNum = top.tooth_number || (top.tooth_numbers && top.tooth_numbers[0]) || '';
        const toothText = toothNum ? ` (Tish #${toothNum})` : '';
        const patientName = top.patient_name || 'Bemor';
        const moreCount = incompleteList.length > 1 ? ` va yana ${incompleteList.length - 1} ta` : '';

        toast.dismiss('implant-incomplete-notification');
        setNotice({
          detail: `${patientName}${toothText}${moreCount} implant ma'lumotlari kiritilmagan. Iltimos, implant bo'limiga o'tib jarayonni yakunlang.`,
        });
      }
    } catch (err) {
      console.error('Failed to check incomplete implants:', err);
    }
  };

  useEffect(() => {
    if (shouldHideOnPath(location.pathname)) {
      setNotice(null);
      toast.dismiss('implant-incomplete-notification');
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!isAuthenticated) return;

    initialTimerRef.current = setTimeout(checkIncompleteImplants, 10000);
    timerRef.current = setInterval(checkIncompleteImplants, REMINDER_INTERVAL_MS);

    return () => {
      if (initialTimerRef.current) clearTimeout(initialTimerRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAuthenticated, user]);

  if (!notice) return null;

  const slot = typeof document !== 'undefined' ? document.getElementById(SLOT_ID) : null;
  const banner = (
    <IncompleteImplantBanner
      notice={{ ...notice, safeTop: slot?.dataset.safe === 'top' }}
      onOpen={() => {
        setNotice(null);
        navigate('/implants');
      }}
      onDismiss={dismiss}
    />
  );

  if (slot) return createPortal(banner, slot);

  if (typeof document !== 'undefined' && window.innerWidth >= 1024) {
    return createPortal(
      <div className="pointer-events-none fixed right-4 top-4 z-[45] w-[min(420px,calc(100vw-2rem))]">
        <div className="pointer-events-auto">{banner}</div>
      </div>,
      document.body
    );
  }

  return null;
}

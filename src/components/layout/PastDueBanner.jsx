import { AlertTriangle } from 'lucide-react';
import { clinicReadOnly } from '@/lib/clinicExpiry';

/**
 * Sinov tugagach kartadan pul yechilmasa, klinika ochiq qoladi, lekin faqat o'qish.
 * Banner har doim ko'rinadi (yopib bo'lmaydi).
 */
export default function PastDueBanner({ clinic }) {
  if (!clinicReadOnly(clinic)) return null;
  return (
    <div
      role="status"
      data-testid="past-due-banner"
      className="sticky top-0 z-30 mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold leading-snug text-amber-950 shadow-sm"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <p>
          To'lov amalga oshmadi. Sinov tugagan va kartadan tarif yechilmadi. Hozircha klinika faqat o'qish rejimida — yangi yozuv qo'shib bo'lmaydi.
        </p>
      </div>
    </div>
  );
}

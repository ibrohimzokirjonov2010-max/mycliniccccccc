import { ArrowLeft } from 'lucide-react';
import { useBack } from '@/hooks/useBack';
import { useTranslation } from '@/i18n/LanguageContext';
import { cn } from '@/lib/utils';

const LABELS = { uz: 'Orqaga', ru: 'Назад', en: 'Back' };

/**
 * Yaxlit "← Orqaga" tugmasi. history bo'lsa navigate(-1) (filtr/qidiruv/tab/scroll saqlanadi),
 * aks holda `fallback` ro'yxat sahifasiga olib boradi.
 * onBack berilsa — undan oldin chaqiriladi (masalan, formani tozalash); false qaytarsa navigatsiya bekor.
 */
export default function BackButton({ fallback = '/', label, onBack, className, iconOnly = false, ...rest }) {
  const goBack = useBack(fallback);
  let language = 'uz';
  try {
    language = useTranslation()?.language || 'uz';
  } catch { /* provider yo'q */ }
  const text = label || LABELS[language] || LABELS.uz;

  return (
    <button
      type="button"
      onClick={() => {
        if (onBack && onBack() === false) return;
        goBack();
      }}
      aria-label={text}
      title={text}
      data-back-button
      className={cn(
        'inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 bg-white text-slate-700',
        'text-[13px] font-bold shadow-sm hover:bg-slate-50 hover:text-slate-900 active:scale-95 transition-all select-none shrink-0',
        className
      )}
      {...rest}
    >
      <ArrowLeft className="w-4 h-4" />
      {!iconOnly && <span>{text}</span>}
    </button>
  );
}

export { BackButton };

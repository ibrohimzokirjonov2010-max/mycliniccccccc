import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Search, User, CheckCircle2 } from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function PatientSelect({ 
  patients = [], 
  value, 
  initialName = '',
  onChange, 
  onAddPatient, 
  error,
  loading = false,
  inputClassName = "",
  buttonClassName = "bg-emerald-500 hover:bg-emerald-600 px-3 w-10 shadow-sm"
}) {
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [search, setSearch] = useState(initialName || '');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const selectingRef = useRef(false);
  const blurTimerRef = useRef(null);

  const availablePatients = useMemo(() => {
    if (isDoctor && user?.id) {
      return (patients || []).filter(p =>
        String(p.main_treatment_provider) === String(user.id) ||
        String(p.main_treatment_provider) === String(user.name) ||
        String(p.created_by_id) === String(user.id)
      );
    }
    return patients || [];
  }, [patients, isDoctor, user]);

  const findPatient = useCallback((id) => {
    if (id == null || id === '') return null;
    const sid = String(id);
    return (
      availablePatients.find(p => String(p.id) === sid) ||
      (patients || []).find(p => String(p.id) === sid) ||
      null
    );
  }, [availablePatients, patients]);

  // Sync search text when value changes from outside (avoid fighting mid-selection)
  useEffect(() => {
    if (selectingRef.current) return;
    if (value) {
      const p = findPatient(value);
      if (p) setSearch(p.full_name || '');
      else if (initialName) setSearch(initialName);
    } else if (!open) {
      setSearch(initialName || '');
    }
  }, [value, findPatient, initialName, open]);

  useEffect(() => {
    return () => {
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const filtered = search.trim()
    ? availablePatients.filter(p =>
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search)
      )
    : availablePatients;

  const displayList = filtered.slice(0, 50);
  const isLoading = loading || (open && availablePatients.length === 0 && patients.length === 0);

  const selectPatient = useCallback((patient) => {
    if (!patient) return;
    selectingRef.current = true;
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }
    setSearch(patient.full_name || '');
    setOpen(false);
    onChange?.(patient.id, patient);
    // Allow parent state to settle before re-enabling controlled sync
    requestAnimationFrame(() => {
      selectingRef.current = false;
    });
  }, [onChange]);

  return (
    <div className="flex gap-2 relative z-[100] w-full" ref={wrapperRef}>
      <div className="relative flex-1">
        <div className="relative">
          <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none transition-colors", value ? "text-emerald-600" : "text-slate-400")} />
          <Input 
            placeholder={t('patientSelect.placeholder') || "Ism yoki telefon orqali qidiring..."} 
            value={search}
            onChange={(e) => {
              const next = e.target.value;
              setSearch(next);
              setOpen(true);
              if (value) onChange?.('', null); // clear selected ID if user types
            }}
            onFocus={() => {
              if (blurTimerRef.current) {
                clearTimeout(blurTimerRef.current);
                blurTimerRef.current = null;
              }
              setOpen(true);
            }}
            onBlur={() => {
              // Delay close so suggestion pointer/mouse handlers can run first
              blurTimerRef.current = setTimeout(() => {
                if (!selectingRef.current) setOpen(false);
              }, 250);
            }}
            className={cn(
              "w-full transition-all duration-200 pl-9 pr-8 text-sm",
              value 
                ? "font-extrabold text-slate-900 bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/30" 
                : "font-medium text-slate-700 bg-slate-50 border-slate-200 placeholder:text-slate-400 placeholder:font-normal focus:bg-white focus:border-[#1499AD] focus:ring-1 focus:ring-[#1499AD]",
              inputClassName,
              error && "border-rose-500 ring-rose-200"
            )}
            autoComplete="off"
          />
          {isLoading ? (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
          ) : value ? (
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearch('');
                  onChange?.('', null);
                  setOpen(true);
                }}
                title="Bemor tanlovini bekor qilish"
                className="w-4 h-4 rounded-full hover:bg-slate-200/80 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs transition-colors cursor-pointer border-none bg-transparent"
              >
                ✕
              </button>
            </div>
          ) : search ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.preventDefault();
                setSearch('');
                onChange?.('', null);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs transition-colors cursor-pointer border-none bg-transparent"
            >
              ✕
            </button>
          ) : null}
        </div>
        
        {open && (
           <div 
             style={{ backgroundColor: '#ffffff', zIndex: 9999 }}
             className="absolute top-full left-0 right-0 mt-1.5 border border-slate-200 bg-white rounded-xl shadow-2xl max-h-[260px] overflow-y-auto no-scrollbar py-2"
             onMouseDown={(e) => {
               // Keep input from blurring before item handlers run
               e.preventDefault();
             }}
           >
             {isLoading ? (
               <div className="px-4 py-6 text-sm font-medium text-slate-400 text-center flex flex-col gap-2 items-center">
                 <Loader2 className="w-5 h-5 animate-spin text-[#1499AD]" />
                 <span>Bemorlar yuklanmoqda...</span>
               </div>
             ) : displayList.length > 0 ? displayList.map(p => (
                <div 
                  key={p.id}
                  role="option"
                  aria-selected={String(value) === String(p.id)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectPatient(p);
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    selectPatient(p);
                  }}
                  className="px-4 py-2 hover:bg-emerald-50 cursor-pointer border-b border-slate-50 last:border-b-0 transition-colors flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 overflow-hidden shrink-0 border border-slate-200/50">
                    {(p.photo_url || p.photo) ? (
                      <img src={p.photo_url || p.photo} alt={p.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 truncate">{p.full_name}</span>
                    <span className="text-[11px] font-semibold text-slate-400 font-mono tracking-wider">{p.phone || "Telefon yo'q"}</span>
                  </div>
                </div>
             )) : (
                <div className="px-4 py-8 text-sm font-medium text-slate-400 text-center flex flex-col gap-2 items-center">
                  <span>Bemor topilmadi</span>
                  {onAddPatient && (
                    <button
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); onAddPatient(); setOpen(false); }}
                      onClick={(e) => { e.preventDefault(); onAddPatient(); setOpen(false); }}
                      className="text-xs font-bold text-[#1499AD] hover:underline"
                    >
                      + Yangi bemor qo'shish
                    </button>
                  )}
                </div>
             )}
             {filtered.length > 50 && (
               <div className="px-4 py-2 text-[10px] text-slate-400 text-center border-t border-slate-50">
                 Yana {filtered.length - 50} ta natija mavjud — aniqroq qidiring
               </div>
             )}
           </div>
        )}
      </div>
      
      {onAddPatient && (
        <Button 
          variant="default" 
          type="button"
          onClick={(e) => { e.preventDefault(); onAddPatient(); }}
          title="Yangi bemor qo'shish"
          className={buttonClassName}
        >
          <Plus className="w-5 h-5 text-white" />
        </Button>
      )}
    </div>
  );
}

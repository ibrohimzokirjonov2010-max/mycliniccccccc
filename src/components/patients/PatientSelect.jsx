import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Loader2, Search, User } from 'lucide-react';

export default function PatientSelect({ 
  patients = [], 
  value, 
  initialName = '',
  onChange, 
  onAddPatient, 
  error,
  loading = false,
  inputClassName = "border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500",
  buttonClassName = "bg-emerald-500 hover:bg-emerald-600 px-3 w-10 shadow-sm"
}) {
  const [search, setSearch] = useState(initialName || '');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  // Sync search text when value changes from outside
  useEffect(() => {
    if (value) {
      const p = patients.find(p => p.id === value);
      if (p) setSearch(p.full_name);
      else if (initialName && search === '') setSearch(initialName);
    } else {
      setSearch('');
    }
  }, [value, patients, initialName]);

  // Show all patients when search is blank, filter otherwise
  const filtered = search.trim()
    ? patients.filter(p =>
        p.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        p.phone?.includes(search)
      )
    : patients;

  // Limit to 50 results for performance
  const displayList = filtered.slice(0, 50);
  const isLoading = loading || (open && patients.length === 0);

  return (
    <div className="flex gap-2 relative z-[100] w-full" ref={wrapperRef}>
      <div className="relative flex-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <Input 
            placeholder="Ism yoki telefon orqali qidiring..." 
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
              if (value) onChange(''); // clear selected ID if user types
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className={`w-full font-medium transition-all duration-200 pl-9 ${inputClassName} ${error ? 'border-rose-500 ring-rose-200' : ''}`}
            autoComplete="off"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 animate-spin" />
          )}
        </div>
        
        {open && (
           <div 
             style={{ backgroundColor: '#ffffff', zIndex: 9999 }}
             className="absolute top-full left-0 right-0 mt-1.5 border border-slate-200 rounded-xl shadow-2xl max-h-[260px] overflow-y-auto no-scrollbar py-2"
           >
             {isLoading ? (
               <div className="px-4 py-6 text-sm font-medium text-slate-400 text-center flex flex-col gap-2 items-center">
                 <Loader2 className="w-5 h-5 animate-spin text-[#1499AD]" />
                 <span>Bemorlar yuklanmoqda...</span>
               </div>
             ) : displayList.length > 0 ? displayList.map(p => (
                <div 
                  key={p.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onChange(p.id, p);
                    setSearch(p.full_name);
                    setOpen(false);
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
                      onMouseDown={(e) => { e.preventDefault(); onAddPatient(); setOpen(false); }}
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import ToothPanel from './ToothPanel';
import { Shield, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// FDI Tooth Numbering Groups
const UPPER_JAW = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_JAW = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/**
 * Status Colors & Styles
 */
const TOOTH_STATUS_CONFIG = {
  "Sog'lom":         { fill: '#f8fafc', stroke: '#cbd5e1', label: "Sog'lom", color: 'text-slate-500' },
  "Kariyes":         { fill: '#fee2e2', stroke: '#f87171', label: "Kariyes", color: 'text-rose-500', highlight: '#ef4444' },
  "Plomba":          { fill: '#dbeafe', stroke: '#60a5fa', label: "Plomba", color: 'text-blue-500', highlight: '#3b82f6' },
  "Davolangan":      { fill: '#dcfce7', stroke: '#4ade80', label: "Davolangan", color: 'text-emerald-500' },
  "Olib tashlangan": { fill: 'rgba(241, 245, 249, 0.3)', stroke: '#e2e8f0', label: "Yo'q", color: 'text-slate-400', isRemoved: true },
  "Implant":         { fill: '#f1f5f9', stroke: '#94a3b8', label: "Implant", color: 'text-slate-600', isImplant: true },
};

/**
 * Ultra-realistic anatomical tooth paths
 */
function getAnatomicalPath(num) {
  const isUpper = (num >= 11 && num <= 28);
  const n = num % 10;

  // Molars (8, 7, 6) - Katta oziq tishlar
  if (n >= 6) {
    return {
      type: 'molar',
      crown: isUpper
        ? "M5,10 C3,10 2,12 2,18 C2,25 5,30 10,30 L26,30 C31,30 34,25 34,18 C34,12 33,10 31,10 C29,8 27,8 25,10 C23,8 21,8 18,10 C15,8 13,8 11,10 C9,8 7,8 5,10 Z"
        : "M5,14 C3,14 2,12 2,5 C2,-2 5,-8 10,-8 L26,-8 C31,-8 34,-2 34,5 C34,12 33,14 31,14 C29,16 27,16 25,14 C23,16 21,16 18,14 C15,16 13,16 11,14 C9,16 7,16 5,14 Z",
      fissures: isUpper
        ? "M10,18 Q18,22 26,18 M18,12 L18,24 M12,14 L14,18 M22,18 L24,14"
        : "M10,6 Q18,2 26,6 M18,0 L18,10 M12,10 L14,6 M22,6 L24,10",
      roots: isUpper
        ? [
            "M10,30 Q6,42 6,55 Q6,62 10,62 Q14,62 14,55 Q14,42 16,30", 
            "M18,30 Q18,45 18,58 Q18,65 22,65 Q26,65 26,58 Q26,45 26,30", 
            "M26,30 Q32,42 32,55 Q32,62 36,62 Q40,62 40,55 Q40,42 36,30"
          ]
        : [
            "M10,-8 Q6,-25 6,-42 Q6,-50 10,-50 Q14,-50 14,-42 Q14,-25 16,-8", 
            "M26,-8 Q32,-25 32,-42 Q32,-50 36,-50 Q40,-50 40,-42 Q40,-25 36,-8"
          ]
    };
  }

  // Premolars (5, 4) - Kichik oziq tishlar
  if (n >= 4) {
    return {
      type: 'premolar',
      crown: isUpper
        ? "M8,10 C6,10 5,12 5,18 C5,25 8,30 13,30 L23,30 C28,30 31,25 31,18 C31,12 30,10 28,10 C26,8 24,8 21,10 C18,8 15,8 13,10 Z"
        : "M8,14 C6,14 5,12 5,5 C5,-2 8,-8 13,-8 L23,-8 C28,-8 31,-2 31,5 C31,12 30,14 28,14 C26,16 24,16 21,14 C18,16 15,16 13,14 Z",
      fissures: isUpper ? "M12,18 Q18,21 24,18" : "M12,6 Q18,3 24,6",
      roots: isUpper
        ? ["M15,30 Q12,48 12,62 Q12,70 18,70 Q24,70 24,62 Q24,48 21,30"]
        : ["M15,-8 Q12,-30 12,-45 Q12,-52 18,-52 Q24,-52 24,-45 Q24,-30 21,-8"]
    };
  }

  // Canines (3) - Qoziq tishlar
  if (n === 3) {
    return {
      type: 'canine',
      crown: isUpper
        ? "M18,5 C14,5 10,10 10,18 C10,25 14,30 18,30 C22,30 26,25 26,18 C26,10 22,5 18,5 Z"
        : "M18,19 C14,19 10,14 10,6 C10,-1 14,-7 18,-7 C22,-7 26,-1 26,6 C26,14 22,19 18,19 Z",
      roots: isUpper
        ? ["M18,30 Q14,52 14,75 Q14,82 18,82 Q22,82 22,75 Q22,52 18,30"]
        : ["M18,-7 Q14,-32 14,-55 Q14,-62 18,-62 Q22,-62 22,-55 Q22,-32 18,-7"]
    };
  }

  // Incisors (2, 1) - Kesuvchi tishlar
  return {
    type: 'incisor',
    crown: isUpper
      ? "M9,10 L7,10 L7,20 C7,26 11,30 18,30 C25,30 29,26 29,20 L29,10 L27,10 L9,10 Z"
      : "M9,14 L7,14 L7,4 C7,-2 11,-6 18,-6 C25,-6 29,-2 29,4 L29,14 L27,14 L9,14 Z",
    roots: isUpper
      ? ["M18,30 Q15,48 15,65 Q15,72 18,72 Q21,72 21,65 Q21,48 18,30"]
      : ["M18,-6 Q15,-25 15,-45 Q15,-52 18,-52 Q21,-52 21,-45 Q21,-25 18,-6"]
  };
}

/**
 * Professional Realistic Tooth SVG
 */
function ToothSVG({ number, status, isSelected, isChecked, onToggleCheck, onClick }) {
  const config = TOOTH_STATUS_CONFIG[status] || TOOTH_STATUS_CONFIG["Sog'lom"];
  const paths = getAnatomicalPath(number);
  const isUpper = (number >= 11 && number <= 28);
  
  return (
    <div className={cn(
      "flex flex-col items-center group relative select-none p-2 rounded-2xl transition-all duration-300",
      isSelected ? 'bg-blue-50/50 ring-1 ring-blue-200' : 'hover:bg-slate-50',
      isChecked && 'bg-blue-600/5 ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/10'
    )}>
      {/* Top: Selection & Number */}
      <div 
        className={cn(
          "flex items-center gap-1.5 mb-2 px-2 py-1 rounded-lg transition-all cursor-pointer",
          isChecked ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCheck(number);
        }}
      >
        <div className={cn("w-2 h-2 rounded-full", isChecked ? 'bg-white animate-pulse' : 'bg-slate-300')} />
        <span className="text-[12px] font-black tracking-tight">
          {number}
        </span>
      </div>

      {/* Center: Anatomical SVG */}
      <div 
        className={cn(
          "relative cursor-pointer transition-all duration-500 hover:scale-110 active:scale-95",
          config.isRemoved && 'opacity-20'
        )}
        onClick={() => onClick(number)}
      >
        <svg 
          viewBox="0 -45 40 120" 
          width="48" 
          height="85" 
          className={cn(
            "drop-shadow-xl sm:w-[45px] sm:h-[80px] transition-all",
            isChecked && "drop-shadow-[0_0_8px_rgba(37,99,235,0.4)]"
          )}
        >
          <defs>
            <radialGradient id="grad-healthy-enamel" cx="30%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="50%" stopColor="#fdfcfb" />
              <stop offset="85%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </radialGradient>
            <radialGradient id="grad-caries-enamel" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="40%" stopColor="#fee2e2" />
              <stop offset="100%" stopColor="#ef4444" />
            </radialGradient>
            <linearGradient id="grad-plomba-enamel" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="50%" stopColor="#eff6ff" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="grad-root-organic" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="60%" stopColor="#f1f5f9" />
              <stop offset="100%" stopColor="#e2e8f0" />
            </linearGradient>
            <filter id="toothShadow" x="-20%" y="-20%" width="150%" height="150%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
            </filter>
            <filter id="light3D" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="0.8" />
              <feOffset dx="0.4" dy="0.8" result="offsetblur" />
              <feComponentTransfer><feFuncA type="linear" slope="0.3" /></feComponentTransfer>
              <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <g filter="url(#toothShadow)">
            <g filter="url(#light3D)">
              {!config.isImplant && !config.isRemoved && paths.roots.map((d, i) => (
                <path 
                  key={i} 
                  d={d} 
                  fill={isSelected || isChecked ? '#dbeafe' : "url(#grad-root-organic)"} 
                  stroke={isSelected || isChecked ? '#3b82f6' : "#cbd5e1"} 
                  strokeWidth="0.5" 
                  opacity="0.9"
                />
              ))}

              {/* Implant (Metallic Screw) */}
              {config.isImplant && (
                <g transform={isUpper ? "translate(0, 30)" : "translate(0, -8)"}>
                  <rect x="14" y="0" width="10" height="35" fill="#94a3b8" rx="2" />
                  {[5, 10, 15, 20, 25, 30].map(y => (
                    <path key={y} d={`M14,${y} L24,${y}`} stroke="#475569" strokeWidth="0.5" />
                  ))}
                </g>
              )}

              {/* Crown (Realistic Enamel) */}
              <path 
                d={paths.crown} 
                fill={isSelected || isChecked ? '#2563eb' : (
                  status === 'Kariyes' ? 'url(#grad-caries-enamel)' : 
                  status === 'Plomba' ? 'url(#grad-plomba-enamel)' : 
                  'url(#grad-healthy-enamel)'
                )} 
                stroke={isSelected || isChecked ? '#1d4ed8' : (status === 'Kariyes' ? '#dc2626' : '#cbd5e1')} 
                strokeWidth={isSelected || isChecked ? "1.5" : "0.7"} 
                className="transition-all duration-300"
              />

              {/* Specular Highlight (Reflection) */}
              {!config.isRemoved && !isSelected && !isChecked && (
                <path 
                  d={isUpper ? "M10,15 Q12,12 15,12" : "M10,2 Q12,-1 15,-1"} 
                  fill="none" 
                  stroke="#ffffff" 
                  strokeWidth="1.5" 
                  strokeLinecap="round" 
                  opacity="0.6"
                />
              )}

              {/* Fissures & Grooves */}
              {!config.isRemoved && paths.fissures && (
                <path 
                  d={paths.fissures} 
                  fill="none" 
                  stroke="#334155" 
                  strokeWidth="0.4" 
                  opacity="0.15" 
                  strokeLinecap="round"
                />
              )}

              {/* Condition Highlight */}
              {config.highlight && !config.isRemoved && !isChecked && (
                <circle 
                  cx="18" 
                  cy={isUpper ? "20" : "6"} 
                  r="4.5" 
                  fill={config.highlight} 
                  className="animate-pulse shadow-sm"
                />
              )}

              {/* Removed Cross */}
              {config.isRemoved && (
                <g transform="translate(18, 12) rotate(45)">
                  <rect x="-1" y="-15" width="2" height="30" fill="#94a3b8" />
                  <rect x="-15" y="-1" width="30" height="2" fill="#94a3b8" />
                </g>
              )}
            </g>
          </g>
        </svg>

        {/* Selected Highlight Halo */}
        {(isSelected || isChecked) && (
          <motion.div 
            layoutId="halo-pro"
            className="absolute inset-0 bg-blue-500/10 rounded-full -z-10 blur-2xl"
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
          />
        )}
      </div>

      {/* Status Label (Mini) - Only show if NOT healthy */}
      {status !== "Sog'lom" && (
        <span className={`mt-2 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-white border border-slate-100 shadow-sm ${config.color}`}>
          {config.label}
        </span>
      )}
    </div>
  );
}

export default function DentalChart({ patientId, plans, onToothSelect, initialSelected = [], hideActions = false }) {
  const [toothRecords, setToothRecords] = useState({});
  const [selectedTooth, setSelectedTooth] = useState(null);
  const [checkedTeeth, setCheckedTeeth] = useState(new Set(initialSelected.map(String)));
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('adult');
  const scrollContainerRef = useRef(null);


  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const { scrollLeft, clientWidth } = scrollContainerRef.current;
      const scrollTo = direction === 'left' ? scrollLeft - 300 : scrollLeft + 300;
      scrollContainerRef.current.scrollTo({ left: scrollTo, behavior: 'smooth' });
    }
  };

  const loadToothRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await base44.entities.ToothRecord.filter({ patient_id: patientId }, 'tooth_number', 100);
      const map = {};
      data.forEach(r => { map[r.tooth_number] = r; });
      setToothRecords(map);
    } catch (err) {
      console.error('Failed to load tooth records:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => { loadToothRecords(); }, [loadToothRecords]);

  const getStatus = useCallback((num) => toothRecords[num]?.status || "Sog'lom", [toothRecords]);

  const toggleCheck = (num) => {
    const next = new Set(checkedTeeth);
    if (next.has(num.toString())) {
      next.delete(num.toString());
    } else {
      next.add(num.toString());
    }
    setCheckedTeeth(next);
    if (onToothSelect) {
      onToothSelect(Array.from(next));
    }
  };

  const handleQuickStatusUpdate = async (newStatus) => {
    const teethToUpdate = checkedTeeth.size > 0 ? Array.from(checkedTeeth) : (selectedTooth ? [selectedTooth] : []);
    if (teethToUpdate.length === 0) return;

    try {
      setLoading(true);
      for (const num of teethToUpdate) {
        const existing = toothRecords[num];
        if (existing) {
          await base44.entities.ToothRecord.update(existing.id, { status: newStatus });
        } else {
          await base44.entities.ToothRecord.create({
            patient_id: patientId,
            tooth_number: num,
            status: newStatus,
            notes: `Tezkor yangilash: ${newStatus}`
          });
        }
      }
      await loadToothRecords();
      setCheckedTeeth(new Set());
    } catch (err) {
      console.error('Failed to update tooth status:', err);
    } finally {
      setLoading(false);
    }
  };

  const ToothQuadrant = ({ numbers, label }) => (
    <div className="flex flex-col items-center gap-6 min-w-max px-4">
      {label && (
        <div className="flex items-center gap-2.5 px-5 py-2 bg-white rounded-full border border-slate-200 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[12px] font-black text-slate-700 uppercase tracking-[0.2em]">{label}</span>
        </div>
      )}
      <div className="flex flex-nowrap items-start gap-1.5 sm:gap-3">
        {numbers.map(n => (
          <div key={n} className="flex-shrink-0">
            <ToothSVG 
              number={n} 
              status={getStatus(n)} 
              isSelected={selectedTooth === n}
              isChecked={checkedTeeth.has(n.toString())}
              onToggleCheck={toggleCheck}
              onClick={(num) => {
                if (onToothSelect) {
                  toggleCheck(num);
                } else {
                  setSelectedTooth(num);
                }
              }} 
            />
          </div>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="bg-white rounded-3xl p-12 border border-slate-100 shadow-sm flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 font-bold text-sm">Dental xarita yuklanmoqda...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-2xl shadow-slate-200/60 overflow-hidden relative">
        {/* Header */}
        <div className="px-6 py-5 bg-slate-50/40 border-b border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-200">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">Professional Odontogramma</h3>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">FDI Tizimi (11-48)</p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
            <Button 
              size="sm" 
              variant={viewMode === 'adult' ? 'default' : 'ghost'} 
              className={`rounded-lg px-4 font-black text-[10px] uppercase tracking-wider transition-all ${viewMode === 'adult' ? 'bg-slate-900 shadow-md' : 'text-slate-500'}`}
              onClick={() => setViewMode('adult')}
            >
              Kattalar
            </Button>
            <Button 
              size="sm" 
              variant={viewMode === 'child' ? 'default' : 'ghost'} 
              className={`rounded-lg px-4 font-black text-[10px] uppercase tracking-wider transition-all ${viewMode === 'child' ? 'bg-emerald-600 shadow-md' : 'text-slate-500'}`}
              onClick={() => setViewMode('child')}
            >
              Bolalar
            </Button>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 py-3 bg-white border-b border-slate-50 flex items-center gap-4 overflow-x-auto no-scrollbar">
          {Object.entries(TOOTH_STATUS_CONFIG).map(([label, cfg]) => (
            <div key={label} className="flex items-center gap-2 whitespace-nowrap">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.fill, border: `2px solid ${cfg.stroke}` }} />
              <span className={`text-[9px] font-black uppercase tracking-widest ${cfg.color} opacity-80`}>{label}</span>
            </div>
          ))}
        </div>

        {/* Anatomical Chart Area */}
        <div className="relative group/chart bg-slate-50/30">
          {/* Scroll Navigation Buttons */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 z-20 lg:hidden">
            <Button 
              size="icon" 
              variant="secondary" 
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg"
              onClick={() => scroll('left')}
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </Button>
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20 lg:hidden">
            <Button 
              size="icon" 
              variant="secondary" 
              className="w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm border border-slate-200 shadow-lg"
              onClick={() => scroll('right')}
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </Button>
          </div>

          {/* Quick Actions Panel (Floating) */}
          <AnimatePresence>
            {(checkedTeeth.size > 0 || selectedTooth) && (
              <motion.div 
                initial={{ opacity: 0, y: -20, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -20, x: '-50%' }}
                className="absolute top-4 left-1/2 z-40 flex items-center gap-2 p-1.5 bg-white/95 backdrop-blur-md rounded-2xl border border-blue-200 shadow-2xl shadow-blue-500/10 overflow-x-auto no-scrollbar max-w-[95%] sm:max-w-max"
              >
                <div className="flex items-center gap-1.5 px-3 border-r border-slate-200 mr-1.5 shrink-0">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white font-black text-[12px]">
                    {checkedTeeth.size || 1}
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:inline">Tanlandi</span>
                </div>
                <div className="flex items-center gap-1.5">
                  {Object.entries(TOOTH_STATUS_CONFIG).map(([label, cfg]) => (
                    <button
                      key={label}
                      onClick={() => handleQuickStatusUpdate(label)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-transparent hover:border-blue-100 hover:bg-white transition-all group shrink-0 active:scale-95`}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: cfg.fill, border: `1.5px solid ${cfg.stroke}` }} />
                      <span className={`text-[10px] font-black uppercase tracking-wider ${cfg.color}`}>{label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div 
            ref={scrollContainerRef}
            className="p-6 sm:p-12 flex flex-col items-center gap-16 scroll-smooth"
          >
            {/* Upper Jaw Row */}
            <div className="w-full border-b border-slate-100 pb-16 min-w-max">
              <ToothQuadrant numbers={UPPER_JAW} label="Yuqori jag' (18-28)" isRight={false} />
            </div>

            {/* FDI Divider Label */}
            <div className="bg-white px-10 py-3 border border-slate-200 rounded-2xl shadow-xl shadow-slate-200/50 flex items-center gap-4 z-10 -my-10 group hover:scale-105 transition-all duration-300">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
                <div className="w-2 h-2 rounded-full bg-blue-500" />
              </div>
              <span className="text-[12px] font-black text-slate-700 uppercase tracking-[0.5em]">Markaziy chiziq</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
              </div>
            </div>

            {/* Lower Jaw Row */}
            <div className="w-full pt-16 min-w-max">
              <ToothQuadrant numbers={LOWER_JAW} label="Pastki jag' (48-38)" isRight={false} />
            </div>
          </div>
        </div>

        {/* Selection Hint */}
        {!selectedTooth && checkedTeeth.size === 0 && (
          <div className="pb-6 text-center">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
              Tishni tanlang yoki checkboxni bosing
            </p>
          </div>
        )}

        {/* Selected Floating Action Bar */}
        <AnimatePresence>
          {checkedTeeth.size > 0 && !hideActions && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="fixed bottom-10 right-10 bg-slate-900 text-white p-4 rounded-3xl shadow-2xl flex items-center gap-6 z-50 border border-white/10 backdrop-blur-xl"
            >
              <div className="flex items-center gap-2 pr-6 border-r border-white/10">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-black">{checkedTeeth.size}</div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tanlandi</span>
              </div>
              
              <div className="flex gap-4">
                <Button 
                  onClick={() => setCheckedTeeth(new Set())}
                  variant="ghost" 
                  className="text-white hover:bg-white/10 font-bold text-xs uppercase"
                >
                  Bekor
                </Button>
                <Button 
                  className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 h-12 rounded-2xl font-black uppercase text-xs flex items-center gap-2"
                  onClick={() => {
                    // This usually opens treatment plan modal
                  }}
                >
                  <Activity className="w-4 h-4" />
                  Davolash
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Details Panel - Professional Animation */}
      <AnimatePresence>
        {selectedTooth && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="z-10"
          >
            <ToothPanel
              patientId={patientId}
              toothNumber={selectedTooth}
              record={toothRecords[selectedTooth] || null}
              plans={plans}
              onClose={() => { 
                setSelectedTooth(null); 
                loadToothRecords(); 
              }}
              inline={true}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

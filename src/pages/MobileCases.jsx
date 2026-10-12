import React, { useState } from 'react';
import { useBackClose } from '@/hooks/useBackClose';
import { useRestorableState } from '@/hooks/useRestorableState';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Search, Image as ImageIcon, Sparkles, X, ChevronRight, ChevronLeft, ArrowLeft, Pen, Trash2, AlertCircle, Plus, UserRound, Stethoscope, LayoutGrid, AlignLeft, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { mediaStorage } from '@/utils/mediaStorage';
import { useAuth } from '@/lib/AuthContext';
import { useTranslation } from '@/i18n/LanguageContext';

export default function MobileCases() {
  const { t } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  const [searchQuery, setSearchQuery] = useRestorableState('searchQuery', "");
  const [activeTag, setActiveTag] = useState("Barchasi");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const navigate = useNavigate();
  const [dbPatients, setDbPatients] = useState([]);
  const [dbDoctors, setDbDoctors] = useState([]);
  const [customTags, setCustomTags] = useState([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  React.useEffect(() => {
    const handleOpen = () => setIsModalOpen(true);
    window.addEventListener('open-cases-upload', handleOpen);
    return () => window.removeEventListener('open-cases-upload', handleOpen);
  }, []);

  React.useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        const [pts, docs] = await Promise.all([
          base44.entities.Patient.list('full_name', 50).catch(() => []),  // ⚡ tez
          base44.entities.User.list('name', 50).catch(() => [])
        ]);
        setDbPatients(pts || []);
        setDbDoctors((docs || []).filter(u => u.role === 'doctor' || u.role === 'admin'));

        // Fetch Cases
        try {
          const dbCases = await base44.entities.Case.list();
          const localMedia = await mediaStorage.getAllCaseMedia();
          let merged = (dbCases || []).map(c => {
            if (localMedia && localMedia[c.id]) {
              return {
                ...c,
                images: {
                  before: localMedia[c.id].before || c.images?.before || c.image_before,
                  after: localMedia[c.id].after || c.images?.after || c.image_after
                }
              };
            }
            return c;
          });
          // Doktor bo'lsa faqat o'zi qo'shgan keyslarni ko'rsin
          if (isDoctor && user?.id) {
            merged = merged.filter(c =>
              String(c.doctor_id) === String(user.id) ||
              String(c.created_by_id) === String(user.id) ||
              String(c.doctor || '').toLowerCase() === String(user.name || '').toLowerCase()
            );
          }
          setCases(merged);
        } catch (e) {
          console.warn("Cases fetch error:", e);
          setCases([]);
          toast.error(e?.message || "Keyslar serverdan yuklanmadi");
        }

        // Fetch Categories
        try {
          const catData = await base44.entities.CaseCategory.list();
          if (catData && Array.isArray(catData)) {
            setCustomTags(catData.map(c => c.name));
          }
        } catch (e) {
          console.warn("Mobile Categories fetch error:", e);
        }

      } catch (err) {
        console.error("Ma'lumotlarni yuklashda xatolik:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [clinicId]);

  const handleDeleteCase = async (caseId) => {
    if (!window.confirm("Haqiqatan ham ushbu klinik keysni o'chirmoqchimisiz?")) return;
    try {
      await base44.entities.Case.delete(caseId);
      await mediaStorage.deleteCaseMedia(caseId);
      setCases(prev => prev.filter(c => c.id !== caseId));
      setSelectedCase(null);
      toast.success("Keys muvaffaqiyatli o'chirildi!");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error(err.message || "O'chirishda xatolik");
    }
  };

  const ALL_TAGS = ["Barchasi", ...new Set([...cases.flatMap(c => c.tags), ...customTags])];

  const handleAddTag = async (tagName) => {
    if (!tagName || !tagName.trim()) return;
    const trimmed = tagName.trim();
    
    if (ALL_TAGS.includes(trimmed)) {
      toast.error("Ushbu kategoriya allaqachon mavjud");
      return;
    }

    try {
      const saved = await base44.entities.CaseCategory.create({
        name: trimmed
      });

      if (saved) {
        setCustomTags([...customTags, trimmed]);
        setActiveTag(trimmed);
        setIsTagModalOpen(false);
        toast.success(`"${trimmed}" doimiy saqlandi`);
      }
    } catch (e) {
      console.warn("Bazaga saqlab bo'mladi (vaqtinchalik saqlanadi):", e.message);
      setCustomTags([...customTags, trimmed]);
      setActiveTag(trimmed);
      setIsTagModalOpen(false);
    }
  };

  const filteredCases = cases.filter(c => {
    const name = c.patientname || c.patient_name || c.patientName || "";
    const tags = c.tags || [];
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          String(c.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          tags.join("").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = activeTag === "Barchasi" || tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 pb-32">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl px-4 pt-4 pb-3">
        <div className="mb-3">
           <h1 className="text-[24px] font-extrabold tracking-tight text-slate-900">Mening keyslarim</h1>
           <p className="text-[14px] font-medium text-[#1499AD]/80">Klinik keyslar va bemor ishlari</p>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Keyslarni izlash..."
            className="w-full bg-slate-100 border-none pl-10 h-12 rounded-2xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#1499AD]/20"
          />
        </div>
      </div>

      {/* Memory Warning Banner */}
      <div className="mx-4 mt-3 bg-rose-50/95 border border-rose-200/80 rounded-2xl p-3 flex items-center gap-2.5 shadow-xs">
        <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
          <AlertCircle className="w-4 h-4" />
        </div>
        <p className="text-[13px] font-bold text-rose-600 tracking-tight leading-snug">
          Iltimos xotira to'lmasligi uchun sifatli rasmlarni yuklang
        </p>
      </div>

      {/* FILTER TAGS */}
      <div className="px-4 py-3">
         <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`shrink-0 h-12 px-5 rounded-xl text-[13px] font-black uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                  activeTag === tag 
                    ? 'bg-[#1499AD] text-white shadow-lg shadow-[#1499AD]/20' 
                    : 'text-slate-500 bg-white border border-slate-100'
                }`}
              >
                {tag}
              </button>
            ))}
            <button
              onClick={() => setIsTagModalOpen(true)}
              className="shrink-0 h-12 px-5 rounded-xl text-[13px] font-black uppercase tracking-wider whitespace-nowrap bg-white border border-dashed border-[#1499AD] text-[#1499AD] flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Sparkles className="w-4 h-4" />
              <span>Qo'shish</span>
            </button>
         </div>
      </div>

      {/* CASES LIST */}
      {isLoading ? (
         <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-4 border-[#1499AD]/20 border-t-[#1499AD] rounded-full animate-spin" />
            <p className="text-slate-500 font-bold uppercase tracking-widest text-[10px]">Bazadan yuklanmoqda...</p>
         </div>
      ) : (
      <div className="px-4 space-y-4 mt-2">
        <AnimatePresence>
          {filteredCases.map((c, i) => (
             <motion.div 
               key={c.id}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-white border border-slate-100 rounded-[2rem] overflow-hidden shadow-sm shadow-slate-200/50"
               onClick={() => setSelectedCase(c)}
             >
                <div className="relative h-60 w-full">
                  <img src={c.images.after} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
                  
                  <div className="absolute bottom-5 left-5 right-5">
                     <div className="flex gap-1.5 mb-2">
                       {c.tags.slice(0, 2).map(tag => (
                          <span key={tag} className="px-2 py-1 bg-white/20 backdrop-blur-md rounded-lg text-[9px] font-black uppercase tracking-widest text-white">{tag}</span>
                       ))}
                     </div>
                     <h3 className="text-white font-black text-xl tracking-tight">{c.patientname || c.patient_name || c.patientName}</h3>
                     <p className="text-[#1499AD] text-[10px] font-black uppercase tracking-widest mt-1">{c.date}</p>
                  </div>

                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-2 rounded-full shadow-lg">
                    <Sparkles className="w-4 h-4 text-[#1499AD]" />
                  </div>
                </div>
             </motion.div>
          ))}

          {filteredCases.length === 0 && (
             <div className="py-16 flex flex-col items-center justify-center text-center px-6">
               <div className="relative w-28 h-28 rounded-full bg-[#1499AD]/10 grid place-items-center mb-4">
                 <span className="absolute -top-3 left-1/2 -translate-x-1/2 flex gap-2 text-[#1499AD]/60"><i className="block w-0.5 h-3 bg-current rounded -rotate-45" /><i className="block w-0.5 h-3.5 bg-current rounded" /><i className="block w-0.5 h-3 bg-current rounded rotate-45" /></span>
                 <ImageIcon className="w-14 h-14 text-[#1499AD]/70" />
               </div>
               <p className="font-bold text-[16px] text-slate-900">Keyslar topilmadi</p>
               <p className="text-[14px] text-slate-500 mt-1 max-w-[290px]">Hozircha hech qanday klinik keys mavjud emas. Yangi keys qo'shib, o'z ishlaringizni saqlang.</p>
             </div>
          )}
        </AnimatePresence>
      </div>
      )}



      {/* BEFORE/AFTER MOBILE VIEWER */}
      <AnimatePresence>
         {selectedCase && (
           <MobileCaseViewer 
             data={selectedCase} 
             onClose={() => setSelectedCase(null)} 
             onDelete={handleDeleteCase}
           />
         )}
      </AnimatePresence>

      <MobileUploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        existingTags={ALL_TAGS.filter(t => t !== "Barchasi")}
        patients={dbPatients}
        doctors={dbDoctors.map(d => d.name || d.full_name)}
        onSave={async (newCase) => {
          const loadingToast = toast.loading("Keys saqlanmoqda...");
          try {
             let finalImages = { ...newCase.images };

             if (finalImages.before && finalImages.before.startsWith('data:')) {
               finalImages.before = await compressImage(finalImages.before, 1200, 0.75);
             }
             if (finalImages.after && finalImages.after.startsWith('data:')) {
               finalImages.after = await compressImage(finalImages.after, 1200, 0.75);
             }

             const caseToSave = {
                ...newCase,
                images: finalImages,
                clinic_id: clinicId
             };

             const saved = await base44.entities.Case.create(caseToSave);
             if (saved?.id && saved.server) {
                const enriched = {
                  ...saved,
                  images: saved.images?.after ? saved.images : finalImages
                };
                await mediaStorage.saveCaseMedia(enriched.id, enriched.images);

                setCases(prev => [enriched, ...prev.filter(c => c.id !== enriched.id)]);
                toast.success("Keys muvaffaqiyatli saqlandi!", { id: loadingToast });
                setIsModalOpen(false);
             } else {
                toast.error("Keys serverga saqlanmadi", { id: loadingToast });
             }
          } catch (e) {
             console.error(e);
             toast.error(e.message || "Keys serverga saqlanmadi", { id: loadingToast });
          }
        }} 
      />

      <AddTagModalMobile 
          isOpen={isTagModalOpen} 
          onClose={() => setIsTagModalOpen(false)} 
          onAdd={handleAddTag} 
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                          IMAGE COMPRESSION UTILITY                         */
/* -------------------------------------------------------------------------- */
const compressImage = (base64Str, maxWidth = 1200, quality = 0.7) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64Str);
  });
};

/* -------------------------------------------------------------------------- */
/*                          UPLOAD/ADD NEW CASE MODAL                         */
/* -------------------------------------------------------------------------- */
function AddTagModalMobile({ isOpen, onClose, onAdd }) {
  useBackClose(isOpen, onClose);
  const [tagName, setTagName] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        className="w-full bg-white p-8 rounded-t-[3rem] shadow-2xl relative"
      >
        <div className="w-12 h-1.5 bg-slate-100 rounded-full mx-auto mb-8" />
        
        <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">Yangi Kategoriya</h3>
        <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-8">Guruhlash uchun nom kiriting</p>

        <div className="space-y-6">
          <Input 
             autoFocus
             value={tagName}
             onChange={e => setTagName(e.target.value)}
             placeholder="Masalan: Implant, Breket..."
             className="h-16 rounded-[1.5rem] bg-slate-50 border-slate-100 px-6 text-base"
          />
          
          <div className="flex gap-3 pb-4">
            <button onClick={onClose} className="flex-1 h-14 rounded-2xl font-black text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50">Bekor</button>
            <button onClick={() => onAdd(tagName)} className="flex-1 h-14 rounded-2xl bg-[#1499AD] text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-[#1499AD]/20">Qo'shish</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                        MOBILE BEFORE/AFTER VIEWER                          */
/* -------------------------------------------------------------------------- */
function MobileCaseViewer({ data, onClose, onDelete }) {
  useBackClose(true, onClose);
  const [sliderPos, setSliderPos] = useState(50);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [color, setColor] = useState('#1499AD');

  const canvasRef = React.useRef(null);
  const isDrawing = React.useRef(false);
  const lastPos = React.useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        
        const ctx = canvasRef.current.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        if(imgData.width > 0) ctx.putImageData(imgData, 0, 0);
      }
    };
    
    setTimeout(handleResize, 100);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const getPos = (e) => {
     const rect = canvasRef.current.getBoundingClientRect();
     const clientX = e.touches ? e.touches[0].clientX : e.clientX;
     const clientY = e.touches ? e.touches[0].clientY : e.clientY;
     return {
       x: clientX - rect.left,
       y: clientY - rect.top
     };
  };

  const startDrawing = (e) => {
    if (!isDrawingMode) return;
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    if (!isDrawingMode || !isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    
    lastPos.current = pos;
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const handleTouchMove = (e) => {
    if (isDrawingMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPos(percentage);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 z-50 bg-slate-50 flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white relative z-20">
        <button onClick={onClose} className="p-2 -ml-2 text-slate-800">
          <X className="w-6 h-6" />
        </button>
        
        {/* Drawing Tools Mobile */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isDrawingMode ? 'bg-[#1499AD] text-white' : 'text-slate-400'}`}
          >
            <Pen className="w-4 h-4" />
          </button>
          
          {isDrawingMode && (
             <div className="flex items-center gap-1.5 px-2 border-l border-slate-200">
               {['#ef4444', '#eab308', '#22c55e', '#1499AD'].map(c => (
                 <button 
                    key={c} 
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border border-transparent ${color === c ? 'ring-2 ring-slate-400 ring-offset-2 scale-110' : ''}`}
                    style={{ backgroundColor: c }}
                 />
               ))}
               <button onClick={clearCanvas} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-rose-500 ml-1">
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col pt-4 overflow-y-auto no-scrollbar">
        
        {/* Slider Area */}
        <div 
          className="relative w-full aspect-[3/4] bg-slate-200 shadow-2xl flex-shrink-0 touch-none"
          onTouchMove={handleTouchMove}
          onMouseMove={handleTouchMove}
        >
          {/* AFTER */}
          <div className="absolute inset-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${data.images.after})` }} />
          
          {/* BEFORE */}
          <div 
             className="absolute inset-0 bg-contain bg-center bg-no-repeat" 
             style={{ 
               backgroundImage: `url(${data.images.before})`,
               clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
             }} 
          />

          {/* Handle */}
          {!isDrawingMode && (
            <div 
              className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg flex items-center justify-center -translate-x-[50%]"
              style={{ left: `${sliderPos}%` }}
            >
               <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center text-black shadow-xl border-2 border-black/10">
                 <ChevronLeft className="w-3 h-3" />
                 <ChevronRight className="w-3 h-3 -ml-1" />
               </div>
            </div>
          )}

          {/* Canvas Component for Drawing */}
          <canvas
             ref={canvasRef}
             className={`absolute inset-0 z-10 w-full h-full touch-none ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
             onMouseDown={startDrawing}
             onMouseMove={draw}
             onMouseUp={stopDrawing}
             onMouseLeave={stopDrawing}
             onTouchStart={startDrawing}
             onTouchMove={draw}
             onTouchEnd={stopDrawing}
          />

          <div className="absolute top-3 left-3 bg-black/60 px-2 py-1 rounded text-white text-[10px] font-black uppercase tracking-widest pointer-events-none">Oldin</div>
          <div className="absolute top-3 right-3 bg-[#1499AD] px-2 py-1 rounded text-white text-[10px] font-black uppercase tracking-widest pointer-events-none">Keyin</div>
        </div>

        {/* DETAILS */}
        <div className="p-6 bg-white flex-1 pb-16">
           {isDrawingMode && (
              <div className="mb-4 bg-[#1499AD]/10 border border-[#1499AD]/20 p-3 rounded-xl text-[#1499AD] text-xs font-bold text-center animate-pulse">
                Hozirda chizish rejimidasiz.
              </div>
           )}
           <div className="flex flex-wrap gap-2 mb-4">
              {data.tags.map(t => (
                <span key={t} className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black text-slate-500 uppercase tracking-widest">{t}</span>
              ))}
           </div>
           
           <h4 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2 ml-1">Tavsif va Izoh</h4>
           <p className="text-slate-600 text-sm leading-relaxed mb-6 bg-slate-50 p-4 rounded-2xl border border-slate-100">{data.description || "Izoh kiritilmagan"}</p>

           <div className="flex items-center justify-between border-t border-slate-100 pt-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#1499AD] text-white flex items-center justify-center font-black text-xs shadow-md shadow-[#1499AD]/20">{data.doctor[0]}</div>
                <div className="flex flex-col">
                   <span className="text-sm font-black text-slate-800">{data.doctor}</span>
                   <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">{data.date}</span>
                </div>
              </div>
              <div className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg text-[9px] font-black uppercase tracking-widest">Natija</div>
           </div>

           {onDelete && (
             <div className="mt-5 pt-4 border-t border-slate-100 flex justify-end">
               <button 
                 onClick={() => onDelete(data.id)}
                 className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border border-rose-200"
               >
                 <Trash2 className="w-4 h-4" />
                 <span>Keysni o'chirish</span>
               </button>
             </div>
           )}
        </div>

      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*                          MOBILE UPLOAD MODAL                               */
/* -------------------------------------------------------------------------- */
function MobileUploadModal({ isOpen, onClose, onSave, existingTags = [], patients = [], doctors = [] }) {
  const { t } = useTranslation();
  const [beforeImg, setBeforeImg] = useState(null);
  const [afterImg, setAfterImg] = useState(null);
  const [description, setDescription] = useState("");

  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  const [selectedTags, setSelectedTags] = useState([]);

  React.useEffect(() => {
    if(doctors.length > 0 && !selectedDoctor) setSelectedDoctor(doctors[0]);
  }, [doctors, selectedDoctor]);

  if (!isOpen) return null;

  const handleImageUpload = async (e, type) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result);
        if (type === 'before') setBeforeImg(compressed);
        else setAfterImg(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = () => {
    if(!selectedPatient || !afterImg) {
      alert("Iltimos bemorni tanlang va kamida 'Keyin' rasmini yuklang");
      return;
    }
    
    onSave({
      doctor: selectedDoctor || "Noma'lum",
      patientname: selectedPatient.full_name || selectedPatient.name,
      patient_id: selectedPatient.id,
      date: new Date().toISOString().split('T')[0],
      tags: selectedTags.length > 0 ? selectedTags : ["Yangi"],
      images: {
        before: beforeImg || afterImg,
        after: afterImg
      },
      description
    });
    
    setBeforeImg(null);
    setAfterImg(null);
    setSelectedPatient(null);
    setPatientSearch("");
    setSelectedTags([]);
    setDescription("");
  };

  const toggleTag = (tag) => {
    if (selectedTags.includes(tag)) {
       setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
       setSelectedTags([...selectedTags, tag]);
    }
  };

  const filteredPatients = patients.filter(p => {
    const nameStr = (p.full_name || p.name || '').toLowerCase();
    const phoneStr = p.phone || '';
    const searchStr = patientSearch.toLowerCase();
    return nameStr.includes(searchStr) || phoneStr.includes(searchStr);
  });

  const Lbl = ({ icon: Icon, children, right }) => (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-slate-500" />
      <span className="flex-1 text-[13px] font-bold uppercase tracking-wide text-slate-500">{children}</span>
      {right}
    </div>
  );
  const UploadTile = ({ img, type, title }) => (
    <label className="h-36 w-full rounded-2xl border-2 border-dashed border-[#1499AD]/40 bg-[#1499AD]/[0.04] flex flex-col items-center justify-center gap-1.5 relative overflow-hidden cursor-pointer">
      <input type="file" accept="image/*" className="hidden" capture="environment" onChange={(e) => handleImageUpload(e, type)} />
      {img ? <img src={img} alt="" className="absolute inset-0 w-full h-full object-cover" /> : (
        <>
          <span className="relative text-[#1499AD]"><ImageIcon className="w-9 h-9" /><Plus className="absolute -top-1.5 -right-2 w-4 h-4 rounded-full bg-[#1499AD] text-white p-0.5" /></span>
          <span className="text-[14px] font-bold text-[#1499AD]">{title}</span>
          <span className="text-[13px] text-slate-500">Rasm tanlang yoki kameradan oling</span>
        </>
      )}
    </label>
  );
  const countPill = (img) => <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[12px] font-semibold text-slate-500">{img ? 1 : 0} ta rasm</span>;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-screen max-w-none h-[100dvh] max-h-[100dvh] p-0 border-none rounded-none bg-white outline-none overflow-hidden flex flex-col !left-0 !top-0 !translate-x-0 !translate-y-0 [&>button]:hidden" aria-describedby={undefined} data-testid="case-add-sheet">
        <div className="shrink-0 px-4 pt-4 pb-2 text-center relative">
          <button onClick={onClose} aria-label="Yopish" className="absolute right-3 top-3 w-11 h-11 rounded-full bg-slate-100 text-slate-600 grid place-items-center"><X className="w-5 h-5" /></button>
          <DialogTitle className="text-[22px] font-extrabold text-slate-900">Yangi klinik keys</DialogTitle>
          <p className="text-[14px] font-medium text-slate-400">Klinik keysni qo'shish va bo'lishish</p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-5 no-scrollbar">
          <div className="relative">
            <Lbl icon={UserRound}>Bemor tanlash</Lbl>
            {selectedPatient ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-3 rounded-2xl">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 bg-emerald-500 text-white rounded-full flex items-center justify-center font-bold text-[15px] shrink-0">{(selectedPatient.full_name || selectedPatient.name || '?')[0]}</div>
                  <div className="min-w-0">
                    <div className="text-slate-900 font-bold text-[14px] truncate">{selectedPatient.full_name || selectedPatient.name}</div>
                    <div className="text-emerald-700 text-[13px]">{selectedPatient.phone || "Telefon kiritilmagan"}</div>
                  </div>
                </div>
                <button onClick={() => setSelectedPatient(null)} aria-label="Bekor" className="w-11 h-11 grid place-items-center text-slate-500 bg-white rounded-xl border border-slate-100"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input value={patientSearch} onChange={e => { setPatientSearch(e.target.value); setShowPatientDropdown(true); }} onFocus={() => setShowPatientDropdown(true)}
                  placeholder="Ism yoki telefon orqali qidiring..." className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 h-12 pl-11 rounded-xl text-[14px] focus:ring-0 focus:border-[#1499AD]" />
                {showPatientDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-2xl max-h-56 overflow-y-auto no-scrollbar z-20">
                    {filteredPatients.length > 0 ? filteredPatients.map(p => (
                      <div key={p.id} onClick={() => { setSelectedPatient(p); setShowPatientDropdown(false); }} className="px-3.5 min-h-[52px] border-b border-slate-50 cursor-pointer flex justify-between items-center active:bg-slate-50">
                        <div className="flex flex-col"><span className="text-slate-900 text-[14px] font-semibold">{p.full_name || p.name}</span><span className="text-slate-400 text-[13px]">{p.phone || "—"}</span></div>
                        <ChevronRight className="w-4 h-4 text-slate-300" />
                      </div>
                    )) : <div className="p-6 text-slate-400 text-[13px] text-center font-semibold">Bemor topilmadi...</div>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Lbl icon={Stethoscope}>Davolovchi shifokor</Lbl>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              {doctors.length > 0 ? doctors.map(doc => (
                <button key={doc} onClick={() => setSelectedDoctor(doc)}
                  className={`shrink-0 h-11 px-4 rounded-xl text-[13px] font-semibold whitespace-nowrap border ${selectedDoctor === doc ? 'bg-[#1499AD] border-[#1499AD] text-white' : 'bg-white border-slate-200 text-slate-600'}`}>{doc}</button>
              )) : <span className="text-slate-500 text-[13px] italic">Shifokorlar mavjud emas</span>}
            </div>
          </div>

          <div>
            <Lbl icon={LayoutGrid}>Kategoriya</Lbl>
            <div className="flex flex-wrap gap-2">
              {existingTags.length > 0 ? existingTags.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`h-11 px-4 rounded-xl text-[13px] font-semibold border ${selectedTags.includes(tag) ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{tag}</button>
              )) : <span className="text-slate-400 text-[13px] italic">Kategoriyalar mavjud emas — "Qo'shish" tugmasi orqali yarating</span>}
            </div>
          </div>

          <div>
            <Lbl icon={Camera} right={countPill(beforeImg)}>Oldin rasmlari</Lbl>
            <UploadTile img={beforeImg} type="before" title="Oldin rasmlarni yuklash" />
          </div>
          <div>
            <Lbl icon={Camera} right={countPill(afterImg)}>Keyin rasmlari</Lbl>
            <UploadTile img={afterImg} type="after" title="Keyin rasmlarni yuklash" />
          </div>

          <div>
            <Lbl icon={AlignLeft}>Tavsif</Lbl>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Keys haqida qisqacha tavsif yozing..."
              className="w-full bg-slate-50 border border-slate-200 p-3.5 rounded-xl text-slate-900 placeholder:text-slate-400 min-h-[96px] outline-none focus:border-[#1499AD] text-[14px] leading-relaxed resize-none" />
          </div>

          <div className="flex items-start gap-3 rounded-xl border border-[#1499AD]/20 bg-[#1499AD]/[0.06] p-3">
            <Info className="w-5 h-5 text-[#1499AD] shrink-0 mt-0.5" />
            <div><p className="text-[13px] font-bold text-[#0f6b78] uppercase">Maslahat</p><p className="text-[13px] text-slate-600">Sifatli rasmlar va batafsil tavsif keysning samaradorligini oshiradi.</p></div>
          </div>
        </div>

        <div className="px-4 pt-3 bg-white border-t border-slate-100 grid grid-cols-2 gap-3 shrink-0" style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}>
          <button onClick={onClose} className="h-12 rounded-xl border border-slate-200 font-semibold text-[15px] text-slate-700 bg-white">Bekor qilish</button>
          <button onClick={handleSave} className="h-12 rounded-xl bg-[#1499AD] text-white font-bold text-[15px]">Qo'shish</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

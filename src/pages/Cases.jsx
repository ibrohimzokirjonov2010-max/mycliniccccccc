import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Plus, Search, Image as ImageIcon, Sparkles, X, ChevronRight, ChevronLeft, Pen, Trash2, AlertCircle, Crop } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { db } from '@/api/supabaseClient';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import TelegramImageCropper from '@/components/ui/TelegramImageCropper';

// Mock Data for Initial State
const MOCK_CASES = [
  {
    id: 1,
    doctor: "Dr. Shahobiddin",
    patientname: "M. Aziza",
    date: "2026-05-20",
    tags: ["Implant", "Estetika"],
    images: {
      before: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=400",
      after: "https://images.unsplash.com/photo-1598256989800-fea5ce5146f2?auto=format&fit=crop&q=80&w=400"
    },
    description: "21, 22-tishlarga zirkon qoplamalar va implant o'rnatildi."
  },
  {
    id: 2,
    doctor: "Dr. Shahobiddin",
    patientname: "K. Sardor",
    date: "2026-05-21",
    tags: ["Breket", "Ortodontiya"],
    images: {
      before: "https://images.unsplash.com/photo-1598256989800-fea5ce5146f2?auto=format&fit=crop&q=80&w=400", // Just placeholders
      after: "https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&q=80&w=400"
    },
    description: "6 oylik natija. Tishlar qatori to'g'irlandi."
  },
  {
    id: 3,
    doctor: "Dr. Shahobiddin",
    patientname: "O. Jamila",
    date: "2026-05-22",
    tags: ["Restavratsiya", "Karies"],
    images: {
      before: "https://images.unsplash.com/photo-1445543949571-ffc3e0e2f55e?auto=format&fit=crop&q=80&w=400",
      after: "https://images.unsplash.com/photo-1527613426441-4da17471b66d?auto=format&fit=crop&q=80&w=400"
    },
    description: "Frontal tishlarni kompozit material bilan tiklash."
  }
];

export default function Cases() {
  const { t, language } = useTranslation();
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState("Barchasi");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const [dbPatients, setDbPatients] = useState([]);
  const [dbDoctors, setDbDoctors] = useState([]);
  const [customTags, setCustomTags] = useState([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      try {
        // Individual fetches to be more robust if a table is missing
        const [pts, docs] = await Promise.all([
          base44.entities.Patient.list('full_name', 500).catch(() => []),
          base44.entities.User.list('name', 50).catch(() => [])
        ]);
        setDbPatients(pts || []);
        setDbDoctors((docs || []).filter(u => u.role === 'doctor' || u.role === 'admin'));

        // Fetch Cases
        try {
          const dbCases = await base44.entities.Case.list();
          setCases(dbCases || []);
        } catch (e) {
          console.warn("Cases fetch error:", e);
          setCases(MOCK_CASES);
        }

        // Fetch Categories
        try {
          const catData = await base44.entities.CaseCategory.list();
          if (catData) {
            setCustomTags(catData.map(c => c.name));
          }
        } catch (e) {
          console.warn("Categories fetch error:", e);
        }

      } catch (err) {
        console.error("Umumiy yuklashda xatolik:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, [clinicId]);

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
        toast.success(`"${trimmed}" kategoriyasi doimiy saqlandi`);
      }
    } catch (e) {
      console.warn("Bazaga saqlab bo'mladi (jadval yaratilmagan bo'lishi mumkin), vaqtinchalik saqlanadi:", e.message);
      setCustomTags([...customTags, trimmed]);
      setActiveTag(trimmed);
      setIsTagModalOpen(false);
    }
  };

  // Filter cases logic
  const filteredCases = cases.filter(c => {
    const name = c.patientname || c.patient_name || c.patientName || "";
    const tags = c.tags || [];
    const matchesSearch = name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          tags.join("").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = activeTag === "Barchasi" || tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 p-4 sm:p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#1499AD]/10 rounded-full blur-[120px] pointer-events-none -translate-y-1/2 translate-x-1/3" />
      <div className="absolute bottom-0 left-0 w-[350px] h-[350px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none translate-y-1/3 -translate-x-1/3" />

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* HEADER SECTION - Compact */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
              {t('cases.title') || "Klinik Keyslar"}
            </h1>
            <p className="text-slate-500 mt-0.5 font-bold text-xs uppercase tracking-wider opacity-60">{t('cases.subtitle') || "Bemorlarning oldin va keyingi davolash natijalari"}</p>
          </div>

          <Button 
            onClick={() => setIsModalOpen(true)}
            size="sm" 
            className="bg-gradient-to-r from-[#1499AD] to-[#0E7A8A] hover:from-[#1acced] hover:to-[#1499AD] text-white shadow-md shadow-[#1499AD]/20 rounded-xl h-10 px-5 text-xs uppercase tracking-wider font-black shrink-0 flex items-center gap-2"
          >
            <Camera className="w-4 h-4" />
            <span>{t('cases.addNewCase') || "Yangi Keys Qo'shish"}</span>
          </Button>
        </div>

        {/* Memory Warning Alert Banner - Compact */}
        <div className="mb-3 bg-rose-50/90 border border-rose-200/70 rounded-xl px-3.5 py-2 flex items-center gap-2.5 shadow-xs animate-in fade-in-50">
          <div className="w-6 h-6 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-bold text-rose-600 tracking-tight">
            Iltimos xotira to'lmasligi uchun sifatli rasmlarni yuklang
          </p>
        </div>

        {/* FILTERS & SEARCH - Compact */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-4">
          <div className="lg:col-span-3">
            <div className="flex bg-white border border-slate-200/80 rounded-2xl p-1 overflow-x-auto no-scrollbar gap-1 shadow-xs">
              {ALL_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => setActiveTag(tag)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
                    activeTag === tag 
                      ? 'bg-[#1499AD] text-white shadow-md shadow-[#1499AD]/20' 
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {tag === "Barchasi" ? (t('cases.all') || "Barchasi") : tag}
                </button>
              ))}
              <button
                onClick={() => setIsTagModalOpen(true)}
                className="px-3.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap border border-dashed border-[#1499AD]/40 text-[#1499AD] hover:bg-[#1499AD]/5 transition-all flex items-center gap-1.5 ml-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>{t('cases.newCategory') || "Yangi Kategoriya"}</span>
              </button>
            </div>
          </div>
          <div className="lg:col-span-1 relative">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-300" />
            </div>
            <Input 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('cases.searchPlaceholder') || "Keys qidirish..."} 
              className="w-full h-10 bg-white border-slate-200/80 pl-10 rounded-2xl text-xs text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-[#1499AD]/10 focus:border-[#1499AD] shadow-xs"
            />
          </div>
        </div>

        {/* MASONRY GRID OF CASES */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 bg-white/5 rounded-[2.5rem] border border-white/5 border-dashed">
             <div className="w-12 h-12 border-4 border-[#1499AD]/20 border-t-[#1499AD] rounded-full animate-spin" />
             <p className="text-slate-400 font-bold uppercase tracking-tight text-[10px]">{t('cases.loadingData') || "Ma'lumotlar bazadan yuklanmoqda..."}</p>
          </div>
        ) : (
          <>
            <div className="columns-1 md:columns-2 lg:columns-3 lg:gap-6 gap-4 space-y-4 lg:space-y-6">
              <AnimatePresence>
                {filteredCases.map((c, i) => (
                  <motion.div 
                    key={c.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.4, delay: Math.min(i, 6) * 0.02 }}
                    className="break-inside-avoid content-visibility-auto"
                  >
                    <CaseCard data={c} onClick={() => setSelectedCase(c)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {filteredCases.length === 0 && (
              <div className="py-32 flex flex-col items-center justify-center text-slate-500 bg-white/5 rounded-[3rem] border border-white/5 border-dashed">
                <ImageIcon className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg font-bold">{t('cases.noCasesFound') || "Hech qanday keys topilmadi"}</p>
                <p className="text-sm mt-1">{t('cases.noCasesFoundDesc') || "Boshqa so'z bilan qidirib ko'ring yoki yangi qo'shing"}</p>
              </div>
            )}
          </>
        )}

      </div>

      {/* BEFORE / AFTER SLIDER MODAL */}
      <AnimatePresence>
         {selectedCase && (
           <CaseDetailModal data={selectedCase} onClose={() => setSelectedCase(null)} />
         )}
      </AnimatePresence>

      <CaseUploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        existingTags={ALL_TAGS.filter(t => t !== "Barchasi")}
        patients={dbPatients}
        doctors={dbDoctors.map(d => d.name || d.full_name)}
        onSave={async (newCase) => {
          const loadingToast = toast.loading("Rasmlar serverga yuklanmoqda...");
          try {
             // 1. Upload images to Supabase Storage if they are base64
             let finalImages = { ...newCase.images };
             const timestamp = Date.now();
             const patientSlug = (newCase.patientname || 'case').replace(/\s+/g, '_').toLowerCase();
             
             try {
               // Upload BEFORE image
               if (newCase.images.before && newCase.images.before.startsWith('data:')) {
                 const beforeUrl = await db.storage.uploadFile(
                   'cases', 
                   `${clinicId}/${patientSlug}_${timestamp}_before.jpg`, 
                   newCase.images.before
                 );
                 finalImages.before = beforeUrl;
               }

               // Upload AFTER image
               if (newCase.images.after && newCase.images.after.startsWith('data:')) {
                 const afterUrl = await db.storage.uploadFile(
                   'cases', 
                   `${clinicId}/${patientSlug}_${timestamp}_after.jpg`, 
                   newCase.images.after
                 );
                 finalImages.after = afterUrl;
               }
               toast.loading("Ma'lumotlar bazaga yozilmoqda...", { id: loadingToast });
             } catch (storageErr) {
               console.warn("Storage upload failed, falling back to base64:", storageErr);
               // We continue with original base64 images if storage upload fails
               // this ensures the app works even if the user hasn't set up buckets yet
             }

             // 2. Save the case record with image URLs
             const caseToSave = {
                ...newCase,
                images: finalImages,
                clinic_id: clinicId
             };

             const saved = await base44.entities.Case.create(caseToSave);
             
             if (saved) {
                const enriched = {
                  ...saved,
                  images: saved.images || finalImages
                };
                setCases(prev => [enriched, ...prev]);
                toast.success("Keys professional darajada saqlandi!", { id: loadingToast });
                setIsModalOpen(false);
             } else {
                toast.error("Saqlashda noma'lum xatolik", { id: loadingToast });
             }
          } catch (e) {
             console.error("Save error:", e);
             toast.error(e.message || "Xatolik yuz berdi", { id: loadingToast });
          }
        }} 
      />

      <AddTagModal 
        isOpen={isTagModalOpen} 
        onClose={() => setIsTagModalOpen(false)} 
        onAdd={handleAddTag} 
      />

    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                         CUSTOM ADD TAG MODAL                               */
/* -------------------------------------------------------------------------- */
function AddTagModal({ isOpen, onClose, onAdd }) {
  const [tagName, setTagName] = useState("");

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-white p-10 rounded-[2.5rem] shadow-2xl relative"
      >
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900">
          <X className="w-6 h-6" />
        </button>

        <div className="mb-8 overflow-hidden inline-flex p-3 bg-[#1499AD]/10 rounded-2xl">
          <Sparkles className="w-6 h-6 text-[#1499AD]" />
        </div>
        
        <h3 className="text-2xl font-black text-slate-900 mb-2">Yangi Kategoriya</h3>
        <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mb-8">Keyslarni guruhlash uchun nom kiriting</p>

        <div className="space-y-6">
          <Input 
             autoFocus
             value={tagName}
             onChange={e => setTagName(e.target.value)}
             onKeyDown={e => e.key === 'Enter' && onAdd(tagName)}
             placeholder="Masalan: Implantatsiya..."
             className="h-16 rounded-2xl bg-slate-50 border-slate-100 text-lg px-6 focus:ring-2 focus:ring-[#1499AD]/10"
          />
          
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1 h-14 rounded-xl font-black text-xs text-slate-400 uppercase tracking-widest">Bekor</Button>
            <Button onClick={() => onAdd(tagName)} className="flex-1 h-14 rounded-xl bg-[#1499AD] hover:bg-[#0E7A8A] font-black text-xs text-white uppercase tracking-widest shadow-lg shadow-[#1499AD]/20">Qo'shish</Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 CASE CARD                                  */
/* -------------------------------------------------------------------------- */
function CaseCard({ data, onClick }) {
  // We show only the "After" image as a cover, with a hint for 'Before & After'
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white border border-slate-100 rounded-2xl overflow-hidden cursor-pointer hover:border-[#1499AD]/30 transition-all duration-500 hover:shadow-xl hover:shadow-[#1499AD]/10 hover:-translate-y-0.5"
    >
      <div className="relative w-full overflow-hidden aspect-[4/5]">
        <img 
          src={data.images?.after || data.image_after || "/placeholder-dentist.jpg"} 
          alt="Natija" 
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        
        {/* Floating Badge */}
        <div className="absolute top-3.5 right-3.5 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md flex items-center gap-1.5 border border-white">
          <Sparkles className="w-3.5 h-3.5 text-[#1499AD]" />
          <span className="text-[9px] font-black text-slate-900 uppercase tracking-widest">Natija</span>
        </div>
        
        {/* Overlay gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/40 to-transparent" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5 mb-2">
          {data.tags.map(tag => (
            <span key={tag} className="px-2 py-0.5 bg-white/20 backdrop-blur-md text-white text-[8px] font-black uppercase tracking-wider rounded-md border border-white/10">
              {tag}
            </span>
          ))}
        </div>
        <h3 className="text-white font-black text-base sm:text-lg leading-tight mb-1 tracking-tight truncate">{data.patientname || data.patient_name || data.patientName}</h3>
        <p className="text-white/70 text-[11px] font-bold line-clamp-1 uppercase tracking-wide leading-relaxed">{data.description}</p>
        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-[9px] text-white/50 font-black uppercase tracking-wider">
            <span>{data.doctor}</span>
            <span className="bg-white/10 px-2 py-0.5 rounded-full">{data.date}</span>
        </div>
      </div>
    </div>
  )
}


/* -------------------------------------------------------------------------- */
/*                             BEFORE / AFTER MODAL                           */
/* -------------------------------------------------------------------------- */
function CaseDetailModal({ data, onClose }) {
  const { t } = useTranslation();
  const [sliderPos, setSliderPos] = useState(50);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [color, setColor] = useState('#1499AD');
  
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // Update canvas internal resolution to match container size
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const parent = canvasRef.current.parentElement;
        const width = parent.clientWidth;
        const height = parent.clientHeight;
        
        // Save old drawing if any
        const ctx = canvasRef.current.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
        
        canvasRef.current.width = width;
        canvasRef.current.height = height;
        
        if(imgData.width > 0) ctx.putImageData(imgData, 0, 0); // basic restoration
      }
    };
    
    // Initial size
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
    e.preventDefault(); // prevent scrolling
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

  const handleSliderMove = (e) => {
    if (isDrawingMode) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = (x / rect.width) * 100;
    setSliderPos(percentage);
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 overflow-y-auto bg-white/95 backdrop-blur-3xl"
    >
      {/* HEADER TOOLS - Sticky for better mobile UX */}
      <div className="sticky top-0 right-0 left-0 flex items-center justify-end gap-3 p-4 lg:p-8 z-[60] bg-white/50 backdrop-blur-sm pointer-events-none">
        
        {/* Drawing Tools */}
        <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 p-1.5 rounded-2xl shadow-xl pointer-events-auto">
          <button 
            onClick={() => setIsDrawingMode(!isDrawingMode)}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${isDrawingMode ? 'bg-[#1499AD] text-white shadow-[0_0_15px_rgba(20,153,173,0.5)]' : 'text-slate-400 hover:text-white hover:bg-slate-200'}`}
          >
            <Pen className="w-4 h-4" />
          </button>
          
          {isDrawingMode && (
             <div className="flex items-center gap-1.5 px-2 border-l border-slate-300">
               {['#ef4444', '#eab308', '#22c55e', '#1499AD', '#000000'].map(c => (
                 <button 
                    key={c} 
                    onClick={() => setColor(c)}
                    className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-slate-900 scale-110' : 'border-white'}`}
                    style={{ backgroundColor: c }}
                 />
               ))}
               <button onClick={clearCanvas} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-500">
                 <Trash2 className="w-4 h-4" />
               </button>
             </div>
          )}
        </div>

        <button 
          onClick={onClose}
          className="w-10 h-10 bg-slate-200 text-slate-600 rounded-2xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors pointer-events-auto shadow-sm"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="w-full min-h-full flex flex-col xl:flex-row gap-6 p-4 lg:p-8 max-w-[1600px] mx-auto pb-20">
        
        {/* BIG SLIDER CONTAINER */}
        <div className="w-full xl:w-[75%] h-[50vh] sm:h-[60vh] xl:h-[85vh] relative rounded-[2rem] overflow-hidden bg-[#0C1222] border border-white/10 shadow-2xl flex-shrink-0"
             onMouseMove={handleSliderMove}
             onTouchMove={handleSliderMove}
        >
          {/* AFTER */}
          <div className="absolute inset-0 bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url(${data.images?.after || data.image_after})` }} />
          
          {/* BEFORE */}
          <div 
             className="absolute inset-0 bg-contain bg-center bg-no-repeat" 
             style={{ 
               backgroundImage: `url(${data.images?.before || data.image_before || data.images?.after || data.image_after})`,
               clipPath: `inset(0 ${100 - sliderPos}% 0 0)`
             }} 
          />

          {/* SLIDER HANDLE */}
          {!isDrawingMode && (
            <div 
              className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_15px_rgba(0,0,0,0.8)] cursor-col-resize flex items-center justify-center -translate-x-[50%]"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white rounded-full flex items-center justify-center shadow-2xl text-[#0C1222] border-4 border-[#0C1222]">
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5 ml-1" />
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 -ml-1" />
              </div>
            </div>
          )}

          {/* CANVAS FOR DRAWING OVERLAY */}
          <canvas
             ref={canvasRef}
             className={`absolute inset-0 z-10 w-full h-full ${isDrawingMode ? 'cursor-crosshair' : 'pointer-events-none'}`}
             onMouseDown={startDrawing}
             onMouseMove={draw}
             onMouseUp={stopDrawing}
             onMouseLeave={stopDrawing}
             onTouchStart={startDrawing}
             onTouchMove={draw}
             onTouchEnd={stopDrawing}
          />

          {/* LABELS */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 group/label pointer-events-none">
            <motion.div 
               initial={{ x: -20, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               className="bg-black/80 backdrop-blur-md px-4 py-2 rounded-xl text-white font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] border border-white/10 shadow-2xl"
            >
              {t('cases.detail.before') || "Oldin"} <span className="text-[8px] opacity-40 ml-1 font-bold">{t('cases.detail.status') || "Holat"}</span>
            </motion.div>
          </div>
          
          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 group/label pointer-events-none">
            <motion.div 
               initial={{ x: 20, opacity: 0 }}
               animate={{ x: 0, opacity: 1 }}
               className="bg-[#1499AD] backdrop-blur-md px-4 py-2 rounded-xl text-white font-black text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-xl shadow-[#1499AD]/40"
            >
              {t('cases.detail.after') || "Keyin"} <span className="text-[8px] text-white/50 ml-1 font-bold">{t('cases.detail.result') || "Natija"}</span>
            </motion.div>
          </div>
          
          {isDrawingMode && (
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl px-8 py-3.5 rounded-2xl border border-white/10 text-white text-[11px] font-black uppercase tracking-widest shadow-2xl pointer-events-none flex items-center gap-3"
            >
              <Pen className="w-4 h-4 text-[#1499AD]" />
              {t('cases.detail.canvasInstruction') || "Bemoringizga klinik holatni tushuntiring"}
            </motion.div>
          )}
        </div>

        {/* INFO PANEL */}
        <div className="w-full xl:w-[25%] bg-[#1A2235] p-6 sm:p-8 rounded-[2rem] border border-white/10 relative shadow-2xl min-h-fit">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#1499AD]/10 blur-[80px] rounded-full pointer-events-none" />
          
          <h2 className="text-2xl sm:text-3xl font-black text-white relative z-10 mb-2">{data.patientname || data.patient_name || data.patientName}</h2>
          <div className="inline-block bg-[#1499AD]/20 border border-[#1499AD]/30 text-[#1499AD] font-black text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-lg mb-6 sm:mb-8">
             {data.date}
          </div>
          
          <div className="space-y-6 sm:space-y-8 relative z-10">
            <div>
              <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                 <Sparkles className="w-3 h-3" /> {t('cases.detail.doctor') || "Davolovchi Shifokor"}
              </h4>
              <div className="flex items-center gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                 <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-black text-lg shadow-lg">
                   {(data.doctor || "D")[0]}
                 </div>
                 <span className="text-white font-bold text-base sm:text-lg">{data.doctor}</span>
              </div>
            </div>
            
            <div>
              <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">{t('cases.detail.tags') || "Teglar (Kategoriyalar)"}</h4>
              <div className="flex flex-wrap gap-2">
                {(data.tags || []).map(tag => (
                  <span key={tag} className="px-3 py-2 bg-[#0C1222] border border-white/10 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-inner">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <div className="pb-4">
              <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">{t('cases.detail.description') || "Tavsif va Izoh"}</h4>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed bg-white/5 p-4 sm:p-5 rounded-2xl border border-white/5 whitespace-pre-wrap">
                {data.description || (t('cases.detail.noDescription') || "Izoh kiritilmagan.")}
              </p>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  )
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
function CaseUploadModal({ isOpen, onClose, onSave, existingTags = [], patients = [], doctors = [] }) {
  const { t } = useTranslation();
  const [beforeImg, setBeforeImg] = useState(null);
  const [afterImg, setAfterImg] = useState(null);
  const [description, setDescription] = useState("");
 
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);
 
  const [selectedTags, setSelectedTags] = useState([]);

  // Telegram-style Cropper Modal State
  const [cropperState, setCropperState] = useState({
    isOpen: false,
    imageSrc: null,
    targetType: 'before' // 'before' | 'after'
  });
 
  useEffect(() => {
    if(doctors.length > 0 && !selectedDoctor) setSelectedDoctor(doctors[0]);
  }, [doctors, selectedDoctor]);
 
  if (!isOpen) return null;
 
  const handleImageUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCropperState({
          isOpen: true,
          imageSrc: reader.result,
          targetType: type
        });
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const handleApplyCroppedImage = (croppedDataUrl) => {
    if (cropperState.targetType === 'before') {
      setBeforeImg(croppedDataUrl);
    } else {
      setAfterImg(croppedDataUrl);
    }
    setCropperState({ isOpen: false, imageSrc: null, targetType: 'before' });
    toast.success("Rasm tahrirlandi va sifatli saqlandi!");
  };
 
  const handleSave = (e) => {
    if (e) e.preventDefault();
    if(!selectedPatient) {
      toast.error(t('cases.upload.errorSelectPatient') || "Iltimos bemorni tanlang");
      return;
    }
    if(!afterImg) {
      toast.error(t('cases.upload.errorUploadAfterImage') || "Kamida 'Keyin' rasmini yuklang");
      return;
    }
    
    // UI expects images.before and images.after
    const caseData = {
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
    };

    onSave(caseData);
    
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
  }).slice(0, 15);
 
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-md">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-3xl bg-white p-5 sm:p-7 rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.15)] relative max-h-[90vh] overflow-y-auto no-scrollbar border border-slate-100"
      >
        <button onClick={onClose} className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-slate-900 rounded-full transition-all cursor-pointer">
          <X className="w-4 h-4" />
        </button>
 
        <div className="mb-3">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-0.5 tracking-tight">{t('cases.upload.title') || "Yangi Keys Qo'shish"}</h2>
          <p className="text-slate-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest">{t('cases.upload.subtitle') || "Davolash natijalari portfoliosi"}</p>
        </div>

        {/* Memory Warning Alert in Upload Modal - Compact */}
        <div className="mb-3.5 bg-rose-50/90 border border-rose-200/70 rounded-xl px-3 py-1.5 flex items-center gap-2.5 shadow-xs">
          <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-3 h-3" />
          </div>
          <p className="text-xs font-bold text-rose-600 tracking-tight">
            Iltimos xotira to'lmasligi uchun sifatli rasmlarni yuklang
          </p>
        </div>

        {/* Before / After Upload Zones - Compact */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
           {/* BEFORE IMAGE UPLOAD */}
           <div className="h-40 sm:h-44 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center relative overflow-hidden group">
             {beforeImg ? (
               <div className="relative w-full h-full">
                 <img src={beforeImg} alt="Before" className="w-full h-full object-cover" />
                 
                 {/* Action Overlay */}
                 <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                   <button
                     type="button"
                     onClick={() => setCropperState({ isOpen: true, imageSrc: beforeImg, targetType: 'before' })}
                     className="px-3 py-1.5 rounded-lg bg-white text-slate-900 hover:bg-[#1499AD] hover:text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                   >
                     <Crop className="w-3 h-3" />
                     <span>Qirqish</span>
                   </button>
                   <button
                     type="button"
                     onClick={() => setBeforeImg(null)}
                     className="w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
                     title="O'chirish"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                 </div>

                 {/* Permanent Badge */}
                 <div className="absolute top-2.5 left-2.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-0.5 rounded-full text-white text-[9px] font-black uppercase tracking-wider pointer-events-none">
                   "Oldin" holati
                 </div>
               </div>
             ) : (
               <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:border-[#1499AD] transition-colors p-4">
                 <input type="file" accept="image/*" className="hidden" capture="environment" onChange={(e) => handleImageUpload(e, 'before')} />
                 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-300 mb-2 shadow-xs group-hover:text-[#1499AD] transition-colors">
                   <ImageIcon className="w-5 h-5" />
                 </div>
                 <span className="text-slate-500 font-black text-xs uppercase tracking-wider block">{t('cases.upload.beforePhoto') || "\"Oldin\" holati"}</span>
                 <span className="text-slate-400 text-[9px] font-bold mt-0.5">Rasm yuklash & Qirqish</span>
               </label>
             )}
           </div>

           {/* AFTER IMAGE UPLOAD */}
           <div className="h-40 sm:h-44 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/20 flex flex-col items-center justify-center relative overflow-hidden group">
             {afterImg ? (
               <div className="relative w-full h-full">
                 <img src={afterImg} alt="After" className="w-full h-full object-cover" />
                 
                 {/* Action Overlay */}
                 <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                   <button
                     type="button"
                     onClick={() => setCropperState({ isOpen: true, imageSrc: afterImg, targetType: 'after' })}
                     className="px-3 py-1.5 rounded-lg bg-white text-slate-900 hover:bg-emerald-600 hover:text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                   >
                     <Crop className="w-3 h-3" />
                     <span>Qirqish</span>
                   </button>
                   <button
                     type="button"
                     onClick={() => setAfterImg(null)}
                     className="w-8 h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center shadow-md transition-all cursor-pointer"
                     title="O'chirish"
                   >
                     <Trash2 className="w-3.5 h-3.5" />
                   </button>
                 </div>

                 {/* Permanent Badge */}
                 <div className="absolute top-2.5 left-2.5 bg-emerald-600 px-2.5 py-0.5 rounded-full text-white text-[9px] font-black uppercase tracking-wider pointer-events-none">
                   "Keyin" holati
                 </div>
               </div>
             ) : (
               <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors p-4">
                 <input type="file" accept="image/*" className="hidden" capture="environment" onChange={(e) => handleImageUpload(e, 'after')} />
                 <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-emerald-400 mb-2 shadow-xs group-hover:text-emerald-500 transition-colors">
                   <Sparkles className="w-5 h-5" />
                 </div>
                 <span className="text-emerald-600 font-black text-xs uppercase tracking-wider block">{t('cases.upload.afterPhoto') || "\"Keyin\" holati"}</span>
                 <span className="text-emerald-600/70 text-[9px] font-bold mt-0.5">Rasm yuklash & Qirqish</span>
               </label>
             )}
           </div>
        </div>

        {/* Telegram-style Image Cropper Modal */}
        <TelegramImageCropper
          isOpen={cropperState.isOpen}
          imageSrc={cropperState.imageSrc}
          title={cropperState.targetType === 'before' ? "\"Oldin\" rasmini tahrirlash va qirqish" : "\"Keyin\" rasmini tahrirlash va qirqish"}
          onClose={() => setCropperState({ isOpen: false, imageSrc: null, targetType: 'before' })}
          onApply={handleApplyCroppedImage}
        />
 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          <div className="space-y-3.5">
            {/* Shifokor */}
            <div>
               <label className="text-slate-400 text-[10px] font-black uppercase tracking-widest ml-1 mb-1.5 block">{t('cases.upload.doctor') || "Davolovchi Shifokor"}</label>
               <div className="flex flex-wrap gap-1.5">
                 {doctors.map(doc => (
                   <button 
                     key={doc}
                     type="button"
                     onClick={() => setSelectedDoctor(doc)}
                     className={`px-3 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all border cursor-pointer ${selectedDoctor === doc ? 'bg-slate-900 border-slate-900 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800'}`}
                   >
                     {doc}
                   </button>
                 ))}
               </div>
            </div>
 
            {/* Bemor qidiruv */}
            <div className="relative">
               <label className="text-slate-400 text-[10px] font-black uppercase tracking-widest ml-1 mb-1.5 block">{t('cases.upload.selectPatient') || "Bemorni tanlash"}</label>
               
               {selectedPatient ? (
                  <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-2.5 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-[#1499AD] text-white rounded-lg flex items-center justify-center font-black text-xs shadow-xs">
                        {(selectedPatient.full_name || selectedPatient.name)[0]}
                      </div>
                      <div>
                        <div className="text-slate-900 font-black text-xs leading-tight">{selectedPatient.full_name || selectedPatient.name}</div>
                        <div className="text-slate-400 text-[9px] font-bold tracking-wider">{selectedPatient.phone || "—"}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedPatient(null)} className="text-slate-300 hover:text-rose-500 transition-colors p-1.5 bg-white rounded-lg shadow-xs cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
               ) : (
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 pointer-events-none" />
                    <Input 
                      value={patientSearch}
                      onChange={e => {
                        setPatientSearch(e.target.value);
                        setShowPatientDropdown(true);
                      }}
                      onFocus={() => setShowPatientDropdown(true)}
                      placeholder={t('cases.upload.patientSearchPlaceholder') || "Bemorning ismi yoki raqami..."} 
                      className="bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-300 h-10 pl-10 rounded-xl text-xs focus:ring-2 focus:ring-[#1499AD]/10 focus:border-[#1499AD]" 
                    />
                    
                    {showPatientDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-100 rounded-2xl shadow-xl max-h-48 overflow-y-auto no-scrollbar z-20">
                        {filteredPatients.length > 0 ? (
                          filteredPatients.map(p => (
                            <div 
                              key={p.id} 
                              onClick={() => {
                                setSelectedPatient(p);
                                setShowPatientDropdown(false);
                              }}
                              className="p-3 border-b border-slate-50 hover:bg-slate-50 cursor-pointer flex justify-between items-center transition-colors"
                            >
                              <span className="text-slate-900 text-xs font-black">{p.full_name || p.name}</span>
                              <span className="text-slate-400 text-[9px] font-bold">{p.phone || "—"}</span>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-slate-400 text-xs text-center font-medium">{t('cases.upload.noPatientsFound') || "Bemor topilmadi..."}</div>
                        )}
                      </div>
                    )}
                  </div>
               )}
            </div>
          </div>
 
          <div className="space-y-3.5">
            {/* Kategoriyalar (Tags) */}
            <div>
               <label className="text-slate-400 text-[10px] font-black uppercase tracking-widest ml-1 mb-1.5 block">{t('cases.upload.categories') || "Kategoriya / Teglar"}</label>
               <div className="flex flex-wrap gap-1.5">
                 {existingTags.map(tag => (
                   <button
                     key={tag}
                     type="button"
                     onClick={() => toggleTag(tag)}
                     className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border cursor-pointer ${selectedTags.includes(tag) ? 'bg-[#1499AD] border-[#1499AD] text-white shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-800'}`}
                   >
                     {tag}
                   </button>
                 ))}
                 <button
                   type="button"
                   onClick={() => {
                     const n = window.prompt(t('cases.upload.promptNewCategory') || "Yangi kategoriya:");
                     if(n && n.trim()) {
                       toggleTag(n.trim());
                     }
                   }}
                   className="px-2.5 py-1.5 rounded-xl text-[10px] font-black border border-dashed border-slate-200 text-slate-400 hover:border-[#1499AD] hover:text-[#1499AD] transition-all cursor-pointer flex items-center gap-1"
                 >
                   <Plus className="w-3 h-3" />
                 </button>
               </div>
            </div>
 
            <div>
               <label className="text-slate-400 text-[10px] font-black uppercase tracking-widest ml-1 mb-1.5 block">{t('cases.upload.detailedNote') || "Batafsil Izoh (ixtiyoriy)"}</label>
              <textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder={t('cases.upload.notePlaceholder') || "Davolash jarayoni haqida qisqacha izoh..."} 
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-300 p-3 rounded-2xl focus:ring-2 focus:ring-[#1499AD]/10 focus:border-[#1499AD] outline-none min-h-[75px] text-xs leading-relaxed" 
              />
            </div>
          </div>
        </div>
 
        <div className="flex items-center justify-end gap-3 mt-4 pt-3 border-t border-slate-100">
          <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-slate-900 hover:bg-slate-50 h-10 px-5 rounded-xl font-bold text-xs uppercase tracking-wider">{t('common.cancel') || "BEKOR QILISH"}</Button>
          <Button type="button" onClick={handleSave} className="bg-[#1499AD] hover:bg-[#0E7A8A] text-white h-10 px-7 rounded-xl font-black text-xs uppercase tracking-wider shadow-md shadow-[#1499AD]/20">{t('cases.upload.saveCase') || "KEYS SAQLASH"}</Button>
        </div>
      </motion.div>
    </div>
  )
}

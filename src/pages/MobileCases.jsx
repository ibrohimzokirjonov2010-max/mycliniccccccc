import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Search, Image as ImageIcon, Sparkles, X, ChevronRight, ChevronLeft, ArrowLeft, Pen, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { db } from '@/api/supabaseClient';
import { toast } from 'sonner';

// Reuse mock data for now
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
      before: "https://images.unsplash.com/photo-1598256989800-fea5ce5146f2?auto=format&fit=crop&q=80&w=400",
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

export default function MobileCases() {
  const [cases, setCases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTag, setActiveTag] = useState("Barchasi");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCase, setSelectedCase] = useState(null);
  const navigate = useNavigate();
  const [dbPatients, setDbPatients] = useState([]);
  const [dbDoctors, setDbDoctors] = useState([]);
  const [customTags, setCustomTags] = useState([]);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

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
          // Only use mock data if DB is completely unreachable or first time fetch fails
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
                          tags.join("").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag = activeTag === "Barchasi" || tags.includes(activeTag);
    return matchesSearch && matchesTag;
  });

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 pb-32">
      
      {/* HEADER */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-4 pt-6 pb-4">
        <div className="flex items-center justify-between mb-4">
           <button onClick={() => navigate(-1)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600">
             <ArrowLeft className="w-5 h-5" />
           </button>
           <h1 className="text-xl font-black uppercase tracking-widest text-[#1499AD]">Keyslar</h1>
           <div className="w-10" />
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

      {/* FILTER TAGS */}
      <div className="px-4 py-3">
         <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(tag)}
                className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all duration-300 ${
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
              className="shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap bg-white border border-dashed border-[#1499AD] text-[#1499AD] flex items-center gap-1 active:scale-95 transition-transform"
            >
              <Sparkles className="w-3 h-3" />
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
             <div className="py-20 flex flex-col items-center justify-center text-slate-500">
               <ImageIcon className="w-12 h-12 mb-3 opacity-30" />
               <p className="font-bold text-sm">Keyslar topilmadi</p>
             </div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* FLOATING ACTION BUTTON (FAB) */}
      <div className="fixed bottom-24 right-4 z-40">
         <button 
           onClick={() => setIsModalOpen(true)}
           className="w-14 h-14 bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-full flex items-center justify-center text-white shadow-[0_8px_30px_rgb(20,153,173,0.3)] active:scale-95 transition-transform"
         >
           <Camera className="w-6 h-6" />
         </button>
      </div>

      {/* BEFORE/AFTER MOBILE VIEWER */}
      <AnimatePresence>
         {selectedCase && (
           <MobileCaseViewer data={selectedCase} onClose={() => setSelectedCase(null)} />
         )}
      </AnimatePresence>

      <MobileUploadModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        existingTags={ALL_TAGS.filter(t => t !== "Barchasi")}
        patients={dbPatients}
        doctors={dbDoctors.map(d => d.name || d.full_name)}
        onSave={async (newCase) => {
          const loadingToast = toast.loading("Rasmlar bazaga yuklanmoqda...");
          try {
             // 1. Upload images to storage (essential for mobile high-res photos)
             let finalImages = { ...newCase.images };
             const timestamp = Date.now();
             const patientSlug = (newCase.patientname || 'case').replace(/\s+/g, '_').toLowerCase();

             try {
                if (newCase.images.before && newCase.images.before.startsWith('data:')) {
                   const beforeUrl = await db.storage.uploadFile('cases', `${clinicId}/${patientSlug}_${timestamp}_before.jpg`, newCase.images.before);
                   finalImages.before = beforeUrl;
                }
                if (newCase.images.after && newCase.images.after.startsWith('data:')) {
                   const afterUrl = await db.storage.uploadFile('cases', `${clinicId}/${patientSlug}_${timestamp}_after.jpg`, newCase.images.after);
                   finalImages.after = afterUrl;
                }
             } catch (storageErr) {
                console.warn("Storage upload failed, using original format:", storageErr);
             }

             // 2. Save record
             const caseToSave = {
                ...newCase,
                images: finalImages,
                clinic_id: clinicId
             };
             
             const saved = await base44.entities.Case.create(caseToSave);
             if (saved) {
                setCases(prev => [saved, ...prev]);
                toast.success("Keys muvaffaqiyatli saqlandi!", { id: loadingToast });
                setIsModalOpen(false);
             }
          } catch (e) {
             console.error(e);
             toast.error("Xatolik: Ma'lumotni saqlab bo'lmadi", { id: loadingToast });
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
function MobileCaseViewer({ data, onClose }) {
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
        </div>

      </div>
    </motion.div>
  )
}

/* -------------------------------------------------------------------------- */
/*                          MOBILE UPLOAD MODAL                               */
/* -------------------------------------------------------------------------- */
function MobileUploadModal({ isOpen, onClose, onSave, existingTags = [], patients = [], doctors = [] }) {
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
  }).slice(0, 15);

  return (
    <motion.div 
      initial={{ opacity: 0, y: "100%" }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: "100%" }}
      className="fixed inset-0 z-[60] bg-white flex flex-col"
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-white">
        <button onClick={onClose} className="text-slate-400 font-bold p-2 -ml-2">BEKOR</button>
        <span className="text-slate-900 font-black text-xs uppercase tracking-[0.2em]">Yangi Keys Qo'shish</span>
        <button onClick={handleSave} className="text-[#1499AD] font-black uppercase p-3 bg-[#1499AD]/10 rounded-xl text-xs tracking-widest">SAQLASH</button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-8 pb-32 bg-slate-50/30">
        
        {/* Upload Buttons */}
        <div className="grid grid-cols-2 gap-4">
          <label className="aspect-square bg-white border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 relative overflow-hidden transition-colors hover:border-[#1499AD]">
             <input type="file" accept="image/*" className="hidden" capture="environment" onChange={(e) => handleImageUpload(e, 'before')} />
             {beforeImg ? (
                <img src={beforeImg} alt="Before" className="w-full h-full object-cover" />
             ) : (
               <>
                 <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-300">
                   <Camera className="w-6 h-6" />
                 </div>
                 <div className="text-center">
                   <div className="text-slate-400 font-black text-[10px] uppercase tracking-widest">"Oldin" rasm</div>
                 </div>
               </>
             )}
          </label>

          <label className="aspect-square bg-white border-2 border-dashed border-emerald-200 rounded-[2rem] flex flex-col items-center justify-center gap-3 relative overflow-hidden transition-colors hover:border-emerald-500">
             <input type="file" accept="image/*" className="hidden" capture="environment" onChange={(e) => handleImageUpload(e, 'after')} />
             {afterImg ? (
                <img src={afterImg} alt="After" className="w-full h-full object-cover" />
             ) : (
               <>
                 <div className="w-14 h-14 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-400">
                   <Sparkles className="w-6 h-6" />
                 </div>
                 <div className="text-center">
                   <div className="text-emerald-500 font-black text-[10px] uppercase tracking-widest">"Keyin" rasm</div>
                 </div>
               </>
             )}
          </label>
        </div>

        {/* Shifokor */}
        <div>
           <label className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] ml-1 mb-3 block">Davolovchi Shifokor</label>
           <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
             {doctors.length > 0 ? doctors.map(doc => (
               <button 
                 key={doc}
                 onClick={() => setSelectedDoctor(doc)}
                 className={`shrink-0 px-5 py-3 rounded-2xl text-[11px] font-black whitespace-nowrap transition-all border ${selectedDoctor === doc ? 'bg-[#1499AD] border-[#1499AD] text-white shadow-lg shadow-[#1499AD]/20' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
               >
                 {doc}
               </button>
             )) : (
                 <span className="text-slate-500 text-[10px] py-1 block italic">Shifokorlar mavjud emas</span>
             )}
           </div>
        </div>

        {/* Bemor */}
        <div className="relative">
           <label className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] ml-1 mb-3 block">Bemorni tanlash</label>
           
           {selectedPatient ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-100 p-5 rounded-[2rem]">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center font-black text-lg shadow-md shadow-emerald-500/30">
                      { (selectedPatient.full_name || selectedPatient.name)[0] }
                   </div>
                   <div>
                     <div className="text-slate-800 font-black text-sm">{selectedPatient.full_name || selectedPatient.name}</div>
                     <div className="text-emerald-600 text-xs font-bold mt-0.5">{selectedPatient.phone || "Telefon kiritilmagan"}</div>
                   </div>
                </div>
                <button onClick={() => setSelectedPatient(null)} className="text-slate-300 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                  <X className="w-5 h-5" />
                </button>
              </div>
           ) : (
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <Input 
                  value={patientSearch}
                  onChange={e => {
                    setPatientSearch(e.target.value);
                    setShowPatientDropdown(true);
                  }}
                  onFocus={() => setShowPatientDropdown(true)}
                  placeholder="Bemorning ismi yoki raqami..." 
                  className="bg-white border-slate-200 text-slate-800 placeholder:text-slate-300 h-16 pl-14 rounded-[2rem] focus:ring-0 focus:border-[#1499AD]" 
                />
                
                {showPatientDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-[2rem] shadow-2xl shadow-slate-200/50 max-h-60 overflow-y-auto no-scrollbar z-20">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map(p => (
                        <div 
                          key={p.id} 
                          onClick={() => {
                            setSelectedPatient(p);
                            setShowPatientDropdown(false);
                          }}
                          className="p-5 border-b border-slate-50 cursor-pointer flex justify-between items-center active:bg-slate-50"
                        >
                          <div className="flex flex-col">
                             <span className="text-slate-800 text-sm font-black">{p.full_name || p.name}</span>
                             <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">{p.phone || "—"}</span>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300" />
                        </div>
                      ))
                    ) : (
                      <div className="p-10 text-slate-400 text-sm text-center font-bold">Bemor topilmadi...</div>
                    )}
                  </div>
                )}
              </div>
           )}
        </div>

        {/* Kategoriyalar (Tags) */}
        <div>
           <label className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] ml-1 mb-3 block">Kategoriya / Teglar</label>
           <div className="flex flex-wrap gap-2">
             {existingTags.length > 0 ? existingTags.map(tag => (
               <button
                 key={tag}
                 onClick={() => toggleTag(tag)}
                 className={`px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all border ${selectedTags.includes(tag) ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-400 hover:text-slate-600'}`}
               >
                 {tag}
               </button>
             )) : (
               <span className="text-slate-500 text-xs">Kategoriyalar mavjud emas</span>
             )}
           </div>
        </div>

        <div>
          <label className="text-slate-400 text-[10px] font-black uppercase tracking-[0.1em] ml-1 mb-3 block">Batafsil Izoh (ixtiyoriy)</label>
          <textarea 
            value={description}
            onChange={e => setDescription(e.target.value)}
            className="w-full bg-white border border-slate-200 p-5 rounded-[2rem] text-slate-800 placeholder:text-slate-300 min-h-[140px] outline-none focus:border-[#1499AD] text-sm leading-relaxed" 
            placeholder="Bajarilgan ishlar haqida batafsil ma'lumot..."
          />
        </div>

      </div>
    </motion.div>
  )
}

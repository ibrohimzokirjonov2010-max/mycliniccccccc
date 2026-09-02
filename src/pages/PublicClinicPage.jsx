import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, Phone, Send, 
  Instagram, ChevronRight, Calendar, CheckCircle2,
  X, ChevronLeft, Star,
  ShieldCheck, AlertCircle, Sparkles, ExternalLink
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

// ─── Official Authentic Telegram Vector Icon ────────────────────────────────
function TelegramOfficialIcon({ className = "w-10 h-10" }) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none">
      <circle cx="24" cy="24" r="24" fill="url(#tg_official_gradient)" />
      <path 
        d="M10.2 23.4l24.6-9.8c1.1-.4 2.1.3 1.8 1.9l-4.2 19.8c-.3 1.4-1.1 1.7-2.3 1.1l-6.4-4.7-3.1 3c-.3.3-.6.6-1.3.6l.5-6.5 11.9-10.8c.5-.5-.1-.7-.8-.3L16.2 26.5l-6.4-2c-1.4-.4-1.4-1.4.4-1.1z" 
        fill="#ffffff" 
      />
      <defs>
        <linearGradient id="tg_official_gradient" x1="24" y1="0" x2="24" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2AABEE" />
          <stop offset="1" stopColor="#229ED9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ─── Official Yandex Maps Icon ──────────────────────────────────────────────
function YandexMapsIcon({ className = "w-10 h-10" }) {
  return (
    <div className={`${className} bg-gradient-to-tr from-[#e52d27] to-[#fc3f1d] rounded-full flex items-center justify-center shadow-xs text-white shrink-0`}>
      <MapPin className="w-5 h-5 text-white fill-white" />
    </div>
  );
}

// Extract coords and build clean embeddable map widget
const getMapEmbedUrl = (link) => {
  let lat = 41.311081;
  let lng = 69.240562;

  if (link) {
    const ptMatch = link.match(/[?&](?:pt|ll)=([0-9.]+)[, ]+([0-9.]+)/);
    if (ptMatch) {
      lng = parseFloat(ptMatch[1]);
      lat = parseFloat(ptMatch[2]);
    }
  }

  return `https://yandex.ru/map-widget/v1/?ll=${lng},${lat}&z=16&pt=${lng},${lat},pm2rdm`;
};

export default function PublicClinicPage() {
  const { slug } = useParams();
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [doctors, setDoctors] = useState([]);
  
  // Booking state
  const [showBooking, setShowBooking] = useState(false);
  const [step, setStep] = useState(1); // 1: Doctor, 2: Date/Time, 3: Contact Info
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTime, setSelectedTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const [patientInfo, setPatientInfo] = useState({
    name: '',
    phone: '',
    notes: ''
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const clinics = await base44.clinic.getAll();
        const found = clinics.find(c => 
          c.slug === slug || 
          c.id === slug || 
          c.id?.replace(/-/g, '') === slug?.replace(/-/g, '')
        );
        
        if (found) {
          setClinic(found);
          // Fetch clinic doctors using the FOUND clinic's canonical ID
          const clinicUsers = await base44.auth.getUsers(found.id);
          setDoctors(clinicUsers.filter(u => 
            u.role?.toLowerCase().includes('doctor') || 
            u.role?.toLowerCase() === 'admin'
          ));
        }
      } catch (err) {
        console.error('Failed to load clinic:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [slug]);

  // Robust date normalizer: converts '2026-09-03', '03.09.2026', '03-09-2026', ISO to 'YYYY-MM-DD'
  const normalizeToDateOnly = (dateStr) => {
    if (!dateStr) return '';
    const clean = String(dateStr).split('T')[0].trim().replace(/[\/\.]/g, '-');
    const parts = clean.split('-');
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return clean;
  };

  const getMinutes = (timeStr) => {
    if (!timeStr) return 0;
    const parts = String(timeStr).split(':').map(Number);
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  };

  // Load available slots when doctor or date changes
  useEffect(() => {
    if (selectedDoctor && selectedDate && clinic) {
      setSelectedTime(null); // Reset previously picked time
      loadSlots();
    }
  }, [selectedDoctor, selectedDate, clinic]);

  const loadSlots = async () => {
    if (!selectedDoctor || !clinic) return;
    setLoadingSlots(true);
    
    try {
      // 1. Get FRESH appointments directly from Supabase (bypasses 3-min in-memory RequestCache)
      let appointments = [];
      if (import.meta.env.VITE_SUPABASE_URL) {
        const { data, error } = await supabase
          .from('appointments')
          .select('*')
          .eq('clinic_id', clinic.id);
        if (!error && data) {
          appointments = data;
        }
      }
      
      // Fallback to entities loader if Supabase direct query returned empty or failed
      if (!appointments || appointments.length === 0) {
        appointments = await base44.entities.Appointment.filter({ 
          clinic_id: clinic.id 
        });
      }
      
      const normUiDate = normalizeToDateOnly(selectedDate);

      const doctorAppointments = (appointments || []).filter(a => {
        if (!a.date) return false;
        
        // Normalize DB appointment date
        const normDbDate = normalizeToDateOnly(a.date);
        const dateMatch = normDbDate === normUiDate;
        
        // Match doctor by ID or by Name (case-insensitive)
        const docIdA = String(a.doctor_id || '').trim().toLowerCase();
        const docIdB = String(selectedDoctor.id || '').trim().toLowerCase();
        const docNameA = String(a.doctor_name || '').trim().toLowerCase();
        const docNameB = String(selectedDoctor.name || '').trim().toLowerCase();
        
        const docMatch = (docIdA && docIdB && docIdA === docIdB) || (docNameA && docNameB && docNameA === docNameB);
        return docMatch && dateMatch && a.status !== 'Cancelled';
      });

      console.log('📅 Found busy appointments for', selectedDoctor.name, 'on', normUiDate, ':', doctorAppointments.length);

      // 2. Determine working hours
      let startHour = 8;
      let endHour = 20;
      
      const wh = clinic.working_hours || "";
      const match = wh.match(/(\d{1,2})[:.](\d{2})\s*[- ]\s*(\d{1,2})[:.](\d{2})/);
      
      if (match) {
        startHour = parseInt(match[1]);
        endHour = parseInt(match[3]);
      }

      // 3. Generate 30-min slots
      const slots = [];
      const currentNow = new Date();
      const todayStr = normalizeToDateOnly(currentNow.toISOString());
      const isToday = normUiDate === todayStr;
      
      const currentTotalMin = currentNow.getHours() * 60 + currentNow.getMinutes();

      for (let hour = startHour; hour < endHour; hour++) {
        const timeConfigs = ['00', '30'];
        
        for (const min of timeConfigs) {
          const time = `${hour.toString().padStart(2, '0')}:${min}`;
          const slotMin = getMinutes(time);
          
          // Skip past times if booking for today
          if (isToday) {
            if (slotMin <= currentTotalMin + 45) continue; // 45 min buffer
          }

          // Check if slot falls within any existing appointment
          const isBusy = doctorAppointments.some(a => {
            if (!a.time) return false;
            const apptStartMin = getMinutes(a.time);
            const duration = Number(a.duration || a.duration_minutes || 30);
            const apptEndMin = apptStartMin + (duration > 0 ? duration : 30);
            return slotMin >= apptStartMin && slotMin < apptEndMin;
          });

          if (!isBusy) {
            slots.push(time);
          }
        }
      }
      
      setAvailableSlots(slots);
    } catch (err) {
      console.error('❌ Failed to load slots:', err);
      toast.error('Vaqtlarni yuklashda xatolik');
    } finally {
      setLoadingSlots(false);
    }
  };

  const [submitting, setSubmitting] = useState(false);

  const handleBookingSubmit = async () => {
    if (!patientInfo.name || !patientInfo.phone || !selectedTime) {
      toast.error('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }

    setSubmitting(true);
    console.log('🚀 Submitting booking...', { clinic_id: clinic.id, doctor_id: selectedDoctor.id });

    try {
      // 1. Create/Find a Patient record to ensure visibility in CRM
      // For public bookings, we create a patient record first
      const patientData = {
        clinic_id: String(clinic.id),
        full_name: patientInfo.name,
        phone: patientInfo.phone,
        status: 'Active',
        notes: '[ONLINE YOZILISH] Public sahifa orqali'
      };
      
      const newPatient = await base44.entities.Patient.create(patientData);

      // 2. Create a Lead (Lid)
      const leadData = {
        clinic_id: String(clinic.id),
        name: patientInfo.name,
        phone: patientInfo.phone,
        notes: `Shifokor: ${selectedDoctor.name}. Xabar: ${patientInfo.notes}`,
        status: 'new', // Matches Leads.jsx columns
        source: 'Website',
        created_date: new Date().toISOString() // Standardized column name
      };

      await base44.entities.Lead.create(leadData);

      // 3. Create a Pending Appointment linked to the patient
      const appointmentData = {
        clinic_id: String(clinic.id),
        doctor_id: String(selectedDoctor.id),
        doctor_name: selectedDoctor.name,
        patient_id: newPatient.id,
        patient_name: patientInfo.name,
        patient_phone: patientInfo.phone,
        date: selectedDate.trim(),
        time: selectedTime.trim(),
        status: 'Scheduled',
        service_name: 'Online yozilish',
        price: 0,
        duration: 30,
        notes: `ONLINE YOZILISH. Izoh: ${patientInfo.notes}`,
        created_date: new Date().toISOString()
      };

      await base44.entities.Appointment.create(appointmentData);

      console.log('✅ Booking completed with patient linking');
      setStep(4);
      toast.success('Arizangiz muvaffaqiyatli qabul qilindi!');
    } catch (err) {
      console.error('❌ Booking failed:', err);
      toast.error('Xatolik: ' + (err.message || 'Saqlashda xato yuz berdi'));
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#0f8fa0] to-[#0a6b7a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-sm font-bold text-white/60 uppercase tracking-widest">Yuklanmoqda...</p>
        </div>
      </div>
    );
  }

  if (!clinic) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
          <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
            <AlertCircle className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-black text-slate-900">Klinika topilmadi</h2>
          <p className="text-slate-500">Havola noto'g'ri yoki klinika ommaviy sahifasini o'chirgan.</p>
          <Button onClick={() => window.location.href = '/'} className="bg-slate-900">Bosh sahifaga qaytish</Button>
        </div>
      </div>
    );
  }

  const services = [
    { name: 'Terapiya', desc: "Og'riqsiz davolash", icon: Star, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-100' },
    { name: 'Ortopediya', desc: 'Vinir va karonkalar', icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { name: 'Xirurgiya', desc: 'Implantatsiya', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
    { name: 'Gigiyena', desc: 'Tishlarni oqartirish', icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ];

  return (
    <div className="min-h-screen h-full overflow-y-auto bg-[#f4f7f9] font-sans pb-28 overflow-x-hidden">

      {/* ── HERO ───────────────────────────────────────────────── */}
      <div className="relative bg-gradient-to-br from-[#1499AD] via-[#0f8fa0] to-[#0a6b7a] pt-14 pb-24 px-5 text-center overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative inline-flex mb-5"
        >
          <div className="w-20 h-20 bg-white/15 backdrop-blur-xl rounded-[22px] flex items-center justify-center border border-white/25 shadow-2xl overflow-hidden">
            {clinic.logo ? (
              <img src={clinic.logo} alt="Logo" className="w-16 h-16 object-contain" />
            ) : (
              <span className="text-3xl font-black text-white">{clinic.name?.[0]}</span>
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-400 rounded-xl flex items-center justify-center border-2 border-white shadow-lg">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
        </motion.div>

        {/* Clinic Name */}
        <motion.h1
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="text-2xl font-black text-white mb-2 tracking-tight leading-tight"
        >
          {clinic.name}
        </motion.h1>

        {/* Description */}
        {clinic.description && (
          <motion.p
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.14 }}
            className="text-sm text-white/75 max-w-xs mx-auto leading-relaxed font-medium"
          >
            {clinic.description.length > 120 ? clinic.description.slice(0, 120) + '...' : clinic.description}
          </motion.p>
        )}
      </div>

      {/* ── FLOATING INFO CARD ──────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 -mt-10 relative z-10">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-xl shadow-slate-200/80 border border-slate-100 overflow-hidden"
        >
          {/* Address row */}
          <a
            href={clinic.yandex_map_link ? (clinic.yandex_map_link.startsWith('http') ? clinic.yandex_map_link : `https://${clinic.yandex_map_link}`) : '#'}
            target={clinic.yandex_map_link ? "_blank" : "_self"}
            rel="noreferrer"
            className="flex items-center gap-3 px-5 py-4 border-b border-slate-50 hover:bg-slate-50/80 transition-colors group cursor-pointer"
          >
            <div className="w-10 h-10 bg-indigo-50 group-hover:bg-rose-50 rounded-2xl flex items-center justify-center shrink-0 transition-colors">
              <MapPin className="w-4 h-4 text-indigo-500 group-hover:text-rose-500 transition-colors" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Manzil</p>
              <p className="text-[13px] font-bold text-slate-800 truncate">
                {clinic.address || "Manzil ko'rsatilmagan"}
              </p>
            </div>
            {clinic.yandex_map_link && (
              <div
                className="w-9 h-9 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 group-hover:bg-rose-50 group-hover:border-rose-100 transition-colors shrink-0"
                title="Xaritada ko'rish"
              >
                <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-rose-500 transition-colors" />
              </div>
            )}
          </a>

          {/* Working hours row */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Ish vaqti</p>
              <p className="text-[13px] font-bold text-slate-800">{clinic.working_hours || '09:00 – 18:00'}</p>
            </div>
            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-lg tracking-wider">
              OCHIQ
            </span>
          </div>
        </motion.div>
      </div>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <div className="max-w-md mx-auto px-4 mt-8 space-y-8">

        {/* BOOK BUTTON */}
        <motion.button
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.28 }}
          onClick={() => setShowBooking(true)}
          className="w-full group relative bg-gradient-to-r from-[#1499AD] to-[#0d7a8c] text-white py-4 rounded-2xl font-black text-sm shadow-lg shadow-[#1499AD]/25 active:scale-95 transition-all flex items-center justify-center gap-2.5 overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
          <Calendar className="w-5 h-5" />
          <span>ONLINE NAVBAT OLISH</span>
          <Sparkles className="w-4 h-4 text-white/50 group-hover:text-yellow-300 transition-colors" />
        </motion.button>

        {/* SERVICES */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-black text-slate-900 tracking-tight">Xizmatlarimiz</h2>
            <div className="h-px bg-slate-200 flex-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {services.map((s, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + idx * 0.06 }}
                className={`bg-white rounded-2xl p-4 border ${s.border} shadow-sm flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer`}
              >
                <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[13px] font-black text-slate-900 leading-tight">{s.name}</p>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5 uppercase tracking-tight">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* INTERACTIVE MAP EMBED SECTION */}
        {(clinic.yandex_map_link || clinic.address) && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Klinika joylashuvi</h2>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Map Iframe */}
              <div className="h-52 w-full bg-slate-100 relative">
                <iframe
                  title="Yandex Maps Widget"
                  src={getMapEmbedUrl(clinic.yandex_map_link)}
                  className="w-full h-full border-0 pointer-events-auto"
                />
              </div>

              {/* Address row with direct Yandex Maps launcher button */}
              <div className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-rose-50 text-[#fc3f1d] flex items-center justify-center shrink-0">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{clinic.address || "Toshkent shahri"}</p>
                    <p className="text-[10px] text-slate-400 font-medium">Yandex Maps orqali yo'nalish olish</p>
                  </div>
                </div>

                <a
                  href={clinic.yandex_map_link ? (clinic.yandex_map_link.startsWith('http') ? clinic.yandex_map_link : `https://${clinic.yandex_map_link}`) : `https://yandex.uz/maps/?text=${encodeURIComponent(clinic.address || clinic.name)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 bg-[#fc3f1d] text-white rounded-xl text-xs font-bold shrink-0 hover:bg-[#e03415] transition-colors flex items-center gap-1.5 shadow-sm shadow-[#fc3f1d]/20"
                >
                  <span>Xaritada ochish</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </section>
        )}

        {/* SOCIAL LINKS */}
        {(clinic.telegram_link || clinic.instagram_link || clinic.whatsapp_link || clinic.yandex_map_link) && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">Bog'lanish</h2>
              <div className="h-px bg-slate-200 flex-1" />
            </div>

            <div className="flex flex-col gap-2.5">
              {clinic.telegram_link && (
                <a
                  href={clinic.telegram_link.startsWith('http') ? clinic.telegram_link : `https://t.me/${clinic.telegram_link.replace('@', '')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 flex items-center justify-center shrink-0 rounded-full overflow-hidden shadow-xs">
                    <TelegramOfficialIcon className="w-10 h-10" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Telegram</p>
                    <p className="text-[13px] font-bold text-slate-800 truncate">{clinic.telegram_link}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#229ED9] transition-colors" />
                </a>
              )}
              {clinic.instagram_link && (
                <a
                  href={clinic.instagram_link.startsWith('http') ? clinic.instagram_link : `https://instagram.com/${clinic.instagram_link.replace('@', '')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] shadow-xs">
                    <Instagram className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Instagram</p>
                    <p className="text-[13px] font-bold text-slate-800 truncate">{clinic.instagram_link}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-pink-400 transition-colors" />
                </a>
              )}
              {clinic.whatsapp_link && (
                <a
                  href={clinic.whatsapp_link.startsWith('http') ? clinic.whatsapp_link : `https://wa.me/${clinic.whatsapp_link.replace(/\D/g,'')}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <div className="w-10 h-10 bg-[#25D366] rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">WhatsApp</p>
                    <p className="text-[13px] font-bold text-slate-800 truncate">{clinic.whatsapp_link}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-400 transition-colors" />
                </a>
              )}
              {clinic.yandex_map_link && (
                <a
                  href={clinic.yandex_map_link.startsWith('http') ? clinic.yandex_map_link : `https://${clinic.yandex_map_link}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                >
                  <YandexMapsIcon className="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Xarita (Yandex Maps)</p>
                    <p className="text-[13px] font-bold text-slate-800 truncate">{clinic.address || "Xaritada ochish"}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#fc3f1d] transition-colors" />
                </a>
              )}
            </div>
          </section>
        )}

        {/* FOOTER */}
        <div className="pt-6 pb-4 text-center border-t border-slate-200">
          <p className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">Powered by SHIFOCRM</p>
          <p className="text-[10px] text-slate-300 mt-1">© {new Date().getFullYear()} ShifoCRM</p>
        </div>
      </div>


      {/* Booking Modal / Drawer Overlay */}
      <AnimatePresence>
        {showBooking && (
          <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center p-0 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
              onClick={() => setShowBooking(false)}
            />
            
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="relative w-full max-w-xl bg-white rounded-t-[40px] md:rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-sm leading-none">Online navbat</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">Bo'sh vaqtni tanlang</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBooking(false)}
                  className="w-8 h-8 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="overflow-y-auto px-5 py-4 flex-1 custom-scrollbar">
                
                {/* Step Indicators */}
                <div className="flex items-center gap-2 mb-5">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={`h-1 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-[#1499AD]' : 'bg-slate-100'}`} />
                  ))}
                </div>

                {/* STEP 1: Select Doctor */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-3">
                    <h4 className="text-sm font-black text-slate-500 uppercase tracking-widest">Shifokorni tanlang</h4>
                    <div className="bg-slate-50 rounded-2xl overflow-hidden border border-slate-100">
                      {doctors.length > 0 ? doctors.map((doc, idx) => (
                        <button
                          key={doc.id}
                          onClick={() => { setSelectedDoctor(doc); setStep(2); }}
                          className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1499AD]/5 active:bg-[#1499AD]/10 transition-colors text-left group ${idx !== 0 ? 'border-t border-slate-200/70' : ''}`}
                        >
                          {/* Avatar circle */}
                          <div className="w-9 h-9 rounded-full bg-[#1499AD]/10 flex items-center justify-center font-black text-sm text-[#1499AD] shrink-0 uppercase">
                            {doc.name?.[0]}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-slate-900 text-[13px] leading-tight truncate">{doc.name}</p>
                            <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-tight">
                              {doc.specialty || 'Stomatolog'}
                            </p>
                          </div>
                          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#1499AD] transition-colors shrink-0" />
                        </button>
                      )) : (
                        <p className="text-center py-6 text-slate-400 font-bold text-sm">Klinikada shifokorlar topilmadi.</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Select Date & Time */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
                    {/* Selected Doctor Header Card */}
                    <div className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-2xl">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#1499AD]/10 text-[#1499AD] font-black text-sm flex items-center justify-center uppercase shrink-0">
                          {selectedDoctor?.name?.[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-slate-900 leading-tight truncate">{selectedDoctor?.name}</p>
                          <p className="text-[10px] text-[#1499AD] font-bold uppercase tracking-wider">{selectedDoctor?.specialty || 'Stomatolog'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setStep(1)} 
                        className="text-[11px] font-bold text-[#1499AD] hover:bg-[#1499AD]/10 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                      >
                        O'zgartirish
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Sana</Label>
                      <Input 
                        type="date" 
                        value={selectedDate}
                        min={new Date().toISOString().split('T')[0]}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="h-12 rounded-xl border-slate-200 font-bold text-base"
                      />
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Bo'sh vaqtlar</Label>
                        {loadingSlots && <div className="w-4 h-4 border-2 border-slate-300 border-t-[#1499AD] rounded-full animate-spin" />}
                      </div>
                      
                      <div className="grid grid-cols-4 gap-2">
                        {!loadingSlots && availableSlots.length > 0 ? (
                          availableSlots.map(time => (
                            <button
                              key={time}
                              onClick={() => setSelectedTime(time)}
                              className={`h-11 rounded-lg text-xs font-black transition-all border-2 ${selectedTime === time ? 'bg-[#1499AD] text-white border-[#1499AD] shadow-lg shadow-[#1499AD]/20 scale-105' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'}`}
                            >
                              {time}
                            </button>
                          ))
                        ) : !loadingSlots && (
                          <div className="col-span-4 py-8 text-center bg-slate-50 rounded-3xl">
                            <p className="text-xs font-bold text-slate-400">Bu kunda bo'sh vaqt yo'q.</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <Button 
                      disabled={!selectedTime}
                      onClick={() => setStep(3)}
                      className="w-full h-13 rounded-xl bg-[#1499AD] text-sm font-black shadow-lg shadow-[#1499AD]/20 active:scale-95"
                    >
                      DAVOM ETISH
                    </Button>
                  </motion.div>
                )}

                {/* STEP 3: Contact Info */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <button onClick={() => setStep(2)} className="flex items-center gap-2 text-[#1499AD] font-bold text-xs uppercase tracking-widest hover:translate-x-[-4px] transition-transform">
                      <ChevronLeft className="w-4 h-4" /> Vaqtni o'zgartirish
                    </button>

                    <div className="bg-[#1499AD] p-6 rounded-3xl text-white shadow-xl shadow-[#1499AD]/10 relative overflow-hidden">
                      <Sparkles className="absolute top-[-20px] right-[-20px] w-20 h-20 opacity-10 rotate-12" />
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-black">
                          {selectedDoctor?.name?.[0]}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-white/60 uppercase tracking-widest">Sizning tanlovingiz</p>
                          <p className="font-bold">{selectedDoctor?.name}</p>
                          <p className="text-xs font-bold mt-0.5">{selectedDate} / {selectedTime}</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ismingiz</Label>
                        <Input 
                          placeholder="Ismingizni kiriting"
                          value={patientInfo.name}
                          onChange={e => setPatientInfo({...patientInfo, name: e.target.value})}
                          className="h-12 rounded-xl border-slate-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefon raqamingiz</Label>
                        <Input 
                          placeholder="+998"
                          value={patientInfo.phone}
                          onChange={e => setPatientInfo({...patientInfo, phone: e.target.value})}
                          className="h-12 rounded-xl border-slate-200 font-bold"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Qo'shimcha izoh (ixtiyoriy)</Label>
                        <Input 
                          placeholder="Shikoyatingiz haqida..."
                          value={patientInfo.notes}
                          onChange={e => setPatientInfo({...patientInfo, notes: e.target.value})}
                          className="h-12 rounded-xl border-slate-200"
                        />
                      </div>
                    </div>

                    <Button 
                      onClick={handleBookingSubmit}
                      disabled={submitting}
                      className="w-full h-14 rounded-2xl bg-[#1499AD] text-white text-xs font-black shadow-lg shadow-[#1499AD]/20 active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? (
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          YUBORILMOQDA...
                        </div>
                      ) : 'NAVBATGA YOZILISH'}
                    </Button>
                  </motion.div>
                )}

                {/* STEP 4: Success Message */}
                {step === 4 && (
                  <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="py-10 text-center space-y-6">
                    <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-[35px] flex items-center justify-center mx-auto shadow-inner">
                      <CheckCircle2 className="w-12 h-12" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-slate-900">Muvaffaqiyatli!</h4>
                      <p className="text-slate-500 font-medium mt-2 px-6">
                        Arizangiz qabul qilindi. CRM tizimida "Lidlar" va "Uchrashuvlar" bo'limida paydo bo'ldi.
                      </p>
                    </div>
                    <Button 
                      onClick={() => setShowBooking(false)}
                      className="w-full h-14 rounded-2xl bg-slate-100 text-slate-900 font-black hover:bg-slate-200"
                    >
                      BOSH SAHIFAGA QAYTISH
                    </Button>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

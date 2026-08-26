import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, Phone, Send, 
  Instagram, ChevronRight, Calendar, CheckCircle2,
  X, ChevronLeft, Star,
  ShieldCheck, AlertCircle, Sparkles
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

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

  // Load available slots when doctor or date changes
  useEffect(() => {
    if (selectedDoctor && selectedDate && clinic) {
      loadSlots();
    }
  }, [selectedDoctor, selectedDate, clinic]);

  const loadSlots = async () => {
    if (!selectedDoctor || !clinic) return;
    setLoadingSlots(true);
    console.log('🔍 Debug: Loading slots for', selectedDoctor.name, 'on', selectedDate);
    
    try {
      // 1. Get existing appointments for this specific clinic
      // Use .filter() which correctly handles passing a custom clinic_id
      const appointments = await base44.entities.Appointment.filter({ 
        clinic_id: clinic.id 
      });
      
      const doctorAppointments = appointments.filter(a => {
        if (!a.date) return false;
        // Normalize DB date (handles both "YYYY-MM-DD" and ISO strings)
        const dbDate = a.date.includes('T') ? a.date.split('T')[0] : a.date;
        const uiDate = selectedDate.includes('T') ? selectedDate.split('T')[0] : selectedDate;
        
        const docMatch = String(a.doctor_id) === String(selectedDoctor.id);
        const dateMatch = dbDate === uiDate;
        return docMatch && dateMatch && a.status !== 'Cancelled';
      });

      console.log('📅 Found existing appointments:', doctorAppointments.length);

      // 2. Determine working hours
      let startHour = 8;
      let endHour = 20;
      
      const wh = clinic.working_hours || "";
      const match = wh.match(/(\d{1,2})[:.](\d{2})\s*[- ]\s*(\d{1,2})[:.](\d{2})/);
      
      if (match) {
        startHour = parseInt(match[1]);
        endHour = parseInt(match[3]);
      }
      console.log('⏰ Working hours range:', startHour, '-', endHour);

      // 3. Generate 30-min slots
      const slots = [];
      const currentNow = new Date();
      // Ensure date format is same for comparison
      const todayStr = currentNow.toISOString().split('T')[0];
      const isToday = selectedDate === todayStr;
      
      const currentTotalMin = currentNow.getHours() * 60 + currentNow.getMinutes();

      for (let hour = startHour; hour < endHour; hour++) {
        const timeConfigs = ['00', '30'];
        
        for (const min of timeConfigs) {
          const time = `${hour.toString().padStart(2, '0')}:${min}`;
          
          // Skip past times if booking for today
          if (isToday) {
            const slotTotalMin = hour * 60 + parseInt(min);
            if (slotTotalMin <= currentTotalMin + 45) continue; // 45 min buffer
          }

          // Check if busy
          const isBusy = doctorAppointments.some(a => {
            if (!a.time) return false;
            // Normalize appointment time to HH:MM
            const aTime = a.time.includes(':') ? a.time.substring(0, 5) : a.time;
            const normalizedATime = aTime.padStart(5, '0');
            return normalizedATime === time;
          });

          if (!isBusy) {
            slots.push(time);
          }
        }
      }
      
      console.log('✅ Calculated available slots:', slots.length);
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
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-slate-200 border-t-[#1499AD] rounded-full animate-spin" />
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Yuklanmoqda...</p>
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

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-[#1499AD] selection:text-white pb-20 overflow-x-hidden">
      {/* Premium Header */}
      <div className="relative h-[360px] w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1499AD] to-[#0E7A8A]" />
        
        {/* Abstract background shapes */}
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-white/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-white/5 rounded-full blur-[100px]" />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 flex flex-col items-center text-center text-white h-full">
          <motion.div 
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-white/10 backdrop-blur-xl rounded-[30px] flex items-center justify-center mb-6 border border-white/20 shadow-2xl relative"
          >
            {clinic.logo ? (
              <img src={clinic.logo} alt="Logo" className="w-14 h-14 object-contain drop-shadow-xl" />
            ) : (
              <div className="text-2xl font-black">{clinic.name?.[0]}</div>
            )}
            <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-emerald-500 rounded-2xl flex items-center justify-center border-4 border-slate-50 text-white shadow-lg shadow-emerald-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </motion.div>

          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-4xl font-black mb-3 tracking-tight drop-shadow-sm"
          >
            {clinic.name}
          </motion.h1>

          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm text-white/80 max-w-md font-medium leading-relaxed"
          >
            {clinic.description || 'Zamonaviy dental tizim va yuqori sifatli stomatologik xizmatlar.'}
          </motion.p>
        </div>
      </div>

      {/* Main Content Info Cards */}
      <div className="max-w-4xl mx-auto px-6 -mt-32 relative z-10 space-y-10">
        
        {/* Quick Action Button */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex justify-center"
        >
          <button 
            onClick={() => setShowBooking(true)}
            className="group relative bg-[#1499AD] text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-xl shadow-[#1499AD]/20 hover:shadow-[#1499AD]/40 active:scale-95 transition-all flex items-center gap-2.5 overflow-hidden border border-white/20"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
            <Calendar className="w-5 h-5" />
            <span>ONLINE YOZILISH</span>
            <Sparkles className="w-4 h-4 text-white/60 group-hover:text-yellow-300 transition-colors" />
          </button>
        </motion.div>

        {/* Ultra-Compact Info Bar */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white/80 backdrop-blur-xl rounded-[28px] p-3 shadow-2xl shadow-slate-200/60 border border-white flex flex-col md:flex-row items-stretch md:items-center gap-3"
        >
          {/* Address Section */}
          <div className="flex-1 flex items-center gap-3 px-3 py-2 border-b md:border-b-0 md:border-r border-slate-100">
            <div className="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Manzil</p>
              <p className="text-[12px] font-bold text-slate-800 truncate leading-tight">
                {clinic.address || 'Sahyhontohur, Tinchlik 45'}
              </p>
            </div>
            {/* Mini Map Toggle/Trigger */}
            <div className="w-12 h-10 bg-slate-50 rounded-xl overflow-hidden border border-slate-100 shrink-0 opacity-60 hover:opacity-100 transition-opacity">
               <iframe src="https://yandex.ru/map-widget/v1/?ll=69.2401,41.2995&z=12" width="100%" height="100%" className="grayscale" />
            </div>
          </div>

          {/* Time Section */}
          <div className="flex-1 flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-500 shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Ish vaqti</p>
              <div className="flex items-center gap-2">
                <p className="text-[12px] font-bold text-slate-800 whitespace-nowrap">{clinic.working_hours || '08:00 - 22:00'}</p>
                <div className="h-4 px-1.5 bg-emerald-50 text-emerald-600 rounded text-[7px] font-black flex items-center border border-emerald-100">
                  OCHIQ
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Services Section */}
        <section className="space-y-8">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Xizmatlarimiz</h2>
            <div className="h-px bg-slate-100 flex-1" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              { name: 'Terapiya', desc: 'Og\'riqsiz davolash', icon: Star, color: 'text-amber-500', bg: 'bg-amber-50' },
              { name: 'Ortopediya', desc: 'Vinir va karonkalar', icon: Sparkles, color: 'text-indigo-500', bg: 'bg-indigo-50' },
              { name: 'Xirurgiya', desc: 'Implantatsiya', icon: ShieldCheck, color: 'text-rose-500', bg: 'bg-rose-50' },
              { name: 'Gigiyena', desc: 'Tishlarni oqartirish', icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-50' }
            ].map((s, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + (idx * 0.05) }}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4 hover:border-[#1499AD]/30 transition-all cursor-pointer group"
              >
                <div className={`w-10 h-10 ${s.bg} ${s.color} rounded-xl flex items-center justify-center shadow-inner group-hover:scale-105 transition-transform`}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-[13px] font-bold text-slate-900 leading-none">{s.name}</h4>
                  <p className="text-[10px] text-slate-500 font-bold mt-1.5 opacity-60 uppercase tracking-tighter">{s.desc}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-200 ml-auto group-hover:text-[#1499AD] transition-colors" />
              </motion.div>
            ))}
          </div>
        </section>

        {/* Social Links & Footer */}
        <footer className="pt-20 pb-10 space-y-12">
          <div className="text-center space-y-6">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Ijtimoiy tarmoqlar</p>
            <div className="flex justify-center gap-6">
              {[
                { icon: Send, color: 'text-white bg-[#229ED9]', link: clinic.telegram_link },
                { icon: Instagram, color: 'text-white bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]', link: clinic.instagram_link },
                { icon: Phone, color: 'text-white bg-[#25D366]', link: clinic.whatsapp_link },
                { icon: MapPin, color: 'text-white bg-[#E62E2E]', link: clinic.yandex_map_link }
              ].filter(s => s.link).map((social, idx) => (
                <motion.a
                  key={idx}
                  href={social.link ? (social.link.startsWith('http') ? social.link : `https://${social.link}`) : '#'}
                  target="_blank"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-14 h-14 ${social.color} rounded-[20px] flex items-center justify-center shadow-lg shadow-slate-200 cursor-pointer`}
                >
                  <social.icon className="w-6 h-6" />
                </motion.a>
              ))}
            </div>
          </div>
          
          <div className="pt-10 border-t border-slate-200 text-center">
            <p className="text-xs text-slate-400 font-bold tracking-widest uppercase mb-2">Powered by SHIFOCRM</p>
            <p className="text-[10px] text-slate-300">© 2024 ShifoCRM. Barcha huquqlar himoyalangan.</p>
          </div>
        </footer>
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
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 leading-none">Online navbat</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">Bo'sh vaqtni tanlang</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowBooking(false)}
                  className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Content - Scrollable */}
              <div className="overflow-y-auto p-6 flex-1 custom-scrollbar">
                
                {/* Step Indicators */}
                <div className="flex items-center gap-2 mb-8">
                  {[1, 2, 3].map(s => (
                    <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= s ? 'bg-[#1499AD]' : 'bg-slate-100'}`} />
                  ))}
                </div>

                {/* STEP 1: Select Doctor */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <h4 className="text-xl font-black text-slate-900">Shifokorni tanlang</h4>
                    <div className="grid grid-cols-1 gap-3">
                      {doctors.length > 0 ? doctors.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => { setSelectedDoctor(doc); setStep(2); }}
                          className="flex items-center gap-4 p-5 rounded-3xl border-2 border-slate-50 hover:border-[#1499AD] hover:bg-indigo-50/30 transition-all text-left bg-slate-50/50 group"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center font-black text-xl text-[#1499AD] shrink-0 border border-slate-100 uppercase group-hover:scale-105 transition-transform">
                            {doc.name?.[0]}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-slate-900 text-lg leading-none uppercase tracking-tight">{doc.name}</p>
                            <p className="text-xs text-[#1499AD] font-bold mt-2 uppercase tracking-widest bg-white inline-block px-3 py-1 rounded-lg border border-indigo-100">
                              {doc.specialty || 'Stomatolog'}
                            </p>
                          </div>
                          <ChevronRight className="w-6 h-6 text-slate-300 group-hover:text-[#1499AD] transition-colors" />
                        </button>
                      )) : (
                        <p className="text-center py-10 text-slate-400 font-bold">Klinikada shifokorlar topilmadi.</p>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* STEP 2: Select Date & Time */}
                {step === 2 && (
                  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-6">
                    <button onClick={() => setStep(1)} className="flex items-center gap-2 text-[#1499AD] font-bold text-xs uppercase tracking-widest hover:translate-x-[-4px] transition-transform">
                      <ChevronLeft className="w-4 h-4" /> Shifokorni o'zgartirish
                    </button>
                    
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

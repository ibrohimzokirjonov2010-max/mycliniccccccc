import { useState, useEffect } from 'react';
/* Technicians Management Module */
import { 
  Wrench, Plus, Search, Calendar, User, Clock, 
  CheckCircle2, Send, 
  UserPlus, Phone, Briefcase, X, PackageCheck, Truck, MessageCircle, Camera
} from 'lucide-react';
import { Tooth } from '@/components/ui/Icons';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';
import PatientSelect from '@/components/patients/PatientSelect';
import ProfessionalOdontogram from '@/components/patients/ProfessionalOdontogram';
import { motion, AnimatePresence } from 'framer-motion';

const statusConfig = {
  Draft: { label: 'Qoralama', color: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
  Sent: { label: 'Yuborildi', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Send },
  'In Progress': { label: 'Texnikda', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Truck },
  Received: { label: 'Klinikada', color: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: PackageCheck },
  Completed: { label: 'O\'rnatildi', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 }
};

export default function Technicians() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("jobs");
  const [jobs, setJobs] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [smsModal, setSmsModal] = useState({ open: false, job: null });
  const [smsSending, setSmsSending] = useState(false);
  
  // Modals state
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [techModalOpen, setTechModalOpen] = useState(false);

  // Form states
  const [jobForm, setJobForm] = useState({
    patient_id: '',
    patient_name: '',
    work_type: '', // Material (Zirconia, Metal etc)
    construction_type: '', // Karonka, Ko'prik, Vinir...
    shade: '', // Rangi (A1, A2, B1...)
    technician_id: '',
    technician_name: '',
    doctor_id: '',
    doctor_name: '',
    tooth_number: '',
    cost: '',
    deadline: '',
    impression_date: new Date().toISOString().split('T')[0],
    status: 'Sent',
    notes: '',
    photo_urls: []
  });
  const [jobStep, setJobStep] = useState(1);

  const [techForm, setTechForm] = useState({
    name: '',
    phone: '',
    specialization: '',
    is_active: true
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, techsData, patientsData, staffData] = await Promise.all([
        base44.entities.TechnicianJob.list('-created_date', 100),
        base44.entities.Technician.list('name'),
        base44.entities.Patient.list('full_name', 200),
        base44.entities.User.list('name')
      ]);
      setJobs(jobsData);
      setTechnicians(techsData);
      setPatients(patientsData);
      setDoctors(staffData.filter(u => u.role === 'doctor' || u.role === 'admin'));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const handleCreateJob = async () => {
    try {
      const patient = patients.find(p => p.id === jobForm.patient_id);
      const tech = technicians.find(t => t.id === jobForm.technician_id);
      const doc = doctors.find(d => d.id === jobForm.doctor_id);

      await base44.entities.TechnicianJob.create({
        ...jobForm,
        patient_name: patient?.full_name || jobForm.patient_name,
        technician_name: tech?.name || jobForm.technician_name,
        doctor_name: doc?.name || doc?.full_name || jobForm.doctor_name,
        cost: parseFloat(jobForm.cost) || 0
      });
      setJobModalOpen(false);
      setJobForm({ 
        patient_id: '', patient_name: '', work_type: '', construction_type: '', shade: '',
        technician_id: '', technician_name: '', doctor_id: '', doctor_name: '',
        tooth_number: '', cost: '', deadline: '', impression_date: new Date().toISOString().split('T')[0],
        status: 'Sent', notes: '', photo_urls: [] 
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTech = async () => {
    try {
      await base44.entities.Technician.create(techForm);
      setTechModalOpen(false);
      setTechForm({ name: '', phone: '', specialization: '', is_active: true });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const sendArrivalNotification = async (job) => {
    try {
      const patient = patients.find(p => p.id === job.patient_id);
      if (patient?.telegram_chat_id) {
        const BACKEND_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
        await fetch(`${BACKEND_URL}/notifications/send-custom`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
          },
          body: JSON.stringify({
            chatId: patient.telegram_chat_id,
            message: `🦷 <b>Xabar!</b>\n\nHurmatli <b>${patient.full_name}</b>, sizning buyurtma qilgan tishingiz (№${job.tooth_number}) klinikaga yetib keldi. Shifokoringiz bilan bog'lanib, o'rnatish vaqtini belgilashingizni so'raymiz.\n\nSizni kutib qolamiz!`
          })
        });
      }
    } catch (e) {
      console.error('Failed to send notification:', e);
    }
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await base44.entities.TechnicianJob.update(id, { status: newStatus });
      
      const job = jobs.find(j => j.id === id);
      if (newStatus === 'Received') {
        sendArrivalNotification(job);
      }
      
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const filteredJobs = jobs.filter(j => 
    j.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
    j.work_type?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    active: jobs.filter(j => j.status !== 'Completed').length,
    today: jobs.filter(j => j.deadline === new Date().toISOString().split('T')[0]).length,
    cost: jobs.reduce((s, j) => s + (j.cost || 0), 0)
  };

  return (
    <div className="space-y-3 sm:space-y-6 pb-24 sm:pb-20 max-w-7xl mx-auto px-3 sm:px-0">
      {/* Header - Mobile Compact */}
      <div className="flex items-center justify-between bg-white px-4 py-3 sm:p-6 rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-14 sm:h-14 bg-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Wrench className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
          </div>
          <div>
            <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight">{t('technicians.title')}</h1>
            <p className="text-slate-400 text-[10px] sm:text-sm font-bold uppercase tracking-widest hidden sm:block">{t('technicians.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "jobs" ? (
            <button onClick={() => setJobModalOpen(true)} className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs sm:text-sm flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-indigo-100">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">{t('technicians.newOrder').split(' ')[0]} </span>{t('technicians.newOrder').split(' ')[1] || t('technicians.newOrder')}
            </button>
          ) : (
            <button onClick={() => setTechModalOpen(true)} className="h-10 sm:h-12 px-4 sm:px-6 rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-black text-white font-black text-xs sm:text-sm flex items-center gap-2 active:scale-95 transition-all">
              <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">{t('technicians.addTech')} </span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Tab Bar */}
      <div className="flex bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <button
          onClick={() => setActiveTab('jobs')}
          className={cn(
            'flex-1 py-3 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2',
            activeTab === 'jobs' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-50'
          )}
        >
          <Briefcase className="w-4 h-4" /> {t('technicians.jobs')}
        </button>
        <button
          onClick={() => setActiveTab('techs')}
          className={cn(
            'flex-1 py-3 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2',
            activeTab === 'techs' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-50'
          )}
        >
          <User className="w-4 h-4" /> {t('technicians.techs')}
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="jobs" className="space-y-3 sm:space-y-6">
           {/* Stats & Search */}
           <div className="flex gap-2">
              <div className="relative group flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Qidirish..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-10 h-11 sm:h-14 rounded-2xl sm:rounded-3xl border-slate-100 bg-white shadow-sm font-bold text-sm"
                />
              </div>
              <div className="flex gap-2">
                 <div className="h-11 sm:h-14 px-3 sm:px-6 flex items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100">
                    <p className="text-lg font-black text-indigo-600">{stats.active}</p>
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest ml-1.5 hidden sm:block">Aktiv</p>
                 </div>
                 <div className="h-11 sm:h-14 px-3 sm:px-6 flex items-center justify-center rounded-2xl bg-rose-50 border border-rose-100">
                    <p className="text-lg font-black text-rose-600">{stats.today}</p>
                    <p className="text-[9px] font-black text-rose-400 uppercase tracking-widest ml-1.5 hidden sm:block">Bugun</p>
                 </div>
              </div>
           </div>

           {/* Jobs Grid */}
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-40 sm:h-48 bg-slate-100 rounded-3xl sm:rounded-[2.5rem] animate-pulse shadow-sm" />
                ))
              ) : filteredJobs.length === 0 ? (
                <div className="col-span-2 flex flex-col items-center justify-center py-16 text-slate-300">
                  <Briefcase className="w-16 h-16 mb-3" />
                  <p className="font-black text-lg uppercase tracking-widest">Ishlar topilmadi</p>
                  <p className="text-sm mt-1">Yangi buyurtma qo'shing</p>
                </div>
              ) : filteredJobs.map(job => {
                const cfg = statusConfig[job.status] || statusConfig.Draft;
                return (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={job.id} 
                    className="bg-white rounded-3xl sm:rounded-[2.5rem] border border-slate-100 p-4 sm:p-6 shadow-sm active:shadow-md transition-all relative overflow-hidden"
                  >
                    {/* Card Top */}
                    <div className="flex items-start justify-between mb-3 sm:mb-4">
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col items-center justify-center w-12 h-12 sm:w-16 sm:h-16 bg-slate-50 rounded-xl sm:rounded-2xl border border-slate-100 shrink-0">
                          <span className="font-black text-slate-900 text-sm sm:text-base">
                            {job.tooth_number ? job.tooth_number.split(',').length : 0}
                          </span>
                          <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 min-w-max text-center">ta tish</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Bemor:</p>
                          <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight leading-tight truncate max-w-[160px] sm:max-w-none">{job.patient_name}</h3>
                          <p className="text-[10px] font-bold text-slate-500 mt-1 truncate">
                             Tishlar: <span className="text-slate-800">{job.tooth_number || '—'}</span>
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="text-indigo-600 text-[9px] sm:text-[10px] font-black uppercase px-1.5 py-0.5 bg-indigo-50 rounded border border-indigo-100">{job.construction_type || job.work_type || 'Ish'}</span>
                            {job.shade && <span className="text-amber-600 text-[9px] sm:text-[10px] font-black uppercase px-1.5 py-0.5 bg-amber-50 rounded border border-amber-100">{job.shade}</span>}
                          </div>
                        </div>
                      </div>
                      <div className={cn("px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl text-[9px] sm:text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border shadow-sm shrink-0", cfg.color)}>
                        <cfg.icon className="w-3 h-3" />
                        <span className="hidden xs:inline">{cfg.label}</span>
                      </div>
                    </div>

                    {/* Details Grid - compact on mobile */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:gap-x-6 sm:gap-y-5 py-3 sm:py-5 border-y border-slate-50 mb-3 sm:mb-5">
                      <div className="space-y-0.5">
                         <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest">Texnik</p>
                         <p className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5 truncate">
                           <Wrench className="w-3 h-3 sm:w-4 sm:h-4 text-slate-400 shrink-0" />
                           {job.technician_name || '—'}
                         </p>
                      </div>
                      <div className="space-y-0.5">
                         <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest">Shifokor</p>
                         <p className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5 truncate">
                           <User className="w-3 h-3 sm:w-4 sm:h-4 text-indigo-400 shrink-0" />
                           {job.doctor_name || '—'}
                         </p>
                      </div>
                      <div className="space-y-0.5">
                         <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest">Muddat</p>
                         <p className="text-xs sm:text-sm font-bold text-slate-700 flex items-center gap-1.5">
                           <Calendar className="w-3 h-3 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                           {job.deadline || '—'}
                         </p>
                      </div>
                      <div className="space-y-0.5">
                         <p className="text-[8px] sm:text-[9px] font-black text-slate-300 uppercase tracking-widest">Narx</p>
                         <p className="text-xs sm:text-sm font-bold text-emerald-600">
                           {job.cost?.toLocaleString() || '0'} so'm
                         </p>
                      </div>
                    </div>

                    {job.notes && (
                      <div className="mb-5 p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-medium text-slate-500 italic">"{job.notes}"</p>
                      </div>
                    )}

                    {Array.isArray(job.photo_urls) && job.photo_urls.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-5">
                        {job.photo_urls.map((url, idx) => (
                          <div 
                            key={idx} 
                            onClick={() => {
                              const w = window.open();
                              if (w) {
                                w.document.write(`<img src="${url}" style="max-width:100%; max-height:100%; margin:auto; display:block; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.15);" />`);
                              }
                            }}
                            className="w-12 h-12 rounded-xl border border-slate-200 overflow-hidden shadow-sm cursor-pointer hover:opacity-90 active:scale-95 transition-all shrink-0 bg-slate-50"
                          >
                            <img src={url} alt="Tooth detail" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Workflow Action Buttons */}
                    <div className="space-y-3 relative z-10">
                      {/* Step 1: Sent → Texnik olib ketdi */}
                      {job.status === 'Sent' && (
                        <button
                          onClick={() => updateStatus(job.id, 'In Progress')}
                          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-amber-100"
                        >
                          <Truck className="w-4 h-4" />
                          {t('technicians.actions.sentToTech')}
                        </button>
                      )}

                      {/* Step 2: In Progress → Yetib keldi */}
                      {job.status === 'In Progress' && (
                        <button
                          onClick={() => updateStatus(job.id, 'Received')}
                          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-indigo-100"
                        >
                          <PackageCheck className="w-4 h-4" />
                          {t('technicians.actions.arrivedAtClinic')}
                        </button>
                      )}

                      {/* Step 3: Received → SMS yuborish + O'rnatildi */}
                      {job.status === 'Received' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSmsModal({ open: true, job })}
                            className="flex-1 flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm uppercase tracking-widest transition-all shadow-lg shadow-emerald-100"
                          >
                            <MessageCircle className="w-4 h-4" />
                            {t('technicians.actions.sendSms')}
                          </button>
                          <button
                            onClick={() => updateStatus(job.id, 'Completed')}
                            className="flex items-center justify-center gap-2 h-12 px-4 rounded-2xl bg-slate-900 hover:bg-black active:scale-95 text-white font-black text-xs uppercase tracking-widest transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            {t('technicians.actions.installed')}
                          </button>
                        </div>
                      )}

                      {/* Completed */}
                      {job.status === 'Completed' && (
                        <div className="flex items-center justify-center gap-2 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 font-black text-sm">
                          <CheckCircle2 className="w-5 h-5" /> {t('technicians.actions.completed')}
                        </div>
                      )}

                      <div className="flex items-center justify-end">
                        <p className="text-emerald-600 font-black text-lg">{job.cost?.toLocaleString()} <span className="text-[10px] uppercase font-bold text-slate-300">Sum</span></p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
           </div>
        </TabsContent>

        <TabsContent value="techs">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {technicians.map(tech => (
                <div key={tech.id} className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border border-slate-100 flex flex-col gap-3 sm:gap-4 active:border-indigo-200 transition-all">
                  <div className="flex items-center justify-between">
                     <div className="w-11 h-11 sm:w-12 sm:h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                       <User className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400" />
                     </div>
                     <span className={cn("px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest", tech.is_active ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                        {tech.is_active ? 'Faol' : 'Nofaol'}
                     </span>
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base sm:text-lg uppercase tracking-tight">{tech.name}</h3>
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                       <Briefcase className="w-3 h-3" />
                       {tech.specialization || 'Umumiy texnik'}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                     <p className="text-slate-500 font-bold text-sm flex items-center gap-2">
                        <Phone className="w-4 h-4 text-indigo-400" />
                        {tech.phone}
                     </p>
                  </div>
                </div>
              ))}
              <div 
                onClick={() => setTechModalOpen(true)}
                className="p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center gap-2 text-slate-300 hover:border-indigo-200 hover:text-indigo-300 transition-all cursor-pointer min-h-[120px]"
              >
                  <UserPlus className="w-8 h-8 sm:w-10 sm:h-10" />
                  <span className="font-black text-xs uppercase tracking-widest">Texnik qo'shish</span>
              </div>
           </div>
        </TabsContent>
      </Tabs>

      {/* === SMS Modal === */}
      {smsModal.open && smsModal.job && (() => {
        const job = smsModal.job;
        const patient = patients.find(p => p.id === job.patient_id);
        const smsText = `🦷 Assalomu alaykum, ${job.patient_name}!

Sizning buyurtma qilgan ish tayyor bo'ldi:
• Ish turi: ${job.construction_type || job.work_type || '—'}
• Tish raqami: ${job.tooth_number || '—'}
• Rangi: ${job.shade || '—'}

Iltimos, shifokoringiz bilan bog'lanib, o'rnatish uchun qulay vaqt belgilang.

Sizni kutib qolamiz! 🏥`;

        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="bg-emerald-500 p-6 text-white">
                <div className="flex items-center gap-3 mb-1">
                  <MessageCircle className="w-7 h-7" />
                  <h2 className="text-xl font-black tracking-tight">{t('technicians.smsModal.title')}</h2>
                </div>
                <p className="text-emerald-100 text-xs font-bold uppercase tracking-widest">{t('technicians.smsModal.subtitle')}</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Bemor info */}
                <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <User className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-black text-slate-900">{job.patient_name}</p>
                    <p className="text-xs text-slate-400 font-bold">
                      {patient?.phone || patient?.telegram_chat_id ? `Tel: ${patient?.phone || '—'}` : '⚠️ Telefon raqami topilmadi'}
                    </p>
                  </div>
                </div>

                {/* SMS Preview */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Yuborilajak xabar:</p>
                  <p className="text-sm text-slate-700 font-medium whitespace-pre-line leading-relaxed">{smsText}</p>
                </div>

                {!patient?.telegram_chat_id && (
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-xs text-amber-600 font-bold">⚠️ Ushbu bemor Telegram'ga ulanmagan. Xabar yuborilmaydi, lekin holat yangilanadi.</p>
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setSmsModal({ open: false, job: null })}
                  className="flex-1 h-12 rounded-2xl border border-slate-200 text-slate-500 font-black text-sm uppercase tracking-widest hover:bg-slate-50 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  disabled={smsSending}
                  onClick={async () => {
                    setSmsSending(true);
                    try {
                      if (patient?.telegram_chat_id) {
                        const BACKEND_URL = window.location.hostname === 'localhost' ? 'http://localhost:3000' : '';
                        await fetch(`${BACKEND_URL}/notifications/send-custom`, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                          },
                          body: JSON.stringify({
                            chatId: patient.telegram_chat_id,
                            message: smsText
                          })
                        });
                      }
                      await updateStatus(job.id, 'Completed');
                      setSmsModal({ open: false, job: null });
                    } catch (e) {
                      console.error('SMS send error:', e);
                      await updateStatus(job.id, 'Completed');
                      setSmsModal({ open: false, job: null });
                    } finally {
                      setSmsSending(false);
                    }
                  }}
                  className="flex-1 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-100"
                >
                  {smsSending ? (
                    <><span className="animate-spin">⏳</span> Yuborilmoqda...</>
                  ) : (
                    <><MessageCircle className="w-4 h-4" /> Yuborish</>
                  )}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Creation Modal (Job) */}
      <Dialog open={jobModalOpen} onOpenChange={(open) => {
        setJobModalOpen(open);
        if (!open) {
          setJobStep(1);
          setJobForm({ patient_id: '', patient_name: '', work_type: '', construction_type: '', shade: '', technician_id: '', technician_name: '', doctor_id: '', doctor_name: '', tooth_number: '', cost: '', deadline: '', impression_date: new Date().toISOString().split('T')[0], status: 'Sent', notes: '', photo_urls: [] });
        }
      }}>
        <DialogContent className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%] w-[95vw] max-w-4xl h-[85vh] sm:h-[90vh] p-0 border-none rounded-[2rem] overflow-hidden bg-white flex flex-col shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-1/2">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-[2rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                <Wrench className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white uppercase tracking-tight">
                  Yangi buyurtma yaratish
                </DialogTitle>
                <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-0.5">Laboratoriya uchrashuvi</p>
              </div>
            </div>
            <button 
              onClick={() => setJobModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Compact Stepper Header */}
          <div className="bg-slate-50 border-b border-slate-100 px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-center shrink-0">
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Step 1 */}
              <div className={cn("flex items-center gap-1 sm:gap-2 transition-all", jobStep === 1 ? "opacity-100" : "opacity-40")}>
                <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0", jobStep === 1 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500")}>
                  {jobStep > 1 ? "✓" : "1"}
                </div>
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tight text-slate-700">Bemor</span>
              </div>
              <div className="w-3 sm:w-8 h-px bg-slate-200 shrink-0" />
              {/* Step 2 */}
              <div className={cn("flex items-center gap-1 sm:gap-2 transition-all", jobStep === 2 ? "opacity-100" : "opacity-40")}>
                <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0", jobStep === 2 ? "bg-emerald-600 text-white" : jobStep > 2 ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500")}>
                  {jobStep > 2 ? "✓" : "2"}
                </div>
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tight text-slate-700">Tishlar</span>
              </div>
              <div className="w-3 sm:w-8 h-px bg-slate-200 shrink-0" />
              {/* Step 3 */}
              <div className={cn("flex items-center gap-1 sm:gap-2 transition-all", jobStep === 3 ? "opacity-100" : "opacity-40")}>
                <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-black text-[10px] sm:text-xs shrink-0", jobStep === 3 ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-500")}>3</div>
                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-tight text-slate-700">Tafsilot</span>
              </div>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {jobStep === 1 && (
                <motion.div 
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex flex-col items-center justify-start min-h-full px-4 pt-8 pb-4 sm:py-12 space-y-3 sm:space-y-6"
                >
                  <div className="w-11 h-11 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 shadow-inner">
                     <UserPlus className="w-5 h-5" />
                  </div>
                  <div className="text-center space-y-0.5">
                     <h2 className="text-[15px] sm:text-xl font-bold text-slate-900 tracking-tight">Bemor tanlang</h2>
                     <p className="text-slate-400 text-[10px] sm:text-sm font-medium">Buyurtma qaysi bemor uchun?</p>
                  </div>
                  <div className="w-full max-w-sm px-2">
                    <PatientSelect 
                      patients={patients}
                      value={jobForm.patient_id}
                      onChange={(id, p) => {
                        setJobForm({...jobForm, patient_id: id, patient_name: p?.full_name || ''});
                        if (id) setTimeout(() => setJobStep(2), 300);
                      }}
                      inputClassName="h-11 rounded-xl bg-white border-slate-200 shadow-lg shadow-emerald-500/5 font-semibold text-xs text-emerald-600"
                    />
                  </div>
                </motion.div>
              )}

              {jobStep === 2 && (
                <motion.div 
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-3 sm:px-6 py-4"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div>
                      <h2 className="text-base sm:text-xl font-black text-slate-900 flex items-center gap-2">
                        <Tooth className="w-5 h-5 text-emerald-600" /> 
                        Tishlarni belgilang
                      </h2>
                      <p className="text-slate-400 text-[10px] sm:text-xs font-bold mt-0.5 ml-7">{jobForm.patient_name}</p>
                    </div>
                    {jobForm.tooth_number && (
                      <div className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl font-black text-sm">
                        {jobForm.tooth_number.split(', ').length} ta ✓
                      </div>
                    )}
                  </div>

                  {/* Dental chart - no scale on mobile, just let it scroll */}
                  <div className="overflow-visible mt-4">
                    <ProfessionalOdontogram 
                      selectedTeeth={jobForm.tooth_number ? jobForm.tooth_number.split(', ').map(fdi => {
                        const n = parseInt(fdi);
                        if (n >= 11 && n <= 18) return `ur${n - 10}`;
                        if (n >= 21 && n <= 28) return `ul${n - 20}`;
                        if (n >= 31 && n <= 38) return `ll${n - 30}`;
                        if (n >= 41 && n <= 48) return `lr${n - 40}`;
                        return fdi;
                      }) : []}
                      onChange={(ids) => {
                        const fdis = ids.map(id => {
                          if (id.startsWith('ur')) return 10 + parseInt(id.replace('ur', ''));
                          if (id.startsWith('ul')) return 20 + parseInt(id.replace('ul', ''));
                          if (id.startsWith('ll')) return 30 + parseInt(id.replace('ll', ''));
                          if (id.startsWith('lr')) return 40 + parseInt(id.replace('lr', ''));
                          return id;
                        });
                        setJobForm({...jobForm, tooth_number: fdis.sort((a,b) => a-b).join(', ')});
                      }}
                      multi={true}
                      hideChildren={false}
                    />
                  </div>

                </motion.div>
              )}

              {jobStep === 3 && (
                <motion.div 
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="px-4 sm:px-8 py-4 sm:py-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-base sm:text-xl font-black text-slate-900">📋 Texnik ko'rsatmalar</h2>
                    <div className="flex flex-wrap gap-1 max-w-[150px] justify-end">
                      {jobForm.tooth_number?.split(', ').slice(0, 4).map(n => (
                        <span key={n} className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center font-black text-[10px]">{n}</span>
                      ))}
                      {jobForm.tooth_number?.split(', ').length > 4 && <span className="text-[10px] text-slate-400 font-bold self-center">+{jobForm.tooth_number.split(', ').length - 4}</span>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Konstruksiya turi</Label>
                      <Select onValueChange={(val) => setJobForm({...jobForm, construction_type: val})} value={jobForm.construction_type}>
                        <SelectTrigger className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-bold shadow-sm">
                          <SelectValue placeholder="Karonka, Vinir..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          {["Karonka (Siyish)", "Ko'prik (Bridge)", "Vinir", "Inlay/Onlay", "Protez (To'liq)", "Byugel protez", "Vaqtinchalik"].map(t => (
                            <SelectItem key={t} value={t} className="rounded-xl font-bold">{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Material</Label>
                      <Select onValueChange={(val) => setJobForm({...jobForm, work_type: val})} value={jobForm.work_type}>
                        <SelectTrigger className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-bold shadow-sm text-emerald-600">
                          <SelectValue placeholder="Zirconia, E-Max..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          {["Zirconia", "E-Max", "Metal-Keramika", "Plastmassa", "Titan", "Kompozit"].map(m => (
                            <SelectItem key={m} value={m} className="rounded-xl font-bold">{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Rangi (Shade)</Label>
                      <Select onValueChange={(val) => setJobForm({...jobForm, shade: val})} value={jobForm.shade}>
                        <SelectTrigger className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-bold shadow-sm">
                          <SelectValue placeholder="A1, A2, B1..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          {["A1", "A2", "A3", "A3.5", "B1", "B2", "C1", "C2", "D2", "BL1", "BL2", "BL3", "BL4"].map(s => (
                            <SelectItem key={s} value={s} className="rounded-xl font-bold">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Shifokor</Label>
                      <Select onValueChange={(val) => setJobForm({...jobForm, doctor_id: val})} value={jobForm.doctor_id}>
                        <SelectTrigger className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-bold shadow-sm">
                          <SelectValue placeholder="Doktorni tanlang" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          {doctors.map(d => (
                            <SelectItem key={d.id} value={d.id} className="rounded-xl font-bold">{d.name || d.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Texnik</Label>
                      <Select onValueChange={(val) => setJobForm({...jobForm, technician_id: val})} value={jobForm.technician_id}>
                        <SelectTrigger className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-bold shadow-sm text-emerald-600">
                          <SelectValue placeholder="Texnikni tanlang" />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl border-none shadow-xl">
                          {technicians.map(t => <SelectItem key={t.id} value={t.id} className="rounded-xl font-bold">{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Narxi</Label>
                        <Input type="number" placeholder="0" className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-bold shadow-sm" value={jobForm.cost} onChange={e => setJobForm({...jobForm, cost: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Muddat</Label>
                        <Input type="date" className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-bold shadow-sm" value={jobForm.deadline} onChange={e => setJobForm({...jobForm, deadline: e.target.value})} />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Izoh</Label>
                    <Input placeholder="Qo'shimcha ko'rsatmalar..." className="h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-white border-slate-100 font-medium shadow-sm" value={jobForm.notes} onChange={e => setJobForm({...jobForm, notes: e.target.value})} />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Tishga tegishli rasmlar (Fotosurat / Rentgen)</Label>
                    <div className="flex flex-wrap gap-2.5 items-center pt-1">
                      {/* Upload Button */}
                      <label className="w-16 h-16 rounded-2xl border-2 border-dashed border-slate-200 hover:border-emerald-500 cursor-pointer flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-emerald-600 transition-colors bg-slate-50/50">
                        <Camera className="w-5 h-5" />
                        <span className="text-[8px] font-bold uppercase tracking-tight">Kamera / Rasm</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async (e) => {
                            const files = Array.from(e.target.files || []);
                            if (files.length === 0) return;
                            
                            const loadedUrls = await Promise.all(
                              files.map(file => {
                                return new Promise((resolve) => {
                                  const reader = new FileReader();
                                  reader.onloadend = () => resolve(reader.result);
                                  reader.readAsDataURL(file);
                                });
                              })
                            );
                            setJobForm(prev => ({
                              ...prev,
                              photo_urls: [...(prev.photo_urls || []), ...loadedUrls]
                            }));
                          }}
                        />
                      </label>

                      {/* Thumbnails list */}
                      {jobForm.photo_urls?.map((url, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-2xl overflow-hidden group border border-slate-100 shadow-sm shrink-0">
                          <img src={url} alt="Tooth" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => {
                              setJobForm(prev => ({
                                ...prev,
                                photo_urls: prev.photo_urls.filter((_, i) => i !== idx)
                              }));
                            }}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center shadow-md opacity-90 hover:opacity-100 hover:scale-105 transition-all cursor-pointer"
                          >
                            <span className="text-[10px] font-black leading-none">×</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* pb for footer */}
                  <div className="h-4" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sticky Footer Navigation */}
          {jobStep > 1 && (
            <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between shrink-0 gap-3">
              <button
                onClick={() => setJobStep(prev => prev - 1)}
                className="h-12 px-5 sm:px-8 rounded-xl sm:rounded-2xl font-black uppercase tracking-widest text-slate-500 text-sm border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
              >
                ← Orqaga
              </button>

              {jobStep === 2 ? (
                <button
                  onClick={() => setJobStep(3)}
                  disabled={!jobForm.tooth_number}
                  className="flex-1 h-12 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                >
                  Davom etish →
                  {jobForm.tooth_number && <span className="px-2 py-0.5 bg-white/20 rounded-lg text-xs">{jobForm.tooth_number.split(', ').length} ta</span>}
                </button>
              ) : (
                <button
                  onClick={handleCreateJob}
                  className="flex-1 h-12 rounded-xl sm:rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-sm uppercase tracking-widest active:scale-95 transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2"
                >
                  ✅ Saqlash
                </button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>



      {/* Creation Modal (Tech) */}
      <Dialog open={techModalOpen} onOpenChange={setTechModalOpen}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] p-0 rounded-[2.5rem] border-0 shadow-2xl bg-white/95 backdrop-blur-xl flex flex-col overflow-visible">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-[2.5rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                <UserPlus className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white uppercase tracking-tight">
                  Texnik qo'shish
                </DialogTitle>
                <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-0.5">Texnik ma'lumotlari</p>
              </div>
            </div>
            <button 
              onClick={() => setTechModalOpen(false)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          <div className="space-y-5 p-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">To'liq nomi</Label>
               <Input placeholder="Azizbek Musayev" className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={techForm.name} onChange={e => setTechForm({...techForm, name: e.target.value})} />
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Telefon</Label>
               <Input placeholder="+998" className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={techForm.phone} onChange={e => setTechForm({...techForm, phone: e.target.value})} />
            </div>
            <div className="space-y-2">
               <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Ixtisosligi</Label>
               <Input placeholder="Zirkon, Ortopediya" className="h-12 rounded-2xl bg-slate-50 border-none font-bold" value={techForm.specialization} onChange={e => setTechForm({...techForm, specialization: e.target.value})} />
            </div>
          </div>

          <div className="flex gap-2 p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] shrink-0">
            <Button variant="ghost" onClick={() => setTechModalOpen(false)} className="flex-1 h-12 rounded-2xl font-bold uppercase text-[10px]">Bekor qilish</Button>
            <Button onClick={handleCreateTech} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-12 rounded-2xl font-bold uppercase text-[10px] shadow-md shadow-emerald-500/10 border-none transition-all active:scale-95">Saqlash</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import LeadSourceIcon from '@/components/ui/LeadSourceIcon';
import { 
  X, CheckCircle2, Facebook, 
  Phone, MessageSquare, Target, Instagram,
  Zap, User, Globe, MessageCircle, Loader2, ClipboardList
} from 'lucide-react';
import { supabase } from '@/api/supabaseClient';

export default function LeadQuickView({ lead, isOpen, onClose }) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const [isConverting, setIsConverting] = useState(false);

  const handleConvertToPatient = async () => {
    setIsConverting(true);
    try {
       const userClinic = lead.clinic_id || localStorage.getItem('clinicId') || 'ava-dent';
       
       // 1. Insert to patients table
       const { error: patientError } = await supabase.from('patients').insert({
         full_name: lead.name,
         phone: lead.phone,
         clinic_id: userClinic,
         status: 'Active',
         notes: `Ushbu bemor Avto-Generatsiya orqali Marketing (Facebook/Instagram) bo'limidan o'tkazildi. Asl Lead ID: ${lead.id}`
       });
       
       if (patientError) throw patientError;

       // 2. Update lead status to 'converted'
       const { error: leadError } = await supabase.from('leads').update({
         status: 'converted'
       }).eq('id', lead.id);

       if (leadError) throw leadError;

       alert("🎉 Muaffaqiyatli! Mijoz bemorlar bazasiga o'tkazildi!");
       onClose();
       // Reload page to reflect UI changes across all tabs
       window.location.reload(); 
    } catch(err) {
       console.error(err);
       alert("Konvertatsiya vaqtida xatolik yuz berdi: " + err.message);
    } finally {
       setIsConverting(false);
    }
  };

  if (!lead) return null;

  // Determine platform details
  const srcLower = (lead.source || '').toLowerCase();
  let platformName = "Facebook Ads";
  let PlatformIcon = Facebook;
  let iconBgClass = "bg-[#1877F2]/10 text-[#1877F2]";

  if (srcLower.includes('instagram') || srcLower.includes('insta')) {
    platformName = "Instagram Ads";
    PlatformIcon = Instagram;
    iconBgClass = "bg-rose-50 text-rose-500 border border-rose-100";
  } else if (srcLower.includes('telegram') || srcLower.includes('tg')) {
    platformName = "Telegram Bot / Ads";
    PlatformIcon = MessageCircle;
    iconBgClass = "bg-sky-50 text-sky-500 border border-sky-100";
  } else if (srcLower.includes('phone') || srcLower.includes('qo\'ng\'iroq') || srcLower.includes('call')) {
    platformName = "Telefon Qo'ng'irog'i";
    PlatformIcon = Phone;
    iconBgClass = "bg-emerald-50 text-emerald-600 border border-emerald-100";
  } else if (srcLower.includes('website') || srcLower.includes('sayt') || srcLower.includes('google')) {
    platformName = "Veb-sayt arizasi";
    PlatformIcon = Globe;
    iconBgClass = "bg-slate-50 text-slate-600 border border-slate-100";
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div 
          onClick={onClose}
          className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: '100%', opacity: 0.5 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-t-[2rem] sm:rounded-2xl shadow-2xl overflow-hidden relative flex flex-col max-h-[88vh] sm:max-h-[90vh]"
          >
            {/* Mobile drag handle */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto my-3 sm:hidden shrink-0" />

            <div className="flex-1 overflow-y-auto no-scrollbar">
              {/* Header / Summary Style */}
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <LeadSourceIcon source={lead.source} className="w-10 h-10 rounded-xl shadow-xs" />
                    <div>
                      <h3 className="text-sm font-[900] text-slate-900 uppercase tracking-tight">{platformName}</h3>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Integration ID: FB-{String(lead.id || '').substring(0, 8)}</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="bg-slate-50/50 rounded-xl p-3 border border-slate-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-[900] text-slate-500 uppercase tracking-widest">{language === 'ru' ? 'Статус Лида' : 'Lid Holati'}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">{language === 'ru' ? 'Активный процесс' : 'Faol Jarayon'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-600">1 operation</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-600">1 sync used</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Steps Section */}
              <div className="p-5 space-y-4">
                <div className="relative">
                  <div className="absolute left-2.5 top-2.5 bottom-2.5 w-[1px] bg-slate-100" />
                  
                  <div className="space-y-6 relative">
                    <div className="flex items-start gap-3">
                      <div className="relative z-10 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white ring-4 ring-white shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-[10px] font-[900] text-slate-900 uppercase tracking-tight">Initialization</p>
                        <p className="text-[9px] font-medium text-slate-400">{language === 'ru' ? 'Подключение подтверждено' : 'Ulanish tasdiqlandi'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="relative z-10 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white ring-4 ring-white shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      <div className="flex-1 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100 mt-0.5">
                        <div className="flex items-center justify-between mb-2.5">
                          <p className="text-[10px] font-[900] text-slate-900 uppercase tracking-tight">Lid ma'lumotlari</p>
                          <span className="text-[8px] font-black text-slate-300">OP-1</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-indigo-500 shadow-sm border border-slate-50 shrink-0">
                              <User className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Mijoz ismi</p>
                              <p className="text-xs font-[900] text-slate-900 uppercase tracking-tight mt-0.5">{lead.name}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-emerald-500 shadow-sm border border-slate-50 shrink-0">
                              <Phone className="w-4 h-4" />
                            </div>
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Telefon raqami</p>
                                <p className="text-xs font-[900] text-slate-900 uppercase tracking-tight mt-0.5">{lead.phone}</p>
                              </div>
                            </div>
                          </div>

                          {/* Specific Ad / Creative Info */}
                          {(lead.ad_name || lead.campaign_name || lead.source) && (
                            <div className="flex items-start gap-3 pt-3 border-t border-slate-100/50">
                              <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-sm shrink-0">
                                <Target className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reklama manbasi</p>
                                <p className="text-xs font-[900] text-indigo-600 uppercase tracking-tight mt-0.5">
                                  {lead.ad_name || lead.campaign_name || lead.source}
                                </p>
                                {lead.campaign_name && lead.ad_name && (
                                  <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase">Kampaniya: {lead.campaign_name}</p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Form Questions & Answers Section */}
                          {lead.form_data && Object.keys(lead.form_data).length > 0 && (
                            <div className="pt-3 border-t border-slate-100/50">
                              <div className="flex items-center gap-1.5 mb-2">
                                <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Mijoz javoblari</p>
                              </div>
                              <div className="space-y-2 pl-2 border-l-2 border-emerald-100/50">
                                {Object.entries(lead.form_data).map(([question, answer], idx) => (
                                  <div key={idx} className="bg-slate-50/50 p-2.5 rounded-lg border border-slate-100/80">
                                    <p className="text-[8px] font-[900] text-slate-400 uppercase tracking-wider leading-relaxed mb-0.5">
                                      ? {question}
                                    </p>
                                    <p className="text-[10px] font-bold text-slate-800 leading-snug">
                                      {answer}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="relative z-10 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-white ring-4 ring-white shadow-sm">
                        <CheckCircle2 className="w-3 h-3" />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-[10px] font-[900] text-slate-900 uppercase tracking-tight">Database Committed</p>
                        <p className="text-[9px] font-medium text-slate-400">Supabase bilan muvaffaqiyatli sinxronlandi</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div 
              className="p-4 bg-slate-50/50 border-t border-slate-100 flex flex-col gap-2"
              style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="flex gap-2">
                <button 
                  onClick={handleConvertToPatient}
                  disabled={isConverting}
                  className="flex-1 h-11 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md shadow-emerald-500/10 disabled:opacity-50 hover:-translate-y-0.5"
                >
                  {isConverting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Target className="w-4 h-4 text-white" />}
                  {t('leads.actionConvertToPatient') || "Bemorga O'tkazish"}
                </button>

                <button 
                  onClick={async () => {
                    try {
                       await supabase.from('leads').update({ status: 'converted' }).eq('id', lead.id);
                    } catch(e) { console.error(e); }
                    onClose();
                    navigate('/patients', { state: { openAddModal: true, leadData: { full_name: lead.name, phone: lead.phone, source: lead.source || lead.ad_name || 'Instagram/Facebook Ads', lead_id: lead.id } } });
                  }}
                  className="px-4 h-11 bg-white border border-emerald-300 text-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all hover:bg-emerald-50 hover:-translate-y-0.5"
                >
                  <ClipboardList className="w-4 h-4 text-emerald-500" />
                  {t('leads.actionCreatePlan') || "Reja Yaratish"}
                </button>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => window.open(`tel:${lead.phone}`, '_self')}
                  className="flex-1 h-11 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-2 active:scale-95 transition-all hover:-translate-y-0.5"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-400" />
                  {t('leads.actionCall') || "Qo'ng'iroq Qilish"}
                </button>
                <button 
                  onClick={() => {
                    const phone = lead.phone?.replace(/\D/g, '');
                    if (phone) window.open(`https://t.me/+${phone}`, '_blank');
                  }}
                  className="h-11 w-11 bg-white border border-slate-200 text-sky-500 rounded-xl flex items-center justify-center active:scale-95 transition-all hover:bg-sky-50 hover:border-sky-200 hover:-translate-y-0.5 shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}


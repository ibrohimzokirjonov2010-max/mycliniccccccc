import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, Copy, ExternalLink, Send, 
  Share2, QrCode, Download, Sparkles,
  Link2, CheckCircle2, AlertCircle, X,
  Globe, MessageCircle, Instagram, MapPin, 
  Clock, FileText, Info
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

/**
 * Premium Mobile Public Page Settings
 * Allows clinics to manage their public landing page and sharing
 */
export default function MobilePublicPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  
  // Additional Info Fields
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    telegram: '',
    instagram: '',
    whatsapp: ''
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await base44.clinic.getCurrentClinic();
        if (data) {
          setClinic(data);
          setSlug(data.slug || '');
          setIsPublished(!!data.is_public);
          setDescription(data.description || '');
          setAddress(data.address || '');
          setWorkingHours(data.working_hours || '');
          setSocialLinks({
            telegram: data.telegram_link || '',
            instagram: data.instagram_link || '',
            whatsapp: data.whatsapp_link || ''
          });
        }
      } catch (err) {
        console.error('Failed to load clinic public settings:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const handleSave = async () => {
    if (!slug) {
      toast.error('Iltimos, avval slug kiriting');
      return;
    }
    
    setSaving(true);
    try {
      await base44.clinic.updateClinic(clinic.id, {
        slug: slug.toLowerCase().replace(/\s+/g, '-'),
        is_public: isPublished,
        description,
        address,
        working_hours: workingHours,
        telegram_link: socialLinks.telegram,
        instagram_link: socialLinks.instagram,
        whatsapp_link: socialLinks.whatsapp
      });
      toast.success('Professional sahifa sozlamalari saqlandi');
    } catch (err) {
      toast.error('Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    if (!slug) return toast.error('Avval slug kiriting');
    const link = `https://shifocrm.uz/p/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Havola nusxalandi');
  };

  const openPage = () => {
    if (!slug) return toast.error('Avval slug kiriting');
    window.open(`https://shifocrm.uz/p/${slug}`, '_blank');
  };

  const shareViaTelegram = () => {
    const text = `Sizni ${clinic?.name || 'klinika'}mizga taklif qilamiz! Manzil: ${address}. Online yozilish uchun havola: https://shifocrm.uz/p/${slug}`;
    window.open(`https://t.me/share/url?url=https://shifocrm.uz/p/${slug}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaWhatsApp = () => {
    const text = `Sizni ${clinic?.name || 'klinika'}mizga taklif qilamiz! Online yozilish uchun havola: https://shifocrm.uz/p/${slug}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: clinic?.name || 'Klinikamiz',
          text: 'Online yozilish va ma\'lumotlar uchun havola',
          url: `https://shifocrm.uz/p/${slug}`,
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      copyLink();
    }
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://shifocrm.uz/p/${slug}`)}`;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
         <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-slate-200 border-t-[#1499AD] rounded-full animate-spin" />
            <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Yuklanmoqda...</p>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24">
      {/* Premium Gradient Header */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-50 px-6 py-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 -ml-2 rounded-xl hover:bg-slate-50 active:scale-90 transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-slate-700" />
          </button>
          <div>
            <h1 className="text-xl font-[900] text-slate-900 leading-tight">Professional sahifa</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className={`w-2 h-2 rounded-full ${isPublished ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {isPublished ? 'Havola ochiq' : 'Havola yopiq'}
              </p>
            </div>
          </div>
        </div>
        <button className="w-10 h-10 bg-gradient-to-br from-[#1499AD] to-[#0E7A8A] rounded-xl flex items-center justify-center text-white shadow-lg shadow-[#1499AD]/20 active:scale-90 transition-all">
          <Sparkles className="w-5 h-5" />
        </button>
      </div>

      <div className="p-5 space-y-6">
        {/* Status Badges - EXACTLY AS IN SCREENSHOT */}
        <div className="flex flex-wrap gap-2 px-1">
          <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 ${
            isPublished ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
          }`}>
             {isPublished ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
             {isPublished ? 'Sahifa faol' : 'Havola yopiq'}
          </div>
          {!slug && (
            <div className="px-4 py-1.5 rounded-full bg-amber-50 text-amber-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
               <Link2 className="w-3 h-3" />
               Slug kiriting va saqlang
            </div>
          )}
        </div>

        {/* Action Buttons Grid - PREMIUM STYLE AS IN SCREENSHOT */}
        <div className="space-y-3">
          <Button 
            onClick={copyLink}
            className="w-full h-16 bg-[#86C4E1] hover:bg-[#75B5D2] text-white rounded-2xl border-none font-bold text-base shadow-sm active:scale-[0.98] transition-all"
          >
            Havolani nusxalash
          </Button>

          <Button 
            onClick={openPage}
            className="w-full h-16 bg-[#A79CFF] hover:bg-[#9689FF] text-white rounded-2xl border-none font-bold text-base shadow-sm active:scale-[0.98] transition-all"
          >
            Sahifaga o'tish
          </Button>

          <Button 
            onClick={shareViaTelegram}
            className="w-full h-16 bg-[#87CEEB] hover:bg-[#78BFDC] text-white rounded-2xl border-none font-bold text-base shadow-sm active:scale-[0.98] transition-all"
          >
            Telegram
          </Button>

          <Button 
            onClick={shareViaWhatsApp}
            className="w-full h-16 bg-[#8CD2AC] hover:bg-[#7DC19B] text-white rounded-2xl border-none font-bold text-base shadow-sm active:scale-[0.98] transition-all"
          >
            WhatsApp
          </Button>

          <Button 
            onClick={handleNativeShare}
            className="w-full h-16 bg-[#9FA7AF] hover:bg-[#8F979F] text-white rounded-2xl border-none font-bold text-base shadow-sm active:scale-[0.98] transition-all"
          >
            Ulashish
          </Button>
        </div>

        {/* QR Code Container - EXACTLY AS IN SCREENSHOT */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-100"
        >
          <div className="space-y-1 mb-6">
            <h3 className="font-black text-slate-900 text-lg tracking-tight">QR kod</h3>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">
              Print va raqamli ulashish uchun tayyor
            </p>
          </div>

          <div className="space-y-6">
            <Button 
              variant="outline"
              className="w-full h-12 rounded-xl border-slate-100 text-slate-400 font-bold"
              disabled={!isPublished}
              onClick={() => window.open(qrImageUrl, '_blank')}
            >
              QR yuklab olish
            </Button>

            <div className="aspect-square bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-100 flex items-center justify-center relative overflow-hidden">
              {!isPublished ? (
                <div className="flex flex-col items-center gap-3 p-10 text-center bg-slate-400/10 w-full h-full justify-center">
                   <p className="text-sm font-black text-slate-500 uppercase tracking-widest">
                      Havola yopiq — avval yoqing
                   </p>
                </div>
              ) : (
                <img 
                  src={qrImageUrl} 
                  alt="Clinic QR Code" 
                  className="w-full h-full p-8 object-contain"
                />
              )}
            </div>
          </div>
        </motion.div>

        {/* Data Input Section - NEW PROFESSIONAL FIELDS */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/40 border border-slate-100 space-y-6"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-slate-50">
            <div className="w-10 h-10 bg-[#1499AD]/10 rounded-xl flex items-center justify-center text-[#1499AD]">
              <Info className="w-5 h-5" />
            </div>
            <h3 className="font-black text-slate-900 text-lg">Sahifa ma'lumotlari</h3>
          </div>

          <div className="flex items-center justify-between mb-8 p-4 bg-slate-50 rounded-2xl">
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-black uppercase tracking-widest ${
                isPublished ? 'text-emerald-600' : 'text-slate-400'
              }`}>
                Sahifa holati: {isPublished ? 'OCHIQ' : 'YOPIQ'}
              </span>
            </div>
            <div 
              onClick={() => setIsPublished(!isPublished)}
              className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 ${
                isPublished ? 'bg-emerald-500' : 'bg-slate-200'
              }`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${
                isPublished ? 'translate-x-6' : 'translate-x-0'
              }`} />
            </div>
          </div>

          <div className="space-y-4">
            {/* Slug Input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                <Globe className="w-3 h-3" /> Havola manzili (slug)
              </label>
              <div className="relative group">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">crm.uz/p/</div>
                <Input 
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="klinika-nomi"
                  className="h-14 pl-[5.5rem] rounded-2xl border-none bg-slate-50 font-black text-slate-900 shadow-inner focus:bg-white focus:ring-2 focus:ring-[#1499AD]/10 transition-all"
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                <FileText className="w-3 h-3" /> Klinika haqida tavsif
              </label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Klinikangiz haqida bemorlarga qisqacha ma'lumot kiriting..."
                className="min-h-[100px] rounded-2xl border-none bg-slate-50 font-medium text-slate-900 shadow-inner focus:bg-white focus:ring-2 focus:ring-[#1499AD]/10 transition-all p-4"
              />
            </div>

            {/* Address */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                <MapPin className="w-3 h-3" /> Manzil
              </label>
              <Input 
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Toshkent sh., Yunusobod tumani..."
                className="h-14 rounded-2xl border-none bg-slate-50 font-black text-slate-900 shadow-inner focus:bg-white focus:ring-2 focus:ring-[#1499AD]/10 transition-all px-6"
              />
            </div>

            {/* Working Hours */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                <Clock className="w-3 h-3" /> Ish vaqti
              </label>
              <Input 
                value={workingHours}
                onChange={(e) => setWorkingHours(e.target.value)}
                placeholder="Du-Sha: 09:00 - 18:00"
                className="h-14 rounded-2xl border-none bg-slate-50 font-black text-slate-900 shadow-inner focus:bg-white focus:ring-2 focus:ring-[#1499AD]/10 transition-all px-6"
              />
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-2 gap-3 pt-4">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                    <Instagram className="w-3 h-3" /> Instagram
                  </label>
                  <Input 
                    value={socialLinks.instagram}
                    onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})}
                    placeholder="@clinic"
                    className="h-12 rounded-xl border-none bg-slate-50 font-bold text-slate-900 shadow-inner focus:bg-white"
                  />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 flex items-center gap-2">
                    <Send className="w-3 h-3" /> Telegram
                  </label>
                  <Input 
                    value={socialLinks.telegram}
                    onChange={(e) => setSocialLinks({...socialLinks, telegram: e.target.value})}
                    placeholder="@clinic_tg"
                    className="h-12 rounded-xl border-none bg-slate-50 font-bold text-slate-900 shadow-inner focus:bg-white"
                  />
               </div>
            </div>

            <p className="text-[10px] font-medium text-slate-400 text-center px-4 uppercase tracking-wider pt-2">
              Barcha o'zgarishlarni saqlashni unutmang. Bu ma'lumotlar bemorlar sahifasida ko'rinadi.
            </p>
            
            <Button 
               onClick={handleSave}
               disabled={saving}
               className="w-full h-16 rounded-2xl bg-slate-900 text-white font-bold uppercase text-xs tracking-[0.2em] shadow-xl active:scale-[0.98] transition-all"
            >
              {saving ? 'Saqlanmoqda...' : 'SOZLAMALARNI SAQLASH'}
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Footer hint */}
      <div className="px-10 text-center py-8">
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">
          ShifoCRM Professional Public Links
        </p>
      </div>
    </div>
  );
}

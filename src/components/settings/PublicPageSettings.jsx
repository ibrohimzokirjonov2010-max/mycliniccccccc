import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Globe, Copy, ExternalLink, Send, 
  MessageCircle, Instagram, MapPin, 
  Clock, FileText, Sparkles, QrCode,
  Download, CheckCircle2, AlertCircle,
  Smartphone, Monitor, Info
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function PublicPageSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [slug, setSlug] = useState('');
  const [isPublished, setIsPublished] = useState(false);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [workingHours, setWorkingHours] = useState('');
  const [socialLinks, setSocialLinks] = useState({
    telegram: '',
    instagram: '',
    whatsapp: '',
    yandexMap: ''
  });

  const [previewMode, setPreviewMode] = useState('mobile');

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
            whatsapp: data.whatsapp_link || '',
            yandexMap: data.yandex_map_link || ''
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
        whatsapp_link: socialLinks.whatsapp,
        yandex_map_link: socialLinks.yandexMap
      });
      toast.success('Professional sahifa sozlamalari saqlandi');
    } catch (err) {
      toast.error('Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  };

  const copyLink = () => {
    const link = `https://shifocrm.uz/p/${slug}`;
    navigator.clipboard.writeText(link);
    toast.success('Havola nusxalandi');
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://shifocrm.uz/p/${slug}`)}`;

  if (loading) return <div className="h-64 flex items-center justify-center"><div className="w-8 h-8 border-4 border-slate-200 border-t-[#1499AD] rounded-full animate-spin" /></div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Settings Form */}
      <div className="space-y-6">
        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-lg">Ommaviy sahifa sozlamalari</h3>
                <p className="text-xs text-slate-500 font-medium tracking-wide">Bemorlar uchun klinika tashrif qog'ozi</p>
              </div>
            </div>
            <div 
              onClick={() => setIsPublished(!isPublished)}
              className={`w-14 h-8 rounded-full p-1 cursor-pointer transition-colors duration-300 ${isPublished ? 'bg-emerald-500' : 'bg-slate-200'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full shadow-md transition-transform duration-300 ${isPublished ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Havola manzili (slug)</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">crm.uz/p/</div>
                <Input 
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="klinika-nomi"
                  className="h-12 pl-20 rounded-xl border-slate-200 focus:border-[#1499AD] focus:ring-4 focus:ring-[#1499AD]/10 font-bold transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Klinika haqida tavsif</label>
              <Textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Xizmatlaringiz haqida..."
                className="min-h-[100px] rounded-xl border-slate-200 focus:border-[#1499AD] transition-all p-4 resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Manzil</label>
                <Input 
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Shahar, ko'cha..."
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ish vaqti</label>
                <Input 
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder="09:00 - 18:00"
                  className="h-12 rounded-xl border-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Instagram</label>
                <Input 
                  value={socialLinks.instagram}
                  onChange={(e) => setSocialLinks({...socialLinks, instagram: e.target.value})}
                  placeholder="@username"
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telegram</label>
                <Input 
                  value={socialLinks.telegram}
                  onChange={(e) => setSocialLinks({...socialLinks, telegram: e.target.value})}
                  placeholder="@username"
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                <Input 
                  value={socialLinks.whatsapp}
                  onChange={(e) => setSocialLinks({...socialLinks, whatsapp: e.target.value})}
                  placeholder="+998..."
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Yandex Map Link</label>
                <Input 
                  value={socialLinks.yandexMap}
                  onChange={(e) => setSocialLinks({...socialLinks, yandexMap: e.target.value})}
                  placeholder="https://yandex.ru/maps/..."
                  className="h-10 rounded-xl border-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <Button 
               onClick={handleSave}
               disabled={saving}
               className="flex-1 h-12 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-all"
            >
              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
            </Button>
            <Button 
               variant="outline"
               onClick={() => window.open(`/p/${slug}`, '_blank')}
               className="px-6 h-12 rounded-xl font-bold border-slate-200"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Ochish
            </Button>
            <Button 
               variant="outline"
               onClick={copyLink}
               className="px-6 h-12 rounded-xl font-bold border-slate-200"
            >
              <Copy className="w-4 h-4 mr-2" />
              Nusxalash
            </Button>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
           <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-slate-900">QR Kod</h3>
              <Button size="sm" variant="ghost" className="text-[#1499AD]" onClick={() => window.open(qrImageUrl, '_blank')}>
                <Download className="w-4 h-4 mr-2" /> Yuklab olish
              </Button>
           </div>
           
           <div className="flex items-center gap-8">
              <div className="w-32 h-32 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                {isPublished ? (
                  <img src={qrImageUrl} alt="QR" className="w-full h-full p-2 object-contain" />
                ) : (
                  <AlertCircle className="w-8 h-8 text-slate-300" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                 <p className="text-sm font-bold text-slate-700">Klinika foyesiga qo'ying</p>
                 <p className="text-xs text-slate-500 leading-relaxed">
                   Bemorlar QR kodni skanerlash orqali klinikangiz haqida ma'lumot olishadi va online yozilishadi.
                 </p>
              </div>
           </div>
        </div>
      </div>

      {/* Live Preview */}
      <div className="hidden lg:block relative">
         <div className="sticky top-8">
            <div className="flex items-center justify-between mb-4">
               <h3 className="font-bold text-slate-900">Jonli ko'rinish</h3>
               <div className="flex bg-slate-100 p-1 rounded-lg">
                  <button 
                    onClick={() => setPreviewMode('mobile')}
                    className={`p-1.5 rounded-md transition-all ${previewMode === 'mobile' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Smartphone className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setPreviewMode('desktop')}
                    className={`p-1.5 rounded-md transition-all ${previewMode === 'desktop' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <Monitor className="w-4 h-4" />
                  </button>
               </div>
            </div>

            <div className={`mx-auto bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border-[8px] border-slate-900 overflow-hidden transition-all duration-500 ${previewMode === 'mobile' ? 'max-w-[280px] h-[580px]' : 'max-w-full h-[580px]'}`}>
               <div className="h-full overflow-y-auto bg-slate-50 custom-scrollbar">
                  {/* Mock Public Page Content */}
                  <div className="bg-[#1499AD] p-8 text-center text-white">
                     <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto mb-4 border border-white/30 backdrop-blur-md flex items-center justify-center font-black text-xl">
                        {clinic?.name?.[0] || 'C'}
                     </div>
                     <h4 className="font-black text-lg">{clinic?.name || 'Klinika Nomi'}</h4>
                     <p className="text-xs text-white/70 mt-1 flex items-center justify-center gap-1">
                        <MapPin className="w-3 h-3" /> {address || 'Manzil'}
                     </p>
                  </div>

                  <div className="p-6 space-y-6">
                     <div className="bg-white p-4 rounded-2xl shadow-sm space-y-2">
                        <h5 className="font-black text-[10px] text-slate-400 uppercase tracking-widest">Klinika haqida</h5>
                        <p className="text-xs text-slate-600 leading-relaxed font-medium">
                           {description || 'Sizning klinikangiz haqida ajoyib tavsif bu yerda paydo bo\'ladi...'}
                        </p>
                     </div>

                     <div className="grid grid-cols-1 gap-3">
                        <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3">
                           <Clock className="w-5 h-5 text-indigo-500" />
                           <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Ish vaqti</p>
                              <p className="text-xs font-bold text-slate-800">{workingHours || 'Du-Sha: 09:00 - 18:00'}</p>
                           </div>
                        </div>

                        <div className="bg-white p-4 rounded-2xl shadow-sm flex items-center gap-3">
                           <MapPin className="w-5 h-5 text-rose-500" />
                           <div>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">Manzil</p>
                              <p className="text-xs font-bold text-slate-800 leading-tight">{address || 'Klinika manzili...'}</p>
                           </div>
                        </div>
                     </div>

                     <Button className="w-full h-12 bg-slate-900 rounded-xl font-bold">
                        ONLINE YOZILISH
                     </Button>

                     <div className="flex justify-center gap-4 pt-4 border-t border-slate-100">
                        {socialLinks.instagram && <Instagram className="w-5 h-5 text-slate-300" />}
                        {socialLinks.telegram && <Send className="w-5 h-5 text-slate-300" />}
                        {socialLinks.whatsapp && <MessageCircle className="w-5 h-5 text-slate-300" />}
                        {socialLinks.yandexMap && <MapPin className="w-5 h-5 text-slate-300" />}
                     </div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { 
  Globe, Copy, ExternalLink, Send, 
  MessageCircle, Instagram, MapPin, 
  Clock, Download, AlertCircle,
  Smartphone, Monitor, CheckCircle2,
  Table, Sparkles, Check, ImagePlus,
  Trash2, Building2
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import LocationMapPickerModal from './LocationMapPickerModal';

function TelegramIcon({ className = "w-4 h-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.002.001-.314 4.692c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.434z" />
    </svg>
  );
}

// ─── Memoized Live Preview Panel ─────────────────────────────────────────────
// Faqat preview uchun kerakli ma'lumotlar o'zgarganda qayta render bo'ladi.
// Form inputlardagi har bir tugma bosish bu panelni qayta render qilmaydi.
const LivePreviewPanel = memo(function LivePreviewPanel({
  previewMode, setPreviewMode, clinicName, clinicLogo, address,
  description, workingHours, socialLinks, t
}) {
  return (
    <div className="lg:col-span-5">
      <div className="sticky top-6 border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
        
        {/* Inspection Header */}
        <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <h4 className="font-bold text-slate-900 text-xs">{t('settings.publicPage.livePreview') || "Jonli ko'rinish"}</h4>
          </div>

          <div className="flex bg-white border border-slate-300 rounded-lg p-0.5">
            <button 
              onClick={() => setPreviewMode('mobile')}
              className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${previewMode === 'mobile' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              title="Mobil ko'rinish"
            >
              <Smartphone className="w-3.5 h-3.5" /> Mobil
            </button>
            <button 
              onClick={() => setPreviewMode('desktop')}
              className={`px-2 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 ${previewMode === 'desktop' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'}`}
              title="Desktop ko'rinish"
            >
              <Monitor className="w-3.5 h-3.5" /> Desktop
            </button>
          </div>
        </div>

        {/* Preview Container */}
        <div className="p-4 bg-slate-50 flex items-center justify-center min-h-[560px]">
          <div className={`bg-white rounded-2xl shadow-xl border-4 border-slate-800 overflow-hidden transition-all duration-300 ${previewMode === 'mobile' ? 'w-[280px] h-[520px]' : 'w-full h-[520px]'}`}>
            <div className="h-full overflow-y-auto bg-slate-50 custom-scrollbar text-left">
              
              {/* Clinic Header Banner */}
              <div className="bg-[#1499AD] p-6 text-center text-white">
                <div className="w-16 h-16 bg-white/20 rounded-2xl mx-auto mb-3 border border-white/30 backdrop-blur-md flex items-center justify-center font-black text-xl shadow-inner overflow-hidden">
                  {clinicLogo ? (
                    <img src={clinicLogo} alt="Logo" className="w-full h-full object-contain p-1 rounded-xl" />
                  ) : (
                    clinicName?.[0]?.toUpperCase() || 'C'
                  )}
                </div>
                <h4 className="font-black text-base tracking-tight">{clinicName || 'Klinika Nomi'}</h4>
                <p className="text-[11px] text-white/80 mt-1 flex items-center justify-center gap-1">
                  <MapPin className="w-3 h-3" /> {address || t('settings.publicPage.defaultAddress') || 'Manzil...'}
                </p>
              </div>

              {/* Content Cards */}
              <div className="p-4 space-y-3">
                
                {/* About Card */}
                <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
                  <h5 className="font-black text-[9px] text-slate-400 uppercase tracking-wider">{t('settings.publicPage.aboutClinic') || "Klinika haqida"}</h5>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    {description || t('settings.publicPage.defaultDesc') || "Sizning klinikangiz haqida ajoyib tavsif bu yerda paydo bo'ladi..."}
                  </p>
                </div>

                {/* Hours & Address */}
                <div className="space-y-2">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-indigo-500 shrink-0" />
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{t('settings.publicPage.workingHours') || "Ish vaqti"}</p>
                      <p className="text-[11px] font-bold text-slate-800">{workingHours || 'Du-Sha: 09:00 - 18:00'}</p>
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-xs flex items-center gap-2.5">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">{t('settings.publicPage.address') || "Manzil"}</p>
                      <p className="text-[11px] font-bold text-slate-800 leading-tight">{address || 'Klinika manzili...'}</p>
                    </div>
                  </div>
                </div>

                {/* Online Appointment CTA */}
                <Button className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-sm">
                  {t('settings.publicPage.onlineAppointment') || "ONLINE YOZILISH"}
                </Button>

                {/* Social Icons */}
                <div className="flex justify-center gap-3 pt-2 border-t border-slate-200">
                  {socialLinks.instagram && <Instagram className="w-4 h-4 text-pink-500" />}
                  {socialLinks.telegram && <TelegramIcon className="w-4 h-4 text-[#229ED9]" />}
                  {socialLinks.yandexMap && <MapPin className="w-4 h-4 text-amber-500" />}
                </div>

              </div>

            </div>
          </div>
        </div>

      </div>
    </div>
  );
});
// ─────────────────────────────────────────────────────────────────────────────

export default function PublicPageSettings() {
  const { t } = useTranslation();
  const { refresh: refreshClinic } = useClinic?.() || {};
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clinic, setClinic] = useState(null);
  const [clinicName, setClinicName] = useState('');
  const [clinicLogo, setClinicLogo] = useState(null);
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
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState('mobile');
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiVariantIndex, setAiVariantIndex] = useState(0);
  const [isMapModalOpen, setIsMapModalOpen] = useState(false);

  const handleSelectMapLocation = useCallback(({ address: newAddress, yandexMap: newYandexMap }) => {
    if (newAddress) setAddress(newAddress);
    if (newYandexMap) setSocialLinks(prev => ({ ...prev, yandexMap: newYandexMap }));
  }, []);

  const handleGenerateAIDescription = useCallback(() => {
    const rawName = clinicName?.trim() || clinic?.name?.trim() || 'Klinikamiz';
    setGeneratingAI(true);
    
    setTimeout(() => {
      // 1. Dynamic Openings tailored to clinic name
      const intros = [
        `«${rawName}» — zamonaviy stomatologik innovatsiyalar va yuqori sifat maskani.`,
        `«${rawName}» klinikasiga xush kelibsiz!`,
        `«${rawName}» — sog'lom tishlar va mukammal tabassum markazi.`,
        `«${rawName}» stomatologiyasi — ilg'or texnologiyalar va og'riqsiz muolajalar maskani.`,
        `«${rawName}» — siz va oilangiz a'zolari uchun ishonchli stomatologik yordam.`,
        `«${rawName}» — estetik stomatologiya, implantologiya va zamonaviy ortodontiya markazi.`,
        `«${rawName}» zamonaviy stomatologik klinikasida har bir bemorga alohida e'tibor qaratiladi.`,
        `«${rawName}» — qulay muhit, yuqori sifat va zamonaviy raqamli stomatologiya uyg'unligi.`
      ];

      // 2. Core Treatments & Advantages
      const cores = [
        `Bizda tishlarni og'riqsiz davolash, zamonaviy implantatsiya va professional tozalash xizmatlari ko'rsatiladi.`,
        `Ilg'or uskunalar yordamida kariesni davolash, breketlar, elaynerlar va estetik restavratsiya amalga oshiriladi.`,
        `Eng so'nggi raqamli diagnostika, premium tish implantlari va mukammal viniyrlar xizmatingizda.`,
        `Tishlarni xavfsiz oqartirish, ildiz kanallarini aniq davolash va protezlash eng yuqori standartlarda bajariladi.`,
        `Jahon andozalaridagi uskunalar va tajribali mutaxassislar orqali barcha turdagi tish muolajalari taqdim etiladi.`,
        `Bemorlarimiz uchun og'riqsiz anesteziya, karies profilaktikasi va zamonaviy estetik xizmatlar mavjud.`
      ];

      // 3. Patient Trust & Guarantees
      const outros = [
        `100% sterillik, samimiy xizmat va uzoq yillik kafolat!`,
        `Sizning sog'lom va chiroyli tabassumingiz — bizning eng oliy maqsadimiz.`,
        `Har bir muolaja qulay, tez va to'liq ishonchli tarzda o'tadi.`,
        `Tajribali shifokorlarimizga o'z tabassumingizni bemalol ishonishingiz mumkin.`,
        `Klinikamizda shinam muhit va har bir bemorga individual yondashuv kafolatlanadi.`,
        `Biz bilan tabassumingiz yanada yorqin va jozibali bo'ladi!`
      ];

      const intro = intros[(aiVariantIndex + Math.floor(Math.random() * 2)) % intros.length];
      const core = cores[(aiVariantIndex * 2 + Math.floor(Math.random() * 2)) % cores.length];
      const outro = outros[(aiVariantIndex * 3 + Math.floor(Math.random() * 2)) % outros.length];

      const generatedText = `${intro} ${core} ${outro}`;

      setDescription(generatedText);
      setAiVariantIndex(prev => prev + 1);
      setGeneratingAI(false);
      toast.success("✨ Yangi, o'ziga xos AI tavsifi yaratildi!");
    }, 280);
  }, [clinicName, clinic?.name, aiVariantIndex]);

  const handleClinicNameChange = useCallback((newName) => {
    setClinicName(newName);
    setAddress(prev => {
      if (prev?.trim()) {
        const query = [newName?.trim(), prev.trim()].filter(Boolean).join(', ');
        const mapUrl = `https://yandex.uz/maps/?text=${encodeURIComponent(query)}`;
        setSocialLinks(s => ({ ...s, yandexMap: mapUrl }));
      }
      return prev;
    });
  }, []);

  const handleAddressChange = useCallback((newAddress) => {
    setAddress(newAddress);
    setClinicName(prevName => {
      const query = [prevName?.trim(), newAddress?.trim()].filter(Boolean).join(', ');
      setSocialLinks(s => ({ ...s, yandexMap: query ? `https://yandex.uz/maps/?text=${encodeURIComponent(query)}` : '' }));
      return prevName;
    });
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await base44.clinic.getCurrentClinic();
        if (data) {
          setClinic(data);
          setClinicName(data.name || '');
          setClinicLogo(data.logo || null);
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

  const handleTogglePublished = useCallback(async () => {
    setIsPublished(prev => {
      const nextState = !prev;
      const clinicId = clinic?.id || localStorage.getItem('current_clinic_id') || 'default_clinic';
      base44.clinic.updateClinic(clinicId, { is_public: nextState })
        .then(() => {
          setClinic(c => ({ ...(c || {}), is_public: nextState }));
          if (refreshClinic) refreshClinic();
          toast.success(nextState ? "Sahifa holati: Faol (Ochiq) ga o'zgartirildi" : "Sahifa holati: Nofaol (Yopiq) qilindi");
        })
        .catch(e => console.warn('Auto-save publish state error:', e));
      return nextState;
    });
  }, [clinic?.id, refreshClinic]);

  const handleLogoUpload = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setClinicLogo(reader.result);
        toast.success("Logotip tanlandi (Saqlashni bosing)");
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSave = useCallback(async () => {
    const finalSlug = (slug || clinicName || clinic?.name || 'klinika')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/\s+/g, '-');

    if (!finalSlug) {
      toast.error(t('settings.publicPage.errorSlug') || 'Iltimos, avval havola manzilini kiriting');
      return;
    }
    
    setSlug(finalSlug);
    setSaving(true);
    try {
      const clinicId = clinic?.id || localStorage.getItem('current_clinic_id') || 'default_clinic';
      const updatePayload = {
        id: clinicId,
        name: clinicName?.trim() || clinic?.name || 'Klinika',
        logo: clinicLogo,
        slug: finalSlug,
        is_public: isPublished,
        description: description?.trim() || '',
        address: address?.trim() || '',
        working_hours: workingHours?.trim() || '',
        telegram_link: socialLinks.telegram?.trim() || '',
        instagram_link: socialLinks.instagram?.trim() || '',
        yandex_map_link: socialLinks.yandexMap?.trim() || ''
      };

      await base44.clinic.updateClinic(clinicId, updatePayload);
      setClinic(prev => ({ ...(prev || {}), ...updatePayload }));
      if (refreshClinic) await refreshClinic();
      toast.success("Klinika ma'lumotlari va sahifa sozlamalari muvaffaqiyatli saqlandi!");
    } catch (err) {
      console.error('Save error:', err);
      toast.error(t('settings.publicPage.errorSave') || 'Saqlashda xatolik yuz berdi');
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicName, clinicLogo, slug, isPublished, description, address, workingHours, socialLinks, clinic?.id, t]);

  const copyLink = useCallback(() => {
    const link = `https://shifocrm.uz/p/${slug}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    toast.success(t('settings.publicPage.linkCopied') || 'Havola nusxalandi');
    setTimeout(() => setCopied(false), 2000);
  }, [slug, t]);

  const qrImageUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(`https://shifocrm.uz/p/${slug}`)}`,
    [slug]
  );

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-[#1499AD] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Excel Grid Settings Form */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Main Settings Excel Table */}
        <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
          
          {/* Excel Table Title Bar */}
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-xs shadow-sm">
                <Table className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                {t('settings.publicPage.title') || "Ommaviy sahifa sozlamalari"}
              </h3>
            </div>

            {/* Publication Status Switch */}
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${isPublished ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {isPublished ? '● Faol (Ochiq)' : '○ Nofaol (Yopiq)'}
              </span>
              <div 
                onClick={handleTogglePublished}
                className={`w-11 h-6 rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${isPublished ? 'bg-emerald-600' : 'bg-slate-300'}`}
                title="Sahifani faollashtirish / o'chirish"
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isPublished ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </div>
          </div>

          {/* Column Headers */}
          <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">
            <div className="col-span-1 py-1.5 px-2 border-r border-slate-200 text-center">#</div>
            <div className="col-span-4 py-1.5 px-3 border-r border-slate-200">Parametr</div>
            <div className="col-span-7 py-1.5 px-3">Qiymat / Sozlama</div>
          </div>

          {/* Cells Body */}
          <div className="divide-y divide-slate-200 text-xs font-medium">
            
            {/* Row 1: Clinic Name */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                1
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-slate-800">Klinika nomi</span>
              </div>
              <div className="col-span-7 p-2">
                <Input 
                  type="text"
                  value={clinicName}
                  onChange={(e) => handleClinicNameChange(e.target.value)}
                  placeholder="Masalan: Shifo Denta Clinic"
                  className="h-9 text-xs font-bold border-slate-200 rounded-lg focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Row 2: Clinic Logo */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                2
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                <ImagePlus className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  <span className="font-bold text-slate-800 block">Klinika logotipi</span>
                  <span className="text-[10px] text-slate-400 font-normal">PNG yoki JPG</span>
                </div>
              </div>
              <div className="col-span-7 p-2 flex items-center gap-3">
                <Input 
                  type="file" 
                  accept="image/*" 
                  id="public-logo-upload"
                  className="hidden"
                  onChange={handleLogoUpload} 
                />
                <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 bg-white border-slate-300 font-bold text-xs text-slate-700" asChild>
                  <label htmlFor="public-logo-upload" className="cursor-pointer flex items-center gap-1.5">
                    <ImagePlus className="w-3.5 h-3.5 text-indigo-600" />
                    Logotip yuklash
                  </label>
                </Button>
                {clinicLogo && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border border-slate-200 bg-white p-0.5 overflow-hidden">
                      <img src={clinicLogo} alt="Logo preview" className="w-full h-full object-contain" />
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setClinicLogo(null)}
                      className="text-rose-500 hover:text-rose-700 p-1 rounded"
                      title="Logotipni olib tashlash"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Slug */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                3
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="font-bold text-slate-800">{t('settings.publicPage.linkAddress') || "Havola (Slug)"}</span>
              </div>
              <div className="col-span-7 p-2 flex items-center">
                <div className="flex items-center w-full border border-slate-200 rounded-lg overflow-hidden bg-white focus-within:border-indigo-500 focus-within:ring-1 focus-within:ring-indigo-500">
                  <span className="px-2.5 py-1.5 bg-slate-100 text-slate-500 font-mono text-[11px] font-bold border-r border-slate-200 select-none">
                    crm.uz/p/
                  </span>
                  <input 
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                    placeholder="klinika-nomi"
                    className="w-full px-2.5 py-1.5 font-mono font-bold text-slate-900 text-xs focus:outline-none bg-transparent"
                  />
                </div>
              </div>
            </div>

            {/* Row 4: Description */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                4
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-start gap-2 pt-3">
                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 block">{t('settings.publicPage.description') || "Klinika tavsifi"}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Sahifada ko'rinadi</span>
                </div>
              </div>
              <div className="col-span-7 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400">Tavsif matni:</span>
                  <button
                    type="button"
                    onClick={handleGenerateAIDescription}
                    disabled={generatingAI}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 text-white font-bold text-[11px] shadow-xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                    title="Sun'iy intellekt yordamida klinika tavsifini professional generatsiya qilish"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${generatingAI ? 'animate-spin' : ''}`} />
                    {generatingAI ? "AI yaratmoqda..." : "✨ AI bilan avtomatik yaratish"}
                  </button>
                </div>
                <Textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('settings.publicPage.descriptionPlaceholder') || "Klinikangiz va xizmatlaringiz haqida qisqacha ma'lumot..."}
                  className="min-h-[85px] text-xs font-normal border-slate-200 rounded-lg focus:border-indigo-500 p-2.5 resize-none leading-relaxed"
                />
              </div>
            </div>

            {/* Row 5: Address */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                5
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-start gap-2 pt-3">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800 block">{t('settings.publicPage.address') || "Manzil"}</span>
                  <span className="text-[10px] text-slate-400 font-normal">Klinika joylashuvi</span>
                </div>
              </div>
              <div className="col-span-7 p-2.5 space-y-2">
                <Input 
                  value={address}
                  onChange={(e) => handleAddressChange(e.target.value)}
                  placeholder={t('settings.publicPage.addressPlaceholder') || "Toshkent sh., Yunusobod tumani, 12-mavze..."}
                  className="h-9 text-xs border-slate-200 rounded-lg focus:border-indigo-500"
                />
                <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsMapModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-xs transition-all cursor-pointer"
                    title="Interaktiv xaritadan klinika joyini tanlash va belgilash"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    📍 Xaritadan joyni tanlash
                  </button>

                  {socialLinks.yandexMap && (
                    <a
                      href={socialLinks.yandexMap}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" /> Xaritada tekshirish
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Row 6: Working Hours */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                6
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-bold text-slate-800">{t('settings.publicPage.workingHours') || "Ish vaqti"}</span>
              </div>
              <div className="col-span-7 p-2">
                <Input 
                  value={workingHours}
                  onChange={(e) => setWorkingHours(e.target.value)}
                  placeholder={t('settings.publicPage.workingHoursPlaceholder') || "Dush - Shan: 09:00 - 18:00"}
                  className="h-9 text-xs border-slate-200 rounded-lg focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Row 7: Instagram */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                7
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-600 shrink-0" />
                <span className="font-bold text-slate-800">Instagram</span>
              </div>
              <div className="col-span-7 p-2">
                <Input 
                  value={socialLinks.instagram}
                  onChange={(e) => { const v = e.target.value; setSocialLinks(s => ({ ...s, instagram: v })); }}
                  placeholder="@klinika_nomi"
                  className="h-9 text-xs border-slate-200 rounded-lg focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Row 8: Telegram */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                8
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                <Send className="w-4 h-4 text-sky-500 shrink-0" />
                <span className="font-bold text-slate-800">Telegram</span>
              </div>
              <div className="col-span-7 p-2">
                <Input 
                  value={socialLinks.telegram}
                  onChange={(e) => { const v = e.target.value; setSocialLinks(s => ({ ...s, telegram: v })); }}
                  placeholder="@klinika_bot yoki @username"
                  className="h-9 text-xs border-slate-200 rounded-lg focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Row 9: Yandex Map */}
            <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
              <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                9
              </div>
              <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-bold text-slate-800">Yandex Xarita</span>
              </div>
              <div className="col-span-7 p-2 flex items-center gap-2">
                <Input 
                  value={socialLinks.yandexMap}
                  onChange={(e) => { const v = e.target.value; setSocialLinks(s => ({ ...s, yandexMap: v })); }}
                  placeholder="https://yandex.uz/maps/..."
                  className="h-9 text-xs border-slate-200 rounded-lg focus:border-indigo-500 font-mono text-[11px]"
                />
                <button
                  type="button"
                  onClick={() => setIsMapModalOpen(true)}
                  className="shrink-0 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  title="Xaritadan tanlash"
                >
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  Xaritada tanlash
                </button>
              </div>
            </div>

          </div>

          {/* Excel Action Toolbar Footer */}
          <div className="bg-slate-50 p-3 border-t border-slate-300 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button 
                onClick={handleSave}
                disabled={saving}
                className="h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs px-5 shadow-sm flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                {saving ? (t('settings.publicPage.saving') || 'Saqlanmoqda...') : (t('settings.publicPage.save') || 'Saqlash')}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => window.open(`/p/${slug}`, '_blank')}
                className="h-9 px-3 rounded-lg font-bold text-xs border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                {t('settings.publicPage.open') || "Ochish"}
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={copyLink}
                className="h-9 px-3 rounded-lg font-bold text-xs border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? 'Nusxalandi!' : (t('settings.publicPage.copy') || "Nusxalash")}
              </Button>
            </div>
          </div>

        </div>

        {/* QR Code Box */}
        <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2.5 flex items-center justify-between">
            <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-600" />
              {t('settings.publicPage.qrCode') || "Klinika QR Kodi (Stol va bannerlar uchun)"}
            </h4>
            <Button 
              size="sm" 
              variant="outline" 
              className="h-7 text-xs font-bold text-slate-700 bg-white border-slate-300"
              onClick={() => window.open(qrImageUrl, '_blank')}
            >
              <Download className="w-3.5 h-3.5 mr-1" /> {t('settings.publicPage.download') || "Yuklab olish"}
            </Button>
          </div>

          <div className="p-4 flex items-center gap-5">
            <div className="w-24 h-24 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center p-1 shrink-0">
              {isPublished ? (
                <img src={qrImageUrl} alt="QR Code" className="w-full h-full object-contain" />
              ) : (
                <AlertCircle className="w-8 h-8 text-slate-300" />
              )}
            </div>
            <div className="space-y-1 text-xs">
              <p className="font-bold text-slate-800">{t('settings.publicPage.lobbyPlacement') || "Klinika foyesiga qo'ying"}</p>
              <p className="text-slate-500 leading-relaxed text-[11px]">
                {t('settings.publicPage.qrDesc') || "Bemorlar QR kodni skanerlash orqali klinikangiz haqida ma'lumot olishadi va online yozilishadi."}
              </p>
              <p className="font-mono text-[10px] text-indigo-600 font-bold">
                https://shifocrm.uz/p/{slug || 'klinika'}
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Right Column: Live Mobile / Desktop Preview Frame (Memoized) */}
      <LivePreviewPanel
        previewMode={previewMode}
        setPreviewMode={setPreviewMode}
        clinicName={clinicName}
        clinicLogo={clinicLogo}
        address={address}
        description={description}
        workingHours={workingHours}
        socialLinks={socialLinks}
        t={t}
      />

      {/* Interactive Map Picker Modal */}
      <LocationMapPickerModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        onSelectLocation={handleSelectMapLocation}
        initialAddress={address}
        clinicName={clinicName}
      />

    </div>
  );
}

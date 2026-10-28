import { useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, UserPlus, Loader2, 
  AlertCircle, ChevronLeft,
  Stethoscope, Settings as SettingsIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { crmAuthApi } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';
import { MyClinicLogoImage } from '@/components/ui/ShifoCrmLogo';
import { normalizeClinicBilling } from '@/utils/superAdminBilling';
import { LANDING_PLANS, TRIAL_DAYS } from '@/config/landingPricing';
import { CARD_BINDING_REQUIRED } from '@/config/cardBinding';
import { attachCard, getBindingStatus, precheckCard } from '@/api/cardBindingClient';
import CardBindingStep from '@/components/register/CardBindingStep';

const CYR = { а:'a',б:'b',в:'v',г:'g',ғ:'g',д:'d',е:'e',ё:'yo',ж:'j',з:'z',и:'i',й:'y',к:'k',қ:'q',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ў:'o',ф:'f',х:'x',ҳ:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sh',ъ:'',ы:'i',ь:'',э:'e',ю:'yu',я:'ya' };
// Klinika nomidan havola (slug): lotin, kichik harf, defis.
export const slugifyClinic = (name = '') => String(name)
  .toLowerCase()
  .split('').map((ch) => (CYR[ch] !== undefined ? CYR[ch] : ch)).join('')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[ʻʼ'`‘’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .slice(0, 40);
const cleanSlugInput = (v = '') => String(v).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-');
const formatUzPhone = (raw = '') => {
  let d = String(raw).replace(/\D/g, '');
  if (d.length <= 3 && '998'.startsWith(d)) return '+998';
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return '+998' + (parts.length ? ' ' + parts.join(' ') : '');
};
const uzPhoneDigits = (v = '') => String(v).replace(/\D/g, '').replace(/^998/, '');

export default function Register() {
  const navigate = useNavigate();
  const { setAuthData } = useAuth();
  const [searchParams] = useSearchParams();
  const fromLanding = searchParams.get('from') === 'landing';
  // Landing'dan tanlangan tarif (basic | pro | premium). Bo'lmasa — mavjud standart: basic.
  const planParam = String(searchParams.get('plan') || '').toLowerCase();
  const selectedPlan = LANDING_PLANS.find((p) => p.id === planParam) || LANDING_PLANS[0];
  const [role, setRole] = useState(fromLanding ? 'admin' : null); // 'admin' or 'doctor'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Karta biriktirish qadami (VITE_CARD_BINDING_REQUIRED yoki ?card_demo=1). Default: o'chiq.
  const cardDemo = searchParams.get('card_demo') === '1';
  const bindingWanted = CARD_BINDING_REQUIRED || cardDemo;
  const [step, setStep] = useState('form'); // 'form' | 'card'
  const [bindMode, setBindMode] = useState('live'); // live | mock | local-mock
  const [cardError, setCardError] = useState('');
  const createdClinicRef = useRef(null); // klinika yaratilgan bo'lsa (attach xatosida qayta yaratmaslik uchun)
  
  // Registration Forms
  const [adminForm, setAdminForm] = useState({
    clinicName: '',
    clinicId: '',
    phone: '+998',
    username: '',
    password: ''
  });
  const [slugEdited, setSlugEdited] = useState(false);

  const [doctorForm, setDoctorForm] = useState({
    clinicId: '',
    fullName: '',
    specialty: 'Stomatolog',
    phone: '',
    username: '',
    password: '',
    commission: 30
  });

  const buildClinicPayload = (clinicId, provider) => normalizeClinicBilling({
    id: clinicId,
    name: adminForm.clinicName,
    // clinics.password ustuni NOT NULL (super-admin formasi bilan bir xil)
    password: adminForm.password,
    plan: selectedPlan.id,
    subscription_status: 'trialing',
    signup_source: fromLanding ? 'landing' : 'manual',
    phone: formatUzPhone(adminForm.phone),
    ...(provider ? { payment_provider: provider } : {}),
  });

  // Klinika yaratilgach: auto-login va CRM (karta bilan ham, kartasiz ham bir xil).
  const finishRegistration = async (clinicId) => {
    try {
      const loginResult = await base44.auth.login(clinicId, adminForm.username, adminForm.password);
      if (loginResult?.success && loginResult.user) {
        toast.success(`Klinika ochildi! ${TRIAL_DAYS} kunlik bepul sinov boshlandi.`);
        if (setAuthData) setAuthData(loginResult.user);
        setTimeout(() => navigate('/admin/dashboard'), 100);
        return;
      }
    } catch (loginErr) {
      console.warn('Auto-login after register failed:', loginErr);
    }
    toast.success('Klinika muvaffaqiyatli ochildi! Endi tizimga kiring.');
    navigate('/login');
  };

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!adminForm.clinicId || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(adminForm.clinicId)) {
      const auto = slugifyClinic(adminForm.clinicName) || ('clinic-' + Math.random().toString(36).slice(2, 7));
      adminForm.clinicId = auto;
    }
    
    if (!adminForm.clinicName || !adminForm.username || !adminForm.password) {
      setError('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }
    if (uzPhoneDigits(adminForm.phone).length !== 9) {
      setError("Telefon raqamini to'liq kiriting: +998 XX XXX XX XX");
      return;
    }
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(adminForm.clinicId)) {
      setError("Klinika manzili faqat lotin harflari, raqam va defisdan iborat bo'lsin");
      return;
    }

    setLoading(true);
    try {
      const clinicId = adminForm.clinicId.toLowerCase();

      if (bindingWanted) {
        // 1-qadam tugadi -> karta qadami. Avval Click holatini aniqlaymiz.
        const status = await getBindingStatus();
        if (status.mode === 'unavailable') {
          setError("Karta tekshiruvi xizmati hozircha mavjud emas. Birozdan so'ng qayta urinib ko'ring.");
          return;
        }
        // ?card_demo=1 (flag o'chiq) faqat TEST REJIMda ko'rsatiladi: Click haqiqiy ulangan bo'lsa — eski oqim.
        const demoOnly = cardDemo && !CARD_BINDING_REQUIRED;
        if (!(demoOnly && status.mode === 'live')) {
          const avail = await crmAuthApi('clinic-available', { method: 'GET', query: { id: clinicId } });
          const existing = avail.status === 200 ? [] : await base44.clinic.getAll();
          if ((avail.status === 200 && avail.data?.available === false) || existing.find((c) => String(c.id).toLowerCase() === clinicId)) {
            setError('Ushbu Klinika ID band!');
            return;
          }
          setBindMode(status.mode);
          setCardError('');
          setStep('card');
          return;
        }
      }

      // 14 kunlik sinov: super-admin "Sinov (14 kun)" bilan bir xil mantiq
      // (subscription_status=trialing, trial_ends_at va expires_at = bugun + 14 kun). DB sxemasi o'zgarmaydi.
      await base44.clinic.createClinic(
        buildClinicPayload(clinicId),
        { name: 'Admin', username: adminForm.username, password: adminForm.password }
      );
      await finishRegistration(clinicId);
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  // Karta tasdiqlangan + rozilik berilgan: klinika yaratiladi, token serverda saqlanadi, CRM'ga kiramiz.
  const handleCardComplete = async ({ proof, consentVersion }) => {
    setCardError('');
    setLoading(true);
    const clinicId = adminForm.clinicId.toLowerCase();
    try {
      if (!createdClinicRef.current) {
        // Klinika faqat karta isboti server tomonda tasdiqlangandan KEYIN yaratiladi.
        await precheckCard(bindMode, { clinicId, proof });
        await base44.clinic.createClinic(
          buildClinicPayload(clinicId, bindMode === 'live' ? 'click' : 'mock'),
          { name: 'Admin', username: adminForm.username, password: adminForm.password }
        );
        createdClinicRef.current = clinicId;
      }
      await attachCard(bindMode, { clinicId, proof, consentVersion });
      await finishRegistration(clinicId);
    } catch (err) {
      setCardError(err.message || 'Xatolik yuz berdi. Qayta urinib ko\'ring');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!doctorForm.clinicId || !doctorForm.fullName || !doctorForm.username || !doctorForm.password) {
      setError('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }

    setLoading(true);
    try {
      await base44.auth.addUser({
        clinic_id: doctorForm.clinicId.toLowerCase(),
        name: doctorForm.fullName,
        username: doctorForm.username,
        password: doctorForm.password,
        phone: doctorForm.phone,
        specialty: doctorForm.specialty,
        role: 'doctor',
        commission_rate: doctorForm.commission
      });
      toast.success('Ro\'yxatdan o\'tdingiz! Endi kirishingiz mumkin.');
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-start sm:items-center justify-center p-3 sm:p-6 relative overflow-hidden font-sans">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-teal-600/5 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[480px] z-10 mt-4 sm:mt-0"
      >
        {/* Top nav */}
        <div className="mb-4 flex items-center justify-between">
          <Link to={fromLanding ? '/landing' : '/login'} className="flex items-center gap-1.5 text-slate-400 hover:text-teal-600 transition-colors font-bold text-xs group">
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Ortga qaytish
          </Link>
        </div>

        <div className="mb-5 flex flex-col items-center gap-2 text-center">
          <MyClinicLogoImage variant="light" className="h-14 w-auto" />
          {role !== 'doctor' && (
            <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold text-teal-700">
              {TRIAL_DAYS} kunlik bepul sinov · {selectedPlan.name} tarifi
            </span>
          )}
        </div>

        {!role ? (
          /* ── Role Selector ── */
          <div className="text-center">
            <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight mb-1.5 sm:mb-4">
              Ro'yxatdan o'tish
            </h1>
            <p className="text-slate-400 font-medium text-sm mb-6 sm:mb-10">
              Tizimda kim sifatida davom etasiz?
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setRole('admin')}
                className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 border-transparent hover:border-teal-500 shadow-xl shadow-slate-200/50 transition-all group text-left"
              >
                <div className="w-11 h-11 sm:w-14 sm:h-14 bg-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 shadow-lg shadow-teal-200 transition-transform group-hover:scale-110">
                  <Building2 className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-sm sm:text-xl font-black text-slate-900 mb-1">Klinika Admin</h3>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed hidden sm:block">
                  Yangi klinika ochish va shifokorlarni boshqarish uchun
                </p>
                <p className="text-[9px] text-slate-400 font-bold leading-relaxed sm:hidden">
                  Yangi klinika ochish
                </p>
              </button>

              <button 
                onClick={() => setRole('doctor')}
                className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 border-transparent hover:border-teal-500 shadow-xl shadow-slate-200/50 transition-all group text-left"
              >
                <div className="w-11 h-11 sm:w-14 sm:h-14 bg-teal-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 shadow-lg shadow-teal-200 transition-transform group-hover:scale-110">
                  <Stethoscope className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
                </div>
                <h3 className="text-sm sm:text-xl font-black text-slate-900 mb-1">Shifokor</h3>
                <p className="text-[10px] text-slate-400 font-bold leading-relaxed hidden sm:block">
                  Mavjud klinikaga qo'shilish va bemorlarni ko'rish uchun
                </p>
                <p className="text-[9px] text-slate-400 font-bold leading-relaxed sm:hidden">
                  Klinikaga qo'shilish
                </p>
              </button>
            </div>
          </div>
        ) : (
          /* ── Form Card ── */
          <div className="bg-white rounded-2xl sm:rounded-[3rem] p-5 sm:p-10 shadow-2xl shadow-slate-200/60 border border-white">
            {/* Form header */}
            <div className="flex items-center gap-3 mb-5 sm:mb-8 sm:flex-col sm:text-center">
              <div className="w-10 h-10 sm:w-16 sm:h-16 bg-teal-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 sm:mx-auto">
                {role === 'admin'
                  ? <SettingsIcon className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
                  : <UserPlus className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
                }
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight sm:mt-4">
                {role === 'admin' ? 'Klinikangizni 1 daqiqada ulang' : 'Shifokor Ro\'yxati'}
              </h2>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-2"
                >
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-xs font-bold text-rose-600">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            {role === 'admin' && step === 'card' ? (
              <CardBindingStep
                plan={selectedPlan}
                mode={bindMode}
                trialDays={TRIAL_DAYS}
                submitting={loading}
                submitError={cardError}
                onBack={() => {
                  if (createdClinicRef.current) { setCardError('Klinika allaqachon yaratilgan. Karta biriktirishni yakunlang.'); return; }
                  setStep('form'); setCardError('');
                }}
                onComplete={handleCardComplete}
              />
            ) : role === 'admin' ? (
              <form onSubmit={handleAdminRegister} className="space-y-3">
                <div className="space-y-1">
                  <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Klinika Nomi</Label>
                  <Input 
                    placeholder="Masalan: Grand Dental" 
                    value={adminForm.clinicName}
                    onChange={e => { const v = e.target.value; setAdminForm(f => ({ ...f, clinicName: v, clinicId: slugEdited ? f.clinicId : slugifyClinic(v) })); }}
                    className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Telefon raqamingiz (yordam uchun)</Label>
                  <Input 
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="+998 90 123 45 67" 
                    value={adminForm.phone}
                    data-testid="register-phone"
                    onChange={e => setAdminForm({...adminForm, phone: formatUzPhone(e.target.value)})}
                    className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Login</Label>
                    <Input 
                      placeholder="admin" 
                      value={adminForm.username}
                      onChange={e => setAdminForm({...adminForm, username: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Parol</Label>
                    <PasswordInput
                      placeholder="••••••" 
                      value={adminForm.password}
                      onChange={e => setAdminForm({...adminForm, password: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-11 sm:h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest mt-2 text-xs sm:text-sm"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : (bindingWanted ? 'Davom etish' : `${TRIAL_DAYS} kun bepul boshlash`)}
                </Button>
                {!bindingWanted && (
                  <p className="text-center text-[11.5px] font-medium text-slate-500 leading-snug" data-testid="register-no-card">
                    Karta so'ralmaydi. {TRIAL_DAYS} kundan keyin avtomatik pul yechilmaydi.
                  </p>
                )}
              </form>
            ) : (
              <form onSubmit={handleDoctorRegister} className="space-y-3">
                <div className="space-y-1">
                  <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Klinika ID</Label>
                  <Input 
                    placeholder="Klinika bergan IDni yozing" 
                    value={doctorForm.clinicId}
                    onChange={e => setDoctorForm({...doctorForm, clinicId: e.target.value})}
                    className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">To'liq ismingiz</Label>
                  <Input 
                    placeholder="Dr. Karimov" 
                    value={doctorForm.fullName}
                    onChange={e => setDoctorForm({...doctorForm, fullName: e.target.value})}
                    className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Telefon</Label>
                    <Input 
                      placeholder="+998" 
                      value={doctorForm.phone}
                      onChange={e => setDoctorForm({...doctorForm, phone: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Mutaxassislik</Label>
                    <Input 
                      placeholder="Ortodont" 
                      value={doctorForm.specialty}
                      onChange={e => setDoctorForm({...doctorForm, specialty: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Login</Label>
                    <Input 
                      placeholder="dr_karim" 
                      value={doctorForm.username}
                      onChange={e => setDoctorForm({...doctorForm, username: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Parol</Label>
                    <PasswordInput
                      placeholder="••••••" 
                      value={doctorForm.password}
                      onChange={e => setDoctorForm({...doctorForm, password: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-11 sm:h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest mt-2 text-xs sm:text-sm"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Ro\'yxatdan O\'tish'}
                </Button>
              </form>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-[13px] font-medium text-slate-500">
          Akkauntingiz bormi?{' '}
          <Link to="/login" className="font-bold text-teal-600 hover:text-teal-700" data-testid="register-login-link">Kirish</Link>
        </p>
        <p className="mt-3 text-center text-[11.5px] font-medium text-slate-400">
          Ma'lumotlaringiz himoyalangan ·{' '}
          <a href="https://t.me/dentist_shaxin" target="_blank" rel="noopener noreferrer" className="font-semibold text-teal-600 hover:text-teal-700">
            Yordam: Telegram
          </a>
        </p>
      </motion.div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
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
import { crmAuthApi, supabase } from '@/api/supabaseClient';
import { slugifyClinic } from '@/lib/clinicSlug';
import { signupFieldErrors } from '@/lib/signupRules';
import { useAuth } from '@/lib/AuthContext';
import { MyClinicLogoImage } from '@/components/ui/ShifoCrmLogo';
import { LANDING_PLANS, TRIAL_DAYS } from '@/config/landingPricing';
import { CARD_BINDING_REQUIRED } from '@/config/cardBinding';
import { attachCard, getBindingStatus, precheckCard } from '@/api/cardBindingClient';
import CardBindingStep from '@/components/register/CardBindingStep';

const SIGNUP_ERRORS = {
  username_taken: "Bu login band",
  clinic_taken: "Bu klinika nomi band",
  weak_password: "Parol kamida 8 ta belgidan iborat bo'lishi kerak",
  bad_username: "Login kamida 3 ta belgi bo'lsin: lotin harf, raqam, . _ -",
  missing_fields: "Iltimos, barcha maydonlarni to'ldiring",
  bad_clinic_name: "Klinika nomini lotin yoki kirill harflari bilan yozing",
  google_invalid: "Google sessiyasi tugagan. Qayta Google bilan kiring",
  session_unavailable: "Sessiya ochilmadi. Qayta urinib ko'ring",
  too_many_requests: "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring",
};

const formatUzPhone = (raw = '') => {
  let d = String(raw).replace(/\D/g, '');
  if (d.length <= 3 && '998'.startsWith(d)) return '+998';
  if (d.startsWith('998')) d = d.slice(3);
  d = d.slice(0, 9);
  const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return '+998' + (parts.length ? ' ' + parts.join(' ') : '');
};
const uzPhoneDigits = (v = '') => String(v).replace(/\D/g, '').replace(/^998/, '');

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.2l6.3 5.3C37.4 38.4 44 34 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}

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
  const [fieldErrors, setFieldErrors] = useState({});
  const [googleToken, setGoogleToken] = useState('');
  const [googleBusy, setGoogleBusy] = useState(false);
  const createdClinicRef = useRef(null);
  const sessionRef = useRef(null);
  
  // Registration Forms
  const [adminForm, setAdminForm] = useState({
    fullName: '',
    clinicName: '',
    clinicId: '',
    phone: '+998',
    username: '',
    password: ''
  });
  const [doctorForm, setDoctorForm] = useState({
    clinicId: '',
    fullName: '',
    specialty: 'Stomatolog',
    phone: '',
    username: '',
    password: '',
    commission: 30
  });

  const openDashboard = async (payload) => {
    const loginResult = await base44.auth.acceptSession(payload);
    if (loginResult?.success && loginResult.user) {
      toast.success(`Klinika ochildi! ${TRIAL_DAYS} kunlik bepul sinov boshlandi.`);
      if (setAuthData) setAuthData(loginResult.user);
      setTimeout(() => navigate('/admin/dashboard'), 100);
      return;
    }
    toast.success('Klinika muvaffaqiyatli ochildi! Endi tizimga kiring.');
    navigate('/login');
  };

  const applySignupError = (data) => {
    const code = data?.error;
    if (code === 'username_taken') {
      setFieldErrors((f) => ({ ...f, username: SIGNUP_ERRORS.username_taken }));
      setStep('form');
      return;
    }
    if (code === 'clinic_taken') {
      setFieldErrors((f) => ({ ...f, clinicName: SIGNUP_ERRORS.clinic_taken }));
      setStep('form');
      return;
    }
    if (code === 'weak_password') {
      setFieldErrors((f) => ({ ...f, password: SIGNUP_ERRORS.weak_password }));
      setStep('form');
      return;
    }
    setError(SIGNUP_ERRORS[code] || 'Ro\'yxatdan o\'tish serverda yakunlanmadi. Qayta urinib ko\'ring.');
  };

  const createClinicOnServer = async () => {
    if (sessionRef.current?.clinic_id) return sessionRef.current;
    const phoneDigits = uzPhoneDigits(adminForm.phone);
    const { status, data } = await crmAuthApi('signup', {
      body: {
        owner_name: adminForm.fullName,
        clinic_name: adminForm.clinicName,
        username: adminForm.username.trim().toLowerCase(),
        password: adminForm.password,
        phone: phoneDigits.length === 9 ? formatUzPhone(adminForm.phone) : '',
        plan: selectedPlan.id || 'basic',
        signup_source: googleToken ? 'google' : (fromLanding ? 'landing' : 'manual'),
        google_access_token: googleToken || undefined,
      },
    });
    if (status === 200 && data?.ok && data.session) {
      sessionRef.current = data;
      createdClinicRef.current = data.clinic_id;
      return data;
    }
    applySignupError(data);
    return null;
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = searchParams.get('code');
      try {
        if (code) {
          const exchanged = await supabase.auth.exchangeCodeForSession(code);
          if (exchanged.error) throw exchanged.error;
          const url = new URL(window.location.href);
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', `${url.pathname}${url.search}`);
        }
        const { data } = await supabase.auth.getSession();
        const user = data?.session?.user;
        if (!user || cancelled || user.app_metadata?.crm_user_id) return;
        const providers = user.app_metadata?.providers || [];
        const isGoogle = providers.includes('google') || user.app_metadata?.provider === 'google';
        if (!isGoogle) return;
        const meta = user.user_metadata || {};
        const name = String(meta.full_name || meta.name || [meta.given_name, meta.family_name].filter(Boolean).join(' ')).trim();
        setRole('admin');
        setGoogleToken(data.session.access_token || '');
        if (name) setAdminForm((f) => ({ ...f, fullName: f.fullName || name }));
      } catch {
        if (!cancelled) setError("Google orqali kirish amalga oshmadi. Qayta urinib ko'ring.");
      }
    })();
    return () => { cancelled = true; };
  }, [searchParams]);

  const startGoogle = async () => {
    setError('');
    setGoogleBusy(true);
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/register`,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (oauthError) {
      setGoogleBusy(false);
      setError("Google orqali kirish amalga oshmadi. Qayta urinib ko'ring.");
    }
  };

  const checkLoginTaken = async (username, clinicName) => {
    const login = String(username || '').trim().toLowerCase();
    if (login.length < 3) return;
    const { status, data } = await crmAuthApi('login-available', {
      method: 'GET',
      query: { username: login, clinic_name: clinicName || '' },
    });
    if (status === 200 && data?.available === false && data?.reason === 'username_taken') {
      setFieldErrors((f) => ({ ...f, username: "Bu login band" }));
    }
  };

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setError('');
    const clinicId = slugifyClinic(adminForm.clinicName);
    const next = { ...adminForm, clinicId };
    setAdminForm(next);
    const errors = signupFieldErrors({
      ownerName: next.fullName,
      clinicName: next.clinicName,
      username: next.username,
      password: next.password,
    });
    const phoneDigits = uzPhoneDigits(next.phone);
    if (phoneDigits.length > 0 && phoneDigits.length !== 9) {
      errors.phone = "Telefon raqamini to'liq kiriting: +998 XX XXX XX XX";
    }
    if (!clinicId) errors.clinicName = "Klinika nomini lotin yoki kirill harflari bilan yozing";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    setLoading(true);
    try {
      const avail = await crmAuthApi('login-available', {
        method: 'GET',
        query: { username: next.username.trim().toLowerCase(), clinic_name: next.clinicName },
      });
      if (avail.status === 200 && avail.data?.available === false) {
        setFieldErrors((f) => ({ ...f, username: "Bu login band" }));
        return;
      }
      if (avail.status === 200 && avail.data?.reason === 'clinic_taken') {
        setFieldErrors((f) => ({ ...f, clinicName: "Bu klinika nomi band" }));
        return;
      }

      if (bindingWanted) {
        const status = await getBindingStatus();
        if (status.mode === 'unavailable') {
          setError("Karta tekshiruvi xizmati hozircha mavjud emas. Birozdan so'ng qayta urinib ko'ring.");
          return;
        }
        const demoOnly = cardDemo && !CARD_BINDING_REQUIRED;
        if (!(demoOnly && status.mode === 'live')) {
          setBindMode(status.mode);
          setCardError('');
          setStep('card');
          return;
        }
      }

      const created = await createClinicOnServer();
      if (created) await openDashboard(created);
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  const handleCardComplete = async ({ proof, consentVersion }) => {
    setCardError('');
    setLoading(true);
    try {
      const clinicId = createdClinicRef.current || slugifyClinic(adminForm.clinicName);
      if (!createdClinicRef.current) {
        await precheckCard(bindMode, { clinicId, proof });
        const created = await createClinicOnServer();
        if (!created) return;
      }
      await attachCard(bindMode, { clinicId: createdClinicRef.current, proof, consentVersion });
      await openDashboard(sessionRef.current);
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
    if (String(doctorForm.password).length < 8) {
      setError("Parol kamida 8 ta belgidan iborat bo'lishi kerak");
      return;
    }

    setLoading(true);
    try {
      // Server: klinika mavjud/faol, login band emas, rol majburan 'doctor'. Server yo'q bo'lsa eski yo'l.
      const { status, data } = await crmAuthApi('doctor-register', {
        method: 'POST',
        body: {
          clinic_id: doctorForm.clinicId.toLowerCase(),
          name: doctorForm.fullName,
          username: doctorForm.username,
          password: doctorForm.password,
          phone: doctorForm.phone,
          specialty: doctorForm.specialty,
          commission_rate: doctorForm.commission,
        },
      });
      if (status === 200 && data?.ok) {
        toast.success('Ro\'yxatdan o\'tdingiz! Endi kirishingiz mumkin.');
        navigate('/login');
        return;
      }
      const known = {
        username_taken: 'Bu login ushbu klinikada band',
        clinic_not_found: 'Klinika topilmadi. Klinika ID ni tekshiring',
        clinic_inactive: 'Klinika faol emas',
        subscription_expired: 'Klinika obunasi muddati tugagan',
        read_only: "Klinika faqat o'qish rejimida. Yangi xodim qo'shib bo'lmaydi",
        bad_username: 'Login faqat lotin harflari, raqam va . _ - belgilaridan iborat bo\'lsin (kamida 3 ta)',
        weak_password: 'Parol kamida 8 ta belgidan iborat bo\'lishi kerak',
        plan_required: 'Shifokor hisobi uchun PRO tarif kerak',
        missing_fields: 'Iltimos, barcha maydonlarni to\'ldiring',
        too_many_requests: 'Juda ko\'p urinish. Birozdan keyin qayta urinib ko\'ring',
      };
      if (data?.error && known[data.error]) throw new Error(known[data.error]);
      throw new Error('Ro\'yxatdan o\'tish serverda yakunlanmadi. Qayta urinib ko\'ring.');
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

            <button
              type="button"
              onClick={startGoogle}
              disabled={googleBusy}
              data-testid="google-signup"
              className="mb-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white text-sm font-bold text-slate-800 shadow-sm"
            >
              <GoogleMark />
              Google bilan ro'yxatdan o'tish
            </button>
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

            {role === 'admin' && step === 'form' && (
              <button
                type="button"
                onClick={startGoogle}
                disabled={googleBusy || loading}
                data-testid="google-signup-form"
                className="mb-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-800"
              >
                <GoogleMark />
                Google bilan ro'yxatdan o'tish
              </button>
            )}

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
              <form onSubmit={handleAdminRegister} className="space-y-3" autoComplete="off">
                <div className="space-y-1">
                  <Label htmlFor="signup-name" className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Ism</Label>
                  <Input
                    id="signup-name"
                    name="signup-name"
                    autoComplete="name"
                    placeholder="Ismingiz"
                    value={adminForm.fullName}
                    onChange={e => { setFieldErrors((f) => ({ ...f, ownerName: '' })); setAdminForm({ ...adminForm, fullName: e.target.value }); }}
                    aria-invalid={Boolean(fieldErrors.ownerName)}
                    className="h-11 sm:h-12 w-full border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                  {fieldErrors.ownerName && <p className="px-1 text-[11px] font-bold text-rose-600" role="alert">{fieldErrors.ownerName}</p>}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="signup-clinic" className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Klinika nomi</Label>
                  <Input
                    id="signup-clinic"
                    name="signup-clinic"
                    placeholder="Masalan: Grand Dental"
                    value={adminForm.clinicName}
                    onChange={e => { const v = e.target.value; setFieldErrors((f) => ({ ...f, clinicName: '' })); setAdminForm(f => ({ ...f, clinicName: v, clinicId: slugifyClinic(v) })); }}
                    aria-invalid={Boolean(fieldErrors.clinicName)}
                    className="h-11 sm:h-12 w-full border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                  {fieldErrors.clinicName && <p className="px-1 text-[11px] font-bold text-rose-600" role="alert">{fieldErrors.clinicName}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Telefon raqamingiz (ixtiyoriy)</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="+998 90 123 45 67"
                    value={adminForm.phone}
                    data-testid="register-phone"
                    onChange={e => { setFieldErrors((f) => ({ ...f, phone: '' })); setAdminForm({...adminForm, phone: formatUzPhone(e.target.value)}); }}
                    className="h-11 sm:h-12 w-full border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                  {fieldErrors.phone && <p className="px-1 text-[11px] font-bold text-rose-600" role="alert">{fieldErrors.phone}</p>}
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="signup-login" className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Login</Label>
                    <Input
                      id="signup-login"
                      name="signup-login"
                      autoComplete="new-password"
                      placeholder="admin"
                      value={adminForm.username}
                      onChange={e => { setFieldErrors((f) => ({ ...f, username: '' })); setAdminForm({...adminForm, username: e.target.value}); }}
                      onBlur={() => checkLoginTaken(adminForm.username, adminForm.clinicName)}
                      aria-invalid={Boolean(fieldErrors.username)}
                      aria-describedby={fieldErrors.username ? 'signup-login-error' : undefined}
                      className="h-11 sm:h-12 w-full border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                    {fieldErrors.username && <p id="signup-login-error" className="px-1 text-[11px] font-bold text-rose-600" role="alert">{fieldErrors.username}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="signup-password" className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Parol</Label>
                    <PasswordInput
                      id="signup-password"
                      name="signup-password"
                      autoComplete="new-password"
                      placeholder="Kamida 8 ta belgi"
                      value={adminForm.password}
                      onChange={e => { setFieldErrors((f) => ({ ...f, password: '' })); setAdminForm({...adminForm, password: e.target.value}); }}
                      aria-invalid={Boolean(fieldErrors.password)}
                      className="h-11 sm:h-12 w-full border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                    {fieldErrors.password && <p className="px-1 text-[11px] font-bold text-rose-600" role="alert">{fieldErrors.password}</p>}
                  </div>
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-11 sm:h-14 bg-teal-600 hover:bg-teal-700 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest mt-2 text-xs sm:text-sm"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Davom etish'}
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Login</Label>
                    <Input 
                      placeholder="dr_karim"
                      autoComplete="new-password"
                      value={doctorForm.username}
                      onChange={e => setDoctorForm({...doctorForm, username: e.target.value})}
                      className="h-11 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Parol</Label>
                    <PasswordInput
                      placeholder="Kamida 8 ta belgi"
                      autoComplete="new-password"
                      value={doctorForm.password}
                      onChange={e => setDoctorForm({...doctorForm, password: e.target.value})}
                      className="h-11 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
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

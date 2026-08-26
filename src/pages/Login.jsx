import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lock, User, Building2, Eye, EyeOff, 
  ArrowRight, Loader2,
  ShieldCheck, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

/**
 * Production-ready Login Page with Clinic ID + Username
 * Modern minimalist design with Emerald Green theme
 */
export default function Login() {
  const navigate = useNavigate();
  const { t, changeLanguage } = useTranslation();
  const { setAuthData } = useAuth();
  
  const [showOnboarding, setShowOnboarding] = useState(() => {
    const completed = localStorage.getItem('has_completed_onboarding');
    const isMobileScreen = window.innerWidth < 1024;
    return isMobileScreen && !completed;
  });

  const [onboardingStep, setOnboardingStep] = useState(1); // 1: Country, 2: Language, 3: Slide 1, 4: Slide 2, 5: Slide 3
  const [selectedCountry, setSelectedCountry] = useState('uz'); // 'uz' or 'tj'
  const [selectedLang, setSelectedLang] = useState('uz-lat'); // 'uz-lat', 'uz-cyr', 'ru'
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginRole, setLoginRole] = useState('admin'); // 'admin' or 'doctor'
  const [form, setForm] = useState({
    clinicId: '',
    username: '',
    password: '',
    rememberMe: true
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!form.clinicId || !form.username || !form.password) {
      setError('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }

    setLoading(true);

    try {
      const result = await base44.auth.login(form.clinicId, form.username, form.password);

      if (result.success) {
        // Basic role validation if user wants to enforce it on UI
        if (loginRole === 'admin' && result.user.role !== 'admin') {
          setError('Sizda administrator huquqi yo\'q. Iltimos, "Shifokor" bo\'limidan kiring.');
          setLoading(false);
          return;
        }
        if (loginRole === 'doctor' && result.user.role !== 'doctor') {
          setError('Siz administrator ekansiz. Iltimos, "Admin" bo\'limidan kiring.');
          setLoading(false);
          return;
        }

        toast.success('Xush kelibsiz!');
        
        if (setAuthData) {
          setAuthData(result.user);
        }

        setTimeout(() => {
          if (result.user.role === 'admin') {
            navigate('/admin/dashboard');
          } else {
            navigate('/doctor/dashboard');
          }
        }, 100);
      } else {
        setError(result.error || 'Kirishda xatolik yuzi berdi');
        toast.error(result.error);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Server bilan aloqa uzildi');
    } finally {
      setLoading(false);
    }
  };

  const handleCountryNext = () => {
    setOnboardingStep(2);
  };

  const handleLanguageNext = () => {
    const langCode = selectedLang === 'ru' ? 'ru' : 'uz';
    changeLanguage(langCode);
    setOnboardingStep(3);
  };

  if (showOnboarding) {
    const slideIndex = onboardingStep - 2; // 1, 2, 3
    const completeOnboarding = () => {
      localStorage.setItem('has_completed_onboarding', 'true');
      setShowOnboarding(false);
    };

    if (onboardingStep === 1) {
      return (
        <div className="min-h-screen w-full bg-slate-50 flex flex-col justify-between p-6 relative overflow-hidden font-sans select-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />

          <div className="h-10 shrink-0" />

          <div className="w-full max-w-[360px] mx-auto z-10 flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center mx-auto mb-4 border border-white text-2xl flex items-center justify-center"
              >
                🌍
              </motion.div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight text-center">Добро пожаловать!</h1>
              <p className="text-slate-400 font-bold mt-1.5 text-xs text-center">Выберите вашу страну, чтобы продолжить:</p>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-2xl shadow-slate-200/60 border border-white space-y-3">
              <button 
                onClick={() => setSelectedCountry('uz')}
                className={`w-full flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border transition-all active:scale-[0.98] ${selectedCountry === 'uz' ? 'border-blue-500 bg-blue-55 shadow-sm' : 'border-slate-100'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇿</span>
                  <span className="text-sm font-black text-slate-800">Узбекистан</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedCountry === 'uz' ? 'border-blue-500 bg-blue-500 text-white shadow-sm' : 'border-slate-300'}`}>
                  {selectedCountry === 'uz' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
              
              <button 
                onClick={() => setSelectedCountry('tj')}
                className={`w-full flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border transition-all active:scale-[0.98] ${selectedCountry === 'tj' ? 'border-blue-500 bg-blue-55 shadow-sm' : 'border-slate-100'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇹🇯</span>
                  <span className="text-sm font-black text-slate-800">Таджикистан</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedCountry === 'tj' ? 'border-blue-500 bg-blue-500 text-white shadow-sm' : 'border-slate-300'}`}>
                  {selectedCountry === 'tj' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            </div>
          </div>

          <div className="p-6 shrink-0 w-full max-w-[360px] mx-auto z-10">
            <Button 
              onClick={handleCountryNext}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-200 active:scale-95 border-none"
            >
              Продолжить
            </Button>
          </div>
        </div>
      );
    }

    if (onboardingStep === 2) {
      return (
        <div className="min-h-screen w-full bg-slate-50 flex flex-col justify-between p-6 relative overflow-hidden font-sans select-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-blue-600/5 rounded-full blur-3xl" />

          <div className="h-10 shrink-0" />

          <div className="w-full max-w-[360px] mx-auto z-10 flex-1 flex flex-col justify-center">
            <div className="text-center mb-8">
              <motion.div 
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 bg-blue-600 rounded-2xl shadow-xl shadow-blue-200 flex items-center justify-center mx-auto mb-4 border border-white text-2xl flex items-center justify-center"
              >
                💬
              </motion.div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight text-center">Добро пожаловать!</h1>
              <p className="text-slate-400 font-bold mt-1.5 text-xs text-center">Для работы выберите удобный для вас язык:</p>
            </div>

            <div className="bg-white rounded-[2rem] p-6 shadow-2xl shadow-slate-200/60 border border-white space-y-3">
              <button 
                onClick={() => setSelectedLang('uz-lat')}
                className={`w-full flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border transition-all active:scale-[0.98] ${selectedLang === 'uz-lat' ? 'border-blue-500 bg-blue-55 shadow-sm' : 'border-slate-100'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇿</span>
                  <span className="text-sm font-black text-slate-800">O'zbekcha (Lotincha)</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedLang === 'uz-lat' ? 'border-blue-500 bg-blue-500 text-white shadow-sm' : 'border-slate-300'}`}>
                  {selectedLang === 'uz-lat' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>

              <button 
                onClick={() => setSelectedLang('uz-cyr')}
                className={`w-full flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border transition-all active:scale-[0.98] ${selectedLang === 'uz-cyr' ? 'border-blue-500 bg-blue-55 shadow-sm' : 'border-slate-100'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇺🇿</span>
                  <span className="text-sm font-black text-slate-800">Ўзбекча (Кирилча)</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedLang === 'uz-cyr' ? 'border-blue-500 bg-blue-500 text-white shadow-sm' : 'border-slate-300'}`}>
                  {selectedLang === 'uz-cyr' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>

              <button 
                onClick={() => setSelectedLang('ru')}
                className={`w-full flex items-center justify-between p-4 bg-slate-50/50 rounded-2xl border transition-all active:scale-[0.98] ${selectedLang === 'ru' ? 'border-blue-500 bg-blue-55 shadow-sm' : 'border-slate-100'}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🇷🇺</span>
                  <span className="text-sm font-black text-slate-800">Русский</span>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedLang === 'ru' ? 'border-blue-500 bg-blue-500 text-white shadow-sm' : 'border-slate-300'}`}>
                  {selectedLang === 'ru' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
              </button>
            </div>
          </div>

          <div className="p-6 shrink-0 w-full max-w-[360px] mx-auto z-10">
            <Button 
              onClick={handleLanguageNext}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-bold uppercase tracking-wider transition-all shadow-lg shadow-blue-200 active:scale-95 border-none"
            >
              Продолжить
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#061B30] via-[#092B4F] to-[#041221] flex flex-col justify-between p-6 relative overflow-hidden font-sans text-white select-none">
        
        {slideIndex < 3 ? (
          <button 
            onClick={completeOnboarding} 
            className="absolute top-6 right-6 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-md text-[10px] font-black uppercase text-white tracking-widest active:scale-90 transition-all z-50"
          >
            O'tkazish
          </button>
        ) : null}

        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -z-10" />

        <div className="flex-1 flex flex-col justify-center items-center gap-6 mt-6">
          <div className="relative w-72 h-80 flex items-center justify-center mt-4">
            
            {/* iPhone Mock */}
            <div className="w-48 h-72 bg-[#0E1F35] border-[3px] border-slate-700 rounded-[2rem] shadow-2xl relative overflow-hidden flex flex-col p-3 z-10">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-3 bg-slate-700 rounded-b-lg z-20" />
              
              <div className="flex justify-between items-center text-[7px] text-white/40 mb-2 px-1">
                <span>10:47</span>
                <span className="flex items-center gap-1">📶 🔋</span>
              </div>

              <div className="flex-1 rounded-[1.2rem] bg-slate-900 border border-white/5 p-2 flex flex-col justify-between overflow-hidden">
                
                {slideIndex === 1 && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="border-b border-white/5 pb-1 mb-1.5 flex justify-between items-center">
                      <span className="text-[7px] font-bold text-white/50 uppercase">Dental Patient</span>
                      <span className="text-[6px] text-emerald-400 font-bold uppercase tracking-wider">Active</span>
                    </div>
                    
                    <div className="flex-1 flex items-center justify-center relative">
                      <motion.div 
                        animate={{ rotate: 360 }} 
                        transition={{ repeat: Infinity, duration: 15, ease: 'linear' }}
                        className="w-18 h-18 rounded-full border border-dashed border-sky-500/30 flex items-center justify-center relative"
                      >
                        {[...Array(12)].map((_, i) => (
                          <div 
                            key={i} 
                            className={`absolute w-1.5 h-1.5 rounded-full ${i % 3 === 0 ? 'bg-sky-400' : 'bg-slate-700'}`}
                            style={{
                              transform: `rotate(${i * 30}deg) translateY(-32px)`
                            }}
                          />
                        ))}
                      </motion.div>
                      <span className="absolute text-[8px] font-black text-sky-400">🦷 3D</span>
                    </div>

                    <div className="space-y-1 mt-1">
                      <div className="bg-white/5 p-1 rounded-md flex justify-between items-center"><span className="text-[5px] text-white/80">L. Chen - Fillings</span><span className="text-[5px] text-emerald-400 font-bold">100%</span></div>
                      <div className="bg-white/5 p-1 rounded-md flex justify-between items-center"><span className="text-[5px] text-white/80">T. Ortho - Crown</span><span className="text-[5px] text-[#1499AD] font-bold">Planned</span></div>
                    </div>
                  </div>
                )}

                {slideIndex === 2 && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="border-b border-white/5 pb-1 mb-1 flex justify-between items-center">
                      <span className="text-[7px] font-bold text-white/50 uppercase">Appointment</span>
                      <span className="text-[6px] text-sky-400 font-bold">New</span>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 text-[5px] text-white/30 text-center font-bold">
                      {['M','T','W','T','F','S','S'].map((d,i)=> <span key={i} className="text-white/50">{d}</span>)}
                      {[...Array(21)].map((_, i) => (
                        <span key={i} className={`p-0.5 rounded-sm ${i === 11 ? 'bg-sky-500 text-white font-black' : ''}`}>{20 + i}</span>
                      ))}
                    </div>

                    <div className="space-y-1 mt-1">
                      <div className="bg-sky-500/20 border-l border-sky-400 p-1 rounded flex justify-between items-center"><span className="text-[5px] font-bold text-white/90">09:00 - Dr. Shaxin</span><span className="text-[4px] text-sky-300 font-semibold">Urgent</span></div>
                      <div className="bg-amber-500/20 border-l border-amber-400 p-1 rounded flex justify-between items-center"><span className="text-[5px] font-bold text-white/90">11:30 - Dr. Jafar</span><span className="text-[4px] text-amber-300 font-semibold">Planned</span></div>
                    </div>
                  </div>
                )}

                {slideIndex === 3 && (
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="border-b border-white/5 pb-1 mb-1 flex justify-between items-center">
                      <span className="text-[7px] font-bold text-white/50 uppercase">AI History</span>
                      <span className="text-[6px] text-rose-400 font-bold uppercase">Caries Detected</span>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center relative bg-slate-950/40 rounded-lg p-1 overflow-hidden">
                      <div className="w-12 h-14 bg-contain bg-center opacity-85 relative text-xl flex items-center justify-center">🦷</div>
                      <motion.div 
                        animate={{ top: ['0%', '100%', '0%'] }} 
                        transition={{ repeat: Infinity, duration: 2.5, ease: 'linear' }}
                        className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent" 
                      />
                    </div>

                    <div className="bg-rose-500/10 border border-rose-500/20 p-1 rounded-md text-[5px] text-rose-355 font-semibold tracking-wide uppercase text-center mt-1">
                      Deep Caries Detected on Tooth #36
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Floating Glassmorphism circles */}
            {slideIndex === 1 && (
              <>
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="absolute -top-2 left-6 w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg shadow-lg"
                >
                  🦷
                </motion.div>
                <motion.div 
                  animate={{ y: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 2.7, ease: 'easeInOut' }}
                  className="absolute top-1/2 -left-4 w-9 h-9 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-base shadow-lg"
                >
                  📄
                </motion.div>
                <motion.div 
                  animate={{ y: [0, -8, 0] }}
                  transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
                  className="absolute bottom-12 -right-2 w-11 h-11 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg shadow-lg"
                >
                  📈
                </motion.div>
              </>
            )}

            {slideIndex === 2 && (
              <>
                <motion.div 
                  animate={{ y: [0, -12, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                  className="absolute -top-1 right-6 w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg shadow-lg"
                >
                  📅
                </motion.div>
                <motion.div 
                  animate={{ y: [0, 8, 0] }}
                  transition={{ repeat: Infinity, duration: 3.1, ease: 'easeInOut' }}
                  className="absolute top-1/3 -left-4 w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg shadow-lg"
                >
                  🔔
                </motion.div>
                <motion.div 
                  animate={{ y: [0, -7, 0] }}
                  transition={{ repeat: Infinity, duration: 2.9, ease: 'easeInOut' }}
                  className="absolute bottom-10 -right-2 w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg shadow-lg"
                >
                  💬
                </motion.div>
              </>
            )}

            {slideIndex === 3 && (
              <>
                <motion.div 
                  animate={{ y: [0, -10, 0] }}
                  transition={{ repeat: Infinity, duration: 3.3, ease: 'easeInOut' }}
                  className="absolute -top-2 left-8 w-10 h-10 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg shadow-lg"
                >
                  🛡️
                </motion.div>
                <motion.div 
                  animate={{ y: [0, 9, 0] }}
                  transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
                  className="absolute top-1/3 -right-6 w-11 h-11 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-lg shadow-lg"
                >
                  🤖
                </motion.div>
                <motion.div 
                  animate={{ y: [0, -9, 0] }}
                  transition={{ repeat: Infinity, duration: 3.0, ease: 'easeInOut' }}
                  className="absolute bottom-8 -left-4 w-9 h-9 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 flex items-center justify-center text-base shadow-lg"
                >
                  🧬
                </motion.div>
              </>
            )}

          </div>

          <div className="text-center px-6 max-w-[340px] space-y-2 mt-2">
            <h2 className="text-xl font-extrabold tracking-tight leading-tight">
              {slideIndex === 1 && "Sizning sog'lig'ingiz — bizning ustuvor vazifamiz"}
              {slideIndex === 2 && "Qabulga oson yoziling"}
              {slideIndex === 3 && "Bemorlar tarixini nazorat qiling"}
            </h2>
            <p className="text-xs text-white/60 font-semibold leading-normal">
              {slideIndex === 1 && "Istalgan vaqtda va istalgan joyda malakali shifokorlar va tibbiy xizmatlardan foydalaning."}
              {slideIndex === 2 && "Mutaxassis qabuliga bir necha bosqich orqali yoziling."}
              {slideIndex === 3 && "Aqlli eslatmalar yordamida dorilarni o'z vaqtida qabul qiling."}
            </p>
          </div>

          <div className="flex gap-2.5 mt-2">
            {[1, 2, 3].map(i => (
              <div 
                key={i} 
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === slideIndex ? 'w-6 bg-blue-500' : 'w-2.5 bg-white/20'
                }`}
              />
            ))}
          </div>

        </div>

        <div className="p-6 shrink-0 w-full max-w-[360px] mx-auto z-10">
          {slideIndex < 3 ? (
            <Button 
              onClick={() => setOnboardingStep(onboardingStep + 1)}
              className="w-full h-12 bg-white/10 hover:bg-white/15 text-white border border-white/10 rounded-full font-black uppercase tracking-wider transition-all active:scale-95 shadow-lg"
            >
              Davom etish
            </Button>
          ) : (
            <Button 
              onClick={completeOnboarding}
              className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full font-black uppercase tracking-wider transition-all shadow-lg shadow-blue-500/20 active:scale-95 border-none"
            >
              Boshlash
            </Button>
          )}
        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden font-sans">
      {/* Ambient background glow effects */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] z-10"
      >
        <div className="text-center mb-6">
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className="w-16 h-16 bg-emerald-600 rounded-2xl shadow-xl shadow-emerald-200 flex items-center justify-center mx-auto mb-4 border border-white"
          >
            {loginRole === 'admin' ? <ShieldCheck className="w-8 h-8 text-white" /> : <Building2 className="w-8 h-8 text-white" />}
          </motion.div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Kirish</h1>
          <p className="text-slate-400 font-bold mt-1.5 uppercase text-[9px] tracking-[0.2em]">{loginRole === 'admin' ? 'Klinika Ma\'muri' : 'Shifokor / Xodim'}</p>
        </div>

        <div className="bg-white rounded-[2rem] p-6 sm:p-8 shadow-2xl shadow-slate-200/60 border border-white relative overflow-hidden">
          {/* Role Switcher Tabs */}
          <div className="flex bg-slate-50 p-1 rounded-xl mb-6 relative z-10">
            <button 
              onClick={() => setLoginRole('admin')}
              className={`flex-1 py-2 px-3 rounded-lg text-[10.5px] font-bold uppercase tracking-wider transition-all duration-200 ${loginRole === 'admin' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Ma'mur
            </button>
            <button 
              onClick={() => setLoginRole('doctor')}
              className={`flex-1 py-2 px-3 rounded-lg text-[10.5px] font-bold uppercase tracking-wider transition-all duration-200 ${loginRole === 'doctor' ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Shifokor
            </button>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3"
              >
                <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
                <p className="text-xs font-bold text-rose-600 tracking-tight">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Klinika ID</Label>
              <div className="relative group">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                <Input 
                  placeholder="clinic-id" 
                  value={form.clinicId}
                  onChange={e => setForm({...form, clinicId: e.target.value})}
                  className="h-11 pl-11 bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-emerald-500/20 text-slate-700 placeholder:text-slate-450 font-semibold transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Foydalanuvchi nomi</Label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                <Input 
                  placeholder="username" 
                  value={form.username}
                  onChange={e => setForm({...form, username: e.target.value})}
                  className="h-11 pl-11 bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-emerald-500/20 text-slate-700 placeholder:text-slate-450 font-semibold transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 ml-1">Parol</Label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300 group-focus-within:text-emerald-500 transition-colors" />
                <Input 
                  type={showPassword ? "text" : "password"} 
                  placeholder="••••••••" 
                  value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})}
                  className="h-11 pl-11 pr-11 bg-slate-50 border-none rounded-xl focus-visible:ring-1 focus-visible:ring-emerald-500/20 text-slate-700 placeholder:text-slate-450 font-semibold transition-all"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-emerald-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1 py-0.5">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember" 
                  checked={form.rememberMe}
                  onCheckedChange={(checked) => setForm({...form, rememberMe: checked})}
                  className="rounded-md border-slate-200 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                />
                <label htmlFor="remember" className="text-xs font-bold text-slate-500 cursor-pointer select-none">Eslab qolish</label>
              </div>
              <button type="button" className="text-xs font-bold text-emerald-600 hover:underline decoration-2 underline-offset-4 tracking-tight">
                Parolni unutdingizmi?
              </button>
            </div>

            <Button 
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase tracking-wider transition-all shadow-lg shadow-emerald-200 active:scale-[0.98] mt-2 border-none"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <span className="flex items-center gap-2">
                  Kirish <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-xs font-bold text-slate-400">
            Hisobingiz yo'qmi?{' '}
            <a 
              href="https://t.me/dentist_shaxin" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-emerald-600 hover:underline decoration-2 underline-offset-4"
            >
              Ro'yxatdan o'tish
            </a>
          </p>
          <div className="flex items-center justify-center gap-6 pt-6 mt-6 border-t border-slate-200/50">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Medical Cloud</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

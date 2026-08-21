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
  const { t } = useTranslation();
  const { setAuthData } = useAuth();
  
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

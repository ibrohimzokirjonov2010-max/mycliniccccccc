import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, UserPlus, Loader2, 
  AlertCircle, ChevronLeft,
  Stethoscope, Settings as SettingsIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function Register() {
  const navigate = useNavigate();
  const [role, setRole] = useState(null); // 'admin' or 'doctor'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Registration Forms
  const [adminForm, setAdminForm] = useState({
    clinicName: '',
    clinicId: '',
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

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!adminForm.clinicName || !adminForm.clinicId || !adminForm.username || !adminForm.password) {
      setError('Iltimos, barcha maydonlarni to\'ldiring');
      return;
    }

    setLoading(true);
    try {
      await base44.clinic.createClinic(
        { id: adminForm.clinicId.toLowerCase(), name: adminForm.clinicName },
        { name: 'Admin', username: adminForm.username, password: adminForm.password }
      );
      toast.success('Klinika muvaffaqiyatli ochildi! Endi tizimga kiring.');
      navigate('/login');
    } catch (err) {
      setError(err.message || 'Xatolik yuz berdi');
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
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-600/5 rounded-full blur-3xl" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[480px] z-10 mt-4 sm:mt-0"
      >
        {/* Top nav */}
        <div className="mb-4 flex items-center justify-between">
          <Link to="/login" className="flex items-center gap-1.5 text-slate-400 hover:text-emerald-600 transition-colors font-bold text-xs group">
            <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Ortga qaytish
          </Link>
          {role && (
            <button 
              onClick={() => {setRole(null); setError('');}}
              className="text-emerald-600 font-black text-[9px] uppercase tracking-widest hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors"
            >
              Rolni o'zgartirish
            </button>
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
                className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 border-transparent hover:border-emerald-500 shadow-xl shadow-slate-200/50 transition-all group text-left"
              >
                <div className="w-11 h-11 sm:w-14 sm:h-14 bg-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 shadow-lg shadow-emerald-200 transition-transform group-hover:scale-110">
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
                className="bg-white p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] border-2 border-transparent hover:border-emerald-500 shadow-xl shadow-slate-200/50 transition-all group text-left"
              >
                <div className="w-11 h-11 sm:w-14 sm:h-14 bg-emerald-500 rounded-xl sm:rounded-2xl flex items-center justify-center mb-3 sm:mb-6 shadow-lg shadow-emerald-200 transition-transform group-hover:scale-110">
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
              <div className="w-10 h-10 sm:w-16 sm:h-16 bg-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0 sm:mx-auto">
                {role === 'admin'
                  ? <SettingsIcon className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
                  : <UserPlus className="w-5 h-5 sm:w-8 sm:h-8 text-white" />
                }
              </div>
              <h2 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight sm:mt-4">
                {role === 'admin' ? 'Yangi Klinika Ochish' : 'Shifokor Ro\'yxati'}
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

            {role === 'admin' ? (
              <form onSubmit={handleAdminRegister} className="space-y-3">
                <div className="space-y-1">
                  <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Klinika Nomi</Label>
                  <Input 
                    placeholder="Masalan: Grand Dental" 
                    value={adminForm.clinicName}
                    onChange={e => setAdminForm({...adminForm, clinicName: e.target.value})}
                    className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="uppercase text-[9px] font-black tracking-widest text-slate-400 ml-1">Unikal Klinika ID</Label>
                  <Input 
                    placeholder="grand-dental" 
                    value={adminForm.clinicId}
                    onChange={e => setAdminForm({...adminForm, clinicId: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
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
                    <Input 
                      type="password"
                      placeholder="••••••" 
                      value={adminForm.password}
                      onChange={e => setAdminForm({...adminForm, password: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-11 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest mt-2 text-xs sm:text-sm"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Klinikani Yaratish'}
                </Button>
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
                    <Input 
                      type="password"
                      placeholder="••••••" 
                      value={doctorForm.password}
                      onChange={e => setDoctorForm({...doctorForm, password: e.target.value})}
                      className="h-10 sm:h-12 border-none bg-slate-50 rounded-xl font-semibold text-sm"
                    />
                  </div>
                </div>
                <Button
                  disabled={loading}
                  className="w-full h-11 sm:h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl sm:rounded-2xl font-black uppercase tracking-widest mt-2 text-xs sm:text-sm"
                >
                  {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Ro\'yxatdan O\'tish'}
                </Button>
              </form>
            )}
          </div>
        )}

        <p className="mt-5 text-center text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
          Powered by Dental SaaS Medical Cloud
        </p>
      </motion.div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, Globe, LogOut, 
  Building2, Users, Bell,
  Clock, CheckCircle2, ChevronDown, ChevronUp, Layout as LayoutIcon,
  Trash2, KeyRound, Phone, X, ShieldCheck, Camera, ImagePlus
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { notificationStore } from '@/lib/notificationStore';
import { useAuth } from '@/lib/AuthContext';
import { compressImage, validateImage } from '@/utils/imageUpload';

const defaultSchedule = {
  monday: { active: true, start: '09:00', end: '18:00' },
  tuesday: { active: true, start: '09:00', end: '18:00' },
  wednesday: { active: true, start: '09:00', end: '18:00' },
  thursday: { active: true, start: '09:00', end: '18:00' },
  friday: { active: true, start: '09:00', end: '18:00' },
  saturday: { active: true, start: '09:00', end: '15:00' },
  sunday: { active: false, start: '09:00', end: '15:00' }
};

export default function MobileSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user: authUser, isDoctor, isAdmin, setAuthData, logout } = useAuth();
  
  const [currentUser, setCurrentUser] = useState(authUser || null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Doctor profile & password states
  const [myProfileForm, setMyProfileForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [savingMyProfile, setSavingMyProfile] = useState(false);
  const [mySchedule, setMySchedule] = useState({
    1: { active: true, start: '09:00', end: '18:00' },
    2: { active: true, start: '09:00', end: '18:00' },
    3: { active: true, start: '09:00', end: '18:00' },
    4: { active: true, start: '09:00', end: '18:00' },
    5: { active: true, start: '09:00', end: '18:00' },
    6: { active: false, start: '09:00', end: '15:00' },
    0: { active: false, start: '09:00', end: '15:00' }
  });
  const [savingMySchedule, setSavingMySchedule] = useState(false);
  const [showMySchedule, setShowMySchedule] = useState(false);

  // Admin states
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ full_name: '', role: 'Stomatolog', commission: 40, password: '', phone: '' });
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [clinicData, setClinicData] = useState({
    name: 'My Clinic',
    phone: '',
    working_hours: defaultSchedule
  });

  const hourOptions = [
    '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
    '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', 
    '20:00', '21:00'
  ];

  const load = async () => {
    try {
      const userId = authUser?.id || localStorage.getItem('user_id');
      const clinicId = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic';
      
      if (userId) {
        const foundUser = await base44.auth.getUserById(userId);
        if (foundUser) {
          setCurrentUser(foundUser);
          setMyProfileForm({
            name: foundUser.name || foundUser.full_name || '',
            phone: foundUser.phone || '',
            password: '',
            confirmPassword: ''
          });
          if (foundUser.workingHours) {
            setMySchedule(foundUser.workingHours);
          }
        }
      }

      if (isAdmin) {
        const currentClinic = await base44.clinic.getCurrentClinic();
        if (currentClinic) {
          setClinicData({
            name: currentClinic.name || 'My Clinic',
            phone: currentClinic.phone || '',
            working_hours: currentClinic.working_hours || defaultSchedule
          });
        }
        const allUsers = await base44.auth.getUsers(clinicId);
        setUsers(allUsers || []);
      }
    } catch (error) {
      console.error('Settings load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [authUser?.id, isAdmin]);

  // Profil rasmini yuklash (Mobile)
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;

    const validation = validateImage(file, { maxSizeMB: 10 });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    try {
      toast.loading("Rasm yuklanmoqda...", { id: "mob-avatar" });
      const compressed = await compressImage(file, { maxWidth: 500, maxHeight: 500, quality: 0.8 });
      
      const updateData = {
        avatar_url: compressed,
        avatar: compressed,
        photo: compressed,
        image: compressed
      };

      await base44.auth.updateUser(currentUser.id, updateData);
      
      const updatedUser = { ...currentUser, ...updateData };
      setCurrentUser(updatedUser);
      if (setAuthData) {
        setAuthData(updatedUser);
      }
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      
      toast.success("✅ Profil rasmi saqlandi!", { id: "mob-avatar" });
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error("Rasm yuklashda xatolik yuz berdi", { id: "mob-avatar" });
    }
  };

  // Profil rasmini o'chirish (Mobile)
  const handleRemoveAvatar = async () => {
    if (!currentUser?.id) return;
    if (!window.confirm("Profil rasmini o'chirmoqchimisiz?")) return;

    try {
      toast.loading("Rasm o'chirilmoqda...", { id: "mob-avatar" });
      const updateData = {
        avatar_url: '',
        avatar: '',
        photo: '',
        image: ''
      };

      await base44.auth.updateUser(currentUser.id, updateData);
      
      const updatedUser = { ...currentUser, ...updateData };
      setCurrentUser(updatedUser);
      if (setAuthData) {
        setAuthData(updatedUser);
      }
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      
      toast.success("Profil rasmi o'chirildi", { id: "mob-avatar" });
    } catch (err) {
      console.error("Avatar remove error:", err);
      toast.error("Rasmni o'chirishda xatolik yuz berdi", { id: "mob-avatar" });
    }
  };

  const saveClinicSettings = async () => {
    try {
      const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
      await base44.clinic.updateClinic(clinicId, clinicData);
      toast.success('Klinika sozlamalari saqlandi');
    } catch (error) {
      toast.error('Saqlashda xato yuz berdi');
    }
  };

  const addStaff = async () => {
    if (!newStaff.full_name.trim()) {
      toast.error('Ism kiriting!');
      return;
    }
    try {
      const cleanUsername = newStaff.full_name.toLowerCase().replace(/\s+/g, '.');
      await base44.auth.addUser({
        name: newStaff.full_name.trim(),
        username: cleanUsername,
        password: newStaff.password || 'doctor123',
        phone: newStaff.phone?.trim() || '',
        role: 'doctor',
        specialty: newStaff.role || 'Stomatolog',
        commission_rate: Number(newStaff.commission || 0),
        clinic_id: localStorage.getItem('current_clinic_id') || 'default_clinic'
      });
      setNewStaff({ full_name: '', role: 'Stomatolog', commission: 40, password: '', phone: '' });
      setShowStaffForm(false);
      toast.success("Xodim muvaffaqiyatli qo'shildi!");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Xodim qo'shishda xatolik yuz berdi");
    }
  };



  const deleteStaff = async (id) => {
    if (window.confirm("Haqiqatdan ham ushbu xodimni o'chirmoqchimisiz?")) {
      try {
        await base44.auth.deleteUser(id);
        toast.success("Xodim o'chirildi");
        await load();
      } catch (e) {
        toast.error("O'chirishda xatolik yuz berdi");
      }
    }
  };

  // Shifokor o'z profilini saqlashi (Ism, Telefon, Yangi parol)
  const handleSaveMyProfile = async (e) => {
    if (e) e.preventDefault();
    if (!currentUser?.id) return;
    if (!myProfileForm.name.trim()) {
      toast.error('Ism kiriting!');
      return;
    }
    if (myProfileForm.password && myProfileForm.password.length < 4) {
      toast.error('Parol kamida 4 ta belgidan iborat bo\'lishi kerak!');
      return;
    }
    if (myProfileForm.password && myProfileForm.password !== myProfileForm.confirmPassword) {
      toast.error('Yangi parol va tasdiqlash paroli mos kelmadi!');
      return;
    }

    setSavingMyProfile(true);
    try {
      const updatedFields = {
        name: myProfileForm.name.trim(),
        full_name: myProfileForm.name.trim(),
        phone: myProfileForm.phone?.trim() || ''
      };
      if (myProfileForm.password) {
        updatedFields.password = myProfileForm.password;
      }

      await base44.auth.updateUser(currentUser.id, updatedFields);
      
      const updatedUser = { ...currentUser, ...updatedFields };
      setCurrentUser(updatedUser);
      if (setAuthData) {
        setAuthData(updatedUser);
      }
      localStorage.setItem('user_name', updatedFields.name);
      localStorage.setItem('user_data', JSON.stringify(updatedUser));
      
      if (myProfileForm.password) {
        toast.success("✅ Profil va parolingiz muvaffaqiyatli saqlandi!");
      } else {
        toast.success("✅ Profil ma'lumotlaringiz saqlandi!");
      }
      setMyProfileForm(prev => ({ ...prev, password: '', confirmPassword: '' }));
      await load();
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error("Xatolik yuz berdi: " + (err.message || ''));
    } finally {
      setSavingMyProfile(false);
    }
  };

  // Shifokor o'z ish vaqtlarini saqlashi
  const handleSaveMySchedule = async () => {
    if (!currentUser?.id) return;
    setSavingMySchedule(true);
    try {
      await base44.entities.User.update(currentUser.id, {
        ...currentUser,
        workingHours: mySchedule
      });
      toast.success("✅ Ish vaqtlaringiz muvaffaqiyatli saqlandi!");
      await load();
    } catch (err) {
      console.error('Error saving schedule:', err);
      toast.error("Ish vaqtlarini saqlashda xatolik yuz berdi");
    } finally {
      setSavingMySchedule(false);
    }
  };

  const testNotification = () => {
    if (Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') triggerTest();
      });
    } else if (Notification.permission === 'granted') {
      triggerTest();
    } else {
      toast.error("Bildirishnomalar bloklangan. Sozlamalardan yoqing.");
    }
  };

  const triggerTest = () => {
    const title = 'Test Bildirishnoma 🦷';
    const body = 'Bu namunaviy eslatma. Qabulga 20 daqiqa qolganida dokinga eslatma keladi.';
    
    new Notification(title, { body });
    notificationStore.add({ type: 'system', title, message: body });
    
    toast(body, {
      icon: '⏰',
      duration: 6000,
      position: 'top-center',
      style: { background: '#0f172a', color: '#fff', borderRadius: '1rem', padding: '1rem', fontWeight: 'bold' }
    });
  };

  const handleLogout = () => {
    if (logout) {
      logout();
    } else {
      localStorage.removeItem('is_authenticated');
      localStorage.removeItem('user_name');
      localStorage.removeItem('clinic_id');
      window.location.href = '/login';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const avatarSource = currentUser?.avatar_url || currentUser?.photo || currentUser?.avatar || currentUser?.image;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t('settings.title') || "Sozlamalar"}</h1>
          <p className="text-xs text-slate-500 font-medium">
            {isDoctor ? "Shaxsiy kabinet va ish jadvali" : "Tizim sozlamalari va boshqaruv"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-600 font-bold hover:bg-rose-50 rounded-xl">
          <LogOut className="w-4 h-4 mr-1" /> Chiqish
        </Button>
      </div>

      <div className="p-4 space-y-4">
        {/* User Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
        >
          <div className="flex items-center gap-4">
            
            {/* 📸 Mobile Avatar Container */}
            <div className="relative group/avatar shrink-0">
              <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center text-white text-xl font-black shadow-md shadow-emerald-200 overflow-hidden border border-white">
                {avatarSource ? (
                  <img src={avatarSource} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  currentUser?.name?.[0]?.toUpperCase() || currentUser?.full_name?.[0]?.toUpperCase() || 'U'
                )}
              </div>

              {/* Camera icon label */}
              <label 
                htmlFor="mobile-avatar-upload"
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center shadow-md active:scale-95 transition-transform cursor-pointer"
                title="Rasm yuklash"
              >
                <Camera className="w-3.5 h-3.5" />
              </label>
              <input 
                id="mobile-avatar-upload" 
                type="file" 
                accept="image/jpeg,image/png,image/webp" 
                className="hidden" 
                onChange={handleAvatarUpload} 
              />

              {/* Trash delete avatar */}
              {avatarSource && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-md bg-rose-500 text-white flex items-center justify-center shadow-md"
                  title="Rasmni o'chirish"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h3 className="font-black text-lg text-slate-900 truncate">{currentUser?.name || currentUser?.full_name}</h3>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="inline-block px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full">
                  {isDoctor ? "Shifokor" : "Administrator"}
                </span>
                {currentUser?.specialty && (
                  <span className="text-[10px] font-bold text-slate-500 px-2 py-0.5 bg-slate-100 rounded-full">
                    {currentUser.specialty}
                  </span>
                )}
                {isDoctor && (
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    {currentUser.commission_rate ?? currentUser.commission ?? 40}% ulush
                  </span>
                )}
              </div>
              <label 
                htmlFor="mobile-avatar-upload"
                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 active:underline mt-1 cursor-pointer"
              >
                <ImagePlus className="w-3 h-3" />
                {avatarSource ? "Rasmni almashtirish" : "Rasm yuklash"}
              </label>
            </div>
          </div>
        </motion.div>

        {/* Shaxsiy ma'lumotlar va parolni yangilash */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4"
        >
          <div className="flex items-center gap-2 pb-2 border-b border-slate-50">
            <KeyRound className="w-4 h-4 text-indigo-600" />
            <h3 className="font-bold text-sm text-slate-900">Profil & Xavfsizlik</h3>
          </div>

          <form onSubmit={handleSaveMyProfile} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">To'liq ism *</Label>
              <Input 
                value={myProfileForm.name} 
                onChange={e => setMyProfileForm({ ...myProfileForm, name: e.target.value })}
                className="h-11 rounded-xl font-bold bg-slate-50 border-slate-100" 
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">Telefon raqam</Label>
              <Input 
                value={myProfileForm.phone} 
                onChange={e => setMyProfileForm({ ...myProfileForm, phone: e.target.value })}
                placeholder="+998..."
                className="h-11 rounded-xl font-bold bg-slate-50 border-slate-100" 
              />
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">Yangi parol</Label>
                <Input 
                  type="password"
                  placeholder="Yangi parol"
                  value={myProfileForm.password}
                  onChange={e => setMyProfileForm({ ...myProfileForm, password: e.target.value })}
                  className="h-11 rounded-xl font-mono text-xs bg-slate-50 border-slate-100" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">Tasdiqlash</Label>
                <Input 
                  type="password"
                  placeholder="Qayta kiriting"
                  value={myProfileForm.confirmPassword}
                  onChange={e => setMyProfileForm({ ...myProfileForm, confirmPassword: e.target.value })}
                  className="h-11 rounded-xl font-mono text-xs bg-slate-50 border-slate-100" 
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={savingMyProfile}
              className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs uppercase tracking-wider mt-2"
            >
              {savingMyProfile ? 'Saqlanmoqda...' : 'Profil va parolni saqlash'}
            </Button>
          </form>
        </motion.div>

        {/* Shifokor uchun: Ish jadvali (Schedule) */}
        {isDoctor && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Mening ish vaqtlarim</h3>
                  <p className="text-[11px] text-slate-400">Qabul soatlarini boshqarish</p>
                </div>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowMySchedule(!showMySchedule)}
                className="rounded-xl font-bold text-xs"
              >
                {showMySchedule ? 'Yopish' : 'Sozlash'}
              </Button>
            </div>

            {showMySchedule && (
              <div className="mt-4 pt-4 border-t border-slate-50 space-y-3">
                {[
                  { label: 'Dushanba', dayId: '1' },
                  { label: 'Seshanba', dayId: '2' },
                  { label: 'Chorshanba', dayId: '3' },
                  { label: 'Payshanba', dayId: '4' },
                  { label: 'Juma', dayId: '5' },
                  { label: 'Shanba', dayId: '6' },
                  { label: 'Yakshanba', dayId: '0' },
                ].map(({ label, dayId }) => {
                  const daySettings = mySchedule[dayId] || { active: false, start: '09:00', end: '18:00' };
                  return (
                    <div key={dayId} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id={`mob-day-${dayId}`}
                          checked={daySettings.active}
                          className="rounded border-slate-300 text-indigo-600 w-4 h-4"
                          onChange={(e) => {
                            setMySchedule({
                              ...mySchedule,
                              [dayId]: { ...daySettings, active: e.target.checked }
                            });
                          }}
                        />
                        <label htmlFor={`mob-day-${dayId}`} className="text-xs font-bold text-slate-700 w-20">
                          {label}
                        </label>
                      </div>

                      {daySettings.active ? (
                        <div className="flex items-center gap-1">
                          <select 
                            value={daySettings.start}
                            className="h-7 rounded-lg border-slate-200 bg-white text-[11px] font-bold px-1"
                            onChange={(e) => {
                              setMySchedule({
                                ...mySchedule,
                                [dayId]: { ...daySettings, start: e.target.value }
                              });
                            }}
                          >
                            {hourOptions.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                          <span className="text-[9px] text-slate-400">-</span>
                          <select 
                            value={daySettings.end}
                            className="h-7 rounded-lg border-slate-200 bg-white text-[11px] font-bold px-1"
                            onChange={(e) => {
                              setMySchedule({
                                ...mySchedule,
                                [dayId]: { ...daySettings, end: e.target.value }
                              });
                            }}
                          >
                            {hourOptions.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Dam olish</span>
                      )}
                    </div>
                  );
                })}
                <Button 
                  onClick={handleSaveMySchedule}
                  disabled={savingMySchedule}
                  className="w-full h-10 bg-indigo-600 text-white rounded-xl font-bold text-xs mt-2"
                >
                  {savingMySchedule ? 'Saqlanmoqda...' : 'Jadvalni saqlash'}
                </Button>
              </div>
            )}
          </motion.div>
        )}

        {/* Language Settings */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Til / Язык / Language</h3>
                <p className="text-[11px] text-slate-400">Interfeys tilini tanlang</p>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </motion.div>

        {/* Notifications */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Bildirishnomalar</h3>
                <p className="text-[11px] text-slate-400">Eslatmalarni tekshirish</p>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full h-11 rounded-xl border-slate-200 font-bold text-xs mt-2"
            onClick={testNotification}
          >
            Test bildirishnomasini yuborish
          </Button>
        </motion.div>

        {/* ADMIN EXCLUSIVE SECTIONS */}
        {isAdmin && (
          <>
            {/* SMS Sozlamalari */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16 }}
              className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden"
            >
              <button
                onClick={() => navigate('/sms-settings')}
                className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                    <Bell className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-800 text-sm">SMS Sozlamalari</h3>
                    <p className="text-xs text-slate-400">Avtomatik xabar yuborish sozlamalari</p>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </button>
            </motion.div>

            {/* Professional Public Page Link */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.18 }}
              className="bg-white rounded-3xl p-5 shadow-sm border border-indigo-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                    <LayoutIcon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Professional sahifa</h3>
                    <p className="text-xs text-slate-400">Online tashrif qog'ozi</p>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold"
                  onClick={() => navigate('/public-page')}
                >
                  Sozlash
                </Button>
              </div>
            </motion.div>

            {/* Clinic Settings */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Klinika sozlamalari</h3>
                </div>
                <Button size="sm" onClick={saveClinicSettings} className="rounded-xl h-9 bg-emerald-600 hover:bg-emerald-700 font-bold text-xs">
                  Saqlash
                </Button>
              </div>
              
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Klinika nomi</Label>
                  <Input 
                    value={clinicData.name} 
                    onChange={e => setClinicData({...clinicData, name: e.target.value})}
                    className="h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Telefon</Label>
                  <Input 
                    value={clinicData.phone} 
                    onChange={e => setClinicData({...clinicData, phone: e.target.value})}
                    placeholder="+998..." 
                    className="h-11 rounded-xl bg-slate-50 border-none font-bold text-slate-900" 
                  />
                </div>
              </div>
            </motion.div>

            {/* Staff Management (Admin Only) */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm">Xodimlar boshqaruvi</h3>
                </div>
                <Button size="sm" onClick={() => setShowStaffForm(!showStaffForm)} className="rounded-xl font-bold text-xs">
                  + Yangi
                </Button>
              </div>

              {showStaffForm && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-slate-50 rounded-2xl p-4 mb-4 space-y-3 border border-slate-100"
                >
                  <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">FIO *</Label>
                    <Input 
                      placeholder="Dr. Alisher" 
                      value={newStaff.full_name}
                      onChange={e => setNewStaff({...newStaff, full_name: e.target.value})}
                      className="h-11 rounded-xl bg-white border-slate-200 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Lavozim</Label>
                      <Input 
                        placeholder="Stomatolog" 
                        value={newStaff.role}
                        onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                        className="h-11 rounded-xl bg-white border-slate-200 font-medium"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Komissiya %</Label>
                      <Input 
                        type="number"
                        placeholder="40" 
                        value={newStaff.commission === 0 || newStaff.commission === '' ? '' : newStaff.commission}
                        onChange={e => {
                          const val = e.target.value;
                          setNewStaff({...newStaff, commission: val === '' ? '' : Number(val)});
                        }}
                        className="h-11 rounded-xl bg-white border-slate-200 font-medium"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Parol</Label>
                      <Input 
                        type="text"
                        placeholder="doctor123" 
                        value={newStaff.password}
                        onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                        className="h-11 rounded-xl bg-white border-slate-200 font-mono text-xs"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Telefon</Label>
                      <Input 
                        type="tel"
                        placeholder="+998..." 
                        value={newStaff.phone}
                        onChange={e => setNewStaff({...newStaff, phone: e.target.value})}
                        className="h-11 rounded-xl bg-white border-slate-200 font-medium text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setShowStaffForm(false)} 
                      className="flex-1 h-11 rounded-xl font-bold text-xs"
                    >
                      Bekor qilish
                    </Button>
                    <Button 
                      onClick={addStaff} 
                      className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-bold text-xs"
                    >
                      Saqlash
                    </Button>
                  </div>
                </motion.div>
              )}

              <div className="space-y-2">
                {users.map(u => (
                  <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl">
                    <div className="flex-1 min-w-0 pr-2">
                      <p className="font-bold text-sm text-slate-900 truncate">{u.name || u.full_name}</p>
                      <p className="text-xs text-slate-500 truncate">{u.specialty || u.role || 'Shifokor'}</p>
                      <span className="text-[10px] font-mono text-slate-400">Login: {u.username || '—'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-xs font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                        {u.commission_rate ?? u.commission ?? 0}%
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl"
                        onClick={() => deleteStaff(u.id)}
                        title="O'chirish"
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </Button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <p className="text-sm text-slate-400 text-center py-4">Xodimlar yo'q</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </div>


    </div>
  );
}

import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings as SettingsIcon, User, Plus, Trash2, 
  Globe, ImagePlus, Layout as LayoutIcon, ShieldCheck,
  Users, Languages, Clock, KeyRound, Phone, CheckCircle2,
  Camera, Table, Lock, Check, Sparkles, LogOut
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicPageSettings from '@/components/settings/PublicPageSettings';
import WebsiteIntegrationSettings from '@/components/settings/WebsiteIntegrationSettings';
import { useAuth } from '@/lib/AuthContext';
import { useClinic } from '@/lib/ClinicContext';
import { compressImage, validateImage } from '@/utils/imageUpload';

const defaultSchedule = {
  1: { active: true, start: '09:00', end: '18:00' }, // Dushanba
  2: { active: true, start: '09:00', end: '18:00' }, // Seshanba
  3: { active: true, start: '09:00', end: '18:00' }, // Chorshanba
  4: { active: true, start: '09:00', end: '18:00' }, // Payshanba
  5: { active: true, start: '09:00', end: '18:00' }, // Juma
  6: { active: false, start: '09:00', end: '15:00' }, // Shanba
  0: { active: false, start: '09:00', end: '15:00' }, // Yakshanba
};

const hourOptions = [
  '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', 
  '20:00', '21:00'
];

export default function Settings() {
  const { t } = useTranslation();
  const { user: authUser, isDoctor, isAdmin, setAuthData, logout } = useAuth();
  const { refresh: refreshClinic } = useClinic();
  
  const [currentUser, setCurrentUser] = useState(authUser || null);
  const [users, setUsers] = useState([]);
  const [newStaff, setNewStaff] = useState({ full_name: '', specialty: 'Stomatolog', commission: 40, password: '' });
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Shaxsiy profilni tahrirlash state'lari (barcha foydalanuvchilar va shifokorlar uchun)
  const [myProfileForm, setMyProfileForm] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [savingMyProfile, setSavingMyProfile] = useState(false);
  const [mySchedule, setMySchedule] = useState(defaultSchedule);
  const [savingMySchedule, setSavingMySchedule] = useState(false);

  // Admin uchun: boshqa shifokorlar ish vaqtlarini sozlash state'lari
  const [editingScheduleDoctorId, setEditingScheduleDoctorId] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState({});

  const load = async () => {
    try {
      const clinicId = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic';
      
      const currentClinic = await base44.clinic.getCurrentClinic();
      setClinic(currentClinic);
      
      const userId = authUser?.id || localStorage.getItem('user_id');
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
          setMySchedule(foundUser.workingHours || defaultSchedule);
        }
      } else {
        const userName = localStorage.getItem('user_name') || 'Admin';
        setCurrentUser({ 
          full_name: userName, 
          name: userName,
          role: isAdmin ? 'admin' : 'doctor'
        });
      }
      
      // Faqat admin barcha boshqa shifokorlar va xodimlarni yuklay oladi
      if (isAdmin) {
        const allUsers = await base44.auth.getUsers(clinicId);
        setUsers(allUsers || []);
      }
    } catch (error) {
      console.error('Settings load error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClinic = async () => {
    setSaving(true);
    try {
      await base44.clinic.updateClinic(clinic.id, clinic);
      if (refreshClinic) await refreshClinic();
      toast.success("Klinika ma'lumotlari saqlandi!");
    } catch (err) {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); }, [authUser?.id, isAdmin]);

  // Profil rasmini yuklash / o'zgartirish
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;

    const validation = validateImage(file, { maxSizeMB: 10 });
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    try {
      toast.loading("Rasm yuklanmoqda...", { id: "profile-avatar" });
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
      
      toast.success("✅ Profil rasmi muvaffaqiyatli saqlandi!", { id: "profile-avatar" });
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error("Rasm yuklashda xatolik yuz berdi", { id: "profile-avatar" });
    }
  };

  // Profil rasmini o'chirish
  const handleRemoveAvatar = async () => {
    if (!currentUser?.id) return;
    if (!window.confirm("Profil rasmini o'chirmoqchimisiz?")) return;

    try {
      toast.loading("Rasm o'chirilmoqda...", { id: "profile-avatar" });
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
      
      toast.success("Profil rasmi o'chirildi", { id: "profile-avatar" });
    } catch (err) {
      console.error("Avatar remove error:", err);
      toast.error("Rasmni o'chirishda xatolik yuz berdi", { id: "profile-avatar" });
    }
  };

  // Admin uchun: Yangi shifokor qo'shish
  const addStaff = async () => {
    if (!newStaff.full_name) {
      toast.error(t('settings.staff.errorEnterName') || 'Ism kiriting!');
      return;
    }
    if (!newStaff.password || newStaff.password.length < 4) {
      toast.error(t('settings.staff.errorMinPassword') || 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak!');
      return;
    }

    try {
      const clinicId = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic';
      
      await base44.auth.addUser({
        name: newStaff.full_name,
        username: newStaff.full_name.toLowerCase().replace(/\s+/g, '.'),
        password: newStaff.password,
        role: 'doctor',
        specialty: newStaff.specialty || 'Stomatolog',
        commission_rate: Number(newStaff.commission || 0),
        clinic_id: clinicId
      });

      setNewStaff({ full_name: '', specialty: 'Stomatolog', commission: 40, password: '' });
      await load(); 
      toast.success(t('settings.staff.successAddDoctor') || 'Shifokor muvaffaqiyatli qo\'shildi!');
    } catch (error) {
      console.error('Add doctor error:', error);
      toast.error('Xatolik yuz berdi: ' + (error.message || ''));
    }
  };

  // Admin uchun: Shifokorni o'chirish
  const deleteStaff = async (id) => {
    if (window.confirm(t('settings.staff.confirmDeleteDoctor') || "Haqiqatdan ham ushbu xodimni o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.")) {
      try {
        await base44.auth.deleteUser(id);
        toast.success("Xodim o'chirildi");
        await load();
      } catch (e) {
        toast.error("O'chirishda xatolik yuz berdi");
      }
    }
  };

  // Admin uchun: Boshqa shifokor ish vaqtini saqlash
  const saveWorkingHours = async (doctor, schedule) => {
    try {
      setSaving(true);
      await base44.entities.User.update(doctor.id, {
        ...doctor,
        workingHours: schedule
      });
      toast.success(`${doctor.name} ish vaqtlari muvaffaqiyatli saqlandi!`);
      setEditingScheduleDoctorId(null);
      await load();
    } catch (e) {
      console.error('Save schedule error:', e);
      toast.error("Ish vaqtini saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  // Shifokor / Har bir foydalanuvchining o'z profilini saqlashi (Ism, Telefon, Yangi parol)
  const handleSaveMyProfile = async (e) => {
    if (e) e.preventDefault();
    if (!currentUser?.id) return;
    if (!myProfileForm.name.trim()) {
      toast.error(t('settings.staff.errorEnterName') || 'Ism kiriting!');
      return;
    }
    if (myProfileForm.password && myProfileForm.password.length < 4) {
      toast.error(t('settings.staff.errorMinPassword') || 'Parol kamida 4 ta belgidan iborat bo\'lishi kerak!');
      return;
    }
    if (myProfileForm.password && myProfileForm.password !== myProfileForm.confirmPassword) {
      toast.error('Yangi parol va tasdiqlash paroli bir-biriga mos kelmadi!');
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
        toast.success("✅ Profil ma'lumotlari va parolingiz muvaffaqiyatli o'zgartirildi!");
      } else {
        toast.success("✅ Profil ma'lumotlaringiz muvaffaqiyatli saqlandi!");
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

  // Shifokorning o'z ish vaqtlarini saqlashi
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  const avatarSource = currentUser?.avatar_url || currentUser?.photo || currentUser?.avatar || currentUser?.image;

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      
      {/* Header Bar */}
      <div className="border border-slate-300 rounded-2xl bg-white shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center font-black shadow-xs">
            <Table className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('settings.title') || "Sozlamalar"}</h1>
            <p className="text-xs text-slate-500 font-medium">{t('settings.general') || "Klinika va profil sozlamalarini boshqarish"}</p>
          </div>
        </div>

        <Button 
          variant="outline" 
          size="sm"
          className="rounded-xl px-4 font-bold text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 self-start sm:self-auto"
          onClick={logout || (() => {
            localStorage.removeItem('is_authenticated');
            localStorage.removeItem('user_name');
            localStorage.removeItem('clinic_id');
            window.location.href = '/login';
          })}
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          {t('settings.logout') || "Chiqish"}
        </Button>
      </div>

      <Tabs defaultValue="profile" className="space-y-5">
        
        {/* Sheet Tabs Bar */}
        <TabsList className="bg-slate-200/80 p-1 rounded-xl border border-slate-300 inline-flex flex-wrap h-auto gap-1 w-full justify-start">
          {isAdmin && (
            <>
              <TabsTrigger 
                value="website-integration" 
                className="rounded-lg px-3.5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold text-xs flex items-center gap-1.5 transition-all text-slate-600"
              >
                <Globe className="w-3.5 h-3.5 text-indigo-600" /> 
                {t('settings.tabs.websiteIntegration') || "Vebsayt Integratsiyasi"}
              </TabsTrigger>

              <TabsTrigger 
                value="public-page" 
                className="rounded-lg px-3.5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold text-xs flex items-center gap-1.5 transition-all text-slate-600"
              >
                <LayoutIcon className="w-3.5 h-3.5 text-emerald-600" /> 
                {t('settings.tabs.publicPage') || "Ommaviy sahifa"}
              </TabsTrigger>

              <TabsTrigger 
                value="general" 
                className="rounded-lg px-3.5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold text-xs flex items-center gap-1.5 transition-all text-slate-600"
              >
                <SettingsIcon className="w-3.5 h-3.5 text-blue-600" /> 
                {t('settings.tabs.clinicSettings') || "Klinika sozlamalari"}
              </TabsTrigger>

              <TabsTrigger 
                value="staff" 
                className="rounded-lg px-3.5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold text-xs flex items-center gap-1.5 transition-all text-slate-600"
              >
                <Users className="w-3.5 h-3.5 text-purple-600" /> 
                {t('settings.tabs.staff') || "Xodimlar"}
              </TabsTrigger>
            </>
          )}

          <TabsTrigger 
            value="profile" 
            className="rounded-lg px-3.5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold text-xs flex items-center gap-1.5 transition-all text-slate-600"
          >
            <User className="w-3.5 h-3.5 text-amber-600" /> 
            {t('settings.tabs.myProfile') || "Mening profilim"}
          </TabsTrigger>

          <TabsTrigger 
            value="language" 
            className="rounded-lg px-3.5 py-2 data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-xs font-bold text-xs flex items-center gap-1.5 transition-all text-slate-600"
          >
             <Languages className="w-3.5 h-3.5 text-sky-600" /> 
             {t('settings.tabs.language') || "Til sozlamalari"}
          </TabsTrigger>
        </TabsList>

        {isAdmin && (
          <>
            {/* TAB 1: WEBSITE INTEGRATION */}
            <TabsContent value="website-integration">
               <WebsiteIntegrationSettings />
            </TabsContent>

            {/* TAB 2: PUBLIC PAGE SETTINGS */}
            <TabsContent value="public-page">
               <PublicPageSettings />
            </TabsContent>

            {/* TAB 3: CLINIC SETTINGS (GENERAL) */}
            <TabsContent value="general" className="max-w-3xl space-y-6">
              <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
                
                {/* Header */}
                <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center font-black text-xs">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t('settings.clinicSettings') || "Klinika sozlamalari"}
                    </h3>
                  </div>
                </div>

                {/* Excel Column Headers */}
                <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">
                  <div className="col-span-1 py-1.5 px-2 border-r border-slate-200 text-center">#</div>
                  <div className="col-span-4 py-1.5 px-3 border-r border-slate-200">Parametr</div>
                  <div className="col-span-7 py-1.5 px-3">Qiymat / Ma'lumot</div>
                </div>

                {/* Table Rows */}
                <div className="divide-y divide-slate-200 text-xs">
                  
                  {/* Row 1: Clinic ID */}
                  <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                      1
                    </div>
                    <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                      <Lock className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="font-bold text-slate-800">{t('superAdmin.clinicId') || "Klinika ID"}</span>
                    </div>
                    <div className="col-span-7 p-2 flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                        {localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                        {t('settings.clinic.immutable') || "O'zgarmas ID"}
                      </span>
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
                        <span className="font-bold text-slate-800 block">{t('settings.clinic.clinicLogo') || "Klinika Logotipi"}</span>
                        <span className="text-[10px] text-slate-400 font-normal">PNG yoki JPG</span>
                      </div>
                    </div>
                    <div className="col-span-7 p-2 flex items-center gap-3">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        id="logo-upload"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = async () => {
                              const currentClinic = await base44.clinic.getCurrentClinic();
                              if (currentClinic) {
                                await base44.clinic.updateClinic(currentClinic.id, { logo: reader.result });
                                toast.success(t('settings.clinic.logoSaved') || "Logotip muvaffaqiyatli saqlandi!");
                                setTimeout(() => window.location.reload(), 1500);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }} 
                      />
                      <Button variant="outline" size="sm" className="h-8 rounded-lg px-3 bg-white border-slate-300 font-bold text-xs text-slate-700" asChild>
                        <label htmlFor="logo-upload" className="cursor-pointer flex items-center gap-1.5">
                          <ImagePlus className="w-3.5 h-3.5 text-indigo-600" />
                          {t('settings.clinic.upload') || "Logotip yuklash"}
                        </label>
                      </Button>
                      <p className="text-[10px] text-slate-500 font-medium">Hisob-faktura va cheklarda ko'rinadi</p>
                    </div>
                  </div>

                  {/* Row 3: Clinic Name */}
                  <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                      3
                    </div>
                    <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                      <span className="font-bold text-slate-800">{t('settings.clinicName') || "Klinika Nomi"}</span>
                    </div>
                    <div className="col-span-7 p-2">
                      <Input 
                        value={clinic?.name || ''} 
                        onChange={e => setClinic({...clinic, name: e.target.value})}
                        className="h-9 text-xs font-bold border-slate-200 rounded-lg focus:border-indigo-500" 
                      />
                    </div>
                  </div>

                  {/* Row 4: Phone */}
                  <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                      4
                    </div>
                    <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold text-slate-800">{t('common.phone') || "Telefon"}</span>
                    </div>
                    <div className="col-span-7 p-2">
                      <Input 
                        value={clinic?.phone || ''} 
                        onChange={e => setClinic({...clinic, phone: e.target.value})}
                        placeholder="+998..." 
                        className="h-9 text-xs font-bold border-slate-200 rounded-lg focus:border-indigo-500 font-mono" 
                      />
                    </div>
                  </div>

                  {/* Row 5: Address */}
                  <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                    <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                      5
                    </div>
                    <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                      <span className="font-bold text-slate-800">{t('common.address') || "Manzil"}</span>
                    </div>
                    <div className="col-span-7 p-2">
                      <Input 
                        value={clinic?.address || ''} 
                        onChange={e => setClinic({...clinic, address: e.target.value})}
                        placeholder="Klinika manzili..." 
                        className="h-9 text-xs border-slate-200 rounded-lg focus:border-indigo-500" 
                      />
                    </div>
                  </div>

                </div>

                {/* Footer Toolbar */}
                <div className="bg-slate-50 p-3 border-t border-slate-300 flex justify-end">
                  <Button 
                    onClick={handleSaveClinic} 
                    disabled={saving}
                    className="h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs px-6 shadow-sm flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {saving ? (t('settings.publicPage.saving') || 'Saqlanmoqda...') : (t('settings.clinic.save') || 'SAQLASH')}
                  </Button>
                </div>

              </div>
            </TabsContent>

            {/* TAB 4: STAFF SETTINGS (XODIMLAR) */}
            <TabsContent value="staff" className="space-y-6">
              
              {/* Part 1: Add Doctor Form */}
              <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-black text-xs">
                      <Plus className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t('settings.staff.addDoctor') || "Shifokor qo'shish"}
                    </h3>
                  </div>
                </div>

                {/* Form Row */}
                <div className="p-4 bg-slate-50/50">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">
                        {t('settings.staff.fullName') || "To'liq ism"} *
                      </label>
                      <Input 
                        placeholder="Dr. Alisher" 
                        value={newStaff.full_name}
                        className="h-9 text-xs font-bold border-slate-300 rounded-lg bg-white"
                        onChange={e => setNewStaff({...newStaff, full_name: e.target.value})}
                      />
                    </div>

                    <div className="sm:col-span-3 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">
                        {t('settings.staff.passwordLogin') || "Parol"} *
                      </label>
                      <Input 
                        type="text"
                        placeholder="Parol (kamida 4 belgi)" 
                        value={newStaff.password}
                        className="h-9 text-xs font-mono font-bold border-slate-300 rounded-lg bg-white"
                        onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">
                        {t('settings.staff.share') || "Ulush (%)"}
                      </label>
                      <Input 
                        type="number"
                        value={newStaff.commission === 0 || newStaff.commission === '' ? '' : newStaff.commission}
                        placeholder="40"
                        className="h-9 text-xs font-bold border-slate-300 rounded-lg bg-white font-mono"
                        onChange={e => {
                          const val = e.target.value;
                          setNewStaff({...newStaff, commission: val === '' ? '' : Number(val)});
                        }}
                      />
                    </div>

                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider font-mono">
                        {t('settings.staff.role') || "Lavozimi"}
                      </label>
                      <Input 
                        placeholder="Stomatolog" 
                        value={newStaff.specialty}
                        className="h-9 text-xs border-slate-300 rounded-lg bg-white"
                        onChange={e => setNewStaff({...newStaff, specialty: e.target.value})}
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-end">
                      <Button 
                        onClick={addStaff} 
                        className="w-full h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        {t('common.add') || "Qo'shish"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Part 2: Existing Doctors Table */}
              <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
                <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-700 text-white flex items-center justify-center font-black text-xs">
                      <Users className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t('settings.staff.availableDoctors', { count: users.filter(u => u.role === 'doctor').length }) || `Mavjud shifokorlar (${users.filter(u => u.role === 'doctor').length} ta)`}
                    </h3>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-300 text-[10px] font-black uppercase text-slate-500 font-mono tracking-wider">
                        <th className="py-2.5 px-3 border-r border-slate-200 w-12 text-center">#</th>
                        <th className="py-2.5 px-4 border-r border-slate-200">Shifokor</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Mutaxassisligi</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Ulush (%)</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Login</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Parol</th>
                        <th className="py-2.5 px-3 border-r border-slate-200 text-center">Ish jadvali</th>
                        <th className="py-2.5 px-3 text-center">Amallar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {users.filter(u => u.role === 'doctor').map((doctor, index) => {
                        const isEditingSchedule = editingScheduleDoctorId === doctor.id;
                        return (
                          <>
                            <tr key={doctor.id} className="hover:bg-slate-50/70 transition-colors">
                              <td className="py-2.5 px-3 bg-slate-50 border-r border-slate-200 font-mono text-center font-bold text-slate-400">
                                {index + 1}
                              </td>
                              <td className="py-2.5 px-4 border-r border-slate-200">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center font-bold text-emerald-700 overflow-hidden shrink-0 text-xs">
                                    {(doctor.avatar_url || doctor.photo || doctor.avatar || doctor.image) ? (
                                      <img src={doctor.avatar_url || doctor.photo || doctor.avatar || doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                                    ) : (
                                      doctor.name?.[0]?.toUpperCase()
                                    )}
                                  </div>
                                  <span className="font-bold text-slate-900">{doctor.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200">
                                <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                  {doctor.specialty || 'Stomatolog'}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 font-mono font-bold text-indigo-700">
                                {doctor.commission_rate || 0}%
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-700">
                                {doctor.username || doctor.name?.toLowerCase().replace(/\s+/g, '.')}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-amber-700 bg-amber-50/40">
                                {doctor.password || '—'}
                              </td>
                              <td className="py-2.5 px-3 border-r border-slate-200 text-center">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    if (isEditingSchedule) {
                                      setEditingScheduleDoctorId(null);
                                    } else {
                                      setEditingScheduleDoctorId(doctor.id);
                                      setCurrentSchedule(doctor.workingHours || defaultSchedule);
                                    }
                                  }} 
                                  className={`h-7 text-xs font-bold px-2.5 rounded-lg border ${isEditingSchedule ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-700'}`}
                                >
                                  <Clock className="w-3.5 h-3.5 mr-1 text-indigo-600" />
                                  {isEditingSchedule ? "Yopish" : "Jadval"}
                                </Button>
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => deleteStaff(doctor.id)} 
                                  className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                                  title="O'chirish"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </td>
                            </tr>

                            {/* Inline Schedule Sub-Table */}
                            {isEditingSchedule && (
                              <tr key={`schedule-${doctor.id}`} className="bg-slate-50/90">
                                <td colSpan={8} className="p-4 border-b border-slate-300">
                                  <div className="border border-slate-300 rounded-xl bg-white p-4 space-y-3 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                                      <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-indigo-600" />
                                        {doctor.name} — Haftalik ish jadvalini sozlash
                                      </h4>
                                    </div>

                                    {/* Weekly Schedule Grid */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                                      {[
                                        { label: 'Dushanba', dayId: '1' },
                                        { label: 'Seshanba', dayId: '2' },
                                        { label: 'Chorshanba', dayId: '3' },
                                        { label: 'Payshanba', dayId: '4' },
                                        { label: 'Juma', dayId: '5' },
                                        { label: 'Shanba', dayId: '6' },
                                        { label: 'Yakshanba', dayId: '0' },
                                      ].map(({ label, dayId }) => {
                                        const daySettings = currentSchedule[dayId] || { active: false, start: '09:00', end: '18:00' };
                                        return (
                                          <div key={dayId} className="border border-slate-200 rounded-lg p-2 bg-slate-50/50 space-y-1.5">
                                            <div className="flex items-center justify-between">
                                              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer">
                                                <input 
                                                  type="checkbox" 
                                                  checked={daySettings.active}
                                                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                                                  onChange={(e) => {
                                                    setCurrentSchedule({
                                                      ...currentSchedule,
                                                      [dayId]: { ...daySettings, active: e.target.checked }
                                                    });
                                                  }}
                                                />
                                                {label}
                                              </label>
                                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${daySettings.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}`}>
                                                {daySettings.active ? 'Ish' : 'Dam'}
                                              </span>
                                            </div>

                                            {daySettings.active && (
                                              <div className="flex items-center gap-1 text-xs">
                                                <select 
                                                  value={daySettings.start}
                                                  className="h-7 rounded border-slate-200 bg-white text-xs font-bold text-slate-700 px-1 w-full"
                                                  onChange={(e) => {
                                                    setCurrentSchedule({
                                                      ...currentSchedule,
                                                      [dayId]: { ...daySettings, start: e.target.value }
                                                    });
                                                  }}
                                                >
                                                  {hourOptions.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                  ))}
                                                </select>
                                                <span className="text-slate-400 font-bold">-</span>
                                                <select 
                                                  value={daySettings.end}
                                                  className="h-7 rounded border-slate-200 bg-white text-xs font-bold text-slate-700 px-1 w-full"
                                                  onChange={(e) => {
                                                    setCurrentSchedule({
                                                      ...currentSchedule,
                                                      [dayId]: { ...daySettings, end: e.target.value }
                                                    });
                                                  }}
                                                >
                                                  {hourOptions.map(h => (
                                                    <option key={h} value={h}>{h}</option>
                                                  ))}
                                                </select>
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>

                                    <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                      <Button 
                                        variant="outline" 
                                        size="sm"
                                        onClick={() => setEditingScheduleDoctorId(null)}
                                        className="h-8 text-xs font-bold border-slate-300"
                                      >
                                        Bekor qilish
                                      </Button>
                                      <Button 
                                        size="sm"
                                        onClick={() => saveWorkingHours(doctor, currentSchedule)}
                                        disabled={saving}
                                        className="h-8 bg-slate-900 text-white text-xs font-bold px-4"
                                      >
                                        {saving ? 'Saqlanmoqda...' : 'Jadvalni saqlash'}
                                      </Button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}

                      {users.filter(u => u.role === 'doctor').length === 0 && (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-xs text-slate-400 italic">
                            Hozircha shifokorlar qo'shilmagan
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </TabsContent>
          </>
        )}

        {/* TAB 5: MY PROFILE SETTINGS */}
        <TabsContent value="profile" className="max-w-4xl space-y-6">
          <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
            
            {/* Header / Summary Bar */}
            <div className="bg-slate-100 border-b border-slate-300 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                
                {/* Avatar */}
                <div className="relative group/avatar shrink-0">
                  <div className="w-16 h-16 bg-emerald-700 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-xs border border-white overflow-hidden">
                    {avatarSource ? (
                      <img 
                        src={avatarSource} 
                        alt={currentUser?.name || 'Avatar'} 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      currentUser?.name?.[0]?.toUpperCase() || currentUser?.full_name?.[0]?.toUpperCase() || 'U'
                    )}
                  </div>

                  <label 
                    htmlFor="desktop-avatar-upload"
                    className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-slate-900 text-white flex items-center justify-center cursor-pointer shadow-xs hover:bg-emerald-600 transition-all"
                    title="Profil rasmini yuklash"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </label>
                  <input 
                    id="desktop-avatar-upload" 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp" 
                    className="hidden" 
                    onChange={handleAvatarUpload} 
                  />

                  {avatarSource && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-md bg-rose-500 text-white flex items-center justify-center shadow-xs hover:bg-rose-600 transition-all"
                      title="Rasmni o'chirish"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{currentUser?.name || currentUser?.full_name || t('common.username')}</h3>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
                      {currentUser?.role === 'doctor' || isDoctor ? 'Shifokor' : 'Administrator'}
                    </span>
                    {currentUser?.specialty && (
                      <span className="text-[10px] font-semibold text-slate-600 px-2 py-0.5 bg-slate-100 rounded border border-slate-200">
                        {currentUser.specialty}
                      </span>
                    )}
                    {(currentUser?.role === 'doctor' || isDoctor) && (
                      <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 font-mono">
                        {currentUser.commission_rate ?? currentUser.commission ?? 40}% ulush
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 p-2.5 rounded-xl text-left sm:text-right">
                <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider block font-mono">Login</span>
                <span className="font-mono font-bold text-xs text-slate-800">{currentUser?.username || '—'}</span>
              </div>
            </div>

            {/* Profile Table */}
            <form onSubmit={handleSaveMyProfile}>
              
              {/* Table Headers */}
              <div className="grid grid-cols-12 bg-slate-50/80 border-b border-slate-300 text-[10px] font-black uppercase tracking-wider text-slate-500 font-mono">
                <div className="col-span-1 py-1.5 px-2 border-r border-slate-200 text-center">#</div>
                <div className="col-span-4 py-1.5 px-3 border-r border-slate-200">Maydon</div>
                <div className="col-span-7 py-1.5 px-3">Qiymat</div>
              </div>

              <div className="divide-y divide-slate-200 text-xs">
                
                {/* Row 1: Name */}
                <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                  <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                    1
                  </div>
                  <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                    <User className="w-4 h-4 text-slate-500 shrink-0" />
                    <span className="font-bold text-slate-800">{t('common.name') || "Ism"} *</span>
                  </div>
                  <div className="col-span-7 p-2">
                    <Input 
                      value={myProfileForm.name} 
                      onChange={e => setMyProfileForm({ ...myProfileForm, name: e.target.value })}
                      className="h-9 text-xs font-bold border-slate-200 rounded-lg focus:border-indigo-500" 
                    />
                  </div>
                </div>

                {/* Row 2: Phone */}
                <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                  <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                    2
                  </div>
                  <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-slate-800">{t('common.phone') || "Telefon"}</span>
                  </div>
                  <div className="col-span-7 p-2">
                    <Input 
                      value={myProfileForm.phone} 
                      onChange={e => setMyProfileForm({ ...myProfileForm, phone: e.target.value })}
                      placeholder="+998..."
                      className="h-9 text-xs font-mono font-bold border-slate-200 rounded-lg focus:border-indigo-500" 
                    />
                  </div>
                </div>

                {/* Row 3: New Password */}
                <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                  <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                    3
                  </div>
                  <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800 block">Yangi parol</span>
                      <span className="text-[10px] text-slate-400">Ixtiyoriy</span>
                    </div>
                  </div>
                  <div className="col-span-7 p-2">
                    <Input 
                      type="password"
                      placeholder="Kamida 4 ta belgi" 
                      value={myProfileForm.password}
                      onChange={e => setMyProfileForm({ ...myProfileForm, password: e.target.value })}
                      className="h-9 text-xs font-mono border-slate-200 rounded-lg focus:border-indigo-500" 
                    />
                  </div>
                </div>

                {/* Row 4: Confirm Password */}
                <div className="grid grid-cols-12 hover:bg-slate-50/50 transition-colors">
                  <div className="col-span-1 bg-slate-50 border-r border-slate-200 font-mono text-[11px] text-slate-400 flex items-center justify-center font-bold">
                    4
                  </div>
                  <div className="col-span-4 p-3 border-r border-slate-200 bg-slate-50/40 flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="font-bold text-slate-800">Parolni tasdiqlash</span>
                  </div>
                  <div className="col-span-7 p-2">
                    <Input 
                      type="password"
                      placeholder="Parolni qayta kiriting" 
                      value={myProfileForm.confirmPassword}
                      onChange={e => setMyProfileForm({ ...myProfileForm, confirmPassword: e.target.value })}
                      className="h-9 text-xs font-mono border-slate-200 rounded-lg focus:border-indigo-500" 
                    />
                  </div>
                </div>

              </div>

              {/* Action Toolbar */}
              <div className="bg-slate-50 p-3 border-t border-slate-300 flex justify-end">
                <Button 
                  type="submit"
                  disabled={savingMyProfile}
                  className="h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs px-6 shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  {savingMyProfile ? 'Saqlanmoqda...' : 'Ma\'lumotlarni saqlash'}
                </Button>
              </div>

            </form>

            {/* Doctor's Own Schedule Table */}
            {isDoctor && (
              <div className="border-t border-slate-300 p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    Mening ish vaqtlarim (Haftalik jadval)
                  </h4>
                  <Button 
                    onClick={handleSaveMySchedule}
                    disabled={savingMySchedule}
                    size="sm"
                    className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs px-4"
                  >
                    {savingMySchedule ? 'Saqlanmoqda...' : 'Jadvalni saqlash'}
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
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
                      <div key={dayId} className="border border-slate-200 rounded-lg p-2.5 bg-white space-y-1.5 shadow-xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5 cursor-pointer">
                            <input 
                              type="checkbox" 
                              id={`my-check-${dayId}`}
                              checked={daySettings.active}
                              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                              onChange={(e) => {
                                setMySchedule({
                                  ...mySchedule,
                                  [dayId]: { ...daySettings, active: e.target.checked }
                                });
                              }}
                            />
                            {label}
                          </label>
                          <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${daySettings.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {daySettings.active ? 'Faol' : 'Dam'}
                          </span>
                        </div>

                        {daySettings.active && (
                          <div className="flex items-center gap-1 text-xs">
                            <select 
                              value={daySettings.start}
                              className="h-7 rounded border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 px-1 w-full"
                              onChange={(e) => {
                                setMySchedule({
                                  ...mySchedule,
                                  [dayId]: { ...daySettings, start: e.target.value }
                                });
                              }}
                            >
                              {hourOptions.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                            <span className="text-slate-400 font-bold">-</span>
                            <select 
                              value={daySettings.end}
                              className="h-7 rounded border-slate-200 bg-slate-50 text-xs font-bold text-slate-700 px-1 w-full"
                              onChange={(e) => {
                                setMySchedule({
                                  ...mySchedule,
                                  [dayId]: { ...daySettings, end: e.target.value }
                                });
                              }}
                            >
                              {hourOptions.map(h => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </TabsContent>

        {/* TAB 6: LANGUAGE SETTINGS */}
        <TabsContent value="language" className="max-w-2xl">
          <div className="border border-slate-300 rounded-2xl bg-white shadow-sm overflow-hidden">
            <div className="bg-slate-100 border-b border-slate-300 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-sky-700 text-white flex items-center justify-center font-black text-xs">
                  <Languages className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {t('settings.language') || "Til sozlamalari"}
                </h3>
              </div>
            </div>

            <div className="p-5 space-y-3">
              <label className="text-[10px] uppercase font-black text-slate-500 tracking-wider block font-mono">
                {t('settings.selectLanguage') || "Tizim tilini tanlang"}
              </label>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </TabsContent>

      </Tabs>

    </div>
  );
}

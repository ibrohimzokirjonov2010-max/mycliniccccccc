import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Settings as SettingsIcon, User, Plus, Trash2, 
  Globe, ImagePlus, Layout as LayoutIcon, ShieldCheck,
  Users, Languages, Clock
} from 'lucide-react';
import { useTranslation } from '@/i18n/LanguageContext';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PublicPageSettings from '@/components/settings/PublicPageSettings';
import WebsiteIntegrationSettings from '@/components/settings/WebsiteIntegrationSettings';

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
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [newStaff, setNewStaff] = useState({ full_name: '', specialty: 'Stomatolog', commission: 40, password: '' });
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Ish vaqtlarini sozlash uchun state'lar
  const [editingScheduleDoctorId, setEditingScheduleDoctorId] = useState(null);
  const [currentSchedule, setCurrentSchedule] = useState({});

  const load = async () => {
    try {
      const userName = localStorage.getItem('user_name') || 'Admin';
      const clinicId = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic';
      setUser({ 
        full_name: userName, 
        email: `${userName}@${clinicId}.clinic`,
        role: 'admin'
      });
      
      const currentClinic = await base44.clinic.getCurrentClinic();
      setClinic(currentClinic);
      
      // Use specialized auth method to get all users for this clinic reliably
      const allUsers = await base44.auth.getUsers(clinicId);
      console.log('⚙️ Settings Loaded Users:', allUsers);
      setUsers(allUsers || []);
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
      toast.success("Klinika ma'lumotlari saqlandi!");
    } catch (err) {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addStaff = async () => {
    if (!newStaff.full_name) {
      toast.error('Ism kiriting!');
      return;
    }
    if (!newStaff.password || newStaff.password.length < 4) {
      toast.error('Parol kamida 4 ta belgidan iborat bo\'lishi kerak!');
      return;
    }

    try {
      const clinicId = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic';
      
      // Use specialized auth.addUser for better synchronization between Supabase and localStorage
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
      toast.success('Shifokor muvaffaqiyatli qo\'shildi!');
    } catch (error) {
      console.error('Add doctor error:', error);
      toast.error('Xatolik yuz berdi: ' + (error.message || ''));
    }
  };

  const deleteStaff = async (id) => {
    if (window.confirm("Haqiqatdan ham ushbu xodimni o'chirmoqchimisiz? Bu amalni ortga qaytarib bo'lmaydi.")) {
      try {
        await base44.auth.deleteUser(id);
        toast.success("Xodim o'chirildi");
        await load();
      } catch (e) {
        toast.error("O'chirishda xatolik yuz berdi");
      }
    }
  };

  const saveWorkingHours = async (doctor, schedule) => {
    try {
      setSaving(true);
      console.log('💾 Saving working hours for:', doctor.name, 'Payload:', {
        ...doctor,
        workingHours: schedule
      });
      const res = await base44.entities.User.update(doctor.id, {
        ...doctor,
        workingHours: schedule
      });
      console.log('💾 Save Response:', res);
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

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
           <h1 className="text-3xl font-black text-slate-900">{t('settings.title')}</h1>
           <p className="text-sm text-slate-500 mt-1 font-medium">{t('settings.general')}</p>
        </div>
        <Button variant="destructive" className="rounded-xl px-6 font-bold" onClick={() => {
           localStorage.removeItem('is_authenticated');
           localStorage.removeItem('user_name');
           localStorage.removeItem('clinic_id');
           window.location.href = '/login';
        }}>
          Chiqish
        </Button>
      </div>

      <Tabs defaultValue="public-page" className="space-y-6">
        <TabsList className="bg-slate-100/50 p-1 rounded-2xl border border-slate-100 inline-flex flex-wrap h-auto gap-1">
          <TabsTrigger value="website-integration" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm flex items-center gap-2">
            <Globe className="w-4 h-4 text-indigo-500" /> Vebsayt Integratsiyasi
          </TabsTrigger>
          <TabsTrigger value="public-page" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm flex items-center gap-2">
            <LayoutIcon className="w-4 h-4" /> Ommaviy sahifa
          </TabsTrigger>
          <TabsTrigger value="general" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> Klinika sozlamalari
          </TabsTrigger>
          <TabsTrigger value="staff" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm flex items-center gap-2">
            <Users className="w-4 h-4" /> Xodimlar
          </TabsTrigger>
          <TabsTrigger value="profile" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm flex items-center gap-2">
            <User className="w-4 h-4" /> Mening profilim
          </TabsTrigger>
          <TabsTrigger value="language" className="rounded-xl px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:shadow-sm font-bold text-sm flex items-center gap-2">
             <Languages className="w-4 h-4" /> Til sozlamalari
          </TabsTrigger>
        </TabsList>

        <TabsContent value="website-integration">
           <WebsiteIntegrationSettings />
        </TabsContent>

        <TabsContent value="public-page">
           <PublicPageSettings />
        </TabsContent>

        <TabsContent value="general" className="max-w-2xl space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-500" /> 
              {t('settings.clinicSettings')}
            </h3>
            <div className="space-y-6">
              <div>
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 mb-2 block">
                  {t('superAdmin.clinicId')}
                </Label>
                <div className="flex gap-2 items-center bg-slate-50 border border-slate-200 rounded-xl px-4 h-12">
                  <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="font-mono text-slate-700 font-bold flex-1 text-sm">{localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic'}</span>
                  <span className="text-[9px] uppercase font-black text-slate-400 tracking-widest bg-slate-200 px-2 py-1 rounded-lg">O'zgarmaydi</span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1.5 uppercase font-black tracking-widest">
                  Klinika ID xavfsizlik uchun o'zgartirib bo'lmaydi
                </p>
              </div>
              
              <div className="pt-4 border-t border-slate-50">
                <Label className="flex items-center gap-2 mb-4 font-bold text-slate-700">
                  <ImagePlus className="w-4 h-4 text-indigo-500" />
                  Klinika Logotipi
                </Label>
                <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-2xl border border-slate-100 border-dashed">
                  <div className="relative">
                    <Input 
                      type="file" 
                      accept="image/*" 
                      id="logo-upload"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = async () => {
                            const currentClinic = await base44.clinic.getCurrentClinic();
                            if (currentClinic) {
                              await base44.clinic.updateClinic(currentClinic.id, { logo: reader.result });
                              toast.success("Logotip muvaffaqiyatli saqlandi!");
                              setTimeout(() => window.location.reload(), 1500);
                            }
                          };
                          reader.readAsDataURL(file);
                        }
                      }} 
                    />
                    <Button variant="outline" className="h-10 rounded-xl px-6 bg-white border-slate-200 font-bold" asChild>
                      <label htmlFor="logo-upload" className="cursor-pointer">
                        Yuklash
                      </label>
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500 font-medium">Ixtiyoriy PNG yoki JPG rasm. Bemorlar sahifasida va hisob-fakturalarda ko'rinadi.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                 <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">{t('settings.clinicName')}</Label>
                    <Input 
                      value={clinic?.name || ''} 
                      onChange={e => setClinic({...clinic, name: e.target.value})}
                      className="h-12 rounded-xl border-slate-100" 
                    />
                 </div>
                 <div className="space-y-1.5">
                    <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">{t('common.phone')}</Label>
                    <Input 
                      value={clinic?.phone || ''} 
                      onChange={e => setClinic({...clinic, phone: e.target.value})}
                      placeholder="+998..." 
                      className="h-12 rounded-xl border-slate-100" 
                    />
                 </div>
              </div>
              <div className="pt-2">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">{t('common.address')}</Label>
                <Input 
                  value={clinic?.address || ''} 
                  onChange={e => setClinic({...clinic, address: e.target.value})}
                  placeholder="Klinika manzili..." 
                  className="h-12 rounded-xl border-slate-100 mt-1.5" 
                />
              </div>

              <div className="pt-6 border-t border-slate-50">
                 <Button 
                   onClick={handleSaveClinic} 
                   disabled={saving}
                   className="w-full h-12 bg-slate-900 rounded-xl font-bold"
                 >
                   {saving ? 'Saqlanmoqda...' : 'SAQLASH'}
                 </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="staff" className="max-w-2xl space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" /> 
              Shifokor qo'shish
            </h3>
            
            <div className="grid grid-cols-1 gap-4 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 mb-2 block">To'liq ismi *</Label>
                  <Input 
                    placeholder="Dr. Alisher" 
                    value={newStaff.full_name}
                    className="h-12 rounded-xl border-none shadow-sm"
                    onChange={e => setNewStaff({...newStaff, full_name: e.target.value})}
                  />
                </div>
                <div>
                  <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 mb-2 block">Parol * (login parol)</Label>
                  <Input 
                    type="text"
                    placeholder="Masalan: doctor2024"
                    value={newStaff.password}
                    className="h-12 rounded-xl border-none shadow-sm font-mono"
                    onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 mb-2 block">Ulush (%)</Label>
                  <Input 
                    type="number"
                    value={newStaff.commission === 0 || newStaff.commission === '' ? '' : newStaff.commission}
                    placeholder="Masalan: 40"
                    className="h-12 rounded-xl border-none shadow-sm"
                    onChange={e => {
                      const val = e.target.value;
                      setNewStaff({...newStaff, commission: val === '' ? '' : Number(val)});
                    }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 mb-2 block">Lavozimi</Label>
                  <Input 
                    placeholder="Masalan: Stomatolog" 
                    value={newStaff.specialty}
                    className="h-12 rounded-xl border-none shadow-sm"
                    onChange={e => setNewStaff({...newStaff, specialty: e.target.value})}
                  />
                </div>
                <div className="flex items-end">
                  <Button onClick={addStaff} className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold">
                    Qo'shish
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">
                Mavjud shifokorlar ({users.filter(u => u.role === 'doctor').length} ta)
              </Label>
              <div className="grid grid-cols-1 gap-2">
                {users.filter(u => u.role === 'doctor').map(doctor => {
                  const isEditingSchedule = editingScheduleDoctorId === doctor.id;
                  return (
                    <div key={doctor.id} className="p-4 rounded-2xl bg-white border border-slate-100 hover:border-slate-200 transition-all space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center font-bold text-emerald-700">
                            {doctor.name?.[0]}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{doctor.name}</p>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">
                              {doctor.specialty || 'Shifokor'} • {doctor.commission_rate || 0}% ulush
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-md">
                                Login: {doctor.username || doctor.name?.toLowerCase().replace(/\s+/g, '.')}
                              </span>
                              <span className="text-[10px] bg-amber-50 text-amber-700 font-mono px-2 py-0.5 rounded-md border border-amber-100">
                                Parol: {doctor.password || '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => {
                              if (isEditingSchedule) {
                                setEditingScheduleDoctorId(null);
                              } else {
                                setEditingScheduleDoctorId(doctor.id);
                                setCurrentSchedule(doctor.workingHours || defaultSchedule);
                              }
                            }} 
                            className={`rounded-xl transition-all ${isEditingSchedule ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-50'}`}
                          >
                            <Clock className="w-5 h-5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteStaff(doctor.id)} className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all">
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>

                      {/* 📅 Ish vaqtini tahrirlash paneli (Inline collapse) */}
                      {isEditingSchedule && (
                        <div className="pt-4 border-t border-slate-100 space-y-4 bg-slate-50/50 p-4 rounded-xl">
                          <h4 className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            Ish vaqtlarini sozlash
                          </h4>
                          
                          <div className="space-y-2.5">
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
                                <div key={dayId} className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-100 shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <input 
                                      type="checkbox" 
                                      id={`check-${doctor.id}-${dayId}`}
                                      checked={daySettings.active}
                                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer"
                                      onChange={(e) => {
                                        setCurrentSchedule({
                                          ...currentSchedule,
                                          [dayId]: { ...daySettings, active: e.target.checked }
                                        });
                                      }}
                                    />
                                    <label htmlFor={`check-${doctor.id}-${dayId}`} className="text-xs font-bold text-slate-700 cursor-pointer w-20">
                                      {label}
                                    </label>
                                  </div>

                                  {daySettings.active ? (
                                    <div className="flex items-center gap-2">
                                      <select 
                                        value={daySettings.start}
                                        className="h-8 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-700 px-2 focus:ring-1 focus:ring-indigo-500"
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
                                      <span className="text-[10px] font-bold text-slate-400">dan</span>
                                      <select 
                                        value={daySettings.end}
                                        className="h-8 rounded-lg border-slate-200 bg-white text-xs font-bold text-slate-700 px-2 focus:ring-1 focus:ring-indigo-500"
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
                                      <span className="text-[10px] font-bold text-slate-400">gacha</span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] font-bold text-slate-400 italic pr-4">Dam olish kuni</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="flex justify-end gap-2 pt-2">
                            <Button 
                              variant="outline" 
                              onClick={() => setEditingScheduleDoctorId(null)}
                              className="h-9 rounded-lg text-xs font-bold px-4"
                            >
                              Bekor qilish
                            </Button>
                            <Button 
                              onClick={() => saveWorkingHours(doctor, currentSchedule)}
                              disabled={saving}
                              className="h-9 bg-slate-900 text-white rounded-lg text-xs font-bold px-4"
                            >
                              {saving ? 'Saqlanmoqda...' : 'Saqlash'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {users.filter(u => u.role === 'doctor').length === 0 && (
                  <p className="text-xs text-slate-400 italic py-8 text-center bg-slate-50/50 rounded-2xl border border-dashed">Hali shifokorlar qo'shilmagan</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="profile" className="max-w-2xl space-y-6">
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
            <div className="flex items-center gap-6 mb-10">
              <div className="w-24 h-24 bg-primary/10 rounded-[2rem] flex items-center justify-center border-4 border-white shadow-lg">
                <User className="w-12 h-12 text-primary" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">{user?.full_name || t('common.username')}</h3>
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest mt-1 px-3 py-1 bg-slate-100 rounded-full inline-block">{user?.role}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">{t('common.name')}</Label>
                <Input value={user?.full_name || ''} disabled className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1">{t('common.email')}</Label>
                <Input value={user?.email || ''} disabled className="h-12 rounded-xl bg-slate-50 border-none font-bold" />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="language" className="max-w-2xl">
          <div className="bg-white rounded-3xl border border-slate-100 p-8 shadow-sm">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
              <Languages className="w-5 h-5 text-blue-500" /> 
              {t('settings.language')}
            </h3>
            <div>
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 mb-3 block">
                {t('settings.selectLanguage')}
              </Label>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <LanguageSwitcher />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

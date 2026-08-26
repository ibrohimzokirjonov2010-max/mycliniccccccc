import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  User, Globe, LogOut, 
  Building2, Users, Bell,
  Clock, CheckCircle2, ChevronDown, ChevronUp, Layout as LayoutIcon,
  Pencil, Trash2, Key, Phone, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { notificationStore } from '@/lib/notificationStore';

export default function MobileSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ full_name: '', role: 'Stomatolog', commission: 40, password: '', phone: '' });
  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({
    name: '',
    specialty: 'Stomatolog',
    commission_rate: 40,
    username: '',
    password: '',
    phone: ''
  });
  const [savingStaff, setSavingStaff] = useState(false);
  const [showWorkingHours, setShowWorkingHours] = useState(false);
  const [clinicData, setClinicData] = useState({
    name: 'My Clinic',
    phone: '',
    working_hours: {
      monday: { active: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      tuesday: { active: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      wednesday: { active: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      thursday: { active: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      friday: { active: true, start: '09:00', end: '18:00', break_start: '13:00', break_end: '14:00' },
      saturday: { active: true, start: '09:00', end: '15:00', break_start: '00:00', break_end: '00:00' },
      sunday: { active: false, start: '00:00', end: '00:00', break_start: '00:00', break_end: '00:00' }
    }
  });

  const load = async () => {
    try {
      const userName = localStorage.getItem('user_name') || 'Admin';
      const clinicId = localStorage.getItem('clinic_id') || 'default';
      setUser({ 
        full_name: userName, 
        email: `${userName}@${clinicId}.clinic`,
        role: 'admin'
      });
      
      const currentClinic = await base44.clinic.getCurrentClinic();
      if (currentClinic) {
        setClinicData({
          name: currentClinic.name || 'My Clinic',
          phone: currentClinic.phone || '',
          working_hours: currentClinic.working_hours || clinicData.working_hours
        });
      }

      const allUsers = await base44.entities.User.list('name', 50);
      setUsers(allUsers);
    } catch (error) {
      console.error('Settings load error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const DAYS = {
    monday: 'Dushanba',
    tuesday: 'Seshanba',
    wednesday: 'Chorshanba',
    thursday: 'Payshanba',
    friday: 'Juma',
    saturday: 'Shanba',
    sunday: 'Yakshanba'
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

  const updateWorkingHours = (day, field, value) => {
    setClinicData(prev => ({
      ...prev,
      working_hours: {
        ...prev.working_hours,
        [day]: {
          ...prev.working_hours[day],
          [field]: value
        }
      }
    }));
  };

  const addStaff = async () => {
    if (!newStaff.full_name.trim()) {
      toast.error('Ism kiriting!');
      return;
    }
    try {
      const cleanUsername = newStaff.full_name.toLowerCase().replace(/\s+/g, '.');
      await base44.entities.User.create({
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

  const handleOpenEditStaff = (staff) => {
    setEditingStaff(staff);
    setEditStaffForm({
      name: staff.name || staff.full_name || '',
      specialty: staff.specialty || staff.role || 'Stomatolog',
      commission_rate: staff.commission_rate ?? staff.commission ?? 40,
      username: staff.username || (staff.name || staff.full_name || '').toLowerCase().replace(/\s+/g, '.'),
      password: staff.password || '',
      phone: staff.phone || ''
    });
  };

  const handleSaveEditStaff = async (e) => {
    if (e) e.preventDefault();
    if (!editStaffForm.name.trim()) {
      toast.error('Ism kiriting!');
      return;
    }
    setSavingStaff(true);
    try {
      const cleanUsername = editStaffForm.username.trim().toLowerCase().replace(/\s+/g, '.') || editStaffForm.name.trim().toLowerCase().replace(/\s+/g, '.');
      const updatedData = {
        name: editStaffForm.name.trim(),
        full_name: editStaffForm.name.trim(),
        specialty: editStaffForm.specialty.trim() || 'Stomatolog',
        commission_rate: Number(editStaffForm.commission_rate || 0),
        username: cleanUsername,
        password: editStaffForm.password || 'doctor123',
        phone: editStaffForm.phone?.trim() || ''
      };

      await base44.auth.updateUser(editingStaff.id, updatedData);
      toast.success("Xodim ma'lumotlari muvaffaqiyatli yangilandi!");
      setEditingStaff(null);
      await load();
    } catch (error) {
      console.error('Update staff error:', error);
      toast.error('Xatolik yuz berdi: ' + (error.message || ''));
    } finally {
      setSavingStaff(false);
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
    const body = 'Bu namunaviy eslatma. Qabulga 20 daqiqa qolganida dokinga huddi shunday xabar chiqadi.';
    
    // Browser
    new Notification(title, { body });

    // Add to persistent store
    notificationStore.add({
      type: 'system',
      title: title,
      message: body
    });
    
    // Toast
    toast(body, {
      icon: '⏰',
      duration: 6000,
      position: 'top-center',
      style: {
        background: '#0f172a',
        color: '#fff',
        borderRadius: '1rem',
        padding: '1rem',
        fontWeight: 'bold'
      }
    });

    // Speak
    try {
      const utterance = new SpeechSynthesisUtterance("Sizda yangi eslatma mavjud");
      utterance.lang = 'uz-UZ';
      window.speechSynthesis.speak(utterance);
    } catch (e) {}
  };

  const handleLogout = () => {
    localStorage.removeItem('is_authenticated');
    localStorage.removeItem('user_name');
    localStorage.removeItem('clinic_id');
    window.location.href = '/login';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-xl font-bold">Sozlamalar</h1>
        <p className="text-sm text-slate-500">Tizim sozlamalari va boshqaruv</p>
      </div>

      <div className="p-4 space-y-4">
        {/* User Profile Card */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-4 shadow-sm border"
        >
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-lg">{user?.full_name}</h3>
              <p className="text-sm text-slate-500">{user?.email}</p>
              <span className="inline-block mt-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                Admin
              </span>
            </div>
          </div>
        </motion.div>

        {/* Language Settings */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-4 shadow-sm border"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-primary" />
              <div>
                <h3 className="font-semibold">Til / Язык / Language</h3>
                <p className="text-xs text-slate-500">Interfeys tilini tanlang</p>
              </div>
            </div>
            <LanguageSwitcher />
          </div>
        </motion.div>

        {/* SMS Sozlamalari */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="bg-white rounded-2xl shadow-sm border overflow-hidden"
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
                <h3 className="font-bold text-slate-800">SMS Sozlamalari</h3>
                <p className="text-xs text-slate-400">Avtomatik xabar yuborish sozlamalari</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full">Eskiz.com</span>
              <CheckCircle2 className="w-4 h-4 text-slate-300" />
            </div>
          </button>
          <div className="border-t border-slate-50">
            <button
              onClick={() => navigate('/sent-messages')}
              className="w-full flex items-center justify-between p-4 active:bg-slate-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Clock className="w-5 h-5 text-blue-500" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-slate-800">Yuborilgan xabarlar</h3>
                  <p className="text-xs text-slate-400">SMS va Telegram xabarlar tarixi</p>
                </div>
              </div>
              <CheckCircle2 className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </motion.div>

        {/* Notification Test */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-4 shadow-sm border"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Bildirishnomalar</h3>
            </div>
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
              Notification.permission === 'granted' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
            }`}>
              {Notification.permission === 'granted' ? 'Yoniq' : 'Ruxsat kerak'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-4">Qabulga 20 daqiqa qolganda dokinga eslatma kelishini tekshiring.</p>
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-slate-200 font-bold gap-2"
            onClick={testNotification}
          >
            Test xabarini yuborish
          </Button>
        </motion.div>

        {/* Professional Public Page Link */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="bg-white rounded-2xl p-4 shadow-sm border border-indigo-100"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <LayoutIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Professional sahifa</h3>
                <p className="text-xs text-slate-500">Bemorlar uchun online tashrif qog'ozi</p>
              </div>
            </div>
            <Button 
              size="sm" 
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700"
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
          className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <Building2 className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900">Klinika sozlamalari</h3>
            </div>
            <Button size="sm" onClick={saveClinicSettings} className="rounded-xl h-10 bg-emerald-600 hover:bg-emerald-700">
              Saqlash
            </Button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Klinika nomi</Label>
                <Input 
                  value={clinicData.name} 
                  onChange={e => setClinicData({...clinicData, name: e.target.value})}
                  className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-black text-slate-900 shadow-inner" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">Telefon</Label>
                <Input 
                  value={clinicData.phone} 
                  onChange={e => setClinicData({...clinicData, phone: e.target.value})}
                  placeholder="+998..." 
                  className="h-14 rounded-2xl border-none bg-slate-50 px-6 font-black text-slate-900 shadow-inner" 
                />
              </div>
            </div>

            {/* Working Hours Expandable */}
            <div className="mt-6 pt-6 border-t border-slate-50">
              <button 
                onClick={() => setShowWorkingHours(!showWorkingHours)}
                className="w-full flex items-center justify-between p-4 bg-slate-50 rounded-2xl active:scale-[0.98] transition-all"
              >
                <div className="flex items-center gap-3">
                   <Clock className="w-5 h-5 text-[#1499AD]" />
                   <div className="text-left">
                     <p className="text-sm font-black text-slate-900">Ish vaqti va tanaffus</p>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Haftalik grafik</p>
                   </div>
                </div>
                {showWorkingHours ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
              </button>

              {showWorkingHours && (
                <div className="mt-4 space-y-4 overflow-hidden">
                  {Object.entries(DAYS).map(([dayKey, dayName]) => {
                    const hours = clinicData.working_hours[dayKey];
                    return (
                      <div key={dayKey} className="bg-white rounded-2xl p-5 border border-slate-100 space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Switch 
                              checked={hours.active} 
                              onCheckedChange={(checked) => updateWorkingHours(dayKey, 'active', checked)}
                            />
                            <span className="font-black text-slate-900">{dayName}</span>
                          </div>
                          {hours.active && <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">Ish kuni</span>}
                        </div>

                        {hours.active && (
                          <motion.div 
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="grid grid-cols-2 gap-4 pt-2"
                          >
                            <div className="space-y-1.5">
                              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Boshlanish</Label>
                              <Input 
                                type="time" 
                                value={hours.start} 
                                onChange={e => updateWorkingHours(dayKey, 'start', e.target.value)}
                                className="h-12 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-xs shadow-inner"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Tugash</Label>
                              <Input 
                                type="time" 
                                value={hours.end} 
                                onChange={e => updateWorkingHours(dayKey, 'end', e.target.value)}
                                className="h-12 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-xs shadow-inner"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Tanaffus boshlanishi</Label>
                              <Input 
                                type="time" 
                                value={hours.break_start} 
                                onChange={e => updateWorkingHours(dayKey, 'break_start', e.target.value)}
                                className="h-12 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-xs shadow-inner"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-3">Tanaffus tugashi</Label>
                              <Input 
                                type="time" 
                                value={hours.break_end} 
                                onChange={e => updateWorkingHours(dayKey, 'break_end', e.target.value)}
                                className="h-12 rounded-xl border-none bg-slate-50 px-4 font-black text-slate-900 text-xs shadow-inner"
                              />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                  <Button onClick={saveClinicSettings} className="w-full h-14 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs tracking-[0.2em] shadow-xl mt-4">
                    GRAFIKNI SAQLASH
                  </Button>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Staff Management */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-4 shadow-sm border"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Xodimlar</h3>
            </div>
            <Button size="sm" onClick={() => setShowStaffForm(!showStaffForm)}>
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
                  className="flex-1 h-11 rounded-xl font-bold"
                >
                  Bekor qilish
                </Button>
                <Button 
                  onClick={addStaff} 
                  className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-bold"
                >
                  Saqlash
                </Button>
              </div>
            </motion.div>
          )}

          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100/80 transition-colors">
                <div className="flex-1 min-w-0 pr-2">
                  <p className="font-bold text-sm text-slate-900 truncate">{u.name || u.full_name}</p>
                  <p className="text-xs text-slate-500 truncate">{u.specialty || u.role || 'Shifokor'}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full">
                    {u.commission_rate ?? u.commission ?? 0}%
                  </span>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl"
                    onClick={() => handleOpenEditStaff(u)}
                    title="Tahrirlash"
                  >
                    <Pencil className="w-4 h-4 text-slate-600" />
                  </Button>
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

        {/* Logout Button */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Button 
            variant="destructive" 
            className="w-full h-12 rounded-2xl font-bold"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Chiqish
          </Button>
        </motion.div>
      </div>

      {/* ✏️ Xodim ma'lumotlarini tahrirlash dialogi */}
      <Dialog open={!!editingStaff} onOpenChange={(open) => { if (!open) setEditingStaff(null); }}>
        <DialogContent className="w-[92%] sm:max-w-md rounded-3xl p-6 bg-white border border-slate-100 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-11 h-11 bg-emerald-100 rounded-2xl flex items-center justify-center font-bold text-emerald-700 text-lg shadow-sm">
                {editStaffForm.name?.[0]?.toUpperCase() || 'D'}
              </div>
              <div>
                <DialogTitle className="text-base font-black text-slate-900 tracking-tight">
                  Xodimni tahrirlash
                </DialogTitle>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Ma'lumotlar, login va parolni yangilash
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveEditStaff} className="space-y-3.5 pt-2">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">
                To'liq ismi *
              </Label>
              <Input 
                placeholder="Dr. Alisher" 
                value={editStaffForm.name}
                onChange={e => setEditStaffForm({ ...editStaffForm, name: e.target.value })}
                className="h-11 rounded-xl border-slate-200 font-medium"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">
                  Lavozimi
                </Label>
                <Input 
                  placeholder="Stomatolog" 
                  value={editStaffForm.specialty}
                  onChange={e => setEditStaffForm({ ...editStaffForm, specialty: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 font-medium"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">
                  Ulush (%)
                </Label>
                <Input 
                  type="number"
                  placeholder="40" 
                  value={editStaffForm.commission_rate === 0 || editStaffForm.commission_rate === '' ? '' : editStaffForm.commission_rate}
                  onChange={e => {
                    const val = e.target.value;
                    setEditStaffForm({ ...editStaffForm, commission_rate: val === '' ? '' : Number(val) });
                  }}
                  className="h-11 rounded-xl border-slate-200 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">
                  Login
                </Label>
                <Input 
                  placeholder="dr_alisher" 
                  value={editStaffForm.username}
                  onChange={e => setEditStaffForm({ ...editStaffForm, username: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 font-mono text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">
                  Parol
                </Label>
                <Input 
                  type="text"
                  placeholder="Parol" 
                  value={editStaffForm.password}
                  onChange={e => setEditStaffForm({ ...editStaffForm, password: e.target.value })}
                  className="h-11 rounded-xl border-slate-200 font-mono text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-black text-slate-400 tracking-widest ml-1 block">
                Telefon raqami
              </Label>
              <Input 
                type="tel"
                placeholder="+998..." 
                value={editStaffForm.phone}
                onChange={e => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                className="h-11 rounded-xl border-slate-200 font-medium"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setEditingStaff(null)} 
                className="flex-1 h-11 rounded-xl font-bold"
              >
                Bekor qilish
              </Button>
              <Button 
                type="submit" 
                disabled={savingStaff} 
                className="flex-1 h-11 rounded-xl bg-slate-900 text-white font-bold"
              >
                {savingStaff ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

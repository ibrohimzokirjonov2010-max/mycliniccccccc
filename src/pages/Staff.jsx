import { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, Trash2, Shield, 
  Search, Filter,
  TrendingUp, Star, Pencil
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogTrigger, DialogFooter 
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useFeature } from '@/hooks/useFeature';

export default function Staff() {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const hasStaffAccess = useFeature('staff');
  const [newStaff, setNewStaff] = useState({ 
    full_name: '', 
    username: '',
    password: '',
    phone: '',
    specialty: 'Stomatolog',
    role: 'doctor', 
    commission: 30 
  });

  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    specialty: 'Stomatolog',
    role: 'doctor',
    commission: 30
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const allUsers = await base44.entities.User.list('name', 50);
      setUsers(allUsers || []);
    } catch (error) {
      console.error('Staff loading error:', error);
      toast.error(t('staff.addError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddStaff = async (e) => {
    e.preventDefault();
    
    if (!newStaff.full_name || !newStaff.username || !newStaff.password) {
      toast.error(t('staff.fillAll'));
      return;
    }

    try {
      const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
      const currentUsers = Array.isArray(users) ? users : [];
      
      // Limit removed to allow professional clinic management
      /* 
      if (newStaff.role === 'doctor') {
        const doctorCount = currentUsers.filter(u => u.role === 'doctor').length;
        if (doctorCount >= 2) {
          toast.error(t('staff.limitReach'));
          return;
        }
      }
      */

      const existing = currentUsers.find(u => 
        (u.username || '').toLowerCase() === newStaff.username.toLowerCase()
      );
      if (existing) {
        toast.error(t('staff.usernameTaken'));
        return;
      }

      const cleanUsername = newStaff.username.toLowerCase().replace(/\s+/g, '');

      await base44.auth.addUser({
        id: 'user-' + Math.random().toString(36).substring(2, 9),
        name: newStaff.full_name,
        username: cleanUsername,
        password: newStaff.password,
        phone: newStaff.phone,
        specialty: newStaff.specialty,
        role: newStaff.role,
        commission_rate: Number(newStaff.commission || 30),
        clinic_id: clinicId
      });

      toast.success(t('staff.addSuccessDetail'));
      setIsModalOpen(false);
      
      setCredentialsModal({
        name: newStaff.full_name,
        clinicId: clinicId,
        username: cleanUsername,
        password: newStaff.password
      });

      setNewStaff({ 
        full_name: '', 
        username: '',
        password: '',
        phone: '',
        specialty: 'Stomatolog',
        role: 'doctor', 
        commission: 30 
      });
      
      loadData();
    } catch (error) {
      console.error('Add staff error:', error);
      toast.error(error.message || t('common.error'));
    }
  };

  const handleDeleteStaff = async (id, name) => {
    if (!confirm(t('staff.deleteConfirm', { name }))) return;
    
    try {
      await base44.auth.deleteUser(id);
      toast.success(t('staff.deleteSuccess'));
      loadData();
    } catch (error) {
      toast.error(t('common.error'));
    }
  };

  const handleOpenEditStaff = (user) => {
    setEditingStaff(user);
    setEditStaffForm({
      full_name: user.full_name || user.name || '',
      username: user.username || '',
      password: user.password || '',
      phone: user.phone || '',
      specialty: user.specialty || 'Stomatolog',
      role: user.role || 'doctor',
      commission: user.commission_rate ?? user.commission ?? 30
    });
    setIsEditModalOpen(true);
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!editStaffForm.full_name || !editStaffForm.username) {
      toast.error(t('staff.fillAll'));
      return;
    }

    try {
      const cleanUsername = editStaffForm.username.toLowerCase().replace(/\s+/g, '');
      const updatedData = {
        name: editStaffForm.full_name.trim(),
        full_name: editStaffForm.full_name.trim(),
        username: cleanUsername,
        password: editStaffForm.password,
        phone: editStaffForm.phone?.trim() || '',
        specialty: editStaffForm.specialty?.trim() || 'Stomatolog',
        role: editStaffForm.role || 'doctor',
        commission_rate: Number(editStaffForm.commission || 0)
      };

      await base44.auth.updateUser(editingStaff.id, updatedData);
      toast.success(t('settings.staff.doctorUpdated') || "Xodim ma'lumotlari muvaffaqiyatli yangilandi!");
      setIsEditModalOpen(false);
      setEditingStaff(null);
      loadData();
    } catch (error) {
      console.error('Update staff error:', error);
      toast.error(error.message || t('common.error'));
    }
  };

  const filteredUsers = users.filter(u => {
    const displayName = (u.full_name || u.name || '').toLowerCase();
    const searchLow = search.toLowerCase();
    return displayName.includes(searchLow) || (u.username || '').toLowerCase().includes(searchLow);
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600" />
            {t('staff.title')}
          </h1>
          <p className="text-slate-500 mt-0.5 uppercase font-bold tracking-widest text-[10px]">
            {t('staff.subtitle')}
          </p>
        </div>

        <Dialog open={isModalOpen} onOpenChange={(open) => {
          if (open && !hasStaffAccess) {
             toast.error('Ushbu amal uchun PRO ta\'rifi talab qilinadi. Super Admin bilan bog\'laning!');
             return;
          }
          setIsModalOpen(open);
        }}>
          <DialogTrigger asChild>
            <Button 
              className={`text-white shadow-lg rounded-xl px-5 transition-all active:scale-95 ${!hasStaffAccess ? 'bg-slate-400 hover:bg-slate-500 cursor-not-allowed opacity-80' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200'}`}
              onClick={(e) => {
                if (!hasStaffAccess) {
                  e.preventDefault();
                  toast.error('Yangi xodim qo\'shish uchun PRO ta\'rifiga o\'ting!');
                }
              }}
            >
              <UserPlus className="w-5 h-5 mr-2" />
              {t('staff.addNew')} {!hasStaffAccess && ' (PRO)'}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black tracking-tight">{t('staff.addNew')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStaff} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>{t('staff.full_name')}</Label>
                <Input 
                  placeholder="Dr. Alisher Toshmatov" 
                  value={newStaff.full_name}
                  onChange={e => setNewStaff({...newStaff, full_name: e.target.value})}
                  className="rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('staff.phone')}</Label>
                  <Input 
                    placeholder="+998 90 123 45 67" 
                    value={newStaff.phone}
                    onChange={e => setNewStaff({...newStaff, phone: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('staff.specialty')}</Label>
                  <Input 
                    placeholder="Ortodont" 
                    value={newStaff.specialty}
                    onChange={e => setNewStaff({...newStaff, specialty: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('staff.username')}</Label>
                  <Input 
                    placeholder="alisher_dr" 
                    value={newStaff.username}
                    onChange={e => setNewStaff({...newStaff, username: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('staff.password')}</Label>
                  <Input 
                    type="password"
                    placeholder="••••••" 
                    value={newStaff.password}
                    onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('staff.role')}</Label>
                  <select 
                    className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    value={newStaff.role}
                    onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                  >
                    <option value="doctor">{t('staff.roles.doctor')}</option>
                    <option value="admin">{t('staff.roles.admin')}</option>
                    <option value="receptionist">{t('staff.roles.receptionist')}</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>{t('staff.commission_rate')}</Label>
                  <Input 
                    type="number"
                    value={newStaff.commission}
                    onChange={e => setNewStaff({...newStaff, commission: e.target.value})}
                    onWheel={e => e.target.blur()}
                    className="rounded-xl"
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold uppercase tracking-widest transition-all">
                  {t('common.save')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={!!credentialsModal} onOpenChange={() => setCredentialsModal(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 text-center border-emerald-100">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 ring-8 ring-emerald-50">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900 mx-auto tracking-tight">{t('staff.addSuccess')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-slate-500 font-medium px-4">
              <strong className="text-slate-800">{credentialsModal?.name}</strong> {t('staff.addSuccessDetail')}. {t('staff.credentialsHint')}
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3 text-left">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">Klinika ID</span>
                <div className="font-mono text-lg font-bold text-blue-600 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm inline-block w-full">
                  {credentialsModal?.clinicId}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">{t('staff.username')}</span>
                <div className="font-mono text-lg font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm inline-block w-full">
                   {credentialsModal?.username}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">{t('staff.password')}</span>
                <div className="font-mono text-lg font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm inline-block w-full relative">
                  {credentialsModal?.password}
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 text-xs text-blue-600 bg-blue-50 py-2.5 rounded-xl px-4">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              {t('staff.loginHint')}
            </div>
          </div>
          <Button 
            onClick={() => setCredentialsModal(null)} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20"
          >
            {t('staff.understand')}
          </Button>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[
          { label: t('staff.stats.total'), value: users.length, icon: Users, color: 'emerald' },
          { label: t('staff.stats.doctors'), value: users.filter(u => u.role === 'doctor').length, icon: Shield, color: 'blue' },
          { label: t('staff.stats.admins'), value: users.filter(u => u.role === 'admin').length, icon: Star, color: 'amber' },
          { label: t('staff.stats.activity'), value: '98%', icon: TrendingUp, color: 'indigo' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-3 md:p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center text-center md:items-start md:text-left">
            <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl bg-${stat.color}-50 flex items-center justify-center mb-2 md:mb-3`}>
              <stat.icon className={`w-4 h-4 md:w-5 md:h-5 text-${stat.color}-600`} />
            </div>
            <p className="text-xl md:text-2xl font-black text-slate-900">{stat.value}</p>
            <p className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-slate-50 flex items-center justify-between gap-3 md:gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder={t('staff.searchHint')} 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-slate-50/50 border-none ring-0 w-full"
            />
          </div>
          <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0">
            <Filter className="w-4 h-4 text-slate-500" />
          </Button>
        </div>

        <div className="md:hidden divide-y divide-slate-50">
          <AnimatePresence>
            {filteredUsers.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(i, 6) * 0.02 }}
                className="p-4 space-y-3 content-visibility-auto"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase overflow-hidden">
                      {(user.avatar_url || user.photo || user.avatar || user.image) ? (
                        <img 
                          src={user.avatar_url || user.photo || user.avatar || user.image} 
                          alt={user.full_name || user.name} 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        (user.full_name || user.name || '?').charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{user.full_name || user.name || 'Nomsiz'}</p>
                      <p className="text-xs text-slate-500">@{user.username}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleOpenEditStaff(user)}
                      className="text-slate-400 hover:text-emerald-600 rounded-xl"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteStaff(user.id, user.full_name || user.name)}
                      className="text-slate-300 hover:text-red-500 rounded-xl"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="bg-slate-50/50 p-2 rounded-lg">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t('staff.role')}</p>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider inline-block ${
                      user.role === 'admin' 
                        ? 'bg-amber-50 text-amber-600' 
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {user.role === 'doctor' ? t('staff.roles.doctor') : user.role === 'admin' ? t('staff.roles.admin') : t('staff.roles.receptionist')}
                    </span>
                  </div>
                  <div className="bg-slate-50/50 p-2 rounded-lg text-right">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">{t('staff.commission')}</p>
                    <p className="text-xs font-black text-emerald-600">
                      {user.commission_rate || user.commission || 0}%
                    </p>
                  </div>
                </div>

                {user.specialty && (
                  <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-slate-50 px-2 py-1.5 rounded-lg w-fit">
                    <Shield className="w-3 h-3 text-emerald-500" />
                    <span className="font-medium">{user.specialty}</span>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 text-left">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('common.name')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('staff.role')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('staff.commission')}</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('staff.status')}</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence>
                {filteredUsers.map((user, i) => (
                  <motion.tr 
                    key={user.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i, 6) * 0.02 }}
                    className="group hover:bg-slate-50/30 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-500 uppercase overflow-hidden">
                          {(user.avatar_url || user.photo || user.avatar || user.image) ? (
                            <img 
                              src={user.avatar_url || user.photo || user.avatar || user.image} 
                              alt={user.full_name || user.name} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            (user.full_name || user.name || '?').charAt(0)
                          )}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{user.full_name || user.name || 'Nomsiz'}</p>
                          <div className="flex items-center gap-2">
                            <p className="text-xs text-slate-500">@{user.username}</p>
                            {user.specialty && (
                              <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                                {user.specialty}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.role === 'admin' 
                          ? 'bg-amber-50 text-amber-600 border border-amber-100' 
                          : 'bg-blue-50 text-blue-600 border border-blue-100'
                      }`}>
                         {user.role === 'doctor' ? t('staff.roles.doctor') : user.role === 'admin' ? t('staff.roles.admin') : t('staff.roles.receptionist')}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-black text-emerald-600">
                      {user.commission_rate || user.commission || 0}%
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-medium text-slate-700">{t('staff.active')}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleOpenEditStaff(user)}
                          className="text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteStaff(user.id, user.full_name || user.name)}
                          className="text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && !loading && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-500 font-medium italic">{t('staff.noStaff')}</p>
            </div>
          )}
        </div>
      </div>

      {/* ✏️ Xodim / Shifokor ma'lumotlarini tahrirlash dialogi */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center font-bold text-emerald-700 text-lg">
                {editStaffForm.full_name?.[0]?.toUpperCase() || 'D'}
              </div>
              <div>
                <DialogTitle className="text-xl font-black tracking-tight">
                  {t('settings.staff.editDoctor') || "Xodim ma'lumotlarini tahrirlash"}
                </DialogTitle>
                <p className="text-xs text-slate-500 font-medium">
                  {t('settings.staff.editDoctorSubtitle') || "Ma'lumotlar, login va parolni yangilash"}
                </p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={handleUpdateStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">{t('staff.full_name')} *</Label>
              <Input 
                placeholder="Dr. Alisher Toshmatov" 
                value={editStaffForm.full_name}
                onChange={e => setEditStaffForm({ ...editStaffForm, full_name: e.target.value })}
                className="rounded-xl h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.phone')}</Label>
                <Input 
                  placeholder="+998 90 123 45 67" 
                  value={editStaffForm.phone}
                  onChange={e => setEditStaffForm({ ...editStaffForm, phone: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.specialty')}</Label>
                <Input 
                  placeholder="Stomatolog" 
                  value={editStaffForm.specialty}
                  onChange={e => setEditStaffForm({ ...editStaffForm, specialty: e.target.value })}
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.username')} *</Label>
                <Input 
                  placeholder="alisher_dr" 
                  value={editStaffForm.username}
                  onChange={e => setEditStaffForm({ ...editStaffForm, username: e.target.value })}
                  className="rounded-xl h-11 font-mono text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.password')}</Label>
                <Input 
                  type="text"
                  placeholder="••••••" 
                  value={editStaffForm.password}
                  onChange={e => setEditStaffForm({ ...editStaffForm, password: e.target.value })}
                  className="rounded-xl h-11 font-mono text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.role')}</Label>
                <select 
                  className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                  value={editStaffForm.role}
                  onChange={e => setEditStaffForm({ ...editStaffForm, role: e.target.value })}
                >
                  <option value="doctor">{t('staff.roles.doctor')}</option>
                  <option value="admin">{t('staff.roles.admin')}</option>
                  <option value="receptionist">{t('staff.roles.receptionist')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.commission_rate')} (%)</Label>
                <Input 
                  type="number"
                  value={editStaffForm.commission}
                  onChange={e => setEditStaffForm({ ...editStaffForm, commission: e.target.value })}
                  onWheel={e => e.target.blur()}
                  className="rounded-xl h-11"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 flex gap-2 sm:justify-end">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEditModalOpen(false)}
                className="h-11 rounded-xl px-5 font-bold"
              >
                {t('common.cancel') || "Bekor qilish"}
              </Button>
              <Button 
                type="submit" 
                className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-6 font-bold uppercase tracking-widest shadow-md shadow-emerald-200"
              >
                {t('common.save') || "Saqlash"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

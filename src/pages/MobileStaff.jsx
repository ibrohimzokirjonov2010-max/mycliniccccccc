import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Phone, Shield, Search, 
  ChevronRight, Trash2, Plus, MessageCircle,
  UserPlus, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Premium SaaS Mobile Staff Management
 * Mimics the high-end Appointments view design
 */
export default function MobileStaff() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [newStaff, setNewStaff] = useState({ 
    full_name: '', 
    username: '',
    password: '',
    phone: '',
    specialty: 'Stomatolog',
    role: 'doctor', 
    commission: 30 
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const allUsers = await base44.entities.User.list('name', 50);
      setUsers(allUsers || []);
    } catch (error) {
      console.error('Staff loading error:', error);
      toast.error('Xodimlarni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddStaff = async (e) => {
    if (e) e.preventDefault();
    
    if (!newStaff.full_name || !newStaff.username || !newStaff.password) {
      toast.error("Iltimos barcha maydonlarni to'ldiring");
      return;
    }

    try {
      const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
      const cleanUsername = newStaff.username.toLowerCase().replace(/\s+/g, '');

      // Check if username exists
      const existing = users.find(u => (u.username || '').toLowerCase() === cleanUsername);
      if (existing) {
        toast.error("Ushbu foydalanuvchi nomi band");
        return;
      }

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

      toast.success("Xodim muvaffaqiyatli qo'shildi");
      setShowAddModal(false);
      
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
      toast.error(error.message || "Saqlashda xatolik yuz berdi");
    }
  };

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredUsers = users.filter(u => 
    (u.name || u.full_name)?.toLowerCase().includes(search.toLowerCase()) || 
    u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const getInitials = (name) => {
    return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  };

  const getAvatarGradient = (role) => {
    switch(role) {
      case 'doctor': return 'from-blue-500 to-indigo-600';
      case 'admin': return 'from-amber-500 to-orange-600';
      default: return 'from-emerald-500 to-teal-600';
    }
  };

  const handleDeleteStaff = async (id, name) => {
    if (!confirm(`${name}ni o'chirishni tasdiqlaysizmi?`)) return;
    try {
      await base44.entities.User.delete(id);
      toast.success('Xodim o\'chirildi');
      loadData();
    } catch (error) {
      toast.error('O\'chirishda xatolik yuz berdi');
    }
  };

  // Stats for the 4-column grid
  const stats = {
    total: users.length,
    doctors: users.filter(u => u.role === 'doctor').length,
    admins: users.filter(u => u.role === 'admin').length,
    active: '98%'
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-slate-50 pb-20">
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Xodimlar</h1>
              <p className="text-sm text-slate-500 mt-0.5">Klinika jamoasini boshqarish</p>
            </div>
            <Button 
              onClick={() => setShowAddModal(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl px-5 h-11 shadow-lg shadow-slate-200"
            >
              <Plus className="w-5 h-5 mr-1.5" />
              Yangi
            </Button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-5 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <Input 
              placeholder="Ism yoki foydalanuvchi nomi..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-11 h-11 rounded-xl bg-slate-100 border-none focus:ring-2 focus:ring-slate-200 font-medium"
            />
          </div>

          {/* Stats Grid - Matching MobileAppointmentsV2 style */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">Jami</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <p className="text-xl font-bold text-blue-700">{stats.doctors}</p>
              <p className="text-[10px] font-medium text-blue-600 uppercase">Shifokor</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
              <p className="text-xl font-bold text-amber-700">{stats.admins}</p>
              <p className="text-[10px] font-medium text-amber-600 uppercase">Admin</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
              <p className="text-xl font-bold text-emerald-700">{stats.active}</p>
              <p className="text-[10px] font-medium text-emerald-600 uppercase">Faollik</p>
            </div>
          </div>
        </div>

        {/* Staff List */}
        <div className="p-4">
          {loading ? (
             [1, 2, 3, 4].map(i => (
               <div key={i} className="bg-white rounded-2xl p-3 h-16 animate-pulse mb-2 shadow-sm" />
             ))
          ) : filteredUsers.length > 0 ? (
            <AnimatePresence>
              {filteredUsers.map((user, index) => (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(index, 6) * 0.02 }}
                  onClick={() => navigate(`/staff/${user.id}`)}
                  className="bg-white rounded-2xl p-3 mb-2 shadow-[0_2px_10px_rgba(0,0,0,0.02)] border border-slate-50 flex items-center gap-3 relative active:scale-[0.98] transition-all group content-visibility-auto"
                >
                  {/* Left: Mini Avatar */}
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(user.role)} flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0`}>
                    {getInitials(user.name || user.full_name)}
                  </div>

                  {/* Middle: Info */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-2">
                       <h3 className="font-bold text-[14px] text-slate-800 truncate leading-tight">
                         {user.name || user.full_name}
                       </h3>
                       {user.role === 'admin' && (
                         <div className="px-1.5 py-0.5 rounded-md bg-amber-50 text-[8px] font-black text-amber-600 uppercase">Admin</div>
                       )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[11px] font-bold text-slate-400">@{user.username}</p>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <p className="text-[11px] font-bold text-[#1499AD] capitalize">{user.role}</p>
                    </div>
                  </div>

                  {/* Right: Quick Action Icons */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (user.phone) window.open(`tel:${user.phone}`, '_self');
                        else toast.error("Raqam yo'q");
                      }}
                      className="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center active:scale-90 transition-all border border-emerald-100/50"
                    >
                      <Phone className="w-4 h-4 fill-emerald-100" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const phone = user.phone?.replace(/\D/g, '');
                        if (phone) window.open(`https://t.me/+${phone}`, '_blank');
                        else toast.error("Raqam kiritilmagan");
                      }}
                      className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center active:scale-90 transition-all border border-blue-100/50"
                    >
                      <MessageCircle className="w-4 h-4 fill-blue-100" />
                    </button>

                    <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-200 ml-1">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  {/* Trash for admin/delete flow */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteStaff(user.id, user.name || user.full_name);
                    }}
                    className="absolute -right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-rose-50 text-rose-500 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 group-hover:right-1 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-20 bg-slate-50">
              <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto mb-5 shadow-sm">
                <Users className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-600 font-black text-lg tracking-tight">Xodimlar topilmadi</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">Qidiruv parametrini o'zgartiring</p>
            </div>
          )}
        </div>

        {/* Add Staff Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className="w-[95vw] sm:max-w-lg max-h-[90vh] p-0 rounded-[2.5rem] border-0 shadow-2xl bg-white/95 backdrop-blur-xl flex flex-col overflow-visible">
            
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-[2.5rem]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                  <UserPlus className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black text-white uppercase tracking-tight">
                    Yangi xodim qo'shish
                  </DialogTitle>
                  <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-0.5">Xodim ma'lumotlari</p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="space-y-4 p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase text-slate-400 ml-1">F.I.O</p>
                <Input 
                  placeholder="Dr. Alisher Toshmatov" 
                  value={newStaff.full_name}
                  onChange={e => setNewStaff({...newStaff, full_name: e.target.value})}
                  className="rounded-2xl bg-slate-50 border-none h-12 font-bold"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Telefon</p>
                  <Input 
                    placeholder="+998..." 
                    value={newStaff.phone}
                    onChange={e => setNewStaff({...newStaff, phone: e.target.value})}
                    className="rounded-2xl bg-slate-50 border-none h-12 font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Mutaxassislik</p>
                  <Input 
                    placeholder="Ortodont" 
                    value={newStaff.specialty}
                    onChange={e => setNewStaff({...newStaff, specialty: e.target.value})}
                    className="rounded-2xl bg-slate-50 border-none h-12 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Username</p>
                  <Input 
                    placeholder="login" 
                    value={newStaff.username}
                    onChange={e => setNewStaff({...newStaff, username: e.target.value})}
                    className="rounded-2xl bg-slate-50 border-none h-12 font-bold"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Parol</p>
                  <Input 
                    type="password"
                    placeholder="••••••" 
                    value={newStaff.password}
                    onChange={e => setNewStaff({...newStaff, password: e.target.value})}
                    className="rounded-2xl bg-slate-50 border-none h-12 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Lavozim</p>
                  <select 
                    className="flex h-12 w-full rounded-2xl bg-slate-50 border-none px-3 py-2 text-sm font-bold"
                    value={newStaff.role}
                    onChange={e => setNewStaff({...newStaff, role: e.target.value})}
                  >
                    <option value="doctor">Shifokor</option>
                    <option value="admin">Admin</option>
                    <option value="receptionist">Registratura</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black uppercase text-slate-400 ml-1">Ulush (%)</p>
                  <Input 
                    type="number"
                    value={newStaff.commission}
                    onChange={e => setNewStaff({...newStaff, commission: Number(e.target.value)})}
                    className="rounded-2xl bg-slate-50 border-none h-12 font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 p-6 border-t border-slate-100 bg-slate-50 rounded-b-[2.5rem] shrink-0">
              <Button variant="ghost" onClick={() => setShowAddModal(false)} className="flex-1 h-12 rounded-2xl font-bold uppercase text-[10px]">Bekor</Button>
              <Button onClick={handleAddStaff} className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white h-12 rounded-2xl font-bold uppercase text-[10px] shadow-md shadow-emerald-500/10 border-none transition-all active:scale-95">Saqlash</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Credentials View Modal (After success) */}
        <Dialog open={!!credentialsModal} onOpenChange={() => setCredentialsModal(null)}>
          <DialogContent className="w-[90%] rounded-[2.5rem] p-6 text-center">
            <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
              <Shield className="w-7 h-7 text-emerald-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-slate-900 mx-auto">Xodim qo'shildi!</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 space-y-3 text-left">
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Klinika ID</span>
                  <div className="font-mono text-base font-bold text-blue-600 bg-white px-3 py-2 rounded-xl border border-slate-100 w-full">{credentialsModal?.clinicId}</div>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Username</span>
                  <div className="font-mono text-base font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-100 w-full">{credentialsModal?.username}</div>
                </div>
                <div>
                  <span className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Parol</span>
                  <div className="font-mono text-base font-bold text-slate-800 bg-white px-3 py-2 rounded-xl border border-slate-100 w-full">{credentialsModal?.password}</div>
                </div>
              </div>
            </div>
            <Button onClick={() => setCredentialsModal(null)} className="w-full bg-slate-900 text-white rounded-2xl h-12 font-bold uppercase text-[10px]">Tushunarli</Button>
          </DialogContent>
        </Dialog>

        <div className="px-5 mt-5">
          <p className="text-[10px] text-slate-400 font-bold text-center uppercase tracking-[0.2em]">
            Professional Dental Management System v2.0
          </p>
        </div>
      </div>
    </PullToRefresh>
  );
}

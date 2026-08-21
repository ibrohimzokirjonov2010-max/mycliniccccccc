import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plus, Trash2, Edit2, ShieldCheck,
  Search, 
  Key, CalendarDays, Lock, User, UserPlus, ArrowRight, Loader2, LogOut,
  TrendingUp, Users, CreditCard, AlertCircle, Sparkles, Zap,
  Image as ImageIcon, Link as LinkIcon, Clock, BarChart3, Eye, MousePointer, Upload, X
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  getAllAds, 
  saveAd, 
  deleteAd, 
  getAdStats 
} from '@/utils/adManager';
import { uploadImage, formatFileSize } from '@/utils/imageUpload';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';

const SUPER_ADMIN = { username: 'admin', password: 'admin123' };

// Animated Background Component
const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none">
    {[...Array(15)].map((_, i) => (
      <motion.div
        key={i}
        className="absolute w-1 h-1 bg-white/20 rounded-full"
        initial={{ x: Math.random() * 100 + '%', y: Math.random() * 100 + '%' }}
        animate={{ y: [null, '-20%', '20%'], opacity: [0.2, 0.6, 0.2] }}
        transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay: Math.random() * 2 }}
      />
    ))}
    <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-indigo-600/10 blur-[150px]" />
    <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-cyan-600/10 blur-[150px]" />
  </div>
);

// Enhanced Stat Card
const EnhancedStatCard = ({ icon, title, value, subtitle, trend, trendUp, alert, color, delay }) => {
  const colors = { 
    indigo: 'from-indigo-600 to-indigo-400', 
    emerald: 'from-emerald-600 to-emerald-400', 
    amber: 'from-amber-600 to-amber-400', 
    cyan: 'from-cyan-600 to-cyan-400' 
  };
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ delay, duration: 0.5 }}
      className="group relative overflow-hidden rounded-3xl bg-white/[0.03] border border-white/[0.08] p-6 hover:bg-white/[0.05] transition-all hover:border-white/[0.15] hover:shadow-2xl hover:shadow-indigo-500/10"
    >
      <div className="absolute top-0 right-0 -mr-6 -mt-6 w-24 h-24 bg-current opacity-[0.03] blur-3xl group-hover:opacity-[0.07] transition-opacity" />
      <div className="relative z-10 text-slate-100">
        <div className="flex items-start justify-between mb-5">
          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${colors[color]} flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform duration-300`}>
            <div className="text-white drop-shadow-md">{icon}</div>
          </div>
          <div className="flex flex-col items-end gap-2">
            {trend && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black tracking-tight ${trendUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingUp className="w-3 h-3 rotate-180" />}
                {trend}
              </div>
            )}
            {alert && <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.5)]" />}
          </div>
        </div>
        <div>
          <p className="text-3xl font-black text-white tracking-tight">{value}</p>
          <p className="text-[10px] font-black text-slate-500 uppercase mt-1.5 tracking-widest">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-400/80 mt-1.5 font-medium">{subtitle}</p>}
        </div>
      </div>
    </motion.div>
  );
};

// Skeleton Loader Component
const SkeletonRow = () => (
  <div className="flex items-center gap-4 px-6 py-5 border-b border-white/[0.04]">
    <div className="w-12 h-12 rounded-2xl bg-white/[0.05] animate-pulse" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-32 bg-white/[0.05] rounded animate-pulse" />
      <div className="h-3 w-48 bg-white/[0.05] rounded animate-pulse" />
    </div>
    <div className="h-4 w-24 bg-white/[0.05] rounded animate-pulse" />
    <div className="h-4 w-20 bg-white/[0.05] rounded animate-pulse" />
    <div className="h-4 w-28 bg-white/[0.05] rounded animate-pulse" />
  </div>
);

const ChartCard = ({ title, data, color }) => {
  const colors = {
    indigo: { stroke: '#6366f1', fill: 'rgba(99, 102, 241, 0.1)' },
    cyan: { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.1)' }
  };
  const activeColor = colors[color] || colors.indigo;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full lg:col-span-2 bg-white/[0.03] border border-white/[0.08] rounded-[2rem] p-8"
    >
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight">{title}</h3>
          <p className="text-xs text-slate-500 font-bold uppercase mt-1 tracking-widest">Oxirgi 6 oylik dinamika</p>
        </div>
        <div className="p-2 bg-white/[0.05] border border-white/[0.08] rounded-xl">
          <TrendingUp className={`w-5 h-5 text-${color}-400`} />
        </div>
      </div>
      <div className="h-[240px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id={`color${color}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={activeColor.stroke} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={activeColor.stroke} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
            <XAxis 
              dataKey="name" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
              dy={10}
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#0f0f16', 
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '16px',
                fontSize: '12px',
                boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
              }}
              itemStyle={{ color: '#fff', fontWeight: 700 }}
              cursor={{ stroke: 'white', strokeOpacity: 0.1 }}
            />
            <Area 
              type="monotone" 
              dataKey="value" 
              stroke={activeColor.stroke} 
              strokeWidth={4}
              fillOpacity={1} 
              fill={`url(#color${color})`} 
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default function SuperAdmin() {
  const { t } = useTranslation();
  const [clinics, setClinics] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingClinic, setEditClinic] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedClinicId, setSelectedClinicId] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);
  
  // Advertisement Management State
  const [activeTab, setActiveTab] = useState('clinics'); // 'clinics' or 'ads'
  const [ads, setAds] = useState([]);
  const [adModalOpen, setAdModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [adForm, setAdForm] = useState({
    title: '',
    description: '',
    image_url: '',
    link_url: '',
    cta_text: 'Batafsil',
    start_time: '08:00',
    end_time: '22:00',
    enabled: true
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  
  const [form, setForm] = useState({ 
    id: '', name: '', password: '', 
    monthly_fee: 189000, plan: 'pro', status: 'Active', 
    expires_at: '', last_payment_date: '',
    admin_username: '', admin_password: '', admin_name: ''
  });
  const [userForm, setUserForm] = useState({ clinic_id: '', username: '', password: '', name: '', role: 'doctor' });

  useEffect(() => {
    const auth = localStorage.getItem('admin_auth');
    if (auth) {
      try {
        const adminData = JSON.parse(auth);
        if (adminData.isAdmin) { 
          setIsLoggedIn(true); 
          loadClinics(); 
        } else { 
          setLoading(false); 
        }
      } catch (e) {
        localStorage.removeItem('admin_auth');
        setLoading(false);
      }
    } else { 
      setLoading(false); 
    }
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setTimeout(() => {
      if (loginForm.username === SUPER_ADMIN.username && loginForm.password === SUPER_ADMIN.password) {
        const adminUser = {
          id: 'admin-1',
          username: SUPER_ADMIN.username,
          name: 'Administrator',
          role: 'admin'
        };
        localStorage.setItem('admin_auth', JSON.stringify({
          isAdmin: true,
          user: adminUser
        }));
        setIsLoggedIn(true);
        toast.success(t('superAdmin.welcome'));
        loadClinics();
      } else { toast.error(t('login.invalidCredentials')); }
      setLoginLoading(false);
    }, 800);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    setIsLoggedIn(false);
    setLoginForm({ username: '', password: '' });
    toast.info(t('common.logout'));
  };

  const loadClinics = async () => {
    setLoading(true);
    try {
      const data = await base44.clinic.getAll();
      
      // Professional Data consistency check (Migration)
      // Narxiga qarab tarifni to'g'irlash
      let hasChanges = false;
      const fixedData = data.map(c => {
        const fee = Number(c.monthly_fee);
        let correctPlan = c.plan;
        
        if (fee === 99000 && c.plan !== 'basic') {
          correctPlan = 'basic';
          hasChanges = true;
        } else if (fee === 189000 && c.plan !== 'pro') {
          correctPlan = 'pro';
          hasChanges = true;
        }
        
        return { ...c, plan: correctPlan };
      });

      if (hasChanges) {
        console.log('🔄 Data inconsistency fixed: plans synced with fees');
        await base44.clinic.saveAll(fixedData);
        setClinics(fixedData);
      } else {
        setClinics(data);
      }

      const allUsers = await base44.auth.getAllUsers();
      setUsers(allUsers);
      // Load advertisements
      const allAds = await getAllAds();
      setAds(allAds);
      
      // Group users by clinic internally for optimized access
      const usersByClinic = {};
      allUsers.forEach(u => {
        if (!usersByClinic[u.clinic_id]) {
          usersByClinic[u.clinic_id] = [];
        }
        usersByClinic[u.clinic_id].push({
          username: u.username,
          name: u.name,
          role: u.role
        });
      });
    } catch (error) {
      console.error('Error loading clinics:', error);
      toast.error('Klinikalarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  // User management functions
  const handleAddUser = (clinicId) => {
    setSelectedClinicId(clinicId);
    setUserForm({ clinic_id: clinicId, username: '', password: '', name: '', role: 'doctor' });
    setEditingUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserForm({ clinic_id: user.clinic_id, username: user.username, password: user.password, name: user.name, role: user.role });
    setUserModalOpen(true);
  };

  const handleDeleteUser = (userId) => {
    if (confirm('Foydalanuvchini o\'chirishni xohlaysizmi?')) {
      base44.auth.deleteUser(userId);
      setUsers(base44.auth.getAllUsers());
      toast.success('Foydalanuvchi o\'chirildi');
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password || !userForm.name) {
      toast.error('Barcha maydonlarni to\'ldiring');
      return;
    }
    
    try {
      if (editingUser) {
        await base44.auth.updateUser(editingUser.id, userForm);
        toast.success('Foydalanuvchi yangilandi');
      } else {
        // Check if username exists for this clinic
        const existingUser = users.find(u => u.clinic_id === userForm.clinic_id && u.username === userForm.username);
        if (existingUser) {
          toast.error('Bu login allaqachon mavjud!');
          return;
        }
        await base44.auth.addUser(userForm);
        toast.success('Yangi foydalanuvchi qo\'shildi');
        console.log('✅ New user added:', userForm);
      }
      
      // Refresh users list
      const updatedUsers = await base44.auth.getAllUsers();
      setUsers(updatedUsers);
      console.log('📊 Total users in system:', updatedUsers.length);
      
      setUserModalOpen(false);
      setUserForm({ clinic_id: '', username: '', password: '', name: '', role: 'doctor' });
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Foydalanuvchini saqlashda xatolik');
    }
  };

  const getClinicUsers = (clinicId) => {
    return users.filter(u => u.clinic_id === clinicId);
  };

  const filteredClinics = clinics.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()));

  const stats = useMemo(() => {
    let totalRevenue = 0;
    clinics.forEach(c => { if (c.status === 'Active') totalRevenue += Number(c.monthly_fee || 0); });
    
    // Mock growth data for charts (in a real app this would come from the database)
    const revenueData = [
      { name: 'Yan', value: totalRevenue * 0.7 },
      { name: 'Feb', value: totalRevenue * 0.75 },
      { name: 'Mar', value: totalRevenue * 0.82 },
      { name: 'Apr', value: totalRevenue * 0.88 },
      { name: 'May', value: totalRevenue * 0.95 },
      { name: 'Iyun', value: totalRevenue },
    ];

    const clinicGrowth = [
      { name: 'Yan', value: Math.round(clinics.length * 0.6) },
      { name: 'Feb', value: Math.round(clinics.length * 0.65) },
      { name: 'Mar', value: Math.round(clinics.length * 0.72) },
      { name: 'Apr', value: Math.round(clinics.length * 0.85) },
      { name: 'May', value: Math.round(clinics.length * 0.92) },
      { name: 'Iyun', value: clinics.length },
    ];

    return { 
      total: clinics.length, 
      active: clinics.filter(c => c.status === 'Active').length, 
      expiring: clinics.filter(c => { 
        const diff = (new Date(c.expires_at) - new Date()) / (1000 * 60 * 60 * 24); 
        return diff <= 15 && diff > 0; 
      }).length, 
      mrr: totalRevenue,
      revenueData,
      clinicGrowth
    };
  }, [clinics]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Robust validation
    if (!form.id || !form.name || !form.password) { 
      toast.error('Barcha maydonlarni to\'ldiring!'); 
      return; 
    }

    // ID validation (only letters, numbers, underscores)
    if (!/^[a-zA-Z0-9_]+$/.test(form.id)) {
      toast.error('ID faqat lotin harflari, sonlar va _ belgisidan iborat bo\'lishi shart!');
      return;
    }
    
    try {
      if (editingClinic) {
        // Update existing clinic
        const updatedClinic = { ...editingClinic, ...form };
        const newClinics = clinics.map(c => c.id === editingClinic.id ? updatedClinic : c);
        await base44.clinic.saveAll(newClinics);
        setClinics(newClinics);
        toast.success('✅ Klinika muvaffaqiyatli tahrirlandi');
      } else {
        // Create new clinic
        if (clinics.find(c => c.id === form.id)) { 
          toast.error('Bu ID bilan klinika allaqachon mavjud!'); 
          return; 
        }
        const newClinic = { 
          ...form, 
          status: form.status || 'Active',
          created_at: new Date().toISOString() 
        };

        // Prepare Admin Data
        const adminUsername = (form.admin_username || form.id).trim();
        const adminPassword = (form.admin_password || form.password).trim();
        const adminNameValue = form.admin_name || (form.name + ' Admin');

        try {
          // Creates clinic + admin user atomically (localStorage-first, Supabase as backup)
          await base44.clinic.createClinic(newClinic, {
            id: 'user-' + Math.random().toString(36).substring(2, 11),
            name: adminNameValue,
            username: adminUsername,
            password: adminPassword,
            clinic_id: form.id,
            role: 'admin',
            commission_rate: 0
          });
          
          console.log('🎉 Clinic + Admin created successfully!');
          console.log('📋 Login credentials:');
          console.log(`   Clinic ID: ${form.id}`);
          console.log(`   Username:  ${adminUsername}`);
          console.log(`   Password:  ${adminPassword}`);

          toast.success(`✅ '${newClinic.name}' yaratildi!\nLogin: ${adminUsername} | Parol: ${adminPassword}`);
        } catch (innerErr) {
          console.error('Clinic creation failed:', innerErr);
          toast.error(`❌ Xatolik: ${innerErr.message}`);
          return;
        }
      }
      setModalOpen(false);
      resetForm();
      // Reload fresh data to reflect changes
      await loadClinics();
    } catch (error) {
      console.error('Klinika saqlashda xatolik:', error);
      const errorMsg = error.message || 'Klinikani saqlab bo\'lmadi';
      toast.error(`❌ Xatolik: ${errorMsg}`);
    }
  };

  const handleDelete = (id) => {
    if (confirm('Haqiqatdan ham bu klinikani o\'chirib tashlamoqchimisiz?')) {
      const newClinics = clinics.filter(c => c.id !== id);
      base44.clinic.saveAll(newClinics);
      setClinics(newClinics);
      toast.success('Klinika o\'chirildi');
    }
  };

  const markAsPaid = (id) => {
    if (confirm('Bu oyni to\'langan deb belgilaysizmi?')) {
      const today = new Date().toISOString().split('T')[0];
      const newClinics = clinics.map(c => c.id === id ? { ...c, last_payment_date: today } : c);
      base44.clinic.saveAll(newClinics);
      setClinics(newClinics);
      toast.success('To\'lov qabul qilindi');
    }
  };

  const resetForm = (clinic = null) => {
    if (clinic) {
      setForm({ ...clinic, password: clinic.password || '', plan: clinic.plan || 'pro' });
    } else {
      setForm({
        id: '', name: '', password: '', 
        monthly_fee: 189000, plan: 'pro', status: 'Active', 
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        last_payment_date: new Date().toISOString().split('T')[0]
      });
    }
    setEditClinic(clinic);
  };

  const isPaymentOverdue = (lastPaymentStr) => {
    if (!lastPaymentStr) return true;
    const lastPayment = new Date(lastPaymentStr);
    const today = new Date();
    return Math.ceil(Math.abs(today - lastPayment) / (1000 * 60 * 60 * 24)) > 30;
  };

  const getTimeRemaining = (expiryDateStr) => {
    if (!expiryDateStr) return { text: 'Noma\'lum', color: 'text-slate-500' };
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Muddati tugagan', color: 'text-rose-500' };
    if (diffDays === 0) return { text: 'Bugun tugaydi', color: 'text-amber-500 font-bold animate-pulse' };
    if (diffDays === 1) return { text: '1 kun qoldi', color: 'text-amber-500 font-bold' };
    if (diffDays <= 7) return { text: `${diffDays} kun qoldi`, color: 'text-amber-400 font-bold' };
    if (diffDays <= 30) return { text: `${diffDays} kun qoldi`, color: 'text-blue-400' };
    
    const months = Math.floor(diffDays / 30);
    if (months > 0) {
      const remainingDays = diffDays % 30;
      return { 
        text: `${months} oy${remainingDays > 0 ? ` ${remainingDays} kun` : ''} qoldi`, 
        color: 'text-emerald-400/80' 
      };
    }
    
    return { text: `${diffDays} kun qoldi`, color: 'text-emerald-400/80' };
  };

  // Advertisement Management Functions
  const handleAddAd = () => {
    setEditingAd(null);
    setAdForm({
      title: '',
      description: '',
      image_url: '',
      link_url: '',
      cta_text: 'Batafsil',
      start_time: '08:00',
      end_time: '22:00',
      enabled: true
    });
    setAdModalOpen(true);
  };

  const handleEditAd = (ad) => {
    setEditingAd(ad);
    setAdForm({
      title: ad.title || '',
      description: ad.description || '',
      image_url: ad.image_url || '',
      link_url: ad.link_url || '',
      cta_text: ad.cta_text || 'Batafsil',
      start_time: ad.start_time || '08:00',
      end_time: ad.end_time || '22:00',
      enabled: ad.enabled !== false
    });
    setAdModalOpen(true);
  };

  const handleDeleteAd = async (adId) => {
    if (confirm('Reklamani o\'chirishni xohlaysizmi?')) {
      await deleteAd(adId);
      setAds(await getAllAds());
      toast.success('Reklama o\'chirildi');
    }
  };

  const handleAdSubmit = async (e) => {
    e.preventDefault();
    if (!adForm.title) {
      toast.error('Reklama sarlavhasini kiriting');
      return;
    }
    
    try {
      if (editingAd) {
        await saveAd({ ...adForm, id: editingAd.id });
        toast.success('Reklama yangilandi');
      } else {
        await saveAd(adForm);
        toast.success('Yangi reklama qo\'shildi');
      }
      
      const updatedAds = await getAllAds();
      setAds(updatedAds);
      setAdModalOpen(false);
      setEditingAd(null);
    } catch (error) {
      console.error('Ad save error:', error);
      toast.error('Reklamani saqlashda xatolik');
    }
  };

  const toggleAdStatus = async (ad) => {
    try {
      await saveAd({ ...ad, enabled: !ad.enabled, id: ad.id });
      setAds(await getAllAds());
      toast.success(ad.enabled ? 'Reklama o\'chirildi' : 'Reklama yoqildi');
    } catch (error) {
      toast.error('Statusni o\'zgartirishda xatolik');
    }
  };

  // Stats calculated from state
  const adStats = useMemo(() => {
    const totalAds = ads.length;
    const activeAds = ads.filter(a => a.enabled).length;
    const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
    const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
    return { 
      totalAds, 
      activeAds, 
      inactiveAds: totalAds - activeAds, 
      totalImpressions, 
      totalClicks, 
      ctr 
    };
  }, [ads]);

  // Image Upload Handler
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    setSelectedFile(file);

    try {
      const result = await uploadImage(file, {
        maxSizeMB: 5,
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.7
      });

      if (result.success) {
        setAdForm({ ...adForm, image_url: result.data });
        toast.success('Rasm muvaffaqiyatli yuklandi');
      } else {
        toast.error(result.error);
        setSelectedFile(null);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Rasm yuklashda xatolik yuz berdi');
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = () => {
    setAdForm({ ...adForm, image_url: '' });
    setSelectedFile(null);
    // Reset file input
    const fileInput = document.getElementById('ad-image-upload');
    if (fileInput) fileInput.value = '';
  };

  // Login Page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#050508] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        {/* Cinematic Background */}
        <div className="fixed inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/20 blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-cyan-600/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[460px]"
        >
          {/* Glass Card */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 rounded-[2.5rem] blur opacity-20 group-hover:opacity-30 transition duration-1000 group-hover:duration-200" />
            <div className="relative bg-[#0d0d12]/90 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] overflow-hidden">
              
              {/* Internal Glow */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />

              <div className="text-center mb-10">
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }} 
                  animate={{ scale: 1, opacity: 1 }} 
                  transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
                  className="relative w-24 h-24 mx-auto mb-8"
                >
                  <div className="absolute inset-0 bg-indigo-500 rounded-3xl blur-2xl opacity-20 animate-pulse" />
                  <div className="relative w-full h-full bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-500 rounded-[1.5rem] flex items-center justify-center shadow-2xl border border-white/20">
                    <ShieldCheck className="w-12 h-12 text-white drop-shadow-lg" />
                  </div>
                </motion.div>
                
                <motion.h1 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: 0.4 }}
                  className="text-4xl font-black text-white mb-3 tracking-tighter"
                >
                  NexusOS<span className="text-indigo-500">.</span>
                </motion.h1>
                <motion.p 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: 0.5 }}
                  className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.3em]"
                >
                  Super Admin Gateway
                </motion.p>
              </div>

              <form onSubmit={handleLogin} className="space-y-6">
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">{t('common.username')}</Label>
                  <div className="relative group/input">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                    <Input 
                      value={loginForm.username} 
                      onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                      placeholder="admin" 
                      className="h-14 pl-12 bg-white/[0.03] border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-700" 
                    />
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }} className="space-y-2">
                  <Label className="text-[10px] font-black text-slate-500 uppercase ml-2 tracking-widest">{t('common.password')}</Label>
                  <div className="relative group/input">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within/input:text-indigo-400 transition-colors" />
                    <Input 
                      type="password" 
                      value={loginForm.password} 
                      onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                      placeholder="••••••••" 
                      className="h-14 pl-12 bg-white/[0.03] border-white/10 rounded-2xl text-white focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-700" 
                    />
                  </div>
                </motion.div>

                <motion.div 
                  initial={{ opacity: 0, y: 10 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: 0.8 }}
                  className="pt-4"
                >
                  <Button 
                    type="submit" 
                    disabled={loginLoading} 
                    className="group w-full h-15 bg-white text-black hover:bg-indigo-50 rounded-2xl font-black uppercase tracking-widest shadow-xl transition-all active:scale-[0.98] overflow-hidden relative"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-cyan-500 opacity-0 group-hover:opacity-10 transition-opacity" />
                    {loginLoading ? (
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                    ) : (
                      <span className="flex items-center justify-center gap-3">
                        {t('login.loginButton')} 
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    )}
                  </Button>
                </motion.div>
              </form>

              <motion.div 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                transition={{ delay: 1 }}
                className="mt-10 pt-8 border-t border-white/5"
              >
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">System Secure</span>
                  </div>
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">NexusOS v2.4</span>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-[#0a0a0f] font-sans text-slate-200">
      <AnimatedBackground />
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{ backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`, backgroundSize: '50px 50px' }} />
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="sticky top-0 z-50 bg-[#0a0a0f]/80 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-10">
          <div className="flex items-center justify-between h-16 md:h-20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white">{t('superAdmin.title')}</h1>
                <p className="text-[10px] text-slate-500 font-bold uppercase">{t('superAdmin.subtitle')}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.06]">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-slate-400">{t('common.active')}</span>
              </div>
              <Button 
                onClick={() => {
                  console.log('\n========== ALL USERS IN SYSTEM ==========');
                  console.log('🏢 Total Clinics:', clinics.length);
                  console.log('🏢 Clinics:', clinics.map(c => `${c.id} (${c.name})`));
                  console.log('📊 Total Users:', users.length);
                  console.log('\n👥 User List:');
                  users.forEach((u, i) => {
                    console.log(`${i + 1}. [${u.clinic_id}] ${u.username} - ${u.name} (${u.role})`);
                  });
                  console.log('\n=========================================\n');
                  alert(`Jami klinikalar: ${clinics.length}\nJami foydalanuvchilar: ${users.length}\n\nTo'liq ro'yxat uchun browser console ni oching (F12)`);
                }}
                variant="ghost" 
                size="sm" 
                className="text-slate-400 hover:text-blue-400"
              >
                <Users className="w-4 h-4 mr-2" />
                Foydalanuvchilar
              </Button>
              <Button onClick={handleLogout} variant="ghost" size="sm" className="text-slate-400 hover:text-rose-400"><LogOut className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </motion.header>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-10 py-6 md:py-10">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 mb-4">
                <Zap className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[10px] font-bold text-indigo-300 uppercase">{t('superAdmin.title')}</span>
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white">{t('superAdmin.title')}</h2>
              <p className="text-sm text-slate-400 mt-2">{t('superAdmin.subtitle')}</p>
            </div>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>
              {activeTab === 'clinics' ? (
                <Button onClick={() => { resetForm(); setModalOpen(true); }} className="bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 text-white rounded-xl px-6 h-12 font-bold shadow-lg hover:scale-[1.02] transition-all">
                  <Plus className="w-5 h-5 mr-2" /> {t('superAdmin.addClinic')}
                </Button>
              ) : (
                <Button onClick={handleAddAd} className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl px-6 h-12 font-bold shadow-lg hover:scale-[1.02] transition-all">
                  <Plus className="w-5 h-5 mr-2" /> Reklama Qo'shish
                </Button>
              )}
            </motion.div>
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex gap-2 p-1 bg-white/[0.03] border border-white/[0.06] rounded-xl w-fit">
            <button
              onClick={() => setActiveTab('clinics')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'clinics'
                  ? 'bg-gradient-to-r from-indigo-500 to-cyan-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Klinikalar
              </span>
            </button>
            <button
              onClick={() => setActiveTab('ads')}
              className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                activeTab === 'ads'
                  ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Reklamalar
              </span>
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 mb-8">
          <EnhancedStatCard icon={<Building2 className="w-5 h-5" />} title={t('superAdmin.totalClinics')} value={stats.total} trend="+12%" trendUp={true} color="indigo" delay={0.1} />
          <EnhancedStatCard icon={<Users className="w-5 h-5" />} title={t('superAdmin.activeClinics')} value={stats.active} subtitle={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}%`} color="emerald" delay={0.2} />
          <EnhancedStatCard icon={<AlertCircle className="w-5 h-5" />} title={t('superAdmin.expiringSoon')} value={stats.expiring} alert={stats.expiring > 0} color="amber" delay={0.3} />
          <EnhancedStatCard icon={<CreditCard className="w-5 h-5" />} title={t('superAdmin.monthlyRevenue')} value={`${(stats.mrr / 1000000).toFixed(1)}M`} subtitle="UZS (MRR)" color="cyan" delay={0.4} />
        </div>

        {activeTab === 'clinics' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mb-8">
            <ChartCard title="Daromad Dinamikasi" data={stats.revenueData} color="indigo" />
            <ChartCard title="Klinikalar O'sishi" data={stats.clinicGrowth} color="cyan" />
          </div>
        )}

        {/* Clinics Table - only shown when clinics tab is active */}
        {activeTab === 'clinics' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
          <div className="p-4 md:p-6 border-b border-white/[0.06] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-white">{t('superAdmin.clinics')}</h2>
            <div className="relative w-full md:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder={t('common.search')} value={search} onChange={e => setSearch(e.target.value)} className="h-12 pl-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left hidden lg:table">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{t('superAdmin.clinicName')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{t('common.password')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{t('common.status')}</th>
                  <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">{t('payments.title')}</th>
                  <th className="px-6 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {loading ? (
                  [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
                ) : (
                <AnimatePresence>
                  {filteredClinics.map((c, i) => {
                    const overdue = isPaymentOverdue(c.last_payment_date);
                    const clinicUsers = getClinicUsers(c.id);
                    return (
                      <motion.tr key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="hover:bg-white/[0.02] group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center font-black text-indigo-300">{c.name.charAt(0).toUpperCase()}</div>
                            <div>
                              <p className="font-bold text-white flex items-center gap-2">{c.name} {overdue && <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />}</p>
                              <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-0.5">ID: {c.id}</div>
                              {c.plan === 'basic' ? (
                                <div className="bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg mt-1 inline-flex items-center">
                                  BASIC
                                </div>
                              ) : (
                                <div className="bg-blue-600 outline outline-1 outline-blue-400 text-white text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg mt-1 inline-flex items-center">
                                  PRO
                                </div>
                              )}
                              {/* Users list for this clinic */}
                              {clinicUsers.length > 0 && (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {clinicUsers.map(u => (
                                    <span key={u.id} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                      {u.username} ({u.role})
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5"><span className="font-mono text-xs text-slate-400 bg-white/[0.05] px-3 py-1.5 rounded-lg">{c.password}</span></td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{c.status}</span>
                          <div className="mt-1.5 space-y-1">
                            <p className="text-xs text-slate-500 flex items-center gap-1.5 block">
                              <CalendarDays className="w-3.5 h-3.5 opacity-50" />
                              {c.expires_at}
                            </p>
                            <p className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getTimeRemaining(c.expires_at).color}`}>
                              <Clock className="w-3 h-3" />
                              {getTimeRemaining(c.expires_at).text}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <p className="font-bold text-white">{c.monthly_fee?.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span></p>
                          <p className={`text-xs ${overdue ? 'text-rose-400' : 'text-emerald-400'}`}>Oxirgi: {c.last_payment_date || "Yo'q"}</p>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="outline" size="sm" onClick={() => handleAddUser(c.id)} className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20">
                              <UserPlus className="w-4 h-4 mr-1" /> User
                            </Button>
                            {overdue && <Button variant="outline" size="sm" onClick={() => markAsPaid(c.id)} className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20">{t('payments.title')}</Button>}
                            <Button variant="ghost" size="icon" onClick={() => { setEditClinic(c); setForm({...c, monthly_fee: c.monthly_fee || 0}); setModalOpen(true); }} className="bg-white/[0.05] hover:bg-white/10 text-slate-300"><Edit2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
              </tbody>
            </table>

            {/* Mobile View */}
            <div className="lg:hidden flex flex-col divide-y divide-white/[0.04]">
              <AnimatePresence>
                {filteredClinics.map((c, i) => {
                  const overdue = isPaymentOverdue(c.last_payment_date);
                  const clinicUsers = getClinicUsers(c.id);
                  return (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="p-4">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 flex items-center justify-center font-black text-indigo-300">{c.name.charAt(0).toUpperCase()}</div>
                        <div className="flex-1">
                          <p className="font-bold text-white flex items-center gap-2">{c.name} {overdue && <span className="w-2 h-2 rounded-full bg-rose-500" />}</p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px] text-slate-500 uppercase">{c.id}</span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${c.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{c.status}</span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                             <p className={`text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 border border-white/5 ${getTimeRemaining(c.expires_at).color}`}>
                               {getTimeRemaining(c.expires_at).text}
                             </p>
                          </div>
                          {clinicUsers.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {clinicUsers.map(u => (
                                <span key={u.id} className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400">
                                  {u.username}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white">{c.monthly_fee?.toLocaleString()}</p>
                          <p className="text-[10px] text-slate-500">UZS/oy</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => handleAddUser(c.id)} className="bg-blue-500/10 border-blue-500/20 text-blue-400"><UserPlus className="w-3 h-3 mr-1"/>User</Button>
                        {overdue && <Button variant="outline" size="sm" onClick={() => markAsPaid(c.id)} className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 flex-1">To'lov Qabul</Button>}
                        <Button variant="ghost" size="icon" onClick={() => { setEditClinic(c); setForm({...c, monthly_fee: c.monthly_fee || 0}); setModalOpen(true); }} className="bg-white/[0.05] text-slate-300"><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {filteredClinics.length === 0 && (
              <div className="p-12 text-center text-slate-500">
                <Building2 className="w-12 h-12 mx-auto mb-4 opacity-20" />
                <p>Hech qanday klinika topilmadi</p>
              </div>
            )}
          </div>
        </motion.div>
        )}

        {/* Advertisement Management Section */}
        {activeTab === 'ads' && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.08] rounded-2xl overflow-hidden">
            {/* Ad Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 border-b border-white/[0.06]">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <ImageIcon className="w-5 h-5 text-blue-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase">Jami Reklamalar</span>
                </div>
                <p className="text-2xl font-black text-white">{adStats.totalAds}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <Eye className="w-5 h-5 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase">Faol</span>
                </div>
                <p className="text-2xl font-black text-white">{adStats.activeAds}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <MousePointer className="w-5 h-5 text-purple-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase">Clicklar</span>
                </div>
                <p className="text-2xl font-black text-white">{adStats.totalClicks}</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  <span className="text-xs font-bold text-slate-400 uppercase">CTR</span>
                </div>
                <p className="text-2xl font-black text-white">{adStats.ctr}%</p>
              </div>
            </div>

            {/* Ads List */}
            <div className="overflow-x-auto">
              <table className="w-full text-left hidden lg:table">
                <thead>
                  <tr className="bg-white/[0.02]">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Reklama</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Link</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Vaqt</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Statistika</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Holat</th>
                    <th className="px-6 py-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  <AnimatePresence>
                    {ads.map((ad, i) => (
                      <motion.tr key={ad.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="hover:bg-white/[0.02] group">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            {ad.image_url ? (
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10">
                                <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-blue-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-bold text-white">{ad.title}</p>
                              {ad.description && <p className="text-xs text-slate-400 mt-1 line-clamp-1">{ad.description}</p>}
                              {ad.cta_text && <p className="text-[10px] text-blue-400 mt-1 font-bold uppercase">{ad.cta_text}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          {ad.link_url ? (
                            <a href={ad.link_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                              <LinkIcon className="w-3.5 h-3.5" />
                              Ochish
                            </a>
                          ) : (
                            <span className="text-xs text-slate-500">Link yo'q</span>
                          )}
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{ad.start_time || '08:00'} - {ad.end_time || '22:00'}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <p className="text-xs text-slate-400">Impressions: <span className="text-white font-bold">{ad.impressions || 0}</span></p>
                            <p className="text-xs text-slate-400">Clicks: <span className="text-white font-bold">{ad.clicks || 0}</span></p>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${
                            ad.enabled 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          }`}>
                            {ad.enabled ? 'Faol' : 'Nofaol'}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="outline" size="sm" onClick={() => toggleAdStatus(ad)} className={`${
                              ad.enabled 
                                ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' 
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                            }`}>
                              {ad.enabled ? "O'chirish" : 'Yoqish'}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleEditAd(ad)} className="bg-white/[0.05] hover:bg-white/10 text-slate-300"><Edit2 className="w-4 h-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAd(ad.id)} className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400"><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>

              {/* Mobile View for Ads */}
              <div className="lg:hidden flex flex-col divide-y divide-white/[0.04]">
                <AnimatePresence>
                  {ads.map((ad, i) => (
                    <motion.div key={ad.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ delay: i * 0.05 }} className="p-4">
                      <div className="flex items-start gap-4">
                        {ad.image_url ? (
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-white/5 border border-white/10 flex-shrink-0">
                            <img src={ad.image_url} alt={ad.title} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-6 h-6 text-blue-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white truncate">{ad.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                              ad.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'
                            }`}>
                              {ad.enabled ? 'Faol' : 'Nofaol'}
                            </span>
                            <span className="text-[10px] text-slate-500">{ad.start_time || '08:00'} - {ad.end_time || '22:00'}</span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400">
                            <span>Impressions: {ad.impressions || 0}</span>
                            <span>Clicks: {ad.clicks || 0}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 mt-3">
                        <Button variant="outline" size="sm" onClick={() => toggleAdStatus(ad)} className={`${
                          ad.enabled 
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' 
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                        }`}>
                          {ad.enabled ? "O'chirish" : 'Yoqish'}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleEditAd(ad)} className="bg-white/[0.05] text-slate-300"><Edit2 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteAd(ad.id)} className="bg-rose-500/10 text-rose-400"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {ads.length === 0 && (
                <div className="p-12 text-center text-slate-500">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>Hech qanday reklama topilmadi</p>
                  <Button onClick={handleAddAd} className="mt-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
                    <Plus className="w-4 h-4 mr-2" /> Birinchi Reklamani Qo'shish
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[600px] rounded-[2rem] p-8 border border-white/[0.08] bg-[#0f0f16] text-white">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold">{editingClinic ? t('superAdmin.editClinic') : t('superAdmin.addClinic')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('superAdmin.clinicId')}</Label>
                <Input disabled={!!editingClinic} value={form.id} onChange={e => setForm({...form, id: e.target.value})} placeholder="star-med" className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('common.password')}</Label>
                <Input value={form.password} onChange={e => setForm({...form, password: e.target.value})} placeholder="Parol" className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('superAdmin.clinicName')}</Label>
              <Input 
                value={form.name} 
                onChange={e => {
                  const val = e.target.value;
                  setForm({
                    ...form, 
                    name: val, 
                    admin_name: editingClinic ? form.admin_name : val + ' Admin'
                  });
                }} 
                placeholder="Star Med Premium" 
                className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
              />
            </div>

            {/* Admin User Section (Collapsible or just separated) */}
            {!editingClinic && (
              <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <span className="text-[11px] font-black text-indigo-300 uppercase tracking-widest text-[10px]">Admin Foydalanuvchi</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Admin Logini</Label>
                      <Input 
                        value={form.admin_username || form.id} 
                        onChange={e => setForm({...form, admin_username: e.target.value})} 
                        placeholder="admin_login" 
                        className="h-10 bg-black/20 border-white/[0.05] rounded-xl text-xs" 
                      />
                   </div>
                   <div className="space-y-1.5">
                      <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Admin Paroli</Label>
                      <Input 
                        value={form.admin_password || form.password} 
                        onChange={e => setForm({...form, admin_password: e.target.value})} 
                        placeholder="••••••••" 
                        className="h-10 bg-black/20 border-white/[0.05] rounded-xl text-xs" 
                      />
                   </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[9px] font-bold text-slate-500 uppercase ml-1">Admin To'liq Ismi</Label>
                  <Input 
                    value={form.admin_name} 
                    onChange={e => setForm({...form, admin_name: e.target.value})} 
                    placeholder="Admin F.I.O" 
                    className="h-10 bg-black/20 border-white/[0.05] rounded-xl text-xs" 
                  />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Ta'rif (Plan)</Label>
              <select 
                value={form.plan || 'pro'} 
                onChange={e => {
                  const newPlan = e.target.value;
                  setForm({ ...form, plan: newPlan, monthly_fee: newPlan === 'basic' ? 99000 : 189000 });
                }} 
                className="w-full h-12 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 text-white"
              >
                <option value="basic" className="bg-slate-900 text-white">⭐ BASIC — 99.000 UZS / oy (Asosiy modullar + Ombor + Hisobotlar + Ish haqi)</option>
                <option value="pro" className="bg-slate-900 text-white">🚀 PRO — 189.000 UZS / oy (Barcha modullar + Implantlar + Marketing + Case-lar)</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Oylik To'lov</Label>
              <div className="h-12 bg-white/[0.05] border border-white/[0.08] rounded-xl text-white flex items-center px-4">
                <span className="font-black text-lg">{((form.monthly_fee) || 0).toLocaleString()}</span>
                <span className="text-slate-400 ml-1 text-sm">UZS / oy</span>
                <span className={`ml-auto text-[10px] font-black uppercase px-2 py-1 rounded-lg ${(form.plan === 'basic') ? 'bg-slate-700 text-slate-300' : 'bg-blue-600 text-white'}`}>
                  {(form.plan === 'basic') ? 'BASIC' : 'PRO'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('common.status')}</Label>
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full h-12 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 text-white">
                  <option value="Active">{t('common.active')}</option>
                  <option value="Inactive">{t('common.inactive')}</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">{t('superAdmin.expiresAt')}</Label>
                <Input type="date" value={form.expires_at} onChange={e => setForm({...form, expires_at: e.target.value})} className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" />
              </div>
            </div>
            <div className="pt-4 flex gap-3 border-t border-white/[0.06]">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1 h-12 rounded-xl text-slate-400 hover:text-white">{t('common.cancel')}</Button>
              <Button type="submit" className="flex-[2] h-12 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white rounded-xl font-bold">{editingClinic ? t('common.save') : t('common.create')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* User Management Modal */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="max-w-[500px] rounded-[2rem] p-8 border border-white/[0.08] bg-[#0f0f16] text-white">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold">
              {editingUser ? 'Foydalanuvchini tahrirlash' : 'Yangi foydalanuvchi'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUserSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Ism</Label>
              <Input 
                value={userForm.name} 
                onChange={e => setUserForm({...userForm, name: e.target.value})} 
                placeholder="Ism Familiya" 
                className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Login</Label>
                <Input 
                  value={userForm.username} 
                  onChange={e => setUserForm({...userForm, username: e.target.value})} 
                  placeholder="username" 
                  className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Parol</Label>
                <Input 
                  value={userForm.password} 
                  onChange={e => setUserForm({...userForm, password: e.target.value})} 
                  placeholder="••••••••" 
                  className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Rol</Label>
              <select 
                value={userForm.role} 
                onChange={e => setUserForm({...userForm, role: e.target.value})} 
                className="w-full h-12 bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 text-white"
              >
                <option value="admin">Administrator</option>
                <option value="doctor">Shifokor</option>
                <option value="receptionist">Administrator</option>
              </select>
            </div>
            
            {/* Existing users for this clinic */}
            {selectedClinicId && (
              <div className="pt-4 border-t border-white/[0.06]">
                <Label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">
                  Klinika foydalanuvchilari
                </Label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {getClinicUsers(selectedClinicId).map(user => (
                    <div key={user.id} className="flex items-center justify-between p-3 bg-white/[0.03] rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-white">{user.name}</p>
                        <p className="text-xs text-slate-500">@{user.username} • {user.role}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEditUser(user)}
                          className="h-8 w-8 text-slate-400 hover:text-white"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteUser(user.id)}
                          className="h-8 w-8 text-rose-400 hover:text-rose-300"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  {getClinicUsers(selectedClinicId).length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-4">Foydalanuvchilar yo'q</p>
                  )}
                </div>
              </div>
            )}
            
            <div className="pt-4 flex gap-3 border-t border-white/[0.06]">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setUserModalOpen(false)} 
                className="flex-1 h-12 rounded-xl text-slate-400 hover:text-white"
              >
                {t('common.cancel')}
              </Button>
              <Button 
                type="submit" 
                className="flex-[2] h-12 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-bold"
              >
                {editingUser ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Advertisement Modal */}
      <Dialog open={adModalOpen} onOpenChange={setAdModalOpen}>
        <DialogContent className="max-w-[600px] max-h-[90vh] rounded-[2rem] border border-white/[0.08] bg-[#0f0f16] text-white flex flex-col">
          <DialogHeader className="mb-4 px-8 pt-8">
            <DialogTitle className="text-2xl font-bold flex items-center gap-3">
              <ImageIcon className="w-6 h-6 text-blue-400" />
              {editingAd ? 'Reklamani Tahrirlash' : 'Yangi Reklama Qo\'shish'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto px-8 pb-4 custom-scrollbar">
          <form onSubmit={handleAdSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Sarlavha *</Label>
              <Input 
                value={adForm.title} 
                onChange={e => setAdForm({...adForm, title: e.target.value})} 
                placeholder="Reklama sarlavhasi" 
                className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Tavsif</Label>
              <Input 
                value={adForm.description} 
                onChange={e => setAdForm({...adForm, description: e.target.value})} 
                placeholder="Qisqa tavsif" 
                className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
              />
            </div>
            
            {/* Image Upload Section */}
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" />
                Rasm
              </Label>
              
              {/* Upload Area */}
              {!adForm.image_url ? (
                <label className="relative flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-white/20 rounded-xl hover:border-blue-500/50 hover:bg-white/[0.02] transition-all cursor-pointer group">
                  <input
                    id="ad-image-upload"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                  {uploadingImage ? (
                    <div className="flex flex-col items-center gap-2">
                      <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                      <span className="text-xs text-slate-400">Yuklanmoqda...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                        <Upload className="w-6 h-6 text-blue-400" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-bold text-slate-300">Rasm yuklash</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">JPEG, PNG, WebP (Max 5MB)</p>
                      </div>
                    </div>
                  )}
                </label>
              ) : (
                <div className="relative">
                  <div className="flex items-center gap-3 p-3 bg-white/[0.03] border border-white/10 rounded-xl">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                      <img 
                        src={adForm.image_url} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                        onError={(e) => e.target.style.display = 'none'} 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {selectedFile ? selectedFile.name : 'Rasm yuklangan'}
                      </p>
                      {selectedFile && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatFileSize(selectedFile.size)}
                        </p>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeImage}
                      className="h-8 w-8 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex-shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">Link URL</Label>
              <Input 
                value={adForm.link_url} 
                onChange={e => setAdForm({...adForm, link_url: e.target.value})} 
                placeholder="https://..." 
                className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-500 uppercase">CTA Matni</Label>
              <Input 
                value={adForm.cta_text} 
                onChange={e => setAdForm({...adForm, cta_text: e.target.value})} 
                placeholder="Batafsil" 
                className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Boshlanish Vaqti
                </Label>
                <Input 
                  type="time"
                  value={adForm.start_time} 
                  onChange={e => setAdForm({...adForm, start_time: e.target.value})} 
                  className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Tugash Vaqti
                </Label>
                <Input 
                  type="time"
                  value={adForm.end_time} 
                  onChange={e => setAdForm({...adForm, end_time: e.target.value})} 
                  className="h-12 bg-white/[0.03] border-white/[0.08] rounded-xl text-white" 
                />
              </div>
            </div>
            
            <div className="flex items-center gap-3 p-4 bg-white/[0.03] rounded-xl border border-white/[0.06]">
              <input
                type="checkbox"
                id="enabled"
                checked={adForm.enabled}
                onChange={e => setAdForm({...adForm, enabled: e.target.checked})}
                className="w-5 h-5 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500"
              />
              <Label htmlFor="enabled" className="text-sm font-bold text-white cursor-pointer">
                Reklama faol
              </Label>
            </div>
            
            {/* Preview */}
            {adForm.title && (
              <div className="p-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-xl border border-white/10">
                <Label className="text-[10px] font-bold text-slate-500 uppercase mb-2 block">Ko'rinishi</Label>
                <div className="flex items-center gap-3">
                  {adForm.image_url && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5">
                      <img src={adForm.image_url} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-white">{adForm.title}</p>
                    {adForm.description && <p className="text-xs text-slate-300 mt-0.5">{adForm.description}</p>}
                  </div>
                  {adForm.cta_text && (
                    <span className="px-3 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-bold rounded-lg">
                      {adForm.cta_text}
                    </span>
                  )}
                </div>
              </div>
            )}
          </form>
          </div>
          
          {/* Footer buttons - sticky at bottom */}
          <div className="px-8 pb-8 pt-4 border-t border-white/[0.06] bg-[#0f0f16]">
            <div className="flex gap-3">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setAdModalOpen(false)} 
                className="flex-1 h-12 rounded-xl text-slate-400 hover:text-white"
              >
                {t('common.cancel')}
              </Button>
              <Button 
                type="submit" 
                onClick={handleAdSubmit}
                className="flex-[2] h-12 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-bold"
              >
                {editingAd ? t('common.save') : t('common.create')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plus, Trash2, Edit2, ShieldCheck,
  Search, CalendarDays, Lock, User, UserPlus, ArrowRight, Loader2, LogOut,
  TrendingUp, Users, CreditCard, AlertCircle, Zap,
  Image as ImageIcon, Link as LinkIcon, Clock, BarChart3, Eye, EyeOff, MousePointer, 
  Upload, X, Copy, Check, ExternalLink, RefreshCw, Download, Filter, 
  ChevronRight, Stethoscope, Briefcase, Database, Activity, Sparkles, 
  CheckCircle2, AlertTriangle, KeyRound, ArrowUpRight, DollarSign, CalendarCheck
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  getAllAds, 
  saveAd, 
  deleteAd 
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
  Bar
} from 'recharts';

const SUPER_ADMIN = { username: 'admin', password: 'admin123' };

// Animated Background Component
const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] rounded-full bg-indigo-600/10 blur-[130px]" />
    <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] rounded-full bg-cyan-600/10 blur-[130px]" />
    <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] rounded-full bg-purple-600/5 blur-[100px]" />
  </div>
);

// Copy helper function
const copyToClipboard = (text, label) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  toast.success(`📋 ${label} nusxalandi: ${text}`);
};

export default function SuperAdmin() {
  const { t } = useTranslation();
  const [clinics, setClinics] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Tab Management: 'clinics' | 'users' | 'ads' | 'billing' | 'system'
  const [activeTab, setActiveTab] = useState('clinics');
  
  // UI Controls
  const [search, setSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [clinicStatusFilter, setClinicStatusFilter] = useState('all'); // all, active, expiring, inactive
  const [clinicPlanFilter, setClinicPlanFilter] = useState('all'); // all, basic, pro
  const [userRoleFilter, setUserRoleFilter] = useState('all'); // all, admin, doctor, receptionist
  const [userClinicFilter, setUserClinicFilter] = useState('all');
  const [showCharts, setShowCharts] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState({}); // { id: boolean }

  // Modals state
  const [modalOpen, setModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [adModalOpen, setAdModalOpen] = useState(false);

  // Selected Entities for editing / details
  const [editingClinic, setEditClinic] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedClinicForDetail, setSelectedClinicForDetail] = useState(null);
  const [renewingClinic, setRenewingClinic] = useState(null);
  const [renewMonths, setRenewMonths] = useState(1);
  const [selectedClinicIdForUser, setSelectedClinicIdForUser] = useState('');

  // Authentication State
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginLoading, setLoginLoading] = useState(false);

  // Advertisements State
  const [ads, setAds] = useState([]);
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

  // Clinic Form
  const [form, setForm] = useState({ 
    id: '', name: '', password: '', 
    monthly_fee: 189000, plan: 'pro', status: 'Active', 
    expires_at: '', last_payment_date: '',
    admin_username: '', admin_password: '', admin_name: ''
  });

  // User Form
  const [userForm, setUserForm] = useState({ 
    clinic_id: '', username: '', password: '', name: '', role: 'doctor', commission_rate: 0 
  });

  // Toggle show/hide password
  const togglePasswordVisibility = (id) => {
    setRevealedPasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

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
          name: 'Super Administrator',
          role: 'admin'
        };
        localStorage.setItem('admin_auth', JSON.stringify({
          isAdmin: true,
          user: adminUser
        }));
        setIsLoggedIn(true);
        toast.success(t('superAdmin.welcome'));
        loadClinics();
      } else { 
        toast.error(t('login.invalidCredentials')); 
      }
      setLoginLoading(false);
    }, 600);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_auth');
    setIsLoggedIn(false);
    setLoginForm({ username: '', password: '' });
    toast.info(t('common.logout'));
  };

  const loadClinics = async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const data = await base44.clinic.getAll();
      
      // Data consistency check for plans & fees
      let hasChanges = false;
      const fixedData = (data || []).map(c => {
        const fee = Number(c.monthly_fee);
        let correctPlan = c.plan || 'pro';
        
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
        await base44.clinic.saveAll(fixedData);
        setClinics(fixedData);
      } else {
        setClinics(fixedData);
      }

      // Fetch all users
      const allUsers = await base44.auth.getAllUsers();
      setUsers(allUsers || []);

      // Load advertisements
      const allAds = await getAllAds();
      setAds(allAds || []);
      
    } catch (error) {
      console.error('Error loading clinics:', error);
      toast.error('Klinikalarni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Switch / Impersonate Clinic directly
  const handleImpersonateClinic = (clinic) => {
    const clinicUsers = users.filter(u => u.clinic_id?.toLowerCase() === clinic.id?.toLowerCase());
    const adminUser = clinicUsers.find(u => u.role === 'admin') || clinicUsers[0];
    
    localStorage.setItem('current_clinic_id', clinic.id);
    localStorage.setItem('clinic_id', clinic.id);
    localStorage.setItem('clinic_plan', (clinic.plan || 'pro').toLowerCase());
    
    if (adminUser) {
      localStorage.setItem('user_id', adminUser.id);
      localStorage.setItem('user_name', adminUser.name);
      localStorage.setItem('user_role', adminUser.role);
      localStorage.setItem('user_data', JSON.stringify(adminUser));
    } else {
      localStorage.setItem('user_id', 'admin-impersonate');
      localStorage.setItem('user_name', `${clinic.name} Admin`);
      localStorage.setItem('user_role', 'admin');
    }
    localStorage.setItem('is_authenticated', 'true');
    
    toast.success(`'${clinic.name}' klinikasiga kirilmoqda...`);
    setTimeout(() => {
      window.location.href = '/';
    }, 400);
  };

  // Quick Subscription Renew Action
  const handleOpenRenewModal = (clinic) => {
    setRenewingClinic(clinic);
    setRenewMonths(1);
    setRenewModalOpen(true);
  };

  const handleConfirmRenew = async () => {
    if (!renewingClinic) return;
    
    try {
      const currentExpiry = renewingClinic.expires_at ? new Date(renewingClinic.expires_at) : new Date();
      const baseDate = currentExpiry > new Date() ? currentExpiry : new Date();
      baseDate.setDate(baseDate.getDate() + (renewMonths * 30));
      
      const newExpiryStr = baseDate.toISOString().split('T')[0];
      const todayStr = new Date().toISOString().split('T')[0];
      
      const updatedClinics = clinics.map(c => c.id === renewingClinic.id ? {
        ...c,
        expires_at: newExpiryStr,
        last_payment_date: todayStr,
        status: 'Active'
      } : c);
      
      await base44.clinic.saveAll(updatedClinics);
      setClinics(updatedClinics);
      setRenewModalOpen(false);
      setRenewingClinic(null);
      toast.success(`✅ '${renewingClinic.name}' obunasi ${renewMonths * 30} kunga uzaytirildi (${newExpiryStr} gacha)`);
    } catch (err) {
      toast.error('Obunani uzaytirishda xatolik yuz berdi');
    }
  };

  // Full System Backup Export (JSON)
  const handleExportBackup = () => {
    const backupData = {
      appName: 'MyClinic Dental CRM',
      exportDate: new Date().toISOString(),
      version: '2.5.0',
      totalClinics: clinics.length,
      totalUsers: users.length,
      clinics: clinics,
      users: users,
      ads: ads,
    };
    
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `myclinic_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('💾 Tizim zaxira nusxasi (backup) muvaffaqiyatli yuklab olindi!');
  };

  // User management functions
  const handleAddUser = (clinicId = '') => {
    setSelectedClinicIdForUser(clinicId || clinics[0]?.id || '');
    setUserForm({ 
      clinic_id: clinicId || clinics[0]?.id || '', 
      username: '', 
      password: Math.random().toString(36).substring(2, 8), 
      name: '', 
      role: 'doctor',
      commission_rate: 0 
    });
    setEditingUser(null);
    setUserModalOpen(true);
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setUserForm({ 
      clinic_id: user.clinic_id || '', 
      username: user.username || '', 
      password: user.password || '', 
      name: user.name || '', 
      role: user.role || 'doctor',
      commission_rate: user.commission_rate || 0 
    });
    setUserModalOpen(true);
  };

  const handleDeleteUser = async (userId) => {
    if (confirm('Haqiqatdan ham bu foydalanuvchini o\'chirib tashlamoqchimisiz?')) {
      await base44.auth.deleteUser(userId);
      const updated = await base44.auth.getAllUsers();
      setUsers(updated);
      toast.success('Foydalanuvchi tizimdan o\'chirildi');
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    if (!userForm.username || !userForm.password || !userForm.name || !userForm.clinic_id) {
      toast.error('Barcha majburiy maydonlarni to\'ldiring!');
      return;
    }
    
    try {
      if (editingUser) {
        await base44.auth.updateUser(editingUser.id, userForm);
        toast.success('Foydalanuvchi muvaffaqiyatli yangilandi');
      } else {
        const existingUser = users.find(u => 
          u.clinic_id?.toLowerCase() === userForm.clinic_id?.toLowerCase() && 
          u.username?.toLowerCase() === userForm.username?.toLowerCase()
        );
        if (existingUser) {
          toast.error('Bu login ushbu klinikada allaqachon mavjud!');
          return;
        }
        await base44.auth.addUser(userForm);
        toast.success('✅ Yangi foydalanuvchi qo\'shildi');
      }
      
      const updatedUsers = await base44.auth.getAllUsers();
      setUsers(updatedUsers);
      setUserModalOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Error saving user:', error);
      toast.error('Foydalanuvchini saqlashda xatolik yuz berdi');
    }
  };

  const getClinicUsers = (clinicId) => {
    if (!clinicId) return [];
    return users.filter(u => u.clinic_id?.toLowerCase() === clinicId.toLowerCase());
  };

  // Helper date calculations
  const getTimeRemaining = (expiryDateStr) => {
    if (!expiryDateStr) return { text: 'Noma\'lum', color: 'text-slate-500', bg: 'bg-slate-500/10 border-slate-500/20', isUrgent: false };
    const expiry = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0,0,0,0);
    const diffTime = expiry - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Muddati tugagan', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/30', isUrgent: true, days: diffDays };
    if (diffDays === 0) return { text: 'Bugun tugaydi', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', isUrgent: true, days: 0 };
    if (diffDays <= 7) return { text: `${diffDays} kun qoldi`, color: 'text-amber-300', bg: 'bg-amber-500/10 border-amber-500/20', isUrgent: true, days: diffDays };
    if (diffDays <= 30) return { text: `${diffDays} kun qoldi`, color: 'text-cyan-300', bg: 'bg-cyan-500/10 border-cyan-500/20', isUrgent: false, days: diffDays };
    
    const months = Math.floor(diffDays / 30);
    const remainingDays = diffDays % 30;
    return { 
      text: `${months} oy${remainingDays > 0 ? ` ${remainingDays} k` : ''}`, 
      color: 'text-emerald-400', 
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      isUrgent: false,
      days: diffDays
    };
  };

  const isPaymentOverdue = (lastPaymentStr) => {
    if (!lastPaymentStr) return true;
    const lastPayment = new Date(lastPaymentStr);
    const today = new Date();
    return Math.ceil(Math.abs(today - lastPayment) / (1000 * 60 * 60 * 24)) > 30;
  };

  // Comprehensive System Statistics
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let basicCount = 0;
    let proCount = 0;

    clinics.forEach(c => { 
      if (c.status === 'Active') {
        totalRevenue += Number(c.monthly_fee || 0);
      }
      if (c.plan === 'basic') basicCount++;
      else proCount++;
    });

    const doctorsCount = users.filter(u => u.role === 'doctor').length;
    const adminUsersCount = users.filter(u => u.role === 'admin').length;
    const receptionistCount = users.filter(u => u.role === 'receptionist').length;

    const expiringSoonClinics = clinics.filter(c => {
      const timeInfo = getTimeRemaining(c.expires_at);
      return timeInfo.isUrgent && timeInfo.days >= 0;
    });

    const expiredClinics = clinics.filter(c => {
      const timeInfo = getTimeRemaining(c.expires_at);
      return timeInfo.days < 0;
    });

    // Trend simulation
    const revenueData = [
      { name: 'Mar', value: Math.round(totalRevenue * 0.75) },
      { name: 'Apr', value: Math.round(totalRevenue * 0.82) },
      { name: 'May', value: Math.round(totalRevenue * 0.9) },
      { name: 'Iyun', value: Math.round(totalRevenue * 0.95) },
      { name: 'Iyul', value: Math.round(totalRevenue * 0.98) },
      { name: 'Avg', value: totalRevenue },
    ];

    const clinicGrowth = [
      { name: 'Mar', clinics: Math.max(1, clinics.length - 2), users: Math.max(2, users.length - 4) },
      { name: 'Apr', clinics: Math.max(1, clinics.length - 1), users: Math.max(3, users.length - 3) },
      { name: 'May', clinics: Math.max(1, clinics.length - 1), users: Math.max(4, users.length - 2) },
      { name: 'Iyun', clinics: clinics.length, users: Math.max(5, users.length - 1) },
      { name: 'Iyul', clinics: clinics.length, users: users.length },
      { name: 'Avg', clinics: clinics.length, users: users.length },
    ];

    return { 
      total: clinics.length, 
      active: clinics.filter(c => c.status === 'Active').length, 
      inactive: clinics.filter(c => c.status !== 'Active').length,
      expiring: expiringSoonClinics.length,
      expired: expiredClinics.length,
      mrr: totalRevenue,
      basicCount,
      proCount,
      totalUsers: users.length,
      doctorsCount,
      adminUsersCount,
      receptionistCount,
      revenueData,
      clinicGrowth
    };
  }, [clinics, users]);

  // Filtered Clinics
  const filteredClinics = useMemo(() => {
    return clinics.filter(c => {
      const matchesSearch = 
        c.name?.toLowerCase().includes(search.toLowerCase()) || 
        c.id?.toLowerCase().includes(search.toLowerCase());
      
      const timeInfo = getTimeRemaining(c.expires_at);
      let matchesStatus = true;
      if (clinicStatusFilter === 'active') matchesStatus = c.status === 'Active' && timeInfo.days >= 0;
      if (clinicStatusFilter === 'expiring') matchesStatus = timeInfo.isUrgent && timeInfo.days >= 0;
      if (clinicStatusFilter === 'expired') matchesStatus = timeInfo.days < 0 || c.status !== 'Active';

      let matchesPlan = true;
      if (clinicPlanFilter === 'basic') matchesPlan = c.plan === 'basic';
      if (clinicPlanFilter === 'pro') matchesPlan = c.plan !== 'basic';

      return matchesSearch && matchesStatus && matchesPlan;
    });
  }, [clinics, search, clinicStatusFilter, clinicPlanFilter]);

  // Filtered Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const matchesSearch = 
        u.name?.toLowerCase().includes(userSearch.toLowerCase()) || 
        u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.clinic_id?.toLowerCase().includes(userSearch.toLowerCase());

      let matchesRole = true;
      if (userRoleFilter !== 'all') matchesRole = u.role === userRoleFilter;

      let matchesClinic = true;
      if (userClinicFilter !== 'all') matchesClinic = u.clinic_id?.toLowerCase() === userClinicFilter.toLowerCase();

      return matchesSearch && matchesRole && matchesClinic;
    });
  }, [users, userSearch, userRoleFilter, userClinicFilter]);

  // Clinic Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.id || !form.name || !form.password) { 
      toast.error('Barcha majburiy maydonlarni to\'ldiring!'); 
      return; 
    }

    if (!/^[a-zA-Z0-9_]+$/.test(form.id)) {
      toast.error('Klinika ID faqat lotin harflari, sonlar va _ belgisidan iborat bo\'lishi shart!');
      return;
    }
    
    try {
      if (editingClinic) {
        const updatedClinic = { ...editingClinic, ...form };
        const newClinics = clinics.map(c => c.id === editingClinic.id ? updatedClinic : c);
        await base44.clinic.saveAll(newClinics);
        setClinics(newClinics);
        toast.success('✅ Klinika ma\'lumotlari tahrirlandi');
      } else {
        if (clinics.find(c => c.id.toLowerCase() === form.id.toLowerCase())) { 
          toast.error('Ushbu ID bilan klinika allaqachon mavjud!'); 
          return; 
        }
        
        const newClinic = { 
          ...form, 
          status: form.status || 'Active',
          created_at: new Date().toISOString() 
        };

        const adminUsername = (form.admin_username || form.id).trim();
        const adminPassword = (form.admin_password || form.password).trim();
        const adminNameValue = form.admin_name || (form.name + ' Admin');

        await base44.clinic.createClinic(newClinic, {
          id: 'user-' + Math.random().toString(36).substring(2, 11),
          name: adminNameValue,
          username: adminUsername,
          password: adminPassword,
          clinic_id: form.id,
          role: 'admin',
          commission_rate: 0
        });

        toast.success(`🎉 '${newClinic.name}' muvaffaqiyatli yaratildi!\nAdmin: ${adminUsername} | Parol: ${adminPassword}`);
      }
      
      setModalOpen(false);
      resetForm();
      await loadClinics();
    } catch (error) {
      console.error('Klinika saqlashda xatolik:', error);
      toast.error(`❌ Xatolik: ${error.message || 'Saqlab bo\'lmadi'}`);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Haqiqatdan ham bu klinikani va unga tegishli barcha ma\'lumotlarni o\'chirmoqchimisiz?')) {
      const newClinics = clinics.filter(c => c.id !== id);
      await base44.clinic.saveAll(newClinics);
      setClinics(newClinics);
      toast.success('Klinika o\'chirildi');
    }
  };

  const markAsPaid = async (id) => {
    const today = new Date().toISOString().split('T')[0];
    const newClinics = clinics.map(c => c.id === id ? { ...c, last_payment_date: today } : c);
    await base44.clinic.saveAll(newClinics);
    setClinics(newClinics);
    toast.success('To\'lov qabul qilindi');
  };

  const resetForm = (clinic = null) => {
    if (clinic) {
      setForm({ ...clinic, password: clinic.password || '', plan: clinic.plan || 'pro' });
    } else {
      setForm({
        id: '', name: '', password: Math.random().toString(36).substring(2, 8), 
        monthly_fee: 189000, plan: 'pro', status: 'Active', 
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
        last_payment_date: new Date().toISOString().split('T')[0],
        admin_username: '', admin_password: '', admin_name: ''
      });
    }
    setEditClinic(clinic);
  };

  // Advertisement Management
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
      toast.error('Reklamani saqlashda xatolik yuz berdi');
    }
  };

  const toggleAdStatus = async (ad) => {
    try {
      await saveAd({ ...ad, enabled: !ad.enabled, id: ad.id });
      setAds(await getAllAds());
      toast.success(ad.enabled ? 'Reklama o\'chirildi' : 'Reklama faollashtirildi');
    } catch (error) {
      toast.error('Statusni o\'zgartirishda xatolik');
    }
  };

  const adStats = useMemo(() => {
    const totalAds = ads.length;
    const activeAds = ads.filter(a => a.enabled).length;
    const totalImpressions = ads.reduce((sum, ad) => sum + (ad.impressions || 0), 0);
    const totalClicks = ads.reduce((sum, ad) => sum + (ad.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
    return { totalAds, activeAds, inactiveAds: totalAds - activeAds, totalImpressions, totalClicks, ctr };
  }, [ads]);

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
    const fileInput = document.getElementById('ad-image-upload');
    if (fileInput) fileInput.value = '';
  };

  // Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#07080d] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <AnimatedBackground />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[420px]"
        >
          <div className="relative bg-[#0d0f18]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-indigo-500 via-purple-600 to-cyan-500 rounded-2xl flex items-center justify-center shadow-xl shadow-indigo-500/20 border border-white/20">
                <ShieldCheck className="w-9 h-9 text-white drop-shadow" />
              </div>
              <h1 className="text-2xl font-black text-white tracking-tight">Nexus SuperAdmin</h1>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.25em] mt-1">Tizim Boshqaruv Markazi</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Login</Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    value={loginForm.username} 
                    onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
                    placeholder="admin" 
                    className="h-11 pl-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-sm focus:border-indigo-500" 
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-black text-slate-400 uppercase tracking-wider ml-1">Parol</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    type="password" 
                    value={loginForm.password} 
                    onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
                    placeholder="••••••••" 
                    className="h-11 pl-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-sm focus:border-indigo-500" 
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loginLoading} 
                className="w-full h-12 mt-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:opacity-95 text-white rounded-xl font-bold tracking-wide shadow-lg shadow-indigo-500/25 transition-all"
              >
                {loginLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Tizimga Kirish <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </Button>
            </form>

            <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Xavfsiz Shifrlangan Tizim</span>
              <span>v2.5.0</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Super Admin Main Dashboard
  return (
    <div className="min-h-screen bg-[#08090e] font-sans text-slate-100 relative">
      <AnimatedBackground />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-[#08090e]/85 backdrop-blur-xl border-b border-white/[0.07] px-4 md:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          
          {/* Logo & Status */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/20 flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black text-white tracking-tight">SuperAdmin Nexus</h1>
                <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  Global
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Barcha klinikalar va foydalanuvchilar boshqaruvi</p>
            </div>
          </div>

          {/* Quick Stats Pill (Desktop) */}
          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-400">Faol:</span>
              <strong className="text-white">{stats.active}/{stats.total} klinika</strong>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-400">Xodimlar:</span>
              <strong className="text-white">{stats.totalUsers}</strong>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400">MRR:</span>
              <strong className="text-emerald-400">{(stats.mrr / 1000).toLocaleString()}k UZS</strong>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2">
            <Button 
              onClick={loadClinics} 
              variant="outline" 
              size="sm" 
              disabled={refreshing}
              className="h-9 px-3 bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-slate-300 rounded-xl text-xs"
              title="Yangilash"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline ml-1.5">Yangilash</span>
            </Button>

            <Button 
              onClick={handleExportBackup} 
              variant="outline" 
              size="sm" 
              className="h-9 px-3 bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-slate-300 rounded-xl text-xs"
              title="Tizim zaxirasini yuklab olish"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline ml-1.5">Backup JSON</span>
            </Button>

            <Button 
              onClick={handleLogout} 
              variant="ghost" 
              size="sm" 
              className="h-9 px-3 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl text-xs"
              title="Tizimdan chiqish"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline ml-1.5">Chiqish</span>
            </Button>
          </div>

        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-5 space-y-6">
        
        {/* TOP KPI CARDS - Highly Compact & Information-Dense */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          
          {/* Card 1: Klinikalar */}
          <div className="bg-gradient-to-b from-indigo-950/40 to-slate-900/40 border border-indigo-500/20 rounded-2xl p-4 relative overflow-hidden group hover:border-indigo-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider">Jami Klinikalar</span>
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-white">{stats.total}</span>
              <span className="text-xs text-emerald-400 font-bold">({stats.active} faol)</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
              <span>PRO: <strong className="text-white">{stats.proCount}</strong></span>
              <span>BASIC: <strong className="text-white">{stats.basicCount}</strong></span>
            </div>
          </div>

          {/* Card 2: Foydalanuvchilar */}
          <div className="bg-gradient-to-b from-cyan-950/40 to-slate-900/40 border border-cyan-500/20 rounded-2xl p-4 relative overflow-hidden group hover:border-cyan-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-cyan-300 uppercase tracking-wider">Foydalanuvchilar</span>
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-white">{stats.totalUsers}</span>
              <span className="text-xs text-slate-400 font-medium">xodim</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
              <span>Shifokor: <strong className="text-cyan-300">{stats.doctorsCount}</strong></span>
              <span>Admin: <strong className="text-indigo-300">{stats.adminUsersCount}</strong></span>
            </div>
          </div>

          {/* Card 3: Obunalar & Muddatlar */}
          <div className="bg-gradient-to-b from-amber-950/40 to-slate-900/40 border border-amber-500/20 rounded-2xl p-4 relative overflow-hidden group hover:border-amber-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider">Obunalar Holati</span>
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <CalendarDays className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl md:text-3xl font-black text-white">{stats.active}</span>
              {stats.expiring > 0 ? (
                <span className="text-xs text-amber-400 font-bold animate-pulse">({stats.expiring} tugamoqda)</span>
              ) : (
                <span className="text-xs text-emerald-400 font-medium">Barchasi joyida</span>
              )}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
              <span>Muddati o'tgan: <strong className={stats.expired > 0 ? 'text-rose-400' : 'text-slate-400'}>{stats.expired}</strong></span>
              <span className="text-amber-400 font-bold">&lt;15 kun: {stats.expiring}</span>
            </div>
          </div>

          {/* Card 4: Oylik MRR */}
          <div className="bg-gradient-to-b from-emerald-950/40 to-slate-900/40 border border-emerald-500/20 rounded-2xl p-4 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider">Oylik MRR Daromad</span>
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl md:text-3xl font-black text-white">{stats.mrr?.toLocaleString()}</span>
              <span className="text-xs text-slate-400">UZS</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/5">
              <span>Yillik prognoz:</span>
              <strong className="text-emerald-300">{((stats.mrr * 12) / 1000000).toFixed(1)}M UZS</strong>
            </div>
          </div>

        </div>

        {/* Analytics Dinamikasi (Compact & Collapsible) */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-black text-white uppercase tracking-wider">O'sish va Daromad Dinamikasi</h3>
            </div>
            <button 
              onClick={() => setShowCharts(!showCharts)}
              className="text-[11px] text-slate-400 hover:text-white underline decoration-dotted"
            >
              {showCharts ? 'Grafiklarni yashirish' : 'Grafiklarni ko\'rsatish'}
            </button>
          </div>

          {showCharts && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2">
              {/* Chart 1: MRR Daromad */}
              <div className="bg-black/20 border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-300">Oylik Daromad Dinamikasi (UZS)</span>
                  <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> +15.4%
                  </span>
                </div>
                <div className="h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.revenueData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f111a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }} 
                        formatter={(val) => [`${Number(val).toLocaleString()} UZS`, 'MRR']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Klinikalar va Xodimlar */}
              <div className="bg-black/20 border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-300">Klinikalar va Foydalanuvchilar O'sishi</span>
                  <span className="text-[10px] text-cyan-400 font-bold flex items-center gap-1">
                    <Activity className="w-3 h-3" /> Faol o'sish
                  </span>
                </div>
                <div className="h-[140px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.clinicGrowth} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f111a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }} 
                      />
                      <Bar dataKey="clinics" name="Klinikalar" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="users" name="Foydalanuvchilar" fill="#818cf8" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PRIMARY TAB NAVIGATION BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-1 border-b border-white/[0.08]">
          
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl">
            <button
              onClick={() => setActiveTab('clinics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'clinics'
                  ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Klinikalar</span>
              <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">{clinics.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'users'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Foydalanuvchilar</span>
              <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">{users.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('ads')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'ads'
                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Reklamalar</span>
              <span className="px-1.5 py-0.2 bg-black/30 rounded-full text-[10px]">{ads.length}</span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'billing'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              <span>To'lovlar & Tariflar</span>
            </button>

            <button
              onClick={() => setActiveTab('system')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'system'
                  ? 'bg-gradient-to-r from-slate-600 to-slate-700 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Tizim & Zaxira</span>
            </button>
          </div>

          {/* Tab Primary Action */}
          <div>
            {activeTab === 'clinics' && (
              <Button 
                onClick={() => { resetForm(); setModalOpen(true); }} 
                className="h-9 px-4 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Yangi Klinika
              </Button>
            )}

            {activeTab === 'users' && (
              <Button 
                onClick={() => handleAddUser()} 
                className="h-9 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Yangi Foydalanuvchi
              </Button>
            )}

            {activeTab === 'ads' && (
              <Button 
                onClick={handleAddAd} 
                className="h-9 px-4 bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-95 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Reklama Qo'shish
              </Button>
            )}
          </div>

        </div>

        {/* ════════════════════ TAB 1: KLINIKALAR ════════════════════ */}
        {activeTab === 'clinics' && (
          <div className="space-y-4">
            
            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.06] p-3 rounded-2xl">
              
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Klinika nomi yoki ID bo'yicha qidirish..." 
                  value={search} 
                  onChange={e => setSearch(e.target.value)} 
                  className="h-10 pl-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs placeholder:text-slate-500" 
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status and Plan Filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Holat:</span>
                  <button 
                    onClick={() => setClinicStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicStatusFilter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Barchasi ({clinics.length})
                  </button>
                  <button 
                    onClick={() => setClinicStatusFilter('active')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicStatusFilter === 'active' ? 'bg-emerald-500/20 text-emerald-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Faol ({stats.active})
                  </button>
                  <button 
                    onClick={() => setClinicStatusFilter('expiring')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicStatusFilter === 'expiring' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Tugayotgan ({stats.expiring})
                  </button>
                  <button 
                    onClick={() => setClinicStatusFilter('expired')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicStatusFilter === 'expired' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Tugagan ({stats.expired})
                  </button>
                </div>

                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Ta'rif:</span>
                  <button 
                    onClick={() => setClinicPlanFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicPlanFilter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400'}`}
                  >
                    Barchasi
                  </button>
                  <button 
                    onClick={() => setClinicPlanFilter('pro')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicPlanFilter === 'pro' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400'}`}
                  >
                    PRO
                  </button>
                  <button 
                    onClick={() => setClinicPlanFilter('basic')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicPlanFilter === 'basic' ? 'bg-slate-700 text-slate-200' : 'text-slate-400'}`}
                  >
                    BASIC
                  </button>
                </div>
              </div>

            </div>

            {/* Clinics Table */}
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Klinika Nomi & ID</th>
                      <th className="py-3 px-4">Ta'rif</th>
                      <th className="py-3 px-4">Xodimlar</th>
                      <th className="py-3 px-4">Parol</th>
                      <th className="py-3 px-4">Obuna Muddati</th>
                      <th className="py-3 px-4">Oylik To'lov</th>
                      <th className="py-3 px-4 text-right">Tezkor Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs">
                    {loading ? (
                      [...Array(4)].map((_, i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={7} className="py-4 px-4">
                            <div className="h-4 bg-white/5 rounded w-3/4"></div>
                          </td>
                        </tr>
                      ))
                    ) : filteredClinics.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-500">
                          <Building2 className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm font-semibold">Mos keluvchi klinika topilmadi</p>
                        </td>
                      </tr>
                    ) : (
                      filteredClinics.map((c) => {
                        const timeInfo = getTimeRemaining(c.expires_at);
                        const overdue = isPaymentOverdue(c.last_payment_date);
                        const clinicUsers = getClinicUsers(c.id);
                        const isPassRevealed = revealedPasswords[c.id];

                        return (
                          <tr key={c.id} className="hover:bg-white/[0.03] transition-colors group">
                            
                            {/* 1. Name & ID */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 border border-white/10 flex items-center justify-center font-black text-indigo-300 text-sm flex-shrink-0">
                                  {c.name?.charAt(0).toUpperCase() || 'K'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white truncate">{c.name}</span>
                                    {c.status === 'Active' && timeInfo.days >= 0 ? (
                                      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" title="Faol" />
                                    ) : (
                                      <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse flex-shrink-0" title="Nofaol / Tugagan" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                                    <span className="font-mono text-slate-400">ID: {c.id}</span>
                                    <button 
                                      onClick={() => copyToClipboard(c.id, 'Klinika ID')}
                                      className="p-0.5 hover:text-white transition-colors" 
                                      title="ID nusxalash"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Plan */}
                            <td className="py-3.5 px-4">
                              {c.plan === 'basic' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider border border-slate-700">
                                  ⭐ BASIC
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-wider border border-indigo-500/30">
                                  🚀 PRO
                                </span>
                              )}
                            </td>

                            {/* 3. Users count */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={() => {
                                    setSelectedClinicForDetail(c);
                                    setDetailModalOpen(true);
                                  }}
                                  className="flex items-center gap-1 px-2 py-0.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/5 rounded-lg text-slate-300 font-bold text-[11px] transition-colors"
                                  title="Xodimlar ro'yxatini ko'rish"
                                >
                                  <Users className="w-3 h-3 text-cyan-400" />
                                  <span>{clinicUsers.length} xodim</span>
                                </button>
                                <button 
                                  onClick={() => handleAddUser(c.id)}
                                  className="p-1 hover:bg-cyan-500/20 rounded-md text-cyan-400 transition-colors"
                                  title="Ushbu klinikaga xodim qo'shish"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>

                            {/* 4. Password */}
                            <td className="py-3.5 px-4 font-mono">
                              <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2.5 py-1 rounded-lg w-fit">
                                <span className="text-[11px] text-slate-300">
                                  {isPassRevealed ? c.password : '••••••'}
                                </span>
                                <button 
                                  onClick={() => togglePasswordVisibility(c.id)} 
                                  className="text-slate-400 hover:text-white p-0.5"
                                  title={isPassRevealed ? "Yashirish" : "Ko'rsatish"}
                                >
                                  {isPassRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                <button 
                                  onClick={() => copyToClipboard(c.password, 'Parol')} 
                                  className="text-slate-400 hover:text-white p-0.5"
                                  title="Parolni nusxalash"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* 5. Expiry Date */}
                            <td className="py-3.5 px-4">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5 text-slate-300 text-[11px]">
                                  <CalendarDays className="w-3.5 h-3.5 text-slate-500" />
                                  <span>{c.expires_at || "Belgilanmagan"}</span>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${timeInfo.bg} ${timeInfo.color}`}>
                                  <Clock className="w-2.5 h-2.5" />
                                  {timeInfo.text}
                                </span>
                              </div>
                            </td>

                            {/* 6. Monthly Fee */}
                            <td className="py-3.5 px-4">
                              <div>
                                <p className="font-bold text-white text-xs">{c.monthly_fee?.toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">UZS</span></p>
                                <p className={`text-[10px] ${overdue ? 'text-rose-400 font-bold' : 'text-emerald-400'}`}>
                                  Oxirgi: {c.last_payment_date || "To'lanmagan"}
                                </p>
                              </div>
                            </td>

                            {/* 7. Action Buttons */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                
                                {/* Impersonate / Enter Clinic */}
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleImpersonateClinic(c)}
                                  className="h-8 px-2.5 bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs font-bold rounded-lg"
                                  title="Klinika boshqaruviga kirish"
                                >
                                  <KeyRound className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                                  <span>Kirish</span>
                                </Button>

                                {/* Quick Extend (+1 Oy) */}
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => handleOpenRenewModal(c)}
                                  className="h-8 px-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold rounded-lg"
                                  title="Obunani uzaytirish"
                                >
                                  <CalendarCheck className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                                  <span>+Muddat</span>
                                </Button>

                                {/* Edit */}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => { resetForm(c); setModalOpen(true); }} 
                                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                                  title="Tahrirlash"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>

                                {/* Delete */}
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDelete(c.id)} 
                                  className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                                  title="O'chirish"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>

                              </div>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════ TAB 2: FOYDALANUVCHILAR (USERS) ════════════════════ */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            
            {/* User Quick Stats Pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs text-slate-400">Jami Foydalanuvchilar:</span>
                <strong className="text-white text-base">{users.length}</strong>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs text-cyan-400">Shifokorlar:</span>
                <strong className="text-cyan-300 text-base">{stats.doctorsCount}</strong>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs text-indigo-400">Administratorlar:</span>
                <strong className="text-indigo-300 text-base">{stats.adminUsersCount}</strong>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.06] p-3 rounded-xl flex items-center justify-between">
                <span className="text-xs text-amber-400">Qabulxona (Reception):</span>
                <strong className="text-amber-300 text-base">{stats.receptionistCount}</strong>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white/[0.02] border border-white/[0.06] p-3 rounded-2xl">
              
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Ism, login yoki klinika bo'yicha qidirish..." 
                  value={userSearch} 
                  onChange={e => setUserSearch(e.target.value)} 
                  className="h-10 pl-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs placeholder:text-slate-500" 
                />
                {userSearch && (
                  <button onClick={() => setUserSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2">
                
                {/* Role filter */}
                <div className="flex items-center gap-1 bg-black/20 p-1 rounded-xl border border-white/5 text-xs">
                  <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Rol:</span>
                  <button 
                    onClick={() => setUserRoleFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${userRoleFilter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Barchasi
                  </button>
                  <button 
                    onClick={() => setUserRoleFilter('doctor')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${userRoleFilter === 'doctor' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Shifokor
                  </button>
                  <button 
                    onClick={() => setUserRoleFilter('admin')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${userRoleFilter === 'admin' ? 'bg-indigo-500/20 text-indigo-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Admin
                  </button>
                  <button 
                    onClick={() => setUserRoleFilter('receptionist')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${userRoleFilter === 'receptionist' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Reception
                  </button>
                </div>

                {/* Clinic filter dropdown */}
                <select 
                  value={userClinicFilter} 
                  onChange={e => setUserClinicFilter(e.target.value)}
                  className="h-9 px-3 bg-black/20 border border-white/10 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="all" className="bg-slate-900 text-white">Barcha Klinikalar</option>
                  {clinics.map(c => (
                    <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                      {c.name} ({c.id})
                    </option>
                  ))}
                </select>

              </div>

            </div>

            {/* Users Table */}
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Foydalanuvchi & Login</th>
                      <th className="py-3 px-4">Biriktirilgan Klinika</th>
                      <th className="py-3 px-4">Tizimdagi Roli</th>
                      <th className="py-3 px-4">Parol</th>
                      <th className="py-3 px-4">Komissiya</th>
                      <th className="py-3 px-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm font-semibold">Hech qanday foydalanuvchi topilmadi</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const clinic = clinics.find(c => c.id?.toLowerCase() === u.clinic_id?.toLowerCase());
                        const isPassRevealed = revealedPasswords[u.id || u.username];

                        return (
                          <tr key={u.id || u.username} className="hover:bg-white/[0.03] transition-colors group">
                            
                            {/* 1. Name & Username */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                  u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
                                  u.role === 'doctor' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                                  'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                }`}>
                                  {u.name?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <div>
                                  <p className="font-bold text-white">{u.name}</p>
                                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                    <span className="font-mono">@{u.username}</span>
                                    <button 
                                      onClick={() => copyToClipboard(u.username, 'Login')}
                                      className="p-0.5 hover:text-white"
                                      title="Loginni nusxalash"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Clinic */}
                            <td className="py-3.5 px-4">
                              <div>
                                <span className="font-semibold text-white">{clinic?.name || u.clinic_id}</span>
                                <span className="block text-[10px] text-slate-500 font-mono">ID: {u.clinic_id}</span>
                              </div>
                            </td>

                            {/* 3. Role */}
                            <td className="py-3.5 px-4">
                              {u.role === 'admin' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] font-bold uppercase">
                                  <ShieldCheck className="w-3 h-3" /> Administrator
                                </span>
                              )}
                              {u.role === 'doctor' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase">
                                  <Stethoscope className="w-3 h-3" /> Shifokor
                                </span>
                              )}
                              {u.role === 'receptionist' && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase">
                                  <User className="w-3 h-3" /> Qabulxona
                                </span>
                              )}
                              {!['admin', 'doctor', 'receptionist'].includes(u.role) && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 text-[10px] font-bold uppercase">
                                  {u.role}
                                </span>
                              )}
                            </td>

                            {/* 4. Password */}
                            <td className="py-3.5 px-4 font-mono">
                              <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 px-2 py-1 rounded-lg w-fit">
                                <span className="text-[11px] text-slate-300">
                                  {isPassRevealed ? u.password : '••••••'}
                                </span>
                                <button 
                                  onClick={() => togglePasswordVisibility(u.id || u.username)} 
                                  className="text-slate-400 hover:text-white p-0.5"
                                  title={isPassRevealed ? "Yashirish" : "Ko'rsatish"}
                                >
                                  {isPassRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                <button 
                                  onClick={() => copyToClipboard(u.password, 'Parol')} 
                                  className="text-slate-400 hover:text-white p-0.5"
                                  title="Parolni nusxalash"
                                >
                                  <Copy className="w-3 h-3" />
                                </button>
                              </div>
                            </td>

                            {/* 5. Commission rate */}
                            <td className="py-3.5 px-4">
                              <span className="text-slate-300 font-semibold">{u.commission_rate ? `${u.commission_rate}%` : '—'}</span>
                            </td>

                            {/* 6. Actions */}
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleEditUser(u)} 
                                  className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg"
                                  title="Tahrirlash"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => handleDeleteUser(u.id)} 
                                  className="h-8 w-8 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                                  title="O'chirish"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            </td>

                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════ TAB 3: REKLAMALAR (ADS) ════════════════════ */}
        {activeTab === 'ads' && (
          <div className="space-y-4">
            
            {/* Ad Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20">
                <span className="text-[11px] font-bold text-blue-300 uppercase">Jami Reklamalar</span>
                <p className="text-2xl font-black text-white mt-1">{adStats.totalAds}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border border-emerald-500/20">
                <span className="text-[11px] font-bold text-emerald-300 uppercase">Faol Reklamalar</span>
                <p className="text-2xl font-black text-white mt-1">{adStats.activeAds}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20">
                <span className="text-[11px] font-bold text-purple-300 uppercase">Jami Clicklar</span>
                <p className="text-2xl font-black text-white mt-1">{adStats.totalClicks}</p>
              </div>
              <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                <span className="text-[11px] font-bold text-amber-300 uppercase">O'rtacha CTR</span>
                <p className="text-2xl font-black text-white mt-1">{adStats.ctr}%</p>
              </div>
            </div>

            {/* Ads Table */}
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-white/[0.03] border-b border-white/[0.06] text-[10px] font-black text-slate-400 uppercase tracking-wider">
                      <th className="py-3 px-4">Reklama & Banner</th>
                      <th className="py-3 px-4">Havola (Link)</th>
                      <th className="py-3 px-4">Vaqt Grafigi</th>
                      <th className="py-3 px-4">Ko'rishlar / Click</th>
                      <th className="py-3 px-4">Holat</th>
                      <th className="py-3 px-4 text-right">Amallar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] text-xs">
                    {ads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-500">
                          <ImageIcon className="w-10 h-10 mx-auto mb-2 opacity-30" />
                          <p className="text-sm font-semibold">Hech qanday reklama qo'shilmagan</p>
                        </td>
                      </tr>
                    ) : (
                      ads.map((ad) => (
                        <tr key={ad.id} className="hover:bg-white/[0.03] transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              {ad.image_url ? (
                                <img src={ad.image_url} alt={ad.title} className="w-12 h-12 rounded-xl object-cover border border-white/10 flex-shrink-0" />
                              ) : (
                                <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                                  <ImageIcon className="w-6 h-6 text-purple-400" />
                                </div>
                              )}
                              <div>
                                <p className="font-bold text-white">{ad.title}</p>
                                {ad.description && <p className="text-[11px] text-slate-400 line-clamp-1">{ad.description}</p>}
                                {ad.cta_text && <span className="text-[9px] text-purple-300 font-bold uppercase mt-0.5 inline-block">CTA: {ad.cta_text}</span>}
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            {ad.link_url ? (
                              <a href={ad.link_url} target="_blank" rel="noreferrer" className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-[11px]">
                                <LinkIcon className="w-3 h-3" /> Ochish
                              </a>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Havola yo'q</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-slate-300 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>{ad.start_time || '08:00'} — {ad.end_time || '22:00'}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5 text-[11px]">
                              <p className="text-slate-400">Ko'rildi: <strong className="text-white">{ad.impressions || 0}</strong></p>
                              <p className="text-slate-400">Click: <strong className="text-cyan-300">{ad.clicks || 0}</strong></p>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <button
                              onClick={() => toggleAdStatus(ad)}
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase border transition-all ${
                                ad.enabled 
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                                  : 'bg-slate-700 text-slate-400 border-slate-600'
                              }`}
                            >
                              {ad.enabled ? '● Faol' : '○ O\'chirilgan'}
                            </button>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleEditAd(ad)} 
                                className="h-8 w-8 text-slate-400 hover:text-white"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleDeleteAd(ad.id)} 
                                className="h-8 w-8 text-rose-400 hover:text-rose-300"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════ TAB 4: TO'LOVLAR VA TARIFLAR (BILLING) ════════════════════ */}
        {activeTab === 'billing' && (
          <div className="space-y-4">
            
            {/* Tariff Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Basic Plan Info */}
              <div className="bg-gradient-to-b from-slate-900 to-[#0d0f18] border border-slate-700/60 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⭐</span>
                    <h4 className="text-base font-black text-white">BASIC Ta'rifi</h4>
                  </div>
                  <span className="text-base font-black text-slate-200">99,000 UZS <span className="text-xs text-slate-400 font-normal">/ oy</span></span>
                </div>
                <p className="text-xs text-slate-400 mb-4">Kichik va o'rta stomatologiya klinikalari uchun to'liq boshlang'ich tizim.</p>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Bemorlar bazasi & Tarix</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Qabullar & Navbat taqvimi</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> To'lovlar & Qarzdorlik nazorati</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Omborxona & Xarajatlar</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Xodimlar & Ish haqi (Payroll)</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Davolash rejalari & Retseptlar</div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                  <span>Biriktirilgan klinikalar:</span>
                  <strong className="text-white">{stats.basicCount} ta</strong>
                </div>
              </div>

              {/* Pro Plan Info */}
              <div className="bg-gradient-to-b from-indigo-950/40 to-[#0d0f18] border border-indigo-500/30 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl">
                  Eng Ommabop
                </div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚀</span>
                    <h4 className="text-base font-black text-indigo-300">PRO Ta'rifi</h4>
                  </div>
                  <span className="text-base font-black text-white">189,000 UZS <span className="text-xs text-slate-400 font-normal">/ oy</span></span>
                </div>
                <p className="text-xs text-slate-400 mb-4">Barcha professional va zamonaviy imkoniyatlarga ega to'liq versiya.</p>
                <div className="space-y-1.5 text-xs text-slate-300">
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> <strong>BASIC dagi barcha modullar</strong></div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Implantologiya & Pasportlar moduli</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Marketing & Reklama kanallari ROI tahlili</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Klinik keyslar (Before/After Portfolio)</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> SMS va Telegram orqali avto-eslatmalar</div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-indigo-400" /> Ustuvor 24/7 texnik yordam</div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                  <span>Biriktirilgan klinikalar:</span>
                  <strong className="text-indigo-300">{stats.proCount} ta</strong>
                </div>
              </div>

            </div>

            {/* Overdue / Expiring Clinics Action Table */}
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" /> To'lov Muddati Yaqinlashgan yoki O'tgan Klinikalar
                </h4>
              </div>
              <div className="space-y-2">
                {clinics.filter(c => isPaymentOverdue(c.last_payment_date) || getTimeRemaining(c.expires_at).days <= 7).map(c => {
                  const timeInfo = getTimeRemaining(c.expires_at);
                  return (
                    <div key={c.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
                      <div>
                        <p className="font-bold text-white text-sm">{c.name} <span className="text-xs text-slate-400 font-mono">({c.id})</span></p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Muddati: <strong className={timeInfo.color}>{c.expires_at} ({timeInfo.text})</strong> • Oylik to'lov: <strong>{c.monthly_fee?.toLocaleString()} UZS</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => markAsPaid(c.id)}
                          className="h-8 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold"
                        >
                          To'lovni Qabul Qilish
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenRenewModal(c)}
                          className="h-8 bg-white/5 text-slate-300 hover:text-white border-white/10 text-xs"
                        >
                          Muddatni Uzaytirish
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {clinics.filter(c => isPaymentOverdue(c.last_payment_date) || getTimeRemaining(c.expires_at).days <= 7).length === 0 && (
                  <p className="text-xs text-emerald-400 text-center py-4 font-semibold">
                    ✓ Hozirda qarzdor yoki muddati tugagan klinika mavjud emas!
                  </p>
                )}
              </div>
            </div>

          </div>
        )}

        {/* ════════════════════ TAB 5: TIZIM VA ZAXIRA (SYSTEM) ════════════════════ */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-indigo-400" />
                  <h4 className="text-sm font-bold text-white">Ma'lumotlar Bazasi</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Holat:</span>
                    <strong className="text-emerald-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Ulanish Faol</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Jami Klinikalar:</span>
                    <strong className="text-white">{clinics.length} ta</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Jami Xodimlar:</span>
                    <strong className="text-white">{users.length} ta</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Reklama Bannerlari:</span>
                    <strong className="text-white">{ads.length} ta</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-white">Xavfsizlik & Kirish</h4>
                </div>
                <div className="space-y-2 text-xs text-slate-300">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">SuperAdmin Login:</span>
                    <strong className="font-mono text-white">admin</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Sessiya Turi:</span>
                    <strong className="text-cyan-300">Root Administrator</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Tizim Versiyasi:</span>
                    <strong className="text-white">v2.5.0 Enterprise</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">Offline Fallback:</span>
                    <strong className="text-emerald-400">Yoqilgan (LocalStorage Sync)</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="w-4 h-4 text-indigo-400" />
                    <h4 className="text-sm font-bold text-white">Tizim Zaxira Nusxasi (Backup)</h4>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Barcha klinika va foydalanuvchilar ma'lumotlarini to'liq JSON formatida eksport qiling.</p>
                </div>
                <Button 
                  onClick={handleExportBackup}
                  className="w-full bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs h-10 rounded-xl"
                >
                  <Download className="w-3.5 h-3.5 mr-2" /> Zaxira Nusxani Yuklab Olish
                </Button>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* ════════════════════ MODAL 1: KLINIKA QO'SHISH / TAHRIRLASH ════════════════════ */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-[550px] rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-indigo-400" />
              {editingClinic ? 'Klinika Ma\'lumotlarini Tahrirlash' : 'Yangi Klinika Yaratish'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Klinika asosiy ma'lumotlari, ta'rifi va administrator hisobini sozlang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Klinika ID (Unique) *</Label>
                <Input 
                  disabled={!!editingClinic} 
                  value={form.id} 
                  onChange={e => setForm({...form, id: e.target.value})} 
                  placeholder="star_med" 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Master Parol *</Label>
                <Input 
                  value={form.password} 
                  onChange={e => setForm({...form, password: e.target.value})} 
                  placeholder="Parol" 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Klinika Nomi *</Label>
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
                placeholder="Star Med Dental Clinic" 
                className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
              />
            </div>

            {/* Admin User Section (New clinic creation only) */}
            {!editingClinic && (
              <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="text-[11px] font-bold text-indigo-300 uppercase">Klinika Bosh Administratori</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Admin Logini</Label>
                    <Input 
                      value={form.admin_username || form.id} 
                      onChange={e => setForm({...form, admin_username: e.target.value})} 
                      placeholder="admin_login" 
                      className="h-9 bg-black/30 border-white/10 rounded-lg text-xs" 
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[9px] font-bold text-slate-400 uppercase">Admin Paroli</Label>
                    <Input 
                      value={form.admin_password || form.password} 
                      onChange={e => setForm({...form, admin_password: e.target.value})} 
                      placeholder="••••••••" 
                      className="h-9 bg-black/30 border-white/10 rounded-lg text-xs" 
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] font-bold text-slate-400 uppercase">Admin To'liq Ismi</Label>
                  <Input 
                    value={form.admin_name} 
                    onChange={e => setForm({...form, admin_name: e.target.value})} 
                    placeholder="Admin F.I.O" 
                    className="h-9 bg-black/30 border-white/10 rounded-lg text-xs" 
                  />
                </div>
              </div>
            )}

            {/* Plan and Monthly Fee */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Ta'rif (Plan)</Label>
                <select 
                  value={form.plan || 'pro'} 
                  onChange={e => {
                    const newPlan = e.target.value;
                    setForm({ ...form, plan: newPlan, monthly_fee: newPlan === 'basic' ? 99000 : 189000 });
                  }} 
                  className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-xl px-3 text-white text-xs focus:border-indigo-500"
                >
                  <option value="basic" className="bg-slate-900 text-white">⭐ BASIC (99.000 UZS / oy)</option>
                  <option value="pro" className="bg-slate-900 text-white">🚀 PRO (189.000 UZS / oy)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Oylik To'lov (UZS)</Label>
                <Input 
                  type="number"
                  value={form.monthly_fee} 
                  onChange={e => setForm({...form, monthly_fee: Number(e.target.value)})} 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
            </div>

            {/* Status & Expiry */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Holat</Label>
                <select 
                  value={form.status} 
                  onChange={e => setForm({...form, status: e.target.value})} 
                  className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-xl px-3 text-white text-xs focus:border-indigo-500"
                >
                  <option value="Active" className="bg-slate-900 text-white">Faol (Active)</option>
                  <option value="Inactive" className="bg-slate-900 text-white">Nofaol (Inactive)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Obuna Tugash Sanasi</Label>
                <Input 
                  type="date" 
                  value={form.expires_at} 
                  onChange={e => setForm({...form, expires_at: e.target.value})} 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
            </div>

            <div className="pt-3 flex gap-2 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1 h-10 rounded-xl text-slate-400 text-xs">
                Bekor qilish
              </Button>
              <Button type="submit" className="flex-[2] h-10 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:opacity-95 text-white font-bold text-xs rounded-xl">
                {editingClinic ? 'O\'zgarishlarni Saqlash' : 'Klinikani Yaratish'}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════ MODAL 2: FOYDALANUVCHI QO'SHISH / TAHRIRLASH ════════════════════ */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="max-w-[480px] rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-cyan-400" />
              {editingUser ? 'Foydalanuvchini Tahrirlash' : 'Yangi Foydalanuvchi Qo\'shish'}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUserSubmit} className="space-y-3.5 text-xs">
            
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Klinika *</Label>
              <select 
                disabled={!!editingUser}
                value={userForm.clinic_id} 
                onChange={e => setUserForm({...userForm, clinic_id: e.target.value})} 
                className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-xl px-3 text-white text-xs focus:border-cyan-500"
              >
                {clinics.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name} ({c.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">F.I.O / Ism Familiya *</Label>
              <Input 
                value={userForm.name} 
                onChange={e => setUserForm({...userForm, name: e.target.value})} 
                placeholder="Dr. Alisher Valiyev" 
                className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Login (Username) *</Label>
                <Input 
                  value={userForm.username} 
                  onChange={e => setUserForm({...userForm, username: e.target.value})} 
                  placeholder="alisher_doc" 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs font-mono" 
                />
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">Parol *</Label>
                  <button 
                    type="button" 
                    onClick={() => setUserForm({...userForm, password: Math.random().toString(36).substring(2, 8)})}
                    className="text-[9px] text-cyan-400 hover:underline"
                  >
                    Avto-generatsiya
                  </button>
                </div>
                <Input 
                  value={userForm.password} 
                  onChange={e => setUserForm({...userForm, password: e.target.value})} 
                  placeholder="••••••••" 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs font-mono" 
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Tizimdagi Roli</Label>
                <select 
                  value={userForm.role} 
                  onChange={e => setUserForm({...userForm, role: e.target.value})} 
                  className="w-full h-10 bg-white/[0.04] border border-white/10 rounded-xl px-3 text-white text-xs focus:border-cyan-500"
                >
                  <option value="doctor" className="bg-slate-900 text-white">🩺 Shifokor (Doctor)</option>
                  <option value="admin" className="bg-slate-900 text-white">👑 Administrator</option>
                  <option value="receptionist" className="bg-slate-900 text-white">📋 Qabulxona (Reception)</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Komissiya foizi (%)</Label>
                <Input 
                  type="number"
                  value={userForm.commission_rate || 0} 
                  onChange={e => setUserForm({...userForm, commission_rate: Number(e.target.value)})} 
                  placeholder="30" 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
            </div>
            
            <div className="pt-3 flex gap-2 border-t border-white/10">
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => setUserModalOpen(false)} 
                className="flex-1 h-10 rounded-xl text-slate-400 text-xs"
              >
                Bekor qilish
              </Button>
              <Button 
                type="submit" 
                className="flex-[2] h-10 bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-95 text-white font-bold text-xs rounded-xl"
              >
                {editingUser ? 'Saqlash' : 'Qo\'shish'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ════════════════════ MODAL 3: OBUNANI UZAYTIRISH (QUICK RENEW) ════════════════════ */}
      <Dialog open={renewModalOpen} onOpenChange={setRenewModalOpen}>
        <DialogContent className="max-w-[420px] rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-emerald-400" />
              Obunani Uzaytirish
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {renewingClinic?.name} ({renewingClinic?.id}) uchun obuna muddatini uzaytiring.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Hozirgi muddat:</span>
                <strong className="text-white">{renewingClinic?.expires_at || 'Muddatsiz'}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Oylik to'lov summasi:</span>
                <strong className="text-emerald-400">{renewingClinic?.monthly_fee?.toLocaleString()} UZS</strong>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Muddatni tanlang:</Label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRenewMonths(m)}
                    className={`py-2.5 rounded-xl border text-xs font-bold transition-all ${
                      renewMonths === m 
                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-md' 
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    +{m} oy
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
              <span className="text-emerald-300 font-medium">Jami to'lov:</span>
              <strong className="text-emerald-400 text-sm">{((renewingClinic?.monthly_fee || 0) * renewMonths).toLocaleString()} UZS</strong>
            </div>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setRenewModalOpen(false)} 
                className="flex-1 h-10 text-xs rounded-xl text-slate-400"
              >
                Bekor qilish
              </Button>
              <Button 
                onClick={handleConfirmRenew} 
                className="flex-[2] h-10 bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-white font-bold text-xs rounded-xl"
              >
                Obunani Uzaytirish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ════════════════════ MODAL 4: KLINIKA TAFSILOTLARI (DETAIL DRAWER) ════════════════════ */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-[550px] max-h-[85vh] overflow-y-auto rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          {selectedClinicForDetail && (
            <div>
              <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-bold flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-indigo-400" />
                    <span>{selectedClinicForDetail.name}</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                    selectedClinicForDetail.plan === 'basic' ? 'bg-slate-800 text-slate-300' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  }`}>
                    {selectedClinicForDetail.plan === 'basic' ? '⭐ BASIC' : '🚀 PRO'}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 text-xs">
                {/* Meta details */}
                <div className="grid grid-cols-2 gap-2.5 p-3.5 bg-white/[0.03] border border-white/5 rounded-2xl">
                  <div>
                    <span className="text-slate-400 text-[10px] block">Klinika ID:</span>
                    <strong className="font-mono text-white text-xs">{selectedClinicForDetail.id}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Master Parol:</span>
                    <strong className="font-mono text-white text-xs">{selectedClinicForDetail.password}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Obuna Tugash Sanasi:</span>
                    <strong className="text-white text-xs">{selectedClinicForDetail.expires_at}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Oylik To'lov:</span>
                    <strong className="text-emerald-400 text-xs">{selectedClinicForDetail.monthly_fee?.toLocaleString()} UZS</strong>
                  </div>
                </div>

                {/* Staff List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-slate-300 text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-cyan-400" /> Biriktirilgan Xodimlar ({getClinicUsers(selectedClinicForDetail.id).length})
                    </span>
                    <button 
                      onClick={() => {
                        setDetailModalOpen(false);
                        handleAddUser(selectedClinicForDetail.id);
                      }}
                      className="text-[10px] font-bold text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Xodim qo'shish
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {getClinicUsers(selectedClinicForDetail.id).map(user => (
                      <div key={user.id || user.username} className="flex items-center justify-between p-2.5 bg-white/[0.02] border border-white/5 rounded-xl">
                        <div>
                          <p className="font-bold text-white text-xs">{user.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono">@{user.username} • Parol: {user.password}</p>
                        </div>
                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-white/5 text-slate-300">
                          {user.role}
                        </span>
                      </div>
                    ))}
                    {getClinicUsers(selectedClinicForDetail.id).length === 0 && (
                      <p className="text-center text-slate-500 py-4 text-xs">Ushbu klinikada xodimlar topilmadi</p>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex gap-2">
                  <Button 
                    onClick={() => {
                      setDetailModalOpen(false);
                      handleImpersonateClinic(selectedClinicForDetail);
                    }}
                    className="flex-1 h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl"
                  >
                    <KeyRound className="w-3.5 h-3.5 mr-1.5" /> Ushbu Klinikaga Kirish
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ════════════════════ MODAL 5: REKLAMA QO'SHISH / TAHRIRLASH ════════════════════ */}
      <Dialog open={adModalOpen} onOpenChange={setAdModalOpen}>
        <DialogContent className="max-w-[550px] max-h-[85vh] overflow-y-auto rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-purple-400" />
              {editingAd ? 'Reklamani Tahrirlash' : 'Yangi Reklama Banneri Qo\'shish'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAdSubmit} className="space-y-3.5 text-xs">
            
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Sarlavha *</Label>
              <Input 
                value={adForm.title} 
                onChange={e => setAdForm({...adForm, title: e.target.value})} 
                placeholder="Masalan: Yangi dental uskunalar yetkazib berish" 
                className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
              />
            </div>

            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase">Qisqa Tavsif</Label>
              <Input 
                value={adForm.description} 
                onChange={e => setAdForm({...adForm, description: e.target.value})} 
                placeholder="Aksiya va chegirmalar haqida batafsil ma'lumot" 
                className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
              />
            </div>

            {/* Image upload */}
            <div className="space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5" /> Banner Rasmi
              </Label>
              
              {!adForm.image_url ? (
                <label className="flex flex-col items-center justify-center w-full h-24 border border-dashed border-white/20 rounded-xl hover:border-purple-500/50 hover:bg-white/[0.02] cursor-pointer transition-all">
                  <input
                    id="ad-image-upload"
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={uploadingImage}
                    className="hidden"
                  />
                  {uploadingImage ? (
                    <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
                  ) : (
                    <div className="text-center text-slate-400 text-xs">
                      <Upload className="w-5 h-5 mx-auto mb-1 text-purple-400" />
                      <span>Rasm yuklash (JPEG, PNG, WebP)</span>
                    </div>
                  )}
                </label>
              ) : (
                <div className="flex items-center gap-3 p-2 bg-white/[0.03] border border-white/10 rounded-xl">
                  <img src={adForm.image_url} alt="Preview" className="w-14 h-14 object-cover rounded-lg" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-white text-xs truncate">Rasm yuklandi</p>
                    <p className="text-[10px] text-emerald-400">Faol banner</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={removeImage} className="text-rose-400 hover:text-rose-300">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Havola URL (Link)</Label>
                <Input 
                  value={adForm.link_url} 
                  onChange={e => setAdForm({...adForm, link_url: e.target.value})} 
                  placeholder="https://t.me/..." 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Tugma Matni (CTA)</Label>
                <Input 
                  value={adForm.cta_text} 
                  onChange={e => setAdForm({...adForm, cta_text: e.target.value})} 
                  placeholder="Batafsil" 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Boshlanish Vaqti</Label>
                <Input 
                  type="time"
                  value={adForm.start_time} 
                  onChange={e => setAdForm({...adForm, start_time: e.target.value})} 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Tugash Vaqti</Label>
                <Input 
                  type="time"
                  value={adForm.end_time} 
                  onChange={e => setAdForm({...adForm, end_time: e.target.value})} 
                  className="h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs" 
                />
              </div>
            </div>

            <div className="pt-3 flex gap-2 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setAdModalOpen(false)} className="flex-1 h-10 rounded-xl text-slate-400 text-xs">
                Bekor qilish
              </Button>
              <Button type="submit" className="flex-[2] h-10 bg-gradient-to-r from-purple-500 to-pink-600 hover:opacity-95 text-white font-bold text-xs rounded-xl">
                {editingAd ? 'O\'zgarishlarni Saqlash' : 'Reklamani Qo\'shish'}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

    </div>
  );
}

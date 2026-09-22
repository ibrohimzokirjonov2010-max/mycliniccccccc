import { useState, useEffect, useMemo } from 'react';
import { 
  Building2, Plus, Trash2, Edit2, ShieldCheck,
  Search, CalendarDays, Lock, User, UserPlus, ArrowRight, Loader2, LogOut,
  TrendingUp, Users, CreditCard,
  Image as ImageIcon, Link as LinkIcon, Clock, BarChart3, Eye, EyeOff, 
  Upload, X, Copy, RefreshCw, Download,
  Stethoscope, Database, Activity,
  AlertTriangle, KeyRound, DollarSign, CalendarCheck
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { 
  getAllAds, 
  saveAd, 
  deleteAd 
} from '@/utils/adManager';
import { uploadImage } from '@/utils/imageUpload';
import shifoTariffs from '../../landing/config/shifo-tariffs.json';
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
import BillingPanel from '@/components/superadmin/BillingPanel';
import {
  METHOD_LABELS,
  WEBHOOK_LABELS,
  SOURCE_LABELS,
  catalogAmount,
  isCustomMonthly,
  resolveLifecycle,
  getTimeRemaining,
  isPaymentOverdue,
  extendExpiry,
  buildPaymentEntry,
  mergeLedgers,
  readLedger,
  writeLedger,
  normalizeClinicBilling,
  stripAdminFields,
  formatMoney,
  webhookStatusFor,
} from '@/utils/superAdminBilling';

const SUPER_ADMIN = { username: 'admin', password: 'admin123' };
const FIELD = 'h-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-xs placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-teal-400/50';
const SELECT = 'w-full h-10 bg-[#0c1218] border border-white/10 rounded-xl px-3 text-white text-xs focus:border-teal-400/50 focus:outline-none';

function landingTariffLabel(clinic) {
  if (clinic?.tariff === 'start') return 'START';
  if (clinic?.tariff === 'pro') return 'PRO';
  if (clinic?.tariff === 'klinika') return 'KLINIKA';
  if (clinic?.tariff === 'trial') return 'SINOV';
  return '';
}

function landingPayLabel(method) {
  if (method === 'payme') return 'Payme';
  if (method === 'click') return 'Click';
  if (method === 'mock') return 'Demo';
  if (method === 'trial') return 'Sinov';
  return '';
}

const AnimatedBackground = () => (
  <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-[-14%] left-[-8%] w-[46%] h-[46%] rounded-full bg-teal-500/[0.07] blur-[140px]" />
    <div className="absolute bottom-[-16%] right-[-8%] w-[40%] h-[40%] rounded-full bg-teal-800/[0.12] blur-[150px]" />
  </div>
);

const copyToClipboard = (text, label, { sensitive = false } = {}) => {
  if (!text) return;
  navigator.clipboard.writeText(text);
  toast.success(sensitive ? `${label} buferga nusxalandi` : `${label} nusxalandi`);
};

function LifecycleBadge({ clinic }) {
  const life = resolveLifecycle(clinic);
  const tones = {
    trialing: 'bg-teal-400/15 text-teal-200 border-teal-300/30',
    active: 'bg-emerald-400/15 text-emerald-200 border-emerald-300/25',
    expiring: 'bg-amber-400/15 text-amber-100 border-amber-300/30',
    past_due: 'bg-orange-400/15 text-orange-100 border-orange-300/30',
    expired: 'bg-rose-400/15 text-rose-100 border-rose-300/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-wide border ${tones[life.key] || tones.active}`}>
      {life.label}
    </span>
  );
}

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
  const [ledger, setLedger] = useState(() => readLedger());
  const [payMethod, setPayMethod] = useState('manual');
  const [payAmount, setPayAmount] = useState(0);
  const [payAmountTouched, setPayAmountTouched] = useState(false);
  const [paySaving, setPaySaving] = useState(false);
  const [secretPrompt, setSecretPrompt] = useState(null);
  const [issuedCreds, setIssuedCreds] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showFormPassword, setShowFormPassword] = useState(false);
  const [billingSearch, setBillingSearch] = useState('');
  const [billingPlan, setBillingPlan] = useState('all');
  const [billingLife, setBillingLife] = useState('all');
  const [ledgerMethod, setLedgerMethod] = useState('all');
  const [ledgerStatus, setLedgerStatus] = useState('all');

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
    monthly_fee: shifoTariffs.legacyPortalMonthlyFee.pro, plan: 'pro', status: 'Active', 
    expires_at: '', last_payment_date: '',
    admin_username: '', admin_password: '', admin_name: ''
  });

  // User Form
  const [userForm, setUserForm] = useState({ 
    clinic_id: '', username: '', password: '', name: '', role: 'doctor', commission_rate: 0 
  });

  const requestRevealPassword = (id) => {
    if (revealedPasswords[id]) {
      setRevealedPasswords(prev => ({ ...prev, [id]: false }));
      return;
    }
    setSecretPrompt({ mode: 'reveal', targetId: id });
  };

  const requestCopyPassword = (value) => {
    if (!value) {
      toast.error('Nusxalanadigan parol yo\'q');
      return;
    }
    setSecretPrompt({ mode: 'copy', value });
  };

  const confirmSecret = () => {
    if (!secretPrompt) return;
    if (secretPrompt.mode === 'reveal') {
      setRevealedPasswords(prev => ({ ...prev, [secretPrompt.targetId]: true }));
      toast.success('Parol ochildi. 20 soniyadan keyin yana yashiriladi.');
    } else {
      copyToClipboard(secretPrompt.value, 'Parol', { sensitive: true });
    }
    setSecretPrompt(null);
  };

  useEffect(() => {
    const open = Object.keys(revealedPasswords).filter((id) => revealedPasswords[id]);
    if (!open.length) return undefined;
    const timer = setTimeout(() => setRevealedPasswords({}), 20000);
    return () => clearTimeout(timer);
  }, [revealedPasswords]);

  useEffect(() => {
    if (!renewingClinic || payAmountTouched) return;
    setPayAmount(Number(renewingClinic.monthly_fee || 0) * Number(renewMonths || 1));
  }, [renewMonths, renewingClinic, payAmountTouched]);

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
      let hasChanges = false;
      const fixedData = (data || []).map((c) => {
        const landingTariff = shifoTariffs.tariffs.find((plan) => plan.id === c.tariff);
        if (landingTariff && c.plan !== landingTariff.crmPlan) {
          hasChanges = true;
          return { ...c, plan: landingTariff.crmPlan };
        }
        return c;
      });
      if (hasChanges) {
        await base44.clinic.saveAll(fixedData);
      }
      setClinics(fixedData);
      const mergedLedger = mergeLedgers(fixedData, readLedger());
      writeLedger(mergedLedger);
      setLedger(mergedLedger);

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

  const handleOpenRenewModal = (clinic) => {
    setRenewingClinic(clinic);
    setRenewMonths(1);
    const incoming = clinic.payment_provider || clinic.payment_method;
    const provider = ['manual', 'payme', 'click', 'mock'].includes(incoming) ? incoming : 'manual';
    setPayMethod(provider);
    setPayAmount(Number(clinic.monthly_fee || 0));
    setPayAmountTouched(false);
    setRenewModalOpen(true);
  };

  const handleConfirmRenew = async () => {
    if (!renewingClinic || paySaving) return;
    const months = Number(renewMonths) || 1;
    const periodDays = months * 30;
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('To\'lov summasini kiriting');
      return;
    }

    setPaySaving(true);
    try {
      const newExpiryStr = extendExpiry(renewingClinic.expires_at, periodDays);
      const todayStr = new Date().toISOString().split('T')[0];
      const entry = buildPaymentEntry({
        clinic: renewingClinic,
        amount,
        method: payMethod,
        periodDays,
      });
      const updatedClinics = clinics.map(c => c.id === renewingClinic.id ? {
        ...c,
        expires_at: newExpiryStr,
        last_payment_date: todayStr,
        status: 'Active',
        subscription_status: 'active',
        billing_status: 'paid',
        access_unlocked: true,
        period_ends_at: newExpiryStr,
        payment_method: payMethod,
        payment_provider: payMethod,
        webhook_status: entry.webhook_status,
        last_webhook_at: entry.webhook_status === 'received' ? new Date().toISOString() : c.last_webhook_at,
        payment_ledger: [entry, ...(Array.isArray(c.payment_ledger) ? c.payment_ledger : [])].slice(0, 40),
      } : c);

      await base44.clinic.saveAll(updatedClinics);
      setClinics(updatedClinics);
      const mergedLedger = mergeLedgers(updatedClinics, readLedger());
      writeLedger(mergedLedger);
      setLedger(mergedLedger);
      setRenewModalOpen(false);
      setRenewingClinic(null);
      toast.success(`'${renewingClinic.name}' to'lovi qabul qilindi. Muddat ${newExpiryStr} gacha.`);
    } catch (err) {
      toast.error('To\'lovni saqlashda xatolik yuz berdi');
    } finally {
      setPaySaving(false);
    }
  };

  // Full System Backup Export (JSON)
  const handleExportBackup = () => {
    const backupData = {
      appName: 'MyClinic Dental CRM',
      exportDate: new Date().toISOString(),
      version: '2.6.0',
      totalClinics: clinics.length,
      totalUsers: users.length,
      clinics: clinics,
      users: users,
      ads: ads,
      paymentLedger: mergeLedgers(clinics, ledger),
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
      password: '', 
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
    if (!userForm.username || !userForm.name || !userForm.clinic_id) {
      toast.error('Barcha majburiy maydonlarni to\'ldiring!');
      return;
    }
    if (!editingUser && !userForm.password) {
      toast.error('Yangi xodim uchun parol kiriting!');
      return;
    }
    
    try {
      if (editingUser) {
        const payload = { ...userForm };
        if (!payload.password) delete payload.password;
        await base44.auth.updateUser(editingUser.id, payload);
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

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let atRisk = 0;
    let basicCount = 0;
    let proCount = 0;
    let customCount = 0;
    let trialCount = 0;
    let pastDueCount = 0;
    let expiringCount = 0;
    let expiredCount = 0;
    let activeLifeCount = 0;
    let watchCount = 0;

    clinics.forEach(c => {
      const life = resolveLifecycle(c);
      const fee = Number(c.monthly_fee || 0);
      if (life.key === 'trialing') trialCount++;
      else if (life.key === 'past_due') {
        pastDueCount++;
        atRisk += fee;
      } else if (life.key === 'expiring') expiringCount++;
      else if (life.key === 'expired') expiredCount++;
      else activeLifeCount++;

      if (life.key === 'active' || life.key === 'expiring') totalRevenue += fee;
      if (life.days !== null && life.days >= 0 && life.days <= 15 && life.key !== 'expired') watchCount++;
      if (c.plan === 'basic') basicCount++;
      else proCount++;
      if (isCustomMonthly(c)) customCount++;
    });

    const doctorsCount = users.filter(u => u.role === 'doctor').length;
    const adminUsersCount = users.filter(u => u.role === 'admin').length;
    const receptionistCount = users.filter(u => u.role === 'receptionist').length;

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
      active: activeLifeCount, 
      inactive: clinics.filter(c => c.status !== 'Active').length,
      expiring: expiringCount,
      expired: expiredCount,
      trialing: trialCount,
      pastDue: pastDueCount,
      watch: watchCount,
      atRisk,
      customCount,
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
      const haystack = [c.name, c.id, c.owner_email, c.owner_phone, c.email, c.phone, c.doctor_name, c.tariff, c.signup_source]
        .join(' ')
        .toLowerCase();
      const matchesSearch = haystack.includes(search.toLowerCase());
      const life = resolveLifecycle(c);
      let matchesStatus = true;
      if (clinicStatusFilter === 'active') matchesStatus = life.key === 'active';
      if (clinicStatusFilter === 'trialing') matchesStatus = life.key === 'trialing';
      if (clinicStatusFilter === 'expiring') matchesStatus = life.key === 'expiring';
      if (clinicStatusFilter === 'past_due') matchesStatus = life.key === 'past_due';
      if (clinicStatusFilter === 'expired') matchesStatus = life.key === 'expired';

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

  const billingClinics = useMemo(() => {
    return clinics.filter((c) => {
      const life = resolveLifecycle(c);
      const haystack = [c.name, c.id, c.owner_email, c.email, c.doctor_name, c.phone, c.payme_merchant_id, c.click_service_id].join(' ').toLowerCase();
      if (billingSearch && !haystack.includes(billingSearch.toLowerCase())) return false;
      if (billingPlan === 'basic' && c.plan !== 'basic') return false;
      if (billingPlan === 'pro' && c.plan === 'basic') return false;
      if (billingLife !== 'all' && life.key !== billingLife) return false;
      return true;
    });
  }, [clinics, billingSearch, billingPlan, billingLife]);

  const filteredLedger = useMemo(() => {
    return ledger.filter((row) => {
      const haystack = `${row.clinic_name || ''} ${row.clinic_id || ''}`.toLowerCase();
      if (billingSearch && !haystack.includes(billingSearch.toLowerCase())) return false;
      if (ledgerMethod !== 'all' && row.method !== ledgerMethod) return false;
      if (ledgerStatus !== 'all' && row.status !== ledgerStatus) return false;
      if (billingPlan !== 'all') {
        const clinic = clinics.find((c) => c.id === row.clinic_id);
        if (billingPlan === 'basic' && clinic?.plan !== 'basic') return false;
        if (billingPlan === 'pro' && clinic?.plan === 'basic') return false;
      }
      return true;
    });
  }, [ledger, clinics, billingSearch, billingPlan, ledgerMethod, ledgerStatus]);

  // Clinic Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.id || !form.name || (!editingClinic && !form.password)) { 
      toast.error('Barcha majburiy maydonlarni to\'ldiring!'); 
      return; 
    }

    if (!/^[a-zA-Z0-9_]+$/.test(form.id)) {
      toast.error('Klinika ID faqat lotin harflari, sonlar va _ belgisidan iborat bo\'lishi shart!');
      return;
    }
    
    try {
      const billing = stripAdminFields(normalizeClinicBilling({
        ...form,
        password: form.password || editingClinic?.password || '',
      }));
      if (!billing.subscription_status) delete billing.subscription_status;

      if (editingClinic) {
        const updatedClinic = { ...editingClinic, ...billing };
        if (!billing.subscription_status) delete updatedClinic.subscription_status;
        delete updatedClinic.admin_password;
        delete updatedClinic.admin_username;
        delete updatedClinic.admin_name;
        const newClinics = clinics.map(c => c.id === editingClinic.id ? updatedClinic : c);
        await base44.clinic.saveAll(newClinics);
        setClinics(newClinics);
        toast.success('Klinika ma\'lumotlari tahrirlandi');
      } else {
        if (clinics.find(c => c.id.toLowerCase() === form.id.toLowerCase())) { 
          toast.error('Ushbu ID bilan klinika allaqachon mavjud!'); 
          return; 
        }
        
        const newClinic = { 
          ...billing, 
          status: billing.status || 'Active',
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

        toast.success(`'${newClinic.name}' yaratildi`);
        setIssuedCreds({
          clinicName: newClinic.name,
          clinicId: newClinic.id,
          clinicPassword: newClinic.password,
          adminUsername,
          adminPassword,
        });
      }
      
      setModalOpen(false);
      resetForm();
      await loadClinics();
    } catch (error) {
      console.error('Klinika saqlashda xatolik:', error);
      toast.error(`❌ Xatolik: ${error.message || 'Saqlab bo\'lmadi'}`);
    }
  };

  const handleDelete = (id) => {
    const clinic = clinics.find(c => c.id === id);
    setDeleteTarget(clinic || { id, name: id });
  };

  const confirmDeleteClinic = async () => {
    if (!deleteTarget) return;
    const newClinics = clinics.filter(c => c.id !== deleteTarget.id);
    await base44.clinic.saveAll(newClinics);
    setClinics(newClinics);
    setDeleteTarget(null);
    toast.success('Klinika ro\'yxatdan olib tashlandi');
  };

  const markAsPaid = (id) => {
    const clinic = clinics.find(c => c.id === id);
    if (!clinic) return;
    handleOpenRenewModal(clinic);
  };

  const resetForm = (clinic = null) => {
    setShowFormPassword(false);
    if (clinic) {
      setForm({
        ...clinic,
        password: '',
        plan: clinic.plan || 'pro',
        owner_email: clinic.owner_email || clinic.email || '',
        owner_phone: clinic.owner_phone || clinic.phone || '',
        signup_source: clinic.signup_source || (clinic.tariff || clinic.email ? 'landing' : 'manual'),
        subscription_status: clinic.subscription_status || '',
        trial_ends_at: clinic.trial_ends_at || '',
        payme_merchant_id: clinic.payme_merchant_id || '',
        click_service_id: clinic.click_service_id || '',
        click_merchant_id: clinic.click_merchant_id || '',
        webhook_status: clinic.webhook_status || '',
        payment_provider: clinic.payment_provider || 'manual',
      });
    } else {
      const start = new Date();
      start.setDate(start.getDate() + 30);
      setForm({
        id: '', name: '', password: Math.random().toString(36).substring(2, 8), 
        monthly_fee: shifoTariffs.legacyPortalMonthlyFee.pro, plan: 'pro', status: 'Active', 
        expires_at: start.toISOString().split('T')[0],
        last_payment_date: new Date().toISOString().split('T')[0],
        admin_username: '', admin_password: '', admin_name: '',
        owner_email: '', owner_phone: '', signup_source: 'manual',
        subscription_status: 'active', trial_ends_at: '',
        payme_merchant_id: '', click_service_id: '', click_merchant_id: '',
        webhook_status: '', payment_provider: 'manual',
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
      <div className="min-h-screen bg-[#07090d] flex items-center justify-center p-4 font-sans relative overflow-hidden">
        <AnimatedBackground />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 20 }} 
          animate={{ opacity: 1, scale: 1, y: 0 }} 
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative z-10 w-full max-w-[420px]"
        >
          <div className="relative bg-[#0d0f18]/90 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-teal-400" />
            
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 bg-teal-500 rounded-2xl flex items-center justify-center shadow-xl shadow-teal-900/40 border border-white/15">
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
                    className="h-11 pl-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-sm focus:border-teal-400" 
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
                    className="h-11 pl-10 bg-white/[0.04] border-white/10 rounded-xl text-white text-sm focus:border-teal-400" 
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={loginLoading} 
                className="w-full h-12 mt-2 bg-teal-500 hover:bg-teal-400 text-[#04221e] rounded-xl font-semibold tracking-wide shadow-lg shadow-teal-950/40 transition-all"
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
              <span>v2.6.0</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Super Admin Main Dashboard
  return (
    <div className="min-h-screen bg-[#07090d] font-sans text-slate-100 relative">
      <AnimatedBackground />

      <header className="sticky top-0 z-40 bg-[#07090d]/90 backdrop-blur-xl border-b border-white/[0.06] px-4 md:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-teal-500 rounded-xl flex items-center justify-center shadow-lg shadow-teal-950/50 flex-shrink-0">
              <ShieldCheck className="w-5 h-5 text-[#04221e]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-semibold text-white tracking-tight">SuperAdmin Nexus</h1>
                <span className="text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full bg-teal-400/15 text-teal-200 border border-teal-300/25">
                  Global
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">Boshqaruv xonasi — klinikalar, obuna va to'lovlar</p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-xl text-xs">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-300" />
              <span className="text-slate-400">Faol obuna:</span>
              <strong className="text-white tabular-nums">{stats.active}/{stats.total}</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-teal-300" />
              <strong className="text-white tabular-nums">{stats.totalUsers}</strong>
            </div>
            <span className="text-slate-700">|</span>
            <div className="flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-teal-300" />
              <strong className="text-teal-200 tabular-nums">{formatMoney(stats.mrr)} UZS</strong>
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
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-teal-300' : ''}`} />
              <span className="hidden sm:inline ml-1.5">Yangilash</span>
            </Button>

            <Button 
              onClick={handleExportBackup} 
              variant="outline" 
              size="sm" 
              className="h-9 px-3 bg-white/[0.04] border-white/10 hover:bg-white/[0.08] text-slate-300 rounded-xl text-xs"
              title="Tizim zaxirasini yuklab olish"
            >
              <Download className="w-3.5 h-3.5 text-teal-300" />
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
        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-[#0e141c] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Jami klinikalar</span>
              <Building2 className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">{stats.total}</div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.05]">
              <span>PRO {stats.proCount}</span>
              <span>BASIC {stats.basicCount}</span>
              <span>Maxsus {stats.customCount}</span>
            </div>
          </div>

          <div className="bg-[#0e141c] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Obuna holati</span>
              <CalendarDays className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">{stats.active}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">faol obuna</p>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-400 pt-2 border-t border-white/[0.05]">
              <span>Sinov <strong className="text-teal-200">{stats.trialing}</strong></span>
              <span>Tugayapti <strong className="text-amber-200">{stats.expiring}</strong></span>
              <span>≤15 kun <strong className="text-slate-200">{stats.watch}</strong></span>
            </div>
          </div>

          <div className="bg-[#0e141c] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">E'tibor talab</span>
              <AlertTriangle className="w-4 h-4 text-amber-300" />
            </div>
            <div className="text-3xl font-semibold text-white tabular-nums tracking-tight">{stats.pastDue + stats.expired}</div>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.05]">
              <span>Qarzdor <strong className="text-orange-200">{stats.pastDue}</strong></span>
              <span>Tugagan <strong className={stats.expired ? 'text-rose-300' : 'text-slate-300'}>{stats.expired}</strong></span>
            </div>
          </div>

          <div className="bg-[#0e141c] border border-white/[0.07] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">Oylik MRR</span>
              <CreditCard className="w-4 h-4 text-teal-300" />
            </div>
            <div className="text-[28px] leading-none font-semibold text-white tabular-nums tracking-tight">{formatMoney(stats.mrr)}</div>
            <p className="text-[11px] text-slate-500 mt-1">UZS · faol va tugayotgan</p>
            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.05]">
              <span>Xavf ostida</span>
              <strong className="text-orange-200 tabular-nums">{formatMoney(stats.atRisk)}</strong>
            </div>
          </div>
        </div>

        {/* Analytics Dinamikasi (Compact & Collapsible) */}
        <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-teal-300" />
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
                          <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.35}/>
                          <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 9 }} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0f111a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px' }} 
                        formatter={(val) => [`${Number(val).toLocaleString()} UZS`, 'MRR']}
                      />
                      <Area type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={2.5} fillOpacity={1} fill="url(#revenueGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2: Klinikalar va Xodimlar */}
              <div className="bg-black/20 border border-white/5 rounded-xl p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-300">Klinikalar va Foydalanuvchilar O'sishi</span>
                  <span className="text-[10px] text-teal-300 font-semibold flex items-center gap-1">
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
                      <Bar dataKey="clinics" name="Klinikalar" fill="#2dd4bf" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="users" name="Foydalanuvchilar" fill="#115e59" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PRIMARY TAB NAVIGATION BAR */}
        <div className="sticky top-[60px] z-30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 py-2 -mx-4 px-4 md:-mx-8 md:px-8 bg-[#07090d]/95 backdrop-blur-xl border-b border-white/[0.06]">
          
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl">
            <button
              onClick={() => setActiveTab('clinics')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'clinics'
                  ? 'bg-teal-500 text-[#04221e] shadow-sm'
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
                  ? 'bg-teal-500 text-[#04221e] shadow-sm'
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
                  ? 'bg-teal-500 text-[#04221e] shadow-sm'
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
                  ? 'bg-teal-500 text-[#04221e] shadow-sm'
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
                  ? 'bg-teal-500 text-[#04221e] shadow-sm'
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
                className="h-9 px-4 bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs rounded-xl"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Yangi Klinika
              </Button>
            )}

            {activeTab === 'users' && (
              <Button 
                onClick={() => handleAddUser()} 
                className="h-9 px-4 bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs rounded-xl"
              >
                <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Yangi Foydalanuvchi
              </Button>
            )}

            {activeTab === 'ads' && (
              <Button 
                onClick={handleAddAd} 
                className="h-9 px-4 bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs rounded-xl"
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
                  placeholder="Nom, ID, email yoki telefon..." 
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
                    onClick={() => setClinicStatusFilter('trialing')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicStatusFilter === 'trialing' ? 'bg-teal-500/20 text-teal-200' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Sinov ({stats.trialing})
                  </button>
                  <button 
                    onClick={() => setClinicStatusFilter('expiring')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicStatusFilter === 'expiring' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Tugayapti ({stats.expiring})
                  </button>
                  <button 
                    onClick={() => setClinicStatusFilter('past_due')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicStatusFilter === 'past_due' ? 'bg-orange-500/20 text-orange-200' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    Qarzdor ({stats.pastDue})
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
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${clinicPlanFilter === 'pro' ? 'bg-teal-500/20 text-teal-200' : 'text-slate-400'}`}
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
            <div className="bg-[#0e141c] border border-white/[0.07] rounded-2xl overflow-hidden">
              <div className="overflow-auto max-h-[640px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-[#121920] border-b border-white/[0.06] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
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
                        <td colSpan={7} className="py-14 text-center text-slate-500">
                          <Building2 className="w-8 h-8 mx-auto mb-2 text-teal-700" />
                          <p className="text-sm font-medium text-slate-300">Mos klinika topilmadi</p>
                          <p className="text-xs mt-1">Qidiruv yoki holat filtrini tozalang.</p>
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
                                <div className="w-9 h-9 rounded-xl bg-teal-500/15 border border-teal-400/20 flex items-center justify-center font-semibold text-teal-100 text-sm flex-shrink-0">
                                  {c.name?.charAt(0).toUpperCase() || 'K'}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-white truncate">{c.name}</span>
                                    <LifecycleBadge clinic={c} />
                                  </div>
                                  {(c.doctor_name || c.phone || c.email) && (
                                    <p className="text-[11px] text-slate-400 mt-0.5 max-w-[220px] truncate" title={[c.doctor_name, c.phone, c.email].filter(Boolean).join(' · ')}>
                                      {[c.doctor_name, c.phone, c.email].filter(Boolean).join(' · ')}
                                    </p>
                                  )}
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
                                  <p className="text-[10px] text-slate-500 mt-0.5 truncate max-w-[240px]">
                                    {(c.owner_email || c.email) || 'Email yo\'q'} · {(c.owner_phone || c.phone) || 'Tel yo\'q'} · {SOURCE_LABELS[c.signup_source] || (c.tariff ? 'Landing' : 'Qo\'lda')}
                                  </p>
                                </div>
                              </div>
                            </td>

                            {/* 2. Plan */}
                            <td className="py-3.5 px-4">
                              {landingTariffLabel(c) ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-500/15 text-teal-100 text-[10px] font-semibold uppercase tracking-wider border border-teal-400/25">
                                    {landingTariffLabel(c)}
                                  </span>
                                  <p className="text-[10px] text-slate-500">{c.plan === 'basic' ? 'BASIC' : 'PRO'}</p>
                                </div>
                              ) : c.plan === 'basic' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 text-[10px] font-black uppercase tracking-wider border border-slate-700">
                                  ⭐ BASIC
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-500/15 text-teal-100 text-[10px] font-semibold uppercase tracking-wider border border-teal-400/25">
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
                                  onClick={() => requestRevealPassword(c.id)} 
                                  className="text-slate-400 hover:text-white p-0.5"
                                  title={isPassRevealed ? 'Yashirish' : 'Tasdiqlab ko\'rsatish'}
                                >
                                  {isPassRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </button>
                                <button 
                                  onClick={() => requestCopyPassword(c.password)} 
                                  className="text-slate-400 hover:text-white p-0.5"
                                  title="Tasdiqlab nusxalash"
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
                                <p className="font-semibold text-white text-xs tabular-nums">{formatMoney(c.monthly_fee)} <span className="text-[10px] text-slate-400 font-normal">UZS</span></p>
                                {isCustomMonthly(c) && (
                                  <p className="text-[10px] text-teal-300">Maxsus · katalog {formatMoney(catalogAmount(c.plan))}</p>
                                )}
                                <p className={`text-[10px] ${overdue ? 'text-orange-300' : 'text-emerald-400'}`}>
                                  Oxirgi: {c.last_payment_date || 'To\'lanmagan'}
                                </p>
                                {landingPayLabel(c.payment_method) && (
                                  <p className="text-[10px] text-slate-400">{landingPayLabel(c.payment_method)}</p>
                                )}
                                {c.billing_status && (
                                  <p className={`text-[10px] font-semibold ${c.access_unlocked ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {c.access_unlocked ? 'Kirish ochiq' : 'Kirish yopiq'}
                                  </p>
                                )}
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
                                  className="h-8 px-2.5 bg-teal-500/10 border-teal-400/30 text-teal-100 hover:bg-teal-500/20 text-xs font-semibold rounded-lg"
                                  title="Klinika boshqaruviga kirish"
                                >
                                  <KeyRound className="w-3.5 h-3.5 mr-1 text-teal-300" />
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
              <div className="overflow-auto max-h-[640px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-[#121920] border-b border-white/[0.06] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
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
                        <td colSpan={6} className="py-14 text-center text-slate-500">
                          <Users className="w-8 h-8 mx-auto mb-2 text-teal-700" />
                          <p className="text-sm font-medium text-slate-300">Foydalanuvchi topilmadi</p>
                          <p className="text-xs mt-1">Boshqa klinika yoki rolni tanlang.</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const clinic = clinics.find(c => c.id?.toLowerCase() === u.clinic_id?.toLowerCase());

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
                                  {u.phone ? <p className="text-[10px] text-slate-500">{u.phone}</p> : null}
                                  {typeof u.notes === 'string' && u.notes.includes('@') ? <p className="text-[10px] text-slate-500">{u.notes}</p> : null}
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
                              <span className="text-[11px] text-slate-500 tracking-widest" title="Xodim paroli ko'rsatilmaydi">
                                ••••••••
                              </span>
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
              <div className="overflow-auto max-h-[640px]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="sticky top-0 z-10 bg-[#121920] border-b border-white/[0.06] text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
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
                        <td colSpan={6} className="py-14 text-center text-slate-500">
                          <ImageIcon className="w-8 h-8 mx-auto mb-2 text-teal-700" />
                          <p className="text-sm font-medium text-slate-300">Reklama hali yo'q</p>
                          <p className="text-xs mt-1">Banner qo'shish uchun yuqoridagi tugmani bosing.</p>
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

        {activeTab === 'billing' && (
          <BillingPanel
            clinics={billingClinics}
            catalogClinics={clinics}
            stats={stats}
            ledger={filteredLedger}
            billingSearch={billingSearch}
            setBillingSearch={setBillingSearch}
            billingPlan={billingPlan}
            setBillingPlan={setBillingPlan}
            billingLife={billingLife}
            setBillingLife={setBillingLife}
            ledgerMethod={ledgerMethod}
            setLedgerMethod={setLedgerMethod}
            ledgerStatus={ledgerStatus}
            setLedgerStatus={setLedgerStatus}
            onAcceptPayment={markAsPaid}
          />
        )}

        {/* ════════════════════ TAB 5: TIZIM VA ZAXIRA (SYSTEM) ════════════════════ */}
        {activeTab === 'system' && (
          <div className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="w-4 h-4 text-teal-300" />
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
                    <strong className="text-white">v2.6.0</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-slate-400">Offline Fallback:</span>
                    <strong className="text-emerald-400">Yoqilgan (LocalStorage Sync)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">To'lov daftari:</span>
                    <strong className="text-white">{ledger.length} yozuv</strong>
                  </div>
                </div>
              </div>

              <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Download className="w-4 h-4 text-teal-300" />
                    <h4 className="text-sm font-bold text-white">Tizim Zaxira Nusxasi (Backup)</h4>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">Barcha klinika va foydalanuvchilar ma'lumotlarini to'liq JSON formatida eksport qiling.</p>
                </div>
                <Button 
                  onClick={handleExportBackup}
                  className="w-full bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs h-10 rounded-xl"
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
        <DialogContent className="max-w-[640px] max-h-[88vh] overflow-y-auto rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Building2 className="w-5 h-5 text-teal-300" />
              {editingClinic ? 'Klinika ma\'lumotlarini tahrirlash' : 'Yangi klinika yaratish'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Klinika asosiy ma'lumotlari, ta'rifi va administrator hisobini sozlang.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Klinika ID *</Label>
                <Input 
                  disabled={!!editingClinic} 
                  value={form.id} 
                  onChange={e => setForm({...form, id: e.target.value})} 
                  placeholder="star_med" 
                  className={FIELD} 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">{editingClinic ? 'Yangi master parol' : 'Master parol *'}</Label>
                <div className="relative">
                  <Input 
                    type={showFormPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={form.password} 
                    onChange={e => setForm({...form, password: e.target.value})} 
                    placeholder={editingClinic ? 'Bo\'sh qolsa o\'zgarmaydi' : 'Parol'} 
                    className={`${FIELD} pr-10`} 
                  />
                  <button type="button" onClick={() => setShowFormPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showFormPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
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
                className={FIELD} 
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Egasi emaili</Label>
                <Input value={form.owner_email || ''} onChange={e => setForm({...form, owner_email: e.target.value})} placeholder="owner@klinika.uz" className={FIELD} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Egasi telefoni</Label>
                <Input value={form.owner_phone || ''} onChange={e => setForm({...form, owner_phone: e.target.value})} placeholder="+998 90 000 00 00" className={FIELD} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Ro'yxat manbai</Label>
                <select value={form.signup_source || 'manual'} onChange={e => setForm({...form, signup_source: e.target.value})} className={SELECT}>
                  <option value="manual" className="bg-slate-900">Qo'lda</option>
                  <option value="landing" className="bg-slate-900">Landing</option>
                  <option value="telegram" className="bg-slate-900">Telegram</option>
                  <option value="referral" className="bg-slate-900">Tavsiya</option>
                  <option value="other" className="bg-slate-900">Boshqa</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Obuna holati</Label>
                <select value={form.subscription_status || 'auto'} onChange={e => setForm({...form, subscription_status: e.target.value === 'auto' ? '' : e.target.value})} className={SELECT}>
                  <option value="auto" className="bg-slate-900">Sanalardan hisoblansin</option>
                  <option value="trialing" className="bg-slate-900">Sinov (14 kun)</option>
                  <option value="active" className="bg-slate-900">Faol</option>
                  <option value="past_due" className="bg-slate-900">Qarzdor</option>
                  <option value="expired" className="bg-slate-900">Tugagan</option>
                </select>
              </div>
            </div>

            {!editingClinic && (
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-400/20 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5 text-teal-300" />
                  <span className="text-[11px] font-semibold text-teal-100 uppercase">Klinika bosh administratori</span>
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
                      type="password"
                      autoComplete="new-password"
                      value={form.admin_password || ''} 
                      onChange={e => setForm({...form, admin_password: e.target.value})} 
                      placeholder="Bo'sh bo'lsa master parol" 
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Ta'rif</Label>
                <select 
                  value={form.plan || 'pro'} 
                  onChange={e => {
                    const newPlan = e.target.value;
                    const legacy = shifoTariffs.legacyPortalMonthlyFee;
                    const current = Number(form.monthly_fee);
                    const wasLegacy = current === legacy.basic || current === legacy.pro;
                    const nextFee = wasLegacy || !current
                      ? (newPlan === 'basic' ? legacy.basic : legacy.pro)
                      : current;
                    setForm({ ...form, plan: newPlan, monthly_fee: nextFee });
                  }} 
                  className={SELECT}
                >
                  <option value="basic" className="bg-slate-900 text-white">BASIC · qo'lda {shifoTariffs.legacyPortalMonthlyFee.basic.toLocaleString()} UZS</option>
                  <option value="pro" className="bg-slate-900 text-white">PRO · qo'lda {shifoTariffs.legacyPortalMonthlyFee.pro.toLocaleString()} UZS</option>
                </select>
                <p className="text-[10px] leading-snug text-slate-500">
                  Landing narxlari: {shifoTariffs.tariffs.filter((plan) => plan.id !== 'trial').map((plan) => `${plan.name} ${plan.priceUzs.toLocaleString()} → ${plan.crmPlan.toUpperCase()}`).join(', ')}.
                  Qo'lda yaratilgan klinika {shifoTariffs.legacyPortalMonthlyFee.basic.toLocaleString()} / {shifoTariffs.legacyPortalMonthlyFee.pro.toLocaleString()} UZS da qoladi.
                </p>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Oylik summa (maxsus bo'lishi mumkin)</Label>
                <Input 
                  type="number"
                  value={form.monthly_fee} 
                  onChange={e => setForm({...form, monthly_fee: Number(e.target.value)})} 
                  className={FIELD} 
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 -mt-2">Start → BASIC, Pro va Klinika → PRO. Summani o'zgartirsangiz maxsus narx saqlanadi.</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Kirish holati</Label>
                <select 
                  value={form.status} 
                  onChange={e => setForm({...form, status: e.target.value})} 
                  className={SELECT}
                >
                  <option value="Active" className="bg-slate-900 text-white">Faol (kirish ochiq)</option>
                  <option value="Inactive" className="bg-slate-900 text-white">Nofaol (kirish yopiq)</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Obuna tugash sanasi</Label>
                <Input type="date" value={form.expires_at || ''} onChange={e => setForm({...form, expires_at: e.target.value})} className={FIELD} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Sinov tugashi</Label>
                <Input type="date" value={form.trial_ends_at || ''} onChange={e => setForm({...form, trial_ends_at: e.target.value})} className={FIELD} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">To'lov usuli</Label>
                <select value={form.payment_provider || 'manual'} onChange={e => setForm({...form, payment_provider: e.target.value})} className={SELECT}>
                  <option value="manual" className="bg-slate-900">Qo'lda</option>
                  <option value="payme" className="bg-slate-900">Payme</option>
                  <option value="click" className="bg-slate-900">Click</option>
                  <option value="mock" className="bg-slate-900">Mock</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Payme merchant ID</Label>
                <Input value={form.payme_merchant_id || ''} onChange={e => setForm({...form, payme_merchant_id: e.target.value})} placeholder="merchant id" className={FIELD} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Click service ID</Label>
                <Input value={form.click_service_id || ''} onChange={e => setForm({...form, click_service_id: e.target.value})} placeholder="service id" className={FIELD} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Click merchant ID</Label>
                <Input value={form.click_merchant_id || ''} onChange={e => setForm({...form, click_merchant_id: e.target.value})} placeholder="merchant id" className={FIELD} />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 uppercase">Webhook holati</Label>
                <select value={form.webhook_status || ''} onChange={e => setForm({...form, webhook_status: e.target.value})} className={SELECT}>
                  <option value="" className="bg-slate-900">Avto</option>
                  <option value="not_configured" className="bg-slate-900">Sozlanmagan</option>
                  <option value="waiting" className="bg-slate-900">Kutilmoqda</option>
                  <option value="received" className="bg-slate-900">Qabul qilindi</option>
                  <option value="failed" className="bg-slate-900">Xato</option>
                </select>
              </div>
            </div>

            <div className="pt-3 flex gap-2 border-t border-white/10">
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)} className="flex-1 h-10 rounded-xl text-slate-400 text-xs">
                Bekor qilish
              </Button>
              <Button type="submit" className="flex-[2] h-10 bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs rounded-xl">
                {editingClinic ? 'O\'zgarishlarni saqlash' : 'Klinikani yaratish'}
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
                  <Label className="text-[10px] font-bold text-slate-400 uppercase">
                    {editingUser ? "Yangi parol (bo'sh = o'zgarmaydi)" : 'Parol *'}
                  </Label>
                  <button 
                    type="button" 
                    onClick={() => setUserForm({...userForm, password: Math.random().toString(36).substring(2, 8)})}
                    className="text-[9px] text-cyan-400 hover:underline"
                  >
                    Avto-generatsiya
                  </button>
                </div>
                <Input 
                  type="password"
                  autoComplete="new-password"
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
      <Dialog open={renewModalOpen} onOpenChange={(open) => { if (!paySaving) setRenewModalOpen(open); }}>
        <DialogContent className="max-w-[460px] rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-teal-300" />
              To'lovni tasdiqlash
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {renewingClinic?.name} ({renewingClinic?.id}). Tasdiqlamaguncha muddat va daftar o'zgarmaydi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-500/10 border border-amber-400/20 rounded-xl text-amber-100 leading-relaxed">
              Bu amal to'lovni daftarga yozadi, oxirgi to'lov sanasini yangilaydi va obunani uzaytiradi.
            </div>
            <div className="p-3 bg-white/[0.03] border border-white/5 rounded-xl space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>Hozirgi muddat</span>
                <strong className="text-white">{renewingClinic?.expires_at || 'Muddatsiz'}</strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Yangi muddat</span>
                <strong className="text-teal-200">{renewingClinic ? extendExpiry(renewingClinic.expires_at, renewMonths * 30) : '—'}</strong>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-semibold text-slate-400 uppercase">Davr</Label>
              <div className="grid grid-cols-4 gap-2">
                {[1, 3, 6, 12].map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setRenewMonths(m)}
                    className={`py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      renewMonths === m 
                        ? 'bg-teal-500/20 border-teal-400/50 text-teal-100' 
                        : 'bg-white/[0.03] border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    +{m} oy
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-400 uppercase">Usul</Label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className={SELECT}>
                  <option value="manual" className="bg-slate-900">Qo'lda</option>
                  <option value="payme" className="bg-slate-900">Payme</option>
                  <option value="click" className="bg-slate-900">Click</option>
                  <option value="mock" className="bg-slate-900">Mock</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-semibold text-slate-400 uppercase">Summa (UZS)</Label>
                <Input
                  type="number"
                  value={payAmount}
                  onChange={e => { setPayAmountTouched(true); setPayAmount(Number(e.target.value)); }}
                  className={FIELD}
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              Webhook: {WEBHOOK_LABELS[webhookStatusFor(renewingClinic, payMethod)] || '—'}. 
              {payMethod === 'payme' && !renewingClinic?.payme_merchant_id ? ' Payme merchant ID kiritilmagan.' : ''}
              {payMethod === 'click' && !(renewingClinic?.click_service_id || renewingClinic?.click_merchant_id) ? ' Click identifikatori kiritilmagan.' : ''}
            </p>

            <div className="flex gap-2 pt-2">
              <Button 
                variant="ghost" 
                onClick={() => setRenewModalOpen(false)} 
                disabled={paySaving}
                className="flex-1 h-10 text-xs rounded-xl text-slate-400"
              >
                Bekor qilish
              </Button>
              <Button 
                onClick={handleConfirmRenew} 
                disabled={paySaving}
                className="flex-[2] h-10 bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs rounded-xl"
              >
                {paySaving ? 'Saqlanmoqda...' : `${formatMoney(payAmount)} UZS qabul qilish`}
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
                    <Building2 className="w-5 h-5 text-teal-300" />
                    <span>{selectedClinicForDetail.name}</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-lg ${
                    selectedClinicForDetail.plan === 'basic' ? 'bg-slate-800 text-slate-300' : 'bg-teal-500/15 text-teal-100 border border-teal-400/30'
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
                    <span className="text-slate-400 text-[10px] block">Master parol</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <strong className="font-mono text-white text-xs">{revealedPasswords[selectedClinicForDetail.id] ? selectedClinicForDetail.password : '••••••'}</strong>
                      <button type="button" onClick={() => requestRevealPassword(selectedClinicForDetail.id)} className="text-slate-400 hover:text-white">
                        {revealedPasswords[selectedClinicForDetail.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={() => requestCopyPassword(selectedClinicForDetail.password)} className="text-slate-400 hover:text-white">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Obuna</span>
                    <strong className="text-white text-xs">{selectedClinicForDetail.expires_at || 'Muddatsiz'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Oylik to'lov</span>
                    <strong className="text-teal-200 text-xs">{formatMoney(selectedClinicForDetail.monthly_fee)} UZS</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Egasi</span>
                    <strong className="text-white text-xs">{selectedClinicForDetail.doctor_name || selectedClinicForDetail.owner_email || selectedClinicForDetail.email || '—'}</strong>
                    <span className="block text-[10px] text-slate-500">{selectedClinicForDetail.owner_email || selectedClinicForDetail.email || ''} · {selectedClinicForDetail.owner_phone || selectedClinicForDetail.phone || ''} · {SOURCE_LABELS[selectedClinicForDetail.signup_source] || (selectedClinicForDetail.tariff ? 'Landing' : 'Qo\'lda')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 text-[10px] block">Provayder</span>
                    <strong className="text-white text-xs">{METHOD_LABELS[selectedClinicForDetail.payment_provider || selectedClinicForDetail.payment_method] || 'Qo\'lda'}</strong>
                    <span className="block text-[10px] text-slate-500">Payme {selectedClinicForDetail.payme_merchant_id || '—'} · Click {selectedClinicForDetail.click_service_id || selectedClinicForDetail.click_merchant_id || '—'}</span>
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
                          <p className="text-[11px] text-slate-400 font-mono">@{user.username}</p>
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
                    className="flex-1 h-10 bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs rounded-xl"
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
              <Button type="submit" className="flex-[2] h-10 bg-teal-500 hover:bg-teal-400 text-[#04221e] font-semibold text-xs rounded-xl">
                {editingAd ? 'O\'zgarishlarni Saqlash' : 'Reklamani Qo\'shish'}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!secretPrompt} onOpenChange={(open) => { if (!open) setSecretPrompt(null); }}>
        <DialogContent className="max-w-[400px] rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-semibold">Parolni tasdiqlang</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {secretPrompt?.mode === 'copy'
                ? 'Parol buferga nusxalanadi. Matn bildirishnomada ko\'rsatilmaydi.'
                : 'Parol jadvalda 20 soniya ochiq turadi, so\'ng yana yashiriladi.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setSecretPrompt(null)} className="flex-1 h-10 text-xs text-slate-400">Bekor qilish</Button>
            <Button onClick={confirmSecret} className="flex-[2] h-10 bg-teal-500 hover:bg-teal-400 text-[#04221e] text-xs font-semibold">Tasdiqlash</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="max-w-[420px] rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-semibold">Klinikani olib tashlash</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {deleteTarget?.name} ro'yxatdan o'chadi. Xodim yozuvlari alohida qoladi. Klinika logini shu ID bilan ishlamaydi.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} className="flex-1 h-10 text-xs text-slate-400">Bekor qilish</Button>
            <Button onClick={confirmDeleteClinic} className="flex-[2] h-10 bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold">O'chirish</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!issuedCreds} onOpenChange={(open) => { if (!open) setIssuedCreds(null); }}>
        <DialogContent className="max-w-[440px] rounded-3xl p-6 border border-white/10 bg-[#0d0f18] text-white">
          <DialogHeader className="mb-2">
            <DialogTitle className="text-lg font-semibold">Kirish ma'lumotlari</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              Parol shu oynada bir marta ko'rsatiladi. Jadvalda u yashirin turadi.
            </DialogDescription>
          </DialogHeader>
          {issuedCreds && (
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="text-slate-400">Klinika ID</span>
                <button type="button" className="font-mono text-white" onClick={() => copyToClipboard(issuedCreds.clinicId, 'Klinika ID')}>{issuedCreds.clinicId}</button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="text-slate-400">Admin login</span>
                <button type="button" className="font-mono text-white" onClick={() => copyToClipboard(issuedCreds.adminUsername, 'Login')}>{issuedCreds.adminUsername}</button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2">
                <span className="text-slate-400">Admin parol</span>
                <button type="button" className="font-mono text-teal-200" onClick={() => copyToClipboard(issuedCreds.adminPassword, 'Parol', { sensitive: true })}>{issuedCreds.adminPassword}</button>
              </div>
            </div>
          )}
          <Button onClick={() => setIssuedCreds(null)} className="w-full h-10 mt-3 bg-teal-500 hover:bg-teal-400 text-[#04221e] text-xs font-semibold">Yopish</Button>
        </DialogContent>
      </Dialog>

    </div>
  );
}

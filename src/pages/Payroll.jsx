import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DollarSign, Users, TrendingUp, Calendar, Download, 
  Plus, Search, ChevronDown, Trash2,
  Activity, ArrowRight, Shield
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@/i18n/LanguageContext';
import toast from 'react-hot-toast';

/**
 * Payroll Page
 * 
 * Doctor commission tracking and salary calculation system.
 * Features: commission rates, service-based earnings, monthly reports.
 */
export default function Payroll() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
    }
  }, [isAdmin, navigate]);

  // Check for navigation state to open modal
  useEffect(() => {
    if (location.state?.openAddDoctor) {
      setAddDoctorOpen(true);
      // Clear state to avoid reopening on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Data states
  const [doctors, setDoctors] = useState([]);
  const [services, setServices] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedDoctorForSettings, setSelectedDoctorForSettings] = useState(null);
  const [expandedDoctor, setExpandedDoctor] = useState(null);
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [newDoctorForm, setNewDoctorForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    specialization: 'Stomatolog',
    base_salary: 0,
    commission_rate: 30,
    role: 'doctor'
  });

  /**
   * Load all data
   * @param {Array} preserveDoctors - doctors to keep in list even if not in DB
   */
  const loadData = useCallback(async (preserveDoctors = []) => {
    try {
      setLoading(true);
      const [users, svcs, treats, pays] = await Promise.all([
        base44.entities.User.list('name', 100),
        base44.entities.Service.list('name', 200),
        base44.entities.TreatmentPlan.filter({ status: 'Completed' }, '-updated_date', 100), // ⚡
        base44.entities.Payment.filter({ type: 'Income' }, '-date', 100)  // ⚡
      ]);
      // Include all staff roles in the payroll view if they have salaries or commissions
      const staffUsers = users.filter(u => ['doctor', 'admin', 'receptionist'].includes(u.role || ''));
      
      // Also check the auth system_users localStorage (fallback storage for users)
      try {
        const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
        const sysUsersRaw = localStorage.getItem('system_users');
        const mockUsersRaw = localStorage.getItem(`mock_db_${clinicId}_User`);
        const sysUsers = sysUsersRaw ? JSON.parse(sysUsersRaw) : [];
        const mockUsers = mockUsersRaw ? JSON.parse(mockUsersRaw) : [];
        
        [...sysUsers, ...mockUsers].forEach(lu => {
          const isStaff = ['doctor', 'admin', 'receptionist'].includes(lu.role || '');
          const isThisClinic = lu.clinic_id === clinicId;
          const alreadyInList = staffUsers.find(u => u.id === lu.id);
          if (isStaff && isThisClinic && !alreadyInList) {
            staffUsers.push(lu);
          }
        });
      } catch (e) { /* ignore localStorage errors */ }
      
      // Merge with any locally-added doctors that may not be in Supabase yet
      if (Array.isArray(preserveDoctors) && preserveDoctors.length > 0) {
        preserveDoctors.forEach(pd => {
          if (!staffUsers.find(u => u.id === pd.id)) {
            staffUsers.push(pd);
          }
        });
      }
      
      setDoctors(staffUsers);
      setServices(svcs);
      setTreatments(treats);
      setPayments(pays);
    } catch (error) {
      console.error('Failed to load payroll data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const [addingDoctor, setAddingDoctor] = useState(false);

  /**
   * Add new doctor
   */
  const handleAddDoctor = useCallback(async () => {
    if (!newDoctorForm.full_name?.trim()) {
      toast.error('Ism va Familiya majburiy!');
      return;
    }
    
    setAddingDoctor(true);
    try {
      const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
      
      // Auto-generate unique username and simple password
      const firstName = newDoctorForm.full_name.trim().split(' ')[0] || 'dr';
      const baseName = firstName.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const randomSuffix = Math.floor(Math.random() * 9000 + 1000).toString();
      const cleanUsername = `${baseName}_${randomSuffix}`;
      const generatedPassword = Math.floor(100000 + Math.random() * 900000).toString();

      const savedName = newDoctorForm.full_name.trim();

      const newUser = await base44.entities.User.create({
        id: 'usr-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        name: savedName,
        full_name: savedName,
        username: cleanUsername,
        password: generatedPassword,
        role: 'doctor',
        clinic_id: clinicId,
        phone: newDoctorForm.phone || '',
        specialty: newDoctorForm.specialization || 'Stomatolog',
        base_salary: Number(newDoctorForm.base_salary || 0),
        commission_rate: Number(newDoctorForm.commission_rate || 30)
      });

      // Optimistic update - add to list immediately
      const optimisticDoctor = {
        id: newUser?.id || ('usr-temp-' + Date.now()),
        name: savedName,
        full_name: savedName,
        role: 'doctor',
        clinic_id: clinicId,
        phone: newDoctorForm.phone || '',
        specialty: newDoctorForm.specialization || 'Stomatolog',
        base_salary: Number(newDoctorForm.base_salary || 0),
        commission_rate: Number(newDoctorForm.commission_rate || 30),
        ...(newUser || {})
      };
      setDoctors(prev => {
        // Avoid duplicates
        const exists = prev.find(d => d.id === optimisticDoctor.id);
        return exists ? prev : [...prev, optimisticDoctor];
      });

      setAddDoctorOpen(false);
      setNewDoctorForm({
        full_name: '',
        username: '',
        password: '',
        phone: '',
        specialization: 'Stomatolog',
        base_salary: 0,
        commission_rate: 30,
        role: 'doctor'
      });

      setCredentialsModal({
        name: savedName,
        clinicId: clinicId,
        username: cleanUsername,
        password: generatedPassword
      });

      toast.success(`${savedName} muvaffaqiyatli qo'shildi!`);
      
      // Sync from DB but PRESERVE the new doctor even if not yet in Supabase
      setTimeout(() => loadData([optimisticDoctor]), 2000);
      
    } catch (error) {
      console.error('Failed to add doctor:', error);
      const msg = error?.message || '';
      if (msg.includes('23505')) {
        toast.error('Bu username allaqachon mavjud. Qaytadan urinib ko\'ring.');
      } else {
        toast.error('Shifokor qo\'shishda xatolik: ' + (msg || 'Noma\'lum xatolik'));
      }
    } finally {
      setAddingDoctor(false);
    }
  }, [newDoctorForm, loadData]);

  /**
   * Delete a doctor
   */
  const handleDeleteDoctor = useCallback(async (id, name) => {
    if (window.confirm(`Haqiqatan ham "${name}" ni o'chirib tashlamoqchimisiz? Ushbu amalni ortga qaytarib bo'lmaydi.`)) {
      try {
        await base44.entities.User.delete(id);
        toast.success(`${name} o'chirildi!`);
        // Remove locally from state to update UI immediately
        setDoctors(prev => prev.filter(d => d.id !== id));
      } catch (error) {
        console.error('Failed to delete doctor:', error);
        toast.error(error?.message || 'O\'chirishda xatolik yuz berdi!');
      }
    }
  }, []);

  /**
   * Get month range for filtering
   */
  const getMonthRange = useCallback((monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);
    return { startDate, endDate };
  }, []);

  /**
   * Calculate doctor earnings
   */
  const calculateDoctorEarnings = useCallback((doctorId) => {
    const { startDate, endDate } = getMonthRange(selectedMonth);
    const doctorObj = doctors.find(d => d.id === doctorId);
    
    // Filter payments by doctor and month
    const doctorPayments = payments.filter(p => {
      if (!p.doctor_id) return false;
      const paymentDate = new Date(p.date || p.created_date);
      // Ensure we are comparing dates correctly
      const pDateTime = paymentDate.getTime();
      const sDateTime = startDate.getTime();
      const eDateTime = endDate.getTime();
      
      const isInMonth = pDateTime >= sDateTime && pDateTime <= eDateTime;
      // Match by doctor_id (string comparison)
      const isDoctor = String(p.doctor_id) === String(doctorId);
      const isIncome = (p.type || '').toLowerCase() === 'income';
      
      return isDoctor && isInMonth && isIncome;
    });

    // Calculate earnings per payment category
    const earnings = doctorPayments.reduce((acc, pay) => {
      // Use payment's saved commission rate or fallback to doctor's current rate
      const commissionRate = pay.commission_rate || doctorObj?.commission_rate || doctorObj?.commission || 30;
      const commission = (pay.amount || 0) * (commissionRate / 100);
      const category = pay.category || 'To\'lovlar';
      
      if (!acc[category]) {
        acc[category] = {
          serviceName: category,
          count: 0,
          totalRevenue: 0,
          totalCommission: 0,
          commissionRate
        };
      }
      
      acc[category].count += 1;
      acc[category].totalRevenue += (pay.amount || 0);
      acc[category].totalCommission += commission;
      return acc;
    }, {});

    const totalRevenue = Object.values(earnings).reduce((sum, e) => sum + e.totalRevenue, 0);
    const totalCommission = Object.values(earnings).reduce((sum, e) => sum + e.totalCommission, 0);

    const now = new Date();
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay() || 7; 
    startOfWeek.setDate(now.getDate() - day + 1);
    startOfWeek.setHours(0,0,0,0);
    
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    let weeklyCommission = 0;
    let currentMonthCommission = 0;
    let yearlyCommission = 0;

    payments.forEach(p => {
      if (String(p.doctor_id) !== String(doctorId) || (p.type || '').toLowerCase() !== 'income') return;
      const paymentDate = new Date(p.date || p.created_date).getTime();
      const commissionRate = p.commission_rate || doctorObj?.commission_rate || doctorObj?.commission || 30;
      const commission = (p.amount || 0) * (commissionRate / 100);

      if (paymentDate >= startOfWeek.getTime()) weeklyCommission += commission;
      if (paymentDate >= startOfMonth.getTime()) currentMonthCommission += commission;
      if (paymentDate >= startOfYear.getTime()) yearlyCommission += commission;
    });

    const baseSalary = doctorObj?.base_salary || 0;

    return {
      treatments: doctorPayments.length,
      earnings,
      totalRevenue,
      totalCommission,
      weeklyTotal: (baseSalary / 4) + weeklyCommission,
      monthlyTotal: baseSalary + currentMonthCommission,
      yearlyTotal: baseSalary * (now.getMonth() + 1) + yearlyCommission
    };
  }, [payments, doctors, selectedMonth, getMonthRange]);

  /**
   * Get all doctors payroll data
   */
  const payrollData = useMemo(() => {
    return doctors.map(doctor => {
      const earnings = calculateDoctorEarnings(doctor.id);
      return {
        ...doctor,
        ...earnings,
        baseSalary: doctor.base_salary || 0,
        totalSalary: (doctor.base_salary || 0) + earnings.totalCommission
      };
    }).filter(d => {
      if (selectedDoctor !== 'all' && d.id !== selectedDoctor) return false;
      // Support both `name` and `full_name` fields
      const doctorName = (d.name || d.full_name || '').toLowerCase();
      if (searchQuery && !doctorName.includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [doctors, calculateDoctorEarnings, selectedDoctor, searchQuery]);

  /**
   * Calculate totals
   */
  const totals = useMemo(() => {
    return payrollData.reduce((acc, doctor) => ({
      totalRevenue: acc.totalRevenue + doctor.totalRevenue,
      totalCommission: acc.totalCommission + doctor.totalCommission,
      totalBaseSalary: acc.totalBaseSalary + doctor.baseSalary,
      totalSalary: acc.totalSalary + doctor.totalSalary,
      totalTreatments: acc.totalTreatments + doctor.treatments
    }), {
      totalRevenue: 0,
      totalCommission: 0,
      totalBaseSalary: 0,
      totalSalary: 0,
      totalTreatments: 0
    });
  }, [payrollData]);

  /**
   * Export to CSV
   */
  const exportCSV = useCallback(() => {
    const headers = ['Shifokor', 'Bazaviy maosh', 'Komissiya', 'Jami', 'Bajarilgan ishlar'];
    const rows = payrollData.map(d => [
      d.full_name,
      d.baseSalary,
      d.totalCommission,
      d.totalSalary,
      d.treatments
    ]);
    
    const csv = [headers, ...rows]
      .map(row => row.join(','))
      .join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${selectedMonth}.csv`;
    a.click();
  }, [payrollData, selectedMonth]);

  return (
    <div className="space-y-6 pb-24 sm:pb-10 bg-slate-50/50 min-h-screen -m-4 p-4 sm:m-0 sm:p-0">
      {/* Premium Header */}
      <div className="flex flex-col gap-5 px-1 sm:px-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-[900] text-slate-900 tracking-tight">{t('payroll.title')}</h1>
            <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
              {t('payroll.subtitle')}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={exportCSV} className="w-10 h-10 rounded-full bg-white shadow-sm border border-slate-100 text-slate-600">
            <Download className="w-4.5 h-4.5" />
          </Button>
        </div>
        <Button 
          onClick={() => setAddDoctorOpen(true)} 
          className="w-full h-12 rounded-2xl bg-[#00D084] hover:bg-[#00B875] text-white font-black gap-2 shadow-xl shadow-[#00D084]/20 transition-all active:scale-[0.98] border-none"
        >
          <Plus className="w-5 h-5 stroke-[3px]" />
          {t('payroll.addDoctor')}
        </Button>
      </div>

      {/* Modern Dashboard Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 px-1 sm:px-0">
        {[
          { label: t('payroll.revenue'), value: totals.totalRevenue, icon: DollarSign, color: "bg-blue-600", lightColor: "bg-blue-50", textColor: "text-blue-600" },
          { label: t('payroll.commission'), value: totals.totalCommission, icon: TrendingUp, color: "bg-emerald-500", lightColor: "bg-emerald-50", textColor: "text-emerald-600" },
          { label: t('payroll.salary'), value: totals.totalSalary, icon: Users, color: "bg-purple-600", lightColor: "bg-purple-50", textColor: "text-purple-600" },
          { label: t('payroll.works'), value: totals.totalTreatments, icon: Calendar, color: "bg-slate-800", lightColor: "bg-slate-100", textColor: "text-slate-800", isNumber: true },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="bg-white border border-slate-100/80 rounded-[1.5rem] p-4 sm:p-6 shadow-sm shadow-slate-200/40 relative group overflow-hidden"
          >
            <div className={`absolute -right-2 -top-2 w-16 h-16 ${s.lightColor} opacity-40 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500`} />
            <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl ${s.lightColor} flex items-center justify-center mb-3 transition-transform group-hover:rotate-6`}>
              <s.icon className={`w-4.5 h-4.5 sm:w-5.5 sm:h-5.5 ${s.textColor}`} />
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] sm:text-xs font-black text-slate-400 uppercase tracking-widest">{s.label}</p>
              <p className="text-base sm:text-xl font-black text-slate-900 tracking-tighter">
                {s.isNumber ? s.value : formatCurrency(s.value).replace(' so\'m', '')}
                {!s.isNumber && <span className="text-[10px] ml-0.5 opacity-50">UZS</span>}
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Floating Filter Bar */}
      <div className="sticky top-2 z-30 bg-white/80 backdrop-blur-xl border border-slate-100 rounded-2xl p-2 sm:p-3 shadow-xl shadow-slate-200/30 mx-1 sm:mx-0 flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input 
            placeholder={t('payroll.doctorName')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-11 pr-4 rounded-xl border-transparent bg-slate-50/50 focus:bg-white transition-colors text-sm font-bold"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="h-11 rounded-xl border-transparent bg-slate-50/50 font-black text-slate-700 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
              {generateMonthOptions().map(m => (
                <SelectItem key={m.value} value={m.value} className="text-xs font-bold py-3 rounded-xl">{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
            <SelectTrigger className="h-11 rounded-xl border-transparent bg-slate-50/50 font-black text-slate-700 text-xs">
              <SelectValue placeholder={t('payroll.allDoctors')} />
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-slate-100 shadow-2xl">
              <SelectItem value="all" className="font-black text-xs py-3 rounded-xl">{t('payroll.allDoctors')}</SelectItem>
              {doctors.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-xs font-bold py-3 rounded-xl">{d.name || d.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content Area */}
      <div className="space-y-4 px-1 sm:px-0">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-28 bg-white border border-slate-100 rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : payrollData.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-12 text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="text-lg font-black text-slate-900">{t('payroll.noData')}</h3>
            <p className="text-sm text-slate-400 font-medium mt-1">{t('payroll.noDataSubtitle')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            <AnimatePresence mode="popLayout">
              {payrollData.map((doctor, index) => (
                <motion.div 
                  key={doctor.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white border transition-all duration-500 rounded-[2rem] overflow-hidden ${expandedDoctor === doctor.id ? 'border-emerald-200 shadow-2xl shadow-emerald-500/10 ring-1 ring-emerald-100' : 'border-slate-100 hover:border-slate-200 shadow-sm'}`}
                >
                  {/* Doctor Card Header */}
                  <div 
                    className="p-5 sm:p-6 cursor-pointer"
                    onClick={() => setExpandedDoctor(expandedDoctor === doctor.id ? null : doctor.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg transition-all duration-500 shrink-0 ${expandedDoctor === doctor.id ? 'bg-[#00D084] text-white rotate-6 scale-110' : 'bg-slate-100 text-slate-500'}`}>
                        {(doctor.name || doctor.full_name)?.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-black text-slate-900 tracking-tight truncate pr-2">{doctor.name || doctor.full_name}</h3>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteDoctor(doctor.id, doctor.name || doctor.full_name);
                              }}
                              className="w-8 h-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${expandedDoctor === doctor.id ? 'bg-emerald-50 text-emerald-500 rotate-180' : 'bg-slate-50 text-slate-400'}`}>
                              <ChevronDown className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 rounded-lg">
                            <Activity className="w-3 h-3 text-blue-500" />
                            <span className="text-[10px] font-black text-blue-600">{doctor.treatments} {t('payroll.works')}</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-50 rounded-lg">
                            <TrendingUp className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600 truncate max-w-[80px]">
                              {formatCurrency(doctor.totalRevenue).replace(' so\'m', '')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-5 border-t border-slate-50 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{t('payroll.salary')}</p>
                        <p className={`text-2xl font-black tracking-tighter ${expandedDoctor === doctor.id ? 'text-emerald-600' : 'text-slate-900'}`}>
                          {formatCurrency(doctor.totalSalary)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Button 
                          onClick={(e) => {
                            e.stopPropagation();
                            // Navigate to expenses with prefilled data or open a payout modal
                            toast.success('Maosh to\'lash oynasi ochiladi...');
                          }}
                          className="h-9 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-black text-[11px] uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition-all border-none"
                        >
                          To'lash
                        </Button>
                        <Button size="sm" variant="ghost" className="h-9 px-4 rounded-xl bg-slate-50 font-black text-[11px] uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors">
                          {t('payroll.details')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Section - Professional Breakdown */}
                  <AnimatePresence>
                    {expandedDoctor === doctor.id && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-50 bg-slate-50/40"
                      >
                        <div className="p-5 sm:p-6 space-y-6">
                          {/* Mini Stats Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {[
                              { label: t('payroll.weekly'), value: doctor.weeklyTotal, color: "text-blue-600", bg: "bg-blue-50" },
                              { label: t('payroll.monthly'), value: doctor.monthlyTotal, color: "text-emerald-600", bg: "bg-emerald-50" },
                              { label: t('payroll.yearly'), value: doctor.yearlyTotal, color: "text-purple-600", bg: "bg-purple-50" },
                            ].map(b => (
                              <div key={b.label} className={`${b.bg} rounded-2xl p-4 border border-white/50 shadow-sm flex flex-col items-center justify-center text-center`}>
                                <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${b.color} opacity-60`}>{b.label}</p>
                                <p className={`text-base font-black ${b.color}`}>{formatCurrency(b.value)}</p>
                              </div>
                            ))}
                          </div>

                          {/* Detail View Container */}
                          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                            <div className="px-4 py-3 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{t('payroll.serviceShare')}</h4>
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            </div>
                            
                            {/* Mobile Scrollable Table */}
                            <div className="overflow-x-auto overflow-y-hidden no-scrollbar">
                              <Table className="min-w-[400px]">
                                <TableHeader>
                                  <TableRow className="border-slate-50 hover:bg-transparent px-0">
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 h-10 w-[40%]">{t('common.service')}</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2 h-10 text-center w-[15%]">{t('payroll.count')}</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-2 h-10 text-right w-[15%]">{t('common.percent')}</TableHead>
                                    <TableHead className="text-[9px] font-black uppercase tracking-widest text-slate-400 px-4 h-10 text-right w-[30%]">{t('payroll.share')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.values(doctor.earnings).length > 0 ? (
                                    Object.values(doctor.earnings).map((earning, idx) => (
                                      <TableRow key={idx} className="border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <TableCell className="px-4 py-3 text-xs font-bold text-slate-700 truncate max-w-[120px]">{earning.serviceName}</TableCell>
                                        <TableCell className="px-2 py-3 text-center">
                                          <span className="text-[10px] font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">{earning.count}</span>
                                        </TableCell>
                                        <TableCell className="px-2 py-3 text-right">
                                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">{earning.commissionRate}%</span>
                                        </TableCell>
                                        <TableCell className="px-4 py-3 text-right font-black text-emerald-600 text-xs">
                                          {formatCurrency(earning.totalCommission)}
                                        </TableCell>
                                      </TableRow>
                                    ))
                                  ) : (
                                    <TableRow>
                                      <TableCell colSpan={4} className="text-center py-4 text-xs text-slate-400 font-medium">Bajarilgan ishlar topilmadi</TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                            
                            <div className="p-3 bg-slate-50/50 border-t border-slate-50 flex items-center justify-center gap-1.5">
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t('payroll.scrollHint')}</p>
                              <ArrowRight className="w-2.5 h-2.5 text-slate-300" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Add Doctor Modal */}
      <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">{t('payroll.addDoctor')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('staff.full_name')}</Label>
                <Input 
                  value={newDoctorForm.full_name}
                  onChange={e => setNewDoctorForm({...newDoctorForm, full_name: e.target.value})}
                  placeholder="Dr. Alisher"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('staff.phone')}</Label>
                <Input 
                  value={newDoctorForm.phone}
                  onChange={e => setNewDoctorForm({...newDoctorForm, phone: e.target.value})}
                  placeholder="+998..."
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('staff.specialty')}</Label>
                <Input 
                  value={newDoctorForm.specialization}
                  onChange={e => setNewDoctorForm({...newDoctorForm, specialization: e.target.value})}
                  placeholder="Ortodont"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('staff.base_salary')}</Label>
                <Input 
                  type="number"
                  value={newDoctorForm.base_salary}
                  onChange={e => setNewDoctorForm({...newDoctorForm, base_salary: Number(e.target.value)})}
                  placeholder="0"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>{t('staff.commission_rate')}</Label>
                <Input 
                  type="number"
                  value={newDoctorForm.commission_rate}
                  onChange={e => setNewDoctorForm({...newDoctorForm, commission_rate: Number(e.target.value)})}
                  placeholder="30"
                  className="rounded-xl"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddDoctorOpen(false)} className="flex-1" disabled={addingDoctor}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddDoctor} className="flex-1 bg-primary" disabled={addingDoctor}>
                {addingDoctor ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    {t('common.saving')}
                  </span>
                ) : t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credentials Modal (Success) */}
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
          </div>
          <Button 
            onClick={() => setCredentialsModal(null)} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 font-bold uppercase tracking-widest shadow-xl shadow-slate-900/20"
          >
            {t('staff.understand')}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Generate month options for select
 */
function generateMonthOptions() {
  const options = [];
  const today = new Date();
  
  for (let i = 0; i < 12; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = date.toISOString().slice(0, 7);
    const label = date.toLocaleDateString('uz-UZ', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  
  return options;
}

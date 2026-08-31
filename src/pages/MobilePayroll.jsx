import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, Users, TrendingUp, Calendar, 
  Plus, Search, Trash2, Edit2, Shield, Percent,
  Camera, Upload, Download, Eye, Printer, X,
  Receipt, Layers, ChevronDown, ChevronRight, Activity, Check, Copy
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/utils/imageUpload';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import { useAuth } from '@/lib/AuthContext';

// Standard Uzbek Months
const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

function parseDateBoundary(str, boundary = 'start') {
  if (!str) {
    return boundary === 'start' ? new Date(2000, 0, 1, 0, 0, 0, 0) : new Date(2099, 11, 31, 23, 59, 59, 999);
  }
  const s = String(str).trim();
  
  // 1. Check for YYYY-MM-DD
  const ymd = s.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10) - 1;
    const day = parseInt(ymd[3], 10);
    return boundary === 'start' 
      ? new Date(year, month, day, 0, 0, 0, 0) 
      : new Date(year, month, day, 23, 59, 59, 999);
  }

  // 2. Check for DD.MM.YYYY
  const dmy = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const month = parseInt(dmy[2], 10) - 1;
    const year = parseInt(dmy[3], 10);
    return boundary === 'start' 
      ? new Date(year, month, day, 0, 0, 0, 0) 
      : new Date(year, month, day, 23, 59, 59, 999);
  }

  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    if (boundary === 'start') d.setHours(0, 0, 0, 0);
    else d.setHours(23, 59, 59, 999);
    return d;
  }
  return boundary === 'start' ? new Date(2000, 0, 1, 0, 0, 0, 0) : new Date(2099, 11, 31, 23, 59, 59, 999);
}

function parsePaymentDate(p) {
  if (!p) return new Date();
  const val = p.date || p.created_date || p.created_at || p.timestamp;
  if (!val) return new Date();
  
  if (typeof val === 'number') {
    return new Date(val);
  }
  
  if (typeof val === 'string') {
    const trimmed = val.trim();
    // 1. Check for YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = trimmed.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const hours = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
      const mins = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
      const secs = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
      return new Date(year, month, day, hours, mins, secs);
    }

    // 2. Check for DD.MM.YYYY or DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})(?:[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const month = parseInt(dmyMatch[2], 10) - 1;
      const year = parseInt(dmyMatch[3], 10);
      const hours = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
      const mins = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
      const secs = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
      return new Date(year, month, day, hours, mins, secs);
    }
  }

  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

function formatDateTime(d) {
  if (!d || isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${mins}`;
}

function formatDateOnly(d) {
  if (!d || isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatDateForInput(d) {
  if (!d) return '';
  const dateObj = typeof d === 'string' ? parsePaymentDate({ date: d }) : d;
  if (!dateObj || isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function MobilePayroll() {
  const { t, language } = useTranslation();
  const { isAdmin } = useAuth();
  const { clinicName } = useClinic();
  const navigate = useNavigate();
  const location = useLocation();

  const [doctors, setDoctors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  );
  const [activeTypeFilter, setActiveTypeFilter] = useState('all'); // 'all' | 'percentage' | 'fixed'
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDoctor, setExpandedDoctor] = useState(null);
  const [doctorPeriodFilters, setDoctorPeriodFilters] = useState({});

  // Modals
  const [detailDoctorId, setDetailDoctorId] = useState(null);
  const [detailModalTab, setDetailModalTab] = useState('patients'); // 'patients' | 'services'
  const [payModalDoctor, setPayModalDoctor] = useState(null);
  const [payForm, setPayForm] = useState({
    method: 'cash',
    notes: '',
    bonus: 0,
    deduction: 0
  });

  const [editDoctorModal, setEditDoctorModal] = useState(null);
  const [editForm, setEditForm] = useState({
    salary_type: 'percentage',
    commission_rate: 30,
    base_salary: 0
  });

  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [addingDoctor, setAddingDoctor] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [newDoctorForm, setNewDoctorForm] = useState({
    full_name: '',
    username: '',
    password: '',
    phone: '',
    specialization: 'Stomatolog',
    salary_type: 'percentage',
    base_salary: '',
    commission_rate: '30',
    role: 'doctor',
    avatar_url: ''
  });

  // Check navigation state
  useEffect(() => {
    if (location.state?.openAddDoctor) {
      setAddDoctorOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [users, pays] = await Promise.all([
        base44.entities.User.list('name', 100),
        base44.entities.Payment.filter({ type: 'Income' }, '-date', 500)
      ]);

      const currentClinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
      const doctorUsers = (users || []).filter(u => 
        (u.role === 'doctor' || u.role === 'admin' || (u.specialty && u.specialty !== 'receptionist')) &&
        (u.clinic_id === currentClinicId || !u.clinic_id)
      );

      setDoctors(doctorUsers);
      setPayments(pays || []);
    } catch (error) {
      console.error('Error loading payroll data:', error);
      toast.error(t('common.errorLoading') || 'Ma\'lumotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Upload Avatars
  const handleDoctorAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading("Rasm tayyorlanmoqda...", { id: "avatar-upload" });
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
      setNewDoctorForm(prev => ({ ...prev, avatar_url: compressed }));
      toast.success("Rasm tanlandi!", { id: "avatar-upload" });
    } catch (err) {
      toast.error("Rasm yuklashda xatolik yuz berdi", { id: "avatar-upload" });
    }
  };

  const handleExistingDoctorAvatarUpload = async (doctorId, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      toast.loading("Shifokor rasmi yangilanmoqda...", { id: "doctor-avatar-update" });
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
      await base44.entities.User.update(doctorId, { avatar_url: compressed });
      setDoctors(prev => prev.map(d => String(d.id) === String(doctorId) ? { ...d, avatar_url: compressed } : d));
      toast.success("Shifokor rasmi saqlandi!", { id: "doctor-avatar-update" });
    } catch (err) {
      toast.error("Rasm saqlashda xatolik yuz berdi", { id: "doctor-avatar-update" });
    }
  };

  // Add Doctor
  const handleAddDoctor = useCallback(async () => {
    if (!newDoctorForm.full_name?.trim()) {
      toast.error('Ism va Familiya majburiy!');
      return;
    }
    
    setAddingDoctor(true);
    try {
      const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
      const firstName = newDoctorForm.full_name.trim().split(' ')[0] || 'dr';
      const baseName = firstName.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const randomSuffix = Math.floor(Math.random() * 9000 + 1000).toString();
      const cleanUsername = `${baseName}_${randomSuffix}`;
      const generatedPassword = Math.floor(100000 + Math.random() * 900000).toString();
      const savedName = newDoctorForm.full_name.trim();

      const isPercentage = newDoctorForm.salary_type === 'percentage';
      const baseSalaryVal = isPercentage ? 0 : Number(newDoctorForm.base_salary || 0);
      const commissionRateVal = isPercentage ? Number(newDoctorForm.commission_rate || 0) : 0;
      const avatarVal = newDoctorForm.avatar_url || '';

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
        salary_type: newDoctorForm.salary_type || 'percentage',
        base_salary: baseSalaryVal,
        commission_rate: commissionRateVal,
        avatar_url: avatarVal
      });

      setDoctors(prev => [...prev, newUser || {
        id: 'usr-temp-' + Date.now(),
        name: savedName,
        full_name: savedName,
        role: 'doctor',
        clinic_id: clinicId,
        phone: newDoctorForm.phone || '',
        specialty: newDoctorForm.specialization || 'Stomatolog',
        salary_type: newDoctorForm.salary_type || 'percentage',
        base_salary: baseSalaryVal,
        commission_rate: commissionRateVal,
        avatar_url: avatarVal
      }]);

      setAddDoctorOpen(false);
      setNewDoctorForm({
        full_name: '', username: '', password: '', phone: '',
        specialization: 'Stomatolog', salary_type: 'percentage', base_salary: '', commission_rate: '30', role: 'doctor',
        avatar_url: ''
      });

      setCredentialsModal({
        name: savedName,
        clinicId: clinicId,
        username: cleanUsername,
        password: generatedPassword
      });

      toast.success(`${savedName} muvaffaqiyatli qo'shildi!`);
      setTimeout(() => loadData(), 1500);
    } catch (error) {
      console.error('Failed to add doctor:', error);
      toast.error('Shifokor qo\'shishda xatolik yuz berdi');
    } finally {
      setAddingDoctor(false);
    }
  }, [newDoctorForm, loadData]);

  // Edit doctor rate/salary
  const handleSaveEditDoctor = async () => {
    if (!editDoctorModal) return;
    try {
      const updatePayload = {
        salary_type: editForm.salary_type,
        commission_rate: editForm.salary_type === 'percentage' ? Number(editForm.commission_rate || 30) : 0,
        base_salary: editForm.salary_type === 'fixed' ? Number(editForm.base_salary || 0) : 0
      };
      await base44.entities.User.update(editDoctorModal.id, updatePayload);
      setDoctors(prev => prev.map(d => d.id === editDoctorModal.id ? { ...d, ...updatePayload } : d));
      toast.success("Shifokor maosh ma'lumotlari yangilandi!");
      setEditDoctorModal(null);
    } catch (err) {
      toast.error("Saqlashda xatolik yuz berdi");
    }
  };

  // Delete doctor
  const handleDeleteDoctor = useCallback(async (id, name) => {
    if (window.confirm(`Haqiqatan ham "${name}" ni o'chirib tashlamoqchimisiz?`)) {
      try {
        await base44.entities.User.delete(id);
        toast.success(`${name} o'chirildi!`);
        setDoctors(prev => prev.filter(d => d.id !== id));
      } catch (error) {
        toast.error('O\'chirishda xatolik yuz berdi');
      }
    }
  }, []);

  // Month range
  const getMonthRange = useCallback((monthStr) => {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  }, []);

  // Calculate doctor earnings with periods
  const calculateDoctorEarnings = useCallback((doctorId) => {
    const doctorObj = doctors.find(d => String(d.id) === String(doctorId));
    const activeFilter = doctorPeriodFilters[doctorId] || { mode: 'month' };
    const now = new Date();

    const allDoctorIncomePayments = payments.filter(p => {
      const isDoc = String(p.doctor_id) === String(doctorId);
      const isIncome = (p.type || '').toLowerCase() === 'income';
      return isDoc && isIncome;
    });

    // Today range
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Week range
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay() || 7;
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Month range
    const monthRange = getMonthRange(selectedMonth);
    const startOfMonth = monthRange.startDate;
    const endOfMonth = monthRange.endDate;

    // Year range
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const baseSalary = Number(doctorObj?.base_salary || 0);
    const isFixed = doctorObj?.salary_type === 'fixed' || (baseSalary > 0 && !doctorObj?.commission_rate);
    const doctorDefaultCommissionRate = Number(doctorObj?.commission_rate || doctorObj?.commission || 30);

    const computeSubset = (list, mode) => {
      const rev = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const comm = list.reduce((sum, p) => {
        const rate = p.commission_rate || doctorDefaultCommissionRate;
        return sum + ((Number(p.amount) || 0) * (rate / 100));
      }, 0);
      let sal = comm;
      if (isFixed) {
        if (mode === 'today') sal = Math.round(baseSalary / 30);
        else if (mode === 'week') sal = Math.round(baseSalary / 4);
        else if (mode === 'year') sal = baseSalary * 12;
        else sal = baseSalary;
      }
      return { rev, comm, sal, count: list.length };
    };

    const todayPayments = allDoctorIncomePayments.filter(p => {
      const time = parsePaymentDate(p).getTime();
      return time >= startOfDay.getTime() && time <= endOfDay.getTime();
    });

    const weeklyPayments = allDoctorIncomePayments.filter(p => {
      const time = parsePaymentDate(p).getTime();
      return time >= startOfWeek.getTime() && time <= endOfWeek.getTime();
    });

    const monthlyPayments = allDoctorIncomePayments.filter(p => {
      const time = parsePaymentDate(p).getTime();
      return time >= startOfMonth.getTime() && time <= endOfMonth.getTime();
    });

    const yearlyPayments = allDoctorIncomePayments.filter(p => {
      const time = parsePaymentDate(p).getTime();
      return time >= startOfYear.getTime() && time <= endOfYear.getTime();
    });

    const todayStats = computeSubset(todayPayments, 'today');
    const weekStats = computeSubset(weeklyPayments, 'week');
    const monthStats = computeSubset(monthlyPayments, 'month');
    const yearStats = computeSubset(yearlyPayments, 'year');
    const allStats = computeSubset(allDoctorIncomePayments, 'all');

    let activeStartDate, activeEndDate, activePayments;
    if (activeFilter.mode === 'today') {
      activeStartDate = startOfDay;
      activeEndDate = endOfDay;
      activePayments = todayPayments;
    } else if (activeFilter.mode === 'week') {
      activeStartDate = startOfWeek;
      activeEndDate = endOfWeek;
      activePayments = weeklyPayments;
    } else if (activeFilter.mode === 'year') {
      activeStartDate = startOfYear;
      activeEndDate = endOfYear;
      activePayments = yearlyPayments;
    } else if (activeFilter.mode === 'all') {
      activeStartDate = new Date(2000, 0, 1, 0, 0, 0, 0);
      activeEndDate = new Date(2099, 11, 31, 23, 59, 59, 999);
      activePayments = allDoctorIncomePayments;
    } else if (activeFilter.mode === 'custom') {
      activeStartDate = parseDateBoundary(activeFilter.startDate || formatDateForInput(startOfMonth), 'start');
      activeEndDate = parseDateBoundary(activeFilter.endDate || formatDateForInput(endOfMonth), 'end');
      activePayments = allDoctorIncomePayments.filter(p => {
        const time = parsePaymentDate(p).getTime();
        return time >= activeStartDate.getTime() && time <= activeEndDate.getTime();
      });
    } else {
      activeStartDate = startOfMonth;
      activeEndDate = endOfMonth;
      activePayments = monthlyPayments;
    }

    const sortedActivePayments = [...activePayments].sort((a, b) => {
      return parsePaymentDate(b).getTime() - parsePaymentDate(a).getTime();
    });

    const patientIds = sortedActivePayments.map(p => p.patient_id || p.patient_name).filter(Boolean);
    const uniquePatientCount = new Set(patientIds).size;
    const patientCount = uniquePatientCount > 0 ? uniquePatientCount : sortedActivePayments.length;

    const earnings = sortedActivePayments.reduce((acc, pay) => {
      const commissionRate = pay.commission_rate || doctorDefaultCommissionRate;
      const commission = (Number(pay.amount) || 0) * (commissionRate / 100);
      const category = pay.service_name || pay.category || 'Davolash';
      
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
      acc[category].totalRevenue += (Number(pay.amount) || 0);
      acc[category].totalCommission += commission;
      return acc;
    }, {});

    const totalRevenue = Object.values(earnings).reduce((sum, e) => sum + e.totalRevenue, 0);
    const totalCommission = Object.values(earnings).reduce((sum, e) => sum + e.totalCommission, 0);
    const activeSalary = isFixed
      ? (activeFilter.mode === 'week' ? Math.round(baseSalary / 4) : activeFilter.mode === 'year' ? baseSalary * 12 : baseSalary)
      : totalCommission;

    return {
      treatments: sortedActivePayments.length,
      patientCount,
      earnings,
      rawPayments: sortedActivePayments,
      totalRevenue,
      totalCommission,
      totalSalary: activeSalary,
      todayTotal: todayStats.sal,
      weeklyTotal: weekStats.sal,
      monthlyTotal: monthStats.sal,
      yearlyTotal: yearStats.sal,
      allTotal: allStats.sal,
      activeFilter,
      startDate: activeStartDate,
      endDate: activeEndDate
    };
  }, [payments, doctors, selectedMonth, getMonthRange, doctorPeriodFilters]);

  // Payroll Data
  const payrollData = useMemo(() => {
    return doctors.map(doctor => {
      const earnings = calculateDoctorEarnings(doctor.id);
      return {
        ...doctor,
        ...earnings,
        baseSalary: Number(doctor.base_salary || 0)
      };
    }).filter(d => {
      if (activeTypeFilter === 'percentage' && d.salary_type === 'fixed') return false;
      if (activeTypeFilter === 'fixed' && d.salary_type !== 'fixed') return false;
      
      const doctorName = (d.name || d.full_name || '').toLowerCase();
      const specialty = (d.specialty || '').toLowerCase();
      if (searchQuery && !doctorName.includes(searchQuery.toLowerCase()) && !specialty.includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [doctors, calculateDoctorEarnings, activeTypeFilter, searchQuery]);

  // Active Detail Doctor
  const activeDetailDoctor = useMemo(() => {
    if (!detailDoctorId) return null;
    return payrollData.find(d => String(d.id) === String(detailDoctorId)) || null;
  }, [detailDoctorId, payrollData]);

  // Month options
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 12; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      const monthNum = String(monthIdx + 1).padStart(2, '0');
      const value = `${year}-${monthNum}`;
      const label = `${UZ_MONTHS[monthIdx]} ${year}`;
      options.push({ value, label });
    }
    return options;
  }, []);

  // Totals
  const totals = useMemo(() => {
    return payrollData.reduce((acc, d) => ({
      revenue: acc.revenue + (d.totalRevenue || 0),
      salary: acc.salary + (d.totalSalary || 0),
      commission: acc.commission + (d.totalCommission || 0),
      treatments: acc.treatments + (d.treatments || 0),
      patients: acc.patients + (d.patientCount || 0)
    }), { revenue: 0, salary: 0, commission: 0, treatments: 0, patients: 0 });
  }, [payrollData]);

  // Export CSV
  const exportCSV = useCallback(() => {
    try {
      if (!payrollData || payrollData.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = ["№", "Shifokor", "Mutaxassislik", "Turi", "Komissiya", "Bemorlar", "Tushum (UZS)", "Maosh (UZS)"];
      const rows = payrollData.map((d, idx) => [
        idx + 1,
        `"${(d.name || d.full_name || '').replace(/"/g, '""')}"`,
        `"${(d.specialty || 'Stomatolog').replace(/"/g, '""')}"`,
        `"${d.salary_type === 'fixed' ? 'Oylik' : 'Foiz'}"`,
        d.salary_type === 'fixed' ? 'Oylik' : `${d.commission_rate || 30}%`,
        d.patientCount || d.treatments || 0,
        Number(d.totalRevenue || 0),
        Number(d.totalSalary || 0)
      ].join(","));

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Maoshlar_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Hisobot Excel (.csv) formatida yuklandi!");
    } catch (err) {
      toast.error("Eksportda xatolik");
    }
  }, [payrollData, selectedMonth]);

  // Print Payout Slip
  const handlePrintPayoutSlip = (doc) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Chop etish oynasini ochib bo'lmadi");
      return;
    }

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthName = UZ_MONTHS[month - 1] || '';
    const finalSalary = Number(doc.totalSalary || 0) + Number(payForm.bonus || 0) - Number(payForm.deduction || 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Maosh Kvitansiyasi - ${doc.name || doc.full_name}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #1e293b; line-height: 1.5; }
          .receipt { border: 2px solid #cbd5e1; border-radius: 12px; padding: 20px; max-width: 500px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 12px; margin-bottom: 16px; }
          .header h2 { margin: 0; font-size: 18px; color: #0f172a; text-transform: uppercase; }
          .grid { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
          .grid th, .grid td { border: 1px solid #cbd5e1; padding: 6px 10px; }
          .grid th { background: #f1f5f9; font-weight: bold; text-align: left; }
          .total-box { background: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; padding: 12px; text-align: right; }
          .total-amount { font-size: 18px; font-weight: 900; color: #059669; font-family: monospace; }
          .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h2>${(clinicName || 'KLINIKA').toUpperCase()} • MAOSH VEDOMOSTI</h2>
            <p style="margin:4px 0 0 0;font-size:11px;color:#64748b;">Davr: <strong>${monthName} ${year}</strong></p>
          </div>
          <table class="grid">
            <tr><th>Shifokor:</th><td><strong>${doc.name || doc.full_name}</strong></td></tr>
            <tr><th>Mutaxassislik:</th><td>${doc.specialty || 'Stomatolog'}</td></tr>
            <tr><th>Bemorlar soni:</th><td>${doc.patientCount || doc.treatments} ta bemor</td></tr>
            <tr><th>Umumiy tushum:</th><td>${Number(doc.totalRevenue || 0).toLocaleString()} UZS</td></tr>
            <tr><th>Hisoblangan ulush:</th><td>${Number(doc.totalSalary || 0).toLocaleString()} UZS</td></tr>
            ${Number(payForm.bonus || 0) > 0 ? `<tr><th>Bonus:</th><td style="color:#059669">+${Number(payForm.bonus).toLocaleString()} UZS</td></tr>` : ''}
            ${Number(payForm.deduction || 0) > 0 ? `<tr><th>Ushlab qolingan:</th><td style="color:#dc2626">-${Number(payForm.deduction).toLocaleString()} UZS</td></tr>` : ''}
          </table>
          <div class="total-box">
            <div style="font-size:11px;font-weight:bold;color:#475569;">YAKUNIY TO'LANADIGAN SUMMA:</div>
            <div class="total-amount">${finalSalary.toLocaleString()} UZS</div>
          </div>
          <div class="footer">
            <div>Hisobchi: ___________</div>
            <div>Imzo: ___________</div>
          </div>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-slate-50 pb-24">
        
        {/* ── HEADER & TOP CONTROLS ── */}
        <div className="bg-white border-b border-slate-200/80 sticky top-0 z-20 px-4 pt-4 pb-3 space-y-3 shadow-xs">
          
          {/* Top Title Row + Actions */}
          <div className="flex items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>{t('navigation.payroll') || 'Ish haqi'}</span>
                <span className="px-2 py-0.5 rounded-full text-[9.5px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {doctors.length} shifokor
                </span>
              </h1>
              <p className="text-[11px] font-semibold text-slate-400">
                Komissiya va maosh hisob-kitobi
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* CSV Export */}
              <button 
                onClick={exportCSV}
                className="w-9 h-9 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center transition-all active:scale-95 border border-slate-200/80"
                title="Excel (.csv) yuklash"
              >
                <Download className="w-4 h-4" />
              </button>

              {/* Add Doctor Button */}
              <button 
                onClick={() => setAddDoctorOpen(true)}
                className="flex items-center gap-1 px-3 py-2 bg-[#00D084] hover:bg-[#00B875] text-white rounded-xl text-xs font-black shadow-sm transition-all active:scale-95"
              >
                <Plus className="w-4 h-4" />
                <span>+ Shifokor</span>
              </button>
            </div>
          </div>

          {/* Month Selector & Search Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {/* Month Picker */}
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full px-3 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30"
            >
              {monthOptions.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Shifokor ismi, mutaxassislik..."
                className="w-full pl-8 pr-7 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1499AD]/30 transition-all"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">✕</button>
              )}
            </div>
          </div>

          {/* Salary Type Filters */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Barchasi' },
              { id: 'percentage', label: 'Foizdagi shifokorlar' },
              { id: 'fixed', label: 'Qat\'iy maoshdagi' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTypeFilter(tab.id)}
                className={`px-3 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all ${
                  activeTypeFilter === tab.id
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── 4 KPI STATS GRID (Clean 2x2) ── */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="bg-emerald-50/90 border border-emerald-100 rounded-xl p-2.5">
              <p className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Jami Maosh</p>
              <p className="text-sm font-black text-emerald-800 font-mono mt-0.5">
                {formatCurrency(totals.salary)}
              </p>
            </div>
            <div className="bg-blue-50/90 border border-blue-100 rounded-xl p-2.5">
              <p className="text-[9px] font-black text-blue-600 uppercase tracking-wider">Klinika Tushumi</p>
              <p className="text-sm font-black text-blue-800 font-mono mt-0.5">
                {formatCurrency(totals.revenue)}
              </p>
            </div>
            <div className="bg-purple-50/90 border border-purple-100 rounded-xl p-2.5">
              <p className="text-[9px] font-black text-purple-600 uppercase tracking-wider">Amallar / Ishlar</p>
              <p className="text-sm font-black text-purple-800 font-mono mt-0.5">
                {totals.treatments} ta muolaja
              </p>
            </div>
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5">
              <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Bemorlar Soni</p>
              <p className="text-sm font-black text-slate-800 font-mono mt-0.5">
                {totals.patients} ta bemor
              </p>
            </div>
          </div>
        </div>

        {/* ── DOCTOR CARDS LIST ── */}
        <div className="p-3 space-y-2.5">
          {loading ? (
            [1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 h-32 animate-pulse shadow-sm border border-slate-100" />
            ))
          ) : payrollData.length > 0 ? (
            <AnimatePresence>
              {payrollData.map((doctor) => {
                const isExpanded = expandedDoctor === doctor.id;
                const isFixed = doctor.salary_type === 'fixed' || (Number(doctor.base_salary) > 0 && !Number(doctor.commission_rate));

                return (
                  <div
                    key={doctor.id}
                    className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all ${
                      isExpanded ? 'border-[#00D084] ring-1 ring-[#00D084]/20' : 'border-slate-200/80'
                    }`}
                  >
                    {/* Main Card Header */}
                    <div 
                      className="p-3.5 flex items-start gap-3 cursor-pointer"
                      onClick={() => setExpandedDoctor(isExpanded ? null : doctor.id)}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black shadow-xs overflow-hidden ${
                          isExpanded ? 'bg-[#00D084] text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {(doctor.avatar_url || doctor.photo || doctor.avatar) ? (
                            <img 
                              src={doctor.avatar_url || doctor.photo || doctor.avatar} 
                              alt="" 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            (doctor.name || doctor.full_name)?.charAt(0) || 'D'
                          )}
                        </div>
                        <label 
                          onClick={e => e.stopPropagation()} 
                          className="absolute -bottom-1 -right-1 w-5 h-5 bg-slate-900 text-white rounded-lg flex items-center justify-center cursor-pointer shadow-xs active:scale-95"
                          title="Rasmni yuklash"
                        >
                          <Camera className="w-3 h-3 text-white" />
                          <input 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={e => handleExistingDoctorAvatarUpload(doctor.id, e)} 
                          />
                        </label>
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="font-black text-slate-900 text-sm truncate">{doctor.name || doctor.full_name}</h3>
                          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180 text-emerald-600' : ''}`} />
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                          {isFixed ? (
                            <span className="text-[9px] font-black text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded-md border border-purple-200">
                              Oylik: {formatCurrency(doctor.base_salary)}
                            </span>
                          ) : (
                            <span className="text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md border border-emerald-200">
                              {doctor.commission_rate || 30}% foizda
                            </span>
                          )}
                          <span className="text-[9.5px] font-bold text-slate-400 uppercase">{doctor.specialty || 'Stomatolog'}</span>
                        </div>

                        {/* Stats Row */}
                        <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                          <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                            <Activity className="w-3 h-3 text-blue-500" />
                            <span>{doctor.patientCount || doctor.treatments || 0} ta ish</span>
                          </div>
                          <p className="text-sm font-black text-emerald-600 font-mono tabular-nums">
                            {formatCurrency(doctor.totalSalary)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Drawer with Full Controls & Actions */}
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="px-3.5 pb-3.5 pt-1 bg-slate-50/60 border-t border-slate-100 space-y-2.5"
                      >
                        {/* Financial Mini Grid */}
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                            <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">Klinikaga Tushum</p>
                            <p className="text-xs font-black text-slate-800 font-mono mt-1">{formatCurrency(doctor.totalRevenue)}</p>
                          </div>
                          <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 shadow-2xs">
                            <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest leading-none">Doktor Ulushi</p>
                            <p className="text-xs font-black text-emerald-600 font-mono mt-1">{formatCurrency(doctor.totalSalary)}</p>
                          </div>
                        </div>

                        {/* 3 Main Action Buttons on Mobile */}
                        <div className="grid grid-cols-3 gap-1.5">
                          {/* 1. Batafsil hisobot */}
                          <button 
                            onClick={() => {
                              setDetailDoctorId(doctor.id);
                            }}
                            className="flex items-center justify-center gap-1 py-2.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black shadow-xs transition-all active:scale-95"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#1499AD]" />
                            <span>Batafsil</span>
                          </button>

                          {/* 2. Maosh to'lash */}
                          <button 
                            onClick={() => {
                              setPayModalDoctor(doctor);
                            }}
                            className="flex items-center justify-center gap-1 py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black shadow-xs transition-all active:scale-95"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>To'lash</span>
                          </button>

                          {/* 3. Tahrirlash (Foiz/Oylik) */}
                          <button 
                            onClick={() => {
                              setEditDoctorModal(doctor);
                              setEditForm({
                                salary_type: doctor.salary_type || 'percentage',
                                commission_rate: doctor.commission_rate || 30,
                                base_salary: doctor.base_salary || 0
                              });
                            }}
                            className="flex items-center justify-center gap-1 py-2.5 px-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-black shadow-xs transition-all active:scale-95"
                          >
                            <Percent className="w-3.5 h-3.5 text-purple-600" />
                            <span>Stavka</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
            </AnimatePresence>
          ) : (
            <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 p-6">
              <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-700 font-black text-sm">Shifokorlar topilmadi</p>
              <p className="text-xs font-medium text-slate-400 mt-0.5">Qidiruv yoki filtr parametrlarini tekshiring</p>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            1. DOCTOR DETAILED PAYROLL & PATIENTS BREAKDOWN MODAL (MOBILE)
        ══════════════════════════════════════════════════════════════════ */}
        <Dialog open={!!activeDetailDoctor} onOpenChange={(open) => { if (!open) setDetailDoctorId(null); }}>
          <DialogContent className="w-[95vw] sm:max-w-2xl rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
            {activeDetailDoctor && (
              <div className="space-y-3.5">
                <DialogHeader className="pb-1 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-[#00D084] text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden">
                        {(activeDetailDoctor.avatar_url || activeDetailDoctor.photo) ? (
                          <img src={activeDetailDoctor.avatar_url || activeDetailDoctor.photo} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (activeDetailDoctor.name || activeDetailDoctor.full_name)?.charAt(0) || 'D'
                        )}
                      </div>
                      <div className="min-w-0">
                        <DialogTitle className="text-sm font-black text-slate-900 truncate">
                          {activeDetailDoctor.name || activeDetailDoctor.full_name}
                        </DialogTitle>
                        <p className="text-[10px] font-bold text-slate-400">
                          {activeDetailDoctor.specialty || 'Stomatolog'} • {activeDetailDoctor.salary_type === 'fixed' ? `Oylik: ${formatCurrency(activeDetailDoctor.base_salary)}` : `${activeDetailDoctor.commission_rate || 30}% foiz`}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => handlePrintPayoutSlip(activeDetailDoctor)}
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-all active:scale-95"
                      title="Chek chiqarish"
                    >
                      <Printer className="w-4 h-4 text-slate-700" />
                    </button>
                  </div>
                </DialogHeader>

                {/* Period Selector Tabs: Bugun, Oy, Yil, Hammasi, Maxsus */}
                <div className="grid grid-cols-5 gap-1">
                  {[
                    { id: 'today', label: 'Bugun', value: activeDetailDoctor.todayTotal },
                    { id: 'month', label: 'Oy', value: activeDetailDoctor.monthlyTotal },
                    { id: 'year', label: 'Yil', value: activeDetailDoctor.yearlyTotal },
                    { id: 'all', label: 'Barchasi', value: activeDetailDoctor.allTotal },
                    { id: 'custom', label: 'Maxsus', value: activeDetailDoctor.activeFilter?.mode === 'custom' ? activeDetailDoctor.totalSalary : null }
                  ].map(p => {
                    const currentMode = activeDetailDoctor.activeFilter?.mode || 'month';
                    const isActive = currentMode === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          if (p.id === 'custom') {
                            const curStart = activeDetailDoctor.activeFilter?.startDate || formatDateForInput(activeDetailDoctor.startDate);
                            const curEnd = activeDetailDoctor.activeFilter?.endDate || formatDateForInput(activeDetailDoctor.endDate);
                            setDoctorPeriodFilters(prev => ({
                              ...prev,
                              [activeDetailDoctor.id]: {
                                mode: 'custom',
                                startDate: curStart,
                                endDate: curEnd
                              }
                            }));
                          } else {
                            setDoctorPeriodFilters(prev => ({
                              ...prev,
                              [activeDetailDoctor.id]: { mode: p.id }
                            }));
                          }
                        }}
                        className={`py-2 px-0.5 rounded-xl text-center transition-all ${
                          isActive 
                            ? 'bg-slate-900 text-white shadow-xs' 
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        <p className="text-[7.5px] font-black uppercase tracking-wider opacity-80">{p.label}</p>
                        <p className="text-[9.5px] font-black font-mono mt-0.5 truncate">
                          {p.value != null ? formatCurrency(p.value) : 'Tanlash'}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Date Range Picker: Shu kundan — Shu kungacha */}
                <div className={`flex flex-col gap-1.5 p-2 rounded-xl border transition-all ${
                  activeDetailDoctor.activeFilter?.mode === 'custom'
                    ? 'bg-blue-50/70 border-blue-300 ring-1 ring-blue-200'
                    : 'bg-slate-50 border-slate-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-[#1499AD]" />
                      Davrni tanlash:
                    </span>
                    {activeDetailDoctor.activeFilter?.mode === 'custom' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDoctorPeriodFilters(prev => ({
                            ...prev,
                            [activeDetailDoctor.id]: { mode: 'month' }
                          }));
                        }}
                        className="text-[9px] font-black text-rose-600 uppercase"
                      >
                        ✕ Tozalash
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200">
                    <input 
                      type="date"
                      value={activeDetailDoctor.activeFilter?.startDate || formatDateForInput(activeDetailDoctor.startDate)}
                      onChange={(e) => {
                        const newStart = e.target.value;
                        const curEnd = activeDetailDoctor.activeFilter?.endDate || formatDateForInput(activeDetailDoctor.endDate);
                        setDoctorPeriodFilters(prev => ({
                          ...prev,
                          [activeDetailDoctor.id]: {
                            mode: 'custom',
                            startDate: newStart,
                            endDate: curEnd
                          }
                        }));
                      }}
                      className="text-[11px] font-bold text-slate-800 bg-transparent outline-none flex-1"
                    />
                    <span className="text-slate-400 font-bold text-xs">—</span>
                    <input 
                      type="date"
                      value={activeDetailDoctor.activeFilter?.endDate || formatDateForInput(activeDetailDoctor.endDate)}
                      onChange={(e) => {
                        const newEnd = e.target.value;
                        const curStart = activeDetailDoctor.activeFilter?.startDate || formatDateForInput(activeDetailDoctor.startDate);
                        setDoctorPeriodFilters(prev => ({
                          ...prev,
                          [activeDetailDoctor.id]: {
                            mode: 'custom',
                            startDate: curStart,
                            endDate: newEnd
                          }
                        }));
                      }}
                      className="text-[11px] font-bold text-slate-800 bg-transparent outline-none flex-1"
                    />
                  </div>
                </div>

                {/* Sub-tabs: Bemorlar VS Xizmatlar */}
                <div className="flex items-center gap-1 border-b border-slate-100 pb-1.5">
                  <button
                    type="button"
                    onClick={() => setDetailModalTab('patients')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      detailModalTab === 'patients'
                        ? 'bg-blue-50 text-blue-700 font-black border border-blue-200'
                        : 'text-slate-500'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5" />
                    <span>Bemorlar ({activeDetailDoctor.rawPayments?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModalTab('services')}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                      detailModalTab === 'services'
                        ? 'bg-blue-50 text-blue-700 font-black border border-blue-200'
                        : 'text-slate-500'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Xizmatlar</span>
                  </button>
                </div>

                {/* Sub-view 1: Bemorlar va To'lovlar Ro'yxati */}
                {detailModalTab === 'patients' && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {activeDetailDoctor.rawPayments?.length > 0 ? (
                      activeDetailDoctor.rawPayments.map((p, idx) => {
                        const paymentDate = parsePaymentDate(p);
                        const rate = p.commission_rate || activeDetailDoctor.commission_rate || 30;
                        const share = (Number(p.amount) || 0) * (rate / 100);

                        return (
                          <div key={p.id || idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-slate-900 text-xs truncate">
                                {p.patient_name || p.patient_full_name || 'Bemor'}
                              </span>
                              <span className="font-mono font-black text-emerald-600 text-xs shrink-0">
                                +{Number(share || 0).toLocaleString()} UZS
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                              <span className="truncate">{p.service_name || p.category || 'Davolash'}</span>
                              <span className="font-mono text-slate-400">{formatDateTime(paymentDate)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] text-slate-400 border-t border-slate-200/60 pt-1 mt-1">
                              <span>Jami tushum: <strong>{Number(p.amount || 0).toLocaleString()} UZS</strong></span>
                              <span>Stavka: <strong>{rate}%</strong></span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="py-8 text-center text-slate-400 text-xs">Ushbu davrda to'lovlar qayd etilmagan</p>
                    )}
                  </div>
                )}

                {/* Sub-view 2: Xizmatlar bo'yicha hisobot */}
                {detailModalTab === 'services' && (
                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {Object.values(activeDetailDoctor.earnings).length > 0 ? (
                      Object.values(activeDetailDoctor.earnings).map((earning, idx) => (
                        <div key={idx} className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 text-xs">{earning.serviceName}</span>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                              {earning.count} ta ish
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/60">
                            <span className="text-[10px] text-slate-500 font-medium">Tushum: {formatCurrency(earning.totalRevenue)}</span>
                            <span className="font-black text-emerald-600 font-mono">Ulush: {formatCurrency(earning.totalCommission)}</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="py-8 text-center text-slate-400 text-xs">Ushbu davrda xizmatlar topilmadi</p>
                    )}
                  </div>
                )}

                {/* Bottom Total Card + Pay button */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[9px] font-black uppercase text-emerald-800">Hisoblangan maosh:</p>
                    <p className="text-base font-black text-emerald-700 font-mono">
                      {formatCurrency(activeDetailDoctor.totalSalary)}
                    </p>
                  </div>
                  <Button
                    onClick={() => {
                      setPayModalDoctor(activeDetailDoctor);
                      setDetailDoctorId(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 px-3 rounded-xl shadow-xs active:scale-95"
                  >
                    <TrendingUp className="w-3.5 h-3.5 mr-1" />
                    <span>To'lash</span>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════
            2. PAYOUT MODAL (MAOSH TO'LASH VEDOMOSTI)
        ══════════════════════════════════════════════════════════════════ */}
        <Dialog open={!!payModalDoctor} onOpenChange={() => setPayModalDoctor(null)}>
          <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4">
            {payModalDoctor && (
              <div className="space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-1.5">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Maosh To'lash Vedomosti</span>
                  </DialogTitle>
                </DialogHeader>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Shifokor:</span>
                    <strong className="text-slate-900">{payModalDoctor.name || payModalDoctor.full_name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Klinika Tushumi:</span>
                    <span className="font-mono font-bold text-slate-800">{formatCurrency(payModalDoctor.totalRevenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-bold">Hisoblangan Maosh:</span>
                    <span className="font-mono font-bold text-emerald-700">{formatCurrency(payModalDoctor.totalSalary)}</span>
                  </div>
                </div>

                {/* Bonus / Deduction */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">Bonus / Mukofot (so'm)</Label>
                    <Input 
                      type="number"
                      value={payForm.bonus || ''}
                      onChange={e => setPayForm({ ...payForm, bonus: Number(e.target.value || 0) })}
                      placeholder="0"
                      className="mt-1 h-9 rounded-xl font-mono text-xs font-bold"
                    />
                  </div>
                  <div>
                    <Label className="text-[10px] font-bold text-slate-600 uppercase">Ushlab qolish (so'm)</Label>
                    <Input 
                      type="number"
                      value={payForm.deduction || ''}
                      onChange={e => setPayForm({ ...payForm, deduction: Number(e.target.value || 0) })}
                      placeholder="0"
                      className="mt-1 h-9 rounded-xl font-mono text-xs font-bold text-rose-600"
                    />
                  </div>
                </div>

                {/* Method */}
                <div>
                  <Label className="text-[10px] font-bold text-slate-600 uppercase">To'lov Usuli</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <button
                      type="button"
                      onClick={() => setPayForm({ ...payForm, method: 'cash' })}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                        payForm.method === 'cash' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      Naqd Pul
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayForm({ ...payForm, method: 'card' })}
                      className={`py-2 px-3 rounded-xl text-xs font-black border transition-all ${
                        payForm.method === 'card' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-700 border-slate-200'
                      }`}
                    >
                      Karta / Bank
                    </button>
                  </div>
                </div>

                {/* Final Total */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
                  <span className="text-[9px] font-black uppercase text-emerald-800">Yakuniy to'lanadigan summa:</span>
                  <div className="text-lg font-black font-mono text-emerald-700 mt-0.5">
                    {formatCurrency(Number(payModalDoctor.totalSalary || 0) + Number(payForm.bonus || 0) - Number(payForm.deduction || 0))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setPayModalDoctor(null)}
                    className="rounded-xl text-xs font-bold h-10"
                  >
                    Bekor qilish
                  </Button>
                  <Button 
                    type="button" 
                    onClick={() => {
                      handlePrintPayoutSlip(payModalDoctor);
                      toast.success(`${payModalDoctor.name || payModalDoctor.full_name} ga maosh to'lovi tasdiqlandi!`);
                      setPayModalDoctor(null);
                    }}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black h-10"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1" />
                    <span>To'lash & Chek</span>
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════
            3. EDIT DOCTOR SALARY / RATE MODAL
        ══════════════════════════════════════════════════════════════════ */}
        <Dialog open={!!editDoctorModal} onOpenChange={() => setEditDoctorModal(null)}>
          <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4">
            {editDoctorModal && (
              <div className="space-y-3">
                <DialogHeader>
                  <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-1.5">
                    <Percent className="w-4 h-4 text-purple-600" />
                    <span>Shifokor stavkasini tahrirlash</span>
                  </DialogTitle>
                </DialogHeader>

                <p className="text-xs font-bold text-slate-700">
                  {editDoctorModal.name || editDoctorModal.full_name}
                </p>

                {/* Salary Type Selector */}
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Daromad toifasi</Label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, salary_type: 'percentage' })}
                      className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                        editForm.salary_type === 'percentage' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Foizga
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, salary_type: 'fixed' })}
                      className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                        editForm.salary_type === 'fixed' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Oylikka
                    </button>
                  </div>
                </div>

                {editForm.salary_type === 'percentage' ? (
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Komissiya stavkasi (%)</Label>
                    <Input 
                      type="number"
                      value={editForm.commission_rate}
                      onChange={e => setEditForm({ ...editForm, commission_rate: e.target.value })}
                      placeholder="30"
                      className="rounded-xl h-10 font-bold"
                    />
                  </div>
                ) : (
                  <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase">Oylik maosh summasi (so'm)</Label>
                    <Input 
                      type="number"
                      value={editForm.base_salary}
                      onChange={e => setEditForm({ ...editForm, base_salary: e.target.value })}
                      placeholder="5000000"
                      className="rounded-xl h-10 font-bold"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button variant="outline" onClick={() => setEditDoctorModal(null)} className="rounded-xl text-xs h-10 font-bold">
                    Bekor qilish
                  </Button>
                  <Button onClick={handleSaveEditDoctor} className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs h-10 font-black">
                    Saqlash
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════
            4. ADD DOCTOR MODAL (MOBILE)
        ══════════════════════════════════════════════════════════════════ */}
        <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
          <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-base font-black text-slate-900">Yangi Shifokor Qo'shish</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              {/* Photo Upload */}
              <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div className="relative w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                  {newDoctorForm.avatar_url ? (
                    <img src={newDoctorForm.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera className="w-5 h-5 text-slate-300" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="text-xs font-bold text-slate-700 block">Shifokor rasmi</label>
                  <label className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-[10px] font-bold text-slate-700 shadow-xs cursor-pointer">
                    <Upload className="w-3 h-3" />
                    <span>{newDoctorForm.avatar_url ? "Almashtirish" : "Rasm tanlash"}</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleDoctorAvatarUpload} />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Ism va Familiya *</Label>
                <Input 
                  value={newDoctorForm.full_name}
                  onChange={e => setNewDoctorForm({ ...newDoctorForm, full_name: e.target.value })}
                  placeholder="Masalan: Dr. Alisher"
                  className="rounded-xl h-10 text-sm font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Telefon raqam</Label>
                  <Input 
                    value={newDoctorForm.phone}
                    onChange={e => setNewDoctorForm({ ...newDoctorForm, phone: e.target.value })}
                    placeholder="+998..."
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Mutaxassislik</Label>
                  <Input 
                    value={newDoctorForm.specialization}
                    onChange={e => setNewDoctorForm({ ...newDoctorForm, specialization: e.target.value })}
                    placeholder="Stomatolog"
                    className="rounded-xl h-10 text-xs font-bold"
                  />
                </div>
              </div>

              {/* Salary Type */}
              <div className="space-y-1">
                <Label className="text-[10px] font-bold text-slate-500 uppercase">Daromad toifasi *</Label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setNewDoctorForm({ ...newDoctorForm, salary_type: 'percentage', base_salary: 0 })}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                      newDoctorForm.salary_type === 'percentage' ? 'bg-white text-emerald-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Foizga
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDoctorForm({ ...newDoctorForm, salary_type: 'fixed', commission_rate: 0 })}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all ${
                      newDoctorForm.salary_type === 'fixed' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-500'
                    }`}
                  >
                    Oylikka
                  </button>
                </div>
              </div>

              {newDoctorForm.salary_type === 'percentage' ? (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Komissiya foizi (%)</Label>
                  <Input 
                    type="number"
                    value={newDoctorForm.commission_rate}
                    onChange={e => setNewDoctorForm({ ...newDoctorForm, commission_rate: e.target.value })}
                    placeholder="30"
                    className="rounded-xl h-10 font-bold"
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <Label className="text-[10px] font-bold text-slate-500 uppercase">Oylik maosh (so'm)</Label>
                  <Input 
                    type="number"
                    value={newDoctorForm.base_salary}
                    onChange={e => setNewDoctorForm({ ...newDoctorForm, base_salary: e.target.value })}
                    placeholder="5000000"
                    className="rounded-xl h-10 font-bold"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button variant="outline" onClick={() => setAddDoctorOpen(false)} className="rounded-xl text-xs h-10 font-bold">
                  Bekor qilish
                </Button>
                <Button 
                  onClick={handleAddDoctor} 
                  disabled={addingDoctor}
                  className="bg-[#00D084] hover:bg-[#00B875] text-white rounded-xl text-xs h-10 font-black"
                >
                  {addingDoctor ? 'Qo\'shilmoqda...' : '+ Shifokor qo\'shish'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ══════════════════════════════════════════════════════════════════
            5. CREDENTIALS MODAL (LOGIN & PAROL KO'RSATISH)
        ══════════════════════════════════════════════════════════════════ */}
        <Dialog open={!!credentialsModal} onOpenChange={() => setCredentialsModal(null)}>
          <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl p-4">
            {credentialsModal && (
              <div className="space-y-3 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check className="w-6 h-6" />
                </div>
                <DialogTitle className="text-base font-black text-slate-900">
                  Shifokor muvaffaqiyatli yaratildi!
                </DialogTitle>
                <p className="text-xs text-slate-500">
                  {credentialsModal.name} uchun tizimga kirish ma'lumotlari:
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-left text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Login (Username):</span>
                    <strong className="font-mono text-slate-900 text-sm">{credentialsModal.username}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase block">Parol:</span>
                    <strong className="font-mono text-emerald-600 text-sm">{credentialsModal.password}</strong>
                  </div>
                </div>

                <Button 
                  onClick={() => {
                    navigator.clipboard.writeText(`Login: ${credentialsModal.username}\nParol: ${credentialsModal.password}`);
                    toast.success("Login va parol nusxalandi!");
                    setCredentialsModal(null);
                  }}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs h-10 font-black flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Nusxalash va Yopish</span>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

      </div>
    </PullToRefresh>
  );
}

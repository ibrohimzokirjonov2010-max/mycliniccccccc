import { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DollarSign, Users, TrendingUp, Calendar, 
  Plus, Search, Trash2,
  Shield, Percent,
  Camera, Upload, ArrowUp, ArrowDown, ArrowUpDown,
  Table as TableIcon, LayoutGrid, FileSpreadsheet, Eye, Printer, X,
  Receipt, Layers
} from 'lucide-react';
import { motion } from 'framer-motion';
import { base44 } from '@/api/base44Client';
import { compressImage } from '@/utils/imageUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/lib/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';

// Standard Uzbek Months
const UZ_MONTHS = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun',
  'Iyul', 'Avgust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr'
];

/**
 * Safely parse date from payment record
 */
function parsePaymentDate(p) {
  if (!p) return new Date();
  const val = p.date || p.created_date || p.created_at || p.timestamp;
  if (!val) return new Date();
  const d = new Date(val);
  return isNaN(d.getTime()) ? new Date() : d;
}

/**
 * Format date nicely in Uzbek standard format (DD.MM.YYYY HH:mm)
 */
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

/**
 * Payroll Page
 * 
 * Doctor commission tracking and salary calculation system in Excel Spreadsheet layout.
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

  // Data states
  const [doctors, setDoctors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [selectedMonth, setSelectedMonth] = useState(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`);
  const [selectedDoctor, setSelectedDoctor] = useState('all');
  const [activeTypeFilter, setActiveTypeFilter] = useState('all'); // 'all' | 'percentage' | 'fixed'
  const [searchQuery, setSearchQuery] = useState('');
  const [doctorPeriodFilters, setDoctorPeriodFilters] = useState({});

  // Detail Modal Doctor ID (dynamic reference)
  const [detailDoctorId, setDetailDoctorId] = useState(null);
  const [detailModalTab, setDetailModalTab] = useState('patients'); // 'patients' | 'services'

  // Density switcher with localStorage
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_payroll_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_payroll_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('salary');
  const [sortOrder, setSortOrder] = useState('desc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };
  
  // Payout modal state
  const [payModalDoctor, setPayModalDoctor] = useState(null);
  const [payForm, setPayForm] = useState({
    method: 'cash',
    notes: '',
    bonus: 0,
    deduction: 0
  });

  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
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

  // Check for navigation state to open modal
  useEffect(() => {
    if (location.state?.openAddDoctor) {
      setAddDoctorOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  /**
   * Handle avatar upload for new doctor form
   */
  const handleDoctorAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.loading("Rasm tayyorlanmoqda...", { id: "avatar-upload" });
      const compressed = await compressImage(file, { maxWidth: 400, maxHeight: 400, quality: 0.8 });
      setNewDoctorForm(prev => ({ ...prev, avatar_url: compressed }));
      toast.success("Rasm tanlandi!", { id: "avatar-upload" });
    } catch (err) {
      console.error("Avatar upload error:", err);
      toast.error("Rasm yuklashda xatolik yuz berdi", { id: "avatar-upload" });
    }
  };

  /**
   * Handle avatar upload for existing doctor
   */
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
      console.error("Failed to update doctor avatar:", err);
      toast.error("Rasm saqlashda xatolik yuz berdi", { id: "doctor-avatar-update" });
    }
  };

  /**
   * Load all data
   */
  const loadData = useCallback(async (preserveDoctors = []) => {
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

      const mergedDoctors = [...doctorUsers];
      preserveDoctors.forEach(pd => {
        if (!mergedDoctors.some(d => d.id === pd.id)) {
          mergedDoctors.push(pd);
        }
      });

      setDoctors(mergedDoctors);
      setPayments(pays || []);
    } catch (error) {
      console.error('Error loading payroll data:', error);
      toast.error(t('common.errorLoading'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

      const optimisticDoctor = {
        id: newUser?.id || ('usr-temp-' + Date.now()),
        name: savedName,
        full_name: savedName,
        role: 'doctor',
        clinic_id: clinicId,
        phone: newDoctorForm.phone || '',
        specialty: newDoctorForm.specialization || 'Stomatolog',
        salary_type: newDoctorForm.salary_type || 'percentage',
        base_salary: baseSalaryVal,
        commission_rate: commissionRateVal,
        avatar_url: avatarVal,
        ...(newUser || {})
      };
      setDoctors(prev => {
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
        salary_type: 'percentage',
        base_salary: '',
        commission_rate: '30',
        role: 'doctor',
        avatar_url: ''
      });

      setCredentialsModal({
        name: savedName,
        clinicId: clinicId,
        username: cleanUsername,
        password: generatedPassword
      });

      toast.success(`${savedName} muvaffaqiyatli qo'shildi!`);
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
    const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);
    return { startDate, endDate };
  }, []);

  /**
   * Calculate doctor earnings with active period support
   */
  const calculateDoctorEarnings = useCallback((doctorId) => {
    const doctorObj = doctors.find(d => String(d.id) === String(doctorId));
    const activeFilter = doctorPeriodFilters[doctorId] || { mode: 'month' };

    const now = new Date();
    
    // 1. All income payments for this doctor
    const allDoctorIncomePayments = payments.filter(p => {
      const isDoctor = String(p.doctor_id) === String(doctorId);
      const isIncome = (p.type || '').toLowerCase() === 'income';
      return isDoctor && isIncome;
    });

    // 2. Precompute ranges for Week, Month, Year, All
    // Week range: Monday 00:00:00 to Sunday 23:59:59
    const startOfWeek = new Date(now);
    const dayOfWeek = startOfWeek.getDay() || 7;
    startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
    startOfWeek.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Month range: from selectedMonth or current month
    const monthRange = getMonthRange(selectedMonth);
    const startOfMonth = monthRange.startDate;
    const endOfMonth = monthRange.endDate;

    // Year range: Jan 1 to Dec 31 of current year
    const startOfYear = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);

    const baseSalary = Number(doctorObj?.base_salary || 0);
    const isFixed = doctorObj?.salary_type === 'fixed' || (baseSalary > 0 && !doctorObj?.commission_rate);
    const doctorDefaultCommissionRate = Number(doctorObj?.commission_rate || doctorObj?.commission || 30);

    // Helper to calculate total for any payments subset
    const computeSubset = (list, mode) => {
      const rev = list.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const comm = list.reduce((sum, p) => {
        const rate = p.commission_rate || doctorDefaultCommissionRate;
        return sum + ((Number(p.amount) || 0) * (rate / 100));
      }, 0);
      let sal = comm;
      if (isFixed) {
        if (mode === 'week') sal = Math.round(baseSalary / 4);
        else if (mode === 'year') sal = baseSalary * 12;
        else sal = baseSalary;
      }
      return { rev, comm, sal, count: list.length };
    };

    // Filter payments for Week, Month, Year
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

    const weekStats = computeSubset(weeklyPayments, 'week');
    const monthStats = computeSubset(monthlyPayments, 'month');
    const yearStats = computeSubset(yearlyPayments, 'year');
    const allStats = computeSubset(allDoctorIncomePayments, 'all');

    // Determine Active Period Range based on activeFilter.mode
    let activeStartDate, activeEndDate, activePayments;

    if (activeFilter.mode === 'week') {
      activeStartDate = startOfWeek;
      activeEndDate = endOfWeek;
      activePayments = weeklyPayments;
    } else if (activeFilter.mode === 'year') {
      activeStartDate = startOfYear;
      activeEndDate = endOfYear;
      activePayments = yearlyPayments;
    } else if (activeFilter.mode === 'all') {
      activeStartDate = new Date(2000, 0, 1);
      activeEndDate = new Date(2099, 11, 31);
      activePayments = allDoctorIncomePayments;
    } else if (activeFilter.mode === 'custom' && activeFilter.startDate && activeFilter.endDate) {
      activeStartDate = new Date(activeFilter.startDate + 'T00:00:00');
      activeEndDate = new Date(activeFilter.endDate + 'T23:59:59');
      activePayments = allDoctorIncomePayments.filter(p => {
        const time = parsePaymentDate(p).getTime();
        return time >= activeStartDate.getTime() && time <= activeEndDate.getTime();
      });
    } else {
      // 'month' mode (default)
      activeStartDate = startOfMonth;
      activeEndDate = endOfMonth;
      activePayments = monthlyPayments;
    }

    // Sort active payments newest first
    const sortedActivePayments = [...activePayments].sort((a, b) => {
      return parsePaymentDate(b).getTime() - parsePaymentDate(a).getTime();
    });

    // Unique patients count in active period
    const patientIds = sortedActivePayments.map(p => p.patient_id || p.patient_name).filter(Boolean);
    const uniquePatientCount = new Set(patientIds).size;
    const patientCount = uniquePatientCount > 0 ? uniquePatientCount : sortedActivePayments.length;

    // Service Breakdown in active period
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
      weeklyTotal: weekStats.sal,
      monthlyTotal: monthStats.sal,
      yearlyTotal: yearStats.sal,
      allTotal: allStats.sal,
      activeFilter,
      startDate: activeStartDate,
      endDate: activeEndDate
    };
  }, [payments, doctors, selectedMonth, getMonthRange, doctorPeriodFilters]);

  /**
   * Get all doctors payroll data
   */
  const payrollData = useMemo(() => {
    return doctors.map(doctor => {
      const earnings = calculateDoctorEarnings(doctor.id);
      return {
        ...doctor,
        ...earnings,
        baseSalary: Number(doctor.base_salary || 0)
      };
    }).filter(d => {
      if (selectedDoctor !== 'all' && String(d.id) !== String(selectedDoctor)) return false;
      if (activeTypeFilter === 'percentage' && d.salary_type === 'fixed') return false;
      if (activeTypeFilter === 'fixed' && d.salary_type !== 'fixed') return false;
      
      const doctorName = (d.name || d.full_name || '').toLowerCase();
      const specialty = (d.specialty || '').toLowerCase();
      if (searchQuery && !doctorName.includes(searchQuery.toLowerCase()) && !specialty.includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [doctors, calculateDoctorEarnings, selectedDoctor, activeTypeFilter, searchQuery]);

  /**
   * Sorted display list for Excel grid
   */
  const sortedPayrollData = useMemo(() => {
    const list = [...payrollData];
    list.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'name':
          valA = (a.name || a.full_name || '').toLowerCase();
          valB = (b.name || b.full_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'patients':
          valA = a.patientCount || a.treatments || 0;
          valB = b.patientCount || b.treatments || 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'revenue':
          valA = a.totalRevenue || 0;
          valB = b.totalRevenue || 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        case 'salary':
        default:
          valA = a.totalSalary || 0;
          valB = b.totalSalary || 0;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    return list;
  }, [payrollData, sortField, sortOrder]);

  /**
   * Dynamic reference to the active doctor in Detail Modal
   */
  const activeDetailDoctor = useMemo(() => {
    if (!detailDoctorId) return null;
    return sortedPayrollData.find(d => String(d.id) === String(detailDoctorId)) || null;
  }, [detailDoctorId, sortedPayrollData]);

  /**
   * Calculate totals
   */
  const totals = useMemo(() => {
    return sortedPayrollData.reduce((acc, doctor) => ({
      totalRevenue: acc.totalRevenue + doctor.totalRevenue,
      totalCommission: acc.totalCommission + doctor.totalCommission,
      totalBaseSalary: acc.totalBaseSalary + doctor.baseSalary,
      totalSalary: acc.totalSalary + doctor.totalSalary,
      totalTreatments: acc.totalTreatments + doctor.treatments,
      totalPatients: acc.totalPatients + doctor.patientCount
    }), {
      totalRevenue: 0,
      totalCommission: 0,
      totalBaseSalary: 0,
      totalSalary: 0,
      totalTreatments: 0,
      totalPatients: 0
    });
  }, [sortedPayrollData]);

  /**
   * Month options generator with explicit Uzbek month names
   */
  const monthOptions = useMemo(() => {
    const options = [];
    const today = new Date();
    for (let i = 0; i < 18; i++) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const monthIdx = date.getMonth();
      const value = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
      const label = `${UZ_MONTHS[monthIdx]} ${year}`;
      options.push({ value, label });
    }
    return options;
  }, []);

  /**
   * Export to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      if (!sortedPayrollData || sortedPayrollData.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = [
        "№",
        "Shifokor (F.I.Sh)",
        "Mutaxassislik",
        "Maosh Turi",
        "Bemorlar Soni",
        "Umumiy Daromad (UZS)",
        "Doktorni Ulushi (UZS)"
      ];
      const rows = sortedPayrollData.map((d, idx) => [
        idx + 1,
        `"${(d.name || d.full_name || '').replace(/"/g, '""')}"`,
        `"${(d.specialty || 'Stomatolog').replace(/"/g, '""')}"`,
        `"${d.salary_type === 'fixed' ? 'Oylikka' : 'Foizga'}"`,
        d.patientCount || d.treatments || 0,
        Number(d.totalRevenue || 0),
        Number(d.totalSalary || 0)
      ].join(","));

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Maoshlar_Hisoboti_${selectedMonth}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Maoshlar hisoboti Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [sortedPayrollData, selectedMonth]);

  /**
   * Print Single Doctor Payout Slip
   */
  const handlePrintPayoutSlip = (doc) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Chop etish oynasini ochib bo'lmadi");
      return;
    }

    const monthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const finalSalary = Number(doc.totalSalary || 0) + Number(payForm.bonus || 0) - Number(payForm.deduction || 0);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Maosh Kvitansiyasi - ${doc.name || doc.full_name}</title>
        <style>
          body { font-family: 'Segoe UI', Arial, sans-serif; padding: 25px; color: #1e293b; line-height: 1.5; }
          .receipt { border: 2px solid #cbd5e1; border-radius: 12px; padding: 24px; max-width: 650px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px dashed #94a3b8; padding-bottom: 15px; margin-bottom: 20px; }
          .header h2 { margin: 0; font-size: 22px; color: #0f172a; text-transform: uppercase; }
          .header p { margin: 4px 0 0 0; font-size: 13px; color: #64748b; }
          .grid { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          .grid th, .grid td { border: 1px solid #cbd5e1; padding: 8px 12px; }
          .grid th { background: #f1f5f9; font-weight: bold; text-align: left; }
          .total-box { background: #f8fafc; border: 2px solid #0f172a; border-radius: 8px; padding: 14px; text-align: right; margin-top: 15px; }
          .total-amount { font-size: 22px; font-weight: 900; color: #059669; font-family: monospace; }
          .footer { margin-top: 30px; display: flex; justify-content: space-between; font-size: 12px; color: #64748b; }
          @media print { body { padding: 0; } button { display: none; } }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h2>MY CLINIC • MAOSH TO'LOV VEDOMOSTI</h2>
            <p>Davr: <strong>${monthLabel}</strong> | Chop etilgan: ${new Date().toLocaleDateString('uz-UZ')}</p>
          </div>
          
          <table class="grid">
            <tr>
              <th width="35%">Shifokor (F.I.Sh):</th>
              <td><strong>${doc.name || doc.full_name}</strong></td>
            </tr>
            <tr>
              <th>Mutaxassislik:</th>
              <td>${doc.specialty || 'Stomatolog'}</td>
            </tr>
            <tr>
              <th>Maosh Toifasi:</th>
              <td>${doc.salary_type === 'fixed' ? 'Oylikka (Qat\'iy)' : `Foizda (${doc.commission_rate || 30}%)`}</td>
            </tr>
            <tr>
              <th>Bemorlar soni:</th>
              <td><strong>${doc.patientCount || doc.treatments} ta bemor</strong></td>
            </tr>
            <tr>
              <th>Umumiy daromad (Tushum):</th>
              <td>${Number(doc.totalRevenue || 0).toLocaleString()} UZS</td>
            </tr>
            <tr>
              <th>Doktorni ulushi (Maosh):</th>
              <td>${Number(doc.totalSalary || 0).toLocaleString()} UZS</td>
            </tr>
            ${Number(payForm.bonus || 0) > 0 ? `<tr><th>Bonus / Mukofot:</th><td style="color:#059669">+${Number(payForm.bonus).toLocaleString()} UZS</td></tr>` : ''}
            ${Number(payForm.deduction || 0) > 0 ? `<tr><th>Ushlab qolingan:</th><td style="color:#dc2626">-${Number(payForm.deduction).toLocaleString()} UZS</td></tr>` : ''}
          </table>

          <div class="total-box">
            <div style="font-size:12px; font-weight:bold; text-transform:uppercase; color:#475569;">To'lanishi kerak bo'lgan yakuniy summa:</div>
            <div class="total-amount">${finalSalary.toLocaleString()} UZS</div>
          </div>

          <div class="footer">
            <div>Bosh hisobchi: ______________</div>
            <div>Shifokor imzosi: ______________</div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="space-y-3.5">
      
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('payroll.title') || "Maoshlar"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              • Hisob-kitoblar {doctors.length} Shifokor
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {t('payroll.subtitle') || "Shifokorlar ulushi, bemorlar soni va umumiy daromad hisoboti"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={exportCSV} 
            className="gap-1.5 rounded-xl border-slate-200 hover:bg-slate-50 font-black text-xs text-slate-700 h-9.5 px-3.5"
            title="Excel formatida (.csv) yuklab olish"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Eksport (Excel)</span>
          </Button>

          <Button 
            onClick={() => setAddDoctorOpen(true)} 
            className="bg-[#00D084] hover:bg-[#00B875] text-white gap-1.5 border-none rounded-xl h-9.5 px-4 font-black text-xs shadow-md shadow-[#00D084]/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('payroll.addDoctor') || "Shifokor qo'shish"}</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Financial Dashboard KPI Grid ───────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "UMUMIY DAROMAD", value: totals.totalRevenue, icon: DollarSign, color: "text-blue-600", bg: "bg-blue-50 border-blue-100", countText: "Klinikaga tushum" },
          { label: "DOKTORLAR ULUSHI", value: totals.totalCommission, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100", countText: "Komissiya summasi" },
          { label: "JAMI MAOSH", value: totals.totalSalary, icon: Users, color: "text-purple-600", bg: "bg-purple-50 border-purple-100", countText: "Chiqim vedomosti" },
          { label: "BEMORLAR SONI", value: totals.totalPatients, icon: Calendar, color: "text-slate-800", bg: "bg-slate-50 border-slate-200", isNumber: true, countText: "Jami qabul qilingan" },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                {s.label}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {s.isNumber ? (
                  <span>{s.value} <span className="text-xs font-bold text-slate-400">ta</span></span>
                ) : (
                  <span>{Number(s.value).toLocaleString()} <span className="text-[10px] font-bold text-slate-400">UZS</span></span>
                )}
              </div>
              <p className="text-[9.5px] font-medium text-slate-400 mt-0.5">{s.countText}</p>
            </div>

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Excel Spreadsheet Controls Bar ────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder="Shifokor ismi yoki mutaxassisligi bo'yicha qidiruv..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: "Barchasi", count: doctors.length },
              { id: 'percentage', label: "Foizda", count: doctors.filter(d => d.salary_type !== 'fixed').length },
              { id: 'fixed', label: "Oylikda", count: doctors.filter(d => d.salary_type === 'fixed').length }
            ].map(tab => {
              const isActive = activeTypeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTypeFilter(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                    isActive 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'bg-slate-100/70 text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Month Selector */}
          <div className="w-full sm:w-auto">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-full sm:w-48 h-9 rounded-xl font-bold text-xs bg-slate-50 border-slate-200">
                <Calendar className="w-3.5 h-3.5 mr-2 text-[#1499AD]" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold text-xs">
                {monthOptions.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Doctor Filter Select */}
          <div className="w-full sm:w-auto">
            <Select value={selectedDoctor} onValueChange={setSelectedDoctor}>
              <SelectTrigger className="w-full sm:w-44 h-9 rounded-xl font-bold text-xs bg-slate-50 border-slate-200">
                <Users className="w-3.5 h-3.5 mr-2 text-slate-400" />
                <SelectValue placeholder={t('payroll.allDoctors') || "Barcha shifokorlar"} />
              </SelectTrigger>
              <SelectContent className="rounded-xl font-bold text-xs">
                <SelectItem value="all">{t('payroll.allDoctors') || "Barcha shifokorlar"}</SelectItem>
                {doctors.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name || d.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Density Switcher */}
          <div className="hidden sm:flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 self-end lg:self-auto shrink-0">
            <button
              onClick={() => toggleDensity('compact')}
              title="Ixcham Excel Jadvali"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                density === 'compact' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5 text-[#1499AD]" />
              <span>Excel</span>
            </button>
            <button
              onClick={() => toggleDensity('comfortable')}
              title="Keng Jadval Ko'rinishi"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-black transition-all ${
                density === 'comfortable' 
                  ? 'bg-white text-slate-900 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-slate-500" />
              <span>Keng</span>
            </button>
          </div>

        </div>
      </div>

      {/* ─── Main Excel Spreadsheet Data Grid Table ──────────────────── */}
      {/* Columns: № | SHIFOKOR (F.I.SH) | BEMORLAR SONI | UMUMIY DAROMAD | DOKTORNI ULUSHI | AMALLAR */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
      >
        {loading && (
          <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
            <motion.div 
              className="h-full bg-gradient-to-r from-[#1499AD] to-[#0E7A8A]"
              animate={{ x: ['-100%', '100%'] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left select-text">
            {/* ─── Excel Table Header ────────────────── */}
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                
                {/* № Col */}
                <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 select-none font-mono">
                  №
                </th>

                {/* SHIFOKOR (F.I.SH) */}
                <th 
                  onClick={() => handleSort('name')}
                  className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span>Shifokor (F.I.Sh)</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* BEMORLAR SONI */}
                <th 
                  onClick={() => handleSort('patients')}
                  className="w-40 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap bg-blue-50/30"
                  title="Bemorlar soni bo'yicha saralash"
                >
                  <div className="flex items-center justify-center gap-1.5 text-blue-800 font-mono">
                    <span>Bemorlar soni</span>
                    {sortField === 'patients' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* UMUMIY DAROMAD */}
                <th 
                  onClick={() => handleSort('revenue')}
                  className="w-48 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  title="Umumiy daromad bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-slate-700 font-mono">
                    <span>Umumiy daromad</span>
                    {sortField === 'revenue' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-600" /> : <ArrowDown className="w-3 h-3 text-blue-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </div>
                </th>

                {/* DOKTORNI ULUSHI */}
                <th 
                  onClick={() => handleSort('salary')}
                  className="w-48 px-3.5 py-2.5 text-right border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors bg-emerald-50/40 select-none whitespace-nowrap"
                  title="Doktorni ulushi bo'yicha saralash"
                >
                  <div className="flex items-center justify-end gap-1.5 text-emerald-700 font-mono">
                    <span>Doktorni ulushi</span>
                    {sortField === 'salary' ? (
                      sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-emerald-600" /> : <ArrowDown className="w-3 h-3 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    )}
                  </div>
                </th>

                {/* Actions */}
                <th className="w-40 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                  {t('common.actions') || "Amallar"}
                </th>

              </tr>
            </thead>

            {/* ─── Excel Table Body ────────────────── */}
            <tbody className="divide-y divide-slate-200/70 text-xs">
              {sortedPayrollData.length > 0 ? (
                sortedPayrollData.map((doc, idx) => {
                  const isCompact = density === 'compact';
                  const isFixed = doc.salary_type === 'fixed' || (Number(doc.base_salary) > 0 && !Number(doc.commission_rate));

                  return (
                    <tr 
                      key={doc.id} 
                      className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                        idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                      }`}
                      onClick={() => setDetailDoctorId(doc.id)}
                    >
                      {/* № Cell */}
                      <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                        {idx + 1}
                      </td>

                      {/* SHIFOKOR (F.I.SH) Cell */}
                      <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative group/avatar shrink-0">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-black text-[11px] border border-slate-200 overflow-hidden group-hover:bg-[#1499AD] group-hover:text-white transition-colors">
                              {(doc.avatar_url || doc.photo || doc.avatar || doc.image) ? (
                                <img 
                                  src={doc.avatar_url || doc.photo || doc.avatar || doc.image} 
                                  alt={doc.name || doc.full_name} 
                                  className="w-full h-full object-cover" 
                                />
                              ) : (
                                (doc.name || doc.full_name)?.charAt(0) || 'D'
                              )}
                            </div>
                            <label 
                              onClick={(e) => e.stopPropagation()} 
                              className="absolute inset-0 bg-slate-900/60 text-white rounded-lg flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
                              title="Rasmni yuklash / o'zgartirish"
                            >
                              <Camera className="w-3 h-3 text-white" />
                              <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={(e) => handleExistingDoctorAvatarUpload(doc.id, e)} 
                              />
                            </label>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-extrabold text-slate-900 group-hover:text-[#1499AD] transition-colors truncate block">
                                {doc.name || doc.full_name}
                              </span>
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider bg-slate-100 px-1.5 py-0.2 rounded shrink-0">
                                {doc.specialty || 'Stomatolog'}
                              </span>
                              {isFixed ? (
                                <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1 py-0.2 rounded border border-purple-100">
                                  Oylik
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-100">
                                  {doc.commission_rate || 30}%
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* BEMORLAR SONI Cell */}
                      <td className={`text-center border-r border-slate-200/70 whitespace-nowrap bg-blue-50/20 ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                        <span className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-md text-[11px] font-mono font-black text-blue-800 bg-blue-100/70 border border-blue-200/60">
                          <span>{doc.patientCount || doc.treatments} ta bemor</span>
                        </span>
                      </td>

                      {/* UMUMIY DAROMAD Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                        <span className="font-mono font-bold text-slate-800 text-xs tabular-nums">
                          {Number(doc.totalRevenue || 0).toLocaleString()}
                          <span className="text-[9.5px] font-semibold text-slate-400 ml-1">UZS</span>
                        </span>
                      </td>

                      {/* DOKTORNI ULUSHI Cell */}
                      <td className={`text-right border-r border-slate-200/70 whitespace-nowrap bg-emerald-50/30 ${isCompact ? 'py-1.5 px-2.5' : 'py-2.5 px-3'}`}>
                        <span className="font-mono font-black text-emerald-600 text-xs tabular-nums">
                          {Number(doc.totalSalary || 0).toLocaleString()}
                          <span className="text-[9.5px] font-semibold text-emerald-500 ml-1">UZS</span>
                        </span>
                      </td>

                      {/* Actions Cell */}
                      <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`}>
                        <div className="flex items-center justify-center gap-1.5" onClick={(ev) => ev.stopPropagation()}>
                          <Button 
                            onClick={() => {
                              setPayModalDoctor(doc);
                              setPayForm({ method: 'cash', notes: '', bonus: 0, deduction: 0 });
                            }}
                            className="h-6.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1 border-none shadow-xs transition-all active:scale-95"
                            title="Maosh to'lash"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>To'lash</span>
                          </Button>

                          <Button 
                            onClick={() => setDetailDoctorId(doc.id)}
                            variant="ghost" 
                            className="h-6.5 px-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1"
                            title="Batafsil hisob-kitob"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Batafsil</span>
                          </Button>

                          <button 
                            onClick={() => handleDeleteDoctor(doc.id, doc.name || doc.full_name)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Shifokorni o'chirish"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                        <Users className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-500">
                        {searchQuery ? `"${searchQuery}" bo'yicha shifokor topilmadi` : "Shifokorlar ro'yxati bo'sh"}
                      </p>
                      {(searchQuery || selectedDoctor !== 'all' || activeTypeFilter !== 'all') && (
                        <button
                          onClick={() => { setSearchQuery(''); setSelectedDoctor('all'); setActiveTypeFilter('all'); }}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                        >
                          Filtrlarni tozalash
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ─── Excel Formula Summary Footer Bar ──────────────────── */}
        <div className="bg-slate-100/90 border-t border-slate-200/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 text-slate-600 font-bold">
            <span className="flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-[#1499AD]" />
              <span>Jadvalda:</span>
              <strong className="text-slate-900 font-mono">{sortedPayrollData.length}</strong> ta shifokor
            </span>
            <span className="text-slate-300">•</span>
            <span>
              Σ Jami Bemorlar: <strong className="text-blue-700 font-mono">{totals.totalPatients} ta</strong>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Umumiy Daromad:</span>
              <span className="font-mono font-bold text-slate-800 text-sm">
                {totals.totalRevenue.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-300 pl-3">
              <span className="text-[11px] font-black uppercase text-slate-500">Σ Doktorni Ulushi:</span>
              <span className="font-mono font-black text-emerald-600 text-sm">
                {totals.totalSalary.toLocaleString()} <span className="text-[10px] text-slate-500">UZS</span>
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── Doctor Detailed Payroll Excel Breakdown Modal ──────────── */}
      <Dialog open={!!activeDetailDoctor} onOpenChange={(open) => { if (!open) setDetailDoctorId(null); }}>
        <DialogContent className="sm:max-w-3xl rounded-2xl p-5 max-h-[92vh] overflow-y-auto">
          {activeDetailDoctor && (
            <div className="space-y-4">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#00D084] text-white flex items-center justify-center font-black text-sm shadow-sm overflow-hidden">
                      {(activeDetailDoctor.avatar_url || activeDetailDoctor.photo || activeDetailDoctor.avatar) ? (
                        <img 
                          src={activeDetailDoctor.avatar_url || activeDetailDoctor.photo || activeDetailDoctor.avatar} 
                          alt="" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        (activeDetailDoctor.name || activeDetailDoctor.full_name)?.charAt(0) || 'D'
                      )}
                    </div>
                    <div>
                      <DialogTitle className="text-base font-black text-slate-900">
                        {activeDetailDoctor.name || activeDetailDoctor.full_name} — Maosh & Bemorlar Tafsiloti
                      </DialogTitle>
                      <p className="text-[11px] font-bold text-slate-400">
                        {activeDetailDoctor.specialty || 'Stomatolog'} • {activeDetailDoctor.salary_type === 'fixed' ? `Oylik: ${Number(activeDetailDoctor.base_salary).toLocaleString()} UZS` : `${activeDetailDoctor.commission_rate || 30}% foizda`}
                      </p>
                    </div>
                  </div>

                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintPayoutSlip(activeDetailDoctor)}
                    className="h-8 px-3 rounded-xl border-slate-200 text-xs font-bold gap-1.5 text-slate-700 hover:bg-slate-50"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600" />
                    <span>Chop etish</span>
                  </Button>
                </div>
              </DialogHeader>

              {/* Dynamic Period Selector Tabs: Hafta, Oy, Yil, Barchasi */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'week', label: "Joriy Hafta", value: activeDetailDoctor.weeklyTotal },
                  { id: 'month', label: "Joriy Oy", value: activeDetailDoctor.monthlyTotal },
                  { id: 'year', label: "Joriy Yil", value: activeDetailDoctor.yearlyTotal },
                  { id: 'all', label: "Barchasi", value: activeDetailDoctor.allTotal }
                ].map(p => {
                  const currentMode = activeDetailDoctor.activeFilter?.mode || 'month';
                  const isActive = currentMode === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setDoctorPeriodFilters(prev => ({
                          ...prev,
                          [activeDetailDoctor.id]: { mode: p.id }
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isActive 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm scale-[1.02]' 
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <p className="text-[9.5px] font-black uppercase tracking-wider opacity-75">{p.label}</p>
                      <p className="text-xs font-black font-mono mt-0.5">{Number(p.value || 0).toLocaleString()} UZS</p>
                    </button>
                  );
                })}
              </div>

              {/* Detail Sub-tabs: Bemorlar va to'lovlar VS Xizmatlar */}
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setDetailModalTab('patients')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      detailModalTab === 'patients'
                        ? 'bg-blue-50 text-blue-700 font-extrabold border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Receipt className="w-3.5 h-3.5 text-blue-600" />
                    <span>Bemorlar va To'lovlar Ro'yxati ({activeDetailDoctor.rawPayments?.length || 0})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDetailModalTab('services')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      detailModalTab === 'services'
                        ? 'bg-blue-50 text-blue-700 font-extrabold border border-blue-200'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                    <span>Xizmatlar bo'yicha hisobot</span>
                  </button>
                </div>

                <div className="text-[11px] font-bold text-slate-400">
                  Davr: <strong className="text-slate-700">{formatDateOnly(activeDetailDoctor.startDate)} — {formatDateOnly(activeDetailDoctor.endDate)}</strong>
                </div>
              </div>

              {/* Sub-view 1: Bemorlar va To'lovlar ro'yxati */}
              {detailModalTab === 'patients' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 z-10">
                        <tr className="border-b border-slate-200 text-slate-600 text-[10px] font-black uppercase">
                          <th className="w-10 px-2.5 py-2 text-center border-r border-slate-200">№</th>
                          <th className="px-3 py-2 border-r border-slate-200">Sana</th>
                          <th className="px-3 py-2 border-r border-slate-200">Bemor (F.I.Sh)</th>
                          <th className="px-3 py-2 border-r border-slate-200">Xizmat / Tavsif</th>
                          <th className="px-3 py-2 text-right border-r border-slate-200">To'lov Summasi</th>
                          <th className="px-3 py-2 text-right">Shifokor Ulushi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 font-mono">
                        {activeDetailDoctor.rawPayments?.length > 0 ? (
                          activeDetailDoctor.rawPayments.map((p, idx) => {
                            const paymentDate = parsePaymentDate(p);
                            const rate = p.commission_rate || activeDetailDoctor.commission_rate || 30;
                            const share = (Number(p.amount) || 0) * (rate / 100);

                            return (
                              <tr key={p.id || idx} className="hover:bg-slate-50">
                                <td className="px-2.5 py-2 text-center text-slate-400 border-r border-slate-200/70">{idx + 1}</td>
                                <td className="px-3 py-2 border-r border-slate-200/70 text-slate-600 whitespace-nowrap">
                                  {formatDateTime(paymentDate)}
                                </td>
                                <td className="px-3 py-2 font-sans font-bold text-slate-900 border-r border-slate-200/70">
                                  {p.patient_name || p.patient_full_name || 'Noma\'lum bemor'}
                                </td>
                                <td className="px-3 py-2 font-sans text-slate-700 border-r border-slate-200/70">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold">{p.service_name || p.category || 'Davolash'}</span>
                                    {p.payment_method && (
                                      <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1 py-0.2 rounded">
                                        {p.payment_method}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-3 py-2 text-right border-r border-slate-200/70 font-bold text-slate-800">
                                  {Number(p.amount || 0).toLocaleString()} UZS
                                </td>
                                <td className="px-3 py-2 text-right font-black text-emerald-600">
                                  {Number(share || 0).toLocaleString()} UZS
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={6} className="py-8 text-center text-slate-400 font-sans">
                              Ushbu davr uchun bajarilgan to'lovlar topilmadi
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Sub-view 2: Xizmatlar bo'yicha hisobot */}
              {detailModalTab === 'services' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                  <div className="max-h-72 overflow-y-auto">
                    <table className="w-full border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-slate-100 z-10">
                        <tr className="border-b border-slate-200 text-slate-600 text-[10px] font-black uppercase">
                          <th className="px-3 py-2 border-r border-slate-200">Xizmat / Kategoriya</th>
                          <th className="px-2 py-2 text-center border-r border-slate-200">Bemorlar soni</th>
                          <th className="px-3 py-2 text-right border-r border-slate-200">Umumiy Daromad</th>
                          <th className="px-2 py-2 text-center border-r border-slate-200">Foiz</th>
                          <th className="px-3 py-2 text-right">Doktorni Ulushi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/70 font-mono">
                        {Object.values(activeDetailDoctor.earnings).length > 0 ? (
                          Object.values(activeDetailDoctor.earnings).map((earning, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-sans font-extrabold text-slate-800 border-r border-slate-200/70">{earning.serviceName}</td>
                              <td className="px-2 py-2 text-center border-r border-slate-200/70">
                                <span className="bg-slate-100 px-1.5 py-0.2 rounded text-[11px] font-bold">{earning.count} ta</span>
                              </td>
                              <td className="px-3 py-2 text-right border-r border-slate-200/70 text-slate-700 font-bold">
                                {Number(earning.totalRevenue || 0).toLocaleString()} UZS
                              </td>
                              <td className="px-2 py-2 text-center border-r border-slate-200/70 font-sans">
                                <span className="bg-emerald-50 text-emerald-700 font-bold px-1.5 py-0.2 rounded text-[10px]">{earning.commissionRate}%</span>
                              </td>
                              <td className="px-3 py-2 text-right font-black text-emerald-600">
                                {Number(earning.totalCommission || 0).toLocaleString()} UZS
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                              Ushbu davr uchun bajarilgan xizmatlar topilmadi
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Bottom Dynamic Summary Card */}
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800">
                    Tanlangan davr bo'yicha hisoblangan maosh:
                  </span>
                  <div className="text-xl font-black font-mono text-emerald-700">
                    {Number(activeDetailDoctor.totalSalary || 0).toLocaleString()} <span className="text-xs">UZS</span>
                  </div>
                  <p className="text-[11px] font-bold text-slate-500">
                    Bemorlar: <strong className="text-blue-700 font-mono">{activeDetailDoctor.patientCount} ta</strong> • Klinikaga tushum: <strong className="text-slate-800 font-mono">{Number(activeDetailDoctor.totalRevenue || 0).toLocaleString()} UZS</strong>
                  </p>
                </div>

                <Button
                  onClick={() => {
                    setPayModalDoctor(activeDetailDoctor);
                    setDetailDoctorId(null);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9.5 px-4 rounded-xl shadow-xs shrink-0 active:scale-95 transition-all"
                >
                  <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
                  <span>Maoshni to'lash</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Payout Confirmation / Processing Modal ─────────────────── */}
      <Dialog open={!!payModalDoctor} onOpenChange={() => setPayModalDoctor(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl p-6">
          {payModalDoctor && (
            <div className="space-y-4">
              <DialogHeader>
                <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                  <span>Maosh To'lash Vedomosti</span>
                </DialogTitle>
              </DialogHeader>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Shifokor:</span>
                  <strong className="text-slate-900">{payModalDoctor.name || payModalDoctor.full_name}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Bemorlar Soni:</span>
                  <span className="font-bold text-blue-700">{payModalDoctor.patientCount || payModalDoctor.treatments} ta bemor</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Umumiy Daromad:</span>
                  <span className="font-mono font-bold text-slate-800">{Number(payModalDoctor.totalRevenue || 0).toLocaleString()} UZS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Doktorni Ulushi (Maosh):</span>
                  <span className="font-mono font-bold text-emerald-700">{Number(payModalDoctor.totalSalary || 0).toLocaleString()} UZS</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-bold">Davr:</span>
                  <span className="font-bold text-slate-800">{monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth}</span>
                </div>
              </div>

              {/* Bonus / Deduction adjustments */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Bonus / Mukofot (so'm)</Label>
                  <Input 
                    type="number"
                    value={payForm.bonus || ''}
                    onChange={e => setPayForm({ ...payForm, bonus: Number(e.target.value || 0) })}
                    placeholder="0"
                    className="mt-1 h-9 rounded-xl font-mono text-xs font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[11px] font-bold text-slate-700">Ushlab qolish (so'm)</Label>
                  <Input 
                    type="number"
                    value={payForm.deduction || ''}
                    onChange={e => setPayForm({ ...payForm, deduction: Number(e.target.value || 0) })}
                    placeholder="0"
                    className="mt-1 h-9 rounded-xl font-mono text-xs font-bold text-rose-600"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <Label className="text-[11px] font-bold text-slate-700">To'lov Usuli</Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setPayForm({ ...payForm, method: 'cash' })}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      payForm.method === 'cash' 
                        ? 'bg-slate-900 text-white border-slate-900' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Naqd Pul
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayForm({ ...payForm, method: 'card' })}
                    className={`py-2 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                      payForm.method === 'card' 
                        ? 'bg-slate-900 text-white border-slate-900' 
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    Karta / Bank
                  </button>
                </div>
              </div>

              {/* Total Payable Box */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-[10px] font-black uppercase text-emerald-800">Yakuniy to'lanadigan summa:</span>
                <div className="text-xl font-black font-mono text-emerald-700 mt-0.5">
                  {(Number(payModalDoctor.totalSalary || 0) + Number(payForm.bonus || 0) - Number(payForm.deduction || 0)).toLocaleString()} UZS
                </div>
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setPayModalDoctor(null)}
                  className="rounded-xl text-xs font-bold"
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
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black px-4"
                >
                  <Printer className="w-3.5 h-3.5 mr-1" />
                  <span>To'lash va Chek chiqarish</span>
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Add Doctor Modal ────────────────────────────────────────── */}
      <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">{t('payroll.addDoctor') || "Yangi Shifokor Qo'shish"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Doctor Photo / Avatar Upload */}
            <div className="flex items-center gap-3.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="relative w-12 h-12 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center overflow-hidden shrink-0 group">
                {newDoctorForm.avatar_url ? (
                  <>
                    <img 
                      src={newDoctorForm.avatar_url} 
                      alt="Shifokor rasmi" 
                      className="w-full h-full object-cover" 
                    />
                    <button
                      type="button"
                      onClick={() => setNewDoctorForm(prev => ({ ...prev, avatar_url: '' }))}
                      className="absolute inset-0 bg-rose-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="O'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                ) : (
                  <Camera className="w-5 h-5 text-slate-300 group-hover:text-emerald-500 transition-colors" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <label className="text-xs font-bold text-slate-700 block mb-0.5">Shifokor rasmi (Avatar)</label>
                <label className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl text-xs font-bold text-slate-700 hover:text-emerald-600 shadow-xs transition-all cursor-pointer">
                  <Upload className="w-3 h-3" />
                  <span>{newDoctorForm.avatar_url ? "Rasmni almashtirish" : "Rasm tanlash"}</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleDoctorAvatarUpload} 
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('staff.full_name') || "F.I.Sh"} *</Label>
                <Input 
                  value={newDoctorForm.full_name}
                  onChange={e => setNewDoctorForm({...newDoctorForm, full_name: e.target.value})}
                  placeholder="Dr. Alisher"
                  className="rounded-xl h-10 font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('staff.phone') || "Telefon"}</Label>
                <Input 
                  value={newDoctorForm.phone}
                  onChange={e => setNewDoctorForm({...newDoctorForm, phone: e.target.value})}
                  placeholder="+998 90 123 45 67"
                  className="rounded-xl h-10 font-mono font-bold"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">{t('staff.specialty') || "Mutaxassisligi"}</Label>
                <Input 
                  value={newDoctorForm.specialization}
                  onChange={e => setNewDoctorForm({...newDoctorForm, specialization: e.target.value})}
                  placeholder="Masalan: Stomatolog, Ortodont, Jarroh..."
                  className="rounded-xl h-10 font-bold"
                />
              </div>

              {/* Daromad toifasi (Foizga / Oylikka) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">Maosh hisoblash usuli *</Label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => setNewDoctorForm({ ...newDoctorForm, salary_type: 'percentage', base_salary: '' })}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      newDoctorForm.salary_type === 'percentage'
                        ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/80 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>Foizga</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewDoctorForm({ ...newDoctorForm, salary_type: 'fixed', commission_rate: '' })}
                    className={`py-2 px-3 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      newDoctorForm.salary_type === 'fixed'
                        ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-200/80 scale-[1.02]'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span>Oylikka (so'm)</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Field */}
              {newDoctorForm.salary_type === 'percentage' ? (
                <div className="space-y-1 animate-in fade-in-50 duration-200">
                  <Label className="text-xs font-bold text-slate-700">{t('staff.commission_rate') || "Komissiya foizi (%)"} *</Label>
                  <div className="relative">
                    <Input 
                      type="number"
                      value={newDoctorForm.commission_rate}
                      onChange={e => setNewDoctorForm({...newDoctorForm, commission_rate: e.target.value})}
                      onWheel={e => e.target.blur()}
                      placeholder="30"
                      className="rounded-xl h-10 pr-8 font-bold text-sm"
                      autoFocus
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">%</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 animate-in fade-in-50 duration-200">
                  <Label className="text-xs font-bold text-slate-700">Oylik maosh miqdori (so'm) *</Label>
                  <div className="relative">
                    <Input 
                      type="text"
                      inputMode="numeric"
                      value={newDoctorForm.base_salary === '' ? '' : Number(newDoctorForm.base_salary).toLocaleString('uz-UZ')}
                      onChange={e => {
                        const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '');
                        if (raw === '') setNewDoctorForm({ ...newDoctorForm, base_salary: '' });
                        else if (/^\d+$/.test(raw)) setNewDoctorForm({ ...newDoctorForm, base_salary: Number(raw) });
                      }}
                      onWheel={e => e.target.blur()}
                      placeholder="5 000 000"
                      className="rounded-xl h-10 pr-12 font-bold font-mono text-sm"
                      autoFocus
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">UZS</span>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button variant="outline" onClick={() => setAddDoctorOpen(false)} className="flex-1 rounded-xl" disabled={addingDoctor}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleAddDoctor} className="flex-1 bg-[#00D084] hover:bg-[#00B875] text-white rounded-xl font-bold" disabled={addingDoctor}>
                {addingDoctor ? t('common.saving') + '...' : t('common.save')}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Credentials Modal (Success) ─────────────────────────────── */}
      <Dialog open={!!credentialsModal} onOpenChange={() => setCredentialsModal(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-2xl p-6 text-center border-emerald-100">
          <div className="mx-auto w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mb-3 ring-6 ring-emerald-50">
            <Shield className="w-7 h-7 text-emerald-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900 mx-auto tracking-tight">{t('staff.addSuccess') || "Shifokor Qo'shildi!"}</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-xs text-slate-500 font-medium">
              <strong className="text-slate-800">{credentialsModal?.name}</strong> tizimga muvaffaqiyatli qo'shildi. Kirish ma'lumotlari:
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2.5 text-left text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">Klinika ID</span>
                <div className="font-mono text-sm font-bold text-blue-600 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-xs">
                  {credentialsModal?.clinicId}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">{t('staff.username')}</span>
                <div className="font-mono text-sm font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-xs">
                  {credentialsModal?.username}
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">{t('staff.password')}</span>
                <div className="font-mono text-sm font-bold text-slate-800 bg-white px-2.5 py-1 rounded-lg border border-slate-100 shadow-xs">
                  {credentialsModal?.password}
                </div>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => setCredentialsModal(null)} 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-10 font-bold uppercase tracking-wider text-xs"
          >
            {t('staff.understand') || "Tushundim"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

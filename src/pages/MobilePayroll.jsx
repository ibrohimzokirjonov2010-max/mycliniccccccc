import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  DollarSign, TrendingUp, Users, Calendar, 
  ChevronRight, ChevronDown, Activity, Download, Search, Plus, Shield
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * Premium SaaS Mobile Payroll
 * Mimics the high-end Appointments view design
 */
export default function MobilePayroll() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [doctors, setDoctors] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [expandedDoctor, setExpandedDoctor] = useState(null);

  // Add Doctor states
  const location = useLocation();
  const [addDoctorOpen, setAddDoctorOpen] = useState(false);
  const [addingDoctor, setAddingDoctor] = useState(false);
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

  // Check for navigation state to open modal from Appointments
  useEffect(() => {
    if (location.state?.openAddDoctor) {
      setAddDoctorOpen(true);
      setTimeout(() => window.history.replaceState({}, document.title), 100);
    }
  }, [location.state]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [users, pays] = await Promise.all([
        base44.entities.User.list('name', 100),
        base44.entities.Payment.filter({ type: 'Income' }, '-date', 100)  // ⚡ tez
      ]);
      setDoctors(users.filter(u => u.role === 'doctor'));
      setPayments(pays || []);
    } catch (error) {
      console.error('Failed to load payroll data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleAddDoctor = useCallback(async () => {
    if (!newDoctorForm.full_name) {
      return toast.error("Iltimos, ism va familiyani kiriting!");
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

      setAddDoctorOpen(false);
      setNewDoctorForm({
        full_name: '', username: '', password: '', phone: '',
        specialization: 'Stomatolog', base_salary: 0, commission_rate: 30, role: 'doctor'
      });

      setCredentialsModal({
        name: savedName,
        clinicId: clinicId,
        username: cleanUsername,
        password: generatedPassword
      });

      toast.success(`${savedName} muvaffaqiyatli qo'shildi!`);
      setTimeout(() => loadData(), 1000);
      
    } catch (error) {
      console.error('Failed to add doctor:', error);
      toast.error('Shifokor qo\'shishda xatolik yuz berdi');
    } finally {
      setAddingDoctor(false);
    }
  }, [newDoctorForm, loadData]);

  useEffect(() => { loadData(); }, [loadData]);

  const payrollData = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    return doctors.map(doctor => {
      const doctorPayments = payments.filter(p => {
        const d = new Date(p.date || p.created_date);
        return p.doctor_id === doctor.id && d >= startDate && d <= endDate && p.type === 'Income';
      });

      const totalCommission = doctorPayments.reduce((sum, p) => {
        const rate = p.commission_rate || doctor.commission_rate || 30;
        return sum + (p.amount || 0) * (rate / 100);
      }, 0);

      const totalRevenue = doctorPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      return {
        ...doctor,
        treatmentsCount: doctorPayments.length,
        totalCommission,
        totalRevenue,
        totalSalary: (doctor.base_salary || 0) + totalCommission
      };
    }).filter(d => (d.name || d.full_name)?.toLowerCase().includes(search.toLowerCase()));
  }, [doctors, payments, selectedMonth, search]);

  const totals = useMemo(() => {
    return payrollData.reduce((acc, d) => ({
      salary: acc.salary + d.totalSalary,
      commission: acc.commission + d.totalCommission,
      work: acc.work + d.treatmentsCount
    }), { salary: 0, commission: 0, work: 0 });
  }, [payrollData]);

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-slate-50 pb-20">
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('navigation.payroll')}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{t('staff.commission')}</p>
            </div>
            <button className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative mb-5 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400 group-focus-within:text-slate-900 transition-colors" />
            <Input 
              placeholder={t('appointments.doctor')+' ...'} 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-11 h-11 rounded-xl bg-slate-100 border-none focus:ring-2 focus:ring-slate-200 font-medium"
            />
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
              <p className="text-[11px] font-black text-emerald-700">{Math.round(totals.salary/1000)}K</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('navigation.payroll')}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <p className="text-[11px] font-black text-blue-700">{Math.round(totals.commission/1000)}K</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('staff.commission')}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
              <p className="text-[11px] font-black text-purple-700">{totals.work}</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('common.actions')}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-100">
              <p className="text-[11px] font-black text-slate-900">{payrollData.length}</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('appointments.doctor')}</p>
            </div>
          </div>
        </div>

        {/* Doctor List */}
        <div className="p-4 space-y-3">
          {loading ? (
             [1, 2, 3].map(i => (
               <div key={i} className="bg-white rounded-[2rem] p-4 h-28 animate-pulse shadow-sm" />
             ))
          ) : payrollData.length > 0 ? (
            <AnimatePresence>
              {payrollData.map((doctor, index) => (
                <motion.div
                  key={doctor.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-white rounded-[2rem] overflow-hidden shadow-sm border ${expandedDoctor === doctor.id ? 'border-emerald-200 ring-1 ring-emerald-50' : 'border-slate-50'}`}
                >
                  <div 
                    className="p-5 flex items-center gap-4"
                    onClick={() => setExpandedDoctor(expandedDoctor === doctor.id ? null : doctor.id)}
                  >
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg transition-all duration-300 ${expandedDoctor === doctor.id ? 'bg-[#00D084] text-white rotate-6 scale-110' : 'bg-slate-100 text-slate-500'}`}>
                      {(doctor.name || doctor.full_name)?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-black text-slate-900 truncate tracking-tight text-base">{doctor.name || doctor.full_name}</h3>
                        <ChevronDown className={`w-4 h-4 text-slate-300 transition-transform ${expandedDoctor === doctor.id ? 'rotate-180 text-emerald-500' : ''}`} />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 rounded-lg">
                          <Activity className="w-3 h-3 text-blue-500" />
                          <span className="text-[9px] font-black text-blue-600">{doctor.treatmentsCount} ta ish</span>
                        </div>
                        <p className="text-base font-black text-emerald-600 tracking-tighter">
                          {formatCurrency(doctor.totalSalary)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {expandedDoctor === doctor.id && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="px-5 pb-5 border-t border-slate-50 bg-slate-50/30"
                    >
                      <div className="pt-4 grid grid-cols-2 gap-3">
                        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Bazaviy maosh</p>
                          <p className="text-xs font-black text-slate-700">{formatCurrency(doctor.base_salary || 0)}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
                          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Foiz (Komissiya)</p>
                          <p className="text-xs font-black text-emerald-600">{formatCurrency(doctor.totalCommission)}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => navigate(`/payroll/${doctor.id}`)}
                        className="w-full mt-3 py-3 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 flex items-center justify-center gap-2"
                      >
                        Batafsil tahlil <ChevronRight className="w-3 h-3" />
                      </button>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          ) : (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto mb-5">
                <DollarSign className="w-10 h-10 text-slate-300" />
              </div>
              <p className="text-slate-600 font-black text-lg tracking-tight">{t('common.noData')}</p>
              <p className="text-xs font-bold text-slate-400 mt-1 uppercase tracking-widest">{t('appointments.doctor')} {t('common.noData')}</p>
            </div>
          )}
        </div>

        <div className="px-5 mt-5 pb-10 text-center">
          <p className="text-[10px] text-slate-300 font-bold uppercase tracking-[0.3em]">
            Stomatologiya Payroll System v2.0
          </p>
        </div>

        {/* Add Doctor Modal UI */}
        <Dialog open={addDoctorOpen} onOpenChange={setAddDoctorOpen}>
          <DialogContent className="w-[95vw] sm:max-w-md rounded-3xl p-5 border-none shadow-2xl">
            <DialogHeader className="mb-2">
              <DialogTitle className="text-xl font-black tracking-tight">{t('staff.addNew')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-500 uppercase">{t('staff.full_name')}</Label>
                <Input 
                  value={newDoctorForm.full_name}
                  onChange={e => setNewDoctorForm({...newDoctorForm, full_name: e.target.value})}
                  placeholder="Masalan: Dr. Alisher"
                  className="rounded-xl h-12 border-slate-200 focus:border-emerald-500 text-base"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">{t('common.phone')}</Label>
                  <Input 
                    value={newDoctorForm.phone}
                    onChange={e => setNewDoctorForm({...newDoctorForm, phone: e.target.value})}
                    placeholder="+998..."
                    className="rounded-xl h-12 border-slate-200 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">{t('staff.specialty')}</Label>
                  <Input 
                    value={newDoctorForm.specialization}
                    onChange={e => setNewDoctorForm({...newDoctorForm, specialization: e.target.value})}
                    placeholder="Stomatolog"
                    className="rounded-xl h-12 border-slate-200 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">Bazaviy maosh</Label>
                  <Input 
                    type="number"
                    value={newDoctorForm.base_salary}
                    onChange={e => setNewDoctorForm({...newDoctorForm, base_salary: Number(e.target.value)})}
                    placeholder="0"
                    className="rounded-xl h-12 border-slate-200 focus:border-emerald-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-500 uppercase">{t('staff.commission_rate')}</Label>
                  <Input 
                    type="number"
                    value={newDoctorForm.commission_rate}
                    onChange={e => setNewDoctorForm({...newDoctorForm, commission_rate: Number(e.target.value)})}
                    placeholder="30"
                    className="rounded-xl h-12 border-slate-200 focus:border-emerald-500"
                  />
                </div>
              </div>

              <Button 
                onClick={handleAddDoctor} 
                className="w-full h-12 mt-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-black text-base rounded-xl shadow-lg border-none"
                disabled={addingDoctor}
              >
                {addingDoctor ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Credentials Modal (Success) */}
        <Dialog open={!!credentialsModal} onOpenChange={() => setCredentialsModal(null)}>
          <DialogContent className="w-[90vw] sm:max-w-[400px] rounded-3xl p-6 text-center border-emerald-100">
            <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 ring-8 ring-emerald-50">
              <Shield className="w-8 h-8 text-emerald-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-slate-900 mx-auto tracking-tight">Muvaffaqiyatli!</DialogTitle>
            </DialogHeader>
            <div className="py-2 space-y-4">
              <p className="text-sm text-slate-500 font-medium px-2">
                <strong className="text-slate-800">{credentialsModal?.name}</strong> tizimga qo'shildi. Ma'lumotlarni yuboring:
              </p>
              
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 text-left">
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">Klinika ID</span>
                  <div className="font-mono text-base font-bold text-blue-600 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm w-full">
                    {credentialsModal?.clinicId}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">Login (Username)</span>
                  <div className="font-mono text-base font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm w-full">
                    {credentialsModal?.username}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">Parol</span>
                  <div className="font-mono text-base font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm w-full block">
                    {credentialsModal?.password}
                  </div>
                </div>
              </div>
            </div>
            <Button 
              onClick={() => setCredentialsModal(null)} 
              className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 font-bold uppercase shadow-lg border-none"
            >
              {t('common.close')}
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}

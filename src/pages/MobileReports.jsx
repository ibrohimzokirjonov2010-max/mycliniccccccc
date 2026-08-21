import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell
} from 'recharts';
import { 
  BarChart3, TrendingUp, Users, DollarSign, ArrowDownRight, 
  Activity, Download, ChevronRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';

/**
 * Premium SaaS Mobile Reports
 * Optimized for touch and high-density information
 */
export default function MobileReports() {
  const { t, language } = useTranslation();
  const [data, setData] = useState({
    payments: [],
    patients: [],
    appointments: [],
    expenses: []
  });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [pays, pats, appts, exps] = await Promise.all([
        base44.entities.Payment.list('-date', 1000),
        base44.entities.Patient.list('-created_date', 1000),
        base44.entities.Appointment.list('-date', 1000),
        base44.entities.Expense.list('-date', 1000),
      ]);
      setData({
        payments: pays || [],
        patients: pats || [],
        appointments: appts || [],
        expenses: exps || []
      });
    } catch (err) {
      console.error("Report load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Stats calculation
  const stats = useMemo(() => {
    const totalIncome = data.payments.filter(p => p.type === 'Income').reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalExpense = data.expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;
    return {
      patients: data.patients.length,
      income: totalIncome,
      expense: totalExpense,
      profit: netProfit
    };
  }, [data]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    const months = {};
    data.payments.filter(p => p.type === 'Income').forEach(p => {
      const m = p.date?.substring(0, 7);
      if (m) {
        if (!months[m]) months[m] = { income: 0, expense: 0 };
        months[m].income += (p.amount || 0);
      }
    });
    data.expenses.forEach(e => {
      const m = e.date?.substring(0, 7);
      if (m) {
        if (!months[m]) months[m] = { income: 0, expense: 0 };
        months[m].expense += (e.amount || 0);
      }
    });
    return Object.entries(months)
      .sort()
      .slice(-6)
      .map(([month, d]) => {
        const date = new Date(month + "-15");
        let monthName = "";
        if (language === 'uz') {
          const names = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr"];
          monthName = names[date.getMonth()];
        } else if (language === 'ru') {
          monthName = date.toLocaleDateString('ru-RU', { month: 'short' });
        } else {
          monthName = date.toLocaleDateString('en-US', { month: 'short' });
        }
        return {
          name: monthName,
          ...d
        };
      });
  }, [data, language]);

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-slate-50 pb-20">
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{t('navigation.reports')}</h1>
              <p className="text-sm text-slate-500 mt-0.5">{t('dashboard.statistics')}</p>
            </div>
            <button className="w-11 h-11 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 shadow-sm">
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Grid - Consistent with other mobile pages */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
              <p className="text-[11px] font-black text-blue-700">{stats.patients}</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('navigation.patients')}</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
              <p className="text-[11px] font-black text-emerald-700">{Math.round(stats.income/1000000)}M</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('payments.income')}</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-3 text-center border border-rose-100">
              <p className="text-[11px] font-black text-rose-700">{Math.round(stats.expense/1000000)}M</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('navigation.expenses')}</p>
            </div>
            <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
              <p className="text-[11px] font-black text-purple-700">{Math.round(stats.profit/1000000)}M</p>
              <p className="text-[10px] font-medium text-slate-500 uppercase">{t('expenses.profit')}</p>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="p-4 space-y-4">
          {loading ? (
            [1, 2].map(i => <div key={i} className="h-64 bg-white rounded-[2rem] animate-pulse border border-slate-100" />)
          ) : (
            <>
              {/* Financial Progress Area Chart */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{t('dashboard.revenueChart')}</h3>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                        itemStyle={{ color: '#10b981' }}
                      />
                      <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Weekly Patients Bar Chart */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-50"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{t('expenses.title')}</h3>
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Status Breakdown Lists */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('payments.income')}</p>
                  <p className="text-lg font-black text-emerald-600 tracking-tighter">{formatCurrency(stats.income).replace(' so\'m', '')}</p>
                </div>
                <div className="bg-white rounded-[2rem] p-5 shadow-sm border border-slate-50">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t('expenses.loss')}</p>
                  <p className="text-lg font-black text-rose-600 tracking-tighter">{formatCurrency(stats.expense).replace(' so\'m', '')}</p>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="px-5 mt-5 pb-10 text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            Dental Intelligence v2.0
          </p>
        </div>
      </div>
    </PullToRefresh>
  );
}

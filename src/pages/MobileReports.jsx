import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, AreaChart, Area, Cell
} from 'recharts';
import { TrendingUp, 
  Activity, Download
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PullToRefresh from '@/components/ui/PullToRefresh';
import { formatCurrency } from '@/lib/utils';
import { useTranslation } from '@/i18n/LanguageContext';

const formatCompactCurrency = (value) => {
  const isNegative = value < 0;
  const absValue = Math.abs(value);
  let formatted = "";
  if (absValue >= 1_000_000) {
    formatted = (absValue / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' mln';
  } else if (absValue >= 1_000) {
    formatted = (absValue / 1_000).toFixed(0) + 'k';
  } else {
    formatted = String(absValue);
  }
  return (isNegative ? '-' : '') + formatted;
};

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
      const [pays, patCount, appts, exps] = await Promise.all([
        base44.entities.Payment.list('-date', 200),
        base44.entities.Patient.count(),
        base44.entities.Appointment.list('-date', 200),
        base44.entities.Expense.list('-date', 100),
      ]);
      setData({
        payments: pays || [],
        patients: patCount ? [{ _count: patCount }] : [],
        _patientCount: patCount || 0,
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
      patients: data._patientCount || data.patients.length,
      income: totalIncome,
      expense: totalExpense,
      profit: netProfit
    };
  }, [data]);

  // Chart Data preparation
  const chartData = useMemo(() => {
    const months = {};
    
    // Pre-populate the last 6 months with 0 baseline values to ensure a continuous line/bar chart
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[m] = { income: 0, expense: 0 };
    }

    // Now populate with actual database records
    data.payments.filter(p => p.type === 'Income').forEach(p => {
      const m = p.date?.substring(0, 7);
      if (m && months[m]) {
        months[m].income += (p.amount || 0);
      }
    });
    data.expenses.forEach(e => {
      const m = e.date?.substring(0, 7);
      if (m && months[m]) {
        months[m].expense += (e.amount || 0);
      }
    });

    return Object.entries(months)
      .sort()
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
          income: d.income,
          expense: d.expense,
          profit: d.income - d.expense
        };
      });
  }, [data, language]);

  return (
    <PullToRefresh onRefresh={loadData}>
      <div className="min-h-screen bg-[#F4F6F9] pb-32">
        {/* Sticky Header */}
        <div className="bg-white border-b border-slate-100 sticky top-0 z-10 px-4 pt-5 pb-4.5 rounded-b-3xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none mb-1">{t('navigation.reports')}</h1>
              <p className="text-[9px] font-black text-[#1499AD] uppercase tracking-wider opacity-85">{t('dashboard.statistics')}</p>
            </div>
            <button className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-slate-500 shadow-sm active:scale-95 transition-all">
              <Download className="w-5 h-5" />
            </button>
          </div>

          {/* Stats Grid - Exact, professional data display */}
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-blue-50/40 rounded-xl p-2.5 text-center border border-blue-100/50 flex flex-col justify-between h-[58px]">
              <span className="text-[8px] font-black text-blue-600 uppercase tracking-wider leading-none">{t('navigation.patients')}</span>
              <span className="text-xs font-black text-blue-800 tracking-tight leading-none block mt-1">
                 {stats.patients}
              </span>
            </div>
            <div className="bg-emerald-50/40 rounded-xl p-2.5 text-center border border-emerald-100/50 flex flex-col justify-between h-[58px]">
              <span className="text-[8px] font-black text-emerald-600 uppercase tracking-wider leading-none">{t('payments.income')}</span>
              <span className="text-xs font-black text-emerald-800 tracking-tight leading-none block mt-1 truncate">
                 {formatCompactCurrency(stats.income)}
              </span>
            </div>
            <div className="bg-rose-50/40 rounded-xl p-2.5 text-center border border-rose-100/50 flex flex-col justify-between h-[58px]">
              <span className="text-[8px] font-black text-rose-600 uppercase tracking-wider leading-none">{t('navigation.expenses')}</span>
              <span className="text-xs font-black text-rose-800 tracking-tight leading-none block mt-1 truncate">
                 {formatCompactCurrency(stats.expense)}
              </span>
            </div>
            <div className={`rounded-xl p-2.5 text-center border flex flex-col justify-between h-[58px] ${
               stats.profit >= 0 ? 'bg-purple-50/40 border-purple-100/50' : 'bg-amber-50/40 border-amber-100/50'
            }`}>
              <span className={`text-[8px] font-black uppercase tracking-wider leading-none ${
                 stats.profit >= 0 ? 'text-purple-650' : 'text-amber-600'
              }`}>{t('expenses.profit')}</span>
              <span className={`text-xs font-black tracking-tight leading-none block mt-1 truncate ${
                 stats.profit >= 0 ? 'text-purple-800' : 'text-amber-800'
              }`}>
                 {formatCompactCurrency(stats.profit)}
              </span>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="p-4 space-y-4">
          {loading ? (
            [1, 2].map(i => <div key={i} className="h-64 bg-white rounded-3xl animate-pulse border border-slate-100" />)
          ) : (
            <>
              {/* Financial Progress Area Chart - Income vs Expense comparison */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">{t('dashboard.revenueChart')}</h3>
                  <TrendingUp className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData} margin={{ left: 5, right: 10, top: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis tickFormatter={tick => formatCompactCurrency(tick)} axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fontWeight: 700, fill: '#94a3b8' }} width={50} />
                      <Tooltip 
                        formatter={(val, name) => [formatCurrency(val), name === 'income' ? 'Kirim' : 'Chiqim']}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: 11 }}
                      />
                      <Area type="monotone" dataKey="income" name="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                      <Area type="monotone" dataKey="expense" name="expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExpense)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Weekly Patients Bar Chart - Profit/Loss Dynamics */}
              <motion.div 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100"
              >
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Sof Foyda Dinamikasi</h3>
                  <Activity className="w-4 h-4 text-blue-500" />
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ left: 5, right: 10, top: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#94a3b8' }} />
                      <YAxis tickFormatter={tick => formatCompactCurrency(tick)} axisLine={false} tickLine={false} tick={{ fontSize: 8.5, fontWeight: 700, fill: '#94a3b8' }} width={50} />
                      <Tooltip 
                        formatter={(val) => [formatCurrency(val), "Sof foyda"]}
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.05)', fontWeight: 'bold', fontSize: 11 }}
                      />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]} barSize={18}>
                         {chartData.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={entry.profit >= 0 ? '#10b981' : '#f43f5e'} />
                         ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* Exact Stats Breakdown Cards */}
              <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 space-y-3.5">
                 <div className="flex justify-between items-center pb-2 border-b border-slate-100/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jami Daromad</span>
                    <span className="text-sm font-black text-emerald-600">{formatCurrency(stats.income)}</span>
                 </div>
                 <div className="flex justify-between items-center pb-2 border-b border-slate-100/50">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Jami Xarajat</span>
                    <span className="text-sm font-black text-rose-600">-{formatCurrency(stats.expense)}</span>
                 </div>
                 <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Sof Foyda</span>
                    <span className={`text-sm font-black ${stats.profit >= 0 ? 'text-purple-700' : 'text-rose-600'}`}>
                       {stats.profit >= 0 ? '+' : ''}{formatCurrency(stats.profit)}
                    </span>
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

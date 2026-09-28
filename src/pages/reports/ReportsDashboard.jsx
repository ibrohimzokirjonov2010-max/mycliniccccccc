import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, ComposedChart, Line,
} from 'recharts';
import {
  Calendar, Printer, FileSpreadsheet, Search, X, LayoutGrid, Award, DollarSign, Layers,
  Receipt, ArrowUpRight, ArrowDownRight, AlertTriangle, Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtMoney, fmtCompact, initials, avatarTone } from '@/utils/clinicMetrics';

function tx(language, uz, ru, en) {
  if (language === 'ru') return ru;
  if (language === 'en') return en;
  return uz;
}

const SERVICE_COLORS = ['#0D9488', '#3B82F6', '#8B5CF6', '#F59E0B', '#059669', '#F43F5E', '#1499AD'];

export default function ReportsDashboard({
  language,
  loading,
  phone,
  inMobileShell,
  period,
  setPeriod,
  customFrom,
  customTo,
  setCustomFrom,
  setCustomTo,
  activeTab,
  setActiveTab,
  searchQuery,
  setSearchQuery,
  stats,
  trends,
  appointmentCount,
  financeChartData,
  appointmentsStatusReport,
  doctorLeaderboard,
  servicesReport,
  monthlyFinanceReport,
  docSortField,
  onDocSort,
  formatChartYAxis,
  onExport,
  onPrint,
  insights,
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const maxRevenue = Math.max(1, ...doctorLeaderboard.map((d) => d.revenue));
  const maxServiceShare = Math.max(1, ...servicesReport.map((s) => s.share));
  const boardAppts = doctorLeaderboard.reduce((s, d) => s + d.appointmentCount, 0);
  const boardDone = doctorLeaderboard.reduce((s, d) => s + d.completed, 0);
  const boardRevenue = doctorLeaderboard.reduce((s, d) => s + d.revenue, 0);
  const boardRate = boardAppts ? Math.round((boardDone / boardAppts) * 100) : 0;
  const boardAvg = boardDone > 0 ? Math.round(boardRevenue / boardDone) : 0;

  const periods = [
    { key: 'all', label: tx(language, 'Barchasi', 'Все', 'All') },
    { key: 'this_month', label: tx(language, 'Bu oy', 'Этот месяц', 'This month') },
    { key: 'last_month', label: tx(language, "O'tgan oy", 'Прошлый месяц', 'Last month') },
    { key: 'year', label: tx(language, 'Yillik', 'За год', 'This year') },
  ];

  const tabs = [
    { id: 'overview', label: tx(language, "Umumiy ko'rinish", 'Обзор', 'Overview'), icon: LayoutGrid },
    { id: 'doctors', label: tx(language, 'Shifokorlar reytingi', 'Рейтинг врачей', 'Doctor ranking'), icon: Award, count: doctorLeaderboard.length },
    { id: 'finance', label: tx(language, 'Oylik kirim & chiqim', 'Доходы и расходы', 'Income & expense'), icon: DollarSign, count: monthlyFinanceReport.length },
    { id: 'services', label: tx(language, 'Top xizmatlar', 'Топ услуг', 'Top services'), icon: Layers, count: servicesReport.length },
    { id: 'appointments', label: tx(language, 'Qabullar taqsimoti', 'Приёмы', 'Visits'), icon: Receipt, count: appointmentsStatusReport.length },
  ];

  const showDoctors = activeTab === 'overview' || activeTab === 'doctors';
  const showFinance = activeTab === 'overview' || activeTab === 'finance';
  const showServices = activeTab === 'overview';
  const showInsights = activeTab === 'overview';

  const incomeBar = stats.totalIncome > 0 ? 100 : 0;
  const expenseBar = stats.totalIncome > 0 ? Math.min(100, Math.round((stats.totalExpense / stats.totalIncome) * 100)) : (stats.totalExpense > 0 ? 100 : 0);
  const profitBar = stats.totalIncome > 0 ? Math.max(0, Math.min(100, Math.round((stats.netProfit / stats.totalIncome) * 100))) : 0;
  const doneBar = appointmentCount > 0 ? Math.round((stats.completedAppts / appointmentCount) * 100) : 0;
  const margin = stats.totalIncome > 0 ? Math.round((stats.netProfit / stats.totalIncome) * 100) : null;
  const expenseRatio = stats.totalIncome > 0 ? Math.round((stats.totalExpense / stats.totalIncome) * 1000) / 10 : null;

  return (
    <div className={cn('min-w-0 max-w-full pb-6', inMobileShell && 'px-4', phone && 'pb-24')}>
      <div className="flex flex-col gap-3 mb-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 flex flex-wrap items-center gap-2">
            {tx(language, 'Hisobotlar', 'Отчёты', 'Reports')}
            <span className="text-[10px] font-extrabold tracking-widest uppercase text-teal-800 bg-teal-50 border border-teal-100 rounded-full px-2 py-0.5">
              {tx(language, 'Analitika va boshqaruv', 'Аналитика и управление', 'Analytics')}
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {tx(language, 'Klinika umumiy moliyaviy hisoboti, shifokorlar reytingi va xizmatlar tahlili', 'Финансовый отчёт клиники, рейтинг врачей и анализ услуг', 'Clinic finance, doctor ranking and service mix')}
          </p>
        </div>
        <div className="flex items-center gap-2 min-w-0 overflow-x-auto no-scrollbar">
          <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/70 shrink-0">
            {periods.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPeriod(p.key)}
                className={cn('px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap', period === p.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="relative shrink-0">
            <button type="button" onClick={() => setRangeOpen((v) => !v)} className={cn('h-9 px-3 rounded-xl border bg-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap', period === 'custom' ? 'border-[#1499AD] text-teal-800' : 'border-slate-200 text-slate-700')}>
              <Calendar className="w-3.5 h-3.5" />
              {tx(language, 'Davr tanlash', 'Выбрать период', 'Pick range')}
            </button>
            {rangeOpen && (
              <div className="absolute right-0 z-30 mt-1 w-[240px] max-w-[80vw] bg-white border border-slate-200 rounded-xl shadow-lg p-3 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-500">
                  {tx(language, 'Dan', 'С', 'From')}
                  <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-slate-200 px-2 text-sm" />
                </label>
                <label className="block text-[11px] font-semibold text-slate-500">
                  {tx(language, 'Gacha', 'По', 'To')}
                  <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="mt-1 w-full h-9 rounded-lg border border-slate-200 px-2 text-sm" />
                </label>
                <button
                  type="button"
                  onClick={() => { setPeriod('custom'); setRangeOpen(false); }}
                  className="w-full h-9 rounded-lg bg-[#0C1222] text-white text-xs font-bold"
                >
                  {tx(language, 'Qo\'llash', 'Применить', 'Apply')}
                </button>
              </div>
            )}
          </div>
          <button type="button" onClick={onPrint} className="h-9 w-9 shrink-0 rounded-xl border border-slate-200 bg-white grid place-items-center text-slate-600" aria-label="Print">
            <Printer className="w-4 h-4" />
          </button>
          <button type="button" onClick={onExport} className="h-9 px-3 shrink-0 rounded-xl bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5">
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5 sm:gap-3 mb-4">
        <KpiCard
          label={tx(language, 'Jami qabullar', 'Всего приёмов', 'Total visits')}
          value={<>{appointmentCount} <small>ta</small></>}
          icon={<Calendar className="w-4 h-4" />}
          iconClass="bg-blue-50 text-blue-600"
          bar={doneBar}
          barClass="bg-blue-500"
          foot={`${stats.completedAppts} ${tx(language, 'ta yakunlangan', 'завершено', 'completed')} · ${doneBar}%`}
          trend={trends?.appointments}
          period={period}
          trendNote={trends?.note}
        />
        <KpiCard
          label={tx(language, 'Umumiy daromad', 'Общий доход', 'Total income')}
          value={<>{fmtMoney(stats.totalIncome)}<small>UZS</small></>}
          icon={<DollarSign className="w-4 h-4" />}
          iconClass="bg-emerald-50 text-emerald-600"
          bar={incomeBar}
          barClass="bg-emerald-500"
          foot={`${tx(language, "O'rtacha chek", 'Средний чек', 'Avg. check')}: ${stats.avgCheck ? fmtMoney(stats.avgCheck) : '—'}`}
          trend={trends?.income}
          period={period}
          trendNote={trends?.note}
        />
        <KpiCard
          label={tx(language, 'Chiqimlar / xarajat', 'Расходы', 'Expenses')}
          value={<>{fmtMoney(stats.totalExpense)}<small>UZS</small></>}
          icon={<ArrowDownRight className="w-4 h-4" />}
          iconClass="bg-rose-50 text-rose-600"
          bar={expenseBar}
          barClass="bg-rose-500"
          foot={expenseRatio != null ? `${tx(language, 'Daromadning', 'От дохода', 'Of income')} ${String(expenseRatio).replace('.', ',')} ${tx(language, 'foizi', '%', '%')}` : tx(language, 'Daromad yo\'q', 'Нет дохода', 'No income')}
          trend={trends?.expense}
          period={period}
          trendNote={trends?.note}
          invert
        />
        <KpiCard
          dark
          label={tx(language, 'Sof foyda', 'Чистая прибыль', 'Net profit')}
          value={<>{fmtMoney(stats.netProfit)}<small>UZS</small></>}
          icon={<ArrowUpRight className="w-4 h-4" />}
          bar={profitBar}
          barClass="bg-emerald-400"
          foot={margin != null ? `${tx(language, 'Rentabellik', 'Рентабельность', 'Margin')}: ${margin}%` : tx(language, 'Daromad yo\'q', 'Нет дохода', 'No income')}
          trend={trends?.profit}
          period={period}
          trendNote={trends?.note}
        />
      </div>

      <div className="flex items-center gap-1.5 mb-3.5 overflow-x-auto no-scrollbar min-w-0">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const on = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn('h-9 px-3 rounded-xl border text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0', on ? 'bg-[#0C1222] text-white border-[#0C1222]' : 'bg-white text-slate-700 border-slate-200')}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.count != null && <b className={cn('text-[10.5px] px-1.5 rounded-md', on ? 'bg-white/15 text-emerald-200' : 'bg-slate-100 text-slate-500')}>{tab.count}</b>}
            </button>
          );
        })}
        {(activeTab === 'overview' || activeTab === 'doctors' || activeTab === 'services') && (
          <div className="relative ml-auto min-w-[160px] w-[min(230px,46vw)] shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'services' ? tx(language, 'Xizmat nomi…', 'Услуга…', 'Service…') : tx(language, 'Shifokor nomi…', 'Имя врача…', 'Doctor…')}
              className="w-full h-9 pl-8 pr-7 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-[#1499AD]"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"><X className="w-3 h-3" /></button>
            )}
          </div>
        )}
      </div>

      {loading && <div className="h-1 rounded bg-slate-100 overflow-hidden mb-3"><div className="h-full w-1/3 bg-[#1499AD] animate-pulse" /></div>}

      {showFinance && (activeTab === 'overview' || activeTab === 'finance') && activeTab !== 'doctors' && (
        <div className={cn('grid gap-3.5 mb-3.5', activeTab === 'overview' ? 'grid-cols-1 xl:grid-cols-[1.7fr_1fr]' : 'grid-cols-1')}>
          {activeTab === 'overview' || activeTab === 'finance' ? (
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 min-w-0 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-bold">{tx(language, 'Kirim va chiqim dinamikasi', 'Динамика доходов и расходов', 'Income and expense')}</h3>
                  <p className="text-[11.5px] text-slate-400">{tx(language, 'Oylar kesimida · chiziq — sof foyda', 'По месяцам · линия — прибыль', 'By month · line is net profit')}</p>
                </div>
                <div className="flex gap-3 text-[11px] font-semibold text-slate-500">
                  <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-emerald-600" />{tx(language, 'Kirim', 'Доход', 'Income')}</span>
                  <span className="inline-flex items-center gap-1"><i className="w-2 h-2 rounded-sm bg-rose-500" />{tx(language, 'Chiqim', 'Расход', 'Expense')}</span>
                  <span className="inline-flex items-center gap-1"><i className="w-3 h-0.5 rounded bg-[#0C1222]" />{tx(language, 'Sof foyda', 'Прибыль', 'Profit')}</span>
                </div>
              </div>
              {financeChartData.length === 0 ? (
                <Empty text={tx(language, 'Tanlangan davrda moliyaviy yozuv yo\'q.', 'Нет финансовых записей за период.', 'No finance records in this period.')} />
              ) : (
                <div className="w-full min-w-0 h-[220px] sm:h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={financeChartData} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF1F5" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                      <YAxis tickFormatter={formatChartYAxis} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={46} />
                      <Tooltip content={<MoneyTip />} />
                      <Bar dataKey="income" name={tx(language, 'Kirim', 'Доход', 'Income')} fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Bar dataKey="expense" name={tx(language, 'Chiqim', 'Расход', 'Expense')} fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={26} />
                      <Line dataKey="net" name={tx(language, 'Sof foyda', 'Прибыль', 'Profit')} stroke="#0C1222" strokeWidth={2.4} dot={{ r: 3, fill: '#0C1222' }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>
          ) : null}
          {activeTab === 'overview' && (
            <DonutCard language={language} rows={appointmentsStatusReport} total={appointmentCount} />
          )}
        </div>
      )}

      {activeTab === 'appointments' && (
        <div className="mb-3.5">
          <DonutCard language={language} rows={appointmentsStatusReport} total={appointmentCount} wide />
        </div>
      )}

      {showDoctors && (
        <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm mb-3.5 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2">
            <div>
              <h3 className="text-sm font-bold">{tx(language, 'Shifokorlar reytingi', 'Рейтинг врачей', 'Doctor ranking')}</h3>
              <p className="text-[11.5px] text-slate-400">{tx(language, 'Umumiy tushum bo\'yicha', 'По общей выручке', 'By revenue')} · {doctorLeaderboard.length}</p>
            </div>
            <label className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold">
              <span className="text-slate-400">{tx(language, 'Saralash', 'Сортировка', 'Sort')}:</span>
              <select value={docSortField} onChange={(e) => onDocSort(e.target.value)} className="bg-transparent outline-none">
                <option value="revenue">{tx(language, 'Umumiy tushum', 'Выручка', 'Revenue')}</option>
                <option value="appointments">{tx(language, 'Qabullar', 'Приёмы', 'Visits')}</option>
                <option value="completed">{tx(language, 'Bajarilgan', 'Выполнено', 'Completed')}</option>
                <option value="patients">{tx(language, 'Bemorlar', 'Пациенты', 'Patients')}</option>
                <option value="avg_check">{tx(language, "O'rtacha chek", 'Средний чек', 'Avg. check')}</option>
                <option value="share">{tx(language, 'Ulush', 'Доля', 'Share')}</option>
                <option value="name">{tx(language, 'Ism', 'Имя', 'Name')}</option>
              </select>
            </label>
          </div>

          <div className="sm:hidden px-3 pb-3 space-y-2">
            {doctorLeaderboard.length === 0 && <Empty text={tx(language, 'Shifokorlar topilmadi.', 'Врачи не найдены.', 'No doctors found.')} />}
            {doctorLeaderboard.map((d) => (
              <DoctorCard key={d.id} doc={d} maxRevenue={maxRevenue} />
            ))}
          </div>

          <div className="hidden sm:block overflow-x-auto max-w-full">
            <table className="w-full min-w-[760px] text-left border-collapse">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                  <th className="px-3 py-2 w-12">#</th>
                  <th className="px-3 py-2">{tx(language, 'Shifokor (F.I.Sh)', 'Врач', 'Doctor')}</th>
                  <Th field="appointments" current={docSortField} onSort={onDocSort}>{tx(language, 'Qabullar', 'Приёмы', 'Visits')}</Th>
                  <Th field="completed" current={docSortField} onSort={onDocSort}>{tx(language, 'Bajarilgan', 'Выполнено', 'Done')}</Th>
                  <Th field="patients" current={docSortField} onSort={onDocSort}>{tx(language, 'Bemorlar soni', 'Пациенты', 'Patients')}</Th>
                  <Th field="revenue" current={docSortField} onSort={onDocSort} className="text-emerald-700">{tx(language, 'Umumiy tushum', 'Выручка', 'Revenue')}</Th>
                  <Th field="avg_check" current={docSortField} onSort={onDocSort}>{tx(language, "O'rtacha chek", 'Средний чек', 'Avg')}</Th>
                  <Th field="share" current={docSortField} onSort={onDocSort}>{tx(language, 'Klinika ulushi', 'Доля', 'Share')}</Th>
                </tr>
              </thead>
              <tbody>
                {doctorLeaderboard.map((d) => (
                  <tr key={d.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-3 py-2.5"><Rank n={d.rank} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <PersonFace name={d.name} photo={d.avatar} />
                        <div className="min-w-0">
                          <b className="block text-[13px] font-bold truncate">
                            {d.name}
                            {d.appointmentCount === 0 && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-rose-700 bg-rose-50 rounded px-1 py-0.5">{tx(language, "Qabul yo'q", 'Нет приёма', 'No visits')}</span>}
                          </b>
                          <span className="text-[11px] text-slate-400">{d.specialty || d.roleLabel || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sm">{d.appointmentCount} <span className="text-slate-400 text-xs">ta</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-14 h-1.5 rounded bg-slate-100 overflow-hidden"><i className="block h-full bg-[#1499AD]" style={{ width: `${d.completionRate}%` }} /></div>
                        <b className="text-sm tabular-nums">{d.completed}</b>
                        <small className="text-[11px] text-slate-400 w-8">{d.completionRate}%</small>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sm">{d.uniquePatients} <span className="text-slate-400 text-xs">ta</span></td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col items-end gap-1">
                        <b className="text-sm text-emerald-700 tabular-nums">{fmtMoney(d.revenue)} <span className="text-[11px] text-slate-400 font-semibold">UZS</span></b>
                        <div className="w-24 h-1 rounded bg-slate-100 overflow-hidden"><i className="block h-full bg-emerald-500" style={{ width: `${(d.revenue / maxRevenue) * 100}%` }} /></div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sm text-slate-700">{d.avgCheck ? fmtMoney(d.avgCheck) : '—'}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className={cn('inline-block min-w-[44px] text-center text-xs font-bold px-2 py-1 rounded-md', d.rank <= 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>{d.revenueShare}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              {doctorLeaderboard.length > 0 && (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50/60">
                    <td />
                    <td className="px-3 py-3 font-extrabold text-sm">{tx(language, 'Jami', 'Итого', 'Total')}</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{boardAppts} ta</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{boardDone} · {boardRate}%</td>
                    <td />
                    <td className="px-3 py-3 text-right font-extrabold text-emerald-700 tabular-nums">{fmtMoney(boardRevenue)} UZS</td>
                    <td className="px-3 py-3 text-right font-bold tabular-nums">{boardAvg ? fmtMoney(boardAvg) : '—'}</td>
                    <td className="px-3 py-3 text-right"><span className="inline-block min-w-[44px] text-center text-xs font-bold px-2 py-1 rounded-md bg-slate-100">100%</span></td>
                  </tr>
                </tfoot>
              )}
            </table>
            {doctorLeaderboard.length === 0 && <Empty text={tx(language, 'Shifokorlar topilmadi.', 'Врачи не найдены.', 'No doctors found.')} />}
          </div>
        </section>
      )}

      {activeTab === 'overview' && (
        <div className={cn('grid gap-3.5', activeTab === 'overview' ? 'grid-cols-1 xl:grid-cols-[1.15fr_1fr]' : 'grid-cols-1')}>
          {showServices && (
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm min-w-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-bold">{tx(language, 'Top xizmatlar', 'Топ услуг', 'Top services')}</h3>
                  <p className="text-[11.5px] text-slate-400">{tx(language, 'Tushum bo\'yicha', 'По выручке', 'By revenue')}</p>
                </div>
                {activeTab === 'overview' && (
                  <button type="button" onClick={() => setActiveTab('services')} className="text-xs font-semibold text-teal-700">{tx(language, 'Barchasi', 'Все', 'All')} →</button>
                )}
              </div>
              {servicesReport.length === 0 && <Empty text={tx(language, 'To\'lovlarda xizmat nomi yo\'q.', 'В платежах нет названий услуг.', 'Payments have no service names.')} />}
              <div className="space-y-3">
                {(activeTab === 'overview' ? servicesReport.slice(0, 5) : servicesReport).map((s, i) => (
                  <div key={s.name}>
                    <div className="flex justify-between gap-3 text-[12.5px] mb-1.5 min-w-0">
                      <span className="font-semibold text-slate-700 truncate">{s.name} <em className="not-italic text-slate-400 font-medium">{s.count} ta</em></span>
                      <span className="shrink-0"><b className="tabular-nums">{fmtMoney(s.revenue)}</b> <em className="not-italic text-slate-400">{s.share}%</em></span>
                    </div>
                    <div className="h-2 rounded bg-slate-100 overflow-hidden">
                      <i className="block h-full rounded" style={{ width: `${(s.share / maxServiceShare) * 100}%`, background: SERVICE_COLORS[i % SERVICE_COLORS.length] }} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
          {showInsights && (
            <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm min-w-0">
              <h3 className="text-sm font-bold">{tx(language, 'Diqqat talab qiladi', 'Требует внимания', 'Needs attention')} <em className="not-italic text-[9px] font-extrabold tracking-wider text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded ml-1">YANGI</em></h3>
              <p className="text-[11.5px] text-slate-400 mb-3">{tx(language, 'Hisobot ma\'lumotlaridan avtomatik xulosalar', 'Автоматические выводы по отчёту', 'Automatic notes from this report')}</p>
              <div className="space-y-2">
                {insights.map((item) => (
                  <div key={item.title} className={cn('flex gap-2.5 rounded-xl p-2.5', toneClass(item.tone))}>
                    <InsightIcon tone={item.tone} />
                    <div className="min-w-0">
                      <b className="block text-[12.5px] font-bold">{item.title}</b>
                      <p className="text-[11.5px] leading-snug text-slate-700 mt-0.5">{item.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {activeTab === 'services' && (
        <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-bold mb-3">{tx(language, 'Top xizmatlar', 'Топ услуг', 'Top services')}</h3>
          {servicesReport.length === 0 && <Empty text={tx(language, 'Xizmatlar topilmadi.', 'Услуги не найдены.', 'No services.')} />}
          <div className="space-y-3">
            {servicesReport.map((s, i) => (
              <div key={s.name}>
                <div className="flex justify-between gap-3 text-[12.5px] mb-1.5">
                  <span className="font-semibold truncate">{s.name} <em className="not-italic text-slate-400">{s.count} ta</em></span>
                  <span className="shrink-0 tabular-nums"><b>{fmtMoney(s.revenue)}</b> <em className="not-italic text-slate-400">{s.share}%</em></span>
                </div>
                <div className="h-2 rounded bg-slate-100 overflow-hidden"><i className="block h-full" style={{ width: `${(s.share / maxServiceShare) * 100}%`, background: SERVICE_COLORS[i % SERVICE_COLORS.length] }} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'finance' && (
        <section className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-x-auto mt-3.5">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-slate-400 border-b">
                <th className="text-left px-3 py-2">{tx(language, 'Oy', 'Месяц', 'Month')}</th>
                <th className="text-right px-3 py-2">{tx(language, 'Qabullar', 'Приёмы', 'Visits')}</th>
                <th className="text-right px-3 py-2">{tx(language, 'Kirim', 'Доход', 'Income')}</th>
                <th className="text-right px-3 py-2">{tx(language, 'Chiqim', 'Расход', 'Expense')}</th>
                <th className="text-right px-3 py-2">{tx(language, 'Sof foyda', 'Прибыль', 'Profit')}</th>
                <th className="text-right px-3 py-2">{tx(language, 'Rentabellik', 'Маржа', 'Margin')}</th>
              </tr>
            </thead>
            <tbody>
              {monthlyFinanceReport.map((m) => (
                <tr key={m.rawMonth} className="border-b border-slate-50">
                  <td className="px-3 py-2.5 font-semibold">{m.monthLabel}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.appointments}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{fmtMoney(m.income)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-rose-600">{fmtMoney(m.expense)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-bold">{fmtMoney(m.net)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{m.margin}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {monthlyFinanceReport.length === 0 && <Empty text={tx(language, 'Oylar bo\'yicha yozuv yo\'q.', 'Нет помесячных записей.', 'No monthly records.')} />}
        </section>
      )}
    </div>
  );
}

function KpiCard({ label, value, icon, iconClass, bar, barClass, foot, trend, trendNote, dark, invert, period }) {
  return (
    <article className={cn('rounded-2xl border p-3.5 min-w-0 shadow-sm flex flex-col gap-1.5', dark ? 'bg-gradient-to-br from-[#0C1222] to-[#13233a] border-[#0C1222] text-white' : 'bg-white border-slate-200/80')}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn('text-[10.5px] font-bold uppercase tracking-wide truncate', dark ? 'text-teal-200' : 'text-slate-400')}>{label}</span>
        <span className={cn('w-8 h-8 rounded-lg grid place-items-center shrink-0', dark ? 'bg-white/10 text-emerald-300' : iconClass)}>{icon}</span>
      </div>
      <div className={cn('text-[18px] sm:text-[22px] font-extrabold tracking-tight leading-none truncate [&_small]:text-[11px] [&_small]:font-bold [&_small]:ml-1', dark ? '[&_small]:text-slate-400' : '[&_small]:text-slate-400')}>{value}</div>
      <div className={cn('h-1.5 rounded overflow-hidden', dark ? 'bg-[#23324b]' : 'bg-slate-100')}>
        <i className={cn('block h-full rounded', barClass)} style={{ width: `${bar}%` }} />
      </div>
      <div className={cn('flex items-center justify-between gap-2 text-[11px]', dark ? 'text-slate-300' : 'text-slate-500')}>
        <span className="truncate">{foot}</span>
        {trend && <TrendChip trend={trend} note={trendNote} invert={invert} dark={dark} showScope={period === 'all'} />}
      </div>
    </article>
  );
}

function TrendChip({ trend, note, invert, dark, showScope }) {
  if (!trend) return null;
  const up = trend.dir === 'up';
  const down = trend.dir === 'down';
  const good = invert ? down : up;
  const bad = invert ? up : down;
  const scope = showScope ? (note?.includes('Этот') ? 'мес.' : note?.toLowerCase().includes('this month') ? 'mo' : 'bu oy') : '';
  return (
    <span title={note || ''} className={cn('inline-flex items-center gap-0.5 font-bold shrink-0 rounded-md px-1.5 py-0.5', dark && good && 'bg-emerald-400/15 text-emerald-300', dark && bad && 'bg-rose-400/15 text-rose-300', !dark && good && 'bg-emerald-50 text-emerald-700', !dark && bad && 'bg-rose-50 text-rose-600', !up && !down && 'bg-slate-100 text-slate-500')}>
      {scope && <span className="font-semibold opacity-70">{scope}</span>}
      {up ? <ArrowUpRight className="w-3 h-3" /> : down ? <ArrowDownRight className="w-3 h-3" /> : null}
      {trend.text}
    </span>
  );
}

function DonutCard({ language, rows, total, wide }) {
  const navigate = useNavigate();
  const noShow = rows.find((r) => /kelmagan|неявк|no-show/i.test(r.status));
  return (
    <section className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm min-w-0">
      <h3 className="text-sm font-bold">{tx(language, 'Qabullar taqsimoti', 'Распределение приёмов', 'Visit mix')}</h3>
      <p className="text-[11.5px] text-slate-400 mb-2">{tx(language, 'Holat bo\'yicha', 'По статусу', 'By status')} · {total} {tx(language, 'ta qabul', 'приёмов', 'visits')}</p>
      {total === 0 ? <Empty text={tx(language, 'Tanlangan davrda qabul yo\'q.', 'Нет приёмов за период.', 'No visits in this period.')} /> : (
        <div className={cn('flex items-center gap-4 min-w-0', wide && 'flex-col sm:flex-row')}>
          <div className="relative w-[150px] h-[150px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={rows} dataKey="count" nameKey="status" innerRadius={48} outerRadius={68} paddingAngle={2} stroke="none">
                  {rows.map((r) => <Cell key={r.status} fill={r.color} />)}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 grid place-items-center pointer-events-none">
              <div className="text-center"><b className="block text-xl font-extrabold leading-none">{total}</b><span className="text-[10px] text-slate-400">{tx(language, 'jami', 'всего', 'total')}</span></div>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            {rows.map((r) => (
              <div key={r.status} className="flex items-center gap-2 text-[12.5px]">
                <i className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: r.color }} />
                <span className="flex-1 truncate font-medium text-slate-700">{r.status}</span>
                <b className="tabular-nums">{r.count}</b>
                <small className="w-9 text-right text-slate-400 font-semibold">{r.share}%</small>
              </div>
            ))}
            {noShow && (
              <button type="button" onClick={() => navigate('/no-show')} className="text-[11.5px] font-semibold text-teal-700 pt-1">
                {tx(language, 'Kelmaganlar ro\'yxati', 'Список неявок', 'No-show list')} →
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function DoctorCard({ doc, maxRevenue }) {
  return (
    <div className="border border-slate-100 rounded-xl p-3">
      <div className="flex items-center gap-2 min-w-0">
        <Rank n={doc.rank} />
        <PersonFace name={doc.name} photo={doc.avatar} />
        <div className="min-w-0 flex-1">
          <b className="block text-sm truncate">{doc.name}</b>
          <span className="text-[11px] text-slate-400">{doc.specialty || '—'}</span>
        </div>
        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded', doc.rank <= 3 ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>{doc.revenueShare}%</span>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
        <div><span className="text-slate-400 block">Qabul</span><b>{doc.appointmentCount}</b></div>
        <div><span className="text-slate-400 block">Bajarilgan</span><b>{doc.completed} · {doc.completionRate}%</b></div>
        <div><span className="text-slate-400 block">Tushum</span><b>{fmtCompact(doc.revenue)}</b></div>
      </div>
      <div className="h-1 rounded bg-slate-100 mt-2 overflow-hidden"><i className="block h-full bg-emerald-500" style={{ width: `${(doc.revenue / maxRevenue) * 100}%` }} /></div>
    </div>
  );
}

function PersonFace({ name, photo }) {
  return (
    <div className={cn('w-8 h-8 rounded-xl overflow-hidden grid place-items-center text-[11px] font-extrabold shrink-0', avatarTone(name))}>
      {photo ? <img src={photo} alt="" className="w-full h-full object-cover" /> : initials(name)}
    </div>
  );
}

function Rank({ n }) {
  const cls = n === 1 ? 'bg-gradient-to-b from-amber-100 to-amber-300 text-amber-900' : n === 2 ? 'bg-gradient-to-b from-slate-100 to-slate-300 text-slate-700' : n === 3 ? 'bg-gradient-to-b from-orange-100 to-orange-300 text-orange-900' : 'bg-slate-100 text-slate-500';
  return <span className={cn('w-6 h-6 rounded-lg grid place-items-center text-xs font-extrabold', cls)}>{n}</span>;
}

function Th({ children, field, current, onSort, className }) {
  return (
    <th className={cn('px-3 py-2 text-right cursor-pointer whitespace-nowrap', current === field && 'text-emerald-700', className)}>
      <button type="button" onClick={() => onSort(field)} className="font-bold uppercase tracking-wider">{children}</button>
    </th>
  );
}

function Empty({ text }) {
  return <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-4">{text}</p>;
}

function toneClass(tone) {
  if (tone === 'alert') return 'bg-rose-50 text-rose-800';
  if (tone === 'warn') return 'bg-amber-50 text-amber-900';
  if (tone === 'ok') return 'bg-emerald-50 text-emerald-900';
  return 'bg-sky-50 text-sky-900';
}

function InsightIcon({ tone }) {
  if (tone === 'alert') return <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />;
  if (tone === 'warn') return <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />;
  if (tone === 'ok') return <Info className="w-4 h-4 shrink-0 mt-0.5" />;
  return <Info className="w-4 h-4 shrink-0 mt-0.5" />;
}

function MoneyTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg px-3 py-2 text-xs">
      <p className="font-bold text-slate-500 mb-1">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5">
          <i className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span>{p.name}: <b>{fmtMoney(p.value)} UZS</b></span>
        </div>
      ))}
    </div>
  );
}

import { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, Search, Printer, 
  ArrowUpDown, ArrowUp, ArrowDown, CreditCard, 
  Calendar, ClipboardList, Activity, User, 
  ShieldCheck, Table as TableIcon, LayoutGrid, X, FileText
} from 'lucide-react';
import { cn, formatPhone } from '@/lib/utils';
import { toast } from 'sonner';
import { exportPatientToExcel } from '@/lib/patientExcelExport';

/**
 * PatientExcelView Component
 * High-productivity Excel Spreadsheet EHR View for Patient Profile.
 */
export default function PatientExcelView({
  patient,
  plans = [],
  payments = [],
  appointments = [],
  doctors = [],
  card043Data = {},
  totalPaid = 0,
  totalDebt = 0,
  toothRecords = [],
  onOpenApptModal,
  onOpenPayModal,
  onOpenPlanInvoice,
}) {
  // Search & Filter state
  const [search, setSearch] = useState('');
  const [activeSection, setActiveSection] = useState('all'); // 'all' | 'treatments' | 'payments' | 'appointments' | 'teeth' | 'passport' | 'card043'
  const [density, setDensity] = useState(() => localStorage.getItem('patient_excel_density') || 'compact');

  // Sorting state for treatments
  const [treatmentSortField, setTreatmentSortField] = useState('date');
  const [treatmentSortOrder, setTreatmentSortOrder] = useState('desc');

  // Sorting state for payments
  const [paymentSortField, setPaymentSortField] = useState('date');
  const [paymentSortOrder, setPaymentSortOrder] = useState('desc');

  // Sorting state for appointments
  const [apptSortOrder, setApptSortOrder] = useState('desc');

  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('patient_excel_density', val);
  };

  // Financial calculations
  const totalPlansPrice = useMemo(() => {
    return plans.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0);
  }, [plans]);

  const paidPct = useMemo(() => {
    if (totalPlansPrice <= 0) return totalPaid > 0 ? 100 : 0;
    return Math.min(100, Math.round((totalPaid / totalPlansPrice) * 100));
  }, [totalPlansPrice, totalPaid]);

  const completedAppts = useMemo(() => {
    return appointments.filter(a => a.status === 'Completed' || a.status === 'completed').length;
  }, [appointments]);

  // Tooth status calculations
  const toothStatusMap = useMemo(() => {
    return card043Data?.toothStatus || {};
  }, [card043Data]);

  const toothFdiList = [
    18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28,
    48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38
  ];

  const toothStats = useMemo(() => {
    let healthy = 0;
    let caries = 0;
    let filled = 0;
    let crown = 0;
    let missing = 0;
    let other = 0;

    toothFdiList.forEach(fdi => {
      const code = toothStatusMap[fdi] || 'N';
      if (code === 'N' || code === 'H' || !code) healthy++;
      else if (code === 'C') caries++;
      else if (code === 'F') filled++;
      else if (code === 'K' || code === 'V') crown++;
      else if (code === 'A' || code === 'R') missing++;
      else other++;
    });

    return { healthy, caries, filled, crown, missing, other };
  }, [toothStatusMap]);

  // Filtered Treatments
  const filteredTreatments = useMemo(() => {
    let list = [...plans];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.doctor_name && p.doctor_name.toLowerCase().includes(q)) ||
        (p.tooth_number && String(p.tooth_number).includes(q))
      );
    }

    list.sort((a, b) => {
      let valA, valB;
      if (treatmentSortField === 'price') {
        valA = Number(a.total_price) || 0;
        valB = Number(b.total_price) || 0;
        return treatmentSortOrder === 'asc' ? valA - valB : valB - valA;
      }
      if (treatmentSortField === 'status') {
        valA = (a.status || '').toLowerCase();
        valB = (b.status || '').toLowerCase();
        return treatmentSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = new Date(a.created_date || a.date || 0).getTime();
      valB = new Date(b.created_date || b.date || 0).getTime();
      return treatmentSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [plans, search, treatmentSortField, treatmentSortOrder]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    let list = [...payments];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => 
        (p.type && p.type.toLowerCase().includes(q)) ||
        (p.method && p.method.toLowerCase().includes(q)) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        (p.notes && p.notes.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      let valA, valB;
      if (paymentSortField === 'amount') {
        valA = Number(a.amount) || 0;
        valB = Number(b.amount) || 0;
        return paymentSortOrder === 'asc' ? valA - valB : valB - valA;
      }
      valA = new Date(a.date || 0).getTime();
      valB = new Date(b.date || 0).getTime();
      return paymentSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [payments, search, paymentSortField, paymentSortOrder]);

  // Filtered Appointments
  const filteredAppointments = useMemo(() => {
    let list = [...appointments];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => 
        (a.service_name && a.service_name.toLowerCase().includes(q)) ||
        (a.service && a.service.toLowerCase().includes(q)) ||
        (a.doctor && a.doctor.toLowerCase().includes(q)) ||
        (a.status && a.status.toLowerCase().includes(q))
      );
    }

    list.sort((a, b) => {
      const valA = new Date(`${a.date || a.appointment_date || 0} ${a.time || '00:00'}`).getTime();
      const valB = new Date(`${b.date || b.appointment_date || 0} ${b.time || '00:00'}`).getTime();
      return apptSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [appointments, search, apptSortOrder]);

  // Filtered Teeth Matrix
  const filteredTeethMatrix = useMemo(() => {
    const list = toothFdiList.map(fdi => {
      const code = toothStatusMap[fdi] || 'N';
      let loc = "Jag'";
      const num = Number(fdi);
      if (num >= 11 && num <= 18) loc = "Yuqori O'ng Jag'";
      else if (num >= 21 && num <= 28) loc = "Yuqori Chap Jag'";
      else if (num >= 31 && num <= 38) loc = "Pastki Chap Jag'";
      else if (num >= 41 && num <= 48) loc = "Pastki O'ng Jag'";

      const statusNames = {
        'N': "Sog'lom / Me'yor",
        'H': "Sog'lom",
        'C': "Kariyes (Karies)",
        'P': "Pulpit",
        'Pt': "Periodontit",
        'R': "Ildiz qoldig'i",
        'A': "Tish yo'q / Olingan",
        'F': "Plomba qilingan",
        'K': "Sun'iy Toj (Koronka)",
        'V': "Vinir",
        'I': "Implantat",
      };

      const statusColors = {
        'N': "bg-emerald-50 text-emerald-700 border-emerald-200",
        'H': "bg-emerald-50 text-emerald-700 border-emerald-200",
        'C': "bg-amber-50 text-amber-700 border-amber-200",
        'P': "bg-rose-50 text-rose-700 border-rose-200",
        'Pt': "bg-purple-50 text-purple-700 border-purple-200",
        'R': "bg-slate-100 text-slate-700 border-slate-300",
        'A': "bg-slate-100 text-slate-400 border-slate-200",
        'F': "bg-blue-50 text-blue-700 border-blue-200",
        'K': "bg-violet-50 text-violet-700 border-violet-200",
        'V': "bg-indigo-50 text-indigo-700 border-indigo-200",
        'I': "bg-teal-50 text-teal-700 border-teal-200",
      };

      return {
        fdi,
        loc,
        code,
        statusName: statusNames[code] || code,
        badgeClass: statusColors[code] || "bg-slate-100 text-slate-600 border-slate-200",
      };
    });

    if (search) {
      const q = search.toLowerCase();
      return list.filter(item => 
        String(item.fdi).includes(q) ||
        item.loc.toLowerCase().includes(q) ||
        item.statusName.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q)
      );
    }
    return list;
  }, [toothStatusMap, search]);

  const handleExport = () => {
    try {
      exportPatientToExcel({
        patient,
        plans,
        payments,
        appointments,
        doctors,
        card043Data,
        totalPaid,
        totalDebt,
        toothRecords
      });
      toast.success("Bemor profili to'liq Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Excel eksportda xatolik yuz berdi");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const isCompact = density === 'compact';
  const tablePadding = isCompact ? 'px-3 py-1.5 text-xs' : 'px-3.5 py-2.5 text-sm';
  const thPadding = isCompact ? 'px-3 py-1 text-[11px]' : 'px-3.5 py-2 text-xs';

  return (
    <div className="space-y-4 pb-12">
      {/* ─── 1. TOOLBAR CONTROLS & ACTIONS ─────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-3 sm:p-4">
        {/* Toolbar Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder="Jadvallar bo'yicha qidiruv (muolaja, to'lov, qabul, shifokor, tish #)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-8 bg-slate-50 hover:bg-white focus:bg-white rounded-xl border border-slate-200 focus:border-[#1499AD] font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-[#1499AD]/10 transition-all outline-none"
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Section Selector Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0 no-scrollbar">
            {[
              { id: 'all', label: "📊 Barchasi" },
              { id: 'treatments', label: "📋 Davolash", count: plans.length },
              { id: 'payments', label: "💳 To'lovlar", count: payments.length },
              { id: 'appointments', label: "📅 Qabullar", count: appointments.length },
              { id: 'teeth', label: "🦷 Tish Formulasi", count: 32 },
              { id: 'passport', label: "👤 Pasport" },
              { id: 'card043', label: "📝 043/u" },
            ].map(tab => {
              const isActive = activeSection === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    isActive 
                      ? "bg-slate-900 text-white shadow-xs font-black" 
                      : "bg-slate-100/80 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"
                  )}
                >
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[9px] font-black",
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                    )}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Actions & Density */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Print */}
            <button
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
              title="Sahifani chop etish"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. EXECUTIVE FINANCIAL & CLINICAL KPI GRID ────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">Jami Muolajalar</span>
          <div className="text-lg font-black font-mono text-slate-900 tabular-nums">
            {totalPlansPrice.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">UZS</span>
          </div>
          <p className="text-[9.5px] font-bold text-slate-400 mt-1">{plans.length} ta rejalashtirilgan ishlar</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block mb-0.5">To'langan Summa</span>
          <div className="text-lg font-black font-mono text-emerald-700 tabular-nums">
            {totalPaid.toLocaleString()} <span className="text-[10px] text-emerald-500 font-bold">UZS</span>
          </div>
          <div className="flex items-center gap-1.5 mt-1">
            <div className="flex-1 bg-emerald-100 rounded-full h-1.5 overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${paidPct}%` }} />
            </div>
            <span className="text-[9.5px] font-black text-emerald-700">{paidPct}%</span>
          </div>
        </div>

        <div className={cn(
          "p-3.5 rounded-2xl border shadow-2xs",
          totalDebt > 0 ? "bg-amber-50/50 border-amber-200/80" : "bg-white border-slate-200/90"
        )}>
          <span className={cn("text-[10px] font-black uppercase tracking-wider block mb-0.5", totalDebt > 0 ? "text-amber-800" : "text-slate-400")}>
            Qoldiq Qarzdorlik
          </span>
          <div className={cn("text-lg font-black font-mono tabular-nums", totalDebt > 0 ? "text-amber-950" : "text-slate-900")}>
            {totalDebt.toLocaleString()} <span className="text-[10px] text-slate-400 font-bold">UZS</span>
          </div>
          <p className={cn("text-[9.5px] font-bold mt-1", totalDebt > 0 ? "text-amber-700 font-bold" : "text-slate-400")}>
            {totalDebt > 0 ? "⚠️ Qarzdorlik mavjud" : "✅ To'liq to'langan"}
          </p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-600 block mb-0.5">Qabullar Holati</span>
          <div className="text-lg font-black font-mono text-blue-700 tabular-nums">
            {completedAppts} <span className="text-xs font-bold text-slate-400">/ {appointments.length} ta</span>
          </div>
          <p className="text-[9.5px] font-bold text-slate-400 mt-1">Bajarilgan uchrashuvlar</p>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 block mb-0.5">Tish Holati (Formula)</span>
          <div className="text-lg font-black font-mono text-purple-700 tabular-nums">
            {toothStats.healthy} <span className="text-xs font-bold text-slate-400">/ 32 sog'lom</span>
          </div>
          <p className="text-[9.5px] font-bold text-purple-600 mt-1">
            {toothStats.caries} karies • {toothStats.filled} plomba • {toothStats.crown} toj
          </p>
        </div>
      </div>

      {/* ─── 3. SPREADSHEET TABLES CONTAINER ───────────────────────────────── */}

      {/* SECTION: PASSPORT & ANAMNEZ */}
      {(activeSection === 'all' || activeSection === 'passport') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4 text-[#1499AD]" />
              1. Bemor Shaxsiy & Pasport Ma'lumotlari Jadvali
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">BEMOR_KARTA_ID: #{patient.id}</span>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[
              { label: "F.I.SH. (To'liq ism)", val: patient.full_name, icon: "👤", bold: true },
              { label: "Telefon raqami", val: formatPhone(patient.phone), icon: "📞", mono: true },
              { label: "Tug'ilgan sana / Yoshi", val: `${patient.birth_date || '—'} (${patient.birth_date ? new Date().getFullYear() - new Date(patient.birth_date).getFullYear() : '—'} yosh)`, icon: "🎂" },
              { label: "Jinsi", val: patient.gender === 'Female' ? 'Ayol' : 'Erkak', icon: "⚧" },
              { label: "Yashash manzili", val: patient.address || '—', icon: "📍" },
              { label: "Bemor Statusi", val: patient.status || 'Faol', icon: "🏷️", badge: true },
              { label: "Biriktirilgan shifokor", val: doctors.find(d => d.id === patient.main_treatment_provider)?.name || patient.main_treatment_provider || 'Belgilanmagan', icon: "👨‍⚕️" },
              { label: "Ro'yxatdan o'tgan sana", val: patient.created_date ? new Date(patient.created_date).toLocaleDateString('uz-UZ') : '—', icon: "📅" },
              { label: "Telegram Bot holati", val: patient.telegram_chat_id ? '✅ Ulangan' : '⚠️ Ulanmagan', icon: "🤖" },
            ].map(item => (
              <div key={item.label} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-2.5">
                <span className="text-base">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <span className="text-[9.5px] font-bold uppercase tracking-wider text-slate-400 block">{item.label}</span>
                  <span className={cn(
                    "text-xs text-slate-800 block truncate",
                    item.bold && "font-black text-slate-900",
                    item.mono && "font-mono font-bold text-[#1499AD]"
                  )}>
                    {item.val}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION: DAVOLASH REJALARI JADVALI */}
      {(activeSection === 'all' || activeSection === 'treatments') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-purple-600" />
              2. Davolash Rejalari & Xizmatlar Reyestri Jadvali ({filteredTreatments.length})
            </h3>
            <span className="text-[10px] font-black text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md uppercase">
              Jami: {filteredTreatments.reduce((sum, p) => sum + (Number(p.total_price) || 0), 0).toLocaleString()} UZS
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-black uppercase tracking-wider">
                  <th className={cn(thPadding, "w-10 text-center")}>№</th>
                  <th className={thPadding}>Reja / Muolaja Nomi</th>
                  <th className={thPadding}>Tishlar</th>
                  <th className={thPadding}>Xizmatlar Soni</th>
                  <th className={thPadding}>Mas'ul Shifokor</th>
                  <th 
                    onClick={() => {
                      if (treatmentSortField === 'price') setTreatmentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setTreatmentSortField('price'); setTreatmentSortOrder('desc'); }
                    }}
                    className={cn(thPadding, "text-right cursor-pointer hover:bg-slate-200/80 transition-colors select-none")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Qiymati (UZS)</span>
                      {treatmentSortField === 'price' ? (
                        treatmentSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th 
                    onClick={() => {
                      if (treatmentSortField === 'status') setTreatmentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setTreatmentSortField('status'); setTreatmentSortOrder('desc'); }
                    }}
                    className={cn(thPadding, "cursor-pointer hover:bg-slate-200/80 transition-colors select-none")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Holati</span>
                      {treatmentSortField === 'status' ? (
                        treatmentSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className={cn(thPadding, "text-right")}>Yaratilgan Sana</th>
                  <th className={cn(thPadding, "w-20 text-center")}>Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTreatments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-400 font-medium text-xs">
                      Davolash rejalari topilmadi
                    </td>
                  </tr>
                ) : (
                  filteredTreatments.map((p, idx) => {
                    const doc = doctors.find(d => d.id === p.doctor_id || d.id === p.doctor);
                    const docName = doc?.name || p.doctor_name || '—';
                    const sCount = Array.isArray(p.services) ? p.services.length : (p.services_count || 0);
                    const toothBadge = p.tooth_number ? `#${p.tooth_number}` : (p.tooth_numbers ? p.tooth_numbers.join(', ') : null);

                    const statusStyle = 
                      p.status === 'completed' || p.status === 'bajarildi' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      p.status === 'in_progress' || p.status === 'jarayonda' ? "bg-amber-50 text-amber-700 border-amber-200" :
                      "bg-blue-50 text-blue-700 border-blue-200";

                    const statusLabel = 
                      p.status === 'completed' || p.status === 'bajarildi' ? "Bajarildi" :
                      p.status === 'in_progress' || p.status === 'jarayonda' ? "Jarayonda" :
                      "Rejalashtirilgan";

                    return (
                      <tr key={p.id || idx} className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700">
                        <td className={cn(tablePadding, "text-center font-bold text-slate-400 font-mono")}>{idx + 1}</td>
                        <td className={cn(tablePadding, "font-bold text-slate-900")}>
                          <div className="truncate max-w-xs">{p.name || 'Davolash rejasi'}</div>
                        </td>
                        <td className={tablePadding}>
                          {toothBadge ? (
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md font-mono font-bold text-[10.5px] text-slate-700">
                              {toothBadge}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[11px]">Umumiy</span>
                          )}
                        </td>
                        <td className={tablePadding}>
                          <span className="font-bold text-slate-600">{sCount} ta xizmat</span>
                        </td>
                        <td className={tablePadding}>
                          <span className="text-slate-700 font-semibold">{docName}</span>
                        </td>
                        <td className={cn(tablePadding, "text-right font-mono font-bold text-slate-900 tabular-nums")}>
                          {(Number(p.total_price) || 0).toLocaleString()} UZS
                        </td>
                        <td className={tablePadding}>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", statusStyle)}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className={cn(tablePadding, "text-right font-mono text-[11px] text-slate-500")}>
                          {p.created_date ? new Date(p.created_date).toLocaleDateString('uz-UZ') : (p.date || '—')}
                        </td>
                        <td className={cn(tablePadding, "text-center")}>
                          {onOpenPlanInvoice && (
                            <button
                              onClick={() => onOpenPlanInvoice(p)}
                              className="p-1.5 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors cursor-pointer"
                              title="Hisob-fakturani ko'rish"
                            >
                              <FileText className="w-3.5 h-3.5 text-[#1499AD]" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: TO'LOVLAR & TRANZAKSIYALAR REYESTRI */}
      {(activeSection === 'all' || activeSection === 'payments') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              3. To'lovlar & Tranzaksiyalar Reyestri Jadvali ({filteredPayments.length})
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase">
                To'langan: {totalPaid.toLocaleString()} UZS
              </span>
              {onOpenPayModal && (
                <button
                  onClick={onOpenPayModal}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  + To'lov
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-black uppercase tracking-wider">
                  <th className={cn(thPadding, "w-10 text-center")}>№</th>
                  <th 
                    onClick={() => {
                      if (paymentSortField === 'date') setPaymentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setPaymentSortField('date'); setPaymentSortOrder('desc'); }
                    }}
                    className={cn(thPadding, "cursor-pointer hover:bg-slate-200/80 transition-colors select-none")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Sana & Vaqt</span>
                      {paymentSortField === 'date' ? (
                        paymentSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className={thPadding}>Turi</th>
                  <th className={thPadding}>To'lov Usuli</th>
                  <th 
                    onClick={() => {
                      if (paymentSortField === 'amount') setPaymentSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
                      else { setPaymentSortField('amount'); setPaymentSortOrder('desc'); }
                    }}
                    className={cn(thPadding, "text-right cursor-pointer hover:bg-slate-200/80 transition-colors select-none")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Summa (UZS)</span>
                      {paymentSortField === 'amount' ? (
                        paymentSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
                    </div>
                  </th>
                  <th className={thPadding}>Kategoriya / Izoh</th>
                  <th className={thPadding}>Kassir / Shifokor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-medium text-xs">
                      To'lovlar tarixi mavjud emas
                    </td>
                  </tr>
                ) : (
                  filteredPayments.map((pm, idx) => {
                    const dateStr = pm.date ? new Date(pm.date).toLocaleDateString('uz-UZ') : '—';
                    const timeStr = pm.date?.includes('T') ? new Date(pm.date).toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' }) : '';
                    
                    const isIncome = pm.type === 'Income' || !pm.type;
                    const isExpense = pm.type === 'Expense';
                    const isRefund = pm.type === 'Refund';

                    const typeBadge = 
                      isIncome ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      isExpense ? "bg-rose-50 text-rose-700 border-rose-200" :
                      isRefund ? "bg-indigo-50 text-indigo-700 border-indigo-200" :
                      "bg-purple-50 text-purple-700 border-purple-200";

                    const typeLabel = 
                      isIncome ? "Kirim (To'lov)" :
                      isExpense ? "Chiqim" :
                      isRefund ? "Qaytarish" :
                      "Chegirma";

                    const methodLabel = 
                      pm.method === 'Cash' ? "Naqd pul" :
                      pm.method === 'Card' ? "Plastik karta" :
                      pm.method === 'Transfer' ? "Bank o'tkazma" : (pm.method || '—');

                    const doc = doctors.find(d => d.id === pm.doctor_id);
                    const docName = doc?.name || pm.doctor_name || 'Kassa';

                    return (
                      <tr key={pm.id || idx} className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700">
                        <td className={cn(tablePadding, "text-center font-bold text-slate-400 font-mono")}>{idx + 1}</td>
                        <td className={cn(tablePadding, "font-mono font-bold text-slate-800 text-[11px]")}>
                          {dateStr} <span className="text-slate-400 font-normal">{timeStr}</span>
                        </td>
                        <td className={tablePadding}>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", typeBadge)}>
                            {typeLabel}
                          </span>
                        </td>
                        <td className={tablePadding}>
                          <span className="font-semibold text-slate-600">{methodLabel}</span>
                        </td>
                        <td className={cn(tablePadding, "text-right font-mono font-bold tabular-nums", isIncome ? "text-emerald-700" : "text-rose-600")}>
                          {isIncome ? '+' : '−'}{(Number(pm.amount) || 0).toLocaleString()} UZS
                        </td>
                        <td className={cn(tablePadding, "text-slate-600 truncate max-w-xs")}>
                          {pm.categoryClean || pm.category || pm.notes || '—'}
                        </td>
                        <td className={cn(tablePadding, "text-slate-600")}>
                          {docName}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: QABULLAR & TASHRIFLAR TARIXI */}
      {(activeSection === 'all' || activeSection === 'appointments') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              4. Qabullar & Tashriflar Tarixi Jadvali ({filteredAppointments.length})
            </h3>
            {onOpenApptModal && (
              <button
                onClick={onOpenApptModal}
                className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                + Yangi Qabul
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-black uppercase tracking-wider">
                  <th className={cn(thPadding, "w-10 text-center")}>№</th>
                  <th 
                    onClick={() => setApptSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    className={cn(thPadding, "cursor-pointer hover:bg-slate-200/80 transition-colors select-none")}
                  >
                    <div className="flex items-center gap-1">
                      <span>Sana</span>
                      {apptSortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />}
                    </div>
                  </th>
                  <th className={thPadding}>Vaqt</th>
                  <th className={thPadding}>Xizmat / Muolaja</th>
                  <th className={thPadding}>Mas'ul Shifokor</th>
                  <th className={thPadding}>Holati</th>
                  <th className={cn(thPadding, "text-right")}>Tasdiq</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAppointments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-medium text-xs">
                      Qabullar tarixi mavjud emas
                    </td>
                  </tr>
                ) : (
                  filteredAppointments.map((ap, idx) => {
                    const dateStr = ap.date ? new Date(ap.date).toLocaleDateString('uz-UZ') : (ap.appointment_date || '—');
                    const timeStr = ap.time || ap.start_time || '09:00';
                    const serviceStr = ap.service_name || ap.service || ap.title || 'Qabul';
                    const doc = doctors.find(d => d.id === ap.doctor_id || d.id === ap.doctor);
                    const docName = doc?.name || ap.doctor || 'Shifokor';

                    const statusStyle = 
                      ap.status === 'Completed' || ap.status === 'completed' ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                      ap.status === 'Confirmed' || ap.status === 'confirmed' ? "bg-blue-50 text-blue-700 border-blue-200" :
                      ap.status === 'Cancelled' || ap.status === 'cancelled' ? "bg-rose-50 text-rose-700 border-rose-200" :
                      "bg-amber-50 text-amber-700 border-amber-200";

                    const statusLabel = 
                      ap.status === 'Completed' || ap.status === 'completed' ? "Tugallandi" :
                      ap.status === 'Confirmed' || ap.status === 'confirmed' ? "Tasdiqlangan" :
                      ap.status === 'Cancelled' || ap.status === 'cancelled' ? "Bekor qilindi" :
                      "Kutilmoqda";

                    return (
                      <tr key={ap.id || idx} className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700">
                        <td className={cn(tablePadding, "text-center font-bold text-slate-400 font-mono")}>{idx + 1}</td>
                        <td className={cn(tablePadding, "font-mono font-bold text-slate-800 text-[11px]")}>
                          {dateStr}
                        </td>
                        <td className={cn(tablePadding, "font-mono font-bold text-[#1499AD] text-[11px]")}>
                          {timeStr}
                        </td>
                        <td className={cn(tablePadding, "font-semibold text-slate-900")}>
                          {serviceStr}
                        </td>
                        <td className={cn(tablePadding, "text-slate-600")}>
                          {docName}
                        </td>
                        <td className={tablePadding}>
                          <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", statusStyle)}>
                            {statusLabel}
                          </span>
                        </td>
                        <td className={cn(tablePadding, "text-right text-[11px] text-slate-500 font-medium")}>
                          {ap.confirmation_status ? `Tasdiqlandi` : 'Oddiy'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: TISH FORMULASI MATRITSASI */}
      {(activeSection === 'all' || activeSection === 'teeth') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-600" />
              5. Tish Formulasi & Tashxislar Matritsasi Excel Jadvali (32 FDI)
            </h3>
            <span className="text-[10px] font-bold text-slate-500 font-mono">
              FDI STANDARTI: 18-28 (Yuqori) / 48-38 (Pastki)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-black uppercase tracking-wider">
                  <th className={cn(thPadding, "w-16 text-center")}>FDI №</th>
                  <th className={thPadding}>Jag' & Joylashuv</th>
                  <th className={thPadding}>Holat / Tashxis</th>
                  <th className={thPadding}>Holat KODI</th>
                  <th className={cn(thPadding, "text-right")}>Muolaja Tavsifi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTeethMatrix.map((item) => (
                  <tr key={item.fdi} className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700">
                    <td className={cn(tablePadding, "text-center font-black font-mono text-slate-900")}>
                      <span className="px-2 py-0.5 bg-slate-100 rounded-md border border-slate-200">
                        #{item.fdi}
                      </span>
                    </td>
                    <td className={cn(tablePadding, "text-slate-600 font-semibold")}>
                      {item.loc}
                    </td>
                    <td className={tablePadding}>
                      <span className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border", item.badgeClass)}>
                        {item.statusName}
                      </span>
                    </td>
                    <td className={cn(tablePadding, "font-mono font-bold text-slate-500 text-center w-24")}>
                      [{item.code}]
                    </td>
                    <td className={cn(tablePadding, "text-right text-xs text-slate-500")}>
                      {item.code === 'N' || item.code === 'H' ? "Me'yorda" : "Tibbiy nazorat / Muolaja"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION: 043/U TIBBIY KUNDALIGI */}
      {(activeSection === 'all' || activeSection === 'card043') && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              6. Shakl 043/u Tibbiy Kundalik Qaydlari Jadvali
            </h3>
            <span className="text-[10px] font-bold text-slate-400 font-mono">DAVOLASH KUNDALIGI</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/70 text-slate-600 font-black uppercase tracking-wider">
                  <th className={cn(thPadding, "w-10 text-center")}>№</th>
                  <th className={cn(thPadding, "w-32")}>Sana</th>
                  <th className={cn(thPadding, "w-48")}>Shifokor</th>
                  <th className={thPadding}>Tashxis & Muolaja Bayoni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(card043Data?.historyLogs || []).length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-400 font-medium text-xs">
                      Shakl 043/u bo'yicha kundalik yozuvlari mavjud emas
                    </td>
                  </tr>
                ) : (
                  (card043Data?.historyLogs || []).map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors font-medium text-slate-700">
                      <td className={cn(tablePadding, "text-center font-bold text-slate-400 font-mono")}>{idx + 1}</td>
                      <td className={cn(tablePadding, "font-mono font-bold text-slate-800 text-[11px]")}>{log.date || '—'}</td>
                      <td className={cn(tablePadding, "font-bold text-slate-800")}>{log.doctor || 'Shifokor'}</td>
                      <td className={cn(tablePadding, "text-slate-600 leading-relaxed")}>{log.content || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 4. EXCEL FORMULA SUMMARY FOOTER BAR ─────────────────────────── */}
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-300">EXCEL SPREADSHEET EHR ENGINE</span>
        </div>
        <div className="flex items-center gap-3 text-[11px] font-bold text-slate-300 flex-wrap">
          <span>REJALAR: <strong className="text-white">{plans.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span>TO'LOVLAR: <strong className="text-emerald-400">{payments.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span>QABULLAR: <strong className="text-blue-400">{appointments.length}</strong></span>
          <span className="text-slate-600">•</span>
          <span>BALANS: <strong className={totalDebt > 0 ? "text-rose-400" : "text-emerald-400"}>{totalDebt.toLocaleString()} UZS</strong></span>
        </div>
      </div>
    </div>
  );
}

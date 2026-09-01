import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Trash2, Download, Plus, AlertTriangle,
  Clock, FileText, Camera, Activity, Phone,
  Building2, Layers, Settings2, Hash, UserRound, CalendarDays,
  BellRing, Receipt, Table as TableIcon,
  FileSpreadsheet, Sparkles, Check, ExternalLink, Calendar, PlusCircle
} from 'lucide-react';
import { 
  Tooth, ImplantIcon, CrownIcon, FormerIcon, AbutmentIcon, 
  BoneGraftIcon, SinusLiftIcon, DentalSurgicalIcon, BrandStockIcon,
  ClinicalRevenueIcon 
} from '@/components/ui/Icons';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { motion } from 'framer-motion';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ImplantForm from '../components/implants/ImplantForm';
import jsPDF from 'jspdf';

// Defensive rendering helper
const safeRender = (val, fallback = '—') => {
  if (val == null || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object') return val.label || val.name || val.title || JSON.stringify(val).substring(0, 20);
  return String(val);
};

// Convert internal tooth ID (ul2, ur8, ll1, lr5) → FDI number (22, 18, 31, 45)
const toothIdToFdi = (id) => {
  if (!id) return id;
  const s = String(id);
  const match = s.match(/^(ur|ul|lr|ll)(\d+)$/);
  if (!match) return s;
  const [, quad, num] = match;
  const quadMap = { ur: '1', ul: '2', ll: '3', lr: '4' };
  return quadMap[quad] + num;
};

const LIFECYCLE_MAPPING = {
  'planned': "Rejalashtirilgan",
  'placed': "O'rnatildi",
  'healing': "Healing jarayoni",
  'abutment': "Abutment qo'yildi",
  'crown': "Crown tayyor",
  'completed': "Tugallangan",
  'failure': "Failure",
  'failed': "Failure"
};

const LIFECYCLE_COLORS = {
  'Rejalashtirilgan': 'bg-blue-50 text-blue-700 border-blue-200',
  "O'rnatildi": 'bg-teal-50 text-teal-700 border-teal-200',
  'Healing jarayoni': 'bg-yellow-50 text-yellow-800 border-yellow-200',
  "Abutment qo'yildi": 'bg-purple-50 text-purple-700 border-purple-200',
  'Crown tayyor': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Tugallangan': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Failure': 'bg-rose-50 text-rose-700 border-rose-200',
};

// Preset Quick Services for Dental/Implant procedures
const PRESET_SERVICES = [
  { label: 'Metallokeramika Karonka', name: 'Metallokeramika Karonka', icon: CrownIcon, iconColor: 'text-indigo-600', defaultPrice: 800000, category: 'Ortopediya' },
  { label: 'Zirkon Karonka', name: 'Zirkon Karonka', icon: CrownIcon, iconColor: 'text-indigo-600', defaultPrice: 1500000, category: 'Ortopediya' },
  { label: 'E-Max Press Karonka', name: 'E-Max Karonka', icon: CrownIcon, iconColor: 'text-indigo-600', defaultPrice: 1800000, category: 'Ortopediya' },
  { label: 'Yopiq Sinus-lifting', name: 'Yopiq Sinus-lifting', icon: SinusLiftIcon, iconColor: 'text-sky-600', defaultPrice: 1500000, category: 'Sinus' },
  { label: 'Ochiq Sinus-lifting', name: 'Ochiq Sinus-lifting', icon: SinusLiftIcon, iconColor: 'text-sky-600', defaultPrice: 2500000, category: 'Sinus' },
  { label: 'Suyak ekish (Bone graft)', name: 'Suyak ekish (Bone graft)', icon: BoneGraftIcon, iconColor: 'text-emerald-600', defaultPrice: 1200000, category: 'Graft' },
  { label: 'Membrana qo\'yish', name: 'Membrana qo\'yish', icon: BoneGraftIcon, iconColor: 'text-emerald-600', defaultPrice: 800000, category: 'Graft' },
  { label: 'Standart Abutment', name: 'Standart Abutment', icon: AbutmentIcon, iconColor: 'text-purple-600', defaultPrice: 300000, category: 'Komponent' },
  { label: 'Individual Zirkon Abutment', name: 'Individual Zirkon Abutment', icon: AbutmentIcon, iconColor: 'text-purple-600', defaultPrice: 600000, category: 'Komponent' },
  { label: 'Formik (Healing Abutment)', name: 'Formik qo\'yish', icon: FormerIcon, iconColor: 'text-amber-600', defaultPrice: 100000, category: 'Komponent' },
  { label: 'Boshqa amaliyot', name: 'Boshqa xizmat', icon: DentalSurgicalIcon, iconColor: 'text-slate-600', defaultPrice: 500000, category: 'Boshqa' }
];

export default function ImplantDetail() {
  const { t, language } = useTranslation();
  const { clinicName } = useClinic();
  const { id } = useParams();
  const navigate = useNavigate();

  const [implant, setImplant] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('excel'); // 'excel' | 'clinical' | 'docs' | 'timeline'
  const [editOpen, setEditOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [zoomImg, setZoomImg] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [relatedTeeth, setRelatedTeeth] = useState([]);
  const [selectedRelatedTooth, setSelectedRelatedTooth] = useState(null);

  // New Service Form State
  const [serviceForm, setServiceForm] = useState({
    service_name: 'Metallokeramika Karonka',
    date: new Date().toISOString().split('T')[0],
    tooth_number: '',
    firma: '',
    price: 800000,
    notes: ''
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [items, pats] = await Promise.all([
        base44.entities.Implant.filter({ id }),
        base44.entities.Patient.list('full_name', 200),
      ]);
      let currentImplant = items[0] || null;
      
      if (currentImplant && !currentImplant.lifecycle_status) {
        currentImplant.lifecycle_status = "O'rnatildi";
      }
      
      setImplant(currentImplant);
      setPatients(pats || []);
      
      if (currentImplant?.patient_id && currentImplant?.placement_date) {
        try {
          const related = await base44.entities.Implant.filter({
            patient_id: currentImplant.patient_id,
            placement_date: currentImplant.placement_date
          });
          const uniqueRelated = Array.from(new Map((related || []).map(item => [item.id, item])).values());
          setRelatedTeeth(uniqueRelated);
        } catch {
          setRelatedTeeth([]);
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Ma'lumotlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      <div className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-96 bg-slate-100 rounded-2xl animate-pulse" />
    </div>
  );

  if (!implant) return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto my-12 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-slate-900 mb-2">{t('implants.notFound') || "Implant ma'lumoti topilmadi"}</h2>
      <p className="text-sm text-slate-500 mb-6">Ushbu yozuv o'chirilgan yoki mavjud emas bo'lishi mumkin.</p>
      <Link to="/implants">
        <Button className="rounded-xl font-black gap-2 bg-[#1499AD] hover:bg-[#118294] text-white">
          <ArrowLeft className="w-4 h-4" /> Implantlar ro'yxatiga qaytish
        </Button>
      </Link>
    </div>
  );

  // Active tooth selection (plain JS to keep React hooks order stable)
  const activeTooth = (selectedRelatedTooth ? relatedTeeth.find(r => r.id === selectedRelatedTooth) : null) || implant;

  const rawTeeth = (activeTooth.tooth_numbers || (activeTooth.tooth_number ? [activeTooth.tooth_number] : []));
  const teethList = [...new Set(rawTeeth.map(String))];
  const activeToothNumberFdi = teethList.length > 0 ? toothIdToFdi(teethList[0]) : '21';

  const firmaNom = (activeTooth.firma === 'Boshqa' ? (activeTooth.firma_custom || 'Boshqa') : activeTooth.firma) || 'Dentium';
  const priceNum = Number(activeTooth.price) || Number(activeTooth.narxi) || 1500000;
  const primaryServiceName = activeTooth.service_name || activeTooth.hizmat_turi || 'Implant o\'rnatish';

  // Normalize current status for UI
  const getCurrentStatus = () => {
    const s = activeTooth.lifecycle_status || activeTooth.status;
    if (!s) return "Rejalashtirilgan";
    return LIFECYCLE_MAPPING[s] || s;
  };

  const displayStatus = getCurrentStatus();

  const updateStatus = async (newStatus) => {
    setStatusUpdating(true);
    const now = new Date().toISOString();
    const statusMap = {
      "Rejalashtirilgan": "planned",
      "O'rnatildi": "placed",
      "Healing jarayoni": "healing",
      "Abutment qo'yildi": "abutment",
      "Crown tayyor": "crown",
      "Tugallangan": "completed",
      "Failure": "failure"
    };

    const teethToUpdate = relatedTeeth.length > 0 ? relatedTeeth : [activeTooth];

    try {
      await Promise.all(teethToUpdate.map(t => {
        const timeline = [...(t.timeline || []), {
          date: now, status: newStatus, note: `Holat o'zgartirildi: ${newStatus}`, user: 'Dr.'
        }];
        const audit_log = [...(t.audit_log || []), { date: now, user: 'Dr.', action: `Holat: ${newStatus}` }];
        
        return base44.entities.Implant.update(t.id, { 
          ...t,
          lifecycle_status: newStatus, 
          status: statusMap[newStatus] || newStatus.toLowerCase(),
          timeline, 
          audit_log 
        });
      }));

      toast.success("Implant holati yangilandi!");
      load();
    } catch (e) {
      console.error(e);
      toast.error("Holatni yangilashda xatolik");
    } finally {
      setStatusUpdating(false);
    }
  };

  // Build the unified list of services for this tooth/implant
  const baseServiceRow = {
    id: 'primary-implant',
    is_primary: true,
    service_name: primaryServiceName,
    date: activeTooth.placement_date || new Date().toISOString().split('T')[0],
    tooth_number: activeToothNumberFdi,
    firma: firmaNom,
    price: priceNum,
    notes: activeTooth.brend ? `${activeTooth.brend} (Asosiy amaliyot)` : 'Asosiy implantatsiya'
  };

  const customServicesList = Array.isArray(activeTooth.services_list) ? activeTooth.services_list : [];
  
  // Legacy crown fallback if present and not in list
  const hasCrownInList = customServicesList.some(s => (s.service_name || '').toLowerCase().includes('karonka') || (s.service_name || '').toLowerCase().includes('crown') || (s.service_name || '').toLowerCase().includes('keramika') || (s.service_name || '').toLowerCase().includes('zirkon'));
  const legacyCrownRows = (!hasCrownInList && activeTooth.crown_type) ? [{
    id: 'legacy-crown',
    service_name: `${activeTooth.crown_type} Karonka`,
    date: activeTooth.placement_date || new Date().toISOString().split('T')[0],
    tooth_number: activeToothNumberFdi,
    firma: firmaNom,
    price: Number(activeTooth.crown_price) || (activeTooth.crown_type === 'Metallokeramika' ? 800000 : 1500000),
    notes: `${activeTooth.crown_quantity || 1} dona karonka`
  }] : [];

  const allServices = [baseServiceRow, ...customServicesList, ...legacyCrownRows];
  const totalAllServicesPrice = allServices.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);

  // Handle Adding a New Service
  const handleOpenAddService = () => {
    setServiceForm({
      service_name: 'Metallokeramika Karonka',
      date: activeTooth.placement_date || new Date().toISOString().split('T')[0],
      tooth_number: activeToothNumberFdi,
      firma: firmaNom,
      price: 800000,
      notes: ''
    });
    setServiceModalOpen(true);
  };

  const handleSelectPreset = (preset) => {
    setServiceForm(prev => ({
      ...prev,
      service_name: preset.name,
      price: preset.defaultPrice
    }));
  };

  const handleSaveNewService = async () => {
    if (!serviceForm.service_name.trim()) {
      toast.warning("Xizmat nomini kiriting");
      return;
    }

    const newSvc = {
      id: 'svc-' + Date.now(),
      service_name: serviceForm.service_name.trim(),
      date: serviceForm.date || new Date().toISOString().split('T')[0],
      tooth_number: serviceForm.tooth_number || activeToothNumberFdi,
      firma: serviceForm.firma || firmaNom,
      price: Number(serviceForm.price) || 0,
      notes: serviceForm.notes || ''
    };

    const updatedServices = [...(activeTooth.services_list || []), newSvc];
    const now = new Date().toISOString();
    const timeline = [...(activeTooth.timeline || []), {
      date: now,
      status: "Xizmat qo'shildi",
      note: `${newSvc.service_name} (${newSvc.price.toLocaleString()} so'm) ro'yxatga kiritildi`,
      user: 'Dr.'
    }];

    try {
      await base44.entities.Implant.update(activeTooth.id, {
        ...activeTooth,
        services_list: updatedServices,
        timeline
      });
      setServiceModalOpen(false);
      toast.success(language === 'ru' ? "Услуга успешно добавлена!" : "Xizmat muvaffaqiyatli qo'shildi!", {
        duration: 2500,
      });
      load();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? "Ошибка сохранения услуги" : "Xizmatni saqlashda xatolik");
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (serviceId === 'primary-implant') {
      toast.warning(language === 'ru' ? "Основную операцию импланта нельзя удалить. Используйте 'Редактировать'." : "Asosiy implant xizmatini o'chirib bo'lmaydi. Uni 'Tahrirlash' tugmasi orqali o'zgartirishingiz mumkin.");
      return;
    }
    if (!window.confirm(language === 'ru' ? "Вы уверены, что хотите удалить эту услугу?" : "Ushbu xizmatni o'chirishni tasdiqlaysizmi?")) return;

    const updatedServices = (activeTooth.services_list || []).filter(s => s.id !== serviceId);
    try {
      await base44.entities.Implant.update(activeTooth.id, {
        ...activeTooth,
        services_list: updatedServices
      });
      toast.success(language === 'ru' ? "Услуга удалена!" : "Xizmat o'chirildi!", {
        duration: 2500,
      });
      load();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? "Ошибка при удалении" : "O'chirishda xatolik");
    }
  };

  // Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(20, 153, 173);
    doc.text(`${clinicName} — Implant & Jarrohlik Xizmatlari Kartasi`, 20, 20);
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(11);
    doc.line(20, 24, 190, 24);

    const rows = [
      ['Bemor (F.I.Sh)', activeTooth.patient_name || '—'],
      ['Telefon', activeTooth.patient_phone || '—'],
      ['Mas\'ul shifokor', activeTooth.doctor || '—'],
      ['Tish raqami (FDI)', teethList.map(n => `#${toothIdToFdi(n)}`).join(', ') || '—'],
      ['Firma / Brend', firmaNom],
      ['Jami Xizmatlar Qiymati', `${totalAllServicesPrice.toLocaleString()} so'm`],
      ['O\'rnatilgan sana', activeTooth.placement_date || '—'],
      ['Holati', activeTooth.lifecycle_status || 'O\'rnatildi'],
    ];

    let y = 32;
    rows.forEach(([k, v]) => {
      doc.setFont(undefined, 'bold');
      doc.text(`${k}:`, 20, y);
      doc.setFont(undefined, 'normal');
      doc.text(`${v}`, 80, y);
      y += 7;
    });

    // Services Breakdown table
    y += 5;
    doc.setFont(undefined, 'bold');
    doc.text('Xizmatlar & Amaliyotlar Ro\'yxati:', 20, y);
    y += 7;

    allServices.forEach((s, idx) => {
      doc.setFont(undefined, 'normal');
      doc.text(`${idx + 1}. ${s.service_name} (#${s.tooth_number}) — ${s.firma} — ${Number(s.price).toLocaleString()} so'm [${s.date}]`, 25, y);
      y += 6;
    });

    const tishStr = teethList.map(n => toothIdToFdi(n)).join('-');
    doc.save(`Implant_Xizmatlar_${(activeTooth.patient_name || 'Bemor').replace(/\s+/g, '_')}_#${tishStr}.pdf`);
    toast.success("Implant kartasi PDF formatida yuklab olindi!");
  };

  // Export Single Implant to CSV (Excel)
  const exportExcelCSV = () => {
    try {
      const headers = ["№", "Xizmatlar", "Sana", "Tish raqami", "Firma nomi", "Narxi (so'm)", "Izoh"];
      const dataRows = allServices.map((s, idx) => [
        idx + 1,
        `"${(s.service_name || '').replace(/"/g, '""')}"`,
        `"${s.date || ''}"`,
        `"#${s.tooth_number || ''}"`,
        `"${(s.firma || '').replace(/"/g, '""')}"`,
        Number(s.price) || 0,
        `"${(s.notes || '').replace(/"/g, '""')}"`
      ]);

      const totalRow = ["", "JAMI QIYMAT:", "", "", "", totalAllServicesPrice, ""];
      const allCsvRows = [headers, ...dataRows, totalRow];

      const csvContent = "\uFEFF" + allCsvRows.map(r => r.join(",")).join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Implant_Xizmatlar_${(activeTooth.patient_name || 'Bemor').replace(/\s+/g, '_')}_#${teethList.join('-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Excel (.csv) xizmatlar jadvali yuklab olindi!");
    } catch (e) {
      console.error(e);
      toast.error("Eksportda xatolik");
    }
  };

  // Reminder status calculation
  const reminderInfo = (() => {
    if (!activeTooth.reminder_date) return { text: 'Belgilanmagan', badge: 'bg-slate-100 text-slate-600' };
    const today = new Date();
    const rd = new Date(activeTooth.reminder_date);
    const daysLeft = Math.ceil((rd - today) / 86400000);
    if (daysLeft < 0) return { text: `${Math.abs(daysLeft)} kun o'tdi`, badge: 'bg-rose-50 text-rose-700 border-rose-200' };
    if (daysLeft === 0) return { text: "Bugun!", badge: 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse' };
    if (daysLeft <= 7) return { text: `${daysLeft} kun qoldi`, badge: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { text: `${daysLeft} kun qoldi`, badge: 'bg-blue-50 text-blue-700 border-blue-200' };
  })();

  // Excel Parameters Table Rows Specification
  const excelSpecRows = [
    {
      num: 1,
      key: language === 'ru' ? "Пациент (Ф.И.О)" : "Bemor (F.I.Sh)",
      val: safeRender(activeTooth.patient_name),
      sub: activeTooth.patient_phone || (language === 'ru' ? "Телефон не указан" : "Telefon kiritilmagan"),
      badge: "bg-teal-50 text-teal-700 border-teal-200",
      icon: UserRound
    },
    {
      num: 2,
      key: language === 'ru' ? "Номера зубов (FDI)" : "Tish Raqamlari (FDI)",
      val: teethList.length > 0 ? teethList.map(n => `#${toothIdToFdi(n)}`).join(', ') : '—',
      sub: language === 'ru' ? "Международная формула FDI" : "Xalqaro FDI tish formulasi",
      badge: "bg-slate-900 text-white font-mono",
      icon: ImplantIcon
    },
    {
      num: 3,
      key: language === 'ru' ? "Фирма / Бренд" : "Firma / Brend Nomi",
      val: firmaNom,
      sub: activeTooth.brend ? `${activeTooth.brend} ${activeTooth.diameter && activeTooth.length ? `(Ø${activeTooth.diameter}×${activeTooth.length}mm)` : ''}` : (language === 'ru' ? 'Стандартная модель' : 'Standart model'),
      badge: "bg-indigo-50 text-indigo-700 border-indigo-200",
      icon: Building2
    },
    {
      num: 4,
      key: language === 'ru' ? "Общая стоимость операций" : "Jami Amaliyotlar Narxi",
      val: `${totalAllServicesPrice.toLocaleString()} ${language === 'ru' ? 'UZS' : "so'm"}`,
      sub: language === 'ru' ? "Общая сумма всех услуг" : "Barcha xizmatlar umumiy yig'indisi",
      badge: "bg-emerald-50 text-emerald-700 border-emerald-200 font-mono",
      icon: ClinicalRevenueIcon,
      highlight: true
    },
    {
      num: 5,
      key: language === 'ru' ? "Дата установки" : "O'rnatilgan Sana",
      val: safeRender(activeTooth.placement_date),
      sub: language === 'ru' ? "Дата проведения операции" : "Jarrohlik o'tkazilgan sana",
      badge: "bg-slate-100 text-slate-800 font-mono",
      icon: CalendarDays
    },
    {
      num: 6,
      key: language === 'ru' ? "Размеры (Диаметр × Длина)" : "O'lchamlari (Diametr × Uzunlik)",
      val: (activeTooth.diameter || activeTooth.length) 
        ? `Ø ${activeTooth.diameter || '—'} mm × ${activeTooth.length || '—'} mm` 
        : (language === 'ru' ? "Не указано" : "Kiritilmagan"),
      sub: (activeTooth.diameter || activeTooth.length) 
        ? (language === 'ru' ? "Параметры тела импланта" : "Implant tanasi parametrlari") 
        : (language === 'ru' ? "Диаметр и длина не внесены (Опционально)" : "Diametr va uzunlik kiritilmagan (Ixtiyoriy)"),
      badge: (activeTooth.diameter || activeTooth.length) 
        ? "bg-sky-50 text-sky-700 border-sky-200 font-mono" 
        : "bg-slate-100 text-slate-500 font-semibold",
      icon: Settings2
    },
    {
      num: 7,
      key: language === 'ru' ? "Торк (Первичная стабильность)" : "Torque (Birlamchi Barqarorlik)",
      val: activeTooth.torque ? `${activeTooth.torque} Ncm` : (language === 'ru' ? "Не измерено" : "O'lchanmagan"),
      sub: activeTooth.torque 
        ? (Number(activeTooth.torque) >= 35 
            ? (language === 'ru' ? "Оптимально (≥35 Ncm)" : "Optimal (≥35 Ncm)") 
            : (language === 'ru' ? "Низкая стабильность" : "Past barqarorlik")) 
        : (language === 'ru' ? "Динамометрический ключ (Опционально)" : "Dinamometrik kalit o'lchovi (Ixtiyoriy)"),
      badge: activeTooth.torque 
        ? (Number(activeTooth.torque) >= 35 
            ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-mono" 
            : "bg-amber-50 text-amber-700 border-amber-200 font-mono") 
        : "bg-slate-100 text-slate-500 font-semibold",
      icon: Activity
    },
    {
      num: 8,
      key: language === 'ru' ? "ISQ (Индекс остеоинтеграции)" : "ISQ (Osseointegratsiya Ko'rsatkichi)",
      val: activeTooth.isq ? `${activeTooth.isq} ISQ` : (language === 'ru' ? "Не измерено" : "O'lchanmagan"),
      sub: activeTooth.isq 
        ? (Number(activeTooth.isq) >= 65 
            ? (language === 'ru' ? "Высокая стабильность (Возможна нагрузка)" : "Yuqori barqarorlik (Aktiv yuklash)") 
            : (language === 'ru' ? "Требует наблюдения" : "Kuzatuv talab")) 
        : (language === 'ru' ? "RFA Osstell o'lchovi (Опционально)" : "RFA Osstell o'lchovi (Ixtiyoriy)"),
      badge: activeTooth.isq 
        ? "bg-indigo-50 text-indigo-700 border-indigo-200 font-mono" 
        : "bg-slate-100 text-slate-500 font-semibold",
      icon: Sparkles
    },
    {
      num: 9,
      key: language === 'ru' ? "Тип кости (Плотность кости)" : "Suyak Turi (Bone Density)",
      val: safeRender(activeTooth.bone_type),
      sub: activeTooth.bone_type ? (language === 'ru' ? `Классификация по Мишу: ${activeTooth.bone_type}` : `Misch klassifikatsiyasi: ${activeTooth.bone_type}`) : (language === 'ru' ? 'Не указано' : 'Kiritilmagan'),
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      icon: Layers
    },
    {
      num: 10,
      key: language === 'ru' ? "Номер партии / Серия" : "Lot / Seriya Raqami",
      val: activeTooth.lot_number || (language === 'ru' ? "Не указан" : "Kiritilmagan"),
      sub: activeTooth.lot_number 
        ? (language === 'ru' ? "Заводской номер партии паспорта" : "Zavod pasport partiya raqami") 
        : (language === 'ru' ? "Заводской стикер партии не прикреплен" : "Zavod stikeri / lot raqami kiritilmagan"),
      badge: activeTooth.lot_number ? "bg-slate-900 text-white font-mono" : "bg-slate-100 text-slate-500 font-semibold",
      icon: Hash
    },
    {
      num: 11,
      key: language === 'ru' ? "Ответственный врач" : "Mas'ul Shifokor",
      val: safeRender(activeTooth.doctor),
      sub: language === 'ru' ? "Имплантолог, проводивший операцию" : "Operatsiyani bajargan implantolog",
      badge: "bg-teal-50 text-teal-700 border-teal-200",
      icon: UserRound
    },
    {
      num: 12,
      key: language === 'ru' ? "Контрольное напоминание (Recall)" : "Nazorat Eslatmasi (Recall)",
      val: activeTooth.reminder_date ? `${activeTooth.reminder_date} (${reminderInfo.text})` : (language === 'ru' ? 'Не назначено' : 'Belgilanmagan'),
      sub: activeTooth.reminder_months && activeTooth.reminder_months !== 'custom' ? (language === 'ru' ? `План на ${activeTooth.reminder_months} мес.` : `${activeTooth.reminder_months} oylik reja`) : (language === 'ru' ? 'Срок' : 'Muddati'),
      badge: reminderInfo.badge,
      icon: BellRing
    }
  ];

  return (
    <div className="space-y-4 pb-12 max-w-7xl mx-auto">
      
      {/* ─── Hero Clinical Passport Card & Unified Actions ─────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-4 sm:p-6 shadow-xs relative overflow-hidden space-y-4">
        
        {/* Top Header Row: Back Button + Patient Info + Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Left: Exit/Back + FDI Badge + Patient Details */}
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {/* Chiqish / Orqaga qaytish tugmasi */}
            <Link to="/implants">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-12 px-3 sm:h-14 sm:px-4 rounded-2xl border-slate-200 bg-slate-50/80 hover:bg-slate-100 hover:border-slate-300 text-slate-700 font-black text-xs gap-1.5 shrink-0 shadow-2xs transition-all cursor-pointer"
                title={language === 'ru' ? 'Назад к списку имплантов' : 'Implantlar ro\'yxatiga qaytish'}
              >
                <ArrowLeft className="w-4 h-4 text-[#1499AD]" />
                <span className="hidden sm:inline">{language === 'ru' ? 'Назад' : language === 'en' ? 'Back' : 'Orqaga'}</span>
              </Button>
            </Link>

            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center font-mono font-black shadow-md border-2 border-slate-700 shrink-0">
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">FDI</span>
              <span className="text-sm sm:text-base tracking-tight">
                {teethList.map(n => `#${toothIdToFdi(n)}`).join(' ') || '#—'}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                  {safeRender(activeTooth.patient_name)}
                </h1>
                
                <span className={cn(
                  "px-2.5 py-0.5 rounded-lg text-xs font-black uppercase tracking-wider border shadow-2xs",
                  LIFECYCLE_COLORS[displayStatus] || "bg-slate-100 text-slate-700"
                )}>
                  {language === 'ru' ? (displayStatus === "O'rnatildi" ? 'Установлено' : displayStatus === 'Rejalashtirilgan' ? 'Запланировано' : displayStatus === 'Healing jarayoni' ? 'Заживление' : displayStatus === "Abutment qo'yildi" ? 'Установлен абатмент' : displayStatus === 'Crown tayyor' ? 'Коронка готова' : displayStatus === 'Tugallangan' ? 'Завершено' : displayStatus === 'Failure' ? 'Неудача' : displayStatus) : displayStatus}
                </span>

                {displayStatus === 'Failure' && (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Muvaffaqiyatsiz (Failure)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-4 mt-1.5 text-xs font-semibold text-slate-500 flex-wrap">
                {activeTooth.patient_phone && (
                  <a 
                    href={`tel:${activeTooth.patient_phone}`}
                    className="flex items-center gap-1 text-emerald-600 hover:text-emerald-700 font-mono font-bold hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{activeTooth.patient_phone}</span>
                  </a>
                )}

                <div className="flex items-center gap-1 text-slate-600 font-mono">
                  <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                  <span>{safeRender(activeTooth.placement_date)}</span>
                </div>

                {activeTooth.doctor && (
                  <div className="flex items-center gap-1 text-slate-700 font-bold">
                    <UserRound className="w-3.5 h-3.5 text-[#1499AD]" />
                    <span>{activeTooth.doctor}</span>
                  </div>
                )}

                {activeTooth.patient_id && (
                  <Link 
                    to={`/patients/${activeTooth.patient_id}`}
                    className="flex items-center gap-1 text-[#1499AD] hover:underline font-bold"
                  >
                    <span>{language === 'ru' ? 'Профиль пациента' : 'Bemor profili'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
            

            <Button
              variant="outline"
              size="sm"
              onClick={exportPDF}
              className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 gap-1.5 cursor-pointer shadow-xs"
              title="PDF formatida yuklab olish"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>{language === 'ru' ? 'PDF Паспорт' : language === 'en' ? 'PDF Passport' : 'PDF Pasport'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="h-9 px-3.5 rounded-xl border-slate-200 text-xs font-black text-slate-800 bg-white hover:bg-slate-50 gap-1.5 cursor-pointer shadow-xs"
            >
              <Edit2 className="w-3.5 h-3.5 text-[#1499AD]" />
              <span>{language === 'ru' ? 'Редактировать' : language === 'en' ? 'Edit' : 'Tahrirlash'}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              className="h-9 w-9 p-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
              title={language === 'ru' ? 'Удалить' : "O'chirish"}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Key Summary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">{language === 'ru' ? 'ВСЕГО УСЛУГ' : language === 'en' ? 'TOTAL SERVICES' : 'JAMI XIZMATLAR'}</span>
            <span className="text-sm font-black font-mono text-emerald-600">{totalAllServicesPrice.toLocaleString()} {language === 'ru' ? 'UZS' : "so'm"}</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">{language === 'ru' ? 'ФИРМА / БРЕНД' : language === 'en' ? 'BRAND / COMPANY' : 'Firma / Brend'}</span>
            <span className="text-sm font-black text-slate-900 truncate block">{firmaNom}</span>
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200/70 shadow-2xs col-span-2 sm:col-span-1">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">{language === 'ru' ? 'ИЗМЕНИТЬ СТАТУС' : language === 'en' ? 'CHANGE STATUS' : "Holatni O'zgartirish"}</span>
            <Select 
              value={displayStatus} 
              onValueChange={updateStatus}
              disabled={statusUpdating}
            >
              <SelectTrigger className="h-7 px-2 text-[10px] font-black uppercase border-slate-200 bg-slate-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl text-xs font-bold">
                {["Rejalashtirilgan","O'rnatildi","Healing jarayoni","Abutment qo'yildi","Crown tayyor","Tugallangan","Failure"].map(s => (
                  <SelectItem key={s} value={s} className="uppercase text-[11px] font-black">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

      </div>

      {/* ─── Multi-Tooth Selection Tabs (if related teeth exist) ────── */}
      {relatedTeeth.length > 1 && (
        <div className="flex items-center gap-2 bg-white p-2.5 rounded-2xl border border-slate-200/90 shadow-xs overflow-x-auto">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider pl-2 shrink-0">
            {language === 'ru' ? 'Зубы в операции:' : 'Amaliyotdagi tishlar:'}
          </span>
          <div className="flex items-center gap-1.5">
            {relatedTeeth.map(r => {
              const isSel = (selectedRelatedTooth === r.id) || (!selectedRelatedTooth && r.id === implant.id);
              const rToothNum = (r.tooth_numbers || [r.tooth_number])[0];
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRelatedTooth(r.id)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl font-mono text-xs font-black transition-all cursor-pointer flex items-center gap-1.5",
                    isSel 
                      ? "bg-[#1499AD] text-white shadow-xs" 
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  <ImplantIcon className="w-3.5 h-3.5" />
                  <span>#{toothIdToFdi(rToothNum)}</span>
                  <span className="text-[10px] opacity-80">({r.firma || 'Dentium'})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── NEW: XIZMATLAR VA AMALIYOTLAR EXCEL JADVALI (Jarayon bosqichi o'rniga) ─── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center font-black">
                <TableIcon className="w-4 h-4 text-[#1499AD]" />
              </div>
              <h2 className="text-base font-black text-slate-900 tracking-tight">
                {language === 'ru' ? 'Реестр услуг и операций (Excel таблица)' : 'Xizmatlar & Amaliyotlar Reyestri (Excel jadvali)'}
              </h2>
            </div>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              {language === 'ru' ? 'Имплант, синус-лифтинг, металлокерамика, абатмент и все дополнительные услуги' : 'Implant, Sinus-lifting, Metallokeramika, Abutment va barcha qo\'shimcha xizmatlar yig\'indisi'}
            </p>
          </div>

          <Button
            onClick={handleOpenAddService}
            className="bg-[#00D084] hover:bg-[#00B875] text-white gap-1.5 rounded-xl h-9.5 px-4 font-black text-xs shadow-md shadow-[#00D084]/20 transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{language === 'ru' ? '+ Добавить услугу' : language === 'en' ? '+ Add Service' : '+ Yangi xizmat qo\'shish'}</span>
          </Button>
        </div>

        {/* The Exact Columns: № | Xizmatlar | Sana | Tish raqami | Firma nomi | Narxi | Amallar */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-2xs">
          <table className="w-full border-collapse text-left text-xs select-text">
            <thead>
              <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider sticky top-0">
                <th className="w-12 px-3 py-3 text-center border-r border-slate-200 font-mono">№</th>
                <th className="px-4 py-3 border-r border-slate-200 min-w-[200px]">{language === 'ru' ? 'Услуги' : 'Xizmatlar'}</th>
                <th className="w-32 px-3 py-3 border-r border-slate-200">{language === 'ru' ? 'Дата' : 'Sana'}</th>
                <th className="w-28 px-2.5 py-3 text-center border-r border-slate-200">{language === 'ru' ? 'Номер зуба' : 'Tish raqami'}</th>
                <th className="px-4 py-3 border-r border-slate-200 min-w-[150px]">{language === 'ru' ? 'Фирма / Бренд' : 'Firma nomi'}</th>
                <th className="w-36 px-4 py-3 text-right border-r border-slate-200 bg-emerald-50/40 text-emerald-900">{language === 'ru' ? 'Цена' : 'Narxi'}</th>
                <th className="w-24 px-2 py-3 text-center text-slate-500">{language === 'ru' ? 'Действия' : 'Amallar'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70">
              {allServices.map((svc, idx) => {
                const isPrimary = svc.is_primary === true;
                const priceVal = Number(svc.price) || 0;
                return (
                  <tr 
                    key={svc.id || idx} 
                    className={`hover:bg-[#1499AD]/5 transition-colors ${
                      idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                    }`}
                  >
                    {/* № */}
                    <td className="text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 py-2.5 px-3">
                      {idx + 1}
                    </td>

                    {/* Xizmatlar */}
                    <td className="border-r border-slate-200/70 py-2.5 px-4 font-black text-slate-900">
                      <div>
                        <span className="block font-black text-slate-900 text-xs">
                          {language === 'ru' ? (svc.service_name || '')
                            .replace(/Implant o'rnatish/gi, 'Установка импланта')
                            .replace(/Metallokeramika Karonka/gi, 'Металлокерамическая коронка')
                            .replace(/Zirkon Karonka/gi, 'Циркониевая коронка')
                            .replace(/E-Max Karonka/gi, 'Коронка E-Max')
                            .replace(/E-Max Press Karonka/gi, 'Коронка E-Max Press')
                            .replace(/Yopiq Sinus-lifting/gi, 'Закрытый синус-лифтинг')
                            .replace(/Ochiq Sinus-lifting/gi, 'Открытый синус-лифтинг')
                            .replace(/Suyak ekish/gi, 'Костная пластика')
                            .replace(/Membrana qo'yish/gi, 'Установка мембраны')
                            .replace(/Standart Abutment/gi, 'Стандартный абатмент')
                            .replace(/Individual Zirkon Abutment/gi, 'Индивидуальный циркониевый абатмент')
                            .replace(/Formik qo'yish/gi, 'Установка формирователя')
                            .replace(/Formik/gi, 'Формирователь')
                            .replace(/Boshqa xizmat/gi, 'Другая услуга')
                            : svc.service_name}
                        </span>
                        {svc.notes && (
                          <span className="text-[10px] font-semibold text-slate-400 block truncate">
                            {svc.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Sana */}
                    <td className="border-r border-slate-200/70 py-2.5 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                      {svc.date || '—'}
                    </td>

                    {/* Tish raqami */}
                    <td className="text-center border-r border-slate-200/70 py-2.5 px-2.5 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-xs font-mono font-black bg-slate-900 text-white shadow-xs">
                        #{toothIdToFdi(svc.tooth_number || activeToothNumberFdi)}
                      </span>
                    </td>

                    {/* Firma nomi */}
                    <td className="border-r border-slate-200/70 py-2.5 px-4 font-bold text-slate-800">
                      {svc.firma || firmaNom || '—'}
                    </td>

                    {/* Narxi */}
                    <td className="text-right border-r border-slate-200/70 py-2.5 px-4 font-mono font-black text-emerald-700 bg-emerald-50/20 whitespace-nowrap">
                      {priceVal.toLocaleString()} <span className="text-[10px] font-bold text-emerald-600/80 uppercase">{language === 'ru' ? 'UZS' : "so'm"}</span>
                    </td>

                    {/* Amallar */}
                    <td className="text-center py-2 px-2 whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        {isPrimary ? (
                          <button
                            onClick={() => setEditOpen(true)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#1499AD] hover:bg-slate-100 cursor-pointer transition-colors"
                            title={language === 'ru' ? 'Редактировать основную операцию' : "Asosiy amaliyotni tahrirlash"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDeleteService(svc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title={language === 'ru' ? 'Удалить услугу' : "Xizmatni o'chirish"}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Table Footer: Total Price Summary */}
        <div className="bg-slate-100/90 border border-slate-200 p-3.5 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600 font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>{language === 'ru' ? 'Всего операций и услуг:' : 'Jami amaliyotlar va xizmatlar soni:'}</span>
            <strong className="text-slate-900 font-mono text-sm">{allServices.length} {language === 'ru' ? '' : 'ta'}</strong>
          </div>

          <div className="flex items-center gap-2 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500">{language === 'ru' ? 'ОБЩАЯ СТОИМОСТЬ:' : 'JAMI QIYMAT (SUMMA):'}</span>
            <span className="font-mono font-black text-emerald-600 text-base">
              {totalAllServicesPrice.toLocaleString()} {language === 'ru' ? 'UZS' : "so'm"}
            </span>
          </div>
        </div>
      </div>

      {/* ─── Navigation Tabs Bar ─────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 overflow-x-auto scrollbar-none">
        {[
          { id: 'excel', label: language === 'ru' ? "📊 Клинический паспорт" : "📊 Klinik Pasport Parametrlari", count: excelSpecRows.length },
          { id: 'clinical', label: language === 'ru' ? "⚡ Стабильность (Torque / ISQ)" : "⚡ Barqarorlik (Torque / ISQ)", count: null },
          { id: 'docs', label: language === 'ru' ? "📷 Рентген и документы" : "📷 Rentgen & Pasport Hujjatlari", count: (activeTooth.xray_urls?.length || 0) + (activeTooth.passport_url ? 1 : 0) },
          { id: 'timeline', label: language === 'ru' ? "📜 История и аудит" : "📜 Tarix & Audit Log", count: (activeTooth.timeline || []).length },
        ].map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer",
                isActive 
                  ? "bg-white text-slate-900 shadow-xs" 
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              )}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span className={cn(
                  "px-1.5 py-0.2 rounded-full text-[10px] font-mono",
                  isActive ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600"
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Tab 1: Excel Spreadsheet Specification Grid ─────────────── */}
      {activeTab === 'excel' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden"
        >
          <div className="p-4 border-b border-slate-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                <TableIcon className="w-4 h-4 text-[#1499AD]" />
                <span>{language === 'ru' ? 'Паспорт импланта — Технические параметры' : 'Implant Pasporti — Texnik Parametrlar'}</span>
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-0.5">
                {language === 'ru' ? 'Все клинические, технические параметры и хирургические размеры' : 'Barcha klinik, texnik parametrlar va jarrohlik o\'lchamlari'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-[11px] font-black uppercase tracking-wider sticky top-0">
                  <th className="w-12 px-3 py-3 text-center border-r border-slate-200 font-mono">№</th>
                  <th className="w-64 px-4 py-3 border-r border-slate-200">{language === 'ru' ? 'Параметр / Показатель' : 'Parametr / Ko\'rsatkich'}</th>
                  <th className="px-4 py-3 border-r border-slate-200">{language === 'ru' ? 'Значение' : 'Qiymati'}</th>
                  <th className="w-72 px-4 py-3 border-r border-slate-200 hidden md:table-cell">{language === 'ru' ? 'Описание / Статус' : 'Tavsif / Holati'}</th>
                  <th className="w-24 px-3 py-3 text-center">{language === 'ru' ? 'Управление' : 'Boshqaruv'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {excelSpecRows.map((row, idx) => (
                  <tr 
                    key={row.key} 
                    className={`hover:bg-[#1499AD]/5 transition-colors ${
                      row.highlight ? 'bg-emerald-50/20' : (idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white')
                    }`}
                  >
                    {/* Index */}
                    <td className="text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 py-2.5 px-3">
                      {row.num}
                    </td>

                    {/* Parameter name */}
                    <td className="border-r border-slate-200/70 py-2.5 px-4 font-bold text-slate-700">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                          <row.icon className="w-3.5 h-3.5 text-slate-600" />
                        </div>
                        <span>{row.key}</span>
                      </div>
                    </td>

                    {/* Value */}
                    <td className="border-r border-slate-200/70 py-2.5 px-4">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-black border shadow-2xs",
                        row.badge
                      )}>
                        {row.val}
                      </span>
                    </td>

                    {/* Sub / Description */}
                    <td className="border-r border-slate-200/70 py-2.5 px-4 text-slate-500 font-semibold text-xs hidden md:table-cell">
                      {row.sub}
                    </td>

                    {/* Quick Edit */}
                    <td className="text-center py-2 px-2">
                      <button
                        onClick={() => setEditOpen(true)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-[#1499AD] hover:bg-slate-100 transition-all cursor-pointer"
                        title="Tahrirlash"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Doctor Notes Box */}
          {activeTooth.notes && (
            <div className="p-4 bg-amber-50/50 border-t border-amber-200/80 flex items-start gap-3">
              <span className="text-lg shrink-0">📝</span>
              <div className="text-xs">
                <span className="font-black text-amber-900 uppercase tracking-wider block mb-0.5">{language === 'ru' ? 'Заметки врача:' : 'Shifokor Qaydlari:'}</span>
                <p className="text-amber-800 font-semibold leading-relaxed">{activeTooth.notes}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Tab 2: Clinical Metrics & Indicators ───────────────────── */}
      {activeTab === 'clinical' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: 'Torque (Barqarorlik)',
                value: activeTooth.torque,
                unit: 'Ncm',
                icon: '⚡',
                color: 'amber',
                desc: 'Birlamchi mexanik fiksatsiya kuchi',
                status: activeTooth.torque ? (Number(activeTooth.torque) >= 35 ? 'Optimal (≥35 Ncm)' : 'Past') : null
              },
              {
                label: 'ISQ Ko\'rsatkichi',
                value: activeTooth.isq,
                unit: '',
                icon: '📡',
                color: 'indigo',
                desc: 'Rezonans-chastotali barqarorlik (RFA)',
                status: activeTooth.isq ? (Number(activeTooth.isq) >= 65 ? 'Optimal (≥65)' : 'Past') : null
              },
              {
                label: 'Diametri (Ø)',
                value: activeTooth.diameter,
                unit: 'mm',
                icon: '⭕',
                color: 'teal',
                desc: 'Implant platformasi kengligi',
                status: activeTooth.diameter ? 'Aniqlangan' : null
              },
              {
                label: 'Uzunligi (Length)',
                value: activeTooth.length,
                unit: 'mm',
                icon: '📏',
                color: 'blue',
                desc: 'Vertikal chuqurlik o\'lchami',
                status: activeTooth.length ? 'Aniqlangan' : null
              },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-2 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">{card.icon} {card.label}</span>
                    {card.status ? (
                      <span className="text-[9px] font-black px-2 py-0.5 rounded-md uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {card.status}
                      </span>
                    ) : (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-400">
                        {language === 'ru' ? 'Опция' : 'Ixtiyoriy'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1 mt-2">
                    {card.value ? (
                      <>
                        <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900 tracking-tight">
                          {card.value}
                        </span>
                        {card.unit && <span className="text-xs font-bold text-slate-400">{card.unit}</span>}
                      </>
                    ) : (
                      <span className="text-sm font-bold text-slate-400 italic">
                        {language === 'ru' ? 'Не измерено' : "O'lchanmagan"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-semibold text-slate-400 truncate mr-1">{card.desc}</p>
                  {!card.value && (
                    <button
                      onClick={() => setEditOpen(true)}
                      className="text-[10px] font-bold text-[#1499AD] hover:underline cursor-pointer shrink-0"
                    >
                      + {language === 'ru' ? 'Внести' : 'Kiritish'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Misch Bone Density & Quality Info */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
            <h4 className="text-xs font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <span>{language === 'ru' ? 'Структура и плотность кости (Классификация по Мишу)' : 'Suyak Tuzilishi & Zichligi (Misch Klassifikatsiyasi)'}</span>
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { type: 'D1', title: 'Dense Cortical', desc: 'Qattiq po\'stloq suyak, pastki oldingi qism', isCurrent: activeTooth.bone_type === 'D1' },
                { type: 'D2', title: 'Porous Cortical', desc: 'Zich kortikal va trabekulyar suyak', isCurrent: activeTooth.bone_type === 'D2' },
                { type: 'D3', title: 'Porous Fine', desc: 'Yupqa kortikal, g\'ovakli suyak', isCurrent: activeTooth.bone_type === 'D3' },
                { type: 'D4', title: 'Fine Trabecular', desc: 'Yumshoq suyak, yuqori jag\' orqa qismi', isCurrent: activeTooth.bone_type === 'D4' },
              ].map(b => (
                <div 
                  key={b.type} 
                  className={cn(
                    "p-3.5 rounded-xl border text-xs transition-all",
                    b.isCurrent 
                      ? "bg-amber-50 border-amber-300 ring-2 ring-amber-400/30" 
                      : "bg-slate-50 border-slate-200 opacity-60"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-black font-mono text-sm text-slate-900">{b.type}</span>
                    {b.isCurrent && <span className="text-[9px] font-black text-amber-700 uppercase bg-amber-200/60 px-1.5 py-0.2 rounded">{language === 'ru' ? 'Текущий' : 'Amaldagi'}</span>}
                  </div>
                  <p className="font-bold text-slate-800 text-[11px]">{b.title}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Tab 3: Documents & X-Rays ──────────────────────────────── */}
      {activeTab === 'docs' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-6"
        >
          <div>
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#1499AD]" />
              <span>{language === 'ru' ? 'Рентген-снимки и клинические документы' : 'Rentgen Suratlari & Klinik Hujjatlar'}</span>
            </h3>

            {/* Passport Document Scan */}
            {activeTooth.passport_url ? (
              <div className="mb-6 p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-xs font-black uppercase text-slate-700 block">{language === 'ru' ? 'Заводской паспорт / Штрих-код:' : 'Zavod Pasporti / Shtrix-kod:'}</span>
                <div 
                  className="w-48 aspect-[4/3] rounded-xl overflow-hidden border border-slate-300 shadow-xs cursor-pointer relative group"
                  onClick={() => setZoomImg(activeTooth.passport_url)}
                >
                  <img src={activeTooth.passport_url} alt="Passport" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <FileText className="w-4 h-4" /> {language === 'ru' ? 'Просмотр' : 'Ko\'rish'}
                  </div>
                </div>
              </div>
            ) : null}

            {/* X-Ray Photos Grid */}
            {activeTooth.xray_urls?.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {activeTooth.xray_urls.map((url, idx) => (
                  <div 
                    key={idx}
                    className="aspect-square rounded-2xl overflow-hidden border border-slate-200 shadow-xs cursor-pointer relative group"
                    onClick={() => setZoomImg(url)}
                  >
                    <img src={url} alt={`Xray-${idx}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                      <Camera className="w-4 h-4" /> {language === 'ru' ? 'Увеличить' : 'Kattalashtirish'}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Camera className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-400">{language === 'ru' ? 'Рентген-снимки не прикреплены' : 'Rentgen suratlari biriktirilmagan'}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setEditOpen(true)}
                  className="mt-3 text-xs font-black rounded-xl border-slate-300"
                >
                  {language === 'ru' ? 'Прикрепить снимок' : 'Rasm biriktirish'}
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ─── Tab 4: Timeline & Audit Log ────────────────────────────── */}
      {activeTab === 'timeline' && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#1499AD]" />
              <span>{language === 'ru' ? 'История операций и аудит' : 'Amaliyot Tarixi & Audit Log'}</span>
            </h3>
            <span className="text-xs font-mono font-bold text-slate-400">{(activeTooth.timeline || []).length} {language === 'ru' ? 'записей' : 'ta yozuv'}</span>
          </div>

          {(!activeTooth.timeline || activeTooth.timeline.length === 0) ? (
            <div className="py-10 text-center text-slate-400 text-xs font-bold">
              {language === 'ru' ? 'История пока отсутствует' : 'Hozircha tarix mavjud emas'}
            </div>
          ) : (
            <div className="space-y-3 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {[...activeTooth.timeline].reverse().map((item, idx) => (
                <div key={idx} className="relative flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full bg-[#1499AD] ring-4 ring-white shrink-0 mt-1" />
                  <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200/80 text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-black text-slate-900 uppercase">{item.status}</span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold">{new Date(item.date).toLocaleString('uz-UZ')}</span>
                    </div>
                    {item.note && <p className="text-slate-600 font-semibold">{item.note}</p>}
                    {item.user && <span className="text-[10px] text-[#1499AD] font-bold mt-1 block">{language === 'ru' ? 'Сотрудник: ' : 'Xodim: '}{item.user}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ─── Xray Zoom Lightbox Dialog ──────────────────────────────── */}
      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-3xl p-2 rounded-2xl overflow-hidden bg-black/90 border-0">
          <img src={zoomImg} alt="Zoom" className="w-full h-auto max-h-[85vh] object-contain rounded-xl" />
        </DialogContent>
      </Dialog>

      {/* ─── NEW: XIZMAT QO'SHISH PROFESSIONAL MODAL ────────────────── */}
      <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-6 border-slate-200 shadow-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              {language === 'ru' ? 'Добавить услугу и операцию' : 'Yangi Xizmat & Amaliyot Qo\'shish'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            
            {/* Quick Presets Grid */}
            <div>
              <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">
                {language === 'ru' ? 'БЫСТРЫЙ ВЫБОР УСЛУГИ:' : 'Tezkor Xizmat Tanlash:'}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PRESET_SERVICES.map(p => {
                  const isSelected = serviceForm.service_name === p.name;
                  return (
                    <button
                      key={p.name}
                      type="button"
                      onClick={() => handleSelectPreset(p)}
                      className={cn(
                        "p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between select-none",
                        isSelected 
                          ? "border-teal-500 bg-teal-50/70 ring-1 ring-teal-400 shadow-2xs" 
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100/80"
                      )}
                    >
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {language === 'ru' ? (p.label || '')
                          .replace(/Metallokeramika Karonka/gi, 'Металлокерамика')
                          .replace(/Zirkon Karonka/gi, 'Циркон коронка')
                          .replace(/E-Max Press Karonka/gi, 'E-Max коронка')
                          .replace(/Yopiq Sinus-lifting/gi, 'Закрытый синус-лифтинг')
                          .replace(/Ochiq Sinus-lifting/gi, 'Открытый синус-лифтинг')
                          .replace(/Suyak ekish \(Bone graft\)/gi, 'Костная пластика')
                          .replace(/Membrana qo'yish/gi, 'Мембрана')
                          .replace(/Standart Abutment/gi, 'Стандартный абатмент')
                          .replace(/Individual Zirkon Abutment/gi, 'Индивидуальный циркон')
                          .replace(/Formik \(Healing Abutment\)/gi, 'Формирователь десны')
                          .replace(/Boshqa amaliyot/gi, 'Другая услуга')
                          : p.label}
                      </span>
                      <span className="text-[10px] font-mono font-black text-emerald-700 mt-1">
                        {p.defaultPrice.toLocaleString()} {language === 'ru' ? 'UZS' : "so'm"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Inputs */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              
              {/* Xizmat nomi */}
              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1 block">{language === 'ru' ? 'Название услуги' : 'Xizmat Nomi'}</Label>
                <Input
                  value={serviceForm.service_name}
                  onChange={e => setServiceForm(prev => ({ ...prev, service_name: e.target.value }))}
                  placeholder="Masalan: Metallokeramika Karonka yoki Sinus-lifting"
                  className="h-10 rounded-xl border-slate-200 font-bold text-xs"
                />
              </div>

              {/* Sana & Tish raqami */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">{language === 'ru' ? 'Дата операции' : 'Amaliyot Sanasi'}</Label>
                  <Input
                    type="date"
                    value={serviceForm.date}
                    onChange={e => setServiceForm(prev => ({ ...prev, date: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 font-bold text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">{language === 'ru' ? 'Номер зуба (FDI)' : 'Tish Raqami (FDI)'}</Label>
                  <Input
                    value={serviceForm.tooth_number}
                    onChange={e => setServiceForm(prev => ({ ...prev, tooth_number: e.target.value }))}
                    placeholder="21"
                    className="h-10 rounded-xl border-slate-200 font-mono font-bold text-xs"
                  />
                </div>
              </div>

              {/* Firma & Narxi */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">{language === 'ru' ? 'Фирма / Бренд / Лаборатория' : 'Firma / Brend / Lab'}</Label>
                  <Input
                    value={serviceForm.firma}
                    onChange={e => setServiceForm(prev => ({ ...prev, firma: e.target.value }))}
                    placeholder="Masalan: Dentium, Osstem yoki Zirkon Lab"
                    className="h-10 rounded-xl border-slate-200 font-bold text-xs"
                  />
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700 mb-1 block">{language === 'ru' ? 'Цена (UZS)' : 'Narxi (so\'m)'}</Label>
                  <Input
                    type="number"
                    value={serviceForm.price}
                    onChange={e => setServiceForm(prev => ({ ...prev, price: e.target.value }))}
                    className="h-10 rounded-xl border-slate-200 font-mono font-black text-emerald-700 text-xs"
                  />
                </div>
              </div>

              {/* Izoh */}
              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1 block">{language === 'ru' ? 'Заметки врача / Комментарий' : 'Izoh / Shifokor Qaydlari'}</Label>
                <Textarea
                  value={serviceForm.notes}
                  onChange={e => setServiceForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Material, laboratoriya topshirilgan sana yoki qo'shimcha tafsilotlar..."
                  rows={2}
                  className="rounded-xl border-slate-200 text-xs font-semibold"
                />
              </div>

            </div>

            {/* Total Highlight */}
            <div className="bg-emerald-50/80 p-3 rounded-2xl border border-emerald-200 flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-900">{language === 'ru' ? 'УСТАНОВЛЕННАЯ ЦЕНА:' : 'Belgilangan Narx:'}</span>
              <span className="text-base font-black font-mono text-emerald-700">
                {(Number(serviceForm.price) || 0).toLocaleString()} {language === 'ru' ? 'UZS' : "so'm"}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setServiceModalOpen(false)}
                className="rounded-xl text-xs font-bold h-9.5 px-4"
              >
                {language === 'ru' ? 'Отмена' : 'Bekor qilish'}
              </Button>
              <Button 
                onClick={handleSaveNewService}
                className="bg-[#00D084] hover:bg-[#00B875] text-white font-black text-xs rounded-xl h-9.5 px-5 cursor-pointer shadow-md shadow-[#00D084]/20"
              >
                {language === 'ru' ? '+ Сохранить услугу' : '+ Xizmatni Saqlash'}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────── */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900">O'chirishni tasdiqlaysizmi?</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-500 leading-relaxed">
            Ushbu implant va unga tegishli barcha jarrohlik ma'lumotlari o'chiriladi. Ushbu amalni ortga qaytarib bo'lmaydi.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(false)} className="rounded-xl text-xs font-bold">
              Bekor qilish
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                try {
                  await base44.entities.Implant.delete(id);
                  toast.success("Implant o'chirildi!");
                  navigate('/implants');
                } catch (e) {
                  console.error(e);
                  toast.error("O'chirishda xatolik");
                }
              }}
              className="rounded-xl text-xs font-black"
            >
              Ha, o'chirilsin
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Full Edit Form Modal ────────────────────────────────────── */}
      <ImplantForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patients={patients}
        services={[]}
        implant={activeTooth}
        relatedImplants={relatedTeeth.length > 0 ? relatedTeeth : [activeTooth]}
        onSaved={() => load()}
      />

    </div>
  );
}

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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/LanguageContext';
import { useClinic } from '@/lib/ClinicContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ImplantForm from '../components/implants/ImplantForm';
import ClinicalStepper, {
  LIFECYCLE_COLORS,
  normalizeLifecycleStatus,
  SHORT_STATUS_LABEL,
} from '../components/implants/ClinicalStepper';
import {
  ImplantSwitcher,
  PassportSpecsCard,
  MiniFdiChart,
  StageMediaRail,
  ClinicalTimeline,
  LinkedServicesCard,
} from '../components/implants/ClinicalPassportCards';
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
      
      if (currentImplant?.patient_id) {
        try {
          const related = await base44.entities.Implant.filter({
            patient_id: currentImplant.patient_id
          });
          const uniqueRelated = Array.from(new Map((related || []).map(item => [item.id, item])).values())
            .sort((a, b) => String(a.placement_date || '').localeCompare(String(b.placement_date || '')));
          setRelatedTeeth(uniqueRelated);
          // Keep selection on current route implant
          setSelectedRelatedTooth(currentImplant.id);
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

  useEffect(() => { setSelectedRelatedTooth(id || null); }, [id]);

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
    return normalizeLifecycleStatus(s);
  };

  const displayStatus = getCurrentStatus();

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
    <div className="space-y-3 pb-12 max-w-7xl mx-auto">

      {/* ─── Header: patient + actions ─────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl p-3 sm:p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Link to="/implants">
              <Button
                variant="outline"
                size="sm"
                className="h-11 px-3 rounded-2xl border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-700 font-black text-xs gap-1.5 shrink-0"
                title={language === 'ru' ? 'Назад к списку имплантов' : "Implantlar ro'yxatiga qaytish"}
              >
                <ArrowLeft className="w-4 h-4 text-teal-600" />
                <span className="hidden sm:inline">{language === 'ru' ? 'Назад' : 'Orqaga'}</span>
              </Button>
            </Link>

            <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex flex-col items-center justify-center font-mono font-black shrink-0">
              <span className="text-[8px] text-slate-400 uppercase">FDI</span>
              <span className="text-sm">#{activeToothNumberFdi}</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">
                  {safeRender(activeTooth.patient_name)}
                </h1>
                <span className={cn(
                  "px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border",
                  LIFECYCLE_COLORS[displayStatus] || "bg-slate-100 text-slate-700"
                )}>
                  {SHORT_STATUS_LABEL[displayStatus] || displayStatus}
                </span>
                {relatedTeeth.length > 1 && (
                  <span className="text-[11px] font-bold text-slate-400">
                    — Implant case ({relatedTeeth.length} ta implant)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs font-semibold text-slate-500 flex-wrap">
                <span className="font-bold text-slate-700">
                  {(activeTooth.brend || firmaNom)}
                  {(activeTooth.diameter || activeTooth.length) ? ` · Ø${activeTooth.diameter || '—'}×${activeTooth.length || '—'}` : ''}
                </span>
                {activeTooth.patient_phone && (
                  <a href={`tel:${activeTooth.patient_phone}`} className="flex items-center gap-1 text-emerald-600 font-mono font-bold hover:underline">
                    <Phone className="w-3.5 h-3.5" />{activeTooth.patient_phone}
                  </a>
                )}
                {activeTooth.doctor && (
                  <span className="flex items-center gap-1 font-bold text-slate-700">
                    <UserRound className="w-3.5 h-3.5 text-teal-600" />{activeTooth.doctor}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap self-end lg:self-center">
            <Button
              variant="outline"
              size="sm"
              onClick={exportPDF}
              className="h-9 px-3 rounded-xl border-slate-200 text-xs font-bold text-slate-700 gap-1.5"
            >
              <Download className="w-4 h-4 text-indigo-600" />
              <span>{language === 'ru' ? 'PDF Паспорт' : 'PDF Pasport'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditOpen(true)}
              className="h-9 px-3.5 rounded-xl border-slate-200 text-xs font-black text-slate-800 gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5 text-teal-600" />
              <span>{language === 'ru' ? 'Редактировать' : 'Tahrirlash'}</span>
            </Button>
            {activeTooth.patient_id && (
              <Link to={`/patients/${activeTooth.patient_id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 rounded-xl border-teal-200 text-xs font-black text-teal-800 bg-teal-50/50 gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{language === 'ru' ? 'Профиль пациента' : 'Bemor profili'}</span>
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirm(true)}
              className="h-9 w-9 p-0 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50"
              title={language === 'ru' ? 'Удалить' : "O'chirish"}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
</div>

      {/* ─── Clinical Stepper ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-3xl px-3 sm:px-5 py-3 shadow-sm">
        <ClinicalStepper status={activeTooth.lifecycle_status || activeTooth.status || displayStatus} language={language} />
      </div>

      {/* ─── Body: optional left switcher + passport grid ─────────── */}
      <div className={cn(
        "grid gap-4",
        relatedTeeth.length > 1 ? "lg:grid-cols-[260px_1fr]" : "grid-cols-1"
      )}>
        {relatedTeeth.length > 1 && (
          <div className="bg-white border border-slate-200/90 rounded-3xl p-3 sm:p-4 shadow-sm h-fit lg:sticky lg:top-4">
            <ImplantSwitcher
              implants={relatedTeeth}
              selectedId={activeTooth.id}
              onSelect={(rid) => {
                setSelectedRelatedTooth(rid);
                if (rid && rid !== id) {
                  // Stay on page but switch active tooth; also sync URL softly
                  navigate(`/implants/${rid}`, { replace: true });
                }
              }}
              language={language}
            />
          </div>
        )}

        <div className="space-y-4 min-w-0">
          {/* Top row: Passport | Tooth chart | Media */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <PassportSpecsCard implant={activeTooth} language={language} />

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                <ImplantIcon className="w-4 h-4 text-teal-600" />
                {language === 'ru' ? 'Место зуба (FDI)' : 'Tish joyi (FDI)'}
              </h3>
              <MiniFdiChart activeFdis={teethList.map(toothIdToFdi)} />
              <p className="text-center text-xs font-black text-teal-700 mt-3">
                #{activeToothNumberFdi} · {firmaNom}
              </p>
            </div>

            <div className="md:col-span-2 xl:col-span-1">
              <StageMediaRail
                implant={activeTooth}
                language={language}
                onZoom={setZoomImg}
                onOpenPassport={exportPDF}
              />
            </div>
          </div>

          {/* Bottom row: Timeline | Services (demoted) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ClinicalTimeline implant={activeTooth} language={language} />
            <LinkedServicesCard
              services={allServices}
              total={totalAllServicesPrice}
              language={language}
              onAdd={handleOpenAddService}
              onDelete={handleDeleteService}
              onEditPrimary={() => setEditOpen(true)}
            />
          </div>

          {/* Secondary: detailed tabs (kept, collapsed priority) */}
          <div className="bg-slate-50/80 border border-slate-200/80 rounded-3xl p-3 sm:p-4 space-y-3">
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              {[
                { id: 'excel', label: language === 'ru' ? 'Параметры' : 'Parametrlar', count: excelSpecRows.length },
                { id: 'clinical', label: 'Torque / ISQ', count: null },
                { id: 'docs', label: language === 'ru' ? 'Документы' : 'Hujjatlar', count: (activeTooth.xray_urls?.length || 0) + (activeTooth.passport_url ? 1 : 0) },
                { id: 'timeline', label: language === 'ru' ? 'Аудит' : 'Audit', count: (activeTooth.timeline || []).length },
              ].map(tab => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition-all cursor-pointer",
                      isActive ? "bg-white text-slate-900 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-800"
                    )}
                  >
                    <span>{tab.label}</span>
                    {tab.count !== null && (
                      <span className={cn("px-1.5 rounded-full text-[10px] font-mono", isActive ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-600")}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {activeTab === 'excel' && (
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-700 text-[11px] font-black uppercase">
                        <th className="w-10 px-3 py-2.5 text-center">№</th>
                        <th className="px-3 py-2.5">Parametr</th>
                        <th className="px-3 py-2.5">Qiymat</th>
                        <th className="px-3 py-2.5 hidden md:table-cell">Izoh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {excelSpecRows.map((row) => (
                        <tr key={row.key} className={row.highlight ? 'bg-slate-50/80' : ''}>
                          <td className="text-center font-mono text-slate-400 py-2 px-3">{row.num}</td>
                          <td className="py-2 px-3 font-bold text-slate-700">{row.key}</td>
                          <td className="py-2 px-3">
                            <span className={cn("inline-flex px-2 py-0.5 rounded-lg text-xs font-black border", row.badge)}>{row.val}</span>
                          </td>
                          <td className="py-2 px-3 text-slate-500 hidden md:table-cell">{row.sub}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {activeTooth.notes && (
                  <div className="p-3 bg-amber-50/50 border-t border-amber-100 text-xs">
                    <span className="font-black text-amber-900">Qayd: </span>
                    <span className="text-amber-800 font-semibold">{activeTooth.notes}</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'clinical' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: 'Torque', value: activeTooth.torque, unit: 'Ncm' },
                  { label: 'ISQ', value: activeTooth.isq, unit: '' },
                  { label: 'Ø', value: activeTooth.diameter, unit: 'mm' },
                  { label: 'L', value: activeTooth.length, unit: 'mm' },
                ].map(card => (
                  <div key={card.label} className="bg-white rounded-2xl p-4 border border-slate-200">
                    <div className="text-[10px] font-black uppercase text-slate-400">{card.label}</div>
                    <div className="mt-1 flex items-baseline gap-1">
                      {card.value ? (
                        <>
                          <span className="text-2xl font-black font-mono text-slate-900">{card.value}</span>
                          {card.unit && <span className="text-xs font-bold text-slate-400">{card.unit}</span>}
                        </>
                      ) : (
                        <span className="text-sm font-bold text-slate-400 italic">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'docs' && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3">
                {activeTooth.passport_url && (
                  <div
                    className="w-40 aspect-[4/3] rounded-xl overflow-hidden border cursor-pointer"
                    onClick={() => setZoomImg(activeTooth.passport_url)}
                  >
                    <img src={activeTooth.passport_url} alt="Passport" className="w-full h-full object-cover" />
                  </div>
                )}
                {activeTooth.xray_urls?.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {activeTooth.xray_urls.map((url, idx) => (
                      <div key={idx} className="aspect-square rounded-xl overflow-hidden border cursor-pointer" onClick={() => setZoomImg(url)}>
                        <img src={url} alt={`Xray-${idx}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-bold text-slate-400 text-center py-6">Rentgen biriktirilmagan</p>
                )}
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="bg-white rounded-2xl p-4 border border-slate-200">
                {(!activeTooth.timeline || activeTooth.timeline.length === 0) ? (
                  <p className="text-xs font-bold text-slate-400 text-center py-6">Audit bo&apos;sh</p>
                ) : (
                  <div className="space-y-2">
                    {[...activeTooth.timeline].reverse().map((item, idx) => (
                      <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs">
                        <div className="flex justify-between gap-2 mb-0.5">
                          <span className="font-black uppercase">{item.status}</span>
                          <span className="font-mono text-slate-400">{new Date(item.date).toLocaleString('uz-UZ')}</span>
                        </div>
                        {item.note && <p className="text-slate-600 font-semibold">{item.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>


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

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { uploadImage } from '@/utils/imageUpload';
import { cn } from '@/lib/utils';
import ImplantForm from '../components/implants/ImplantForm';
import ClinicalStepper, {
  LIFECYCLE_COLORS,
  normalizeLifecycleStatus,
  SHORT_STATUS_LABEL,
} from '../components/implants/ClinicalStepper';
import {
  PassportSpecsCard,
  MiniFdiChart,
  StageMediaRail,
  ClinicalTimeline,
  LinkedServicesCard,
  DentalArchFdi,
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

  // Milestone Dialog State
  const [uploadingSlot, setUploadingSlot] = useState(null);
  const [addMilestoneOpen, setAddMilestoneOpen] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    status: 'Integratsiya bosqichi',
    date: new Date().toISOString().split('T')[0],
    note: '',
    doctor: ''
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

  // Build case teeth items for left rail switcher (placed before early returns for React Rules of Hooks)
  // Prefer expanding the CURRENT multi-tooth case over dumping all patient-related implants
  // (relatedTeeth > 1 previously hid per-tooth FDI labels and made both chips show #11).
  const switcherItems = useMemo(() => {
    const cur = implant;
    if (!cur) return [];

    const expandMultiTooth = (rec) => {
      const teeth = rec.tooth_numbers || (rec.tooth_number ? [rec.tooth_number] : (rec.tooth_id ? [rec.tooth_id] : []));
      const uniqueTeeth = [...new Set(teeth.map(String))].filter(Boolean);
      if (uniqueTeeth.length <= 1) return null;
      return uniqueTeeth.map((tId) => {
        const match = String(tId).match(/^(ur|ul|lr|ll)(\d+)$/);
        const fdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : String(tId);
        const tData = rec.tooth_data_map?.[tId] || rec.tooth_data_map?.[fdi] || {};
        const toothTimeline = Array.isArray(tData.timeline) ? tData.timeline : null;
        return {
          ...rec,
          id: `${rec.id}__${tId}`,
          syntheticToothKey: tId,
          tooth_id: tId,
          tooth_number: fdi,
          tooth_numbers: [tId],
          firma: tData.firma || rec.firma,
          firma_custom: tData.firma_custom || rec.firma_custom,
          brend: tData.brend || rec.brend,
          diameter: tData.diameter != null && tData.diameter !== '' ? tData.diameter : rec.diameter,
          length: tData.length != null && tData.length !== '' ? tData.length : rec.length,
          lot_number: tData.lot_number != null && tData.lot_number !== '' ? tData.lot_number : rec.lot_number,
          torque: tData.torque != null && tData.torque !== '' ? tData.torque : rec.torque,
          isq: tData.isq != null && tData.isq !== '' ? tData.isq : rec.isq,
          bone_type: tData.bone_type || rec.bone_type,
          price: (tData.price != null && tData.price !== '') ? tData.price : rec.price,
          narxi: (tData.price != null && tData.price !== '') ? tData.price : (rec.narxi || rec.price),
          service_name: tData.service_name || rec.service_name,
          lifecycle_status: tData.lifecycle_status || rec.lifecycle_status,
          status: tData.lifecycle_status || rec.status || rec.lifecycle_status,
          timeline: toothTimeline && toothTimeline.length > 0 ? toothTimeline : (rec.timeline || []),
        };
      });
    };

    const currentExpanded = expandMultiTooth(cur);
    if (currentExpanded) return currentExpanded;

    if (relatedTeeth.length > 1) {
      return relatedTeeth.flatMap((rec) => {
        const expanded = expandMultiTooth(rec);
        if (expanded) return expanded;
        const key = rec.tooth_id || (Array.isArray(rec.tooth_numbers) && rec.tooth_numbers[0]) || rec.tooth_number;
        const match = key ? String(key).match(/^(ur|ul|lr|ll)(\d+)$/) : null;
        const fdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : (key ? String(key) : null);
        return [{
          ...rec,
          tooth_id: key || rec.tooth_id,
          tooth_number: fdi || rec.tooth_number,
          tooth_numbers: key ? [key] : (rec.tooth_numbers || (rec.tooth_number ? [rec.tooth_number] : [])),
        }];
      });
    }

    return [cur];
  }, [relatedTeeth, implant]);

  // Active tooth selection with resolution of tooth_data_map properties
  const activeTooth = useMemo(() => {
    let raw = null;
    if (selectedRelatedTooth) {
      raw = switcherItems.find(r => r.id === selectedRelatedTooth) || relatedTeeth.find(r => r.id === selectedRelatedTooth);
    }
    if (!raw) raw = switcherItems[0] || implant;
    if (!raw) return null;

    // Check if raw has tooth_data_map for its active tooth
    const rawTeeth = raw.tooth_numbers || (raw.tooth_number ? [raw.tooth_number] : []);
    const toothKey = raw.syntheticToothKey || rawTeeth[0];
    const match = toothKey ? String(toothKey).match(/^(ur|ul|lr|ll)(\d+)$/) : null;
    const toothFdi = match ? ({ ur: '1', ul: '2', ll: '3', lr: '4' }[match[1]] + match[2]) : toothKey;
    const toothData = (raw.tooth_data_map?.[toothKey] || raw.tooth_data_map?.[toothFdi]) || {};

    const pick = (mapVal, rawVal) => {
      if (mapVal != null && String(mapVal).trim() !== '') return String(mapVal).trim();
      if (rawVal != null && String(rawVal).trim() !== '') return String(rawVal).trim();
      return '';
    };

    return {
      ...raw,
      // ALWAYS prefer selected tooth's tooth_data_map entry over shared top-level fields
      diameter: pick(toothData.diameter, raw.diameter),
      length: pick(toothData.length, raw.length),
      lot_number: pick(toothData.lot_number, raw.lot_number),
      torque: pick(toothData.torque, raw.torque),
      isq: pick(toothData.isq, raw.isq),
      bone_type: pick(toothData.bone_type, raw.bone_type) || '',
      firma: pick(toothData.firma, raw.firma) || '',
      firma_custom: pick(toothData.firma_custom, raw.firma_custom) || '',
      brend: pick(toothData.brend, raw.brend) || '',
      price: (toothData.price != null && toothData.price !== '')
        ? toothData.price
        : (raw.price || raw.narxi || ''),
      service_name: pick(toothData.service_name, raw.service_name) || raw.hizmat_turi || '',
      lifecycle_status: pick(toothData.lifecycle_status, raw.lifecycle_status || raw.status) || raw.lifecycle_status,
      status: pick(toothData.lifecycle_status, raw.status || raw.lifecycle_status) || raw.status,
      timeline: (Array.isArray(toothData.timeline) && toothData.timeline.length > 0)
        ? toothData.timeline
        : (raw.timeline || []),
      xray_urls: (Array.isArray(toothData.xray_urls) && toothData.xray_urls.length > 0)
        ? toothData.xray_urls
        : (raw.xray_urls || implant?.xray_urls || []),
      stage_media: (toothData.stage_media && typeof toothData.stage_media === 'object')
        ? toothData.stage_media
        : (raw.stage_media || implant?.stage_media || null),
      passport_url: toothData.passport_url || raw.passport_url || implant?.passport_url || null,
      tooth_number: toothFdi || raw.tooth_number,
      tooth_numbers: toothKey ? [toothKey] : rawTeeth,
      syntheticToothKey: raw.syntheticToothKey || toothKey || null,
    };
  }, [selectedRelatedTooth, switcherItems, relatedTeeth, implant]);

  // Always use the real DB ID for Supabase updates.
  // Synthetic teeth have id="realDbId__toothKey" — never use these as update targets.
  const realImplantId = useMemo(() => {
    if (!activeTooth) return implant?.id || null;
    if (activeTooth.syntheticToothKey) return implant?.id || String(activeTooth.id).split('__')[0];
    return activeTooth.id;
  }, [activeTooth, implant]);

  if (loading) return (
    <div className="space-y-4 max-w-6xl mx-auto pb-10">
      <div className="h-14 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-44 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-64 bg-slate-100 rounded-2xl animate-pulse" />
      <div className="h-96 bg-slate-100 rounded-2xl animate-pulse" />
    </div>
  );

  if (!implant || !activeTooth) return (
    <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-slate-200 max-w-2xl mx-auto my-12 text-center p-8">
      <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8" />
      </div>
      <h2 className="text-xl font-black text-slate-900 mb-2">{t('implants.notFound') || "Implant ma'lumoti topilmadi"}</h2>
      <p className="text-sm text-slate-500 mb-6">Ushbu yozuv o'chirilgan yoki mavjud emas bo'lishi mumkin.</p>
      <Link to="/implants">
        <Button className="rounded-xl font-black gap-2 bg-[#14b8a6] hover:bg-[#0d9488] text-white">
          <ArrowLeft className="w-4 h-4" /> Implantlar ro'yxatiga qaytish
        </Button>
      </Link>
    </div>
  );

  const rawTeeth = (activeTooth?.tooth_numbers || (activeTooth?.tooth_number ? [activeTooth.tooth_number] : []));
  const teethList = [...new Set(rawTeeth.map(String))];
  const activeToothNumberFdi = teethList.length > 0 ? toothIdToFdi(teethList[0]) : '21';

  const firmaNom = (activeTooth?.firma === 'Boshqa' ? (activeTooth?.firma_custom || 'Boshqa') : activeTooth?.firma) || 'Dentium';
  const priceNum = Number(activeTooth?.price) || Number(activeTooth?.narxi) || 1500000;
  const primaryServiceName = activeTooth?.service_name || activeTooth?.hizmat_turi || 'Implant o\'rnatish';

  // Normalize current status for UI
  const getCurrentStatus = () => {
    const s = activeTooth?.lifecycle_status || activeTooth?.status;
    return normalizeLifecycleStatus(s);
  };

  const displayStatus = getCurrentStatus();

  // Build the unified list of services for this tooth/implant
  const baseServiceRow = {
    id: 'primary-implant',
    is_primary: true,
    service_name: primaryServiceName,
    date: activeTooth?.placement_date || new Date().toISOString().split('T')[0],
    tooth_number: activeToothNumberFdi,
    firma: firmaNom,
    price: priceNum,
    notes: activeTooth?.brend ? `${activeTooth.brend} (Asosiy amaliyot)` : 'Asosiy implantatsiya'
  };

  const customServicesList = Array.isArray(activeTooth?.services_list) ? activeTooth.services_list : [];
  
  // Legacy crown fallback if present and not in list
  const hasCrownInList = customServicesList.some(s => (s.service_name || '').toLowerCase().includes('karonka') || (s.service_name || '').toLowerCase().includes('crown') || (s.service_name || '').toLowerCase().includes('keramika') || (s.service_name || '').toLowerCase().includes('zirkon'));
  const legacyCrownRows = (!hasCrownInList && activeTooth?.crown_type) ? [{
    id: 'legacy-crown',
    service_name: `${activeTooth.crown_type} Karonka`,
    date: activeTooth?.placement_date || new Date().toISOString().split('T')[0],
    tooth_number: activeToothNumberFdi,
    firma: firmaNom,
    price: Number(activeTooth.crown_price) || (activeTooth.crown_type === 'Metallokeramika' ? 800000 : 1500000),
    notes: `${activeTooth.crown_quantity || 1} dona karonka`
  }] : [];

  const allServices = [baseServiceRow, ...customServicesList, ...legacyCrownRows];
  const totalAllServicesPrice = allServices.reduce((acc, curr) => acc + (Number(curr.price) || 0), 0);

  const counts = (() => {
    const list = switcherItems.length > 0 ? switcherItems : (implant ? [implant] : []);
    const c = { total: list.length, healing: 0, crown: 0 };
    list.forEach((imp) => {
      const s = normalizeLifecycleStatus(imp.lifecycle_status || imp.status);
      if (s === 'Healing jarayoni' || s === 'Integratsiya') c.healing += 1;
      if (s === 'Crown tayyor' || s === 'Tugallangan' || s === 'Protez') c.crown += 1;
    });
    return c;
  })();

  const caseFdis = (() => {
    const list = switcherItems.length > 0 ? switcherItems : (activeTooth ? [activeTooth] : []);
    const all = list.flatMap((it) => {
      const raw = it.tooth_numbers || (it.tooth_number ? [it.tooth_number] : []);
      return raw.map(toothIdToFdi);
    });
    return [...new Set(all.filter(Boolean))];
  })();

  const handleStagePhotoUpload = async ({ slotKey, slotIndex, file }) => {
    if (!realImplantId || !file) return;
    setUploadingSlot(slotKey);
    try {
      const result = await uploadImage(file, {
        maxSizeMB: 8,
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.75,
      });
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Upload failed');
      }

      const existing = Array.isArray(implant?.xray_urls) ? [...implant.xray_urls] : [];
      // Normalize to fixed 4-slot string array aligned with MEDIA_LABELS indices
      const nextUrls = [0, 1, 2, 3].map((i) => {
        const cur = existing[i];
        if (i === slotIndex) return result.data;
        if (typeof cur === 'string') return cur || null;
        if (cur && typeof cur === 'object' && cur.url) return cur.url;
        return null;
      });
      // Preserve any extra legacy xray entries beyond the 4 stage slots
      for (let i = 4; i < existing.length; i++) nextUrls.push(existing[i]);

      const nextStageMedia = {
        ...(implant?.stage_media && typeof implant.stage_media === 'object' ? implant.stage_media : {}),
        [slotKey]: result.data,
      };

      // Optimistic UI
      setImplant((prev) => prev && String(prev.id) === String(realImplantId)
        ? { ...prev, xray_urls: nextUrls, stage_media: nextStageMedia }
        : prev);
      setRelatedTeeth((prev) => prev.map((t) => String(t.id) === String(realImplantId)
        ? { ...t, xray_urls: nextUrls, stage_media: nextStageMedia }
        : t));

      await base44.entities.Implant.update(realImplantId, {
        xray_urls: nextUrls,
        stage_media: nextStageMedia,
      });

      toast.success(language === 'ru'
        ? ('Фото ' + slotKey + ' сохранено')
        : (slotKey + ' rasmi saqlandi'));
      load();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Ошибка загрузки фото' : 'Rasm yuklashda xatolik');
      throw err;
    } finally {
      setUploadingSlot(null);
    }
  };
  const handleSaveMilestone = async () => {
    if (!milestoneForm.status.trim()) {
      toast.warning(language === 'ru' ? 'Введите название этапа' : 'Bosqich nomini kiriting');
      return;
    }
    const newEntry = {
      date: milestoneForm.date,
      status: milestoneForm.status.trim(),
      note: milestoneForm.note.trim() || '',
      user: milestoneForm.doctor.trim() || activeTooth.doctor || 'Dr.'
    };
    const updatedTimeline = [...(activeTooth.timeline || []), newEntry];
    try {
      await base44.entities.Implant.update(realImplantId, {
        timeline: updatedTimeline
      });
      setAddMilestoneOpen(false);
      toast.success(language === 'ru' ? 'Клинический этап добавлен!' : "Klinik bosqich qo'shildi!");
      load();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Ошибка сохранения' : 'Saqlashda xatolik');
    }
  };

  // Handle 1-click stage advancement from the top horizontal stepper
  const handleStepChange = async (step) => {
    if (!step || !activeTooth?.id) return;
    const newStatus = step.lifecycleValue;
    if (!newStatus) return;

    const toothKey = activeTooth.syntheticToothKey
      || (Array.isArray(activeTooth.tooth_numbers) && activeTooth.tooth_numbers.length === 1 ? activeTooth.tooth_numbers[0] : null)
      || activeTooth.tooth_id
      || null;
    const toothFdi = toothIdToFdi(toothKey || activeTooth.tooth_number) || null;

    const newEntry = {
      id: 'stage-' + Date.now(),
      date: new Date().toISOString(),
      status: step.label,
      note: language === 'ru'
        ? `Этап переведён в "${step.labelRu || step.label}"`
        : `Bosqich "${step.label}" holatiga o'tkazildi`,
      user: activeTooth.doctor || 'Shifokor',
      tooth_fdi: toothFdi || undefined,
      tooth_key: toothKey || undefined,
      lifecycle_value: newStatus,
    };

    const baseTimeline = Array.isArray(activeTooth.timeline) ? [...activeTooth.timeline] : [];
    const last = baseTimeline[baseTimeline.length - 1];
    const updatedTimeline = (last && (last.status === step.label || last.lifecycle_value === newStatus))
      ? [...baseTimeline.slice(0, -1), { ...last, ...newEntry, id: last.id || newEntry.id }]
      : [...baseTimeline, newEntry];

    let nextToothDataMap = implant?.tooth_data_map ? { ...implant.tooth_data_map } : {};
    if (toothKey) {
      const fdiKey = toothFdi || toothIdToFdi(toothKey);
      const prevEntry = { ...(nextToothDataMap[toothKey] || nextToothDataMap[fdiKey] || {}) };
      prevEntry.lifecycle_status = newStatus;
      prevEntry.timeline = updatedTimeline;
      nextToothDataMap[toothKey] = prevEntry;
      if (fdiKey && fdiKey !== toothKey) nextToothDataMap[fdiKey] = prevEntry;
    }

    // Optimistic local state so bottom history updates immediately
    setImplant((prev) => {
      if (!prev || String(prev.id) !== String(realImplantId)) return prev;
      const caseTimeline = toothKey
        ? [...(Array.isArray(prev.timeline) ? prev.timeline : []), newEntry]
        : updatedTimeline;
      return {
        ...prev,
        lifecycle_status: newStatus,
        status: newStatus,
        timeline: caseTimeline,
        tooth_data_map: toothKey ? nextToothDataMap : prev.tooth_data_map,
      };
    });
    setRelatedTeeth((prev) =>
      prev.map((t) => (String(t.id) === String(realImplantId)
        ? {
            ...t,
            lifecycle_status: newStatus,
            status: newStatus,
            timeline: toothKey
              ? [...(Array.isArray(t.timeline) ? t.timeline : []), newEntry]
              : updatedTimeline,
            tooth_data_map: toothKey ? nextToothDataMap : t.tooth_data_map,
          }
        : t))
    );

    try {
      const payload = {
        lifecycle_status: newStatus,
        status: newStatus,
        timeline: toothKey
          ? [...(Array.isArray(implant?.timeline) ? implant.timeline : []), newEntry]
          : updatedTimeline,
      };
      if (toothKey) {
        payload.tooth_data_map = nextToothDataMap;
      }

      await base44.entities.Implant.update(realImplantId, payload);

      toast.success(`Implant #${toothFdi || activeTooth.id}: "${step.label}" bosqichiga o'tkazildi!`, {
        icon: '🦷',
      });
      load();
    } catch (err) {
      console.error(err);
      toast.error(language === 'ru' ? 'Ошибка обновления статуса' : "Bosqichni yangilashda xatolik");
      load();
    }
  };

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
      await base44.entities.Implant.update(realImplantId, {
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
      await base44.entities.Implant.update(realImplantId, {
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
        ? `${activeTooth.diameter || '—'} mm × ${activeTooth.length || '—'} mm` 
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

  const brandLine = firmaNom + (activeTooth?.brend && String(activeTooth.brend).trim() && String(activeTooth.brend).trim() !== String(firmaNom).trim() ? ` · ${activeTooth.brend}` : '');

  const patientName = safeRender(activeTooth.patient_name, 'Bemor');
  const patientInitials = String(patientName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('') || 'B';
  const brandDisplay = (() => {
    const brand = (activeTooth?.firma === 'Boshqa'
      ? (activeTooth?.firma_custom || 'Boshqa')
      : activeTooth?.firma) || '';
    const model = (activeTooth?.brend && String(activeTooth.brend).trim() && String(activeTooth.brend).trim() !== String(brand).trim())
      ? String(activeTooth.brend).trim()
      : '';
    if (brand && model) return `${brand} ${model}`;
    return brand || model || brandLine || '—';
  })();

  return (
    <div className="space-y-4 pb-12 max-w-7xl mx-auto">

      {/* 1) Header row — mockup exact */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <Link
          to="/implants"
          className="inline-flex items-center gap-1.5 text-sm font-bold text-[#14b8a6] hover:text-teal-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{language === 'ru' ? 'Вернуться к паспорту импланта' : 'Implant pasportiga qaytish'}</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={exportPDF}
            className="h-9 px-3.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700 gap-1.5 bg-white hover:bg-slate-50"
          >
            <Download className="w-4 h-4 text-[#14b8a6]" />
            <span>{language === 'ru' ? 'PDF Паспорт' : 'PDF Pasport'}</span>
          </Button>
          <Button
            size="sm"
            onClick={() => setEditOpen(true)}
            className="h-9 px-3.5 rounded-xl text-xs font-black text-white gap-1.5 bg-[#14b8a6] hover:bg-teal-600 shadow-sm"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>{language === 'ru' ? 'Редактировать' : 'Tahrirlash'}</span>
          </Button>
          {activeTooth.patient_id && (
            <Link to={`/patients/${activeTooth.patient_id}`}>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700 gap-1.5 bg-white hover:bg-slate-50"
              >
                <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
                <span>{language === 'ru' ? 'Профиль пациента' : 'Bemor profili'}</span>
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* 2) Patient strip */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3.5 sm:px-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-100 to-teal-50 text-[#0f766e] border border-teal-200 flex items-center justify-center text-sm font-black shrink-0">
              {patientInitials}
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate leading-tight">
                {patientName}
              </h1>
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Пациент' : 'Bemor'}
              </div>
            </div>
          </div>

          <div className="hidden lg:block w-px h-10 bg-slate-200 shrink-0" />

          <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 shrink-0">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">FDI</span>
            <span className="font-mono text-base font-black text-slate-900">#{activeToothNumberFdi}</span>
          </div>

          <div className="hidden lg:block w-px h-10 bg-slate-200 shrink-0" />

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#14b8a6] flex items-center justify-center shrink-0 border border-teal-100">
              <ImplantIcon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                {language === 'ru' ? 'Бренд' : 'Implant'}
              </div>
              <div className="text-sm font-black text-slate-900 truncate">{brandDisplay}</div>
            </div>
          </div>

          {/* Multi-tooth chips — keep previous FDI fix */}
          {switcherItems.length > 1 && (
            <>
              <div className="hidden lg:block w-px h-10 bg-slate-200 shrink-0" />
              <div className="flex items-center gap-2 overflow-x-auto scrollbar-none min-w-0 flex-1 pb-0.5">
                {switcherItems.map((imp) => {
                  const key = imp.syntheticToothKey || imp.tooth_id || (Array.isArray(imp.tooth_numbers) && imp.tooth_numbers[0]) || imp.tooth_number;
                  const fdi = toothIdToFdi(key) || toothIdToFdi(imp.tooth_number) || '—';
                  const selected = imp.id === activeTooth?.id;
                  const short = SHORT_STATUS_LABEL[normalizeLifecycleStatus(imp.lifecycle_status || imp.status)] || '—';
                  return (
                    <button
                      key={imp.id}
                      type="button"
                      onClick={() => {
                        setSelectedRelatedTooth(imp.id);
                        if (imp.id && !String(imp.id).includes('__') && imp.id !== id) {
                          navigate(`/implants/${imp.id}`, { replace: true });
                        }
                      }}
                      className={cn(
                        'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-left transition-all',
                        selected
                          ? 'bg-[#14b8a6] border-[#14b8a6] text-white shadow-sm'
                          : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                      )}
                    >
                      <span className={cn('font-mono font-black text-sm', selected ? 'text-white' : 'text-slate-900')}>#{fdi}</span>
                      <span className={cn('text-[10px] font-bold', selected ? 'text-teal-50' : 'text-slate-500')}>{short}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 3) Full-width ClinicalStepper */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-4 sm:px-6">
        <ClinicalStepper
          status={activeTooth?.lifecycle_status || activeTooth?.status || 'Rejalashtirilgan'}
          language={language}
          onSelectStep={handleStepChange}
        />
      </div>

      {/* 4) TOP ROW — 3 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        <PassportSpecsCard implant={activeTooth} language={language} />

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 sm:p-6 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#14b8a6] flex items-center justify-center">
              <Tooth className="w-4 h-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800">
              {language === 'ru' ? 'Место зуба (FDI)' : 'Tish Joyi (FDI)'}
            </h3>
          </div>
          <DentalArchFdi
            activeFdis={[activeToothNumberFdi]}
            caseFdis={caseFdis}
            onSelectTooth={(fdi) => {
              const found = switcherItems.find((it) => {
                const raw = it.tooth_numbers || (it.tooth_number ? [it.tooth_number] : []);
                return raw.map(toothIdToFdi).includes(String(fdi));
              });
              if (found) {
                setSelectedRelatedTooth(found.id);
                if (!String(found.id).includes('__') && found.id !== id) {
                  navigate(`/implants/${found.id}`, { replace: true });
                }
              } else {
                toast.info(`Tish #${fdi} tanlandi`);
              }
            }}
          />
        </div>

        <StageMediaRail
          implant={activeTooth}
          language={language}
          onZoom={setZoomImg}
          onOpenPassport={exportPDF}
          onUpload={handleStagePhotoUpload}
          uploadingSlot={uploadingSlot}
        />
      </div>

      {/* 5) BOTTOM ROW — 2 cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        <ClinicalTimeline
          implant={activeTooth}
          language={language}
          onAddMilestone={() => setAddMilestoneOpen(true)}
        />
        <LinkedServicesCard
          services={allServices}
          total={totalAllServicesPrice}
          language={language}
          onAdd={handleOpenAddService}
          onDelete={handleDeleteService}
          onEditPrimary={() => setEditOpen(true)}
        />
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
        implant={implant}
        relatedImplants={switcherItems.length > 0 ? switcherItems : [implant]}
        onSaved={() => load()}
      />

      {/* ─── Add Clinical Milestone Dialog ─────────────────────────── */}
      <Dialog open={addMilestoneOpen} onOpenChange={setAddMilestoneOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-black text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#14b8a6]" />
              {language === 'ru' ? 'Добавить клинический этап' : "Yangi klinik bosqichni qayd etish"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700 mb-1 block">
                {language === 'ru' ? 'Название этапа' : 'Bosqich nomi'}
              </Label>
              <Input
                value={milestoneForm.status}
                onChange={(e) => setMilestoneForm(prev => ({ ...prev, status: e.target.value }))}
                placeholder="Masalan: Integratsiya bosqichi, Abutment o'rnatildi, Protez yakunlandi"
                className="h-10 rounded-xl border-slate-200 text-xs font-bold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1 block">
                  {language === 'ru' ? 'Дата' : 'Sana'}
                </Label>
                <Input
                  type="date"
                  value={milestoneForm.date}
                  onChange={(e) => setMilestoneForm(prev => ({ ...prev, date: e.target.value }))}
                  className="h-10 rounded-xl border-slate-200 font-mono text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700 mb-1 block">
                  {language === 'ru' ? 'Врач' : 'Shifokor'}
                </Label>
                <Input
                  value={milestoneForm.doctor}
                  onChange={(e) => setMilestoneForm(prev => ({ ...prev, doctor: e.target.value }))}
                  placeholder={activeTooth.doctor || 'Dr. Saidov'}
                  className="h-10 rounded-xl border-slate-200 text-xs"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700 mb-1 block">
                {language === 'ru' ? 'Параметры и примечания' : 'Klinik parametrlar va izoh'}
              </Label>
              <Textarea
                value={milestoneForm.note}
                onChange={(e) => setMilestoneForm(prev => ({ ...prev, note: e.target.value }))}
                placeholder="Masalan: ISQ: 72 | Suyak turi: D2 | Protokol: Delayed"
                rows={2}
                className="rounded-xl border-slate-200 text-xs font-medium"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddMilestoneOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                {language === 'ru' ? 'Отмена' : 'Bekor qilish'}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveMilestone}
                className="bg-[#14b8a6] hover:bg-[#0d9488] text-white rounded-xl text-xs font-black px-4 cursor-pointer"
              >
                {language === 'ru' ? 'Сохранить этап' : "Bosqichni saqlash"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}

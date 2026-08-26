import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Trash2, Download, Plus, AlertTriangle,
  CheckCircle2, Clock, FileText, Camera, Activity, Phone,
  Building2, Tag, Layers, Settings2, Hash, UserRound, CalendarDays, BellRing, CalendarClock
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/LanguageContext';
import ImplantForm, { EXTRA_SERVICES } from '../components/implants/ImplantForm';
import jsPDF from 'jspdf';

// Defensive rendering helper
const safeRender = (val, fallback = '—') => {
  if (val == null || val === '') return fallback;
  if (typeof val === 'string' || typeof val === 'number') return val;
  if (typeof val === 'object') return val.label || val.name || JSON.stringify(val).substring(0, 20);
  return String(val);
};

const LIFECYCLE_STEPS = [
  "Rejalashtirilgan", "O'rnatildi", "Healing jarayoni",
  "Abutment qo'yildi", "Crown tayyor", "Tugallangan"
];
const LIFECYCLE_COLORS = {
  'Rejalashtirilgan': 'bg-blue-50 text-blue-700 border-blue-200',
  "O'rnatildi": 'bg-teal-50 text-teal-700 border-teal-200',
  'Healing jarayoni': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  "Abutment qo'yildi": 'bg-purple-50 text-purple-700 border-purple-200',
  'Crown tayyor': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Tugallangan': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Failure': 'bg-red-50 text-red-700 border-red-200',
};
const COMPLICATION_TYPES = ['Peri-implantitis', 'Screw loosening', 'Implant failure', 'Boshqa'];

export default function ImplantDetail() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [implant, setImplant] = useState(null);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [compModal, setCompModal] = useState(false);
  const [extraModal, setExtraModal] = useState(false);
  const [compForm, setCompForm] = useState({ type: 'Peri-implantitis', date: new Date().toISOString().split('T')[0], note: '', status: 'Faol' });
  const [zoomImg, setZoomImg] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [relatedTeeth, setRelatedTeeth] = useState([]);
  const [selectedRelatedTooth, setSelectedRelatedTooth] = useState(null);
  const [crownModal, setCrownModal] = useState(false);
  const [pendingStatus, setPendingStatus] = useState(null);
  const [crownForm, setCrownForm] = useState({
    type: 'Zirkon',
    quantity: 1,
    price_per_unit: 1500000,
  });

  const load = async () => {
    const [items, pats] = await Promise.all([
      base44.entities.Implant.filter({ id }),
      base44.entities.Patient.list('full_name', 200),
    ]);
    let currentImplant = items[0] || null;
    
    // Yaratilganda holat kiritilmagan bo'lsa default o'rnatamiz
    if (currentImplant && !currentImplant.lifecycle_status) {
      currentImplant.lifecycle_status = "O'rnatildi";
    }
    
    // Data is already enriched by base44.entities.Implant.filter using our hybrid logic
    setImplant(currentImplant);
    setPatients(pats);
    
    if (currentImplant?.patient_id && currentImplant?.placement_date) {
      try {
        const related = await base44.entities.Implant.filter({
          patient_id: currentImplant.patient_id,
          placement_date: currentImplant.placement_date
        });
        // Deduplicate related teeth by ID to prevent React key crashes
        const uniqueRelated = Array.from(new Map((related || []).map(item => [item.id, item])).values());
        setRelatedTeeth(uniqueRelated);
      } catch (e) {
        setRelatedTeeth([]);
      }
    }
    
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return (
    <div className="space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-32 bg-muted rounded-2xl animate-pulse" />)}
    </div>
  );

  if (!implant) return (
    <div className="flex flex-col items-center justify-center py-24">
      <p className="text-xl font-bold">{t('implants.notFound')}</p>
      <Link to="/implants"><Button variant="link">← {t('common.back')}</Button></Link>
    </div>
  );

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

    const teethToUpdate = relatedTeeth.length > 0 ? relatedTeeth : [implant];

    await Promise.all(teethToUpdate.map(t => {
      const timeline = [...(t.timeline || []), {
        date: now, status: newStatus, note: `Holat o'zgartirildi: ${newStatus}`, user: 'Dr.'
      }];
      const audit_log = [...(t.audit_log || []), { date: now, user: 'Dr.', action: `Holat: ${newStatus}` }];
      
      // XAMMA eskirgan ma'lumotlarni ({ ...t }) berib yuboramiz, aks holda base44Client ularni o'chirib yuboradi!
      return base44.entities.Implant.update(t.id, { 
        ...t,
        lifecycle_status: newStatus, 
        status: statusMap[newStatus] || newStatus.toLowerCase(),
        timeline, 
        audit_log 
      });
    }));

    setStatusUpdating(false);
    load();
  };

  const handleStatusChange = (newStatus) => {
    if (newStatus === "Crown tayyor") {
      setPendingStatus(newStatus);
      setCrownModal(true);
    } else {
      updateStatus(newStatus);
    }
  };

  const saveCrownAndStatus = async () => {
    const totalPrice = crownForm.price_per_unit * crownForm.quantity;
    const teethToUpdate = relatedTeeth.length > 0 ? relatedTeeth : [implant];
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
    await Promise.all(teethToUpdate.map(t => {
      const timeline = [...(t.timeline || []), {
        date: now,
        status: "Crown tayyor",
        note: `Crown: ${crownForm.type} × ${crownForm.quantity} dona — ${totalPrice.toLocaleString()} so'm`,
        user: 'Dr.'
      }];
      return base44.entities.Implant.update(t.id, {
        ...t,
        lifecycle_status: "Crown tayyor",
        status: statusMap["Crown tayyor"],
        crown_type: crownForm.type,
        crown_quantity: crownForm.quantity,
        crown_price: totalPrice,
        timeline,
      });
    }));
    setCrownModal(false);
    load();
  };

  const addComplication = async () => {
    const teethToUpdate = relatedTeeth.length > 0 ? relatedTeeth : [implant];
    await Promise.all(teethToUpdate.map(t => {
      const complications = [...(t.complications || []), compForm];
      const timeline = [...(t.timeline || []), {
        date: new Date().toISOString(), status: 'Komplikatsiya', note: `${compForm.type}: ${compForm.note}`, user: 'Dr.'
      }];
      return base44.entities.Implant.update(t.id, { ...t, complications, timeline });
    }));
    
    setCompModal(false);
    setCompForm({ type: 'Peri-implantitis', date: new Date().toISOString().split('T')[0], note: '', status: 'Faol' });
    load();
  };

  const addExtraService = async (serviceId) => {
    const serviceName = t('implants.services.' + serviceId) || EXTRA_SERVICES.find(s => s.id === serviceId)?.label || serviceId;
    const teethToUpdate = relatedTeeth.length > 0 ? relatedTeeth : [implant];
    
    await Promise.all(teethToUpdate.map(t => {
      const extra_services = [...(t.extra_services || []), serviceId];
      const timeline = [...(t.timeline || []), {
        date: new Date().toISOString(), status: 'Xizmat qo\'shildi', note: `${serviceName} qo'shildi`, user: 'Dr.'
      }];
      return base44.entities.Implant.update(t.id, { ...t, extra_services, timeline });
    }));
    
    setExtraModal(false);
    load();
  };

  const removeExtraService = async (serviceId) => {
    const teethToUpdate = relatedTeeth.length > 0 ? relatedTeeth : [implant];
    await Promise.all(teethToUpdate.map(t => {
      const extra_services = (t.extra_services || []).filter(sv => sv !== serviceId);
      return base44.entities.Implant.update(t.id, { ...t, extra_services });
    }));
    load();
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(45, 212, 191);
    doc.text('My Clinic — Implant Kartasi', 20, 20);
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(12);
    doc.line(20, 24, 190, 24);

    const rows = [
      ['Bemor', implant.patient_name],
      ['Telefon', implant.patient_phone || '—'],
      ['Shifokor', implant.doctor || '—'],
      ['Tish raqamlari', (implant.tooth_numbers || [implant.tooth_number]).map(n => `#${n}`).join(', ')],
      ['Implant turi', implant.implant_type || '—'],
      ['Firma', implant.firma === 'Boshqa' ? implant.firma_custom : implant.firma],
      ['Brend / Model', implant.brend || '—'],
      ['Diametr', implant.diameter ? `${implant.diameter} mm` : '—'],
      ['Uzunlik', implant.length ? `${implant.length} mm` : '—'],
      ['Lot raqami', implant.lot_number || '—'],
      ['Torque', implant.torque ? `${implant.torque} Ncm` : '—'],
      ['ISQ', implant.isq || '—'],
      ['Suyak turi', implant.bone_type || '—'],
      ['Qo\'yilgan sana', implant.placement_date],
      ['Holat', implant.lifecycle_status],
    ];

    let y = 32;
    rows.forEach(([k, v]) => {
      doc.setFont(undefined, 'bold');
      doc.text(`${k}:`, 20, y);
      doc.setFont(undefined, 'normal');
      doc.text(`${v}`, 70, y);
      y += 7;
    });

    if (implant.notes) {
      doc.setFont(undefined, 'bold');
      doc.text('Izoh:', 20, y + 4);
      doc.setFont(undefined, 'normal');
      doc.text(implant.notes, 20, y + 11, { maxWidth: 170 });
    }

    const tishStr = (implant.tooth_numbers || [implant.tooth_number]).join('-');
    doc.save(`implant-${implant.patient_name}-tish${tishStr}.pdf`);
  };

  const firmaNom = (implant.firma === 'Boshqa' ? (implant.firma_custom || 'Boshqa') : implant.firma) || '—';
  
  // Normalize current status for UI
  const getCurrentStatus = () => {
    const s = implant.lifecycle_status || implant.status;
    if (!s) return "Rejalashtirilgan";
    
    const mapping = {
      'planned': "Rejalashtirilgan",
      'placed': "O'rnatildi",
      'healing': "Healing jarayoni",
      'abutment': "Abutment qo'yildi",
      'crown': "Crown tayyor",
      'completed': "Tugallangan",
      'failure': "Failure",
      'failed': "Failure"
    };
    return mapping[s] || s;
  };

  const displayStatus = getCurrentStatus();
  const currentStep = LIFECYCLE_STEPS.indexOf(displayStatus);
  
  // Calculate reminder message
  const getReminderMessage = () => {
    if (!implant.reminder_date) return '—';
    const today = new Date();
    const reminderDate = new Date(implant.reminder_date);
    const daysLeft = Math.ceil((reminderDate - today) / 86400000);
    if (daysLeft < 0) return <span className="text-rose-600 font-bold">{Math.abs(daysLeft)} kun o'tdi ⚠️</span>;
    if (daysLeft === 0) return <span className="text-amber-600 font-black">Bugun! 🔔</span>;
    if (daysLeft <= 7) return <span className="text-amber-600 font-bold">{daysLeft} kun qoldi</span>;
    return <span className="text-blue-600">{daysLeft} kun qoldi</span>;
  };

  // Get service label by ID
  const getServiceLabel = (id) => {
    return t('implants.services.' + id) || EXTRA_SERVICES.find(s => s.id === id)?.label || id;
  };

  return (
    <div className="space-y-6 pb-10">
      {/* Back + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link to="/implants">
          <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" /> {t('navigation.implants')}
          </Button>
        </Link>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Edit2 className="w-4 h-4" /> {t('common.edit')}
          </Button>
          <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
            <Download className="w-4 h-4" /> PDF
          </Button>
          <Button variant="destructive" size="sm" onClick={() => setDeleteConfirm(true)} className="gap-1.5">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Header card */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="min-w-16 h-16 px-3 bg-primary rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0 flex-wrap gap-1 max-w-[150px]">
            {relatedTeeth.length > 0 ? (
              relatedTeeth.map(r => <span key={r.id}>#{r.tooth_number}</span>)
            ) : (
              [...new Set(implant.tooth_numbers || [implant.tooth_number])].map(n => <span key={n}>#{n}</span>)
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{safeRender(implant.patient_name)}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${LIFECYCLE_COLORS[displayStatus] || ''}`}>
                {safeRender(displayStatus)}
              </span>
              {displayStatus === 'Failure' && (
                <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> Failure ❗
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-muted-foreground">
              {implant.patient_phone && (
                <a href={`tel:${implant.patient_phone}`} className="flex items-center gap-1 hover:text-foreground">
                  <Phone className="w-3.5 h-3.5" />{safeRender(implant.patient_phone)}
                </a>
              )}
              <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{safeRender(implant.placement_date)}</span>
              {implant.doctor && <span>👨⚕️ {safeRender(implant.doctor)}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Lifecycle progress */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> {t('implants.lifecycleStatus')}</h3>
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {LIFECYCLE_STEPS.map((step, idx) => (
            <div key={step} className="flex items-center gap-1 flex-shrink-0">
              <div className={`flex flex-col items-center gap-1 cursor-pointer group`} onClick={() => handleStatusChange(step)}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all group-hover:scale-110 ${
                  currentStep > idx ? 'bg-primary border-primary text-white' :
                  currentStep === idx ? 'bg-primary/20 border-primary text-primary' :
                  'bg-muted border-border text-muted-foreground'
                }`}>
                  {currentStep > idx ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>
                <span className={`text-[10px] text-center leading-tight max-w-[60px] ${currentStep >= idx ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {step}
                </span>
              </div>
              {idx < LIFECYCLE_STEPS.length - 1 && (
                <div className={`h-0.5 w-6 flex-shrink-0 mb-4 ${currentStep > idx ? 'bg-primary' : 'bg-border'}`} />
              )}
            </div>
          ))}
          <div className="flex flex-col items-center gap-1 ml-2 cursor-pointer group" onClick={() => updateStatus('Failure')}>
            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all group-hover:scale-110 ${
              displayStatus === 'Failure' ? 'bg-red-500 border-red-500 text-white' : 'bg-muted border-border text-muted-foreground'
            }`}>❗</div>
            <span className="text-[10px] text-red-500 font-medium max-w-[50px] text-center">Failure</span>
          </div>
        </div>

        {/* Quick status update */}
        <div className="mt-4 flex items-center gap-3">
          <Label className="text-sm shrink-0">{t('implants.updateStatus')}:</Label>
          <Select value={displayStatus} onValueChange={handleStatusChange} disabled={statusUpdating}>
            <SelectTrigger className="flex-1 max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Rejalashtirilgan","O'rnatildi","Healing jarayoni","Abutment qo'yildi","Crown tayyor","Tugallangan","Failure"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {relatedTeeth.length > 0 && (
        <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">🦷 {t('implants.teethParams')}</h3>
          <div className="flex flex-wrap gap-3 mb-4">
            {relatedTeeth.map(r => (
              <button
                key={r.id}
                onClick={() => setSelectedRelatedTooth(r.id === selectedRelatedTooth ? null : r.id)}
                className={`px-4 py-2 rounded-xl border-2 transition-all font-bold ${
                  selectedRelatedTooth === r.id || (!selectedRelatedTooth && r.id === implant.id)
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-muted border-transparent text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {t('implants.tooth')} #{r.tooth_number}
              </button>
            ))}
          </div>

          {/* Show details for the currently active tooth visually */}
          {(() => {
            const activeTooth = relatedTeeth.find(r => r.id === (selectedRelatedTooth || implant.id)) || implant;
            // tooth_data JSONB dan fallback
            const td = activeTooth.tooth_data || {};
            const val = (field) => activeTooth[field] || td[field] || null;
            return (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">{t('implants.diameter')}</p>
                  <p className="font-black text-slate-800 text-lg">{val('diameter') ? `${safeRender(val('diameter'))} mm` : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">{t('implants.length')}</p>
                  <p className="font-black text-slate-800 text-lg">{val('length') ? `${safeRender(val('length'))} mm` : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Lot / Seriya</p>
                  <p className="font-black text-slate-800">{safeRender(val('lot_number'))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Torque</p>
                  <p className="font-black text-amber-700 text-lg">{val('torque') ? `${safeRender(val('torque'))} Ncm` : '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Firma / Brend</p>
                  <p className="font-black text-slate-800">
                    {safeRender(val('firma') === 'Boshqa' ? (val('firma_custom') || 'Boshqa') : (val('firma') || '—'))}
                    {val('brend') ? ` · ${safeRender(val('brend'))}` : ''}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">IsQ</p>
                  <p className="font-black text-indigo-700 text-lg">{safeRender(val('isq'))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">Suyak turi</p>
                  <p className="font-black text-slate-800">{safeRender(val('bone_type'))}</p>
                </div>
                <div className="flex items-center">
                  <Link to={`/implants/${activeTooth.id}`}>
                    <Button variant="link" className="px-0 text-primary text-xs font-bold gap-1">
                      {t('common.viewMore')} →
                    </Button>
                  </Link>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5">
        {/* Professional Clinical Metrics - doctor-focused */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />
          <h3 className="font-semibold mb-6 flex items-center gap-2 text-slate-800">
            <Activity className="w-5 h-5 text-primary" /> {t('implants.clinicalStats')}
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[
              { 
                label: 'Torque', 
                value: implant.torque, 
                unit: 'Ncm', 
                color: 'amber', 
                icon: '⚡', 
                desc: t('implants.primaryStability'),
                ok: v => {
                  const n = parseInt(v);
                  if (isNaN(n)) return null;
                  if (n < 25) return 'Past';
                  if (n <= 50) return 'Optimal';
                  return 'Yuqori';
                }
              },
              { 
                label: 'ISQ', 
                value: implant.isq, 
                unit: '', 
                color: 'indigo', 
                icon: '📡', 
                desc: t('implants.osseointegration'),
                ok: v => {
                  const n = parseInt(v);
                  if (isNaN(n)) return null;
                  if (n < 60) return 'Past';
                  if (n <= 85) return 'Optimal';
                  return 'A'
                }
              },
              { 
                label: 'Diametr', 
                value: implant.diameter, 
                unit: 'mm', 
                color: 'emerald', 
                icon: '⭕', 
                desc: t('implants.implantThickness')
              },
              { 
                label: 'Uzunlik', 
                value: implant.length, 
                unit: 'mm', 
                color: 'blue', 
                icon: '📏', 
                desc: t('implants.verticalDepth')
              },
            ].map(({ label, value, unit, color, icon, desc, ok }) => {
              const status = ok ? ok(value) : null;
              return (
                <div key={label} className={`relative p-5 rounded-3xl border-2 transition-all hover:shadow-md ${
                  value ? `border-${color}-100 bg-${color}-50/30` : 'border-slate-100 bg-slate-50'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{icon} {label}</span>
                    {status && (
                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${
                        status === 'Optimal' || status === 'A' ? 'bg-emerald-100 text-emerald-700' : 
                        status === 'Past' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {status}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <p className={`text-3xl font-black tracking-tight ${value ? `text-${color}-900` : 'text-slate-300'}`}>
                      {value || '—'}
                    </p>
                    {value && <span className={`text-sm font-bold ${`text-${color}-600/70`}`}>{unit}</span>}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">{desc}</p>
                </div>
              );
            })}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-1 pt-6 border-t border-slate-100">
            {[  
              [<Building2 className="w-3.5 h-3.5 text-indigo-500" />, t('implants.firma'), (() => { const f = implant.firma || implant.tooth_data?.firma; const fc = implant.firma_custom || implant.tooth_data?.firma_custom; return f === 'Boshqa' ? (fc || t('common.other')) : (f || '—'); })()],
              [<Tag className="w-3.5 h-3.5 text-violet-500" />, t('implants.brandModel'), implant.brend || implant.tooth_data?.brend || '—'],
              [<Layers className="w-3.5 h-3.5 text-amber-500" />, t('implants.boneType'), implant.bone_type || implant.tooth_data?.bone_type || '—'],
              [<Settings2 className="w-3.5 h-3.5 text-sky-500" />, t('implants.implantType'), implant.implant_type || implant.tooth_data?.implant_type || '—'],
              [<Hash className="w-3.5 h-3.5 text-slate-500" />, t('implants.lotSerialNumber'), implant.lot_number || implant.tooth_data?.lot_number || '—'],
              [<UserRound className="w-3.5 h-3.5 text-teal-500" />, t('implants.doctor'), implant.doctor || '—'],
              [<CalendarDays className="w-3.5 h-3.5 text-emerald-500" />, t('implants.placementDate'), implant.placement_date || '—'],
              [<BellRing className="w-3.5 h-3.5 text-rose-500" />, t('implants.reminderPeriod'), implant.reminder_months && implant.reminder_months !== 'custom' ? `${implant.reminder_months} ${t('common.month')}` : (implant.reminder_months === 'custom' ? t('implants.customDate') : '—')],
              [<CalendarClock className="w-3.5 h-3.5 text-orange-500" />, t('implants.reminderDate'), getReminderMessage()],
            ].map(([icon, label, v]) => (
              <div key={label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                <span className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <span className="w-6 h-6 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">{icon}</span>
                  {label}
                </span>
                <span className="font-bold text-slate-800 text-right max-w-[55%] truncate text-sm">{v}</span>
              </div>
            ))}
          </div>
          
          {implant.notes && (
            <div className="mt-3 p-3 bg-amber-50 rounded-xl text-sm text-amber-800 border border-amber-100 font-medium">
              📝 {implant.notes}
            </div>
          )}
        </div>

        {/* Extra Services - Professional display */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              ➕ {t('implants.table.extraServices')}
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                {(implant.extra_services || []).length} {t('common.count')}
              </span>
            </h3>
            <Button size="sm" variant="outline" onClick={() => setExtraModal(true)} className="gap-1">
              <Plus className="w-3.5 h-3.5" /> {t('implants.addService')}
            </Button>
          </div>
          
          {(!implant.extra_services || implant.extra_services.length === 0) ? (
            <p className="text-sm text-muted-foreground italic">{t('implants.noExtraServices')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {implant.extra_services.map(s => {
                const svc = EXTRA_SERVICES.find(x => x.id === s);
                return (
                  <div key={s} className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-primary/10 to-teal-500/10 text-primary border border-primary/20 rounded-xl text-sm font-semibold shadow-sm group">
                    <span className="w-2 h-2 rounded-full bg-primary inline-block shrink-0"></span>
                    <span>{t('implants.services.' + s) || svc?.label || s}</span>
                    {svc?.category && <span className="text-[10px] text-primary/60 border-l border-primary/20 pl-1.5 ml-0.5">{svc.category}</span>}
                    <button onClick={() => removeExtraService(s)} className="ml-1 opacity-0 group-hover:opacity-100 text-rose-500 hover:text-rose-700 transition-opacity" title="O'chirish">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>{/* end grid grid-cols-1 gap-5 */}

      {/* Crown info card - shows when crown data is saved */}
      {(implant.crown_type || implant.tooth_data?.crown_type) && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl shadow-sm p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2 text-indigo-800">
            👑 {t('implants.crownInfo')}
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white rounded-xl p-4 border border-indigo-100 text-center">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t('common.type')}</p>
              <p className="text-xl font-black text-indigo-800">{implant.crown_type || implant.tooth_data?.crown_type}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-indigo-100 text-center">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t('common.quantity')}</p>
              <p className="text-xl font-black text-indigo-800">{implant.crown_quantity || implant.tooth_data?.crown_quantity || 1} <span className="text-sm">{t('common.count')}</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-indigo-100 text-center">
              <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-1">{t('common.price')}</p>
              <p className="text-lg font-black text-indigo-800">{((implant.crown_price || implant.tooth_data?.crown_price || 0)).toLocaleString()} <span className="text-xs">{t('common.currency')}</span></p>
            </div>
          </div>
        </div>
      )}

      {/* Passport + Xrays */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Camera className="w-4 h-4 text-primary" /> {t('implants.docsXray')}</h3>
        {implant.passport_url && (
          <div className="mb-4">
            <p className="text-sm font-medium mb-2 flex items-center gap-1"><FileText className="w-4 h-4" /> {t('implants.passport')}</p>
            <div className="relative group w-48 aspect-[4/3] rounded-xl overflow-hidden border border-border shadow-sm cursor-pointer mb-2" onClick={() => setZoomImg(implant.passport_url)}>
              <img src={implant.passport_url} alt="Passport" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-xs">{t('common.view')}</span>
              </div>
            </div>
            <a href={implant.passport_url} target="_blank" className="inline-flex items-center gap-2 px-3 py-2 bg-muted rounded-xl text-sm text-primary hover:underline">
              <Download className="w-4 h-4" /> {t('common.viewFull')}
            </a>
          </div>
        )}
        {implant.xray_urls?.length > 0 ? (
          <div>
            <p className="text-sm font-medium mb-2">{t('implants.xrays')} ({implant.xray_urls.length} {t('common.count')})</p>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {implant.xray_urls.map((url, i) => (
                <div key={i} className="relative group rounded-xl overflow-hidden border border-border aspect-square cursor-pointer" onClick={() => setZoomImg(url)}>
                  <img src={url} alt={`xray-${i}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span className="text-white text-xs">{t('common.view')}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t('implants.noXrays')}</p>
        )}
      </div>

      {/* Complications */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-500" /> {t('implants.complications')}</h3>
          <Button size="sm" variant="outline" onClick={() => setCompModal(true)} className="gap-1">
            <Plus className="w-3.5 h-3.5" /> {t('common.add')}
          </Button>
        </div>
        {(!implant.complications || implant.complications.length === 0) ? (
          <p className="text-sm text-muted-foreground">{t('implants.noComplications')}</p>
        ) : (
          <div className="space-y-2">
            {implant.complications.map((c, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm text-amber-800">{c.type}</span>
                  <span className="text-xs text-amber-600">{c.date}</span>
                </div>
                {c.note && <p className="text-xs text-amber-700 mt-1">{c.note}</p>}
                <span className="text-xs text-amber-600 mt-1 inline-block">{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-card border border-border rounded-2xl shadow-sm p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-primary" /> {t('implants.timeline')}</h3>
        {(!implant.timeline || implant.timeline.length === 0) ? (
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {[...implant.timeline].reverse().map((t, i) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                  {i < implant.timeline.length - 1 && <div className="w-0.5 bg-border flex-1 mt-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-medium">{t.status}</p>
                  {t.note && <p className="text-xs text-muted-foreground mt-0.5">{t.note}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">{new Date(t.date).toLocaleString('uz-UZ')} {t.user && `· ${t.user}`}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Xray zoom */}
      <Dialog open={!!zoomImg} onOpenChange={() => setZoomImg(null)}>
        <DialogContent className="max-w-2xl p-2">
          <img src={zoomImg} alt="zoom" className="w-full rounded-lg" />
        </DialogContent>
      </Dialog>

      {/* Crown Modal - pops up when "Crown tayyor" is selected */}
      <Dialog open={crownModal} onOpenChange={setCrownModal}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              👑 {t('implants.crownInfo')}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground -mt-1">
            {t('implants.crownModalDesc')}
          </p>

          <div className="space-y-5 mt-2">
            {/* Crown type */}
            <div>
              <Label className="text-sm font-bold mb-2 block">{t('implants.crownType')}</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'Zirkon', label: t('implants.zirconium'), icon: '💎', desc: `1,500,000 ${t('common.currency')}`, defaultPrice: 1500000 },
                  { value: 'Metallokeramika', label: t('implants.metalCeramic'), icon: '🔩', desc: `800,000 ${t('common.currency')}`, defaultPrice: 800000 },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCrownForm(f => ({ ...f, type: opt.value, price_per_unit: opt.defaultPrice }))}
                    className={`p-4 rounded-2xl border-2 text-left transition-all ${
                      crownForm.type === opt.value
                        ? 'border-indigo-500 bg-indigo-50 shadow-md'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-2xl mb-1">{opt.icon}</div>
                    <p className="font-black text-sm text-slate-800">{opt.label}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <Label className="text-sm font-bold mb-2 block">{t('common.quantity')}</Label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCrownForm(f => ({ ...f, quantity: Math.max(1, f.quantity - 1) }))}
                  className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-xl font-black hover:bg-slate-100 transition"
                >−</button>
                <span className="text-3xl font-black text-indigo-700 w-16 text-center">{crownForm.quantity}</span>
                <button
                  type="button"
                  onClick={() => setCrownForm(f => ({ ...f, quantity: f.quantity + 1 }))}
                  className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-xl font-black hover:bg-slate-100 transition"
                >+</button>
                <span className="text-sm text-slate-500 ml-2">{t('common.count')}</span>
              </div>
            </div>

            {/* Price per unit */}
            <div>
              <Label className="text-sm font-bold mb-2 block">{t('implants.pricePerUnit')} ({t('common.currency')})</Label>
              <Input
                type="number"
                value={crownForm.price_per_unit}
                onChange={e => setCrownForm(f => ({ ...f, price_per_unit: Number(e.target.value) }))}
                className="h-11 rounded-xl border-2 focus:border-indigo-500 text-lg font-bold"
              />
            </div>

            {/* Total preview */}
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-black text-indigo-400 uppercase tracking-widest">{t('common.total')}</p>
                <p className="text-sm text-indigo-700 font-medium mt-0.5">
                  {crownForm.quantity} {t('common.count')} × {crownForm.price_per_unit.toLocaleString()} {t('common.currency')}
                </p>
              </div>
              <p className="text-2xl font-black text-indigo-800">
                {(crownForm.quantity * crownForm.price_per_unit).toLocaleString()}
                <span className="text-xs ml-1 font-bold text-indigo-500">{t('common.currency')}</span>
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" className="rounded-xl" onClick={() => setCrownModal(false)}>{t('common.cancel')}</Button>
              <Button
                onClick={saveCrownAndStatus}
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black gap-2"
              >
                👑 {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complication modal */}
      <Dialog open={compModal} onOpenChange={setCompModal}>

        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('implants.addComplication')}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t('common.count')}</Label>
              <Select value={compForm.type} onValueChange={v => setCompForm(f => ({...f, type: v}))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                 <SelectContent>{COMPLICATION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>{t('common.date')}</Label><Input type="date" value={compForm.date} onChange={e => setCompForm(f => ({...f, date: e.target.value}))} /></div>
            <div><Label>{t('common.description')}</Label><Textarea value={compForm.note} onChange={e => setCompForm(f => ({...f, note: e.target.value}))} rows={2} /></div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCompModal(false)}>{t('common.cancel')}</Button>
              <Button onClick={addComplication} className="bg-primary hover:bg-primary/90">{t('common.save')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Extra Service Add Modal */}
      <Dialog open={extraModal} onOpenChange={setExtraModal}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t('implants.addService')}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">{t('implants.extraServiceDesc')}</p>
            <div className="grid grid-cols-1 gap-2">
              {EXTRA_SERVICES.filter(s => !(implant.extra_services || []).includes(s.id)).map(service => (
                <button 
                  key={service.id}
                  onClick={() => addExtraService(service.id)}
                  className="flex flex-col text-left p-3 border border-border rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all group"
                >
                  <span className="font-semibold text-sm group-hover:text-primary">{t('implants.services.' + service.id) || service.label}</span>
                  <span className="text-[10px] text-muted-foreground uppercase mt-1">{service.category}</span>
                </button>
              ))}
              {EXTRA_SERVICES.filter(s => !(implant.extra_services || []).includes(s.id)).length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-4">{t('implants.allServicesAdded')} ✅</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>{t('implants.deleteTitle')}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">{t('implants.deleteDesc')}</p>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={async () => {
              await base44.entities.Implant.delete(id);
              window.history.back();
            }}>{t('common.delete')}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <ImplantForm
        open={editOpen}
        onClose={() => setEditOpen(false)}
        patients={patients}
        services={[]}
        implant={implant}
        relatedImplants={relatedTeeth.length > 0 ? relatedTeeth : [implant]}
        onSaved={() => load()}
      />
    </div>
  );
}

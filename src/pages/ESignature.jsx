/**
 * @fileoverview E-Signature Page - Digital consent forms with electronic signatures
 * @module pages/ESignature
 * 
 * @description
 * Professional electronic signature system for dental consent forms.
 * Features canvas-based signature capture, PDF generation, form templates,
 * and signature verification. Supports multiple consent form types including
 * treatment consent, privacy policy acknowledgment, and financial agreements.
 * 
 * @author Senior Developer
 * @version 2.0.0
 */

import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  FileSignature,
  Pen,
  CheckCircle,
  X,
  Calendar,
  FileText,
  Search,
  Filter,
  Eye,
  Printer,
  Save,
  Trash2,
  Undo,
  RefreshCw
} from 'lucide-react';

/**
 * @typedef {Object} SignatureData
 * @property {string} id - Unique signature identifier
 * @property {string} patientId - Associated patient ID
 * @property {string} patientName - Patient full name
 * @property {string} formType - Type of consent form
 * @property {string} formTitle - Display title of the form
 * @property {string} signatureData - Base64 encoded signature image
 * @property {string} ipAddress - IP address of signer
 * @property {string} userAgent - Browser user agent
 * @property {string} signedAt - ISO timestamp of signature
 * @property {Object} formData - Additional form field data
 * @property {string} status - Signature status (active, revoked)
 * @property {string} [revokedAt] - Revocation timestamp
 * @property {string} [revokeReason] - Reason for revocation
 */

/**
 * @typedef {Object} FormTemplate
 * @property {string} id - Template identifier
 * @property {string} type - Form type key
 * @property {string} title - Display title
 * @property {string} description - Form description
 * @property {string} content - Form content text
 * @property {string[]} requiredFields - List of required field names
 * @property {boolean} requiresWitness - Whether witness signature required
 */

/** @type {FormTemplate[]} */
const FORM_TEMPLATES = [
  {
    id: 'treatment-consent',
    type: 'treatment',
    title: 'Davolash rozilik formasi',
    description: 'Tibbiy davolash uchun umumiy rozilik',
    content: `Men, {patientName}, {clinicName} klinikasida tibbiy xizmatlarni olishga roziman.

Menga quyidagi davolash turlari taklif etildi:
- Tish davolash
- Tish olish
- Protezlash
- Implantatsiya
- Boshqa kerakli tibbiy xizmatlar

Men muassasa xodimlari tomonidan mening sog'lig'im haqida to'liq ma'lumot berilganligini tasdiqlayman. Davolash jarayonida yuzaga kelishi mumkin bo'lgan xavf-xatarlar, asoratlar va boshqa muammolar haqida ogohlantirildim.

Shifokorlar va hamshiralar mening savollarimga javob berdilar va men davolashning maqsadi, usuli, kutiladigan natijalari va mumkin bo'lgan xavflari haqida to'liq ma'lumotga egaman.

Men o'zim va/yoki vakillarim tomonidan taqdim etilgan ma'lumotlar to'g'ri ekanligini tasdiqlayman va davolash jarayonida yuzaga kelishi mumkin bo'lgan barcha xavf-xatarlar uchun muassasani javobgarlikdan ozod qilaman.`,
    requiredFields: ['patientName', 'patientPhone', 'patientAddress'],
    requiresWitness: false
  },
  {
    id: 'privacy-consent',
    type: 'privacy',
    title: 'Maxfiylik siyosati roziligi',
    description: 'Shaxsiy ma\'lumotlarni qayta ishlashga rozilik',
    content: `Men, {patientName}, {clinicName} klinikasiga shaxsiy ma'lumotlarimni qayta ishlashga rozilik beraman.

Qayta ishlash maqsadlari:
- Tibbiy xizmatlarni ko'rsatish
- Davolash tarixi yuritish
- Sug'urta kompaniyalariga hisobot berish
- Davolash natijalarini tahlil qilish
- Klinika faoliyatini yaxshilash

Men quyidagi ma'lumotlarimni qayta ishlashga roziman:
- F.I.Sh.
- Tug'ilgan sanasi
- Telefon raqami
- Manzili
- Tibbiy ma'lumotlar
- Rasm va rentgen suratlari

Men o'z roziligimni istalgan vaqtda bekor qilish huquqiga egaligimni bilaman.`,
    requiredFields: ['patientName', 'patientPhone'],
    requiresWitness: false
  },
  {
    id: 'financial-agreement',
    type: 'financial',
    title: 'Moliyaviy shartnoma',
    description: 'Davolash xarajatlari va to\'lov shartlari',
    content: `Men, {patientName}, {clinicName} klinikasida ko'rsatilgan tibbiy xizmatlar uchun to'lov majburiyatlarini tasdiqlayman.

Davolash narxi: {treatmentCost}
To'lov usuli: {paymentMethod}

Men quyidagi shartlarga roziman:
1. Davolash narxi oldindan kelishilgan va men uni to'liq tushundim
2. To'lovlar kelishilgan jadval asosida amalga oshiriladi
3. Kechiktirilgan to'lovlarga penya qo'llanilishi mumkin
4. Davolash bekor qilinganda qaytarib beriladigan va berilmaydigan summalar belgilangan
5. Sug'urta qoplamasi bo'lsa, men tegishli hujjatlarni taqdim etish majburiyatini olaman

Men moliyaviy majburiyatlarimni to'liq tushundim va roziman.`,
    requiredFields: ['patientName', 'treatmentCost', 'paymentMethod'],
    requiresWitness: true
  },
  {
    id: 'anesthesia-consent',
    type: 'anesthesia',
    title: 'Narkoz rozilik formasi',
    description: 'Anesteziya va sedatsiya uchun rozilik',
    content: `Men, {patientName}, {clinicName} klinikasida anesteziya/sedatsiya olishga roziman.

Menga quyidagi ma'lumotlar berildi:
- Anesteziya turi va usuli
- Kutiladigan samaralar
- Mumkin bo'lgan asoratlar va xavflar
- Anesteziyadan oldingi tayyorgarlik talablari
- Anesteziyadan keyingi parvarish ko'rsatmalari

Men quyidagilarni tasdiqlayman:
- 6 soat ichida ovqat yemaganman
- Suyuq ichimliklarni 2 soat ichida cheklaganman
- Dorilar haqida shifokorga xabar berganman
- O'zimda allergik reaksiyalar haqida xabar berganman
- Homilador ekanligim/yoki emasligim haqida xabar berganman

Men anesteziya xavf-xatarlarini tushundim va rozilik beraman.`,
    requiredFields: ['patientName', 'emergencyContact', 'emergencyPhone'],
    requiresWitness: true
  },
  {
    id: 'photo-consent',
    type: 'photo',
    title: 'Surat olish roziligi',
    description: 'Tibbiy va ta\'lim maqsadlarida surat olish',
    content: `Men, {patientName}, {clinicName} klinikasiga quyidagi maqsadlarda suratlarimni olish va ishlatishga rozilik beraman:

Ruxsat etilgan maqsadlar:
- Davolash jarayonini kuzatish
- Ta'lim maqsadlarida ishlatish (anonim)
- Ilmiy maqolalar va taqdimotlar (anonim)
- Klinika marketing materiallari (anonim yoki rozilik bilan)
- Sug'urta hujjatlari

Men suratlarim quyidagi shakllarda ishlatilishiga roziman:
- Og'iz bo'shlig'i ichki suratlari
- Tish rentgen suratlari
- Yuz suratlari (profil, old tomondan)
- Davolash jarayoni suratlari

Men o'z roziligimni istalgan vaqtda bekor qilish huquqiga egaligimni bilaman.`,
    requiredFields: ['patientName'],
    requiresWitness: false
  }
];

/**
 * Custom hook for canvas signature pad
 * @param {number} width - Canvas width
 * @param {number} height - Canvas height
 * @returns {Object} Signature pad methods and state
 */
const useSignaturePad = (width = 600, height = 200) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [strokes, setStrokes] = useState([]);
  const [currentStroke, setCurrentStroke] = useState([]);

  const getCoordinates = useCallback((event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }, []);

  const startDrawing = useCallback((event) => {
    event.preventDefault();
    const { x, y } = getCoordinates(event);
    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#000000';
  }, [getCoordinates]);

  const draw = useCallback((event) => {
    event.preventDefault();
    if (!isDrawing) return;

    const { x, y } = getCoordinates(event);
    setCurrentStroke(prev => [...prev, { x, y }]);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, getCoordinates]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, currentStroke]);
      setCurrentStroke([]);
      setHasSignature(true);
    }
  }, [isDrawing, currentStroke]);

  const clear = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
    setStrokes([]);
    setCurrentStroke([]);
  }, []);

  const undo = useCallback(() => {
    if (strokes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    setHasSignature(newStrokes.length > 0);

    // Redraw remaining strokes
    newStrokes.forEach(stroke => {
      if (stroke.length === 0) return;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#000000';
      stroke.forEach(point => ctx.lineTo(point.x, point.y));
      ctx.stroke();
    });
  }, [strokes]);

  const toDataURL = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return null;
    return canvas.toDataURL('image/png');
  }, [hasSignature]);

  return {
    canvasRef,
    isDrawing,
    hasSignature,
    startDrawing,
    draw,
    stopDrawing,
    clear,
    undo,
    toDataURL
  };
};

/**
 * Signature Pad Component
 * @param {Object} props - Component props
 * @param {Function} props.onSignatureChange - Callback when signature changes
 * @param {string} props.label - Label text
 */
const SignaturePad = React.memo(({ onSignatureChange, label = 'Imzo' }) => {
  const { canvasRef, hasSignature, startDrawing, draw, stopDrawing, clear, undo, toDataURL } = 
    useSignaturePad(600, 200);

  useEffect(() => {
    onSignatureChange?.(hasSignature ? toDataURL() : null);
  }, [hasSignature, toDataURL, onSignatureChange]);

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">{label}</Label>
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg cursor-crosshair touch-none bg-white"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-gray-400 text-sm">Bu yerga imzo qo'ying</span>
          </div>
        )}
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={undo}
          disabled={!hasSignature}
        >
          <Undo className="w-4 h-4 mr-1" />
          Orqaga
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clear}
          disabled={!hasSignature}
        >
          <X className="w-4 h-4 mr-1" />
          Tozalash
        </Button>
      </div>
    </div>
  );
});
SignaturePad.displayName = 'SignaturePad';

/**
 * Form Preview Component
 * @param {Object} props - Component props
 * @param {FormTemplate} props.template - Form template
 * @param {Object} props.formData - Form field values
 */
const FormPreview = React.memo(({ template, formData }) => {
  const renderedContent = useMemo(() => {
    let content = template.content;
    Object.entries(formData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{${key}}`, 'g'), value || `{${key}}`);
    });
    content = content.replace(/{clinicName}/g, 'Dental Pro Clinic');
    return content;
  }, [template, formData]);

  return (
    <div className="bg-white p-8 rounded-lg border shadow-sm">
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">{template.title}</h2>
        <p className="text-sm text-gray-500 mt-1">{template.description}</p>
      </div>
      <Separator className="my-4" />
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700">
        {renderedContent}
      </div>
      <Separator className="my-6" />
      <div className="grid grid-cols-2 gap-8 mt-8">
        <div>
          <p className="text-xs text-gray-500 mb-2">Bemor imzosi:</p>
          <div className="h-16 border-b border-gray-400" />
          <p className="text-xs text-gray-500 mt-1">Sana: _______________</p>
        </div>
        {template.requiresWitness && (
          <div>
            <p className="text-xs text-gray-500 mb-2">Guvoh imzosi:</p>
            <div className="h-16 border-b border-gray-400" />
            <p className="text-xs text-gray-500 mt-1">Sana: _______________</p>
          </div>
        )}
      </div>
    </div>
  );
});
FormPreview.displayName = 'FormPreview';

/**
 * E-Signature Page Component
 * @returns {JSX.Element}
 */
export default function ESignature() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // State
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formData, setFormData] = useState({});
  const [signatureData, setSignatureData] = useState(null);
  const [witnessSignature, setWitnessSignature] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [viewSignature, setViewSignature] = useState(null);
  const [activeTab, setActiveTab] = useState('new');

  // Fetch patients
  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const response = await base44.get('/Patient');
      return response.data || [];
    }
  });

  // Fetch signatures
  const { data: signatures = [], isLoading: signaturesLoading } = useQuery({
    queryKey: ['signatures'],
    queryFn: async () => {
      const response = await base44.get('/Signature');
      return response.data || [];
    }
  });

  // Create signature mutation
  const createSignature = useMutation({
    mutationFn: async (data) => {
      const response = await base44.post('/Signature', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signatures'] });
      toast.success('Imzo saqlandi', {
        description: 'Elektron imzo muvaffaqiyatli saqlandi'
      });
      resetForm();
    },
    onError: (error) => {
      toast.error('Xatolik', {
        description: error.message || 'Imzoni saqlashda xatolik yuz berdi'
      });
    }
  });

  // Revoke signature mutation
  const revokeSignature = useMutation({
    mutationFn: async ({ id, reason }) => {
      const response = await base44.patch(`/Signature/${id}`, {
        status: 'revoked',
        revokedAt: new Date().toISOString(),
        revokeReason: reason
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signatures'] });
      toast.success('Imzo bekor qilindi', {
        description: 'Elektron imzo muvaffaqiyatli bekor qilindi'
      });
    }
  });

  /**
   * Reset form state
   */
  const resetForm = useCallback(() => {
    setSelectedTemplate(null);
    setSelectedPatient(null);
    setFormData({});
    setSignatureData(null);
    setWitnessSignature(null);
  }, []);

  /**
   * Handle form field change
   * @param {string} field - Field name
   * @param {string} value - Field value
   */
  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  /**
   * Handle patient selection
   * @param {string} patientId - Selected patient ID
   */
  const handlePatientSelect = useCallback((patientId) => {
    const patient = patients.find(p => p.id === patientId);
    setSelectedPatient(patient);
    if (patient) {
      setFormData(prev => ({
        ...prev,
        patientName: `${patient.firstName} ${patient.lastName}`,
        patientPhone: patient.phone,
        patientAddress: patient.address || ''
      }));
    }
  }, [patients]);

  /**
   * Validate form before submission
   * @returns {boolean}
   */
  const validateForm = useCallback(() => {
    if (!selectedTemplate) {
      toast.error('Xatolik', { description: 'Forma turini tanlang' });
      return false;
    }
    if (!selectedPatient) {
      toast.error('Xatolik', { description: 'Bemorni tanlang' });
      return false;
    }
    if (!signatureData) {
      toast.error('Xatolik', { description: 'Imzo qo\'ying' });
      return false;
    }

    const missingFields = selectedTemplate.requiredFields.filter(field => !formData[field]);
    if (missingFields.length > 0) {
      toast.error('Xatolik', { 
        description: `Quyidagi maydonlarni to'ldiring: ${missingFields.join(', ')}` 
      });
      return false;
    }

    if (selectedTemplate.requiresWitness && !witnessSignature) {
      toast.error('Xatolik', { description: 'Guvoh imzosi talab qilinadi' });
      return false;
    }

    return true;
  }, [selectedTemplate, selectedPatient, signatureData, formData, witnessSignature]);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(() => {
    if (!validateForm()) return;

    const signatureRecord = {
      patientId: selectedPatient.id,
      patientName: formData.patientName,
      formType: selectedTemplate.type,
      formTitle: selectedTemplate.title,
      signatureData,
      witnessSignature: selectedTemplate.requiresWitness ? witnessSignature : null,
      ipAddress: window.location.hostname,
      userAgent: navigator.userAgent,
      signedAt: new Date().toISOString(),
      formData,
      status: 'active',
      createdBy: user?.id
    };

    createSignature.mutate(signatureRecord);
  }, [validateForm, selectedPatient, formData, selectedTemplate, signatureData, witnessSignature, user, createSignature]);

  /**
   * Generate PDF from signature record
   * @param {SignatureData} signature - Signature record
   */
  const generatePDF = useCallback((signature) => {
    const template = FORM_TEMPLATES.find(t => t.type === signature.formType);
    if (!template) return;

    // Create printable window
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({ title: 'Xatolik', description: 'Print oynasini ochib bo\'lmadi', variant: 'destructive' });
      return;
    }

    let content = template.content;
    Object.entries(signature.formData).forEach(([key, value]) => {
      content = content.replace(new RegExp(`{${key}}`, 'g'), value || '');
    });

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${template.title}</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .title { font-size: 20px; font-weight: bold; margin-bottom: 10px; }
          .content { white-space: pre-wrap; line-height: 1.6; margin: 30px 0; }
          .signatures { display: flex; justify-content: space-between; margin-top: 50px; }
          .signature-box { text-align: center; width: 45%; }
          .signature-img { max-width: 100%; height: 80px; object-fit: contain; }
          .footer { margin-top: 40px; font-size: 12px; color: #666; }
          .id-code { font-family: monospace; background: #f0f0f0; padding: 5px 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${template.title}</div>
          <div>Dental Pro Clinic</div>
        </div>
        <div class="content">${content}</div>
        <div class="signatures">
          <div class="signature-box">
            <div>Bemor imzosi:</div>
            <img src="${signature.signatureData}" class="signature-img" alt="Signature" />
            <div>${formatDate(signature.signedAt)}</div>
          </div>
          ${signature.witnessSignature ? `
          <div class="signature-box">
            <div>Guvoh imzosi:</div>
            <img src="${signature.witnessSignature}" class="signature-img" alt="Witness" />
          </div>
          ` : ''}
        </div>
        <div class="footer">
          <p>Imzo ID: <span class="id-code">${signature.id}</span></p>
          <p>IP manzil: ${signature.ipAddress}</p>
          <p>Sana: ${formatDate(signature.signedAt)}</p>
          <p>Bu hujjat elektron tarzda imzolandi va qonuniy kuchga ega.</p>
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, []);

  // Filter signatures
  const filteredSignatures = useMemo(() => {
    return signatures.filter(sig => {
      const matchesSearch = sig.patientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          sig.formTitle?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || sig.formType === filterType;
      return matchesSearch && matchesType;
    });
  }, [signatures, searchQuery, filterType]);

  // Stats
  const stats = useMemo(() => ({
    total: signatures.length,
    active: signatures.filter(s => s.status === 'active').length,
    revoked: signatures.filter(s => s.status === 'revoked').length,
    today: signatures.filter(s => {
      const today = new Date().toDateString();
      return new Date(s.signedAt).toDateString() === today;
    }).length
  }), [signatures]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Elektron Imzo</h1>
          <p className="text-muted-foreground mt-1">
            Bemorlar rozilik formalarini elektron tarzda imzolash
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Jami imzolar</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileSignature className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Faol</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bekor qilingan</p>
                <p className="text-2xl font-bold">{stats.revoked}</p>
              </div>
              <X className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bugun</p>
                <p className="text-2xl font-bold">{stats.today}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="new">
            <Pen className="w-4 h-4 mr-2" />
            Yangi imzo
          </TabsTrigger>
          <TabsTrigger value="history">
            <FileText className="w-4 h-4 mr-2" />
            Imzolar tarixi
          </TabsTrigger>
        </TabsList>

        {/* New Signature Tab */}
        <TabsContent value="new" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* Left Column - Form Selection */}
            <div className="space-y-6">
              {/* Template Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Forma turini tanlang</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3">
                    {FORM_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        onClick={() => setSelectedTemplate(template)}
                        className={`p-4 text-left border rounded-lg transition-colors ${
                          selectedTemplate?.id === template.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium">{template.title}</div>
                        <div className="text-sm text-gray-500">{template.description}</div>
                        {template.requiresWitness && (
                          <Badge variant="secondary" className="mt-2">Guvoh talab etiladi</Badge>
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Patient Selection */}
              <Card>
                <CardHeader>
                  <CardTitle>Bemorni tanlang</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select value={selectedPatient?.id} onValueChange={handlePatientSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Bemorni tanlang" />
                    </SelectTrigger>
                    <SelectContent>
                      {patients.map(patient => (
                        <SelectItem key={patient.id} value={patient.id}>
                          {patient.firstName} {patient.lastName} - {patient.phone}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedTemplate?.requiredFields.map(field => (
                    <div key={field}>
                      <Label>
                        {field === 'patientName' && 'F.I.Sh.'}
                        {field === 'patientPhone' && 'Telefon'}
                        {field === 'patientAddress' && 'Manzil'}
                        {field === 'treatmentCost' && 'Davolash narxi'}
                        {field === 'paymentMethod' && 'To\'lov usuli'}
                        {field === 'emergencyContact' && 'Favqulodda kontakt'}
                        {field === 'emergencyPhone' && 'Favqulodda telefon'}
                      </Label>
                      <Input
                        value={formData[field] || ''}
                        onChange={(e) => handleFieldChange(field, e.target.value)}
                        placeholder="Kiriting..."
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Signature Pads */}
              <Card>
                <CardHeader>
                  <CardTitle>Imzo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <SignaturePad
                    label="Bemor imzosi"
                    onSignatureChange={setSignatureData}
                  />
                  {selectedTemplate?.requiresWitness && (
                    <SignaturePad
                      label="Guvoh imzosi"
                      onSignatureChange={setWitnessSignature}
                    />
                  )}
                </CardContent>
              </Card>

              <Button
                onClick={handleSubmit}
                disabled={createSignature.isPending}
                className="w-full"
                size="lg"
              >
                {createSignature.isPending ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Imzoni saqlash
              </Button>
            </div>

            {/* Right Column - Preview */}
            <div>
              <Card className="sticky top-6">
                <CardHeader>
                  <CardTitle>Forma ko'rinishi</CardTitle>
                  <CardDescription>Imzolanadigan forma shakli</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[600px]">
                    {selectedTemplate ? (
                      <FormPreview template={selectedTemplate} formData={formData} />
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <FileText className="w-12 h-12 mx-auto mb-4" />
                        <p>Forma turini tanlang</p>
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Bemor yoki forma nomi bo'yicha qidirish..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-48">
                    <Filter className="w-4 h-4 mr-2" />
                    <SelectValue placeholder="Barcha turlar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Barcha turlar</SelectItem>
                    {FORM_TEMPLATES.map(t => (
                      <SelectItem key={t.type} value={t.type}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Signatures List */}
          <div className="grid gap-4">
            {filteredSignatures.map(signature => (
              <Card key={signature.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                        <FileSignature className="w-6 h-6 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium">{signature.formTitle}</h3>
                        <p className="text-sm text-gray-500">{signature.patientName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={signature.status === 'active' ? 'default' : 'secondary'}>
                            {signature.status === 'active' ? 'Faol' : 'Bekor qilingan'}
                          </Badge>
                          <span className="text-xs text-gray-400">
                            {formatDate(signature.signedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewSignature(signature)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generatePDF(signature)}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      {signature.status === 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => revokeSignature.mutate({ id: signature.id, reason: 'Bemor so\'rovi' })}
                          disabled={revokeSignature.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredSignatures.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FileText className="w-12 h-12 mx-auto mb-4" />
                <p>Imzolar topilmadi</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* View Signature Dialog */}
      <Dialog open={!!viewSignature} onOpenChange={() => setViewSignature(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewSignature?.formTitle}</DialogTitle>
            <DialogDescription>
              {viewSignature?.patientName} - {viewSignature && formatDate(viewSignature.signedAt)}
            </DialogDescription>
          </DialogHeader>
          {viewSignature && (
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <img
                  src={viewSignature.signatureData}
                  alt="Signature"
                  className="max-h-32 mx-auto"
                />
              </div>
              <div className="text-sm space-y-2">
                <p><strong>Imzo ID:</strong> {viewSignature.id}</p>
                <p><strong>IP manzil:</strong> {viewSignature.ipAddress}</p>
                <p><strong>Status:</strong> {viewSignature.status === 'active' ? 'Faol' : 'Bekor qilingan'}</p>
                {viewSignature.revokedAt && (
                  <p><strong>Bekor qilingan:</strong> {formatDate(viewSignature.revokedAt)}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => generatePDF(viewSignature)} className="flex-1">
                  <Printer className="w-4 h-4 mr-2" />
                  Chop etish
                </Button>
                <Button variant="outline" onClick={() => setViewSignature(null)}>
                  Yopish
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

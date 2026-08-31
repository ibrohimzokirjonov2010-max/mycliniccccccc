import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/i18n/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Bell, Send, MessageCircle, Smartphone, Settings, 
  Loader2, CheckCircle2, XCircle, Phone,
  Clock, CheckSquare, Table as TableIcon, LayoutGrid, FileSpreadsheet, X,
  ArrowUp, ArrowDown, ArrowUpDown, Trash2, User
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { formatDateTime, cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * RECALL_RULES - Avtomatik recall qoidalar
 */
const RECALL_RULES = [
  { value: '1_month', label: '1 oy', days: 30, icon: '📅' },
  { value: '3_months', label: '3 oy', days: 90, icon: '📅' },
  { value: '6_months', label: '6 oy', days: 180, icon: '📅' },
  { value: '1_year', label: '1 yil', days: 365, icon: '📅' },
  { value: 'custom', label: 'Boshqa (Kalendar orqali)', days: 0, icon: '🗓️' },
];

const getTodayDateStr = () => new Date().toISOString().split('T')[0];

/**
 * RecallSystem Page - Professional Excel Spreadsheet View
 */
export default function RecallSystem() {
  const navigate = useNavigate();
  const { t, language } = useTranslation();
  const { user, isDoctor } = useAuth();
  
  const getRuleLabel = (value) => {
    if (language === 'ru') {
      switch (value) {
        case '1_month': return '1 месяц';
        case '3_months': return '3 месяца';
        case '6_months': return '6 месяцев';
        case '1_year': return '1 год';
        case 'custom': return 'Другое (Выбрать дату)';
        default: return value;
      }
    }
    if (language === 'en') {
      switch (value) {
        case '1_month': return '1 month';
        case '3_months': return '3 months';
        case '6_months': return '6 months';
        case '1_year': return '1 year';
        case 'custom': return 'Custom (From calendar)';
        default: return value;
      }
    }
    switch (value) {
      case '1_month': return '1 oy';
      case '3_months': return '3 oy';
      case '6_months': return '6 oy';
      case '1_year': return '1 yil';
      case 'custom': return 'Boshqa (Kalendar orqali)';
      default: return value;
    }
  };

  /**
   * Calculate recall date based on rule
   */
  const calculateRecallDate = (ruleValue, fromDate = new Date()) => {
    const rule = RECALL_RULES.find(r => r.value === ruleValue);
    if (!rule || rule.days === 0) return null;
    
    const date = new Date(fromDate || new Date());
    if (isNaN(date.getTime())) return null;
    date.setDate(date.getDate() + rule.days);
    return date.toISOString().split('T')[0];
  };
  
  // Data states
  const [recalls, setRecalls] = useState([]);
  const [patients, setPatients] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, upcoming, pending, contacted, completed, history
  const [selectedRecalls, setSelectedRecalls] = useState(new Set());
  
  // Density switcher
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('myclinic_recall_density') || 'compact';
  });
  const toggleDensity = (val) => {
    setDensity(val);
    localStorage.setItem('myclinic_recall_density', val);
  };

  // Sorting state
  const [sortField, setSortField] = useState('date');
  const [sortOrder, setSortOrder] = useState('asc');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedRecall, setSelectedRecall] = useState(null);
  const [deleteRecallId, setDeleteRecallId] = useState(null);

  // Form states
  const [form, setForm] = useState(() => {
    const today = getTodayDateStr();
    return {
      patient_id: '',
      patient_name: '',
      start_date: today,
      recall_date: calculateRecallDate('3_months', today) || today,
      recall_time: '09:00',
      reason: '',
      status: 'Pending',
      notes: '',
      send_telegram: true,
      send_sms: false,
      telegram_chat_id: '',
      phone: '',
      recall_rule: '3_months',
      treatment_type: ''
    };
  });

  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Settings state
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('myclinic_recall_settings');
    return saved ? JSON.parse(saved) : {
      auto_reminder: true,
      default_channel: 'telegram',
      reminder_1_day: true,
      reminder_2_hours: true,
      template_manual: 'Assalomu alaykum, {patient_name}! Sizga {clinic_name} klinikasida {reason} bo\'yicha eslatma yubormoqdamiz. Qabul vaqti: {recall_date} {recall_time}',
      template_1_day: 'Eslatma: Ertaga {recall_time} da {clinic_name} klinikasida {reason} uchun qabulingiz bor.',
      template_2_hours: 'Eslatma: Bugun {recall_time} da {clinic_name} klinikasida qabulingiz bor.'
    };
  });

  useEffect(() => {
    localStorage.setItem('myclinic_recall_settings', JSON.stringify(settings));
  }, [settings]);

  /**
   * Load all data
   */
  const load = useCallback(async () => {
    setLoading(true);
    try {
      let recallList = [];
      if (isDoctor && user?.id) {
        recallList = await base44.entities.Recall.filter({ doctor_id: user.id }, '-created_date', 100).catch(() => []);
      } else {
        recallList = await base44.entities.Recall.list('-created_date', 100);
      }
      
      const pats = await base44.entities.Patient.list('full_name', 200).catch(() => []);
      const history = await base44.entities.NotificationHistory?.list('-sent_at', 100).catch(() => []) || [];
      
      const enrichedRecalls = (recallList || []).map(recall => ({
        ...recall,
        priority: calculatePriority(recall),
        lastAction: getLastAction(recall, history),
        deliveryStatus: getDeliveryStatus(recall, history)
      }));
      
      setRecalls(enrichedRecalls);
      setPatients(pats || []);
      setNotificationHistory(history || []);
    } catch (error) {
      console.error('Failed to load recalls:', error);
      toast.error('Ma\'lumotlarni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }, [isDoctor, user?.id]);

  /**
   * Status Normalizer - prevents Radix Select case mismatch
   */
  const normalizeRecallStatus = (st) => {
    if (!st) return 'Pending';
    const lower = String(st).trim().toLowerCase();
    if (lower === 'pending' || lower === 'kutilmoqda' || lower === 'в ожидании') return 'Pending';
    if (lower === 'contacted' || lower === "bog'lanildi" || lower === 'boglanildi' || lower === 'связались') return 'Contacted';
    if (lower === 'scheduled' || lower === 'rejalashtirilgan' || lower === 'запланировано') return 'Scheduled';
    if (lower === 'completed' || lower === 'bajarildi' || lower === 'выполнено' || lower === 'yakunlangan') return 'Completed';
    if (lower === 'missed' || lower === "o'tkazib yuborildi" || lower === 'пропущено') return 'Missed';
    return 'Pending';
  };

  const calculatePriority = (recall) => {
    if (recall.priority && ['low', 'medium', 'high', 'urgent', 'overdue'].includes(String(recall.priority).toLowerCase())) {
      return String(recall.priority).toLowerCase();
    }
    if (!recall.recall_date) return 'low';
    const today = new Date();
    today.setHours(0,0,0,0);
    const recallDate = new Date(recall.recall_date);
    recallDate.setHours(0,0,0,0);
    const daysUntil = Math.ceil((recallDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'overdue';
    if (daysUntil === 0) return 'urgent';
    if (daysUntil <= 3) return 'high';
    if (daysUntil <= 7) return 'medium';
    return 'low';
  };

  const getLastAction = (recall, history) => {
    const recallHistory = history.filter(h => h.recall_id === recall.id);
    if (recallHistory.length === 0) return null;
    const lastAction = recallHistory.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
    return {
      type: lastAction.channel,
      time: lastAction.sent_at,
      status: lastAction.status
    };
  };

  const getDeliveryStatus = (recall, history) => {
    const recallHistory = history.filter(h => h.recall_id === recall.id);
    if (recallHistory.length === 0) return 'not_sent';
    const latest = recallHistory.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at))[0];
    return latest.status;
  };

  useEffect(() => { load(); }, [load]);

  /**
   * Status Counts
   */
  const statusCounts = useMemo(() => {
    const counts = {
      all: recalls.length,
      upcoming: 0,
      pending: 0,
      contacted: 0,
      completed: 0,
      history: notificationHistory.length
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    recalls.forEach(r => {
      const st = r.status || 'Pending';
      if (st === 'Pending') counts.pending += 1;
      else if (st === 'Contacted') counts.contacted += 1;
      else if (st === 'Completed') counts.completed += 1;

      if (r.recall_date) {
        const rDate = new Date(r.recall_date);
        if (rDate >= today && rDate <= nextWeek && st !== 'Completed') {
          counts.upcoming += 1;
        }
      }
    });

    return counts;
  }, [recalls, notificationHistory]);

  /**
   * Filtered Recalls
   */
  const filteredRecalls = useMemo(() => {
    let result = [...recalls];
    
    // Search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => 
        (r.patient_name || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.patient_phone || '').includes(q) ||
        (r.notes || '').toLowerCase().includes(q)
      );
    }
    
    // Tab Filter
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (activeTab === 'upcoming') {
      result = result.filter(r => {
        if (!r.recall_date) return false;
        const rDate = new Date(r.recall_date);
        return rDate >= today && rDate <= nextWeek && r.status !== 'Completed';
      });
    } else if (activeTab === 'pending') {
      result = result.filter(r => (r.status || 'Pending') === 'Pending');
    } else if (activeTab === 'contacted') {
      result = result.filter(r => r.status === 'Contacted');
    } else if (activeTab === 'completed') {
      result = result.filter(r => r.status === 'Completed');
    }

    // Sorting
    result.sort((a, b) => {
      let valA, valB;
      switch (sortField) {
        case 'patient':
          valA = (a.patient_name || '').toLowerCase();
          valB = (b.patient_name || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'priority': {
          const priorityOrder = { overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 };
          valA = priorityOrder[a.priority] !== undefined ? priorityOrder[a.priority] : 5;
          valB = priorityOrder[b.priority] !== undefined ? priorityOrder[b.priority] : 5;
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        case 'status':
          valA = (a.status || '').toLowerCase();
          valB = (b.status || '').toLowerCase();
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'date':
        default:
          valA = new Date(`${a.recall_date || '1970-01-01'}T${a.recall_time || '00:00'}`).getTime();
          valB = new Date(`${b.recall_date || '1970-01-01'}T${b.recall_time || '00:00'}`).getTime();
          return sortOrder === 'asc' ? valA - valB : valB - valA;
      }
    });
    
    return result;
  }, [recalls, search, activeTab, sortField, sortOrder]);

  /**
   * Bulk actions
   */
  const toggleRecallSelection = useCallback((recallId) => {
    setSelectedRecalls(prev => {
      const next = new Set(prev);
      if (next.has(recallId)) next.delete(recallId);
      else next.add(recallId);
      return next;
    });
  }, []);

  const selectAllRecalls = useCallback(() => {
    if (selectedRecalls.size === filteredRecalls.length && filteredRecalls.length > 0) {
      setSelectedRecalls(new Set());
    } else {
      setSelectedRecalls(new Set(filteredRecalls.map(r => r.id)));
    }
  }, [filteredRecalls, selectedRecalls.size]);

  const bulkSendRecalls = useCallback(async (recallIds) => {
    setSending(true);
    try {
      const selected = recalls.filter(r => recallIds.includes(r.id));
      for (const recall of selected) {
        if (recall.telegram_chat_id) {
          const msg = `Assalomu alaykum, ${recall.patient_name}! Eslatib o'tamiz: ${recall.recall_date} sanasida qabulingiz bor.`;
          await base44.integrations?.Telegram?.sendMessage?.({
            chat_id: recall.telegram_chat_id,
            text: msg
          }).catch(() => {});
        }
        await base44.entities.Recall.update(recall.id, { status: 'Contacted' }).catch(() => {});
      }
      toast.success(`${selected.length} ta eslatma yuborildi!`);
      setSelectedRecalls(new Set());
      await load();
    } catch (error) {
      console.error('Bulk send failed:', error);
      toast.error('Yuborishda xatolik yuz berdi');
    } finally {
      setSending(false);
    }
  }, [recalls, load]);

  const sendNotification = useCallback(async (channel) => {
    if (!selectedRecall) return;
    setSending(true);
    try {
      const message = `Assalomu alaykum, ${selectedRecall.patient_name}! Eslatib o'tamiz: ${selectedRecall.recall_date} ${selectedRecall.recall_time || ''} da qabulingiz bor (${selectedRecall.reason || 'Ko\'rik'}).`;
      
      if (channel === 'telegram' && selectedRecall.telegram_chat_id) {
        await base44.integrations?.Telegram?.sendMessage?.({
          chat_id: selectedRecall.telegram_chat_id,
          text: message
        });
      }

      await base44.entities.NotificationHistory?.create({
        recall_id: selectedRecall.id,
        patient_id: selectedRecall.patient_id,
        patient_name: selectedRecall.patient_name,
        channel,
        message,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });

      await base44.entities.Recall.update(selectedRecall.id, { status: 'Contacted' });

      toast.success("Eslatma muvaffaqiyatli yuborildi!");
      setSendModalOpen(false);
      setSelectedRecall(null);
      await load();
    } catch (error) {
      console.error('Failed to send notification:', error);
      toast.error("Xabar yuborishda xatolik");
    } finally {
      setSending(false);
    }
  }, [selectedRecall, load]);

  const updateStatus = useCallback(async (id, status) => {
    try {
      await base44.entities.Recall.update(id, { status });
      toast.success("Holat yangilandi!");
      await load();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error("Holatni o'zgartirishda xatolik");
    }
  }, [load]);

  const handleDeleteRecall = async () => {
    if (!deleteRecallId) return;
    try {
      await base44.entities.Recall.delete(deleteRecallId);
      toast.success("Eslatma o'chirildi!");
      setDeleteRecallId(null);
      await load();
    } catch (err) {
      console.error(err);
      toast.error("O'chirishda xatolik");
    }
  };

  const handleOpenNewModal = () => {
    const today = getTodayDateStr();
    const rule = '3_months';
    const autoDate = calculateRecallDate(rule, today);
    setForm({
      patient_id: '',
      patient_name: '',
      start_date: today,
      recall_date: autoDate || today,
      recall_time: '09:00',
      reason: '',
      status: 'Pending',
      notes: '',
      send_telegram: true,
      send_sms: false,
      telegram_chat_id: '',
      phone: '',
      recall_rule: rule,
      treatment_type: ''
    });
    setModalOpen(true);
  };

  const handleSave = useCallback(async () => {
    if (!form.patient_id || !form.recall_date) return;
    setSaving(true);
    try {
      const patient = patients.find(p => p.id === form.patient_id);
      const recallData = {
        ...form,
        patient_name: patient?.full_name || form.patient_name,
        patient_phone: patient?.phone || form.phone,
        telegram_chat_id: patient?.telegram_chat_id || form.telegram_chat_id,
      };
      
      await base44.entities.Recall.create(recallData);
      toast.success("Yangi eslatma yaratildi!");
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error('Failed to save recall:', error);
      toast.error("Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  }, [form, patients, load]);

  /**
   * Export to CSV with UTF-8 BOM
   */
  const exportCSV = useCallback(() => {
    try {
      if (!filteredRecalls || filteredRecalls.length === 0) {
        toast.warning("Eksport qilish uchun ma'lumot topilmadi");
        return;
      }
      const headers = [
        "№",
        "Bemor (F.I.Sh)",
        "Telefon",
        "Eslatma Sanasi",
        "Vaqti",
        "Muhimlik",
        "Turi / Izoh",
        "Holat"
      ];
      const rows = filteredRecalls.map((r, idx) => {
        return [
          idx + 1,
          `"${(r.patient_name || '').replace(/"/g, '""')}"`,
          `"${(r.patient_phone || '').replace(/"/g, '""')}"`,
          `"${r.recall_date || ''}"`,
          `"${r.recall_time || ''}"`,
          `"${r.priority || ''}"`,
          `"${(r.reason || '').replace(/"/g, '""')}"`,
          `"${r.status || 'Pending'}"`
        ].join(",");
      });

      const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `Eslatmalar_Recall_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Eslatmalar Excel (.csv) formatida yuklab olindi!");
    } catch (err) {
      console.error(err);
      toast.error("Eksportda xatolik yuz berdi");
    }
  }, [filteredRecalls]);

  const getStatusBadge = (status) => {
    const s = normalizeRecallStatus(status);
    if (language === 'ru') {
      switch (s) {
        case 'Completed':
          return { label: 'Выполнено', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'Contacted':
          return { label: 'Связались', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
        case 'Scheduled':
          return { label: 'Запланировано', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
        case 'Missed':
          return { label: 'Пропущено', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'Pending':
        default:
          return { label: 'В ожидании', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
    }
    if (language === 'en') {
      switch (s) {
        case 'Completed':
          return { label: 'Completed', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
        case 'Contacted':
          return { label: 'Contacted', bg: 'bg-blue-50 text-blue-700 border-blue-200' };
        case 'Scheduled':
          return { label: 'Scheduled', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
        case 'Missed':
          return { label: 'Missed', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
        case 'Pending':
        default:
          return { label: 'Pending', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
    }
    switch (s) {
      case 'Completed':
        return { label: 'Bajarildi', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'Contacted':
        return { label: "Bog'lanildi", bg: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'Scheduled':
        return { label: 'Rejalashtirilgan', bg: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'Missed':
        return { label: "O'tkazib yuborildi", bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'Pending':
      default:
        return { label: 'Kutilmoqda', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
  };

  const getPriorityBadge = (priority) => {
    const p = String(priority || 'low').toLowerCase();
    if (language === 'ru') {
      switch (p) {
        case 'overdue':
          return { label: 'Просрочено', bg: 'bg-rose-100 text-rose-800 border-rose-300 font-black' };
        case 'urgent':
          return { label: '🔥 Срочно', bg: 'bg-red-50 text-red-700 border-red-200 font-black' };
        case 'high':
          return { label: 'Высокий', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-bold' };
        case 'medium':
          return { label: 'Средний', bg: 'bg-blue-50 text-blue-700 border-blue-200 font-bold' };
        case 'low':
        default:
          return { label: 'Низкий', bg: 'bg-slate-100 text-slate-600 border-slate-200 font-medium' };
      }
    }
    if (language === 'en') {
      switch (p) {
        case 'overdue':
          return { label: 'Overdue', bg: 'bg-rose-100 text-rose-800 border-rose-300 font-black' };
        case 'urgent':
          return { label: '🔥 Urgent', bg: 'bg-red-50 text-red-700 border-red-200 font-black' };
        case 'high':
          return { label: 'High', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-bold' };
        case 'medium':
          return { label: 'Medium', bg: 'bg-blue-50 text-blue-700 border-blue-200 font-bold' };
        case 'low':
        default:
          return { label: 'Low', bg: 'bg-slate-100 text-slate-600 border-slate-200 font-medium' };
      }
    }
    switch (p) {
      case 'overdue':
        return { label: "Muddati o'tgan", bg: 'bg-rose-100 text-rose-800 border-rose-300 font-black' };
      case 'urgent':
        return { label: '🔥 Dolzarb', bg: 'bg-red-50 text-red-700 border-red-200 font-black' };
      case 'high':
        return { label: 'Yuqori', bg: 'bg-amber-50 text-amber-800 border-amber-300 font-bold' };
      case 'medium':
        return { label: "O'rta", bg: 'bg-blue-50 text-blue-700 border-blue-200 font-bold' };
      case 'low':
      default:
        return { label: 'Past', bg: 'bg-slate-100 text-slate-600 border-slate-200 font-medium' };
    }
  };

  const cleanRecallReason = (recall) => {
    let rText = (recall.reason || recall.treatment_type || '').trim();
    if (!rText || rText.toLowerCase().includes('fdsfds') || rText.toLowerCase().includes('sdfsdf') || rText === 'gdfgdf') {
      rText = "Profilaktik ko'rik";
    }
    if (language === 'ru') {
      return rText
        .replace(/Profilaktik ko'rik/gi, 'Профилактический осмотр')
        .replace(/qayta ko'rik/gi, 'повторный осмотр')
        .replace(/Tish tozalash/gi, 'Чистка зубов')
        .replace(/Plomba/gi, 'Пломба')
        .replace(/Implant nazorati/gi, 'Контроль импланта');
    }
    return rText;
  };

  const cleanRecallNotes = (notes) => {
    if (!notes) return null;
    const trimmed = String(notes).trim();
    if (!trimmed || trimmed.toLowerCase().includes('sdfsdf') || trimmed.toLowerCase().includes('fdsfds') || trimmed.toLowerCase().includes('test')) {
      return null;
    }
    return trimmed;
  };

  return (
    <div className="space-y-3.5 pb-4">
      {/* ─── Excel Header Bar ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-slate-900 tracking-tight">{t('recall.title') || "Eslatmalar & Recall"}</h1>
            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
              {language === 'ru' ? `• АВТОМАТИЧЕСКИЙ ПОВТОРНЫЙ ВЫЗОВ: ${recalls.length} НАПОМИНАНИЙ` : language === 'en' ? `• AUTO RECALL: ${recalls.length} REMINDERS` : `• AVTOMATIK QAYTA CHAQIRISH: ${recalls.length} TA ESLATMA`}
            </span>
          </div>
          <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
            {t('recall.subtitle') || (language === 'ru' ? 'Реестр профилактических осмотров, этапов лечения и напоминаний пациентов' : 'Bemorlarni profilaktik ko\'riklar, davolash bosqichlari va eslatmalari reyestri')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-1.5 h-9.5 rounded-xl border-slate-200 text-xs font-bold text-slate-700 hover:text-[#1499AD] hover:bg-slate-50 bg-white shadow-xs cursor-pointer"
            title={language === 'ru' ? 'Настройка правил авто-напоминаний (1, 3, 6 месяцев, Telegram/SMS)' : 'Avtomatik eslatma va qayta chaqirish qoidalari sozlamalari'}
          >
            <Settings className="w-3.5 h-3.5 text-[#1499AD]" />
            <span>{language === 'ru' ? 'Авто-правила & Настройки' : language === 'en' ? 'Auto Rules & Settings' : "Avto-qoidalar & Sozlamalar"}</span>
          </Button>

          <Button 
            onClick={handleOpenNewModal} 
            className="bg-[#00D084] hover:bg-[#00B875] text-white gap-1.5 border-none rounded-xl h-9.5 px-4 font-black text-xs shadow-md shadow-[#00D084]/20 transition-all active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t('recall.newRecall') || "Yangi recall"}</span>
          </Button>
        </div>
      </div>

      {/* ─── Top Executive KPI Grid ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { 
            label: language === 'ru' ? "ВСЕГО НАПОМИНАНИЙ" : language === 'en' ? "TOTAL REMINDERS" : "JAMI ESLATMALAR", 
            value: statusCounts.all, 
            icon: Bell, 
            color: "text-blue-600", 
            bg: "bg-blue-50 border-blue-100", 
            countText: language === 'ru' ? "Все запланированные напоминания" : language === 'en' ? "All scheduled reminders" : "Barcha rejalashtirilgan eslatmalar" 
          },
          { 
            label: language === 'ru' ? "В ОЖИДАНИИ" : language === 'en' ? "PENDING" : "KUTILMOQDA (PENDING)", 
            value: statusCounts.pending, 
            icon: Clock, 
            color: "text-amber-600", 
            bg: "bg-amber-50 border-amber-100", 
            countText: language === 'ru' ? "Еще не отправленные напоминания" : language === 'en' ? "Reminders not sent yet" : "Hali yuborilmagan eslatmalar" 
          },
          { 
            label: language === 'ru' ? "ПРЕДСТОЯЩИЕ (7 ДНЕЙ)" : language === 'en' ? "UPCOMING (7 DAYS)" : "YAQINLASHAYOTGAN (7 KUN)", 
            value: statusCounts.upcoming, 
            icon: CheckCircle2, 
            color: "text-purple-600", 
            bg: "bg-purple-50 border-purple-100", 
            countText: language === 'ru' ? "Вызовы на этой неделе" : language === 'en' ? "Scheduled for this week" : "Shu haftada chaqiriladiganlar" 
          },
          { 
            label: language === 'ru' ? "ОТПРАВЛЕННЫЕ СООБЩЕНИЯ" : language === 'en' ? "SENT MESSAGES" : "YUBORILGAN XABARLAR", 
            value: statusCounts.history, 
            icon: Send, 
            color: "text-emerald-600", 
            bg: "bg-emerald-50 border-emerald-100", 
            countText: language === 'ru' ? "Отправлено через Telegram и SMS" : language === 'en' ? "Sent via Telegram and SMS" : "Telegram va SMS orqali yuborilgan" 
          },
        ].map((s, i) => (
          <motion.div 
            key={s.label}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.03 }}
            className="bg-white border border-slate-200/90 rounded-2xl p-3.5 shadow-xs flex items-center justify-between relative overflow-hidden"
          >
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                {s.label}
              </span>
              <div className="text-lg sm:text-xl font-black font-mono tracking-tight text-slate-900 tabular-nums">
                {s.value} <span className="text-xs font-bold text-slate-400">{language === 'ru' ? '' : 'ta'}</span>
              </div>
              <p className="text-[9.5px] font-medium text-slate-400 mt-0.5">{s.countText}</p>
            </div>

            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-xs shrink-0 ${s.bg}`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* ─── Bulk Action Sticky Banner ──────────────────────────────── */}
      <AnimatePresence>
        {selectedRecalls.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 text-white rounded-2xl p-3 px-4 flex items-center justify-between gap-4 sticky top-4 z-50 shadow-xl"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span className="font-black text-xs">
                {selectedRecalls.size} {language === 'ru' ? 'напоминаний выбрано' : language === 'en' ? 'reminders selected' : 'ta eslatma tanlandi'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => bulkSendRecalls(Array.from(selectedRecalls))}
                disabled={sending}
                className="bg-emerald-500 hover:bg-emerald-600 gap-1.5 h-8 px-3.5 text-xs font-bold border-none"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{language === 'ru' ? 'Отправить всем' : language === 'en' ? 'Send to all' : 'Barchasiga yuborish'}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRecalls(new Set())}
                className="text-white/70 hover:text-white hover:bg-white/10 h-8 px-2.5 text-xs font-bold"
              >
                {language === 'ru' ? 'Отмена' : language === 'en' ? 'Cancel' : 'Bekor qilish'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Excel Spreadsheet Controls Bar ────────────────────────── */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          
          {/* Search Box */}
          <div className="relative flex-1 group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-[#1499AD] transition-colors" />
            <input 
              type="text" 
              placeholder={t('recall.searchPlaceholder') || (language === 'ru' ? "Поиск по имени пациента, номеру телефона или типу процедуры..." : "Bemor ismi, telefon raqami yoki muolaja turi bo'yicha qidiruv...")}
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

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0 scrollbar-none">
            {[
              { id: 'all', label: language === 'ru' ? "Все" : language === 'en' ? "All" : "Barchasi", count: statusCounts.all },
              { id: 'upcoming', label: language === 'ru' ? "Предстоящие" : language === 'en' ? "Upcoming" : "Yaqinlashayotgan", count: statusCounts.upcoming },
              { id: 'pending', label: language === 'ru' ? "В ожидании" : language === 'en' ? "Pending" : "Kutilmoqda", count: statusCounts.pending },
              { id: 'contacted', label: language === 'ru' ? "Связались" : language === 'en' ? "Contacted" : "Bog'lanildi", count: statusCounts.contacted },
              { id: 'completed', label: language === 'ru' ? "Выполнено" : language === 'en' ? "Completed" : "Bajarildi", count: statusCounts.completed },
              { id: 'history', label: language === 'ru' ? "История сообщений" : language === 'en' ? "History" : "Xabarlar Tarixi", count: statusCounts.history },
            ].map(tab => {
              const isActive = activeTab === tab.id;
              const hasCount = tab.count > 0;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer",
                    isActive 
                      ? "bg-slate-900 text-white shadow-xs font-black" 
                      : (hasCount 
                          ? "bg-slate-100/90 text-slate-700 hover:bg-slate-200/80 hover:text-slate-900 border border-slate-200/80" 
                          : "bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-600 border border-slate-200/50 opacity-65")
                  )}
                >
                  <span>{tab.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[9px] font-black font-mono",
                    isActive 
                      ? "bg-white/20 text-white" 
                      : (hasCount ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-400")
                  )}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Main Content View (Recalls vs Notification History) ──────── */}
      {activeTab === 'history' ? (
        /* History Excel Table */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0">
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 font-mono">№</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Bemor (F.I.Sh)</th>
                  <th className="w-32 px-3 py-2.5 text-center border-r border-slate-200">Kanal</th>
                  <th className="px-3.5 py-2.5 border-r border-slate-200">Yuborilgan Xabar</th>
                  <th className="w-44 px-3.5 py-2.5 border-r border-slate-200">Yuborilgan Vaqt</th>
                  <th className="w-32 px-3 py-2.5 text-center">Holat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {notificationHistory.length > 0 ? (
                  notificationHistory.map((item, idx) => (
                    <tr key={item.id || idx} className="hover:bg-slate-50">
                      <td className="text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 py-2.5 px-2">
                        {idx + 1}
                      </td>
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 border-r border-slate-200/70">
                        {item.patient_name || 'Bemor'}
                      </td>
                      <td className="px-3 py-2.5 text-center border-r border-slate-200/70">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-700">
                          {item.channel === 'telegram' ? (
                            <><MessageCircle className="w-3.5 h-3.5 text-blue-500" /> Telegram</>
                          ) : (
                            <><Smartphone className="w-3.5 h-3.5 text-green-500" /> SMS</>
                          )}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-600 border-r border-slate-200/70 font-mono text-[11px] truncate max-w-md">
                        {item.message || '—'}
                      </td>
                      <td className="px-3.5 py-2.5 text-slate-500 border-r border-slate-200/70 font-mono">
                        {formatDateTime(item.sent_at)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {item.status === 'sent' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[11px] bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Yuborildi
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-red-700 font-bold text-[11px] bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                            <XCircle className="w-3.5 h-3.5" /> Xatolik
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-slate-400">
                      Hali xabarlar yuborilmagan
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      ) : (
        /* Recalls Excel Grid Table */
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden relative"
        >
          {loading && (
            <div className="absolute inset-x-0 top-0 h-0.5 bg-slate-100 overflow-hidden z-20">
              <motion.div 
                className="h-full bg-gradient-to-r from-[#1499AD] to-[#0E7A8A]"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left select-text">
              {/* ─── Excel Table Header ────────────────── */}
              <thead>
                <tr className="bg-slate-100/90 border-b border-slate-200 text-slate-600 text-[10.5px] font-black uppercase tracking-wider sticky top-0 z-10 backdrop-blur-xs">
                  
                  {/* Select All Checkbox */}
                  <th className="w-10 px-2.5 py-2.5 text-center border-r border-slate-200 select-none">
                    <Checkbox 
                      checked={selectedRecalls.size === filteredRecalls.length && filteredRecalls.length > 0}
                      onCheckedChange={selectAllRecalls}
                    />
                  </th>

                  {/* № Col */}
                  <th className="w-12 px-2.5 py-2.5 text-center border-r border-slate-200 select-none font-mono">
                    №
                  </th>

                  {/* BEMOR (F.I.SH) */}
                  <th 
                    onClick={() => handleSort('patient')}
                    className="px-3.5 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none min-w-[200px]"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('recall.patientCol') || (language === 'ru' ? 'Пациент (Ф.И.О)' : 'Bemor (F.I.Sh)')}</span>
                      {sortField === 'patient' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* SANA */}
                  <th 
                    onClick={() => handleSort('date')}
                    className="w-36 px-3 py-2.5 border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{t('recall.reminderDateCol') || (language === 'ru' ? 'Дата напоминания' : 'Eslatma Sanasi')}</span>
                      {sortField === 'date' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#1499AD]" /> : <ArrowDown className="w-3 h-3 text-[#1499AD]" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* MUHIMLIK */}
                  <th 
                    onClick={() => handleSort('priority')}
                    className="w-32 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>{t('recall.priorityCol') || (language === 'ru' ? 'Приоритет' : 'Muhimlik')}</span>
                      {sortField === 'priority' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* TURI / IZOH */}
                  <th className="px-3.5 py-2.5 border-r border-slate-200 select-none min-w-[180px]">
                    {t('recall.treatmentReasonCol') || (language === 'ru' ? 'Тип лечения / Примечание' : 'Davolash Turi / Izoh')}
                  </th>

                  {/* STATUS */}
                  <th 
                    onClick={() => handleSort('status')}
                    className="w-40 px-3 py-2.5 text-center border-r border-slate-200 cursor-pointer hover:bg-slate-200/60 transition-colors select-none whitespace-nowrap"
                  >
                    <div className="flex items-center justify-center gap-1.5 text-slate-700">
                      <span>{t('recall.statusCol') || (language === 'ru' ? 'Статус' : 'Holat')}</span>
                      {sortField === 'status' ? (
                        sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-30" />
                      )}
                    </div>
                  </th>

                  {/* Actions */}
                  <th className="w-32 px-2 py-2.5 text-center text-slate-500 whitespace-nowrap select-none">
                    {t('common.actions') || "Amallar"}
                  </th>

                </tr>
              </thead>

              {/* ─── Excel Table Body ────────────────── */}
              <tbody className="divide-y divide-slate-200/70 text-xs">
                {filteredRecalls.length > 0 ? (
                  filteredRecalls.map((recall, idx) => {
                    const isCompact = density === 'compact';
                    const isSelected = selectedRecalls.has(recall.id);
                    const priority = getPriorityBadge(recall.priority);
                    const status = getStatusBadge(recall.status);

                    return (
                      <tr 
                        key={recall.id} 
                        className={`group hover:bg-[#1499AD]/10 hover:shadow-xs transition-colors cursor-pointer ${
                          isSelected ? 'bg-blue-50/60' : (idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white')
                        }`}
                      >
                        {/* Checkbox Cell */}
                        <td className="text-center border-r border-slate-200/70 px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleRecallSelection(recall.id)}
                          />
                        </td>

                        {/* № Cell */}
                        <td className={`text-center font-mono font-bold text-slate-400 border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-2 px-2' : 'py-3 px-2.5'}`}>
                          {idx + 1}
                        </td>

                        {/* BEMOR (F.I.SH) Cell */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-6.5 h-6.5 rounded-lg bg-purple-50 text-purple-700 font-black text-[10px] flex items-center justify-center border border-purple-100 shrink-0">
                              <User className="w-3.5 h-3.5 text-purple-600" />
                            </div>
                            <div className="min-w-0">
                              <span 
                                onClick={(e) => {
                                  if (recall.patient_id) {
                                    e.stopPropagation();
                                    navigate(`/patients/${recall.patient_id}`);
                                  }
                                }}
                                className="font-extrabold text-slate-900 hover:text-blue-600 transition-colors truncate block hover:underline"
                              >
                                {recall.patient_name || 'Noma\'lum bemor'}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400 block truncate">
                                {recall.patient_phone || 'Telefon yo\'q'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* ESLATMA SANASI Cell */}
                        <td className={`border-r border-slate-200/70 font-mono ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <div className="font-bold text-slate-900">
                            {recall.recall_date || '—'}
                          </div>
                          {recall.recall_time && (
                            <div className="text-[10px] text-slate-400 font-semibold">
                              {recall.recall_time}
                            </div>
                          )}
                        </td>

                        {/* MUHIMLIK Cell */}
                        <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1.5 px-2' : 'py-2.5 px-2.5'}`}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${priority.bg}`}>
                            {priority.label}
                          </span>
                        </td>

                        {/* DAVOLASH TURI / IZOH Cell */}
                        <td className={`border-r border-slate-200/70 ${isCompact ? 'py-1.5 px-3' : 'py-2.5 px-3.5'}`}>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-800 truncate block">
                              {cleanRecallReason(recall)}
                            </span>
                            {cleanRecallNotes(recall.notes) && (
                              <span className="text-[10px] text-slate-400 truncate block">
                                {cleanRecallNotes(recall.notes)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* STATUS Cell */}
                        <td className={`text-center border-r border-slate-200/70 whitespace-nowrap ${isCompact ? 'py-1 px-2' : 'py-2 px-2.5'}`} onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const normStatus = normalizeRecallStatus(recall.status);
                            const statusInfo = getStatusBadge(normStatus);
                            return (
                              <Select 
                                value={normStatus} 
                                onValueChange={(val) => updateStatus(recall.id, val)}
                              >
                                <SelectTrigger className={cn(
                                  "h-7 px-2 rounded-lg font-bold text-[10px] uppercase tracking-wider mx-auto border transition-colors focus:ring-0 cursor-pointer",
                                  statusInfo.bg
                                )}>
                                  <SelectValue>{statusInfo.label}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="rounded-xl font-bold text-xs">
                                  <SelectItem value="Pending">{language === 'ru' ? 'В ожидании' : 'Kutilmoqda'}</SelectItem>
                                  <SelectItem value="Contacted">{language === 'ru' ? 'Связались' : "Bog'lanildi"}</SelectItem>
                                  <SelectItem value="Scheduled">{language === 'ru' ? 'Запланировано' : 'Rejalashtirilgan'}</SelectItem>
                                  <SelectItem value="Completed">{language === 'ru' ? 'Выполнено' : 'Bajarildi'}</SelectItem>
                                  <SelectItem value="Missed">{language === 'ru' ? 'Пропущено' : "O'tkazib yuborildi"}</SelectItem>
                                </SelectContent>
                              </Select>
                            );
                          })()}
                        </td>

                        {/* Actions Cell */}
                        <td className={`text-center whitespace-nowrap ${isCompact ? 'py-1 px-1.5' : 'py-2 px-2'}`} onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            {recall.patient_phone && (
                              <button 
                                onClick={() => { window.location.href = `tel:${recall.patient_phone}`; }}
                                className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all cursor-pointer"
                                title="Qo'ng'iroq qilish"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                            )}

                            <button 
                              onClick={() => { setSelectedRecall(recall); setSendModalOpen(true); }}
                              className="p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-all cursor-pointer"
                              title="Xabar yuborish (Telegram / SMS)"
                            >
                              <Send className="w-3.5 h-3.5" />
                            </button>

                            <button 
                              onClick={() => setDeleteRecallId(recall.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all cursor-pointer"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>

                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="py-20 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
                          <Bell className="w-6 h-6" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">
                          {search ? `"${search}" bo'yicha eslatma topilmadi` : "Eslatmalar mavjud emas"}
                        </p>
                        {(search || activeTab !== 'all') && (
                          <button
                            onClick={() => { setSearch(''); setActiveTab('all'); }}
                            className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                          >
                            Filtrlarni tozalash
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ─── Modals ─────────────────────────────────────────────────── */}

      {/* New Recall Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              {t('recall.modal.newTitle') || 'Yangi Recall (Eslatma) Yaratish'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('recall.modal.patient') || 'Bemor *'}</Label>
              <Select 
                value={form.patient_id} 
                onValueChange={v => {
                  const p = patients.find(pt => pt.id === v);
                  setForm({ 
                    ...form, 
                    patient_id: v, 
                    patient_name: p?.full_name || '',
                    phone: p?.phone || '',
                    telegram_chat_id: p?.telegram_chat_id || ''
                  });
                }}
              >
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs">
                  <SelectValue placeholder={t('common.select') || 'Bemorni tanlang'} />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-60">
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Boshlang'ich sana va Vaqt */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Boshlang'ich sana *</Label>
                <Input 
                  type="date" 
                  value={form.start_date || getTodayDateStr()} 
                  onChange={e => {
                    const newStart = e.target.value;
                    const newRecall = form.recall_rule !== 'custom' 
                      ? calculateRecallDate(form.recall_rule, newStart) 
                      : form.recall_date;
                    setForm({ 
                      ...form, 
                      start_date: newStart,
                      recall_date: newRecall || form.recall_date
                    });
                  }} 
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700">{t('recall.modal.time') || 'Vaqt'}</Label>
                <Input 
                  type="time" 
                  value={form.recall_time} 
                  onChange={e => setForm({ ...form, recall_time: e.target.value })} 
                  className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                />
              </div>
            </div>
            
            {/* Avtomatik davr & Eslatma sanasi */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">{t('recall.modal.rule') || 'Avtomatik davr'}</Label>
                <Select 
                  value={form.recall_rule} 
                  onValueChange={v => {
                    if (v === 'custom') {
                      setForm({ ...form, recall_rule: 'custom' });
                    } else {
                      const newDate = calculateRecallDate(v, form.start_date || getTodayDateStr());
                      setForm({ 
                        ...form, 
                        recall_rule: v,
                        recall_date: newDate || form.recall_date
                      });
                    }
                  }}
                >
                  <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-150 shadow-xl">
                    {RECALL_RULES.map(rule => (
                      <SelectItem key={rule.value} value={rule.value} className="font-bold text-xs py-2">
                        {rule.icon} {getRuleLabel(rule.value, rule.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">{t('recall.modal.date') || 'Eslatma sanasi *'}</Label>
                <Input 
                  type="date" 
                  value={form.recall_date} 
                  onChange={e => {
                    setForm({ 
                      ...form, 
                      recall_date: e.target.value,
                      recall_rule: 'custom'
                    });
                  }} 
                  className="h-10 rounded-xl bg-white border-[#1499AD]/40 font-bold text-xs text-[#1499AD]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-bold text-slate-700">{t('recall.modal.reason') || 'Davolash turi / Sabab'}</Label>
                <span className="text-[10px] text-slate-400">
                  {language === 'ru' ? '(По умолчанию: Профосмотр)' : '(Bo\'sh bo\'lsa: Profilaktik ko\'rik)'}
                </span>
              </div>
              <Input 
                value={form.treatment_type} 
                onChange={e => setForm({ ...form, treatment_type: e.target.value, reason: `${e.target.value} - qayta ko'rik` })} 
                placeholder={language === 'ru' ? 'Например: Профосмотр, Чистка зубов, Пломба' : "Masalan: Profilaktik ko'rik, Tish tozalash, Plomba nazorati"}
                className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
              />
              
              {/* Quick Choice Chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {[
                  { label: language === 'ru' ? "Профосмотр" : "Profilaktik ko'rik", val: language === 'ru' ? "Профилактический осмотр" : "Profilaktik ko'rik" },
                  { label: language === 'ru' ? "Чистка зубов" : "Tish tozalash", val: language === 'ru' ? "Чистка зубов (Air-Flow)" : "Tish tozalash (Air-Flow)" },
                  { label: language === 'ru' ? "Пломба" : "Plomba nazorati", val: language === 'ru' ? "Контроль пломбы" : "Plomba nazorati" },
                  { label: language === 'ru' ? "Брекеты" : "Breket tekshiruvi", val: language === 'ru' ? "Осмотр брекетов" : "Breket tekshiruvi" },
                  { label: language === 'ru' ? "Имплант" : "Implant nazorati", val: language === 'ru' ? "Контроль импланта" : "Implant nazorati" },
                ].map((chip, cIdx) => (
                  <button
                    key={cIdx}
                    type="button"
                    onClick={() => setForm({ ...form, treatment_type: chip.val, reason: `${chip.val} - qayta ko'rik` })}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-[#1499AD]/15 hover:text-[#1499AD] text-slate-600 transition-all border border-slate-200/80 cursor-pointer"
                  >
                    + {chip.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <Label className="text-xs font-bold text-slate-700">{t('recall.modal.notes') || 'Qo\'shimcha izohlar'}</Label>
              <Textarea 
                value={form.notes} 
                onChange={e => setForm({ ...form, notes: e.target.value })} 
                rows={2} 
                placeholder={language === 'ru' ? 'Дополнительные примечания для врача или пациента...' : "Shifokor yoki bemor uchun qo'shimcha eslatma..."}
                className="rounded-xl bg-slate-50 border-slate-200 text-xs mt-1"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setModalOpen(false)} className="rounded-xl h-10 px-4 text-xs font-bold cursor-pointer">
                {t('common.cancel') || 'Bekor qilish'}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !form.patient_id || !form.recall_date}
                className="bg-[#00D084] hover:bg-[#00B875] text-white rounded-xl h-10 px-5 text-xs font-black shadow-md border-none cursor-pointer"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saqlanmoqda...</>
                ) : (t('common.save') || 'Saqlash')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">{language === 'ru' ? 'Настройки авто-напоминаний' : 'Avtomatik eslatma sozlamalari'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div>
                <p className="font-bold text-xs text-slate-900">{language === 'ru' ? 'Автоматические напоминания' : 'Avtomatik eslatmalar'}</p>
                <p className="text-[11px] text-slate-500">{language === 'ru' ? 'Автоматически отправлять сообщение при наступлении даты Recall' : 'Recall sanasi kelganda avtomatik xabar yuborish'}</p>
              </div>
              <Switch 
                checked={settings.auto_reminder}
                onCheckedChange={v => setSettings({ ...settings, auto_reminder: v })}
              />
            </div>
            
            {/* Eslatma vaqtlari */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">{language === 'ru' ? 'Время напоминания (интервалы)' : 'Eslatma vaqtlari (oraliqlar)'}</Label>
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={settings.reminder_3_days}
                    onCheckedChange={v => setSettings({ ...settings, reminder_3_days: v })}
                  />
                  <span className="text-xs font-semibold text-slate-700">{language === 'ru' ? 'За 3 дня до' : '3 kun oldin'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={settings.reminder_1_day}
                    onCheckedChange={v => setSettings({ ...settings, reminder_1_day: v })}
                  />
                  <span className="text-xs font-semibold text-slate-700">{language === 'ru' ? 'За 1 день до' : '1 kun oldin'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={settings.reminder_2_hours}
                    onCheckedChange={v => setSettings({ ...settings, reminder_2_hours: v })}
                  />
                  <span className="text-xs font-semibold text-slate-700">{language === 'ru' ? 'За 2 часа до' : '2 soat oldin'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={settings.reminder_morning}
                    onCheckedChange={v => setSettings({ ...settings, reminder_morning: v })}
                  />
                  <span className="text-xs font-semibold text-slate-700">{language === 'ru' ? 'Утром в день приёма' : 'Qabul kuni ertalab (08:00)'}</span>
                </div>
              </div>
            </div>

            {/* Asosiy xabar kanali va Fallback */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">{language === 'ru' ? 'Основной канал сообщений' : 'Asosiy xabar kanali'}</Label>
              <Select 
                value={settings.default_channel || 'telegram_with_fallback'}
                onValueChange={v => setSettings({ ...settings, default_channel: v })}
              >
                <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="telegram_with_fallback" className="text-xs font-bold">
                    {language === 'ru' ? 'Telegram (с авто-переходом на SMS при отсутствии)' : 'Telegram (Telegram bo\'lmasa SMS zaxira)'}
                  </SelectItem>
                  <SelectItem value="sms" className="text-xs font-bold">
                    {language === 'ru' ? 'SMS уведомления' : 'SMS xabarnoma'}
                  </SelectItem>
                  <SelectItem value="telegram" className="text-xs font-bold">
                    {language === 'ru' ? 'Только Telegram' : 'Faqat Telegram'}
                  </SelectItem>
                  <SelectItem value="both" className="text-xs font-bold">
                    {language === 'ru' ? 'Telegram + SMS (Оба канала)' : 'Telegram + SMS (Ikkalasi ham)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Smart Fallback Switch */}
            <div className="flex items-center justify-between p-3 bg-blue-50/60 rounded-xl border border-blue-200/80">
              <div>
                <p className="font-bold text-xs text-blue-900">{language === 'ru' ? 'Резервный канал SMS (Fallback)' : 'SMS zaxira kanali (Fallback)'}</p>
                <p className="text-[11px] text-blue-700/80">{language === 'ru' ? 'Если у пациента нет Telegram бота, отправлять через SMS' : 'Bemor Telegram botdan foydalanmasa, eslatma SMS orqali yetkaziladi'}</p>
              </div>
              <Switch 
                checked={settings.fallback_sms !== false}
                onCheckedChange={v => setSettings({ ...settings, fallback_sms: v })}
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={() => setSettingsOpen(false)} className="rounded-xl h-10 px-4 text-xs font-bold cursor-pointer">
                {language === 'ru' ? 'Отмена' : 'Bekor qilish'}
              </Button>
              <Button 
                onClick={() => {
                  setSettingsOpen(false);
                  toast.success(language === 'ru' ? 'Настройки сохранены!' : 'Sozlamalar muvaffaqiyatli saqlandi!');
                }} 
                className="rounded-xl h-10 px-5 text-xs font-black bg-[#00D084] hover:bg-[#00B875] text-white shadow-md border-none cursor-pointer"
              >
                {language === 'ru' ? 'Сохранить' : 'Saqlash'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Notification Modal */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">Eslatma yuborish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {selectedRecall && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="font-bold text-xs text-slate-900">{selectedRecall.patient_name}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  {selectedRecall.recall_date} {selectedRecall.recall_time} ({selectedRecall.reason || 'Ko\'rik'})
                </p>
              </div>
            )}
            
            <p className="text-xs font-semibold text-slate-600">
              Xabar yuborish kanalini tanlang:
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="flex-col h-20 gap-2 rounded-xl border-slate-200 hover:border-blue-500 hover:bg-blue-50/50"
                onClick={() => sendNotification('telegram')}
                disabled={sending || !selectedRecall?.telegram_chat_id}
              >
                <MessageCircle className="w-6 h-6 text-blue-500" />
                <span className="text-xs font-bold">Telegram</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col h-20 gap-2 rounded-xl border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50"
                onClick={() => sendNotification('sms')}
                disabled={sending || !selectedRecall?.patient_phone}
              >
                <Smartphone className="w-6 h-6 text-emerald-500" />
                <span className="text-xs font-bold">SMS</span>
              </Button>
            </div>
            
            {sending && (
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-[#1499AD]" />
                Yuborilmoqda...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRecallId} onOpenChange={() => setDeleteRecallId(null)}>
        <AlertDialogContent className="rounded-2xl border-none shadow-3xl bg-white max-w-md p-6">
          <AlertDialogHeader>
            <div className="w-14 h-14 bg-rose-50 rounded-xl flex items-center justify-center text-rose-500 mb-3 mx-auto">
              <Trash2 className="w-7 h-7" />
            </div>
            <AlertDialogTitle className="text-xl font-bold text-slate-900 text-center uppercase tracking-tight">
              O'chirishni tasdiqlaysizmi?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-slate-500 text-center font-medium pt-1.5 text-sm">
              Ushbu eslatma o'chiriladi. Bu amalni ortga qaytarib bo'lmaydi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 flex gap-3">
            <AlertDialogCancel className="h-10 rounded-xl border-slate-200 font-bold uppercase text-[10px] tracking-wider flex-1 m-0">
              Bekor qilish
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecall} className="h-10 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-[10px] tracking-wider flex-1 m-0 shadow-md">
              O'chirish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

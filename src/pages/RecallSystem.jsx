import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, Bell, Send, MessageCircle, Smartphone, History, Settings, 
  Loader2, CheckCircle2, XCircle, Calendar, Phone,
  Filter, AlertCircle, Clock, CheckSquare,
  MoreHorizontal
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import EmptyState from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/utils';
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
 * REMINDER_TIMING - Eslatma vaqt rejimlari
 */
const REMINDER_TIMING = [
  { value: '1_day', label: '1 kun oldin', hours: 24 },
  { value: '2_hours', label: '2 soat oldin', hours: 2 },
  { value: '30_minutes', label: '30 daqiqa oldin', hours: 0.5 },
];

/**
 * NOTIFICATION_CHANNELS - Xabar yuborish kanallari
 */
const NOTIFICATION_CHANNELS = [
  { value: 'telegram', label: 'Telegram', icon: MessageCircle },
  { value: 'sms', label: 'SMS', icon: Smartphone },
];

/**
 * RECALL_STATUSES - Clear workflow statuses
 */
const RECALL_STATUSES = {
  DRAFT: { value: 'Draft', label: 'Qoralama', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  SCHEDULED: { value: 'Scheduled', label: 'Rejalashtirilgan', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  PENDING: { value: 'Pending', label: 'Kutilmoqda', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  SENT: { value: 'Sent', label: 'Yuborilgan', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  COMPLETED: { value: 'Completed', label: 'Bajarildi', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  FAILED: { value: 'Failed', label: 'Xatolik', color: 'bg-red-100 text-red-700 border-red-200' }
};

/**
 * RecallSystem Page - Professional Healthcare CRM
 */
export default function RecallSystem() {
  const { t, language } = useTranslation();
  
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
  const [selectedRecalls, setSelectedRecalls] = useState(new Set());
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [selectedRecall, setSelectedRecall] = useState(null);
  
  // Filter & sort states
  const [filterPriority, setFilterPriority] = useState('all'); // all, urgent, today, week
  const [sortBy, setSortBy] = useState('date_asc'); // date_asc, date_desc, priority

  // Form states
  const [form, setForm] = useState(() => {
    const today = getTodayDateStr();
    return {
      patient_id: '',
      patient_name: '',
      start_date: today, // Boshlang'ich sana
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
  
  // Settings states
  const [settings, setSettings] = useState({
    auto_reminder: true,
    reminder_1_day: true,
    reminder_2_hours: true,
    default_channel: 'telegram',
    telegram_bot_token: '',
    sms_api_key: '',
    sms_provider: 'eskiz'
  });
  
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  /**
   * Load all data with enhanced delivery tracking
   */
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [recs, pats, history] = await Promise.all([
        base44.entities.Recall.list('-recall_date', 50),   // ⚡ tez
        base44.entities.Patient.list('full_name', 50),       // ⚡ tez
        base44.entities.NotificationHistory?.list('-sent_at', 100) || Promise.resolve([])
      ]);
      
      // Enhance recalls with delivery status
      const enrichedRecalls = recs.map(recall => ({
        ...recall,
        priority: calculatePriority(recall),
        lastAction: getLastAction(recall, history),
        deliveryStatus: getDeliveryStatus(recall, history)
      }));
      
      setRecalls(enrichedRecalls);
      setPatients(pats);
      setNotificationHistory(history);
      // ✅ toast olib tashlandi — load funksiyasi endi [] bilan stable (loop xavfi yo'q)
    } catch (error) {
      console.error('Failed to load recalls:', error);
      toast.error('Xatolik', {
        description: 'Ma\'lumotlarni yuklashda xatolik yuz berdi'
      });
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Calculate recall priority based on date and status
   */
  const calculatePriority = (recall) => {
    const today = new Date();
    const recallDate = new Date(recall.recall_date);
    const daysUntil = Math.ceil((recallDate - today) / (1000 * 60 * 60 * 24));
    
    if (daysUntil < 0) return 'overdue';
    if (daysUntil === 0) return 'urgent';
    if (daysUntil <= 3) return 'high';
    if (daysUntil <= 7) return 'medium';
    return 'low';
  };

  /**
   * Get last action performed on recall
   */
  const getLastAction = (recall, history) => {
    const recallHistory = history.filter(h => h.recall_id === recall.id);
    if (recallHistory.length === 0) return null;
    
    const lastAction = recallHistory.sort((a, b) => 
      new Date(b.sent_at) - new Date(a.sent_at)
    )[0];
    
    return {
      type: lastAction.channel,
      time: lastAction.sent_at,
      status: lastAction.status
    };
  };

  /**
   * Get delivery status from notification history
   */
  const getDeliveryStatus = (recall, history) => {
    const recallHistory = history.filter(h => h.recall_id === recall.id);
    if (recallHistory.length === 0) return 'not_sent';
    
    const latest = recallHistory.sort((a, b) => 
      new Date(b.sent_at) - new Date(a.sent_at)
    )[0];
    
    return latest.status; // sent, failed, opened
  };

  useEffect(() => { load(); }, [load]);

  /**
   * Advanced filtering with priority and smart sorting
   */
  const filteredRecalls = useMemo(() => {
    let result = [...recalls];
    
    // Search filter (name, phone, last visit)
    if (search) {
      result = result.filter(r => 
        r.patient_name?.toLowerCase().includes(search.toLowerCase()) ||
        r.reason?.toLowerCase().includes(search.toLowerCase()) ||
        r.patient_phone?.includes(search)
      );
    }
    
    // Priority filter
    if (filterPriority === 'urgent') {
      result = result.filter(r => r.priority === 'urgent' || r.priority === 'overdue');
    } else if (filterPriority === 'today') {
      const today = new Date().toISOString().split('T')[0];
      result = result.filter(r => {
        if (!r || !r.recall_date) return false;
        const cleanDate = r.recall_date.includes('T') ? r.recall_date.split('T')[0] : r.recall_date.split(' ')[0];
        return cleanDate === today;
      });
    } else if (filterPriority === 'week') {
      const today = new Date();
      const weekLater = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      result = result.filter(r => {
        const recallDate = new Date(r.recall_date);
        return recallDate >= today && recallDate <= weekLater;
      });
    }
    
    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'date_asc') {
        return new Date(a.recall_date) - new Date(b.recall_date);
      } else if (sortBy === 'date_desc') {
        return new Date(b.recall_date) - new Date(a.recall_date);
      } else if (sortBy === 'priority') {
        const priorityOrder = { overdue: 0, urgent: 1, high: 2, medium: 3, low: 4 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return 0;
    });
    
    return result;
  }, [recalls, search, filterPriority, sortBy]);

  /**
   * Get upcoming recalls (next 7 days)
   */
  const upcomingRecalls = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    return filteredRecalls.filter(r => {
      const recallDate = new Date(r.recall_date);
      return recallDate >= today && recallDate <= nextWeek && r.status !== 'Completed';
    });
  }, [filteredRecalls]);

  /**
   * Auto-create recall from treatment completion
   * Real scenario: Dilshod came → got filling → 6 month recall scheduled
   */
  const createAutoRecall = useCallback(async (patientId, treatmentType, ruleValue = '6_months') => {
    try {
      const patient = patients.find(p => p.id === patientId);
      if (!patient) return;
      
      const recallDate = calculateRecallDate(ruleValue);
      if (!recallDate) return;
      
      const recallData = {
        patient_id: patientId,
        patient_name: patient.full_name,
        patient_phone: patient.phone,
        telegram_chat_id: patient.telegram_chat_id,
        recall_date: recallDate,
        recall_time: '09:00',
        reason: `${treatmentType} - qayta ko'rik`,
        treatment_type: treatmentType,
        status: 'Pending',
        notes: `Avtomatik yaratildi: ${treatmentType} davolashidan ${RECALL_RULES.find(r => r.value === ruleValue)?.label} o'tgach`,
        send_telegram: true,
        send_sms: false,
        recall_rule: ruleValue,
        notification_settings: {
          send_telegram: true,
          send_sms: false,
          reminder_1_day: true,
          reminder_2_hours: true
        }
      };
      
      await base44.entities.Recall.create(recallData);
      
      // Schedule automatic reminders
      if (settings.auto_reminder) {
        await scheduleReminders(recallData);
      }
      
      // Reload data
      await load();
      
      return recallData;
    } catch (error) {
      console.error('Failed to create auto recall:', error);
    }
  }, [patients, settings, load]);

  /**
   * Handle form save
   */
  const handleSave = useCallback(async () => {
    if (!form.patient_id || !form.recall_date) return;
    
    setSaving(true);
    try {
      const patient = patients.find(p => p.id === form.patient_id);
      const recallData = {
        ...form,
        patient_phone: patient?.phone,
        telegram_chat_id: patient?.telegram_chat_id,
        notification_settings: {
          send_telegram: form.send_telegram,
          send_sms: form.send_sms,
          reminder_1_day: settings.reminder_1_day,
          reminder_2_hours: settings.reminder_2_hours
        }
      };
      
      await base44.entities.Recall.create(recallData);
      
      // Schedule automatic reminders if enabled
      if (settings.auto_reminder) {
        await scheduleReminders(recallData);
      }
      
      setModalOpen(false);
      setForm({
        patient_id: '',
        patient_name: '',
        recall_date: '',
        recall_time: '09:00',
        reason: '',
        status: 'Pending',
        notes: '',
        send_telegram: true,
        send_sms: false,
        telegram_chat_id: '',
        phone: '',
        recall_rule: '6_months',
        treatment_type: ''
      });
      await load();
    } catch (error) {
      console.error('Failed to save recall:', error);
    } finally {
      setSaving(false);
    }
  }, [form, patients, settings, load]);

  /**
   * Schedule automatic reminders
   */
  const scheduleReminders = async (recallData) => {
    const recallDateTime = new Date(`${recallData.recall_date}T${recallData.recall_time}`);
    
    // 1 day reminder
    if (settings.reminder_1_day) {
      const reminder1Day = new Date(recallDateTime.getTime() - 24 * 60 * 60 * 1000);
      await base44.entities.ScheduledNotification?.create({
        recall_id: recallData.id,
        patient_id: recallData.patient_id,
        scheduled_at: reminder1Day.toISOString(),
        channel: settings.default_channel,
        message: generateReminderMessage(recallData, '1_day'),
        status: 'scheduled'
      });
    }
    
    // 2 hours reminder
    if (settings.reminder_2_hours) {
      const reminder2Hours = new Date(recallDateTime.getTime() - 2 * 60 * 60 * 1000);
      await base44.entities.ScheduledNotification?.create({
        recall_id: recallData.id,
        patient_id: recallData.patient_id,
        scheduled_at: reminder2Hours.toISOString(),
        channel: settings.default_channel,
        message: generateReminderMessage(recallData, '2_hours'),
        status: 'scheduled'
      });
    }
  };

/**
 * RECALL_TEMPLATES - Professional message templates
 */
const RECALL_TEMPLATES = [
  { id: 'hygiene', label: 'Gigiyena (6 oy)', text: 'Salom {name}! 🏥 Professional gigiyena vaqti keldi. Tish toshlarini tozalash sizni milk kasalliklaridan himoya qiladi. Kelishingizni kutamiz!' },
  { id: 'checkup', label: 'Profilaktik ko\'rik', text: 'Salom {name}! 🦷 Oxirgi ko\'rikdan beri ancha vaqt o\'tdi. Tekshiruvga kelib turish tishlarni butun saqlashning eng arzon yo\'lidir.' },
  { id: 'implant', label: 'Implantatsiya nazorati', text: 'Salom {name}! 🔬 Implantatsiyadan so\'ng nazorat ko\'rigi juda muhim. Shifokorimiz sizni kutmoqda.' },
  { id: 'ortho', label: 'Ortodontiya nazorati', text: 'Salom {name}! 🦷 Breket tizimingizning holatini tekshirish va aktivatsiya vaqti keldi.' },
];

const generateReminderMessage = (recall, templateId = 'checkup') => {
  const template = RECALL_TEMPLATES.find(t => t.id === templateId) || RECALL_TEMPLATES[1];
  return `🏥 *MY CLINIC*\n\n` + template.text.replace('{name}', recall.patient_name || 'Hurmatli bemor') + 
         ` \n\n📅 Sana: ${recall.recall_date}\n🕐 Vaqt: ${recall.recall_time || '09:00'}`;
};

  /**
   * Bulk send recalls
   */
  const bulkSendRecalls = useCallback(async (recallIds) => {
    setSending(true);
    try {
      const selected = recalls.filter(r => recallIds.includes(r.id));
      
      for (const recall of selected) {
        const message = generateReminderMessage(recall, 'manual');
        
        // Send via preferred channel
        if (recall.send_telegram && recall.telegram_chat_id) {
          await sendTelegramMessage(recall.telegram_chat_id, message);
        } else if (recall.send_sms && recall.patient_phone) {
          await sendSMS(recall.patient_phone, message);
        }
        
        // Update status
        await base44.entities.Recall.update(recall.id, { status: 'Sent' });
      }
      
      toast.success('Muvaffaqiyatli!', {
        description: `${selected.length} ta recall yuborildi`,
        duration: 3000
      });
      
      setSelectedRecalls(new Set());
      await load();
    } catch (error) {
      console.error('Bulk send failed:', error);
      toast.error('Xatolik', {
        description: 'Yuborishda xatolik yuz berdi'
      });
    } finally {
      setSending(false);
    }
  }, [recalls, load]);

  /**
   * Toggle recall selection for bulk actions
   */
  const toggleRecallSelection = useCallback((recallId) => {
    setSelectedRecalls(prev => {
      const next = new Set(prev);
      if (next.has(recallId)) {
        next.delete(recallId);
      } else {
        next.add(recallId);
      }
      return next;
    });
  }, []);

  /**
   * Select all visible recalls
   */
  const selectAllRecalls = useCallback(() => {
    if (selectedRecalls.size === filteredRecalls.length) {
      setSelectedRecalls(new Set());
    } else {
      setSelectedRecalls(new Set(filteredRecalls.map(r => r.id)));
    }
  }, [filteredRecalls, selectedRecalls.size]);
  const sendNotification = useCallback(async (channel) => {
    if (!selectedRecall) return;
    
    setSending(true);
    try {
      const message = generateReminderMessage(selectedRecall, 'manual');
      
      // Send via selected channel
      if (channel === 'telegram' && selectedRecall.telegram_chat_id) {
        await sendTelegramMessage(selectedRecall.telegram_chat_id, message);
      } else if (channel === 'sms' && selectedRecall.patient_phone) {
        await sendSMS(selectedRecall.patient_phone, message);
      }
      
      // Log to history
      await base44.entities.NotificationHistory?.create({
        recall_id: selectedRecall.id,
        patient_id: selectedRecall.patient_id,
        patient_name: selectedRecall.patient_name,
        channel,
        message,
        sent_at: new Date().toISOString(),
        status: 'sent'
      });
      
      setSendModalOpen(false);
      setSelectedRecall(null);
      await load();
    } catch (error) {
      console.error('Failed to send notification:', error);
    } finally {
      setSending(false);
    }
  }, [selectedRecall, load]);

  /**
   * Send Telegram message
   */
  const sendTelegramMessage = async (chatId, message) => {
    // This would integrate with your backend Telegram bot API
    return base44.integrations?.Telegram?.sendMessage?.({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown'
    });
  };

  /**
   * Send SMS
   */
  const sendSMS = async (phone, message) => {
    // This would integrate with SMS gateway (Eskiz.uz or Twilio)
    return base44.integrations?.SMS?.send?.({
      phone,
      message
    });
  };

  /**
   * Update recall status
   */
  const updateStatus = useCallback(async (id, status) => {
    try {
      await base44.entities.Recall.update(id, { status });
      await load();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }, [load]);

  /**
   * Open send notification modal
   */
  const openSendModal = useCallback((recall) => {
    setSelectedRecall(recall);
    setSendModalOpen(true);
  }, []);

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

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4.5 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-tight leading-none">
            {t('recall.title') || 'Recall Tizimi'}
          </h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
            {t('recall.subtitle') || 'Avtomatik eslatmalar bilan bemorlarni qayta chaqirish'}
          </p>
        </div>
        
        <div className="flex gap-2 shrink-0">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSettingsOpen(true)}
            className="gap-1.5 h-9 rounded-xl border-slate-200 text-xs font-bold text-slate-700 bg-white"
          >
            <Settings className="w-3.5 h-3.5 text-slate-400" />
            {t('recall.settings') || t('common.settings') || 'Sozlamalar'}
          </Button>
          <Button 
            size="sm"
            onClick={handleOpenNewModal} 
            className="bg-[#10b981] hover:bg-[#10b981]/90 gap-1.5 h-9 rounded-xl text-xs font-bold text-white shadow-md shadow-emerald-500/10 border-none cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t('recall.newRecall') || t('recall.addNew') || 'Yangi recall'}
          </Button>
        </div>
      </div>

      {/* Professional Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1 */}
        <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="w-9.5 h-9.5 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Bell className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('recall.stats.total') || 'Jami recalllar'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{recalls.length}</p>
          </div>
        </div>
        
        {/* Card 2 */}
        <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="w-9.5 h-9.5 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Clock className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('recall.stats.pending') || 'Kutilayotgan'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{recalls.filter(r => r.status === 'Pending').length}</p>
          </div>
        </div>
        
        {/* Card 3 */}
        <div className="bg-white border border-slate-100 rounded-xl p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="w-9.5 h-9.5 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4.5 h-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('recall.stats.sent') || 'Yuborilgan'}</p>
            <p className="text-xl font-black text-slate-900 mt-0.5">{notificationHistory.length}</p>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedRecalls.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-slate-900 text-white rounded-xl p-2.5 px-4 flex items-center justify-between gap-4 sticky top-4 z-50 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <CheckSquare className="w-4.5 h-4.5 text-emerald-400 animate-pulse" />
              <span className="font-bold text-xs">{selectedRecalls.size} {t('recall.bulkActions.selected') || 'ta recall tanlandi'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => bulkSendRecalls(Array.from(selectedRecalls))}
                disabled={sending}
                className="bg-emerald-500 hover:bg-emerald-600 gap-1.5 h-8 px-3 text-xs font-bold border-none"
              >
                <Send className="w-3 h-3" />
                {t('recall.bulkActions.send') || t('common.send') || 'Yuborish'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRecalls(new Set())}
                className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2 text-xs font-bold"
              >
                {t('recall.bulkActions.cancel') || t('common.cancel') || 'Bekor qilish'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <Input 
            placeholder={t('recall.searchPlaceholder') || 'Qidirish (ism, telefon)...'} 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="pl-10 h-10 rounded-xl border-slate-200 bg-white placeholder:text-slate-400 text-sm focus-visible:ring-1 focus-visible:ring-slate-350" 
          />
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-10 w-[140px] rounded-xl border-slate-200 text-xs font-semibold text-slate-700 bg-white">
              <div className="flex items-center gap-2 truncate">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <SelectValue placeholder={t('recall.filters.label') || 'Filtrlash'} />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-150">
              <SelectItem value="all" className="text-xs font-medium">{t('recall.filters.all') || 'Barchasi'}</SelectItem>
              <SelectItem value="urgent" className="text-xs font-medium">{t('recall.filters.urgent') || '🔥 Dolzarb'}</SelectItem>
              <SelectItem value="today" className="text-xs font-medium">{t('recall.filters.today') || 'Bugun'}</SelectItem>
              <SelectItem value="week" className="text-xs font-medium">{t('recall.filters.week') || 'Bu hafta'}</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-10 w-[140px] rounded-xl border-slate-200 text-xs font-semibold text-slate-700 bg-white">
              <div className="flex items-center gap-2 truncate">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-xl border-slate-150">
              <SelectItem value="date_asc" className="text-xs font-medium">{t('recall.sort.dateAsc') || 'Sana ↑'}</SelectItem>
              <SelectItem value="date_desc" className="text-xs font-medium">{t('recall.sort.dateDesc') || 'Sana ↓'}</SelectItem>
              <SelectItem value="priority" className="text-xs font-medium">{t('recall.sort.priority') || 'Muhimlik 🔽'}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-muted w-full justify-start overflow-x-auto no-scrollbar h-11 p-1">
          <TabsTrigger value="all" className="flex-1 sm:flex-none h-9">{t('recall.tabs.all') || 'Barcha'}</TabsTrigger>
          <TabsTrigger value="upcoming" className="flex-1 sm:flex-none h-9 whitespace-nowrap">
            {t('recall.tabs.upcoming') || 'Yaqinlashayotgan'} ({upcomingRecalls.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="flex-1 sm:flex-none h-9">{t('recall.tabs.history') || 'Tarix'}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 outline-none">
          <RecallsTable 
            recalls={filteredRecalls}
            loading={loading}
            onStatusChange={updateStatus}
            onSendClick={openSendModal}
            selectedRecalls={selectedRecalls}
            toggleRecallSelection={toggleRecallSelection}
          />
        </TabsContent>

        <TabsContent value="upcoming" className="mt-4 outline-none">
          <RecallsTable 
            recalls={upcomingRecalls}
            loading={loading}
            onStatusChange={updateStatus}
            onSendClick={openSendModal}
            emptyMessage="Yaqinlashayotgan recall yo'q"
            selectedRecalls={selectedRecalls}
            toggleRecallSelection={toggleRecallSelection}
          />
        </TabsContent>

        <TabsContent value="history" className="mt-4 outline-none">
          <NotificationHistoryTable history={notificationHistory} loading={loading} />
        </TabsContent>
      </Tabs>

      {/* New Recall Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('recall.modal.newTitle') || 'Yangi Recall'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('recall.modal.patient') || 'Bemor *'}</Label>
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
                <SelectTrigger>
                  <SelectValue placeholder={t('common.select') || 'Tanlang'} />
                </SelectTrigger>
                <SelectContent>
                  {patients.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 1. Boshlang'ich sana va Vaqt */}
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
                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">Avtomatik bugungi sana</span>
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
            
            {/* 2. Avtomatik davr & Eslatma (Recall) sanasi */}
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
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-700">{t('recall.modal.date') || 'Eslatma sanasi *'}</Label>
                  {form.recall_rule === 'custom' && (
                    <span className="text-[9px] font-bold text-amber-600">Kalendardan</span>
                  )}
                </div>
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
                  className="h-10 rounded-xl bg-white border-[#1499AD]/40 focus:border-[#1499AD] font-bold text-xs text-[#1499AD]"
                />
              </div>
            </div>

            {/* Info Badge */}
            {form.recall_rule !== 'custom' ? (
              <p className="text-[11px] text-[#1499AD] font-semibold bg-[#1499AD]/5 px-3 py-2 rounded-xl border border-[#1499AD]/10 flex items-center justify-between">
                <span>📅 Hisoblangan sana: <strong>{form.recall_date}</strong></span>
                <span className="text-[10px] text-slate-400 font-normal">(Kalendardan o'zgartirishingiz mumkin)</span>
              </p>
            ) : (
              <p className="text-[11px] text-amber-700 font-semibold bg-amber-50 px-3 py-2 rounded-xl border border-amber-100 flex items-center gap-1.5">
                <span>🗓️ Kalendar orqali maxsus sana belgilandi: <strong>{form.recall_date}</strong></span>
              </p>
            )}

            <div>
              <Label>{t('recall.modal.reason') || 'Davolash turi'}</Label>
              <Input 
                value={form.treatment_type} 
                onChange={e => setForm({ ...form, treatment_type: e.target.value, reason: `${e.target.value} - qayta ko'rik` })} 
                placeholder={t('recall.modal.placeholderTreatment') || "Masalan: Plomba qo'yish"}
              />
            </div>
            
            <div>
              <Label>{t('recall.modal.notes') || t('common.notes') || 'Izohlar'}</Label>
              <Textarea 
                value={form.notes} 
                onChange={e => setForm({ ...form, notes: e.target.value })} 
                rows={2} 
              />
            </div>

            {/* Notification Channels */}
            <div className="border rounded-lg p-3 space-y-3">
              <Label className="text-sm font-medium">{t('recall.modal.channels') || 'Eslatma kanallari'}</Label>
              <div className="flex gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={form.send_telegram}
                    onCheckedChange={v => setForm({ ...form, send_telegram: v })}
                  />
                  <MessageCircle className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Telegram</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={form.send_sms}
                    onCheckedChange={v => setForm({ ...form, send_sms: v })}
                  />
                  <Smartphone className="w-4 h-4 text-green-500" />
                  <span className="text-sm">SMS</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setModalOpen(false)}>
                {t('recall.bulkActions.cancel') || t('common.cancel') || 'Bekor'}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !form.patient_id || !form.recall_date}
                className="bg-primary hover:bg-primary/90"
              >
                {saving ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t('recall.modal.creating') || t('common.saving') || 'Saqlanmoqda...'}</>
                ) : (t('common.save') || 'Saqlash')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Eslatma sozlamalari</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Avtomatik eslatmalar</p>
                <p className="text-sm text-muted-foreground">Recall yaratilganda avtomatik yuborish</p>
              </div>
              <Switch 
                checked={settings.auto_reminder}
                onCheckedChange={v => setSettings({ ...settings, auto_reminder: v })}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Eslatma vaqtlari</Label>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={settings.reminder_1_day}
                    onCheckedChange={v => setSettings({ ...settings, reminder_1_day: v })}
                  />
                  <span className="text-sm">1 kun oldin</span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox 
                    checked={settings.reminder_2_hours}
                    onCheckedChange={v => setSettings({ ...settings, reminder_2_hours: v })}
                  />
                  <span className="text-sm">2 soat oldin</span>
                </div>
              </div>
            </div>

            <div>
              <Label>Asosiy kanal</Label>
              <Select 
                value={settings.default_channel}
                onValueChange={v => setSettings({ ...settings, default_channel: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSettingsOpen(false)}>
                Yopish
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send Notification Modal */}
      <Dialog open={sendModalOpen} onOpenChange={setSendModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Eslatma yuborish</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedRecall && (
              <div className="bg-muted rounded-lg p-3">
                <p className="font-medium">{selectedRecall.patient_name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedRecall.recall_date} {selectedRecall.recall_time}
                </p>
              </div>
            )}
            
            <p className="text-sm text-muted-foreground">
              Qaysi kanal orqali yuborishni tanlang:
            </p>
            
            <div className="grid grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="flex-col h-20 gap-2"
                onClick={() => sendNotification('telegram')}
                disabled={sending || !selectedRecall?.telegram_chat_id}
              >
                <MessageCircle className="w-6 h-6 text-blue-500" />
                <span className="text-xs">Telegram</span>
              </Button>
              <Button
                variant="outline"
                className="flex-col h-20 gap-2"
                onClick={() => sendNotification('sms')}
                disabled={sending || !selectedRecall?.patient_phone}
              >
                <Smartphone className="w-6 h-6 text-green-500" />
                <span className="text-xs">SMS</span>
              </Button>
            </div>
            
            {sending && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                Yuborilmoqda...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * Recalls Table Component
 */
function RecallsTable({ recalls, loading, onStatusChange, onSendClick, emptyMessage, selectedRecalls, toggleRecallSelection }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (recalls.length === 0) {
    return (
      <EmptyState 
        icon={Bell} 
        title={emptyMessage || t('recall.empty') || "Recall yo'q"}
        description={t('recall.emptyDesc') || "Yangi recall qo'shish uchun tugmani bosing"}
      />
    );
  }

  // Status colors
  const getStatusStyle = (status) => {
    const styles = {
      'Pending': { bg: 'bg-amber-55 text-amber-700 border-amber-100/70', text: 'text-amber-700', border: 'border-amber-100', label: t('status.Pending') || t('status.pending') || 'Kutilayotgan' },
      'Contacted': { bg: 'bg-blue-55 text-blue-700 border-blue-100/70', text: 'text-blue-700', border: 'border-blue-100', label: t('status.Contacted') || t('status.contacted') || 'Bog\'lanildi' },
      'Scheduled': { bg: 'bg-purple-55 text-purple-700 border-purple-100/70', text: 'text-purple-700', border: 'border-purple-100', label: t('status.Scheduled') || t('status.scheduled') || 'Rejalashtirilgan' },
      'Completed': { bg: 'bg-emerald-55 text-emerald-700 border-emerald-100/70', text: 'text-emerald-700', border: 'border-emerald-100', label: t('status.Completed') || t('status.completed') || 'Bajarildi' },
      'Missed': { bg: 'bg-rose-55 text-rose-700 border-rose-100/70', text: 'text-rose-700', border: 'border-rose-100', label: t('status.Missed') || t('status.missed') || 'O\'tkazib yuborildi' }
    };
    return styles[status] || styles['Pending'];
  };

  // Priority badge
  const getPriorityBadge = (priority) => {
    const badges = {
      'overdue': { bg: 'bg-rose-50 text-rose-600 border border-rose-100', text: 'text-rose-600', label: `⚠️ ${t('status.overdue') || 'Muddati o\'tgan'}` },
      'urgent': { bg: 'bg-amber-50 text-amber-700 border border-amber-150', text: 'text-amber-700', label: `🔥 ${t('status.urgent') || 'Dolzarb'}` },
      'high': { bg: 'bg-orange-50 text-orange-600 border border-orange-100', text: 'text-orange-600', label: t('status.High') || 'Yuqori' },
      'medium': { bg: 'bg-blue-50 text-blue-600 border border-blue-100', text: 'text-blue-600', label: t('status.Medium') || 'O\'rta' },
      'low': { bg: 'bg-slate-50 text-slate-600 border border-slate-100', text: 'text-slate-600', label: t('status.Low') || 'Past' }
    };
    return badges[priority] || badges['low'];
  };

  return (
    <div className="space-y-3.5">
      {/* Desktop View */}
      <div className="hidden sm:block bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left border-collapse table-fixed min-w-[850px]">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[28%] min-w-[200px]">{t('recall.table.patient') || 'Bemor'}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[14%] min-w-[110px]">{t('recall.table.recallDate') || 'Sana'}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[12%] min-w-[95px]">{t('recall.priority') || 'Muhimlik'}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[18%] min-w-[130px]">{t('recall.table.reason') || 'Turi / Izoh'}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider w-[13%] min-w-[110px]">{t('recall.table.status') || 'Status'}</th>
                <th className="px-4 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider text-right w-[15%] min-w-[140px]">{t('recall.table.actions') || 'Amallar'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recalls.map((recall) => {
                const status = getStatusStyle(recall.status);
                const priority = getPriorityBadge(recall.priority);
                const isSelected = selectedRecalls.has(recall.id);

                return (
                  <tr key={recall.id} className={`hover:bg-slate-50/40 transition-colors group ${isSelected ? 'bg-primary/5' : ''}`}>
                    <td className="px-4 py-2.5 w-[28%] min-w-[200px]">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleRecallSelection(recall.id)}
                          className="shrink-0"
                        />
                        <div className="w-8.5 h-8.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {recall.patient_name?.charAt(0) || '?'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-[13px] truncate" title={recall.patient_name}>{recall.patient_name}</p>
                          <p className="text-[10.5px] font-medium text-slate-500 mt-0.5 truncate">{recall.patient_phone || t('recall.noPhone') || "Telefon yo'q"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 w-[14%] min-w-[110px]">
                      <div className="text-[12px] font-bold text-slate-700">{recall.recall_date}</div>
                      {recall.recall_time && <div className="text-[10px] text-slate-400 mt-0.5">{recall.recall_time}</div>}
                    </td>
                    <td className="px-4 py-2.5 w-[12%] min-w-[95px]">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${priority.bg} ${priority.text} whitespace-nowrap`}>
                        {priority.label.replace('⚠️ ', '').replace('🔥 ', '')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 w-[18%] min-w-[130px]">
                      <p className="text-[11.5px] font-medium text-slate-600 truncate max-w-[160px]" title={recall.reason}>{recall.reason || "—"}</p>
                    </td>
                    <td className="px-4 py-2.5 w-[13%] min-w-[110px]">
                      <Select 
                        value={recall.status} 
                        onValueChange={v => onStatusChange(recall.id, v)}
                      >
                        <SelectTrigger className={`h-7 px-2 py-0 border font-bold text-[9.5px] uppercase tracking-wider w-[110px] transition-colors focus:ring-0 ${status.bg} ${status.text} ${status.border}`}>
                          <span className="w-full text-center"><SelectValue /></span>
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-150">
                          {['Pending', 'Contacted', 'Scheduled', 'Completed', 'Missed'].map(s => (
                            <SelectItem key={s} value={s} className="font-bold text-[9.5px] uppercase tracking-wider">{getStatusStyle(s).label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-4 py-2.5 text-right w-[15%] min-w-[140px]">
                      <div className="flex items-center justify-end gap-1">
                        {recall.patient_phone && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7.5 w-7.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 hover:text-emerald-700 transition-colors shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.location.href = `tel:${recall.patient_phone}`;
                            }}
                            title={t('recall.makeCall') || "Qo'ng'iroq qilish"}
                          >
                            <Phone className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7.5 w-7.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 transition-colors shrink-0"
                          onClick={() => onSendClick(recall)}
                          title={t('recall.sendSms') || "Xabar yuborish"}
                        >
                          <Send className="w-3 h-3" />
                        </Button>
                        {recall.lastAction ? (
                          <div className="w-7.5 h-7.5 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0" title={`${t('recall.sent') || 'Yuborildi'}: ${formatDateTime(recall.lastAction.time)}`}>
                            {recall.lastAction.type === 'telegram' ? <MessageCircle className="w-3.5 h-3.5 text-blue-500" /> : <Smartphone className="w-3.5 h-3.5 text-green-500" />}
                          </div>
                        ) : recall.deliveryStatus === 'failed' ? (
                          <div className="w-7.5 h-7.5 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0 text-red-500" title={t('common.error') || "Xatolik"}>
                            <AlertCircle className="w-3.5 h-3.5" />
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View - Sleek Cards */}
      <div className="sm:hidden space-y-3">
        {recalls.map((recall, idx) => {
          const status = getStatusStyle(recall.status);
          const priority = getPriorityBadge(recall.priority);
          const isSelected = selectedRecalls.has(recall.id);

          return (
            <motion.div
              key={recall.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-white rounded-xl p-3 border ${
                isSelected ? 'border-primary bg-primary/5' : 
                recall.priority === 'urgent' || recall.priority === 'overdue'
                  ? 'border-red-150 bg-red-50/20'
                  : 'border-slate-100 hover:border-slate-200'
              } transition-all relative overflow-hidden`}
            >
              {/* Left color bar for priority */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${priority.bg}`} />

              <div className="flex items-start gap-2.5">
                <Checkbox 
                  checked={isSelected}
                  onCheckedChange={() => toggleRecallSelection(recall.id)}
                  className="mt-1"
                />

                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start mb-1.5 gap-2">
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm truncate">{recall.patient_name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{recall.patient_phone || t('recall.noPhone') || "Telefon yo'q"}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${priority.bg} ${priority.text}`}>
                        {priority.label.replace('⚠️ ', '').replace('🔥 ', '')}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-semibold ${status.bg} ${status.text} border ${status.border}`}>
                        {status.label}
                      </span>
                    </div>
                  </div>

                  {recall.reason && (
                    <p className="text-xs text-slate-500 mb-2.5 truncate">{recall.reason}</p>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t border-slate-50 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{recall.recall_date}</span>
                      {recall.recall_time && <span>• {recall.recall_time}</span>}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {recall.patient_phone && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 rounded-lg bg-emerald-50 text-emerald-600 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${recall.patient_phone}`;
                          }}
                        >
                          <Phone className="w-3 h-3" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg bg-blue-50 text-blue-600 p-0"
                        onClick={() => onSendClick(recall)}
                      >
                        <Send className="w-3 h-3" />
                      </Button>
                      <Select 
                        value={recall.status} 
                        onValueChange={v => onStatusChange(recall.id, v)}
                      >
                        <SelectTrigger className="w-7 h-7 border-0 p-0 hover:bg-slate-55 flex items-center justify-center rounded-lg bg-slate-50 border border-slate-100">
                          <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                        </SelectTrigger>
                        <SelectContent align="end">
                          {['Pending', 'Contacted', 'Scheduled', 'Completed', 'Missed'].map(s => (
                            <SelectItem key={s} value={s}>{getStatusStyle(s).label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Notification History Table Component
 */
function NotificationHistoryTable({ history, loading }) {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <EmptyState 
        icon={History}
        title={t('recall.historyEmpty') || "Tarix bo'sh"}
        description={t('recall.historyEmptyDesc') || "Hali hech qanday eslatma yuborilmagan"}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Desktop View */}
      <div className="hidden sm:block bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">{t('recall.table.patient') || 'Bemor'}</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">{t('recall.table.channel') || 'Kanal'}</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">{t('recall.sent') || 'Yuborilgan'}</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase px-5 py-3">{t('recall.table.status') || 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              {history.map(item => (
                <tr key={item.id} className="border-b border-border last:border-0 hover:bg-accent/30 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-medium">{item.patient_name}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1 text-sm">
                      {item.channel === 'telegram' ? (
                        <><MessageCircle className="w-4 h-4 text-blue-500" /> Telegram</>
                      ) : (
                        <><Smartphone className="w-4 h-4 text-green-500" /> SMS</>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{formatDateTime(item.sent_at)}</td>
                  <td className="px-5 py-3.5">
                    {item.status === 'sent' ? (
                      <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                        <CheckCircle2 className="w-4 h-4" /> {t('recall.sent') || 'Yuborildi'}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 text-sm font-medium">
                        <XCircle className="w-4 h-4" /> {t('common.error') || 'Xatolik'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile View */}
      <div className="sm:hidden space-y-3">
        {history.map(item => (
          <div key={item.id} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <h4 className="font-bold text-sm">{item.patient_name}</h4>
              {item.status === 'sent' ? (
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">{t('recall.sent') || 'Yuborildi'}</span>
              ) : (
                <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">{t('common.error') || 'Xatolik'}</span>
              )}
            </div>
            <div className="flex justify-between items-center text-xs text-slate-500">
              <div className="flex items-center gap-1">
                {item.channel === 'telegram' ? (
                  <MessageCircle className="w-3 h-3 text-blue-500" />
                ) : (
                  <Smartphone className="w-3 h-3 text-green-500" />
                )}
                <span>{item.channel === 'telegram' ? 'Telegram' : 'SMS'}</span>
              </div>
              <span>{formatDateTime(item.sent_at)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Users, UserPlus, Trash2, Shield, Search, Pencil, Phone, Send,
  Calendar, Download, LayoutGrid, List, ChevronDown, ChevronRight,
  Award, KeyRound, X, UserCheck, Percent, ShieldCheck,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { useTranslation } from '@/i18n/LanguageContext';
import { toast } from 'sonner';
import { useFeature } from '@/hooks/useFeature';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { formatDoctorName } from '@/lib/displayText';
import {
  dateKey, todayISO, timeToMinutes, minutesToLabel, fmtMoney, fmtCompact,
  personName, initials, avatarTone, userPhoto, isIncomePayment, isCompletedStatus,
  isCancelledStatus, isInProgressStatus, matchStaff, isScheduledOn, scheduleHoursLabel, scheduleForDay,
  WEEK_LABELS, startOfWeek, addDays, isoDate, roleAccess, roleLabel,
} from '@/utils/clinicMetrics';

const DAY_MS = 86400000;

function tx(language, uz, ru, en) {
  if (language === 'ru') return ru;
  if (language === 'en') return en;
  return uz;
}

function Avatar({ user, size = 48, className }) {
  const name = personName(user);
  const src = userPhoto(user);
  const dim = size >= 60 ? 'w-16 h-16 text-lg rounded-2xl' : size >= 44 ? 'w-12 h-12 text-sm rounded-2xl' : size >= 32 ? 'w-8 h-8 text-[11px] rounded-xl' : 'w-6 h-6 text-[9px] rounded-lg';
  return (
    <div className={cn('overflow-hidden flex items-center justify-center font-extrabold shrink-0', dim, avatarTone(name), className)}>
      {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : initials(name)}
    </div>
  );
}

function StatusPill({ kind, label }) {
  const map = {
    busy: 'text-teal-700',
    off: 'text-amber-700',
    inactive: 'text-slate-400',
    on: 'text-emerald-600',
  };
  const dot = {
    busy: 'bg-[#1499AD]',
    off: 'bg-amber-500',
    inactive: 'bg-slate-300',
    on: 'bg-emerald-500',
  };
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap', map[kind] || map.on)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', dot[kind] || dot.on)} />
      {label}
    </span>
  );
}

function DayTimeline({ appointments, nowMinutes }) {
  let start = 9 * 60;
  let end = 18 * 60;
  appointments.forEach((a) => {
    const t = timeToMinutes(a.time);
    if (t == null) return;
    const dur = Number(a.duration) || 30;
    if (t < start) start = Math.floor(t / 30) * 30;
    if (t + dur > end) end = Math.ceil((t + dur) / 30) * 30;
  });
  if (end <= start) end = start + 60;
  const span = end - start;
  const blocks = appointments.map((a, i) => {
    const t = timeToMinutes(a.time);
    if (t == null) return null;
    const dur = Number(a.duration) || 30;
    const left = Math.max(0, Math.min(98, ((t - start) / span) * 100));
    const width = Math.max(2, Math.min(100 - left, (dur / span) * 100));
    return { left, width, done: isCompletedStatus(a.status), id: a.id || i };
  }).filter(Boolean);
  const nowLeft = nowMinutes != null && nowMinutes >= start && nowMinutes <= end
    ? ((nowMinutes - start) / span) * 100
    : null;
  const mid = start + Math.round(span / 2);
  return (
    <div>
      <div className="relative h-2.5 rounded-md overflow-hidden bg-[repeating-linear-gradient(90deg,#E8EDF3_0_calc(11.111%-1px),#fff_calc(11.111%-1px)_11.111%)]">
        {blocks.map((b) => (
          <i
            key={b.id}
            className={cn('absolute top-0 bottom-0 rounded-[3px]', b.done ? 'bg-teal-700/75' : 'bg-[#1499AD]')}
            style={{ left: `${b.left}%`, width: `${b.width}%` }}
          />
        ))}
        {nowLeft != null && (
          <span className="absolute -top-1 bottom-[-4px] w-0.5 bg-rose-500" style={{ left: `${nowLeft}%` }}>
            <span className="absolute -top-1 -left-[2px] w-1.5 h-1.5 rounded-full bg-rose-500" />
          </span>
        )}
      </div>
      <div className="flex justify-between text-[9.5px] font-semibold text-slate-400 mt-1">
        <span>{minutesToLabel(start)}</span>
        <span>{minutesToLabel(mid)}</span>
        <span>{minutesToLabel(end)}</span>
      </div>
    </div>
  );
}

function WeekChips({ flags, todayJs, onToggle }) {
  return (
    <div className="flex gap-1">
      {WEEK_LABELS.map((d) => {
        const cls = cn(
          'flex-1 text-center text-[10.5px] font-bold py-1 rounded-md bg-slate-100 text-slate-400',
          flags[d.js] && 'bg-teal-600 text-white',
          d.js === todayJs && 'outline outline-1 outline-[#1499AD] -outline-offset-1',
          onToggle && 'cursor-pointer hover:opacity-80 transition-opacity'
        );
        if (!onToggle) return <span key={d.js} className={cls}>{d.short}</span>;
        return (
          <button
            key={d.js}
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggle(d.js); }}
            title={flags[d.js] ? 'Ish kuni — bosib dam qiling' : 'Dam — bosib ish kuni qiling'}
            aria-pressed={!!flags[d.js]}
            className={cls}
          >
            {d.short}
          </button>
        );
      })}
    </div>
  );
}

export default function Staff() {
  const { t, language } = useTranslation();
  const navigate = useNavigate();
  const phone = useIsMobile(641);
  const inMobileShell = useIsMobile(1024);
  const hasStaffAccess = useFeature('staff');

  const [users, setUsers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortKey, setSortKey] = useState('revenue');
  const [view, setView] = useState(() => localStorage.getItem('myclinic_staff_view') || 'grid');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [detailId, setDetailId] = useState(null);
  const [detailTab, setDetailTab] = useState('general');
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const [newStaff, setNewStaff] = useState({
    full_name: '', username: '', password: '', phone: '', specialty: 'Stomatolog', role: 'doctor', commission: 30,
  });
  const [editingStaff, setEditingStaff] = useState(null);
  const [editStaffForm, setEditStaffForm] = useState({
    full_name: '', username: '', password: '', phone: '', specialty: 'Stomatolog', role: 'doctor', commission: 30,
  });
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [focusRole, setFocusRole] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [allUsers, pays, appts] = await Promise.all([
        base44.entities.User.list('name', 100),
        base44.entities.Payment.list('-date', 500),
        base44.entities.Appointment.list('-date', 500),
      ]);
      setUsers(allUsers || []);
      setPayments(pays || []);
      setAppointments(appts || []);
    } catch (error) {
      console.error('Staff loading error:', error);
      toast.error(t('staff.addError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (!isEditModalOpen || !focusRole) return undefined;
    const timer = setTimeout(() => document.getElementById('staff-role-select')?.focus(), 220);
    return () => clearTimeout(timer);
  }, [isEditModalOpen, focusRole]);

  useEffect(() => {
    if (!detailId) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setDetailId(null); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [detailId]);

  const now = new Date();
  const today = todayISO();
  const todayJs = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const weekStart = startOfWeek(now);

  const cards = useMemo(() => {
    const byId = new Map();
    users.forEach((raw) => {
      const u = { ...raw };
      if (typeof u.workingHours === 'string') {
        try { u.workingHours = JSON.parse(u.workingHours); } catch { u.workingHours = null; }
      }
      const name = personName(u);
      byId.set(String(u.id), {
        user: u,
        id: u.id,
        name,
        username: u.username || '',
        phone: u.phone || '',
        role: u.role || 'doctor',
        specialty: u.specialty || '',
        commission: Number(u.commission_rate ?? u.commission ?? 0),
        inactive: u.is_active === false,
        scheduleKnown: u.workingHours && typeof u.workingHours === 'object' && Object.keys(u.workingHours).length > 0,
        scheduledToday: isScheduledOn(u.workingHours, todayJs),
        appointments: 0,
        completed: 0,
        revenue: 0,
        patientIds: new Set(),
        todayAppts: [],
        weekdayHits: new Set(),
        weekCounts: {},
      });
    });

    const bump = (record) => {
      const staff = matchStaff(record, users);
      if (!staff) return null;
      return byId.get(String(staff.id)) || null;
    };

    payments.forEach((p) => {
      if (!isIncomePayment(p)) return;
      const row = bump(p);
      if (!row) return;
      row.revenue += Number(p.amount) || 0;
      if (p.patient_id) row.patientIds.add(p.patient_id);
    });

    appointments.forEach((a) => {
      const row = bump(a);
      if (!row) return;
      const cancelled = isCancelledStatus(a.status);
      if (!cancelled) row.appointments += 1;
      if (isCompletedStatus(a.status)) row.completed += 1;
      if (a.patient_id) row.patientIds.add(a.patient_id);
      const dk = dateKey(a.date);
      if (dk && !cancelled) {
        const dt = new Date(`${dk}T12:00:00`);
        if (!Number.isNaN(dt.getTime())) row.weekdayHits.add(dt.getDay());
        const diff = Math.round((dt - weekStart) / DAY_MS);
        if (diff >= 0 && diff < 7) row.weekCounts[dk] = (row.weekCounts[dk] || 0) + 1;
      }
      if (dk === today && !cancelled) row.todayAppts.push(a);
    });

    byId.forEach((row) => {
      row.todayAppts.sort((a, b) => (timeToMinutes(a.time) || 0) - (timeToMinutes(b.time) || 0));
      row.patients = row.patientIds.size;
      row.completion = row.appointments ? Math.round((row.completed / row.appointments) * 100) : 0;
      row.share = Math.round(row.revenue * (row.commission / 100));
      row.avgCheck = row.completed > 0
        ? Math.round(row.revenue / row.completed)
        : (row.appointments > 0 ? Math.round(row.revenue / row.appointments) : 0);

      const busy = row.todayAppts.some((a) => {
        if (isCompletedStatus(a.status) || isCancelledStatus(a.status)) return false;
        const t0 = timeToMinutes(a.time);
        if (t0 == null) return isInProgressStatus(a.status);
        const dur = Number(a.duration) || 30;
        if (isInProgressStatus(a.status)) return true;
        return nowMinutes >= t0 && nowMinutes < t0 + dur;
      });
      if (row.inactive) row.presence = 'inactive';
      else if (busy) row.presence = 'busy';
      else if (row.scheduledToday === false) row.presence = 'off';
      else row.presence = 'on';
      row.atWork = !row.inactive && (row.scheduledToday === true || row.todayAppts.length > 0 || busy);

      const flags = {};
      WEEK_LABELS.forEach((d) => {
        const scheduled = isScheduledOn(row.user.workingHours, d.js);
        if (scheduled != null) flags[d.js] = scheduled;
        else flags[d.js] = row.weekdayHits.has(d.js);
      });
      row.dayFlags = flags;

      const upcoming = row.todayAppts.find((a) => {
        if (isCompletedStatus(a.status) || isCancelledStatus(a.status)) return false;
        const t0 = timeToMinutes(a.time);
        if (t0 == null) return true;
        return t0 + (Number(a.duration) || 30) > nowMinutes;
      });
      row.nextAppt = upcoming || null;
    });

    return Array.from(byId.values());
  }, [users, payments, appointments, today, todayJs, nowMinutes, weekStart]);

  const topEarnerId = useMemo(() => {
    const ranked = cards.filter((c) => c.revenue > 0).sort((a, b) => b.revenue - a.revenue || b.completed - a.completed);
    return ranked[0]?.id || null;
  }, [cards]);

  const counts = useMemo(() => ({
    all: cards.length,
    doctor: cards.filter((c) => c.role === 'doctor').length,
    admin: cards.filter((c) => c.role === 'admin').length,
    receptionist: cards.filter((c) => c.role === 'receptionist').length,
  }), [cards]);

  const todayAppointments = useMemo(
    () => appointments.filter((a) => dateKey(a.date) === today && !isCancelledStatus(a.status)),
    [appointments, today]
  );
  const todayDone = todayAppointments.filter((a) => isCompletedStatus(a.status)).length;
  const workingToday = cards.filter((c) => c.atWork);
  const busyCount = cards.filter((c) => c.presence === 'busy').length;
  const doctorCount = counts.doctor;
  const adminCount = counts.admin;
  const receptionCount = counts.receptionist;
  const totalIncome = payments.filter(isIncomePayment).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const totalShare = cards.reduce((s, c) => s + c.share, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = cards.filter((c) => {
      if (roleFilter === 'doctor' && c.role !== 'doctor') return false;
      if (roleFilter === 'admin' && c.role !== 'admin') return false;
      if (roleFilter === 'receptionist' && c.role !== 'receptionist') return false;
      if (statusFilter === 'active' && c.presence !== 'on') return false;
      if (statusFilter === 'busy' && c.presence !== 'busy') return false;
      if (statusFilter === 'off' && c.presence !== 'off') return false;
      if (statusFilter === 'inactive' && c.presence !== 'inactive') return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q)
        || c.username.toLowerCase().includes(q)
        || String(c.phone).toLowerCase().includes(q);
    });
    list = [...list].sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'uz');
      if (sortKey === 'appointments') return b.appointments - a.appointments || b.revenue - a.revenue;
      if (sortKey === 'commission') return b.commission - a.commission || b.revenue - a.revenue;
      return b.revenue - a.revenue || b.appointments - a.appointments;
    });
    return list;
  }, [cards, search, roleFilter, statusFilter, sortKey]);

  const detail = cards.find((c) => String(c.id) === String(detailId)) || null;

  const openCreate = (e) => {
    if (!hasStaffAccess) {
      e?.preventDefault?.();
      toast.error("Yangi xodim qo'shish uchun PRO ta'rifiga o'ting!");
      return false;
    }
    return true;
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    if (!newStaff.full_name || !newStaff.username || !newStaff.password) {
      toast.error(t('staff.fillAll'));
      return;
    }
    try {
      const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
      const cleanUsername = newStaff.username.toLowerCase().replace(/\s+/g, '');
      const existing = users.find((u) => (u.username || '').toLowerCase() === cleanUsername);
      if (existing) {
        toast.error(t('staff.usernameTaken'));
        return;
      }
      await base44.auth.addUser({
        id: `user-${Math.random().toString(36).substring(2, 9)}`,
        name: newStaff.full_name,
        username: cleanUsername,
        password: newStaff.password,
        phone: newStaff.phone,
        specialty: newStaff.specialty,
        role: newStaff.role,
        commission_rate: Number(newStaff.commission || 30),
        clinic_id: clinicId,
      });
      toast.success(t('staff.addSuccessDetail'));
      setIsModalOpen(false);
      setCredentialsModal({
        name: newStaff.full_name,
        clinicId,
        username: cleanUsername,
        password: newStaff.password,
      });
      setNewStaff({ full_name: '', username: '', password: '', phone: '', specialty: 'Stomatolog', role: 'doctor', commission: 30 });
      loadData();
    } catch (error) {
      console.error('Add staff error:', error);
      toast.error(error.message || t('common.error'));
    }
  };

  const handleDeleteStaff = async (id, name) => {
    if (!confirm(t('staff.deleteConfirm', { name }))) return;
    try {
      await base44.auth.deleteUser(id);
      toast.success(t('staff.deleteSuccess'));
      if (String(detailId) === String(id)) setDetailId(null);
      loadData();
    } catch {
      toast.error(t('common.error'));
    }
  };

  const handleOpenEditStaff = (user, opts = {}) => {
    setEditingStaff(user);
    setEditStaffForm({
      full_name: user.full_name || user.name || '',
      username: user.username || '',
      password: '',
      phone: user.phone || '',
      specialty: user.specialty || 'Stomatolog',
      role: user.role || 'doctor',
      commission: user.commission_rate ?? user.commission ?? 30,
    });
    setFocusRole(!!opts.focusRole);
    setIsEditModalOpen(true);
  };

  const openSchedule = (card, extra = {}) => {
    navigate('/appointments', { state: { doctorId: card.id, doctorName: card.name, ...extra } });
  };

  // "Qabullar" → shu shifokorning barcha qabullari
  const openDoctorAppointments = (card) => openSchedule(card, { listPeriod: 'all' });

  // Bu hafta kuni → shu kun + shifokor jadvali
  const openDoctorDay = (card, date) => openSchedule(card, { date, listPeriod: 'day' });

  // "Bemorlar soni" → Bemorlar sahifasi shu shifokor bo'yicha filtrlangan
  const openDoctorPatients = (card) => {
    navigate('/patients', {
      state: {
        doctorFilter: {
          id: card.id,
          name: card.name,
          patientIds: Array.from(card.patientIds || []).map(String),
        },
      },
    });
  };

  // Du–Ya tugmalari: ish kunini almashtirish va saqlash
  const toggleWorkingDay = async (card, jsDay) => {
    const WEEKDAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const prevWh = card.user.workingHours && typeof card.user.workingHours === 'object' ? card.user.workingHours : {};
    const wh = { ...prevWh };
    // Jadval umuman kiritilmagan bo'lsa, ko'rinib turgan holatni boshqa kunlar uchun ham saqlab qo'yamiz
    WEEK_LABELS.forEach((d) => {
      if (!scheduleForDay(wh, d.js)) {
        wh[String(d.js)] = { active: !!card.dayFlags?.[d.js], start: '09:00', end: '18:00' };
      }
    });
    const key = [jsDay, String(jsDay), WEEKDAY_KEYS[jsDay]].find((k) => wh[k] && typeof wh[k] === 'object') ?? String(jsDay);
    const day = { start: '09:00', end: '18:00', ...(wh[key] || {}) };
    const currentlyOn = isScheduledOn(wh, jsDay) ?? !!card.dayFlags?.[jsDay];
    const nextOn = !currentlyOn;
    if ('isOpen' in day && !('active' in day)) day.isOpen = nextOn; else day.active = nextOn;
    wh[key] = day;

    const label = WEEK_LABELS.find((d) => d.js === jsDay)?.short || '';
    setUsers((prev) => prev.map((u) => (String(u.id) === String(card.id) ? { ...u, workingHours: wh } : u)));
    try {
      await base44.auth.updateUser(card.id, { workingHours: wh });
      toast.success(`${card.name}: ${label} — ${nextOn ? 'ish kuni' : 'dam olish kuni'}`);
    } catch (error) {
      console.error('Toggle working day error:', error);
      setUsers((prev) => prev.map((u) => (String(u.id) === String(card.id) ? { ...u, workingHours: prevWh } : u)));
      toast.error("Ish kunini saqlashda xatolik yuz berdi");
    }
  };

  const followLink = (url) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    if (/^https?:/i.test(url)) {
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
    }
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  const handleUpdateStaff = async (e) => {
    e.preventDefault();
    if (!editStaffForm.full_name || !editStaffForm.username) {
      toast.error(t('staff.fillAll'));
      return;
    }
    try {
      const cleanUsername = editStaffForm.username.toLowerCase().replace(/\s+/g, '');
      const updatedData = {
        name: editStaffForm.full_name.trim(),
        full_name: editStaffForm.full_name.trim(),
        username: cleanUsername,
        phone: editStaffForm.phone?.trim() || '',
        specialty: editStaffForm.specialty?.trim() || 'Stomatolog',
        role: editStaffForm.role || 'doctor',
        commission_rate: Number(editStaffForm.commission || 0),
      };
      if (editStaffForm.password && editStaffForm.password.trim()) {
        if (editStaffForm.password.trim().length < 4) {
          toast.error(t('settings.staff.errorMinPassword') || "Parol kamida 4 ta belgidan iborat bo'lishi kerak!");
          return;
        }
        updatedData.password = editStaffForm.password.trim();
      }
      await base44.auth.updateUser(editingStaff.id, updatedData);
      toast.success(t('settings.staff.doctorUpdated') || "Xodim ma'lumotlari muvaffaqiyatli yangilandi!");
      setIsEditModalOpen(false);
      setEditingStaff(null);
      loadData();
    } catch (error) {
      console.error('Update staff error:', error);
      toast.error(error.message || t('common.error'));
    }
  };

  const exportCsv = () => {
    const headers = ['Ism', 'Login', 'Telefon', 'Lavozim', 'Mutaxassislik', 'Holat', 'Komissiya %', 'Qabullar', 'Bajarilgan', 'Tushum'];
    const rows = filtered.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      c.username,
      `"${c.phone}"`,
      roleLabel(c.role, 'uz'),
      `"${(c.specialty || '').replace(/"/g, '""')}"`,
      presenceLabel(c.presence, 'uz'),
      c.commission,
      c.appointments,
      c.completed,
      c.revenue,
    ].join(','));
    const csv = `\uFEFF${[headers.join(','), ...rows].join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Xodimlar_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success('Xodimlar ro\'yxati yuklab olindi');
  };

  const callUser = (user) => {
    const phone = String(user.phone || '').trim();
    if (!phone) {
      toast.error(tx(language, 'Telefon raqami kiritilmagan', 'Телефон не указан', 'No phone number'));
      return;
    }
    followLink(`tel:${phone}`);
  };

  const messageUser = (user) => {
    const handle = String(user.telegram_username || user.telegram || '').replace(/^@/, '').trim();
    if (handle) {
      followLink(`https://t.me/${handle}`);
      return;
    }
    const phone = String(user.phone || '').trim();
    if (phone) {
      followLink(`sms:${phone}`);
      return;
    }
    toast.error(tx(language, 'Telegram yoki telefon topilmadi', 'Нет Telegram или телефона', 'No Telegram or phone'));
  };

  const openDetail = (id, tab = 'general') => {
    setDetailTab(tab);
    setDetailId(id);
  };

  const presenceLabel = (kind, lang = language) => {
    const labels = {
      on: tx(lang, 'Faol', 'Активен', 'Active'),
      busy: tx(lang, 'Qabulda', 'На приёме', 'In visit'),
      off: tx(lang, 'Ishda emas', 'Не на смене', 'Off today'),
      inactive: tx(lang, 'Nofaol', 'Неактивен', 'Inactive'),
    };
    return labels[kind] || labels.on;
  };

  const roleTabs = [
    { id: 'all', label: tx(language, 'Hammasi', 'Все', 'All'), count: counts.all },
    { id: 'doctor', label: tx(language, 'Shifokorlar', 'Врачи', 'Doctors'), count: counts.doctor },
    { id: 'admin', label: tx(language, 'Adminlar', 'Админы', 'Admins'), count: counts.admin },
    { id: 'receptionist', label: tx(language, 'Registratura', 'Регистратура', 'Reception'), count: counts.receptionist },
  ];

  const splitTotal = Math.max(1, doctorCount + adminCount + receptionCount);
  const anySchedule = cards.some((c) => c.scheduleKnown);
  const workingHint = anySchedule
    ? tx(language, 'jadval bo\'yicha', 'по графику', 'from schedule')
    : tx(language, 'bugungi qabul bo\'yicha', 'по сегодняшним приёмам', 'from today\'s visits');

  const setViewMode = (mode) => {
    setView(mode);
    localStorage.setItem('myclinic_staff_view', mode);
  };

  return (
    <div className={cn('min-w-0 max-w-full', inMobileShell && 'px-4', phone && 'pb-4')}>
      <div className="flex items-end justify-between gap-3 mb-4 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[22px] sm:text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            {!phone && <Users className="w-5 h-5 text-emerald-600 shrink-0" />}
            <span className="truncate">{phone ? tx(language, 'Xodimlar', 'Сотрудники', 'Staff') : (t('staff.title') || 'Xodimlar va Shifokorlar')}</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {phone
              ? `${counts.all} ${tx(language, 'xodim', 'сотр.', 'staff')} · ${doctorCount} ${tx(language, 'shifokor', 'врач', 'doctors')} · ${adminCount} ${tx(language, 'administrator', 'админ', 'admin')}`
              : (t('staff.subtitle') || 'Klinika jamoasi, ish jadvali, komissiya va kirish huquqlari')}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={exportCsv} className={cn('h-10 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-slate-50', phone && 'w-10 px-0 justify-center')}>
            <Download className="w-4 h-4" />
            {!phone && 'Excel'}
          </button>
          {!phone && (
            <Dialog open={isModalOpen} onOpenChange={(open) => { if (open && !openCreate()) return; setIsModalOpen(open); }}>
              <DialogTrigger asChild>
                <Button
                  className={cn('text-white rounded-xl h-10 px-4', hasStaffAccess ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400')}
                  onClick={(e) => { if (!hasStaffAccess) { e.preventDefault(); openCreate(e); } }}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  {t('staff.addNew')} {!hasStaffAccess && '(PRO)'}
                </Button>
              </DialogTrigger>
              {renderCreateForm()}
            </Dialog>
          )}
        </div>
      </div>

      {phone ? (
        <>
          <div className="sticky top-0 z-20 -mx-4 px-4 py-2.5 bg-[#F8FAFC]/95 backdrop-blur-md">
            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={tx(language, 'Ism, login yoki telefon…', 'Имя, логин или телефон…', 'Name, login or phone…')}
                  className="w-full h-11 pl-9 pr-3 rounded-[13px] border border-slate-200 bg-white text-sm outline-none focus:border-[#1499AD]"
                />
              </div>
              <button type="button" onClick={() => setShowMobileFilters((v) => !v)} className="w-11 h-11 rounded-[13px] border border-slate-200 bg-white grid place-items-center text-slate-600">
                <ChevronDown className={cn('w-4 h-4 transition', showMobileFilters && 'rotate-180')} />
              </button>
            </div>
            {showMobileFilters && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <FilterSelect label={tx(language, 'Holat', 'Статус', 'Status')} value={statusFilter} onChange={setStatusFilter} options={statusOptions(language)} />
                <FilterSelect label={tx(language, 'Saralash', 'Сортировка', 'Sort')} value={sortKey} onChange={setSortKey} options={sortOptions(language)} />
              </div>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {roleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={cn(
                    'h-8 px-3 rounded-full border text-[12.5px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap',
                    roleFilter === tab.id ? 'bg-[#0C1222] text-white border-[#0C1222]' : 'bg-white text-slate-700 border-slate-200'
                  )}
                >
                  {tab.label}
                  <b className={cn('text-[11px] font-bold', roleFilter === tab.id ? 'text-emerald-200' : 'text-slate-400')}>{tab.count}</b>
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 py-2">
            <MiniStat label={tx(language, 'Bugun ishda', 'Сегодня на смене', 'On duty')} value={<><span>{workingToday.length}</span> <small className="text-xs text-slate-400 font-bold">/ {cards.length}</small></>} hint={busyCount ? `${busyCount} ${tx(language, 'tasi qabulda', 'на приёме', 'in a visit')}` : workingHint} />
            <MiniStat label={tx(language, 'Bugungi qabul', 'Приёмы сегодня', 'Visits today')} value={todayAppointments.length} hint={`${todayDone} ${tx(language, 'yakunlandi', 'завершено', 'done')}`} />
            <MiniStat label={tx(language, 'Komissiya', 'Комиссия', 'Commission')} value={<>{fmtCompact(totalShare)}</>} hint={tx(language, 'shifokorlar ulushi', 'доля врачей', 'doctors\' share')} />
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-4">
            <article className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tx(language, 'Jami xodimlar', 'Всего сотрудников', 'Total staff')}</span>
                <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 grid place-items-center"><Users className="w-4 h-4" /></span>
              </div>
              <div className="text-[26px] font-extrabold tracking-tight mt-2 leading-none">{cards.length}</div>
              <div className="flex h-1.5 rounded overflow-hidden bg-slate-100 gap-0.5 mt-2.5">
                {doctorCount > 0 && <i className="block h-full bg-blue-500" style={{ width: `${(doctorCount / splitTotal) * 100}%` }} />}
                {adminCount > 0 && <i className="block h-full bg-amber-500" style={{ width: `${(adminCount / splitTotal) * 100}%` }} />}
                {receptionCount > 0 && <i className="block h-full bg-violet-500" style={{ width: `${(receptionCount / splitTotal) * 100}%` }} />}
              </div>
              <div className="text-[11.5px] text-slate-500 mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-blue-500" />{doctorCount} {tx(language, 'shifokor', 'врач', 'doctors')}</span>
                <span className="inline-flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-amber-500" />{adminCount} {tx(language, 'administrator', 'админ', 'admin')}</span>
                {receptionCount > 0 && <span className="inline-flex items-center gap-1"><i className="w-1.5 h-1.5 rounded-full bg-violet-500" />{receptionCount} {tx(language, 'registratura', 'регистратура', 'reception')}</span>}
              </div>
            </article>
            <article className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tx(language, 'Bugun ishda', 'Сегодня на смене', 'On duty today')}</span>
                <span className="w-8 h-8 rounded-lg bg-teal-50 text-[#1499AD] grid place-items-center"><UserCheck className="w-4 h-4" /></span>
              </div>
              <div className="text-[26px] font-extrabold tracking-tight mt-2 leading-none">{workingToday.length} <small className="text-sm text-slate-400 font-bold">/ {cards.length}</small></div>
              <div className="flex items-center gap-2 mt-2 text-[11.5px] text-slate-500 min-w-0">
                <div className="flex">
                  {workingToday.slice(0, 4).map((c) => (
                    <Avatar key={c.id} user={c.user} size={24} className="ring-2 ring-white -ml-1.5 first:ml-0" />
                  ))}
                </div>
                <span className="truncate">{busyCount ? `${busyCount} ${tx(language, 'tasi qabulda', 'на приёме', 'in a visit')}` : workingHint}</span>
              </div>
            </article>
            <article className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tx(language, 'Bugungi qabullar', 'Приёмы сегодня', 'Visits today')}</span>
                <span className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 grid place-items-center"><Calendar className="w-4 h-4" /></span>
              </div>
              <div className="text-[26px] font-extrabold tracking-tight mt-2 leading-none">{todayAppointments.length}</div>
              <p className="text-[11.5px] text-slate-500 mt-2">{todayDone} {tx(language, 'yakunlandi', 'завершено', 'completed')} · {Math.max(0, todayAppointments.length - todayDone)} {tx(language, 'kutilmoqda', 'ожидается', 'waiting')}</p>
            </article>
            <article className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-sm min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{tx(language, 'Shifokorlar ulushi (komissiya)', 'Доля врачей', 'Doctors\' share')}</span>
                <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 grid place-items-center"><Percent className="w-4 h-4" /></span>
              </div>
              <div className="text-[22px] font-extrabold tracking-tight mt-2 leading-none truncate">{fmtMoney(totalShare)}</div>
              <p className="text-[11.5px] text-slate-500 mt-2 leading-snug">{fmtMoney(totalIncome)} {tx(language, 'tushumdan hisoblangan', 'от выручки', 'of revenue')}</p>
            </article>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3.5 min-w-0">
            <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 overflow-x-auto no-scrollbar max-w-full">
              {roleTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRoleFilter(tab.id)}
                  className={cn('h-8 px-3 rounded-lg text-xs font-bold whitespace-nowrap inline-flex items-center gap-1.5', roleFilter === tab.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500')}
                >
                  {tab.label}
                  <span className={cn('text-[10px] px-1.5 rounded-md', roleFilter === tab.id ? 'bg-slate-100 text-slate-600' : 'text-slate-400')}>{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="relative flex-1 min-w-[180px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={tx(language, 'Ism, login yoki telefon…', 'Имя, логин или телефон…', 'Name, login or phone…')}
                className="w-full h-9 pl-8 pr-3 rounded-xl border border-slate-200 bg-white text-xs outline-none focus:border-[#1499AD]"
              />
            </div>
            <div className="flex-1" />
            <FilterSelect label={tx(language, 'Holat', 'Статус', 'Status')} value={statusFilter} onChange={setStatusFilter} options={statusOptions(language)} />
            <FilterSelect label={tx(language, 'Saralash', 'Сортировка', 'Sort')} value={sortKey} onChange={setSortKey} options={sortOptions(language)} />
            <div className="flex bg-slate-100/80 p-1 rounded-xl border border-slate-200/80">
              <button type="button" onClick={() => setViewMode('grid')} className={cn('h-7 w-8 rounded-lg grid place-items-center', view === 'grid' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400')} aria-label="Grid">
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setViewMode('list')} className={cn('h-7 w-8 rounded-lg grid place-items-center', view === 'list' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400')} aria-label="List">
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {loading && (
        <div className="grid grid-cols-1 min-[1100px]:grid-cols-2 min-[1380px]:grid-cols-3 gap-3.5">
          {[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-2xl bg-white border border-slate-100 animate-pulse" />)}
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Users className="w-8 h-8 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">{t('staff.noStaff')}</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className={cn(phone || view === 'list' ? 'flex flex-col gap-2.5' : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5', phone && 'pb-32')}>
          {filtered.map((c) => (
            <StaffCard
              key={c.id}
              card={c}
              phone={phone}
              compact={view === 'list' && !phone}
              lead={String(c.id) === String(topEarnerId)}
              selected={String(detailId) === String(c.id)}
              language={language}
              presenceLabel={presenceLabel(c.presence)}
              todayJs={todayJs}
              nowMinutes={nowMinutes}
              onOpen={() => openDetail(c.id)}
              onEdit={() => handleOpenEditStaff(c.user)}
              onCall={() => callUser(c.user)}
              onMessage={() => messageUser(c.user)}
              onSchedule={() => openSchedule(c)}
              onPerms={() => handleOpenEditStaff(c.user, { focusRole: true })}
              onToggleDay={(js) => toggleWorkingDay(c, js)}
            />
          ))}
        </div>
      )}

      {phone && createPortal(
        <button
          type="button"
          onClick={() => { if (openCreate()) setIsModalOpen(true); }}
          className="fixed right-4 z-[45] h-[52px] pl-4 pr-5 rounded-2xl bg-emerald-600 text-white font-bold text-sm inline-flex items-center gap-2 shadow-[0_12px_28px_-10px_rgba(5,150,105,0.9)]"
          style={{ bottom: 'calc(50px + env(safe-area-inset-bottom, 0px) + 16px)' }}
        >
          <UserPlus className="w-[18px] h-[18px]" />
          {tx(language, 'Yangi xodim', 'Новый сотрудник', 'New staff')}
        </button>,
        document.body
      )}

      {phone && (
        <Dialog open={isModalOpen} onOpenChange={(open) => { if (open && !openCreate()) return; setIsModalOpen(open); }}>
          {renderCreateForm()}
        </Dialog>
      )}

      {renderCredentials()}
      {renderEditForm()}

      {detail && (
        <StaffDrawer
          card={detail}
          phone={phone}
          language={language}
          tab={detailTab}
          setTab={setDetailTab}
          today={today}
          todayJs={todayJs}
          nowMinutes={nowMinutes}
          weekStart={weekStart}
          presenceLabel={presenceLabel(detail.presence)}
          onClose={() => setDetailId(null)}
          onEdit={() => handleOpenEditStaff(detail.user)}
          onDelete={() => handleDeleteStaff(detail.id, detail.name)}
          onCall={() => callUser(detail.user)}
          onMessage={() => messageUser(detail.user)}
          onSchedule={() => openSchedule(detail)}
          onPerms={() => handleOpenEditStaff(detail.user, { focusRole: true })}
          onOpenAppointments={() => openDoctorAppointments(detail)}
          onOpenPatients={() => openDoctorPatients(detail)}
          onOpenDay={(date) => openDoctorDay(detail, date)}
        />
      )}
    </div>
  );

  function renderCreateForm() {
    return (
      <DialogContent className="sm:max-w-[425px] rounded-3xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-black tracking-tight">{t('staff.addNew')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleAddStaff} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('staff.full_name')}</Label>
            <Input placeholder="Dr. Alisher Toshmatov" value={newStaff.full_name} onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })} className="rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('staff.phone')}</Label>
              <Input placeholder="+998 90 123 45 67" value={newStaff.phone} onChange={(e) => setNewStaff({ ...newStaff, phone: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t('staff.specialty')}</Label>
              <Input placeholder="Ortodont" value={newStaff.specialty} onChange={(e) => setNewStaff({ ...newStaff, specialty: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('staff.username')}</Label>
              <Input placeholder="alisher_dr" value={newStaff.username} onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value })} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>{t('staff.password')}</Label>
              <Input type="password" placeholder="••••••" value={newStaff.password} onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })} className="rounded-xl" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('staff.role')}</Label>
              <select className="flex h-10 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={newStaff.role} onChange={(e) => setNewStaff({ ...newStaff, role: e.target.value })}>
                <option value="doctor">{t('staff.roles.doctor')}</option>
                <option value="admin">{t('staff.roles.admin')}</option>
                <option value="receptionist">{t('staff.roles.receptionist')}</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>{t('staff.commission_rate')}</Label>
              <Input type="number" value={newStaff.commission} onChange={(e) => setNewStaff({ ...newStaff, commission: e.target.value })} onWheel={(e) => e.target.blur()} className="rounded-xl" />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 font-bold">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    );
  }

  function renderCredentials() {
    return (
      <Dialog open={!!credentialsModal} onOpenChange={() => setCredentialsModal(null)}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl p-6 text-center border-emerald-100">
          <div className="mx-auto w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-emerald-600" />
          </div>
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-slate-900">{t('staff.addSuccess')}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4 text-left">
            <p className="text-sm text-slate-500 text-center">
              <strong className="text-slate-800">{credentialsModal?.name}</strong> {t('staff.addSuccessDetail')}. {t('staff.credentialsHint')}
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <CredRow label="Klinika ID" value={credentialsModal?.clinicId} />
              <CredRow label={t('staff.username')} value={credentialsModal?.username} />
              <CredRow label={t('staff.password')} value={credentialsModal?.password} />
            </div>
          </div>
          <Button onClick={() => setCredentialsModal(null)} className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl h-12 font-bold">{t('staff.understand')}</Button>
        </DialogContent>
      </Dialog>
    );
  }

  function renderEditForm() {
    return (
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[450px] rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black tracking-tight">{t('settings.staff.editDoctor') || "Xodim ma'lumotlarini tahrirlash"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateStaff} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">{t('staff.full_name')} *</Label>
              <Input value={editStaffForm.full_name} onChange={(e) => setEditStaffForm({ ...editStaffForm, full_name: e.target.value })} className="rounded-xl h-11" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.phone')}</Label>
                <Input value={editStaffForm.phone} onChange={(e) => setEditStaffForm({ ...editStaffForm, phone: e.target.value })} className="rounded-xl h-11" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.specialty')}</Label>
                <Input value={editStaffForm.specialty} onChange={(e) => setEditStaffForm({ ...editStaffForm, specialty: e.target.value })} className="rounded-xl h-11" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.username')} *</Label>
                <Input value={editStaffForm.username} onChange={(e) => setEditStaffForm({ ...editStaffForm, username: e.target.value })} className="rounded-xl h-11 font-mono text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.password')}</Label>
                <Input type="password" autoComplete="new-password" placeholder={t('staff.passwordUnchanged')} value={editStaffForm.password} onChange={(e) => setEditStaffForm({ ...editStaffForm, password: e.target.value })} className="rounded-xl h-11" />
                <p className="text-[10px] text-slate-400">{t('staff.passwordHint')}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.role')}</Label>
                <select id="staff-role-select" autoFocus={focusRole} aria-label={t('staff.role')} className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm" value={editStaffForm.role} onChange={(e) => setEditStaffForm({ ...editStaffForm, role: e.target.value })}>
                  <option value="doctor">{t('staff.roles.doctor')}</option>
                  <option value="admin">{t('staff.roles.admin')}</option>
                  <option value="receptionist">{t('staff.roles.receptionist')}</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">{t('staff.commission_rate')} (%)</Label>
                <Input type="number" value={editStaffForm.commission} onChange={(e) => setEditStaffForm({ ...editStaffForm, commission: e.target.value })} onWheel={(e) => e.target.blur()} className="rounded-xl h-11" />
              </div>
            </div>
            <DialogFooter className="pt-2 flex gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)} className="h-11 rounded-xl">{t('common.cancel') || 'Bekor qilish'}</Button>
              <Button type="submit" className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl">{t('common.save') || 'Saqlash'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
}

function CredRow({ label, value }) {
  return (
    <div>
      <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block mb-0.5">{label}</span>
      <div className="font-mono text-base font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-100">{value}</div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 min-w-0">
      <span className="text-slate-400 font-medium shrink-0">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="bg-transparent outline-none font-semibold pr-1 max-w-[120px]">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function MiniStat({ label, value, hint }) {
  return (
    <div className="min-w-0 bg-white border border-slate-200/80 rounded-2xl p-2.5">
      <span className="block text-[10px] font-bold uppercase text-slate-400 leading-tight">{label}</span>
      <b className="block text-[17px] font-extrabold tracking-tight mt-1 leading-none">{value}</b>
      <span className="block text-[10.5px] text-slate-500 leading-snug mt-1">{hint}</span>
    </div>
  );
}

function statusOptions(language) {
  return [
    { value: 'all', label: tx(language, 'Barchasi', 'Все', 'All') },
    { value: 'active', label: tx(language, 'Faol', 'Активные', 'Active') },
    { value: 'busy', label: tx(language, 'Qabulda', 'На приёме', 'In visit') },
    { value: 'off', label: tx(language, 'Ishda emas', 'Не на смене', 'Off') },
    { value: 'inactive', label: tx(language, 'Nofaol', 'Неактивные', 'Inactive') },
  ];
}

function sortOptions(language) {
  return [
    { value: 'revenue', label: tx(language, 'Tushum', 'Выручка', 'Revenue') },
    { value: 'name', label: tx(language, 'Ism', 'Имя', 'Name') },
    { value: 'appointments', label: tx(language, 'Qabullar', 'Приёмы', 'Visits') },
    { value: 'commission', label: tx(language, 'Komissiya', 'Комиссия', 'Commission') },
  ];
}

function StaffCard({ card, phone, compact, lead, selected, language, presenceLabel, todayJs, nowMinutes, onOpen, onEdit, onCall, onMessage, onSchedule, onPerms, onToggleDay }) {
  const isAdmin = card.role === 'admin';
  return (
    <article className={cn('bg-white border rounded-2xl p-4 flex flex-col gap-3 min-w-0 shadow-sm', selected ? 'border-[#1499AD] ring-2 ring-[#1499AD]/20' : 'border-slate-200/80')}>
      <div className="flex gap-3 items-start min-w-0">
        <Avatar user={card.user} size={phone ? 46 : 48} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[15px] text-slate-900 truncate leading-tight">{formatDoctorName(card.name)}</div>
          <div className="text-[11.5px] text-slate-400 font-mono truncate">@{card.username || '—'}</div>
          {!phone && (
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              <RoleBadge role={card.role} language={language} />
              {card.specialty && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{card.specialty}</span>}
              {lead && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-gradient-to-b from-amber-100 to-amber-200 text-amber-900 inline-flex items-center gap-1">
                  <Award className="w-3 h-3" /> №1 {tx(language, 'tushum', 'выручка', 'revenue')}
                </span>
              )}
            </div>
          )}
        </div>
        <StatusPill kind={card.presence === 'on' ? 'on' : card.presence} label={presenceLabel} />
      </div>

      {phone && (
        <div className="flex flex-wrap gap-1.5">
          <RoleBadge role={card.role} language={language} />
          {card.specialty && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{card.specialty}</span>}
          {lead && <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900">№1 {tx(language, 'tushum', 'выручка', 'revenue')}</span>}
        </div>
      )}

      {isAdmin ? (
        <div className="bg-amber-50 border border-amber-100 rounded-xl p-2.5 text-[11.5px] text-amber-900 flex gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          <div><b>{tx(language, "To'liq kirish huquqi", 'Полный доступ', 'Full access')}</b> — {tx(language, "barcha bo'limlar, xodimlar va moliya.", 'все разделы, сотрудники и финансы.', 'every section, staff and finance.')}</div>
        </div>
      ) : card.presence === 'off' ? (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
          <div className="text-[11.5px] text-slate-500 mb-2"><b className="text-slate-800">{tx(language, 'Bugun ishda emas', 'Сегодня не на смене', 'Off today')}</b></div>
          <div className="h-2.5 rounded-md bg-[repeating-linear-gradient(135deg,#F1F5F9_0_6px,#E9EEF4_6px_12px)]" />
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
          <div className="flex justify-between text-[11.5px] text-slate-500 mb-2 gap-2">
            <span>{tx(language, 'Bugun', 'Сегодня', 'Today')}: <b className="text-slate-800">{card.todayAppts.length} {tx(language, 'ta qabul', 'приём', 'visits')}</b></span>
            <span className="truncate">
              {card.nextAppt
                ? <>{tx(language, 'keyingisi', 'след.', 'next')} <b className="text-slate-800">{card.nextAppt.time || '—'}</b></>
                : (card.todayAppts.length ? tx(language, 'navbat tugadi', 'очередь завершена', 'queue finished') : tx(language, 'qabul yo\'q', 'нет приёма', 'no visit'))}
            </span>
          </div>
          <DayTimeline appointments={card.todayAppts} nowMinutes={nowMinutes} />
        </div>
      )}

      <div className="grid grid-cols-3 border border-slate-100 rounded-xl overflow-hidden">
        <Metric label={tx(language, 'Qabul', 'Приём', 'Visits')} value={card.appointments} />
        <Metric label={tx(language, 'Bajarilgan', 'Готово', 'Done')} value={<>{card.completed} <small className="text-[11px] text-slate-400 font-semibold">/ {card.completion}%</small></>} />
        <Metric label={tx(language, 'Tushum', 'Выручка', 'Revenue')} value={fmtCompact(card.revenue)} />
      </div>

      {!isAdmin && (
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>{tx(language, 'Komissiya', 'Комиссия', 'Commission')}</span>
          <b className="text-emerald-700">{card.commission}%</b>
          <div className="flex-1 h-1.5 rounded bg-slate-100 overflow-hidden"><i className="block h-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, card.commission))}%` }} /></div>
          <span>{tx(language, 'ulush', 'доля', 'share')} <b className="text-slate-800">{fmtCompact(card.share)}</b></span>
        </div>
      )}

      <WeekChips flags={card.dayFlags} todayJs={todayJs} onToggle={onToggleDay} />

      {phone ? (
        <div className="grid grid-cols-4 gap-1.5">
          <IconAction label={tx(language, "Qo'ng'iroq", 'Звонок', 'Call')} onClick={onCall}><Phone className="w-4 h-4" /></IconAction>
          <IconAction label={tx(language, 'Xabar', 'Сообщение', 'Message')} onClick={onMessage}><Send className="w-4 h-4" /></IconAction>
          <IconAction label={tx(language, 'Jadval', 'График', 'Schedule')} onClick={onSchedule}><Calendar className="w-4 h-4" /></IconAction>
          <IconAction label={tx(language, 'Batafsil', 'Подробнее', 'Details')} onClick={onOpen}><ChevronRight className="w-4 h-4" /></IconAction>
        </div>
      ) : (
        <div className={cn('flex items-center gap-1.5 border-t border-slate-100 pt-3', compact && 'pt-1 border-0')}>
          <RoundIcon title={tx(language, "Qo'ng'iroq", 'Звонок', 'Call')} onClick={onCall}><Phone className="w-3.5 h-3.5" /></RoundIcon>
          <RoundIcon title={tx(language, 'Xabar', 'Сообщение', 'Message')} onClick={onMessage}><Send className="w-3.5 h-3.5" /></RoundIcon>
          <RoundIcon title={tx(language, 'Jadval', 'График', 'Schedule')} onClick={onSchedule}><Calendar className="w-3.5 h-3.5" /></RoundIcon>
          <RoundIcon title={tx(language, 'Huquqlar', 'Права', 'Access')} onClick={onPerms}><Shield className="w-3.5 h-3.5" /></RoundIcon>
          <RoundIcon title={tx(language, 'Tahrirlash', 'Изменить', 'Edit')} onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></RoundIcon>
          <button type="button" onClick={onOpen} className="ml-auto text-[12.5px] font-semibold text-teal-700 inline-flex items-center gap-0.5">
            {tx(language, 'Batafsil', 'Подробнее', 'Details')} <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </article>
  );
}

function RoleBadge({ role, language }) {
  const admin = role === 'admin';
  const reception = role === 'receptionist';
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide', admin ? 'bg-amber-50 text-amber-700' : reception ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700')}>
      {roleLabel(role, language)}
    </span>
  );
}

function Metric({ label, value }) {
  return (
    <div className="px-2.5 py-2 border-l border-slate-100 first:border-0 min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">{label}</span>
      <b className="block text-[15px] font-extrabold tracking-tight mt-0.5 truncate">{value}</b>
    </div>
  );
}

function RoundIcon({ title, onClick, children }) {
  return (
    <button type="button" title={title} onClick={onClick} className="w-8 h-8 rounded-lg border border-slate-200 text-slate-500 grid place-items-center hover:bg-slate-50 hover:text-teal-700">
      {children}
    </button>
  );
}

function IconAction({ onClick, children, label }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="h-10 rounded-xl bg-slate-50 text-teal-700 grid place-items-center">
      {children}
    </button>
  );
}

function StaffDrawer({ card, phone, language, tab, setTab, todayJs, nowMinutes, weekStart, presenceLabel, onClose, onEdit, onDelete, onCall, onMessage, onSchedule, onPerms, onOpenAppointments, onOpenPatients, onOpenDay }) {
  const clinicAmount = Math.max(0, card.revenue - card.share);
  const clinicPct = card.revenue > 0 ? Math.round((clinicAmount / card.revenue) * 100) : null;
  const doctorPct = card.revenue > 0 ? Math.max(0, 100 - clinicPct) : 0;
  const access = roleAccess(card.role);
  const weekDays = WEEK_LABELS.map((d, i) => {
    const date = addDays(weekStart, i);
    const key = isoDate(date);
    const hours = scheduleHoursLabel(card.user.workingHours, d.js);
    return { ...d, date, key, count: card.weekCounts[key] || 0, hours, isToday: d.js === todayJs };
  });

  const tabs = [
    ['general', tx(language, 'Umumiy', 'Общее', 'Overview')],
    ['schedule', tx(language, 'Jadval', 'График', 'Schedule')],
    ['finance', tx(language, 'Moliya', 'Финансы', 'Finance')],
    ['access', tx(language, 'Huquqlar', 'Права', 'Access')],
    ['login', tx(language, 'Kirish', 'Вход', 'Login')],
  ];

  return (
    <div className="fixed inset-0 z-[80]">
      <button type="button" className="absolute inset-0 bg-[#0C1222]/40" aria-label="Yopish" onClick={onClose} />
      <aside className={cn(
        'absolute bg-white flex flex-col shadow-2xl',
        phone ? 'left-0 right-0 bottom-0 top-16 rounded-t-[22px]' : 'top-0 right-0 bottom-0 w-[min(470px,100vw)]'
      )}>
        {phone && <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mt-2" />}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-b from-teal-50/80 to-white relative">
          <button type="button" onClick={onClose} className="absolute right-3 top-3 w-8 h-8 rounded-full border border-slate-200 grid place-items-center text-slate-500 bg-white"><X className="w-4 h-4" /></button>
          <div className="flex gap-3 items-center pr-8">
            <Avatar user={card.user} size={phone ? 56 : 64} />
            <div className="min-w-0">
              <div className="text-lg font-extrabold tracking-tight truncate">{formatDoctorName(card.name)}</div>
              <div className="text-xs text-slate-500 font-mono truncate">@{card.username || '—'}{card.phone ? ` · ${card.phone}` : ''}</div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <RoleBadge role={card.role} language={language} />
                {card.specialty && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600">{card.specialty}</span>}
                <StatusPill kind={card.presence === 'on' ? 'on' : card.presence} label={presenceLabel} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            <QaButton onClick={onCall} icon={<Phone className="w-4 h-4" />} label={tx(language, "Qo'ng'iroq", 'Звонок', 'Call')} />
            <QaButton onClick={onMessage} icon={<Send className="w-4 h-4" />} label={tx(language, 'Xabar', 'Сообщение', 'Message')} />
            <QaButton onClick={onSchedule} icon={<Calendar className="w-4 h-4" />} label={tx(language, 'Jadval', 'График', 'Schedule')} />
            <QaButton onClick={onEdit} icon={<Pencil className="w-4 h-4" />} label={tx(language, 'Tahrirlash', 'Изменить', 'Edit')} primary />
          </div>
        </div>
        <div className="flex gap-4 px-4 border-b border-slate-100 overflow-x-auto no-scrollbar">
          {tabs.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={cn('py-2.5 text-[12.5px] font-semibold whitespace-nowrap border-b-2 -mb-px', tab === id ? 'border-[#1499AD] text-slate-900' : 'border-transparent text-slate-400')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 min-h-0">
          {(tab === 'general' || tab === 'finance') && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Kpi onClick={onOpenAppointments} label={tx(language, 'Qabullar', 'Приёмы', 'Visits')} value={<>{card.appointments} <small className="text-[11px] text-slate-400 font-semibold">{tx(language, 'ta', 'шт', '')}</small></>} />
                <Kpi label={tx(language, 'Bajarilgan', 'Выполнено', 'Completed')} value={<>{card.completed} <small className="text-[11px] text-slate-400 font-semibold">· {card.completion}%</small></>} />
                <Kpi onClick={onOpenPatients} label={tx(language, 'Bemorlar soni', 'Пациенты', 'Patients')} value={<>{card.patients} <small className="text-[11px] text-slate-400 font-semibold">{tx(language, 'ta', 'чел', '')}</small></>} />
                <Kpi label={tx(language, "O'rtacha chek", 'Средний чек', 'Avg. check')} value={card.avgCheck ? fmtMoney(card.avgCheck) : '—'} />
              </div>
              <div>
                <div className="flex justify-between text-[12.5px] font-bold mb-2">
                  <span>{tx(language, 'Tushum taqsimoti', 'Распределение выручки', 'Revenue split')}</span>
                  <span className="text-[11px] text-slate-400 font-semibold">{tx(language, 'Foizli', 'Процент', 'Rate')} · {card.commission}%</span>
                </div>
                {card.revenue > 0 ? (
                  <>
                    <div className="flex h-7 rounded-lg overflow-hidden text-[11px] font-bold text-white">
                      <div className="bg-[#1499AD] flex items-center px-2 min-w-0 truncate" style={{ width: `${Math.max(clinicPct, 8)}%` }}>{tx(language, 'Klinika', 'Клиника', 'Clinic')} {fmtCompact(clinicAmount)}</div>
                      {doctorPct > 0 && <div className="bg-emerald-600 flex items-center px-2 min-w-0 truncate" style={{ width: `${Math.max(doctorPct, 8)}%` }}>{tx(language, 'Shifokor', 'Врач', 'Doctor')} {fmtCompact(card.share)}</div>}
                    </div>
                    <p className="text-[11.5px] text-slate-500 mt-1.5">{tx(language, 'Umumiy tushum', 'Общая выручка', 'Total')}: <b className="text-slate-800">{fmtMoney(card.revenue)}</b>{clinicPct != null && <> · {tx(language, 'klinika ulushi', 'доля клиники', 'clinic share')} {clinicPct}%</>}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 bg-slate-50 rounded-xl px-3 py-3">{tx(language, 'Bu xodimga bog\'langan tushum yo\'q.', 'Нет выручки, привязанной к сотруднику.', 'No revenue linked to this person.')}</p>
                )}
              </div>
            </>
          )}

          {(tab === 'general' || tab === 'schedule') && (
            <div>
              <div className="flex justify-between items-center text-[12.5px] font-bold mb-2">
                <span>{tx(language, 'Bu hafta', 'Эта неделя', 'This week')} <em className="not-italic text-[9px] font-extrabold tracking-wider text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded ml-1">YANGI</em></span>
                <button type="button" onClick={onSchedule} className="text-[11.5px] font-semibold text-teal-700">{tx(language, 'Jadvalni ochish', 'Открыть график', 'Open schedule')}</button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {weekDays.map((d) => (
                  <button type="button" key={d.key} onClick={() => onOpenDay(d.key)} title={`${d.short} ${d.date.getDate()} — jadvalni ochish`} className={cn('border rounded-lg py-1.5 text-center min-w-0 cursor-pointer hover:ring-2 hover:ring-[#1499AD]/30 transition-shadow', d.isToday ? 'bg-[#1499AD] border-[#1499AD] text-white' : d.hours === 'dam' ? 'bg-slate-50 text-slate-400 border-slate-100' : 'border-slate-100')}>
                    <small className={cn('block text-[9.5px] font-semibold', d.isToday ? 'text-teal-50' : 'text-slate-400')}>{d.short}</small>
                    <b className="block text-[13px]">{d.date.getDate()}</b>
                    <div className={cn('text-[9px] font-semibold mt-0.5 truncate px-0.5', d.isToday ? 'text-teal-50' : 'text-slate-400')}>{d.hours || '—'}</div>
                    <div className={cn('text-[10px] font-bold', d.isToday ? 'text-white' : d.count ? 'text-teal-700' : 'text-slate-300')}>{d.count ? `${d.count}` : '—'}</div>
                  </button>
                ))}
              </div>
              {!card.scheduleKnown && (
                <p className="text-[11px] text-slate-400 mt-2">{tx(language, 'Ish soatlari sozlamalarda kiritilmagan. Kunlar qabullar bo\'yicha.', 'Часы работы не заданы. Дни отмечены по приёмам.', 'Working hours are not set. Days reflect recorded visits.')}</p>
              )}
            </div>
          )}

          {tab === 'general' && (
            <div>
              <div className="text-[12.5px] font-bold mb-1">{tx(language, 'Bugungi qabullar', 'Приёмы сегодня', 'Today\'s visits')}</div>
              {card.todayAppts.length === 0 && <p className="text-xs text-slate-400 py-2">{tx(language, 'Bugun qabul yozuvi yo\'q.', 'На сегодня записей нет.', 'No visits today.')}</p>}
              {card.todayAppts.map((a) => {
                const done = isCompletedStatus(a.status);
                const live = isInProgressStatus(a.status) || (!done && !isCancelledStatus(a.status) && timeToMinutes(a.time) != null && nowMinutes >= timeToMinutes(a.time) && nowMinutes < timeToMinutes(a.time) + (Number(a.duration) || 30));
                return (
                  <div key={a.id || `${a.time}-${a.patient_name}`} className="flex items-center gap-2.5 py-1.5 border-b border-dashed border-slate-100 last:border-0">
                    <span className="w-11 text-xs font-bold tabular-nums">{a.time || '—'}</span>
                    <div className="flex-1 min-w-0">
                      <b className="block text-[12.5px] font-semibold truncate">{a.patient_name || tx(language, 'Bemor', 'Пациент', 'Patient')}</b>
                      <span className="text-[11px] text-slate-400 truncate block">{[a.service_name, a.tooth_number ? `${a.tooth_number}-tish` : ''].filter(Boolean).join(' · ') || '—'}</span>
                    </div>
                    <span className={cn('text-[11px] font-semibold inline-flex items-center gap-1', done ? 'text-emerald-600' : live ? 'text-teal-700' : 'text-slate-500')}>
                      <i className={cn('w-1.5 h-1.5 rounded-full', done ? 'bg-emerald-500' : live ? 'bg-[#1499AD]' : 'bg-slate-300')} />
                      {done ? tx(language, 'Bajarildi', 'Готово', 'Done') : live ? tx(language, 'Qabulda', 'На приёме', 'Live') : (a.status || tx(language, 'Reja', 'План', 'Planned'))}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {(tab === 'general' || tab === 'access') && (
            <div>
              <div className="flex justify-between text-[12.5px] font-bold mb-2">
                <span>{tx(language, 'Kirish huquqlari', 'Права доступа', 'Access')} <em className="not-italic text-[9px] font-extrabold tracking-wider text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded ml-1">YANGI</em></span>
                <span className="text-[11.5px] font-semibold text-slate-400">{tx(language, 'Lavozim andozasi', 'Шаблон роли', 'Role template')}: {roleLabel(card.role, language)}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4">
                {access.map(([name, on]) => (
                  <div key={name} className="flex items-center justify-between py-1.5 text-xs font-medium text-slate-700">
                    {name}
                    <span className={cn('w-8 h-[18px] rounded-full relative', on ? 'bg-emerald-500' : 'bg-slate-300')}>
                      <i className={cn('absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow', on ? 'left-4' : 'left-0.5')} />
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">{tx(language, 'Huquqlar lavozimga bog\'langan va alohida saqlanmaydi.', 'Права следуют за ролью и отдельно не хранятся.', 'Access follows the role and is not stored separately.')}</p>
              <button type="button" onClick={onPerms} className="mt-2 h-9 px-3 rounded-xl bg-[#0C1222] text-white text-xs font-bold">
                {tx(language, 'Lavozimni o\'zgartirish', 'Изменить роль', 'Change role')}
              </button>
            </div>
          )}

          {tab === 'login' && (
            <div className="space-y-2 text-sm">
              <div className="rounded-xl border border-slate-100 p-3"><span className="text-[10px] uppercase font-bold text-slate-400">Login</span><div className="font-mono font-bold">@{card.username || '—'}</div></div>
              <div className="rounded-xl border border-slate-100 p-3"><span className="text-[10px] uppercase font-bold text-slate-400">{tx(language, 'Telefon', 'Телефон', 'Phone')}</span><div className="font-bold">{card.phone || '—'}</div></div>
              <p className="text-[11px] text-slate-400">{tx(language, 'Parol ko\'rsatilmaydi. Yangilash uchun pastdagi tugmadan foydalaning.', 'Пароль скрыт. Обновите его кнопкой ниже.', 'The password is hidden. Use the button below to change it.')}</p>
            </div>
          )}
        </div>
        <div className="border-t border-slate-200 p-3 flex gap-2 bg-white">
          <button type="button" onClick={onEdit} className="h-11 px-3 rounded-xl border border-slate-200 text-sm font-semibold inline-flex items-center gap-1.5"><KeyRound className="w-4 h-4" />{phone ? tx(language, 'Parol', 'Пароль', 'Password') : tx(language, 'Parolni yangilash', 'Сменить пароль', 'Reset password')}</button>
          <button type="button" onClick={onDelete} className="w-11 h-11 rounded-xl border border-rose-100 text-rose-600 grid place-items-center"><Trash2 className="w-4 h-4" /></button>
          {!phone && <button type="button" onClick={onClose} className="ml-auto h-11 px-4 rounded-xl border border-slate-200 text-sm font-semibold">{tx(language, 'Yopish', 'Закрыть', 'Close')}</button>}
          <button type="button" onClick={onEdit} className={cn('h-11 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold inline-flex items-center justify-center gap-1.5', phone && 'flex-1')}>
            <Pencil className="w-4 h-4" />{tx(language, 'Tahrirlash', 'Изменить', 'Edit')}
          </button>
        </div>
      </aside>
    </div>
  );
}

function QaButton({ onClick, icon, label, primary }) {
  return (
    <button type="button" onClick={onClick} className={cn('h-14 rounded-xl border text-[11px] font-semibold flex flex-col items-center justify-center gap-1', primary ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-700')}>
      <span className={primary ? 'text-white' : 'text-[#1499AD]'}>{icon}</span>
      {label}
    </button>
  );
}

function Kpi({ label, value, onClick }) {
  const body = (
    <>
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <b className="block text-lg font-extrabold tracking-tight mt-0.5 truncate">{value}</b>
    </>
  );
  if (!onClick) return <div className="border border-slate-100 rounded-xl px-3 py-2.5 min-w-0">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      className="border border-slate-100 rounded-xl px-3 py-2.5 min-w-0 text-left cursor-pointer hover:border-[#1499AD] hover:bg-teal-50/40 transition-colors"
    >
      {body}
    </button>
  );
}

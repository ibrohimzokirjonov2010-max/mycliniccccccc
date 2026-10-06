import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from '@/i18n/LanguageContext';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ClinicDateField } from '@/components/ui/ClinicDateField';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, X, Loader2 } from 'lucide-react';
import PatientModal from '../patients/PatientModal';
import PatientSelect from '../patients/PatientSelect';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { isScheduledOn } from '@/utils/clinicMetrics';

const durations = [15, 30, 45, 60, 90, 120];
const appointmentStatuses = ['Scheduled', 'Waiting', 'In Progress', 'Completed', 'Cancelled', 'No-Show'];

const normalizeToDateOnly = (dateStr) => {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  if (clean.includes('.')) {
    const [d, m, y] = clean.split('.');
    if (d.length === 4) return `${d}-${m}-${y}`; // already YYYY.MM.DD
    return `${y}-${m}-${d}`;
  }
  return clean;
};

const getEffectiveMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  // Hours from 00:00 to 06:59 belong to night / end of day clinic shift (mapped to 24:00 - 30:59)
  const effH = h < 7 ? h + 24 : h;
  return effH * 60 + (m || 0);
};

const APPOINTMENT_TIME_SLOTS = [
  ...Array.from({ length: 16 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`),
  '23:30',
  '00:00'
];

const TASHKENT_TZ = 'Asia/Tashkent';

/** Current wall-clock date/time in Asia/Tashkent (independent of the browser time zone). */
const tashkentNow = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TASHKENT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    hours: Number(get('hour')) % 24,
    minutes: Number(get('minute')),
  };
};

/** Today's YYYY-MM-DD in Asia/Tashkent (no toISOString UTC shift). */
const tashkentToday = (now = new Date()) => tashkentNow(now).date;

/** Pure calendar math on YYYY-MM-DD strings (UTC arithmetic only, so no time-zone drift). */
const addDaysStr = (dateStr, n) => {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + Number(n || 0)));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};

/** Weekday (0 = Sunday) of a YYYY-MM-DD string, or null when unparsable. */
const weekdayOfDateStr = (dateStr) => {
  const m = String(dateStr || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))).getUTCDay();
};

const tashkentNowMinutes = (now = new Date()) => {
  const t = tashkentNow(now);
  return getEffectiveMinutes(`${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`);
};

const isSlotPastForDate = (slotTime, dateStr, now = new Date()) => {
  const selected = normalizeToDateOnly(dateStr);
  if (!selected) return false;
  const todayStr = tashkentToday(now);
  if (selected < todayStr) return true;
  if (selected > todayStr) return false;
  return getEffectiveMinutes(slotTime) <= tashkentNowMinutes(now);
};

/** Next usable grid slot for a date (today: first slot still in the future). */
const getNextReasonableSlot = (dateStr, now = new Date()) => {
  const todayStr = tashkentToday(now);
  const selected = normalizeToDateOnly(dateStr) || todayStr;
  if (selected < todayStr) return null;
  if (selected > todayStr) return APPOINTMENT_TIME_SLOTS[0];
  const nowMins = tashkentNowMinutes(now);
  const next = APPOINTMENT_TIME_SLOTS.find((sl) => getEffectiveMinutes(sl) > nowMins);
  return next || null;
};

/** YYYY-MM-DD for the DB `date` column (accepts dd.mm.yyyy / ISO strings). */
const toDbDate = (value) => normalizeToDateOnly(String(value || ''));

/** Build the exact payload sent to the Appointment table (clean types, no empty junk). */
const buildAppointmentPayload = (form) => {
  const payload = {
    ...form,
    date: toDbDate(form.date),
    time: String(form.time || '').slice(0, 5),
    duration: Number(form.duration) || 30,
    price: Number(form.price) || 0,
    status: form.status || 'Scheduled',
  };
  Object.keys(payload).forEach((key) => {
    if (payload[key] === '' || payload[key] === undefined) delete payload[key];
  });
  return payload;
};

/**
 * Save a new appointment. The first attempt sends the full payload; if the server rejects it
 * (HTTP 400 - e.g. an optional column with a different type) we retry once with only the core
 * columns and keep the optional values inside the notes so nothing is lost.
 */
const createAppointmentSafely = async (form) => {
  const payload = buildAppointmentPayload(form);
  try {
    return await base44.entities.Appointment.create(payload);
  } catch (firstError) {
    console.warn('Appointment.create failed, retrying with core columns only:', firstError);
    const { tooth_number, service_id, price, duration, ...core } = payload;
    const extra = [
      tooth_number ? `Tish: ${tooth_number}` : '',
      service_id ? `Xizmat ID: ${service_id}` : '',
    ].filter(Boolean).join(' | ');
    const retryPayload = {
      ...core,
      price: Number(price) || 0,
      duration: Number(duration) || 30,
      notes: [core.notes, extra].filter(Boolean).join('\n'),
    };
    try {
      return await base44.entities.Appointment.create(retryPayload);
    } catch (secondError) {
      console.error('Appointment.create retry failed:', secondError);
      throw secondError;
    }
  }
};

/**
 * Schedule the morning + 2h Telegram reminders. Entirely best-effort:
 * a missing entity / table or any network error is logged and ignored.
 */
const scheduleAppointmentNotifications = async (appointmentRecord, form) => {
  try {
    const notificationEntity = base44?.entities?.ScheduledNotification;
    if (!notificationEntity || typeof notificationEntity.create !== 'function') return;
    if (!appointmentRecord?.id || !form?.date || !form?.time) return;

    const apptDate = toDbDate(form.date);
    const apptTime = String(form.time).slice(0, 5);
    const morningDate = new Date(`${apptDate}T08:00:00`);
    const fullApptDate = new Date(`${apptDate}T${apptTime || '00:00'}:00`);
    if (Number.isNaN(morningDate.getTime()) || Number.isNaN(fullApptDate.getTime())) return;
    const reminderDate = new Date(fullApptDate.getTime() - 2 * 60 * 60 * 1000);

    const hour = new Date().getHours();
    let greeting = 'Xayrli kun';
    if (hour < 11) greeting = '☀️ Xayrli tong';
    else if (hour > 18) greeting = '🌙 Xayrli kech';

    const morningMsg = `${greeting}, ${form.patient_name}! \n\n🦷 Ertangi qabulingizni oldindan rejalashtirib qo'ydik. Soat ${apptTime}da sizni kutib qolamiz. 👌`;
    const reminderMsg = `🔔 Eslatma: \nQabulingizga 2 soat vaqt qoldi. Soat ${apptTime}da uchrashuvimiz bor. ✅`;

    const base = {
      patient_id: form.patient_id,
      patient_name: form.patient_name,
      channel: 'telegram',
      status: 'scheduled',
      appointment_id: appointmentRecord.id,
    };
    await notificationEntity.create({ ...base, message: morningMsg, scheduled_at: morningDate.toISOString(), type: 'appointment_morning' });
    await notificationEntity.create({ ...base, message: reminderMsg, scheduled_at: reminderDate.toISOString(), type: 'appointment_2hr' });
  } catch (notifErr) {
    console.error('Xabarlarni rejalashtirishda xatolik:', notifErr);
  }
};

const autoCategorize = (name) => {
  const n = name?.toLowerCase() || '';
  if (n.includes('olish') || n.includes('sug\'urish') || n.includes('implant') || n.includes('xirurg') || n.includes('anesteziya')) return 'XIRURGIYA';
  if (n.includes('karonka') || n.includes('protez') || n.includes('vinir') || n.includes('sirkoniy') || n.includes('ko\'prik')) return 'ORTOPEDIYA';
  if (n.includes('breket') || n.includes('reteyner') || n.includes('plastinka') || n.includes('ortodont')) return 'ORTODONTIYA';
  return 'TERAPIYA( ENDO +PLOMBA)';
};

/**
 * AppointmentModal Component
 * 
 * Modal for creating and editing appointments in the dental clinic system.
 * Handles patient selection, service assignment, scheduling, and automatic
 * debt tracking when appointments are completed.
 * 
 * @param {Object} props
 * @param {boolean} props.open - Whether the modal is visible
 * @param {Function} props.onClose - Callback when modal is closed
 * @param {Object} props.appointment - Existing appointment data (null for new)
 * @param {Array} props.patients - List of available patients
 * @param {Array} props.services - List of available services
 * @param {Array} props.allAppointments - All appointments for conflict checking
 * @param {string} props.prefillDate - Pre-filled date
 * @param {string} props.prefillTime - Pre-filled time
 * @param {Function} props.onSaved - Callback after successful save
 */
/** UI darajasidagi ogohlantirish: shifokor ish jadvalida bu kun "dam" bo'lsa true. */
function isDoctorOffOn(doc, dateStr) {
  if (!doc || !dateStr) return false;
  const weekday = weekdayOfDateStr(normalizeToDateOnly(String(dateStr)));
  if (weekday === null) return false;
  return isScheduledOn(doc.workingHours, weekday) === false;
}

export default function AppointmentModal({ 
  open, 
  onClose, 
  appointment, 
  patients = [], 
  services = [], 
  allAppointments = [], 
  prefillDate, 
  prefillTime,
  prefillDoctorId,
  prefillPatientId,
  prefillPatientName,
  prefillServiceId,
  prefillServiceName,
  prefillPrice,
  prefillNotes,
  prefillToothNumber,
  onSaved 
}) {
  const { t, language } = useTranslation();
  const { user, isDoctor } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [form, setForm] = useState({
    patient_id: '', 
    patient_name: '', 
    doctor_id: '',
    doctor_name: '',
    date: '', 
    time: '', 
    duration: 30,
    service_id: '', 
    service_name: '', 
    price: 0, 
    status: 'Scheduled', 
    notes: '',
    tooth_number: ''
  });
  const [saving, setSaving] = useState(false);
  const [showNewPatient, setShowNewPatient] = useState(false);
  const [error, setError] = useState('');
  const [busyInfo, setBusyInfo] = useState(null);
  const [localAppointments, setLocalAppointments] = useState([]);
  const [showValidation, setShowValidation] = useState(false);
  const [showToothPicker, setShowToothPicker] = useState(false);

  // Fetch all appointments for conflict checking when the modal opens
  useEffect(() => {
    if (open) {
      base44.entities.Appointment.list('-date', 1000)
        .then(appts => {
          setLocalAppointments(appts || []);
        })
        .catch(err => console.error("Failed to load appointments for conflict checking:", err));
    } else {
      setLocalAppointments([]);
    }
  }, [open]);

  const appointmentsToUse = localAppointments.length > 0 ? localAppointments : (allAppointments || []);

  // Initialize form when modal opens or appointment changes
  useEffect(() => {
    async function fetchDoctors() {
      try {
        const allUsers = await base44.entities.User.list('name', 50);
        const docs = allUsers.filter(u => u.role === 'doctor' || u.role === 'admin');
        setDoctors(docs);
      } catch (e) {
        console.error("Failed to fetch doctors:", e);
      }
    }
    if (open) fetchDoctors();
  }, [open]);

  // Initialise the form ONLY on the closed -> open transition or when a different appointment is
  // opened. Re-running on prefill/doctors/parent re-renders used to wipe the user's date/time/patient.
  const initKeyRef = useRef(null);
  const appointmentId = appointment?.id ?? null;
  useEffect(() => {
    if (!open) {
      initKeyRef.current = null;
      return;
    }
    const key = `edit:${appointmentId ?? 'new'}`;
    if (initKeyRef.current === key) return;
    initKeyRef.current = key;

    if (appointment) {
      setForm({
        patient_id: appointment.patient_id || '',
        patient_name: appointment.patient_name || '',
        doctor_id: appointment.doctor_id || '',
        doctor_name: appointment.doctor_name || '',
        date: appointment.date || '',
        time: appointment.time || '',
        duration: appointment.duration || 30,
        service_id: appointment.service_id || '',
        service_name: appointment.service_name || '',
        price: appointment.price || 0,
        status: appointment.status || 'Scheduled',
        notes: appointment.notes || '',
        tooth_number: appointment.tooth_number || '',
      });
    } else {
      const targetDocId = isDoctor && user?.id ? user.id : (prefillDoctorId || '');
      const foundDoc = doctors.find(d => String(d.id) === String(targetDocId));
      const targetDocName = isDoctor && user?.name ? user.name : (foundDoc?.name || '');

      // Auto-fill today (Asia/Tashkent) + next reasonable future slot (never a past/unusable time)
      const now = new Date();
      const chosenDate = prefillDate || tashkentToday(now);
      let chosenTime = prefillTime || '';
      if (!chosenTime || (normalizeToDateOnly(chosenDate) === tashkentToday(now) && isSlotPastForDate(chosenTime, chosenDate, now))) {
        chosenTime = getNextReasonableSlot(chosenDate, now) || '';
      }

      setForm({
        patient_id: prefillPatientId || '',
        patient_name: prefillPatientName || '',
        doctor_id: targetDocId,
        doctor_name: targetDocName,
        date: chosenDate,
        time: chosenTime,
        duration: 30,
        service_id: prefillServiceId || '',
        service_name: prefillServiceName || '',
        price: prefillPrice || 0,
        status: 'Scheduled',
        notes: prefillNotes || '',
        tooth_number: prefillToothNumber || '',
      });
    }
    setError('');
    setBusyInfo(null);
    setShowValidation(false);
    setShowToothPicker(false);
  }, [open, appointmentId]);

  // Late-arriving data (async doctors list / auth user / prefilled patient) fills ONLY empty
  // doctor_id / doctor_name / patient_name - it never touches date, time, service, price or notes.
  const isNewAppointment = !appointment;
  useEffect(() => {
    if (!open || !isNewAppointment) return;
    setForm(prev => {
      let docId = prev.doctor_id;
      let docName = prev.doctor_name;
      if (!docId) docId = isDoctor && user?.id ? user.id : (prefillDoctorId || '');
      if (docId && !docName) {
        docName = isDoctor && user?.name
          ? user.name
          : (doctors.find(d => String(d.id) === String(docId))?.name || '');
      }
      let patName = prev.patient_name;
      if (prev.patient_id && !patName && prefillPatientName && String(prev.patient_id) === String(prefillPatientId)) {
        patName = prefillPatientName;
      }
      if (docId === prev.doctor_id && docName === prev.doctor_name && patName === prev.patient_name) return prev;
      return { ...prev, doctor_id: docId, doctor_name: docName, patient_name: patName };
    });
  }, [open, isNewAppointment, doctors, isDoctor, user?.id, user?.name, prefillDoctorId, prefillPatientId, prefillPatientName]);

  // Real-time conflict check state (populated after checkDoubleBooking is defined)
  const [conflict, setConflict] = useState(null);

  /**
   * Handle patient selection change
   */
  const handlePatientChange = useCallback((patientId) => {
    const selectedPatient = patients.find(pt => pt.id === patientId);
    setForm(prev => ({ 
      ...prev, 
      patient_id: patientId, 
      patient_name: selectedPatient?.full_name || '' 
    }));
  }, [patients]);

  /**
   * Handle service selection change
   * Auto-populates price and duration from service
   */
  const handleServiceChange = useCallback((serviceId) => {
    const selectedService = services.find(sv => sv.id === serviceId);
    setForm(prev => ({
      ...prev,
      service_id: serviceId,
      service_name: selectedService?.name || '',
      price: selectedService?.price || 0,
      duration: selectedService?.duration || prev.duration
    }));
  }, [services]);

  /**
   * Check for scheduling conflicts
   * @returns {Object|undefined} Conflicting appointment if found
   */
  const checkDoubleBooking = useCallback(() => {
    if (!form.date || !form.time) return undefined;
    
    // Normalize new appointment date/time
    const dateOnly = normalizeToDateOnly(form.date);
    if (!dateOnly || !form.time) return undefined;
    
    const newStartTotal = getEffectiveMinutes(form.time);
    const newEndTotal = newStartTotal + (parseInt(form.duration) || 30);
    
    return appointmentsToUse.find(a => {
      if (a.id === appointment?.id) return false;
      if (a.status === 'Cancelled') return false;
      
      const aDateOnly = normalizeToDateOnly(a.date);
      if (aDateOnly !== dateOnly) return false;
      
      // If the existing appointment has a doctor assigned, it must match current doctor.
      // If the existing appointment has NO doctor assigned, we assume it's not a conflict for this specific doctor.
      if (form.doctor_id && a.doctor_id) {
        if (String(form.doctor_id) !== String(a.doctor_id)) return false;
      } else if (form.doctor_id || a.doctor_id) {
        // One has a doctor, the other doesn't - no conflict for specific slot
        return false;
      }

      const existStartTotal = getEffectiveMinutes(a.time || '00:00');
      const existEndTotal = existStartTotal + (parseInt(a.duration) || 30);

      // Overlap check in effective minutes (more robust than Date objects for same-day checks)
      return newStartTotal < existEndTotal && newEndTotal > existStartTotal;
    });
  }, [appointmentsToUse, appointment?.id, form.date, form.time, form.duration, form.doctor_id]);

  // Real-time conflict detection — runs AFTER checkDoubleBooking is defined
  useEffect(() => {
    if (open && form.date && form.time) {
      setConflict(checkDoubleBooking() || null);
    } else {
      setConflict(null);
    }
  }, [open, form.date, form.time, form.duration, form.doctor_id, appointmentsToUse, checkDoubleBooking]);

  /**
   * Calculate and update patient financial records
   */
  const updatePatientFinancials = async (patientId, appointmentDate) => {
    try {
      // total_debt = barcha Debt to'lovlar - barcha Income to'lovlar (to'g'ri hisob)
      const allPatientPayments = await base44.entities.Payment.filter({ patient_id: patientId }, 'date', 5000);
      let computedDebt = 0;
      let computedPaid = 0;
      (allPatientPayments || []).forEach(p => {
        const type = (p.type || 'Income').toLowerCase();
        const amt = Number(p.amount) || 0;
        if (type === 'debt') computedDebt += amt;
        else if (type === 'income') computedPaid += amt;
        else if (type === 'discount') computedDebt = Math.max(0, computedDebt - amt);
      });
      // Yangi appointment narxini ham qo'shamiz (hali DB ga yozilmagan)
      const addedDebt = Number(form.price) || 0;
      const finalDebt = Math.max(0, computedDebt + addedDebt - computedPaid);

      await base44.entities.Patient.update(patientId, {
        total_debt: finalDebt,
        last_visit: appointmentDate,
      });
    } catch (error) {
      console.error('Failed to update patient financials:', error);
    }
  };

  /**
   * Create debt record when appointment is completed
   */
  const createDebtRecord = async (appointmentId) => {
    if (form.price <= 0) return;
    
    const debtCategory = form.service_name || t('appointments.service');
    
    await base44.entities.Payment.create({
      patient_id: form.patient_id,
      patient_name: form.patient_name,
      type: 'Debt',
      category: debtCategory,
      amount: form.price,
      method: '—',
      date: form.date,
      appointment_id: appointmentId,
      notes: t('common.automatic') + `: ${debtCategory}`,
    });
  };

  /**
   * Handle form submission
   */
  const handleSave = async () => {
    // Reset error
    setError('');

    // Individual Validation checks
    if (!form.patient_id) {
      setShowValidation(true);
      const errMsg = "Iltimos, bemorni tanlang";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!form.doctor_id) {
      setShowValidation(true);
      const errMsg = "Iltimos, shifokorni tanlang";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!form.date) {
      setShowValidation(true);
      const errMsg = "Iltimos, uchrashuv sanasini kiriting";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    if (!form.time) {
      setShowValidation(true);
      const errMsg = "Iltimos, uchrashuv vaqtini kiriting";
      setError(errMsg);
      toast.error(errMsg);
      return;
    }

    const conflict = checkDoubleBooking();
    if (conflict) {
      setError(t('appointments.errors.conflict', { name: conflict.patient_name }));
      toast.error(t('appointments.errors.conflict', { name: conflict.patient_name }));
      return;
    }

    setSaving(true);
    
    try {
      if (appointment) {
        // Update existing appointment
        await base44.entities.Appointment.update(appointment.id, form);
        
        // Handle status change to Completed
        if (form.status === 'Completed' && appointment.status !== 'Completed') {
          await createDebtRecord(appointment.id);
          await updatePatientFinancials(form.patient_id, form.date);
        }
      } else {
        // Create new appointment
        const res = await createAppointmentSafely(form);

        // Eslatma xabarlarini rejalashtirish: hech qachon saqlashni to'smasligi kerak.
        await scheduleAppointmentNotifications(res, form);

        // Handle case where new appointment is created as Completed
        if (form.status === 'Completed') {
          await createDebtRecord(res.id);
          await updatePatientFinancials(form.patient_id, form.date);
        }
      }
      
      onSaved();
      onClose();
    } catch (error) {
      const detail = String(error?.message || '').replace(/^Supabase DB Error \(\w+\):\s*/, '').slice(0, 140);
      setError(detail ? `${t('common.errorSave')} (${detail})` : t('common.errorSave'));
      console.error('Save error:', error);
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle appointment deletion
   */
  const handleDelete = async () => {
    if (!appointment) return;
    
    try {
      await base44.entities.Appointment.delete(appointment.id);
      onSaved();
      onClose();
    } catch (error) {
      setError(t('common.errorDelete'));
      console.error('Delete error:', error);
    }
  };

  /**
   * Handle new patient creation callback
   */
  const handleNewPatientSaved = (newPat) => {
    if (newPat && newPat.id) {
      setForm(prev => ({ 
        ...prev, 
        patient_id: newPat.id, 
        patient_name: newPat.full_name 
      }));
    }
    onSaved(); // Refresh lists in parent
  };

  /**
   * Is `timeStr` on `dateStr` already taken for this doctor? (same rules as checkDoubleBooking)
   */
  const findConflictAt = (timeStr, dateStr, doctorId, duration) => {
    const dateOnly = normalizeToDateOnly(dateStr);
    if (!dateOnly || !timeStr) return undefined;
    const start = getEffectiveMinutes(timeStr);
    const end = start + (parseInt(duration) || 30);
    return appointmentsToUse.find(a => {
      if (a.id === appointment?.id) return false;
      if (a.status === 'Cancelled') return false;
      if (normalizeToDateOnly(a.date) !== dateOnly) return false;
      if (doctorId && a.doctor_id) {
        if (String(doctorId) !== String(a.doctor_id)) return false;
      } else if (doctorId || a.doctor_id) {
        return false;
      }
      const aStart = getEffectiveMinutes(a.time || '00:00');
      const aEnd = aStart + (parseInt(a.duration) || 30);
      return start < aEnd && end > aStart;
    });
  };

  /**
   * Change the date (typed or via Bugun/Ertaga/Indinga chips). The chosen slot is kept only if it
   * is still free and not in the past on the new date, otherwise it is cleared with a hint.
   */
  const applyDate = (nextDate) => {
    if (nextDate === form.date) return;
    const prevTime = form.time;
    let nextTime = prevTime;
    let hint = null;
    if (nextDate && prevTime) {
      const isPast = isSlotPastForDate(prevTime, nextDate);
      const isBusy = !isPast && !!findConflictAt(prevTime, nextDate, form.doctor_id, form.duration);
      if (isPast || isBusy) {
        nextTime = '';
        hint = { time: prevTime, isPast: true, message: "Tanlangan vaqt band/o'tgan — boshqa vaqtni tanlang" };
      }
    }
    setForm(prev => ({ ...prev, date: nextDate, time: nextTime }));
    setBusyInfo(hint);
  };

  const todayStr = tashkentToday();
  const quickDateChips = [
    { label: 'Bugun', value: todayStr },
    { label: 'Ertaga', value: addDaysStr(todayStr, 1) },
    { label: 'Indinga', value: addDaysStr(todayStr, 2) },
  ];

  const renderToothButton = (num) => {
    const numStr = String(num);
    const selectedTeeth = form.tooth_number 
      ? form.tooth_number.split(',').map(s => s.trim()).filter(Boolean) 
      : [];
    const isSelected = selectedTeeth.includes(numStr);

    const toggleTooth = () => {
      let newSelected;
      if (isSelected) {
        newSelected = selectedTeeth.filter(t => t !== numStr);
      } else {
        newSelected = [...selectedTeeth, numStr];
      }
      // Sort teeth numerically for consistency
      newSelected.sort((a, b) => Number(a) - Number(b));
      setForm(prev => ({ ...prev, tooth_number: newSelected.join(', ') }));
    };

    return (
      <button
        key={num}
        type="button"
        onClick={toggleTooth}
        className={`h-8 rounded-lg text-[10px] font-black transition-all border flex items-center justify-center ${
          isSelected
            ? 'bg-[#1499AD] border-[#1499AD] text-white shadow-sm ring-1 ring-[#1499AD]/20'
            : 'bg-white border-slate-100 text-slate-600 hover:border-[#1499AD] hover:text-[#1499AD] active:scale-95'
        }`}
      >
        {num}
      </button>
    );
  };

  return (
    <>
      <Dialog open={open && !showNewPatient} onOpenChange={onClose}>
        <DialogContent className="dialog-shell-fluid w-[95vw] sm:max-w-lg max-h-[min(90vh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-4.5rem))] p-0 rounded-[2.5rem] border-0 shadow-2xl bg-white/95 backdrop-blur-xl flex flex-col overflow-visible">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 px-6 py-4 flex items-center justify-between shrink-0 rounded-t-[2.5rem]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white backdrop-blur-sm shadow-sm">
                <Calendar className="w-5 h-5 stroke-[2.5]" />
              </div>
              <div>
                <DialogTitle className="text-base font-black text-white uppercase tracking-tight">
                  {appointment ? t('appointments.editAppointment') : t('appointments.addNew')}
                </DialogTitle>
                <p className="text-[9px] font-bold text-white/80 uppercase tracking-widest mt-0.5">{t('appointments.infoTitle') || "Uchrashuv ma'lumotlari"}</p>
              </div>
            </div>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-sm transition-all active:scale-95"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
          
          {/* Patient Selection — outside scroll area so dropdown can freely overflow */}
          <div className="px-5 pt-4 relative z-50 shrink-0">
            {(error || conflict) && (
              <div className="text-xs font-bold p-3 rounded-xl bg-rose-50 border border-rose-100/50 flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2 duration-300 mb-4">
                <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <X className="w-4 h-4 text-rose-600" />
                </div>
                <p>
                  {error || t('appointments.errors.conflict', { name: conflict?.patient_name })}
                </p>
              </div>
            )}
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                {t('appointments.patient')} <span className="text-red-500 font-black ml-0.5">*</span>
              </Label>
              <PatientSelect 
                patients={patients}
                value={form.patient_id}
                initialName={form.patient_name}
                onChange={(id, p) => {
                  // Do NOT overwrite doctor if user already selected a doctor or clicked on a doctor's slot
                  const currentDocId = form.doctor_id || prefillDoctorId;
                  const assignedDocId = isDoctor && user?.id 
                    ? user.id 
                    : (currentDocId || p?.main_treatment_provider || '');
                  const foundDoc = doctors.find(doc => String(doc.id) === String(assignedDocId));
                  setForm(prev => ({ 
                    ...prev, 
                    patient_id: id, 
                    patient_name: p?.full_name || p?.name || '',
                    doctor_id: assignedDocId || prev.doctor_id,
                    doctor_name: isDoctor && user?.name ? user.name : (foundDoc?.name || prev.doctor_name)
                  }));
                }}
                onAddPatient={() => setShowNewPatient(true)}
                error={showValidation && !form.patient_id}
              />
            </div>
          </div>

          {/* Scrollable form body */}
          <div className="px-5 pb-5 space-y-4 flex-1 overflow-y-auto no-scrollbar">

            {/* Doctor + compact Sana / Vaqt row */}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                  {t('appointments.doctor')} <span className="text-red-500 font-black ml-0.5">*</span>
                </Label>
                <Select 
                  disabled={isDoctor}
                  value={String(isDoctor && user?.id ? user.id : (form.doctor_id || ''))} 
                  onValueChange={id => {
                    const d = doctors.find(doc => String(doc.id) === String(id));
                    setForm(prev => ({ ...prev, doctor_id: id, doctor_name: d?.name || '' }));
                    setBusyInfo(null);
                  }}
                >
                  <SelectTrigger className={`h-10 rounded-xl border-slate-100 bg-slate-50 font-bold text-xs transition-all ${
                    showValidation && !form.doctor_id ? 'border-red-500 ring-2 ring-red-100' : ''
                  }`}>
                    <SelectValue placeholder={t('appointments.doctor')} />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100">
                    {doctors.map(d => (
                      <SelectItem key={String(d.id)} value={String(d.id)} className="rounded-lg font-bold">{d.name}{isDoctorOffOn(d, form.date) ? ' · dam' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap items-end gap-x-2 gap-y-2">
                <div className="space-y-1">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    {t('appointments.date')} *
                  </Label>
                  <ClinicDateField
                    value={form.date}
                    onChange={e => applyDate(e.target.value)}
                    className="h-9 w-[7.25rem] rounded-xl border-slate-100 bg-slate-50 px-2.5 font-bold text-xs"
                  />
                </div>
                <div className="flex items-center gap-1">
                  {quickDateChips.map(chip => {
                    const active = normalizeToDateOnly(form.date) === chip.value;
                    return (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={() => applyDate(chip.value)}
                        className={`h-9 px-2.5 rounded-xl border text-[10px] font-black uppercase tracking-wide transition-all active:scale-95 ${
                          active
                            ? 'bg-[#1499AD] border-[#1499AD] text-white shadow-sm'
                            : 'bg-white border-slate-100 text-slate-500 hover:border-[#1499AD] hover:text-[#1499AD]'
                        }`}
                      >
                        {chip.label}
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-1 ml-auto">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">
                    {t('appointments.time')} *
                  </Label>
                  <Input
                    type="time"
                    value={form.time}
                    onChange={e => {
                      const nextTime = e.target.value;
                      if (form.date && nextTime && isSlotPastForDate(nextTime, form.date)) {
                        const msg = language === 'ru' ? 'Время уже прошло' : language === 'en' ? 'Time has passed' : "Ushbu vaqt o'tib ketgan";
                        toast.warning(msg);
                        const bumped = getNextReasonableSlot(form.date) || '';
                        setForm(prev => ({ ...prev, time: bumped }));
                        setBusyInfo({ time: nextTime, isPast: true, message: msg });
                        return;
                      }
                      setForm(prev => ({ ...prev, time: nextTime }));
                      setBusyInfo(null);
                    }}
                    className="h-9 w-[6.25rem] rounded-xl border-slate-100 bg-slate-50 px-2.5 font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {(() => {
              const selDoc = doctors.find((d) => String(d.id) === String(form.doctor_id));
              if (!selDoc || !isDoctorOffOn(selDoc, form.date)) return null;
              return (
                <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
                  ⚠️ {selDoc.name} bu kuni dam oladi (dam). Baribir yozish mumkin, lekin shifokor bilan kelishib oling.
                </div>
              );
            })()}

            {/* Time Grid - only full hours */}
            {form.date && (
              <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100 shadow-inner">
                <div className="flex items-center justify-between mb-2 px-1">
                  <Label className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    {t('appointments.timeGrid') || 'Vaqt grafigi'}
                  </Label>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-[#1499AD]" /><span className="text-[10px] font-bold text-slate-400 uppercase">{t('appointments.legendSelected') || 'Tanlangan'}</span></div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-rose-300" /><span className="text-[10px] font-bold text-slate-400 uppercase">{t('appointments.legendBusy') || 'Band'}</span></div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-slate-300" /><span className="text-[10px] font-bold text-slate-400 uppercase">{t('appointments.legendAvailable') || "Bo'sh"}</span></div>
                  </div>
                </div>

                {busyInfo && (
                  <div className={`mb-2 px-2.5 py-1.5 ${busyInfo.isPast ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-rose-50 border-rose-100 text-rose-600'} rounded-xl text-[9px] font-black uppercase tracking-wide flex items-center gap-1.5`}>
                    <span>{busyInfo.isPast ? '⏳' : '⚠️'} {busyInfo.message || (t('appointments.timeBusy', { time: busyInfo.time, patient: busyInfo.patient_name }) || `${busyInfo.time} da band: ${busyInfo.patient_name}`)}</span>
                  </div>
                )}

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                  {APPOINTMENT_TIME_SLOTS.filter((slotTime) => {
                    // New bookings: hide past slots for today. Editing: keep current time visible.
                    if (appointment?.id && form.time === slotTime) return true;
                    return !isSlotPastForDate(slotTime, form.date);
                  }).map(slotTime => {
                    const slotStart = getEffectiveMinutes(slotTime);
                    const isSelected = form.time === slotTime;

                    const busyAppt = appointmentsToUse?.find(a => {
                      if (a.id === appointment?.id) return false;
                      if (a.status === 'Cancelled') return false;
                      const aDateOnly = normalizeToDateOnly(a.date);
                      const fDateOnly = normalizeToDateOnly(form.date);
                      if (aDateOnly !== fDateOnly) return false;
                      if (form.doctor_id && a.doctor_id && String(form.doctor_id) !== String(a.doctor_id)) return false;
                      const aStart = getEffectiveMinutes(a.time || '00:00');
                      const aEnd = aStart + (parseInt(a.duration) || 30);
                      return slotStart < aEnd && (slotStart + 30) > aStart;
                    });

                      const busyPatName = busyAppt 
                        ? (busyAppt.patient_name || patients.find(p => String(p.id) === String(busyAppt.patient_id))?.full_name || 'Bemor') 
                        : '';

                      return (
                        <button
                          key={slotTime}
                          type="button"
                          title={busyAppt ? `${t('appointments.legendBusy') || 'Band'}: ${busyPatName} (${busyAppt.service_name || t('appointments.defaultService') || 'Maslahat'})` : undefined}
                          onClick={() => {
                            if (busyAppt) {
                              const busyPatName = busyAppt.patient_name || patients.find(p => String(p.id) === String(busyAppt.patient_id))?.full_name || 'Bemor';
                              
                              toast.warning(`${slotTime} - ${t('appointments.busy') || 'qabul band!'}`, {
                                description: `${t('appointments.patient') || 'Bemor'}: ${busyPatName} (${busyAppt.service_name || t('appointments.defaultService') || 'Maslahat'})`,
                                duration: 5000,
                              });

                              setBusyInfo({
                                time: slotTime,
                                isPast: false,
                                patient_name: busyPatName
                              });
                            } else {
                              setForm(prev => ({ ...prev, time: slotTime }));
                              setBusyInfo(null);
                            }
                          }}
                          className={`py-1.5 rounded-xl text-[10px] font-black transition-all border ${
                            busyAppt
                                ? 'bg-rose-50 border-rose-100 text-rose-500 hover:bg-rose-100/50 hover:border-rose-300 active:scale-95 cursor-pointer shadow-sm shadow-rose-100'
                                : isSelected
                                  ? 'bg-[#1499AD] border-[#1499AD] text-white shadow-md'
                                  : 'bg-white border-slate-100 text-slate-600 hover:border-[#1499AD] hover:text-[#1499AD] active:scale-95'
                          }`}
                        >
                          {slotTime}
                        </button>
                      );
                    })}
                </div>
                {APPOINTMENT_TIME_SLOTS.filter((slotTime) => (appointment?.id && form.time === slotTime) || !isSlotPastForDate(slotTime, form.date)).length === 0 && (
                  <p className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-2">
                    {language === 'ru' ? 'На сегодня свободных слотов не осталось — выберите другую дату' : language === 'en' ? 'No future slots left today — pick another date' : "Bugun uchun bo'sh slot qolmadi — boshqa sanani tanlang"}
                  </p>
                )}
              </div>
            )}

            {/* Service Selection and Price */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('appointments.service')}</Label>
                <Select value={form.service_id} onValueChange={handleServiceChange}>
                  <SelectTrigger className="h-10 rounded-xl border-slate-100 bg-slate-50 font-bold text-xs">
                    <SelectValue placeholder={t('appointments.service')} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[250px] rounded-xl border-slate-100">
                    {(() => {
                      const groups = {};
                      const seen = new Set();
                      services.forEach(s => {
                        if (!s.name) return;
                        const uniqueKey = `${s.name.toLowerCase().trim()}_${s.price}`;
                        if (seen.has(uniqueKey)) return;
                        seen.add(uniqueKey);

                        const cat = s.category || autoCategorize(s.name);
                        if (!groups[cat]) groups[cat] = [];
                        groups[cat].push(s);
                      });
                      return Object.entries(groups).map(([cat, items]) => (
                        <div key={cat}>
                          <div className="px-2 py-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">{cat}</div>
                          {items.map(s => (
                            <SelectItem key={s.id} value={s.id} className="rounded-lg font-bold">
                              {s.name} — {s.price?.toLocaleString()} {t('common.currency')}
                            </SelectItem>
                          ))}
                        </div>
                      ));
                    })()}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('appointments.price')}</Label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={form.price === '' || form.price === 0 ? '' : Number(form.price).toLocaleString('uz-UZ')}
                    onChange={e => {
                      const raw = e.target.value.replace(/\s/g, '').replace(/,/g, '').replace(/\./g, '').replace(/'/g, '');
                      if (raw === '') setForm(prev => ({ ...prev, price: 0 }));
                      else if (/^\d+$/.test(raw)) setForm(prev => ({ ...prev, price: Number(raw) }));
                    }}
                    onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
                    onWheel={e => e.target.blur()}
                    placeholder="0"
                    className="w-full h-10 rounded-xl border border-slate-100 bg-slate-50 px-3 text-xs font-bold outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Duration and Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('appointments.duration')} (min)</Label>
                <Select 
                  value={String(form.duration)} 
                  onValueChange={v => setForm(prev => ({ ...prev, duration: Number(v) }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-100 bg-slate-50 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100">
                    {durations.map(d => (
                      <SelectItem key={d} value={String(d)} className="rounded-lg font-bold">{d} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('appointments.status')}</Label>
                <Select 
                  value={form.status} 
                  onValueChange={v => setForm(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger className="h-10 rounded-xl border-slate-100 bg-slate-50 font-bold text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-slate-100">
                    {appointmentStatuses.map(s => (
                      <SelectItem key={s} value={s} className="rounded-lg font-bold">{t(`appointments.statusLabels.${s.replace(/\s+/g, '')}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tooth Selection */}
            <div className="space-y-1">
              <div className="flex items-center justify-between ml-1">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {t('appointments.toothNumber')}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowToothPicker(!showToothPicker)}
                  className="text-[9px] font-black text-[#1499AD] hover:text-[#1499AD]/80 transition-colors uppercase tracking-widest bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1 shadow-sm hover:shadow active:scale-95"
                >
                  {showToothPicker ? t('appointments.closePicker') : t('appointments.visualSelect')}
                </button>
              </div>
              <Input
                placeholder={t('appointments.toothNumberPlaceholder')}
                value={form.tooth_number || ''}
                onChange={e => setForm(prev => ({ ...prev, tooth_number: e.target.value }))}
                className="h-10 rounded-xl border-slate-100 bg-slate-50 font-bold text-xs px-4"
              />
            </div>

            {/* Collapsible Tooth Picker Grid */}
            {showToothPicker && (
              <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-3xl animate-in fade-in slide-in-from-top-2 duration-200 space-y-3">
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5 text-center">
                    Tepada o'ng / chap (18-28)
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                    {[18, 17, 16, 15, 14, 13, 12, 11].map(num => renderToothButton(num))}
                    {[21, 22, 23, 24, 25, 26, 27, 28].map(num => renderToothButton(num))}
                  </div>
                </div>
                <div className="h-px bg-slate-200/50 my-1" />
                <div>
                  <div className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400 mb-1.5 text-center">
                    Pastda o‘ng / chap (48-38)
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5">
                    {[48, 47, 46, 45, 44, 43, 42, 41].map(num => renderToothButton(num))}
                    {[31, 32, 33, 34, 35, 36, 37, 38].map(num => renderToothButton(num))}
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{t('appointments.notes')}</Label>
              <Input
                placeholder={t('appointments.notes') + "..."}
                value={form.notes}
                onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="h-10 rounded-xl border-slate-100 bg-slate-50 font-medium text-xs px-4"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0 rounded-b-[2.5rem]">
            <div>
              {appointment && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleDelete}
                  className="h-10 rounded-xl font-black uppercase text-[10px] tracking-wider px-4"
                >
                  {t('common.delete')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button 
                variant="ghost" 
                onClick={onClose}
                className="h-10 rounded-xl font-black uppercase text-[10px] tracking-wider text-slate-400 hover:bg-slate-100/50 px-4"
              >
                {t('common.cancel')}
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={saving || !!conflict} 
                className={`h-10 px-6 rounded-xl font-black uppercase text-xs tracking-wider border-none relative overflow-hidden shadow-md ${
                  conflict 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                    : 'bg-slate-950 hover:bg-slate-900 text-white'
                }`}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('common.loading')}
                  </>
                ) : conflict ? t('appointments.busy') : t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* New Patient Modal */}
      <PatientModal
        open={showNewPatient}
        onClose={() => setShowNewPatient(false)}
        patient={null}
        onSaved={handleNewPatientSaved}
      />
    </>
  );
}

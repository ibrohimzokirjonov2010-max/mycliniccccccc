/**
 * telegramReminderService.js
 * 
 * Telegram xabarlari SERVER orqali yuboriladi (/api/telegram/send, /api/telegram/poll).
 * Bot tokeni va service-role kaliti brauzerda YO'Q: faqat Vercel env (TELEGRAM_BOT_TOKEN, SUPABASE_SERVICE_ROLE_KEY).
 * Supabase'ga o'qish/yozish faqat public anon kalit bilan.
 * 
 * Xususiyatlar:
 *  - 2 soat oldin tasdiqlash xabari (inline tugmali)
 *  - Ertalab 07:00 da reminder
 *  - Test xabari yuborish
 */

import { assertClinicNotExpired } from '@/lib/clinicExpiry';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://zvyggjldzkxwufpnaatr.supabase.co';
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;


const TASHKENT_OFFSET = 5; // UTC+5

// Token yo'q yoki Telegram uni rad etganda (401/403/404) polling butunlay to'xtaydi.
// Holat localStorage'da token oxiriga bog'lab saqlanadi — sahifa yangilanganda ham qayta so'rov
// yuborilmaydi; token almashtirilsa (yangi deploy) flag avtomatik yangilanadi.
const POLL_DISABLED_KEY = 'telegram_poll_disabled_server_v1';
let _pollingDisabled = false;

function readPollingDisabledFlag() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(POLL_DISABLED_KEY) === '1';
  } catch {
    return false;
  }
}

function disableBotPolling(persist = true) {
  _pollingDisabled = true;
  if (!persist) return;
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(POLL_DISABLED_KEY, '1');
  } catch {
    /* ignore */
  }
}

/**
 * getUpdates polling hozir ishlashi mumkinmi? (token bor va Telegram rad etmagan)
 */
export function isBotPollingEnabled() {
  if (_pollingDisabled) return false;
  if (readPollingDisabledFlag()) {
    _pollingDisabled = true;
    return false;
  }
  return true;
}

/**
 * Bot'ga kelgan yangi xabarlarni tekshirish (getUpdates polling)
 * /start xabarini tutib, klinika ma'lumotlari bilan javob beradi
 */
export async function pollBotUpdates(clinicId) {
  // Token yo'q yoki server polling'ni o'chirgan bo'lsa — so'rov umuman yuborilmaydi
  if (!isBotPollingEnabled() || !clinicId) return;
  try {
    const res = await fetch('/api/telegram/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ clinic_id: clinicId }),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    const type = res.headers.get('content-type') || '';
    if (res.status === 404 || !type.includes('json')) { disableBotPolling(false); return; } // /api yo'q (dev)
    const data = await res.json();
    if (data?.disabled) disableBotPolling(data.reason === 'token_rejected');
    else if (res.status === 402 || res.status === 503) disableBotPolling(false);
  } catch (e) {
    console.warn('[ReminderService] pollBotUpdates error:', e);
  }
}



/**
 * Toshkent vaqtini hisoblash
 */
export function getTashkentNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs + TASHKENT_OFFSET * 3600000);
}

export function getTashkentHHMM() {
  const t = getTashkentNow();
  return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
}

export function getTashkentDate() {
  const t = getTashkentNow();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/**
 * Supabase'dan bemor ma'lumotlarini olish
 * telegram_chat_id ham tekshiriladi (notes ichida encoded bo'lishi mumkin)
 */
export function decodeTechDataFromNotes(notes) {
  if (!notes) return {};
  const match = String(notes).match(/\[TECH_DATA\]([\s\S]*?)\[END_TECH\]/);
  if (!match) return {};
  try {
    return JSON.parse(match[1]) || {};
  } catch {
    return {};
  }
}

export function getPatientTelegramChatId(patient) {
  if (!patient) return null;
  // Directly in field
  if (patient.telegram_chat_id) return String(patient.telegram_chat_id);
  // Encoded in notes
  const tech = decodeTechDataFromNotes(patient.notes);
  if (tech.telegram_chat_id) return String(tech.telegram_chat_id);
  return null;
}

/**
 * Supabase'dan bugungi va kelajakdagi qabullarni olish
 */
export async function fetchUpcomingAppointments() {
  try {
    await assertClinicNotExpired();
  } catch (error) {
    if (error?.code === 402) return [];
    throw error;
  }
  const today = getTashkentDate();
  const key = SUPABASE_KEY;
  if (!key) return [];

  try {
    const url = `${SUPABASE_URL}/rest/v1/appointments?select=*&date=gte.${today}&status=in.(Scheduled,scheduled,Confirmed,confirmed)&order=date.asc,time.asc&limit=500`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    console.error('[ReminderService] fetchUpcomingAppointments error:', e);
    return [];
  }
}

/**
 * Bemorni ID bo'yicha olish
 */
export async function fetchPatientById(patientId) {
  if (!patientId) return null;
  try {
    await assertClinicNotExpired();
  } catch (error) {
    if (error?.code === 402) return null;
    throw error;
  }
  const key = SUPABASE_KEY;
  if (!key) return null;

  try {
    const url = `${SUPABASE_URL}/rest/v1/patients?select=*&id=eq.${encodeURIComponent(patientId)}&limit=1`;
    const res = await fetch(url, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
  } catch (e) {
    console.error('[ReminderService] fetchPatientById error:', e);
    return null;
  }
}

/**
 * Appointment'ni yangilash (eslatma flag'larini qo'yish uchun)
 */
export async function updateAppointmentField(appointmentId, fields) {
  const key = SUPABASE_KEY;
  if (!key || !appointmentId) return false;

  try {
    const url = `${SUPABASE_URL}/rest/v1/appointments?id=eq.${encodeURIComponent(appointmentId)}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(fields),
    });
    return res.ok;
  } catch (e) {
    console.error('[ReminderService] updateAppointmentField error:', e);
    return false;
  }
}

/**
 * Telegram'ga xabar yuborish
 */
function currentClinicId() {
  try {
    return (typeof localStorage !== 'undefined' && (localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id'))) || '';
  } catch {
    return '';
  }
}

export async function sendTelegramMessage(chatId, text, replyMarkup = null, clinicId = null) {
  if (!chatId || !text) return null;
  const cid = String(clinicId || currentClinicId() || '').toLowerCase();
  if (!cid) return null;

  try {
    const body = { clinic_id: cid, chat_id: String(chatId), text };
    if (replyMarkup) body.reply_markup = replyMarkup;
    const res = await fetch('/api/telegram/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
    });
    let data = null;
    try { data = await res.json(); } catch { /* JSON emas */ }
    if (data?.ok) return data.message_id ?? true;
    console.warn('[ReminderService] Telegram send failed:', data?.error || res.status);
    return null;
  } catch (e) {
    console.error('[ReminderService] sendTelegramMessage error:', e);
    return null;
  }
}

/**
 * Sanani o'zbek tilida chiroyli formatlash (masalan: 29-iyun, dushanba)
 */
function formatDateUz(dateStr) {
  if (!dateStr) return '';
  try {
    const cleanDate = String(dateStr).split('T')[0];
    const [year, month, day] = cleanDate.split('-').map(Number);
    if (!year || !month || !day) return dateStr;

    const months = [
      'yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun',
      'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'
    ];

    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay(); // 0: Yakshanba, 1: Dushanba...

    const weekdays = [
      'yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'
    ];

    const monthName = months[month - 1] || '';
    const weekdayName = weekdays[dayOfWeek] || '';

    return `${day}-${monthName}, ${weekdayName}`;
  } catch (e) {
    console.error('formatDateUz error:', e);
    return dateStr;
  }
}

/**
 * 2 soat oldingi tasdiqlash xabari matni
 */
function build2HourReminderText(appointment, clinicName) {
  const date = appointment.date || '';
  const time = appointment.time || '';
  const doctor = appointment.doctor_name || 'Shifokor';
  const patient = appointment.patient_name || 'Bemor';

  const dateUz = formatDateUz(date);

  return (
    `⏰ <b>QABUL ESLATMASI — 2 SOAT QOLDI!</b>\n\n` +
    `Assalomu alaykum, <b>${patient}</b>!\n\n` +
    `📅 <b>Sana:</b> ${dateUz}\n` +
    `🕐 <b>Vaqt:</b> ${time}\n` +
    `👨‍⚕️ <b>Shifokor:</b> ${doctor}\n` +
    `🏥 <b>Klinika:</b> ${clinicName || "Dental Klinika"}\n\n` +
    `Qabulingizni tasdiqlaysizmi?`
  );
}

/**
 * Ertalab 07:00 eslatma xabari matni
 */
function buildMorningReminderText(appointment, clinicName) {
  const date = appointment.date || '';
  const time = appointment.time || '';
  const doctor = appointment.doctor_name || 'Shifokor';
  const patient = appointment.patient_name || 'Bemor';

  const dateUz = formatDateUz(date);

  return (
    `🌅 <b>ERTALABKI ESLATMA — BUGUN QABULINGIZ BOR!</b>\n\n` +
    `Assalomu alaykum, <b>${patient}</b>!\n\n` +
    `Bugun sizning qabulingiz bor:\n\n` +
    `📅 <b>Sana:</b> ${dateUz}\n` +
    `🕐 <b>Vaqt:</b> ${time}\n` +
    `👨‍⚕️ <b>Shifokor:</b> ${doctor}\n` +
    `🏥 <b>Klinika:</b> ${clinicName || "Dental Klinika"}\n\n` +
    `⚠️ Iltimos, o'z vaqtida keling.\n` +
    `Savollar bo'lsa klinikaga qo'ng'iroq qiling. 📞`
  );
}

/**
 * Test xabari matni
 */
function buildTestReminderText(appointment, clinicName, now) {
  const time = appointment?.time || '--:--';
  const date = appointment?.date || '';
  const doctor = appointment?.doctor_name || 'Shifokor';
  const patient = appointment?.patient_name || 'Bemor';

  const dateUz = formatDateUz(date);

  if (!date) {
    return (
      `🧪 <b>TEST ESLATMA</b>\n\n` +
      `Assalomu alaykum, <b>${patient}</b>!\n\n` +
      `Bu Telegram eslatma tizimining test xabari.\n` +
      `✅ Agar siz bu xabarni ko'rsangiz — bot eslatma tizimi ishlayapti!\n\n` +
      `⏰ Toshkent vaqti: <b>${now}</b>`
    );
  }

  return (
    `🧪 <b>[TEST] QABUL ESLATMASI</b>\n\n` +
    `Assalomu alaykum, <b>${patient}</b>!\n\n` +
    `📅 <b>Sana:</b> ${dateUz}\n` +
    `🕐 <b>Vaqt:</b> ${time}\n` +
    `👨‍⚕️ <b>Shifokor:</b> ${doctor}\n` +
    `🏥 <b>Klinika:</b> ${clinicName || "Dental Klinika"}\n\n` +
    `Bu test xabari — haqiqiy eslatma qabul vaqtida avtomatik boradi. 🦷`
  );
}

/**
 * 2 SOAT OLDINGI REMINDER CHECK
 * Har daqiqada chaqiriladi.
 */
export async function check2HourReminders(clinicId) {
  const now = getTashkentNow();
  const todayDate = getTashkentDate();
  const target2H = new Date(now.getTime() + 2 * 3600 * 1000);
  const target2HStr = `${String(target2H.getHours()).padStart(2, '0')}:${String(target2H.getMinutes()).padStart(2, '0')}`;

  const key = SUPABASE_KEY;
  if (!key) return;

  try {
    // 2 soatdan keyin bo'ladigan qabullarni topish
    let url = `${SUPABASE_URL}/rest/v1/appointments?select=*&date=eq.${todayDate}&time=eq.${encodeURIComponent(target2HStr)}&status=in.(Scheduled,scheduled,Confirmed,confirmed)&limit=50`;
    if (clinicId) url += `&clinic_id=eq.${encodeURIComponent(clinicId)}`;

    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return;
    const appointments = await res.json();
    if (!Array.isArray(appointments)) return;

    for (const app of appointments) {
      // pre_reminder_sent tekshirish
      if (app.pre_reminder_sent === true || app.pre_reminder_sent === 'true') continue;

      const patient = await fetchPatientById(app.patient_id);
      const chatId = getPatientTelegramChatId(patient);
      if (!chatId) {
        // Telegram ulanmagan — flagni qo'yamiz
        await updateAppointmentField(app.id, { pre_reminder_sent: true });
        continue;
      }

      // Klinika nomini olish
      const clinicName = patient?.clinic_name || app.clinic_name || 'Dental Klinika';

      // Xabar yuborish
      const text = build2HourReminderText(app, clinicName);
      const replyMarkup = {
        inline_keyboard: [
          [{ text: '✅ Ha, albatta boraman', callback_data: `appt:confirm:${app.id}` }],
          [{ text: '❌ Yo\'q, bugun bora olmayman', callback_data: `appt:decline:${app.id}` }],
        ],
      };

      const msgId = await sendTelegramMessage(chatId, text, replyMarkup, app.clinic_id || clinicId);
      if (msgId) {
        await updateAppointmentField(app.id, {
          pre_reminder_sent: true,
          confirmation_status: 'pending',
          confirmation_sent_at: new Date().toISOString(),
        });
        console.log(`[ReminderService] ✅ 2H reminder sent to ${patient?.full_name} (${chatId}) for ${app.date} ${app.time}`);
      }
    }
  } catch (e) {
    console.error('[ReminderService] check2HourReminders error:', e);
  }
}

/**
 * ERTALAB 07:00 MORNING REMINDER CHECK
 * Har daqiqada chaqiriladi — faqat 07:00 da ishlaydi.
 */
export async function checkMorningReminders(clinicId) {
  const now = getTashkentNow();
  const h = now.getHours();
  const m = now.getMinutes();

  // Faqat 07:00 da ishlaydi (07:00 - 07:01)
  if (h !== 7 || m > 1) return;

  const todayDate = getTashkentDate();
  const key = SUPABASE_KEY;
  if (!key) return;

  try {
    let url = `${SUPABASE_URL}/rest/v1/appointments?select=*&date=eq.${todayDate}&status=in.(Scheduled,scheduled,Confirmed,confirmed)&morning_reminder_sent=neq.true&limit=200`;
    if (clinicId) url += `&clinic_id=eq.${encodeURIComponent(clinicId)}`;

    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return;
    const appointments = await res.json();
    if (!Array.isArray(appointments)) return;

    for (const app of appointments) {
      if (app.morning_reminder_sent === true || app.morning_reminder_sent === 'true') continue;

      const patient = await fetchPatientById(app.patient_id);
      const chatId = getPatientTelegramChatId(patient);
      if (!chatId) {
        await updateAppointmentField(app.id, { morning_reminder_sent: true });
        continue;
      }

      const clinicName = patient?.clinic_name || app.clinic_name || 'Dental Klinika';
      const text = buildMorningReminderText(app, clinicName);
      const sent = await sendTelegramMessage(chatId, text, null, app.clinic_id || clinicId);

      if (sent) {
        await updateAppointmentField(app.id, { morning_reminder_sent: true });
        console.log(`[ReminderService] 🌅 Morning reminder sent to ${patient?.full_name} (${chatId})`);
      }
    }
  } catch (e) {
    console.error('[ReminderService] checkMorningReminders error:', e);
  }
}

/**
 * PATIENT UCHUN TEST ESLATMA YUBORISH
 * PatientProfile'dagi "Test qilish" tugmasidan chaqiriladi.
 */
export async function sendTestReminderForPatient(patientId) {
  if (!patientId) return { success: false, message: 'patientId kerak.' };

  const patient = await fetchPatientById(patientId);
  if (!patient) return { success: false, message: 'Bemor topilmadi.' };

  const chatId = getPatientTelegramChatId(patient);
  if (!chatId) {
    return {
      success: false,
      message: `"${patient.full_name}" bemori Telegram botiga ulanmagan. Bemorga bot havolasini yuboring.`,
    };
  }

  const todayDate = getTashkentDate();
  const key = SUPABASE_KEY;

  // Kelajakdagi qabulini topish
  let app = null;
  try {
    const url = `${SUPABASE_URL}/rest/v1/appointments?select=*&patient_id=eq.${encodeURIComponent(patientId)}&date=gte.${todayDate}&status=in.(Scheduled,scheduled,Confirmed,confirmed)&order=date.asc,time.asc&limit=5`;
    const res = await fetch(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows) && rows.length > 0) {
        app = rows[0];
      }
    }
  } catch (e) {
    console.error('[ReminderService] fetchUpcoming error:', e);
  }

  // Agar qabul topilmasa, test uchun mock qabul yaratamiz
  const isMock = !app;
  if (isMock) {
    app = {
      id: 'test-mock-appt-id',
      date: todayDate,
      time: '14:30',
      doctor_name: 'Dr. Shahobiddin',
      patient_name: patient.full_name,
    };
  }

  const clinicName = patient?.clinic_name || 'Dental Klinika';
  
  // Real 2-soatlik eslatma matni formatini ishlatamiz
  const text = (
    `🧪 <b>[TEST REJIM]</b>\n\n` +
    build2HourReminderText(app, clinicName)
  );
  
  // Doim tasdiqlash tugmalari bilan yuboramiz
  const replyMarkup = {
    inline_keyboard: [
      [{ text: '✅ Ha, albatta boraman', callback_data: `appt:confirm:${app.id}` }],
      [{ text: '❌ Yo\'q, bugun bora olmayman', callback_data: `appt:decline:${app.id}` }],
    ],
  };

  const msgId = await sendTelegramMessage(chatId, text, replyMarkup, patient.clinic_id);
  if (msgId) {
    return {
      success: true,
      message: isMock
        ? `✅ Tugmali test eslatma yuborildi (Haqiqiy qabul bo'lmagani uchun test uchrashuv shakllantirildi).`
        : `✅ Tasdiqlash tugmali eslatma yuborildi (${app.date} ${app.time} qabuli uchun).`,
      chat_id: chatId,
      patient_name: patient.full_name,
    };
  }

  return {
    success: false,
    message: `Xabar yuborishda xatolik. Chat ID: ${chatId}`,
  };
}

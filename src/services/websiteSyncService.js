import { safeLocalStorage as localStorage } from '@/utils/safeStorage';

/**
 * Dental Clinic Website Sync Service
 * Handles 2-way synchronization with the dental website slots API.
 */

export function getWebsiteConfig() {
  const defaultUrl = import.meta.env.VITE_WEBSITE_URL || 'http://localhost:3000';
  const savedUrl = localStorage.getItem('crm_website_url');
  const websiteUrl = (savedUrl && savedUrl.trim()) ? savedUrl.trim().replace(/\/+$/, '') : defaultUrl;
  const apiKey = localStorage.getItem('crm_website_api_key') || '';
  const autoSyncEnabled = localStorage.getItem('crm_website_auto_sync') !== 'false';

  return {
    websiteUrl,
    apiKey,
    autoSyncEnabled,
  };
}

export function saveWebsiteConfig({ websiteUrl, apiKey, autoSyncEnabled }) {
  if (websiteUrl !== undefined) {
    localStorage.setItem('crm_website_url', websiteUrl.trim().replace(/\/+$/, ''));
  }
  if (apiKey !== undefined) {
    localStorage.setItem('crm_website_api_key', apiKey.trim());
  }
  if (autoSyncEnabled !== undefined) {
    localStorage.setItem('crm_website_auto_sync', autoSyncEnabled ? 'true' : 'false');
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('crm-website-config-updated'));
  }
}

function getRequestHeaders(apiKey) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
    headers['x-crm-api-key'] = apiKey;
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * Normalize date and time strings
 * e.g., "2026-09-15T00:00:00.000Z" -> "2026-09-15"
 * e.g., "17:00:00" -> "17:00"
 */
function normalizeDateTime(dateStr, timeStr) {
  let cleanDate = dateStr;
  if (typeof dateStr === 'string' && dateStr.includes('T')) {
    cleanDate = dateStr.split('T')[0];
  }
  let cleanTime = timeStr || '10:00';
  if (typeof timeStr === 'string' && timeStr.length > 5) {
    cleanTime = timeStr.substring(0, 5);
  }
  return { date: cleanDate, time: cleanTime };
}

/**
 * 2. CRM DAN SAYTGA: Vaqtni "Band" qilish (POST /api/crm/slots)
 */
export async function blockWebsiteSlot(appointmentData) {
  const config = getWebsiteConfig();
  if (!config.autoSyncEnabled && !appointmentData._force) {
    return { success: false, skipped: true, reason: 'Auto-sync is disabled' };
  }

  const { date, time } = normalizeDateTime(appointmentData.date, appointmentData.time);
  if (!date || !time) {
    return { success: false, error: 'Date and time are required to block slot' };
  }

  const payload = {
    date,
    time,
    doctor_id: appointmentData.doctor_id || undefined,
    doctor_name: appointmentData.doctor_name || undefined,
    patient_name: appointmentData.patient_name || appointmentData.name || 'CRM Bemor',
    patient_phone: appointmentData.patient_phone || appointmentData.phone || undefined,
    service_title: appointmentData.service || appointmentData.service_name || appointmentData.service_title || 'CRM Qabul',
    slot_key: appointmentData.slot_key || undefined,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${config.websiteUrl}/api/crm/slots`, {
      method: 'POST',
      headers: getRequestHeaders(config.apiKey),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      console.log(`[WebsiteSync] ✅ Vaqt saytda band qilindi: ${date} ${time}`);
      return { success: true, slot: data.slot || data.record, message: data.message };
    } else {
      console.warn(`[WebsiteSync] ⚠️ Sayt javob bermadi yoki xato:`, data?.error || res.statusText);
      return { success: false, error: data?.error || `HTTP ${res.status}: ${res.statusText}` };
    }
  } catch (err) {
    console.warn(`[WebsiteSync] ❌ Sayt bilan bog'lanishda xatolik:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 3. CRM DAN SAYTGA: Band qilingan vaqtni qayta bo'shatish (DELETE /api/crm/slots)
 */
export async function unblockWebsiteSlot(appointmentData) {
  const config = getWebsiteConfig();
  if (!config.autoSyncEnabled && !appointmentData._force) {
    return { success: false, skipped: true, reason: 'Auto-sync is disabled' };
  }

  const { date, time } = normalizeDateTime(appointmentData.date, appointmentData.time);

  const payload = {
    date,
    time,
    doctor_id: appointmentData.doctor_id || undefined,
    slot_key: appointmentData.slot_key || undefined,
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${config.websiteUrl}/api/crm/slots`, {
      method: 'DELETE',
      headers: getRequestHeaders(config.apiKey),
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (res.ok && data?.success) {
      console.log(`[WebsiteSync] 🔓 Vaqt saytda qayta bo'shatildi: ${date} ${time}`);
      return { success: true, message: data.message };
    } else {
      console.warn(`[WebsiteSync] ⚠️ Bo'shatishda xato:`, data?.error || res.statusText);
      return { success: false, error: data?.error || `HTTP ${res.status}: ${res.statusText}` };
    }
  } catch (err) {
    console.warn(`[WebsiteSync] ❌ Sayt bilan bog'lanishda xatolik:`, err.message);
    return { success: false, error: err.message };
  }
}

/**
 * 4. SAYTDAGI BARCHA BAND VAQTLARNI TEKSHIRISH (GET /api/crm/slots)
 */
export async function getWebsiteSlots(date, doctorId) {
  const config = getWebsiteConfig();
  const queryParams = new URLSearchParams();
  if (date) queryParams.set('date', date);
  if (doctorId) queryParams.set('doctor_id', doctorId);

  const url = `${config.websiteUrl}/api/crm/slots${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      method: 'GET',
      headers: getRequestHeaders(config.apiKey),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => null);

    if (res.ok && data) {
      return {
        success: true,
        count: data.count || (data.slots ? data.slots.length : 0),
        slots: data.slots || [],
        records: data.records || [],
      };
    } else {
      return { success: false, error: data?.error || `HTTP ${res.status}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Check connectivity and latency to the website slots API
 */
export async function checkWebsiteConnection() {
  const config = getWebsiteConfig();
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${config.websiteUrl}/api/crm/slots`, {
      method: 'GET',
      headers: getRequestHeaders(config.apiKey),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latency = Date.now() - startTime;
    if (res.ok) {
      return { online: true, latency, status: res.status };
    } else {
      return { online: false, latency, status: res.status, error: `HTTP ${res.status}` };
    }
  } catch (err) {
    return {
      online: false,
      latency: Date.now() - startTime,
      error: err.name === 'AbortError' ? 'Timeout (4s)' : err.message,
    };
  }
}

/**
 * One-click full sync: pushes all active appointments to the website slots API
 */
export async function syncAllAppointmentsToWebsite(appointments = []) {
  const activeAppointments = appointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'no-show' && a.date && a.time
  );

  let successCount = 0;
  let failCount = 0;

  for (const apt of activeAppointments) {
    const res = await blockWebsiteSlot({ ...apt, _force: true });
    if (res.success) {
      successCount++;
    } else {
      failCount++;
    }
  }

  return {
    total: activeAppointments.length,
    synced: successCount,
    failed: failCount,
  };
}

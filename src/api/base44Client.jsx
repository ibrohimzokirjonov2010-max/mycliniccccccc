import { supabase, db } from './supabaseClient';
import { sendTelegramMessage, formatLeadMessage } from './telegramBot';

// Plan configurations
export const PLAN_FEATURES = {
  basic: [
    "patients", "appointments", "payments", "recalls", "leads", "settings",
    "expenses", "payroll", "services", "inventory", "reports", "treatment_plans", 
    "no_show", "treatment_tracking", "debts", "technicians", "staff"
  ],
  pro: [
    "patients", "appointments", "payments", "recalls", "leads", "settings",
    "expenses", "payroll", "services", "inventory", "reports", "treatment_plans", 
    "no_show", "treatment_tracking", "debts", "technicians", "staff",
    "implants", "marketing", "cases"
  ]
};

// Feature validation function (Middleware substitute)
const enforceFeature = (feature) => {
  const clinicPlan = localStorage.getItem('clinic_plan') || 'pro';
  const features = PLAN_FEATURES[clinicPlan] || [];
  if (!features.includes(feature)) {
    throw { code: 403, message: 'Bu moduldan foydalanish uchun PRO ta`rifiga o`ting!' };
  }
};

/**
 * Static Store - Performance Optimization Layer
 * Eliminates synchronous localStorage blocking by caching reads in memory.
 */
class StaticStore {
  static _cache = new Map();
  static _dirty = new Set();

  static get(key) {
    if (this._cache.has(key)) return this._cache.get(key);
    try {
      const data = localStorage.getItem(key);
      const parsed = data ? JSON.parse(data) : null;
      this._cache.set(key, parsed);
      return parsed;
    } catch { return null; }
  }

  static set(key, value) {
    this._cache.set(key, value);
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) { console.warn('Storage error:', e.message); }
  }

  static clear(key) {
    this._cache.delete(key);
    localStorage.removeItem(key);
  }

  static flush() {
    this._cache.clear();
  }
}

/**
 * Request Cache - API so'rovlarni deduplicate qiladi
 * Bir xil so'rov 5 sekund ichida qayta qilinsa, Supabase ga bormaydi
 * Bu "qotib qolish" va ortiqcha loading ni kamaytiradi
 */
class RequestCache {
  static _cache = new Map();

  static getTTL(entity) {
    // Reference tables that change very rarely
    if (['User', 'Service', 'BotConfig'].includes(entity)) {
      return 300000; // 5 minutes
    }
    // Transactional tables that need relatively fresh updates
    // Oshirildi: 15 soniyadan 3 daqiqaga (180000ms). Sahifalararo tezkor o'tishni ta'minlaydi.
    // Har qanday o'zgartirish (create/update/delete) keshni avtomatik tozalaydi.
    return 180000; // 3 minutes
  }

  static flush() {
    this._cache.clear();
  }

  static getKey(entity, method, args) {
    try { return `${entity}:${method}:${JSON.stringify(args)}`; }
    catch { return `${entity}:${method}`; }
  }

  static get(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    const entity = key.split(':')[0];
    const ttl = this.getTTL(entity);
    if (Date.now() - entry.time > ttl) {
      this._cache.delete(key);
      return null;
    }
    return entry.promise;
  }

  static set(key, promise) {
    const entity = key.split(':')[0];
    const ttl = this.getTTL(entity);
    this._cache.set(key, { promise, time: Date.now() });
    setTimeout(() => this._cache.delete(key), ttl + 100);
    return promise;
  }

  static invalidate(entity) {
    for (const key of this._cache.keys()) {
      if (key.startsWith(`${entity}:`)) this._cache.delete(key);
    }
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('crm-context-updated', () => {
    RequestCache.flush();
    console.log('🔄 RLS Context updated, flushed API request cache.');
  });
}

/**
 * Hybrid Entity Loader - Supabase with localStorage fallback
 * Uses Supabase when available, falls back to localStorage for offline mode
 */
class HybridEntityLoader {
  constructor(entityName) {
    this.entityName = entityName;
    this.useSupabase = !!import.meta.env.VITE_SUPABASE_URL;
    // Memory cache for record enrichment results to avoid repeated JSON.parse/merge in same render cycle
    this._enrichmentCache = new Map();
  }

  _getClinicId() {
    return (
      localStorage.getItem('current_clinic_id') ||
      localStorage.getItem('clinic_id') ||
      'default_clinic'
    );
  }

  _checkAccess() {
    const featureMap = {
      'Patient': 'patients',
      'Appointment': 'appointments',
      'Payment': 'payments',
      'Recall': 'recalls',
      'Lead': 'leads',
      'Implant': 'implants',
      'ImplantBrand': 'implants',
      'Technician': 'technicians',
      'TechnicianJob': 'technicians',
      'Inventory': 'inventory',
      'Expense': 'payroll',
      'Payroll': 'payroll'
    };
    
    const feature = featureMap[this.entityName];
    if (feature) {
      enforceFeature(feature);
    }
  }

  _techFields() {
    if (this.entityName === 'ImplantBrand') {
      return ['name', 'code', 'initial_stock', 'added_stock', 'country', 'model', 'notes', 'price', 'is_active', 'created_date', 'clinic_id'];
    }
    if (this.entityName === 'TreatmentPlan') {
      return ['name', 'patient_name', 'status', 'priority', 'tooth_number', 'services', 'total_price', 'start_date', 'notes', 'installment_plan', 'paid_amount', 'doctor_id', 'doctor_name'];
    }
    if (this.entityName === 'Implant') {
      return ['firma', 'firma_custom', 'brend', 'diameter', 'length', 'lot_number',
              'torque', 'isq', 'bone_type', 'implant_type', 'doctor',
              'extra_services', 'tooth_numbers', 'timeline', 'audit_log',
              'complications', 'xray_urls', 'reminder_months', 'reminder_date',
              'tooth_data', 'placement_date', 'lifecycle_status', 'tooth_id',
              'service_name', 'hizmat_turi', 'price', 'narxi', 'stage_items'];
    }
    if (this.entityName === 'Payment') {
      return ['doctor_id', 'commission_rate', 'patient_name', 'category', 'debt_amount', 'method'];
    }
    if (this.entityName === 'User') {
      // MUHIM: username va password notes'ga ENCODE QILINMASIN!
      // Ular doim to'g'ridan-to'g'ri DB ustunlarida saqlanishi kerak
      // Aks holda login ishlamaydi
      return [
        'phone',
        'specialty',
        'commission_rate',
        'base_salary',
        'full_name',
        'name',
        'role',
        'workingHours',
        'avatar_url',
        'photo_url',
        'photo',
        'avatar',
        'image',
        'salary_type',
        'is_active',
        'color',
        'telegram_chat_id'
      ];
    }
    if (this.entityName === 'Recall') {
      return ['patient_name', 'patient_phone', 'type', 'type_label', 'status', 'recall_date', 'notes'];
    }
    if (this.entityName === 'TechnicianJob') {
      return ['patient_name', 'patient_id', 'doctor_name', 'doctor_id', 'technician_name', 'technician_id', 'tooth_number', 'work_type', 'construction_type', 'shade', 'status', 'deadline', 'impression_date', 'cost', 'notes', 'photo_urls'];
    }
    if (this.entityName === 'Technician') {
      return ['name', 'phone', 'specialization', 'is_active', 'created_date'];
    }
    if (this.entityName === 'Appointment') {
      return [
        'patient_name',
        'patient_phone',
        'doctor_name',
        'service_name',
        'price',
        'duration',
        'status',
        'notes',
        'date',
        'time',
        'confirmation_status',
        'confirmation_sent_at',
        'confirmation_requested_at',
        'confirmation_response_at',
        'confirmation_response_channel',
        'confirmation_follow_up_choice',
        'confirmation_message_id',
        'tooth_number',
      ];
    }
    if (this.entityName === 'Lead') {
      return ['name', 'phone', 'email', 'source', 'status', 'notes', 'assigned_to'];
    }
    if (this.entityName === 'ScheduledNotification') {
      return ['patient_id', 'patient_name', 'message', 'scheduled_at', 'channel', 'status', 'type', 'appointment_id', 'chat_id'];
    }
    if (this.entityName === 'BotConfig') {
      return ['botToken', 'botUsername', 'isActive', 'welcomeMessage', 'availableServices', 'workingHours', 'bookingAdvanceDays', 'slotDuration', 'requirePhone', 'allowSameDay', 'leadChatId', 'lead_chat_id'];
    }
    if (this.entityName === 'Patient') {
      return ['full_name', 'phone', 'email', 'birth_date', 'gender', 'address', 'city', 'status', 'notes', 'photo_url', 'source', 'first_name', 'last_name', 'total_paid', 'total_debt', 'telegram_chat_id', 'telegram_username', 'phone_secondary', 'important_info', 'comment', 'payer', 'discount_percent', 'contact', 'main_treatment_provider', 'card_number', 'registration_date'];
    }
    if (this.entityName === 'Case') {
      return ['doctor', 'patientname', 'patient_id', 'date', 'tags', 'images', 'description'];
    }
    if (this.entityName === 'CaseCategory') {
      return ['name', 'notes'];
    }
    return [];
  }

  // Encode all tech data into the notes string for guaranteed Supabase persistence  
  _encodeNotes(payload) {
    const fields = this._techFields();
    if (fields.length === 0) return payload;
    
    const techData = {};
    fields.forEach(f => {
      if (payload[f] !== undefined && payload[f] !== null && payload[f] !== '') {
        techData[f] = payload[f];
      }
    });
    
    if (Object.keys(techData).length === 0) return payload;
    const userNotes = payload.notes || '';
    
    // Don't double-encode
    if (typeof userNotes === 'string' && userNotes.startsWith('[TECH_DATA]')) return payload;
    
    const encoded = '[TECH_DATA]' + JSON.stringify(techData) + '[END_TECH]' + (userNotes ? '\n' + userNotes : '');
    return { ...payload, notes: encoded };
  }

  // Decode tech fields from notes when reading from Supabase
  _decodeNotes(record) {
    if (!record) return record;
    const fields = this._techFields();
    if (fields.length === 0) return record;
    
    const notes = record.notes || '';
    if (!notes.startsWith('[TECH_DATA]')) return record;
    
    try {
      const endIdx = notes.indexOf('[END_TECH]');
      if (endIdx === -1) return record;
      const jsonStr = notes.substring(11, endIdx); // 11 = '[TECH_DATA]'.length
      const techData = JSON.parse(jsonStr);
      const userNotes = notes.substring(endIdx + 10).replace(/^\n/, ''); // 10 = '[END_TECH]'.length
      const merged = { ...record, notes: userNotes };
      
      // Fill in missing fields from the encoded tech data
      Object.entries(techData).forEach(([k, v]) => {
        if (merged[k] == null || merged[k] === '') {
          if (k === 'images' && typeof v === 'string' && v.startsWith('{')) {
            try { merged[k] = JSON.parse(v); } catch { merged[k] = v; }
          } else if (k === 'tags' && typeof v === 'string' && v.startsWith('[')) {
            try { merged[k] = JSON.parse(v); } catch { merged[k] = v; }
          } else {
            merged[k] = v;
          }
        }
      });
      return merged;
    } catch (e) {
      return record;
    }
  }

  _enrich(records) {
    if (!Array.isArray(records) || records.length === 0) return records;
    
    // Performance: Clear transient enrichment cache only if records change significantly (e.g. new list)
    // For now we use it as a per-list-call cache
    const cache = new Map();
    const result = [];
    const seen = new Set();

    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.id || seen.has(r.id)) continue;
      seen.add(r.id);

      // 1. Decode notes (Tech fields)
      let enriched = this._decodeNotes(r);

      // 2. Merge with deep local data if exists
      const local = this._getDeepLocal(enriched.id);
      if (local) {
        enriched = { ...local, ...enriched };
      }

      // 3. Entity-specific field normalization
      if (this.entityName === 'Case') {
        if (typeof enriched.tags === 'string') {
          try { enriched.tags = JSON.parse(enriched.tags); }
          catch { enriched.tags = enriched.tags ? [enriched.tags] : []; }
        }
        if (!Array.isArray(enriched.tags)) {
          enriched.tags = enriched.tags ? [enriched.tags] : [];
        }
        if (typeof enriched.images === 'string') {
          try { enriched.images = JSON.parse(enriched.images); }
          catch { enriched.images = { after: enriched.images }; }
        }
        if (!enriched.images || typeof enriched.images !== 'object') {
          enriched.images = {
            before: enriched.image_before || '',
            after: enriched.image_after || ''
          };
        }
      }
      
      result.push(enriched);
    }

    return result;
  }

  _getDeepLocal(id) {
    if (this.entityName === 'Service' || this.entityName === 'Note') return null;
    const cacheKey = `${this.entityName.toLowerCase()}_full_data_${id}`;
    return StaticStore.get(cacheKey);
  }

  _saveDeepLocal(record) {
    if (this.entityName === 'Service' || this.entityName === 'Note') return;
    const cacheKey = `${this.entityName.toLowerCase()}_full_data_${record.id}`;
    StaticStore.set(cacheKey, record);
  }

  _getDeepLocalRecords(specificClinicId = null) {
    if (this.entityName === 'Service' || this.entityName === 'Note') return [];

    const clinicId = specificClinicId || this._getClinicId();
    const prefix = `${this.entityName.toLowerCase()}_full_data_`;

    try {
      const records = [];
      const keys = Object.keys(localStorage).filter(key => key.startsWith(prefix));

      keys.forEach((key) => {
        const record = StaticStore.get(key);
        if (!record || !record.id) return;

        const recordClinicId = record.clinic_id || clinicId;
        if (specificClinicId && String(recordClinicId) !== String(clinicId)) return;
        if (!specificClinicId && String(recordClinicId) !== String(clinicId)) return;

        records.push(record);
      });

      const uniqueMap = new Map();
      records.forEach((record) => {
        if (!uniqueMap.has(record.id)) {
          uniqueMap.set(record.id, record);
        }
      });

      return Array.from(uniqueMap.values());
    } catch (error) {
      console.warn(`Failed to recover deep local ${this.entityName} records:`, error?.message || error);
      return [];
    }
  }

  // Supabase methods
  async count(conditions = {}) {
    if (!this.useSupabase) return (await this.list()).length;
    try {
      const clinicId = this._getClinicId();
      let query = supabase.from(this._getTableName()).select('id', { count: 'exact', head: true }).eq('clinic_id', clinicId);
      Object.entries(conditions).forEach(([k, v]) => {
        if (v != null) query = query.eq(k, v);
      });
      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error(`Error counting ${this.entityName}:`, error);
      return (await this._localStorageFilter(conditions)).length;
    }
  }

  async list(orderBy = '-created_date', limit = 100, offset = 0) {
    this._checkAccess();
    if (!this.useSupabase) return this._localStorageList(orderBy, limit);

    // Request deduplication cache - bir xil so'rov 5 sek ichida qayta Supabase ga bormaydi
    const cacheKey = RequestCache.getKey(this.entityName, 'list', [orderBy, limit, offset]);
    const cached = RequestCache.get(cacheKey);
    if (cached) return cached;

    const promise = this._doList(orderBy, limit, offset);
    return RequestCache.set(cacheKey, promise);
  }

  async _doList(orderBy = '-created_date', limit = 100, offset = 0) {
    try {
      const clinicId = this._getClinicId();
      
      // TECH_DATA ichida saqlanadigan ustunlar - DB da ORDER BY ishlamaydi
      // Bu ustunlar bilan order qilishga urinilsa, created_date ga fallback qilinadi
      const TECH_DATA_FIELDS = new Set([
        'full_name', 'name', 'phone', 'email', 'date', 'patient_name',
        'doctor_name', 'service_name', 'category', 'source', 'status',
        'assigned_to', 'type', 'total_paid', 'total_debt', 'specialty',
        'title', 'description', 'address', 'city', 'gender'
      ]);

      const rawOrder = orderBy.startsWith('-') ? orderBy.substring(1) : orderBy;
      const actualOrder = this.entityName === 'User'
        ? 'created_at'
        : (TECH_DATA_FIELDS.has(rawOrder) ? 'created_date' : rawOrder);
      const ascending = this.entityName === 'User'
        ? false
        : !orderBy.startsWith('-');
      
      let query = supabase
        .from(this._getTableName())
        .select('*');
      // BotConfig: ko‘p klinika uchun bitta bot ishlatilishi mumkin.
      // Shuning uchun BotConfig’ni klinika_id bilan qattiq filter qilmaymiz.
      // (Agar siz har klinikaga alohida bot xohlasangiz, bu joyni qaytarib qo‘yamiz.)
      if (this.entityName !== 'BotConfig') {
        query = query.eq('clinic_id', clinicId);
      }

      const isMultiplexed = this.entityName === 'Note';
      
      let res;
      if (isMultiplexed) {
         res = await supabase.from('notes').select('*').eq('clinic_id', clinicId).order(actualOrder, { ascending }).range(offset, offset + limit - 1);
      } else {
         res = await query.order(actualOrder, { ascending }).range(offset, offset + limit - 1);
      }
      
      let { data, error } = res;
      
      // Agar ustun topilmasa (400/500) — created_at bilan qayta urinib ko'r
      if (error && (error.code === '42703' || error.message?.includes('column') || error.message?.includes('does not exist'))) {
        console.warn(`[${this.entityName}] Column '${actualOrder}' not found, retrying with created_at`);
        const fallbackRes = isMultiplexed
          ? await supabase.from('notes').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }).range(offset, offset + limit - 1)
          : await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);
        
        if (fallbackRes.error) {
          console.warn(`[${this.entityName}] Column 'created_at' not found, retrying without ordering`);
          const fallbackRes2 = isMultiplexed
            ? await supabase.from('notes').select('*').eq('clinic_id', clinicId).range(offset, offset + limit - 1)
            : await query.range(offset, offset + limit - 1);
          data = fallbackRes2.data;
          error = fallbackRes2.error;
        } else {
          data = fallbackRes.data;
          error = fallbackRes.error;
        }
      }
      
      if (error) throw error;

      // Auto-seed Services if completely empty
      if (this.entityName === 'Service' && (!data || data.length === 0)) {
        await this._seedDefaultServices(clinicId);
        return await this._localStorageList(orderBy, limit);
      }

      // Enrich with decoding and local cache
      const enriched = this._enrich(data || []);
      
      // Local filtering for multiplexed tables (derived from [TECH_DATA] payload)
      if (isMultiplexed) {
        let filtered = [];
        if (this.entityName === 'TechnicianJob') filtered = enriched.filter(e => e.entity_type === 'technician_job');
        if (this.entityName === 'Technician') filtered = enriched.filter(e => e.entity_type === 'technician');
        if (this.entityName === 'Note') filtered = enriched.filter(e => !e.entity_type);
        
        // Apply manual descending sort to compensate for dropped .order()
        return filtered.sort((a, b) => {
          const dA = a.created_date || a.created_at || '';
          const dB = b.created_date || b.created_at || '';
          return dB.localeCompare(dA);
        });
      }
      
      // For Recall: merge with any recent local creations that might not be in DB yet
      if (this.entityName === 'Recall') {
        const localData = this._localStorageList(orderBy, limit);
        const merged = [...enriched];
        localData.forEach(lr => {
          if (!merged.find(mr => mr.id === lr.id)) {
            merged.push(lr);
          }
        });
        return merged;
      }

      // For BotConfig: Supabase’da yo‘q bo‘lsa ham localStorage’dagi configni ko‘rsatish
      // (Telegram bot havolasi topilmay qolmasligi uchun)
      if (this.entityName === 'BotConfig') {
        const localData = this._localStorageList(orderBy, limit);
        const merged = [...enriched];
        localData.forEach(lr => {
          if (!merged.find(mr => mr.id === lr.id)) {
            merged.push(lr);
          }
        });
        return merged;
      }

      // For Case: merge with local data so locally saved cases always show up!
      if (this.entityName === 'Case' || this.entityName === 'CaseCategory') {
        const localData = this._localStorageList(orderBy, limit);
        const merged = [...enriched];
        localData.forEach(lr => {
          if (!merged.find(mr => mr.id === lr.id)) {
            merged.push(lr);
          }
        });
        return merged;
      }

      // For User: merge with auth system users and mock DB users
      // This prevents doctors from disappearing in Appointments/Payments tabs when Supabase hasn't synced
      if (this.entityName === 'User') {
        const merged = [...enriched];
        try {
          const sysUsersRaw = localStorage.getItem('system_users');
          const mockUsersRaw = localStorage.getItem(`mock_db_${clinicId}_User`);
          const sysUsers = sysUsersRaw ? JSON.parse(sysUsersRaw) : [];
          const mockUsers = mockUsersRaw ? JSON.parse(mockUsersRaw) : [];
          
          [...sysUsers, ...mockUsers].forEach(lu => {
            if (String(lu.clinic_id) === String(clinicId) && !merged.find(mu => mu.id === lu.id)) {
              merged.push(lu);
            }
          });
        } catch (e) { /* ignore */ }
        return merged;
      }

      return enriched;
    } catch (error) {
      console.error(`Error fetching ${this.entityName}:`, error);
      return this._localStorageList(orderBy, limit);
    }
  }

  _getSearchFields() {
    switch(this.entityName) {
      case 'Patient': return ['full_name', 'notes', 'phone'];
      case 'Lead': return ['name', 'notes', 'phone'];
      case 'Appointment': return ['patient_name', 'doctor_name', 'service_name', 'notes'];
      case 'Payment': return ['patient_name', 'category', 'notes'];
      case 'Inventory': return ['name', 'category', 'notes'];
      case 'Case': return ['patientname', 'doctor', 'description', 'notes'];
      default: return ['notes', 'name', 'title'];
    }
  }

  async search(queryStr, limit = 50, offset = 0) {
    if (!this.useSupabase || !queryStr) return this.list('-created_date', limit, offset);
    try {
      const clinicId = this._getClinicId();
      const tableName = this._getTableName();
      
      const searchFields = this._getSearchFields();
      
      // Filter out fields that might not exist in the basic table schema if necessary, 
      // but notes almost always exists as the bucket for everything else
      const orFilter = searchFields.map(f => `${f}.ilike.%${queryStr}%`).join(',');

      let query = supabase
        .from(tableName)
        .select('*')
        .eq('clinic_id', clinicId)
        .or(orFilter)
        .order('id', { ascending: false })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;
      if (error) {
        console.warn('Search query failed, falling back to basic list:', error);
        return this.list('-created_date', limit, offset);
      }
      return this._enrich(data || []);
    } catch (e) {
      console.error('Search error:', e);
      return [];
    }
  }

  async filter(conditions, orderBy = null, limit = 100, offset = 0) {
    if (!this.useSupabase) return this._localStorageFilter(conditions, orderBy, limit);
    
    // Request deduplication cache - bir xil filter 5 sek ichida qayta Supabase ga bormaydi
    const cacheKey = RequestCache.getKey(this.entityName, 'filter', [conditions, orderBy, limit, offset]);
    const cached = RequestCache.get(cacheKey);
    if (cached) return cached;

    const promise = this._doFilter(conditions, orderBy, limit, offset);
    return RequestCache.set(cacheKey, promise);
  }

  async _doFilter(conditions, orderBy = null, limit = 100, offset = 0) {
    try {
      const clinicId = conditions.clinic_id || this._getClinicId();
      
      let query = supabase
        .from(this._getTableName())
        .select('*');
      
      // BotConfig: default holatda klinika bo‘yicha filter qilmaymiz (global bot support)
      // Agar caller aniq clinic_id bersa, shu holatda filter qiladi.
      if (this.entityName !== 'BotConfig' || conditions.clinic_id) {
        query = query.eq('clinic_id', clinicId);
      }
      
      Object.entries(conditions).forEach(([key, value]) => {
        if (key !== 'clinic_id') {
          query = query.eq(key, value);
        }
      });
      
      if (orderBy) {
        query = query.order(orderBy.startsWith('-') ? orderBy.substring(1) : orderBy, { 
          ascending: !orderBy.startsWith('-') 
        });
      }
      
      const { data, error } = await query.range(offset, offset + limit - 1);
      if (error) throw error;
      
      // Enrich with decoding and local cache
      const enriched = this._enrich(data || []);

      // BotConfig: Supabase’dan bo‘sh kelsa ham localStorage bilan merge qilish
      if (this.entityName === 'BotConfig') {
        const localData = this._localStorageFilter(conditions, orderBy, limit);
        const merged = [...enriched];
        localData.forEach(lr => {
          if (!merged.find(mr => mr.id === lr.id)) merged.push(lr);
        });
        return merged;
      }

      // For User: merge with auth system users and mock DB users
      // Consistent with .list method logic
      if (this.entityName === 'User') {
        const merged = [...enriched];
        try {
          const clinicId = conditions.clinic_id || this._getClinicId();
          const sysUsersRaw = localStorage.getItem('system_users');
          const mockUsersRaw = localStorage.getItem(`mock_db_${clinicId}_User`);
          const sysUsers = sysUsersRaw ? JSON.parse(sysUsersRaw) : [];
          const mockUsers = mockUsersRaw ? JSON.parse(mockUsersRaw) : [];
          
          [...sysUsers, ...mockUsers].forEach(lu => {
            if (String(lu.clinic_id) === String(clinicId) && !merged.find(mu => mu.id === lu.id)) {
              // Apply local filtering for role if present in conditions
              if (conditions.role && lu.role !== conditions.role) return;
              merged.push(lu);
            }
          });
        } catch (e) { /* ignore */ }
        return merged;
      }

      return enriched;
    } catch (error) {
      console.error(`Error filtering ${this.entityName}:`, error);
      return this._localStorageFilter(conditions, orderBy, limit);
    }
  }

  async get(id) {
    if (!id) return null;
    try {
      const records = await this.filter({ id }, null, 1);
      return records && records.length > 0 ? records[0] : null;
    } catch (e) {
      console.warn(`Error in ${this.entityName}.get(${id}):`, e);
      return null;
    }
  }

  async getById(id) {
    return this.get(id);
  }

  async findById(id) {
    return this.get(id);
  }

  async create(payload) {
    this._checkAccess();
    RequestCache.invalidate(this.entityName);
    if (!this.useSupabase) return this._localStorageCreate(payload);
    
    // Use clinic_id from payload if provided (Super Admin mode), otherwise fallback to session clinic
    const clinicId = payload.clinic_id || this._getClinicId();
    const tableName = this._getTableName();
    
    // Clean payload: empty strings to null to avoid Postgres type errors
    let cleanPayload = Object.fromEntries(
      Object.entries(payload).map(([k, v]) => [k, v === '' ? null : v])
    );

    // Auto-calculate debt_amount for Payment
    if (this.entityName === 'Payment' && cleanPayload.patient_id) {
      try {
        const { data: patientData } = await supabase
          .from('patients')
          .select('total_debt')
          .eq('id', cleanPayload.patient_id)
          .single();
        
        const currentDebt = Number(patientData?.total_debt) || 0;
        const type = String(cleanPayload.type || 'Income').toLowerCase();
        const amount = Math.abs(Number(cleanPayload.amount) || 0);
        
        let newDebt = currentDebt;
        if (type === 'income' || type === 'discount') {
          newDebt = Math.max(0, currentDebt - amount);
        } else if (type === 'debt' || type === 'refund') {
          newDebt = currentDebt + amount;
        }
        cleanPayload.debt_amount = newDebt;
      } catch (err) {
        console.warn('Failed to pre-calculate payment debt_amount:', err);
      }
    }

    // Normalize status/gender fields to match DB CHECK constraints
    if (cleanPayload.status && (tableName === 'patients' || tableName === 'treatment_plans')) {
      const statusMap = { 
        'new': 'New', 
        'active': 'Active', 
        'completed': 'Completed',
        'planned': 'Planned',
        'in_progress': 'In Progress',
        'in_treatment': 'In Treatment',
        'Rejalashtirilgan': 'Planned', 
        'Jarayonda': 'In Progress', 
        'Yakunlangan': 'Completed' 
      };
      cleanPayload.status = statusMap[cleanPayload.status] || (typeof cleanPayload.status === 'string' ? cleanPayload.status.charAt(0).toUpperCase() + cleanPayload.status.slice(1) : cleanPayload.status);
    }
    if (cleanPayload.gender && tableName === 'patients') {
      cleanPayload.gender = cleanPayload.gender.toLowerCase();
    }

    // Determine timestamp column (User and Clinic tables typically use created_at)
    const timestampCol = (this.entityName === 'User' || this.entityName === 'Clinic') ? 'created_at' : 'created_date';

    // Sanitize numeric fields for implants to avoid 22P02 Postgres errors
    if (tableName === 'implants') {
      if (cleanPayload.reminder_months === 'custom' || (typeof cleanPayload.reminder_months === 'string' && isNaN(Number(cleanPayload.reminder_months)))) {
        cleanPayload.reminder_months = null;
      } else if (cleanPayload.reminder_months != null) {
        const parsed = parseInt(cleanPayload.reminder_months, 10);
        cleanPayload.reminder_months = isNaN(parsed) ? null : parsed;
      }
    }

    // NOTES-ENCODING: pack ALL tech fields into notes for guaranteed Supabase persistence
    // This solves the issue when columns are not yet in Supabase schema
    cleanPayload = this._encodeNotes(cleanPayload);
    
    // For implants: pack into tooth_data too if it's an implant
    if (tableName === 'implants') {
      const implantTechFields = ['firma', 'firma_custom', 'brend', 'diameter', 'length', 
                                  'lot_number', 'torque', 'isq', 'bone_type', 'implant_type'];
      const backupData = {};
      implantTechFields.forEach(f => {
        if (cleanPayload[f] != null && cleanPayload[f] !== '') {
          backupData[f] = cleanPayload[f];
        }
      });
      if (Object.keys(backupData).length > 0) {
        cleanPayload.tooth_data = { ...(cleanPayload.tooth_data || {}), ...backupData };
      }
    }

    let record = {
      id: cleanPayload.id || this.entityName.toLowerCase() + '-' + Math.random().toString(36).substring(2, 11),
      ...cleanPayload,
      clinic_id: clinicId,
      [timestampCol]: new Date().toISOString()
    };
    
    // Optimized retry logic (increased to max 50 attempts to handle multiple missing columns)
    const removedCols = [];
    for (let attempt = 0; attempt < 50; attempt++) {
      try {
        const { data, error } = await supabase
          .from(this._getTableName())
          .insert([record])
          .select()
          .single();
        
        if (error) {
          // PGRST204, 42703 or generic 400 with "column" in message: Column not found — remove it and retry
          if ((error.code === 'PGRST204' || error.code === '42703' || error.code === 'PGRST200' || error.code === '400') && error.message) {
            const colMatch = error.message.match(/the '(\w+)' column/) || 
                             error.message.match(/column "(\w+)"/) || 
                             error.message.match(/column '(\w+)'/) ||
                             error.message.match(/field "(\w+)"/);
            
            if (colMatch) {
              const badCol = colMatch[1];
              // PROTECT critical columns - never strip these
              const protectedCols = ['notes', 'clinic_id', 'id', 'recall_date', 'patient_id'];
              if (protectedCols.includes(badCol)) {
                console.warn(`⚠️ [${this.entityName}] Protected column '${badCol}' missing or invalid in DB!`);
                throw error; // Can't proceed without these
              }
              console.warn(`⚠️ [${this.entityName}] Column '${badCol}' not in DB (Code: ${error.code}), removing and retry...`);
              removedCols.push(badCol);
              record = { ...record };
              delete record[badCol];
              continue; // retry
            }
          }
          // Unique constraint violation (e.g. username already exists)
          if (error.code === '23505') {
            const detail = error.detail || error.message;
            throw new Error(`23505 Ushbu ${this.entityName === 'User' ? 'login' : 'ma\'lumot'} allaqachon mavjud! (${detail})`);
          }
          // Check constraint violation
          if (error.code === '23514') {
            throw new Error(`23514 Check constraint failed: ${error.message}`);
          }
          throw new Error(`Supabase DB Error (${error.code}): ${error.message}`);
        }
        
        if (removedCols.length > 0) {
          console.log(`✅ Created ${this.entityName} (removed: ${removedCols.join(', ')}):`, data.id);
        } else {
          console.log(`✅ Created ${this.entityName}:`, data.id);
        }
        // Success
        // Success: Return the full payload merged with the database result (like the ID)
        const enrichedRecord = { ...cleanPayload, ...record, ...data };
        this._saveDeepLocal(enrichedRecord);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));

        // TELEGRAM NOTIFICATION: If Lead is created, notify the clinic
        if (this.entityName === 'Lead') {
          this._notifyTelegram(enrichedRecord);
        }

        return this._enrich([enrichedRecord])[0] || enrichedRecord;
      } catch (error) {
        console.error(`Error creating ${this.entityName}:`, error);
        
        // DO NOT silently fallback to localstorage if it's a known conflict or validation error
        if (error.message && (error.message.includes('23505') || error.message.includes('23514'))) {
           throw error; // Throw to UI
        }
        
        return this._localStorageCreate(payload);
      }
    }
    
    // All retries failed - fall back to localStorage
    console.error(`❌ [${this.entityName}] All retries failed. Using localStorage.`);
    const fallbackRes = this._localStorageCreate(payload);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
    return fallbackRes;
  }

  async update(id, payload) {
    RequestCache.invalidate(this.entityName);
    if (!this.useSupabase) return this._localStorageUpdate(id, payload);
    
    try {
      const tableName = this._getTableName();
      // Clean payload: empty strings to null to avoid Postgres type errors
      let cleanPayload = Object.fromEntries(
        Object.entries(payload).map(([k, v]) => [k, v === '' ? null : v])
      );

      // Normalize status/gender fields to match DB CHECK constraints
      if (cleanPayload.status && (tableName === 'patients' || tableName === 'treatment_plans' || tableName === 'leads')) {
        if (tableName === 'leads') {
          cleanPayload.status = cleanPayload.status.toLowerCase();
        } else {
          const statusMap = { 
            'new': 'New', 
            'active': 'Active', 
            'completed': 'Completed',
            'planned': 'Planned',
            'in_progress': 'In Progress',
            'in_treatment': 'In Treatment'
          };
          cleanPayload.status = statusMap[cleanPayload.status] || (typeof cleanPayload.status === 'string' ? cleanPayload.status.charAt(0).toUpperCase() + cleanPayload.status.slice(1) : cleanPayload.status);
        }
      }
      if (cleanPayload.gender && tableName === 'patients') {
        cleanPayload.gender = cleanPayload.gender.toLowerCase();
      }

      // Preserve previously encoded tech fields on partial updates.
      // Without this, updates like { paid_amount } can overwrite notes-encoded
      // fields such as installment_plan and make muddatli data disappear.
      const techFields = this._techFields();
      if (techFields.length > 0) {
        try {
          const { data: existingRecord } = await supabase
            .from(tableName)
            .select('*')
            .eq('id', id)
            .single();

          const existingEnriched = existingRecord
            ? (this._enrich([existingRecord])[0] || existingRecord)
            : null;

          if (existingEnriched) {
            techFields.forEach((field) => {
              const hasIncomingValue = Object.prototype.hasOwnProperty.call(cleanPayload, field);
              if (!hasIncomingValue && existingEnriched[field] !== undefined && existingEnriched[field] !== null && existingEnriched[field] !== '') {
                cleanPayload[field] = existingEnriched[field];
              }
            });

            if (!Object.prototype.hasOwnProperty.call(cleanPayload, 'notes')) {
              cleanPayload.notes = existingEnriched.notes || '';
            }
          }
        } catch (preserveError) {
          console.warn(`⚠️ [${this.entityName}] Existing tech data could not be merged before update:`, preserveError?.message || preserveError);
        }
      }

      // Sanitize numeric fields for implants to avoid 22P02 Postgres errors
      if (tableName === 'implants') {
        if (cleanPayload.reminder_months === 'custom' || (typeof cleanPayload.reminder_months === 'string' && isNaN(Number(cleanPayload.reminder_months)))) {
          cleanPayload.reminder_months = null;
        } else if (cleanPayload.reminder_months != null) {
          const parsed = parseInt(cleanPayload.reminder_months, 10);
          cleanPayload.reminder_months = isNaN(parsed) ? null : parsed;
        }
      }

      // NOTES-ENCODING: pack ALL tech fields into notes for guaranteed Supabase persistence
      // This is CRITICAL for fields like doctor_id and commission_rate
      cleanPayload = this._encodeNotes(cleanPayload);

      // For implants: pack into tooth_data too if it's an implant
      if (tableName === 'implants') {
        const implantTechFields = ['firma', 'firma_custom', 'brend', 'diameter', 'length', 
                                    'lot_number', 'torque', 'isq', 'bone_type', 'implant_type'];
        const backupData = {};
        implantTechFields.forEach(f => {
          if (cleanPayload[f] != null && cleanPayload[f] !== '') {
            backupData[f] = cleanPayload[f];
          }
        });
        if (Object.keys(backupData).length > 0) {
          cleanPayload.tooth_data = { ...(cleanPayload.tooth_data || {}), ...backupData };
        }
      }

      let recordToUpdate = { 
        ...cleanPayload, 
        updated_date: new Date().toISOString() 
      };

      const removedCols = [];
      for (let attempt = 0; attempt < 50; attempt++) {
        try {
          const { data, error } = await supabase
            .from(tableName)
            .update(recordToUpdate)
            .eq('id', id)
            .select()
            .single();
          
          if (error) {
            // PGRST204 or 42703: Column not found — remove it and retry
            if ((error.code === 'PGRST204' || error.code === '42703') && error.message) {
              const colMatch = error.message.match(/the '(\w+)' column/) || error.message.match(/column "(\w+)"/);
              if (colMatch) {
                const badCol = colMatch[1];
                // PROTECT critical columns - never strip these
                const protectedCols = ['notes', 'tooth_data'];
                if (protectedCols.includes(badCol)) {
                  console.warn(`⚠️ [${this.entityName}] Protected column '${badCol}' NOT in DB. Using notes fallback.`);
                  removedCols.push(badCol);
                  recordToUpdate = { ...recordToUpdate };
                  delete recordToUpdate[badCol];
                  continue;
                }
                console.warn(`⚠️ [${this.entityName}] Column '${badCol}' not in DB, removing and retry...`);
                removedCols.push(badCol);
                recordToUpdate = { ...recordToUpdate };
                delete recordToUpdate[badCol];
                continue; // retry
              }
            }
            if (error.code === '23514') {
              console.error(`❌ [${this.entityName}] Check constraint failed:`, error.message);
              break;
            }
            throw error;
          }
          
          if (removedCols.length > 0) {
            console.log(`✅ Updated ${this.entityName} (removed: ${removedCols.join(', ')}):`, id);
          } else {
            console.log(`✅ Updated ${this.entityName}:`, id);
          }
          
          // Success: Save to local storage and return enriched record
          this._saveDeepLocal({ ...cleanPayload, id, ...data });
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
          return this._enrich([{ ...data, id }])[0] || data;
        } catch (error) {
          console.error(`Error updating ${this.entityName} (attempt ${attempt}):`, error);
          if (attempt === 49) throw error;
        }
      }
      throw new Error(`All retries failed for ${this.entityName} update`);
    } catch (error) {
      const fallbackRes = this._localStorageUpdate(id, payload);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
      return fallbackRes;
    }
  }

  async delete(id) {
    RequestCache.invalidate(this.entityName);
    if (!this.useSupabase) return this._localStorageDelete(id);
    
    try {
      if (this.useSupabase) {
        const { error } = await supabase
          .from(this._getTableName())
          .delete()
          .eq('id', id);
        
        if (error) {
          console.error(`Supabase delete failed for ${this.entityName}:`, error);
          if (error.code === '23503') {
             throw new Error("Bog'langan ma'lumotlar borligi sababli o'chirish mumkin emas (masalan: bemorlar uchrashuvi yoki to'lovlar).");
          }
          // If table does not exist, just delete locally
          if (error.code === '42P01' || error.code === 'PGRST205' || error.code === '404') {
             console.warn(`Table for ${this.entityName} not in DB, cleaning local.`);
          } else {
             throw error;
          }
        }
      }
      
      // Cleanup local storage
      const result = this._localStorageDelete(id);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
      return result;
    } catch (error) {
      console.error(`Error deleting ${this.entityName}:`, error);
      if (error.code === '23503' || (error.message && error.message.includes('Bog\'langan'))) {
        throw error;
      }
      const result = this._localStorageDelete(id);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
      return result;
    }
  }

  // Helper to map entity names to table names
  _getTableName() {
    const mapping = {
      'Patient': 'patients',
      'Appointment': 'appointments',
      'Payment': 'payments',
      'Service': 'services',
      'Inventory': 'inventory',
      'Lead': 'leads',
      'TreatmentPlan': 'treatment_plans',
      'Recall': 'recalls',
      'Debt': 'debts',
      'User': 'users',
      'Expense': 'expenses',
      'ToothRecord': 'tooth_records',
      'Implant': 'implants',
      'Note': 'notes',
      'Xray': 'xrays',
      'TechnicianJob': 'technician_jobs',
      'Technician': 'technicians',
      'ServiceCategory': 'service_categories',
      'Case': 'cases',
      'CaseCategory': 'case_categories'
    };
    return mapping[this.entityName] || this.entityName.toLowerCase() + 's';
  }

  async _seedDefaultServices(clinicId) {
    if (!this.useSupabase) return;
    try {
      for (const svc of DEFAULT_SERVICES_DATA) {
        await supabase.from('services').insert([{
           ...svc,
           clinic_id: clinicId,
           created_date: new Date().toISOString()
        }]);
      }
      console.log('✅ Seeded Supabase with default services');
    } catch (e) {
      console.error('Failed to seed default services', e);
    }
  }

  // localStorage fallback methods
  _getData(specificClinicId = null) {
    const clinicId = specificClinicId || this._getClinicId();
    const key = `mock_db_${clinicId}_${this.entityName}`;
    const indexedData = StaticStore.get(key) || [];
    const recoveredData = this._getDeepLocalRecords(clinicId);

    if (recoveredData.length === 0) {
      return indexedData;
    }

    const merged = [...indexedData];
    recoveredData.forEach((record) => {
      if (!merged.find(item => item.id === record.id)) {
        merged.push(record);
      }
    });

    if (merged.length !== indexedData.length) {
      StaticStore.set(key, merged);
    }

    return merged;
  }

  _setData(data, specificClinicId = null) {
    const clinicId = specificClinicId || this._getClinicId();
    const key = `mock_db_${clinicId}_${this.entityName}`;
    StaticStore.set(key, data);
  }

  _localStorageList(orderBy = '-created_date', limit = 100) {
    let data = this._getData();
    
    // Auto-seed Services if completely empty
    if (this.entityName === 'Service' && data.length === 0) {
      const clinicId = this._getClinicId();
      DEFAULT_SERVICES_DATA.forEach(svc => {
        data.push({
          ...svc,
          id: Math.random().toString(36).substring(2, 9),
          created_date: new Date().toISOString(),
          clinic_id: clinicId
        });
      });
      this._setData(data);
    }

    if (orderBy.startsWith('-')) {
      const field = orderBy.substring(1);
      data.sort((a, b) => (b[field] || '') > (a[field] || '') ? 1 : -1);
    } else {
      data.sort((a, b) => (a[orderBy] || '') > (b[orderBy] || '') ? 1 : -1);
    }
    return data.slice(0, limit);
  }

  _localStorageFilter(conditions, orderBy = null, limit = 100) {
    const specificClinicId = conditions.clinic_id || null;
    let data = this._getData(specificClinicId);
    data = data.filter(item => {
      let matches = true;
      for (const [key, val] of Object.entries(conditions)) {
        if (key === 'type' || key === 'status') {
           if (String(item[key]).toLowerCase() !== String(val).toLowerCase()) matches = false;
        } else if (item[key] !== val) {
           matches = false;
        }
      }
      return matches;
    });
    
    if (orderBy) {
      if (orderBy.startsWith('-')) {
        const field = orderBy.substring(1);
        data.sort((a, b) => (b[field] || '') > (a[field] || '') ? 1 : -1);
      } else {
        data.sort((a, b) => (a[orderBy] || '') > (b[orderBy] || '') ? 1 : -1);
      }
    }
    
    return data.slice(0, limit);
  }

  _localStorageCreate(payload) {
    const specificClinicId = payload.clinic_id || null;
    const data = this._getData(specificClinicId);

    // Auto-calculate debt_amount for local storage Payment
    if (this.entityName === 'Payment' && payload.patient_id) {
      try {
        const patientsData = StaticStore.get(`mock_db_${payload.clinic_id || this._getClinicId()}_Patient`) || [];
        const patientObj = patientsData.find(p => p.id === payload.patient_id);
        const currentDebt = Number(patientObj?.total_debt) || 0;
        const type = String(payload.type || 'Income').toLowerCase();
        const amount = Math.abs(Number(payload.amount) || 0);
        
        let newDebt = currentDebt;
        if (type === 'income' || type === 'discount') {
          newDebt = Math.max(0, currentDebt - amount);
        } else if (type === 'debt' || type === 'refund') {
          newDebt = currentDebt + amount;
        }
        payload.debt_amount = newDebt;
      } catch (err) {
        console.warn('Failed to pre-calculate payment debt_amount locally:', err);
      }
    }

    const newRecord = {
      ...payload,
      id: Math.random().toString(36).substring(2, 9),
      created_date: new Date().toISOString(),
      clinic_id: payload.clinic_id || this._getClinicId()
    };
    data.push(newRecord);
    this._setData(data, specificClinicId);
    return newRecord;
  }

  _localStorageUpdate(id, payload) {
    const data = this._getData();
    const index = data.findIndex(i => i.id === id);
    if (index >= 0) {
      data[index] = { ...data[index], ...payload };
      this._setData(data);
      return data[index];
    }
    return null;
  }

  _localStorageDelete(id) {
    let data = this._getData();
    data = data.filter(i => i.id !== id);
    this._setData(data);
    
    // Additional cleanup for Users (removes from system_users/auth list)
    if (this.entityName === 'User') {
      try {
        const sysUsersRaw = localStorage.getItem('system_users');
        if (sysUsersRaw) {
          const sysUsers = JSON.parse(sysUsersRaw);
          const filtered = sysUsers.filter(u => u.id !== id);
          if (filtered.length !== sysUsers.length) {
            localStorage.setItem('system_users', JSON.stringify(filtered));
          }
        }
      } catch (e) { /* ignore */ }
    }
    
    try {
      localStorage.removeItem(`${this.entityName.toLowerCase()}_full_data_${id}`);
    } catch(e) { /* ignore */ }
    
    console.log(`🗑️ Local cleanup for ${this.entityName}:`, id);
    return true;
  }

  // Telegram Notification Logic
  async _notifyTelegram(lead) {
    try {
      // 1. Get Clinic Info
      const clinics = await base44.clinic.getAll();
      const clinic = clinics.find(c => c.id === lead.clinic_id);
      if (!clinic) return;

      const botConfigs = await base44.entities.BotConfig.list();
      const config = botConfigs.find(bc => bc.clinic_id === lead.clinic_id && bc.isActive);
      
      if (config && config.botToken) {
        const targetChatId = config.leadChatId || config.lead_chat_id;
        if (targetChatId) {
          console.log('📤 Sending Telegram notification for lead:', lead.id);
          const message = formatLeadMessage(clinic.name, lead);
          await sendTelegramMessage(config.botToken, targetChatId, message);
        }
      }
    } catch (err) {
      console.warn('Telegram notification failed:', err);
    }
  }
}

// Default users for each clinic (initial demo users only)
const DEFAULT_USERS = [
  { id: 'user-1', clinic_id: 'ava-dent', username: 'admin', email: 'admin@avadent.uz', password: 'ava7', name: 'Administrator', role: 'admin', commission_rate: 0 },
  { id: 'user-2', clinic_id: 'ava-dent', username: 'doctor', email: 'doctor@avadent.uz', password: 'doctor123', name: 'Shifokor', role: 'doctor', commission_rate: 30 },
  { id: 'user-3', clinic_id: 'default_clinic', username: 'admin', email: 'admin@demo.uz', password: 'admin', name: 'Demo Admin', role: 'admin', commission_rate: 0 },
  { id: 'user-4', clinic_id: 'default_clinic', username: 'demo', email: 'doctor@demo.uz', password: 'demo', name: 'Demo User', role: 'doctor', commission_rate: 30 }
];

export const DEFAULT_SERVICES_DATA = [
  // TERAPIYA (ENDO + PLOMBA)
  { name: 'Kanal davolash (1 kanal)', category: 'TERAPIYA (ENDO + PLOMBA)', price: 150000, duration: 45, is_active: true },
  { name: 'Kanal davolash (3 kanal)', category: 'TERAPIYA (ENDO + PLOMBA)', price: 400000, duration: 60, is_active: true },
  { name: 'Fotopolimer plomba (estetik)', category: 'TERAPIYA (ENDO + PLOMBA)', price: 250000, duration: 40, is_active: true },
  { name: 'Karies davolash (oddiy)', category: 'TERAPIYA (ENDO + PLOMBA)', price: 200000, duration: 30, is_active: true },
  { name: 'Pulpotomiya', category: 'TERAPIYA (ENDO + PLOMBA)', price: 450000, duration: 60, is_active: true },
  { name: 'Shtif qo’yish', category: 'TERAPIYA (ENDO + PLOMBA)', price: 200000, duration: 30, is_active: true },
  { name: 'Rentgen (RVG)', category: 'TERAPIYA (ENDO + PLOMBA)', price: 30000, duration: 10, is_active: true },
  
  // RESTAVRATSIYA
  { name: 'Badiiy restavratsiya (1 ta tish)', category: 'RESTAVRATSIYA', price: 450000, duration: 60, is_active: true },
  { name: 'Tish anatomiyasini tiklash', category: 'RESTAVRATSIYA', price: 500000, duration: 60, is_active: true },

  // ORTOPEDIYA
  { name: 'Metallokeramika karonka', category: 'ORTOPEDIYA', price: 800000, duration: 60, is_active: true },
  { name: 'Sirkoniy karonka', category: 'ORTOPEDIYA', price: 1800000, duration: 60, is_active: true },
  { name: 'Vinir (keramika)', category: 'ORTOPEDIYA', price: 2500000, duration: 90, is_active: true },
  { name: 'olinadigan protez', category: 'ORTOPEDIYA', price: 1200000, duration: 45, is_active: true },

  // XIRURGIYA
  { name: 'Tish olish (oddiy)', category: 'XIRURGIYA', price: 150000, duration: 20, is_active: true },
  { name: 'Donolik tishini olish', category: 'XIRURGIYA', price: 600000, duration: 45, is_active: true },
  { name: 'Implantat o\'rnatish', category: 'XIRURGIYA', price: 4000000, duration: 60, is_active: true },
  { name: 'Anesteziya', category: 'XIRURGIYA', price: 30000, duration: 10, is_active: true },

  // ORTODONTIYA
  { name: 'Metall breket tizimi', category: 'ORTODONTIYA', price: 5000000, duration: 60, is_active: true },
  { name: 'Keramik breket tizimi', category: 'ORTODONTIYA', price: 7000000, duration: 60, is_active: true },
  { name: 'Reteyner o\'rnatish', category: 'ORTODONTIYA', price: 400000, duration: 30, is_active: true },

  // GIGIENA VA PROFILAKTIKA
  { name: 'Tish tozalash (Air Flow)', category: 'GIGIENA VA PROFILAKTIKA', price: 200000, duration: 30, is_active: true },
  { name: 'Ultratovushli tozalash (Skaler)', category: 'GIGIENA VA PROFILAKTIKA', price: 180000, duration: 30, is_active: true },
  { name: 'Ftorlash va profilaktika', category: 'GIGIENA VA PROFILAKTIKA', price: 100000, duration: 20, is_active: true },

  // ESTETIK STOMATOLOGIYA
  { name: 'Tishlarni oqartirish (Bleaching)', category: 'ESTETIK STOMATOLOGIYA', price: 1200000, duration: 60, is_active: true },
  { name: 'E-Max Vinir', category: 'ESTETIK STOMATOLOGIYA', price: 2200000, duration: 60, is_active: true },

  // BOLALAR STOMATOLOGIYASI
  { name: 'Bolalar tishini davolash', category: 'BOLALAR STOMATOLOGIYASI', price: 150000, duration: 30, is_active: true },
  { name: 'Sut tishini olish', category: 'BOLALAR STOMATOLOGIYASI', price: 80000, duration: 15, is_active: true },

  // IMPLANTATSIYA
  { name: 'Implantat (Janubiy Koreya)', category: 'IMPLANTATSIYA', price: 3500000, duration: 60, is_active: true },
  { name: 'Sinus lifting', category: 'IMPLANTATSIYA', price: 2000000, duration: 60, is_active: true }
];

// Initialize system if empty
const initializeSystem = () => {
  const stored = localStorage.getItem('system_users');
  if (!stored) {
    localStorage.setItem('system_users', JSON.stringify(DEFAULT_USERS));
    console.log('✅ System initialized with default users');
  }

  // Auto-upgrade existing basic sessions to pro
  if (localStorage.getItem('clinic_plan') === 'basic') {
    localStorage.setItem('clinic_plan', 'pro');
    console.log('✅ Auto-upgraded local session from basic to pro');
  }

  // Auto-upgrade existing mock clinics in local storage to pro
  const clinicsStored = localStorage.getItem('system_clinics');
  if (clinicsStored) {
    try {
      const clinics = JSON.parse(clinicsStored);
      let updated = false;
      clinics.forEach(c => {
        if (!c.plan || c.plan === 'basic') {
          c.plan = 'pro';
          updated = true;
        }
      });
      if (updated) {
        localStorage.setItem('system_clinics', JSON.stringify(clinics));
        console.log('✅ Auto-upgraded local clinics to pro');
      }
    } catch (e) {}
  }

  // Spelling Correction & Data Integrity Migration (UZ/RU/EN typos cleanup in local databases)
  try {
    StaticStore.flush(); // Flush memory cache before executing migration
    const capitalizeName = (name) => {
      if (!name) return "";
      return name
        .split(' ')
        .map(spacePart => {
          return spacePart
            .split('-')
            .map(dashPart => {
              if (!dashPart) return "";
              return dashPart.charAt(0).toUpperCase() + dashPart.slice(1).toLowerCase();
            })
            .join('-');
        })
        .join(' ');
    };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('mock_db_') || key.startsWith('base44_'))) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          
          let data = JSON.parse(raw);
          if (!Array.isArray(data)) continue;
          
          let changed = false;

          // A. If the key is for Patients, fix name and address capitalization
          if (key.includes('_Patient')) {
            data = data.map(p => {
              if (!p) return p;
              let pChanged = false;
              
              if (p.full_name) {
                const newFull = capitalizeName(p.full_name);
                if (newFull !== p.full_name) {
                  p.full_name = newFull;
                  pChanged = true;
                }
              }
              if (p.first_name) {
                const newFirst = capitalizeName(p.first_name);
                if (newFirst !== p.first_name) {
                  p.first_name = newFirst;
                  pChanged = true;
                }
              }
              if (p.last_name) {
                const newLast = capitalizeName(p.last_name);
                if (newLast !== p.last_name) {
                  p.last_name = newLast;
                  pChanged = true;
                }
              }
              if (p.address) {
                const newAddr = capitalizeName(p.address);
                if (newAddr !== p.address) {
                  p.address = newAddr;
                  pChanged = true;
                }
              }
              if (p.notes) {
                const oldN = p.notes;
                const newN = oldN
                  .replace(/⚠️ MUHIM OGOHLANTIRISH:\s*ikkiqat\s*\n?\s*Izoh:\s*ikkiqat/gi, '')
                  .replace(/⚠️ MUHIM OGOHLANTIRISH:\s*ikkiqat\s*Izoh:\s*ikkiqat/gi, '')
                  .trim();
                if (newN !== oldN) {
                  p.notes = newN;
                  pChanged = true;
                }
              }
              if (pChanged) changed = true;
              return p;
            });
          }

          // B. If the key is for Appointments, fix name capitalization and service name typos
          if (key.includes('_Appointment')) {
            data = data.map(appt => {
              if (!appt) return appt;
              let apptChanged = false;
              if (appt.patient_name) {
                const newName = capitalizeName(appt.patient_name);
                if (newName !== appt.patient_name) {
                  appt.patient_name = newName;
                  apptChanged = true;
                }
              }
              if (appt.service_name) {
                const oldSName = appt.service_name;
                let newSName = oldSName
                  .replace(/1 ildizli tihsalr/gi, "1 ildizli tishni davolash")
                  .replace(/Aqil Tish olish3/gi, "Aql tishini olish")
                  .replace(/Siyomniy protez/gi, "olinadigan protez")
                  .replace(/Otdelka \(otbelivanie\)/gi, "Tishlarni oqartirish")
                  .replace(/Otdelka/gi, "Tishlarni oqartirish")
                  .replace(/Briketlar/g, "Breketlar")
                  .replace(/briketlar/g, "breketlar")
                  .replace(/Kostny blok/gi, "Suyak bloki")
                  .replace(/Yatratildi/gi, "Yaratildi");
                if (newSName !== oldSName) {
                  appt.service_name = newSName;
                  apptChanged = true;
                }
              }
              if (apptChanged) changed = true;
              return appt;
            });
          }

          // C. If the key is for TreatmentPlans, fix patient name, plan name, and service typos
          if (key.includes('_TreatmentPlan')) {
            data = data.map(tp => {
              if (!tp) return tp;
              let tpChanged = false;
              if (tp.patient_name) {
                const newName = capitalizeName(tp.patient_name);
                if (newName !== tp.patient_name) {
                  tp.patient_name = newName;
                  tpChanged = true;
                }
              }
              if (tp.name) {
                const newName = capitalizeName(tp.name);
                if (newName !== tp.name) {
                  tp.name = newName;
                  tpChanged = true;
                }
              }
              if (Array.isArray(tp.services)) {
                tp.services = tp.services.map(subSvc => {
                  if (subSvc && subSvc.name) {
                    const oldSubName = subSvc.name;
                    let newSubName = oldSubName
                      .replace(/1 ildizli tihsalr/gi, "1 ildizli tishni davolash")
                      .replace(/Aqil Tish olish3/gi, "Aql tishini olish")
                      .replace(/Siyomniy protez/gi, "olinadigan protez")
                      .replace(/Otdelka \(otbelivanie\)/gi, "Tishlarni oqartirish")
                      .replace(/Otdelka/gi, "Tishlarni oqartirish")
                      .replace(/Briketlar/g, "Breketlar")
                      .replace(/briketlar/g, "breketlar")
                      .replace(/Kostny blok/gi, "Suyak bloki")
                      .replace(/Yatratildi/gi, "Yaratildi");
                    if (newSubName !== oldSubName) {
                      subSvc.name = newSubName;
                      tpChanged = true;
                    }
                  }
                  return subSvc;
                });
              }
              if (tpChanged) changed = true;
              return tp;
            });
          }

          // CD. If the key is for Services, normalize English category names to Uzbek uppercase
          if (key.includes('_Service')) {
            data = data.map(s => {
              if (!s || !s.category) return s;
              let sChanged = false;
              const catUpper = s.category.toUpperCase().trim();
              let newCat = s.category;

              if (catUpper === 'THERAPY' || catUpper === 'TERAPIYA( ENDO +PLOMBA)') newCat = 'TERAPIYA (ENDO + PLOMBA)';
              else if (catUpper === 'SURGERY') newCat = 'XIRURGIYA';
              else if (catUpper === 'HYGIENE') newCat = 'GIGIENA VA PROFILAKTIKA';
              else if (catUpper === 'IMPLANTOLOGY') newCat = 'IMPLANTATSIYA';
              else if (catUpper === 'ORTHOPEDICS') newCat = 'ORTOPEDIYA';
              else if (catUpper === 'ESTHETICS') newCat = 'ESTETIK STOMATOLOGIYA';
              else if (catUpper === 'PEDIATRICS') newCat = 'BOLALAR STOMATOLOGIYASI';

              if (newCat !== s.category) {
                s.category = newCat;
                sChanged = true;
              }
              if (sChanged) changed = true;
              return s;
            });
          }

          // D. If the key is for Recalls, fix patient name capitalization
          if (key.includes('_Recall')) {
            data = data.map(rc => {
              if (!rc) return rc;
              let rcChanged = false;
              if (rc.patient_name) {
                const newName = capitalizeName(rc.patient_name);
                if (newName !== rc.patient_name) {
                  rc.patient_name = newName;
                  rcChanged = true;
                }
              }
              if (rcChanged) changed = true;
              return rc;
            });
          }

          // E. General corrections for Services, Leads, and general fields
          data = data.map(item => {
            if (!item) return item;
            let itemChanged = false;
            
            if (item.name && !key.includes('_Patient') && !key.includes('_TreatmentPlan')) {
              const oldName = item.name;
              let newName = oldName
                .replace(/1 ildizli tihsalr/gi, "1 ildizli tishni davolash")
                .replace(/Aqil Tish olish3/gi, "Aql tishini olish")
                .replace(/Siyomniy protez/gi, "olinadigan protez")
                .replace(/Otdelka \(otbelivanie\)/gi, "Tishlarni oqartirish")
                .replace(/Otdelka/gi, "Tishlarni oqartirish")
                .replace(/Briketlar/g, "Breketlar")
                .replace(/briketlar/g, "breketlar")
                .replace(/Kostny blok/gi, "Suyak bloki")
                .replace(/Yatratildi/gi, "Yaratildi");
              if (newName !== oldName) {
                item.name = newName;
                itemChanged = true;
              }
            }

            if (item.notes) {
              const oldNotes = item.notes;
              let newNotes = oldNotes
                .replace(/1 ildizli tihsalr/gi, "1 ildizli tishni davolash")
                .replace(/Aqil Tish olish3/gi, "Aql tishini olish")
                .replace(/Siyomniy protez/gi, "olinadigan protez")
                .replace(/Otdelka \(otbelivanie\)/gi, "Tishlarni oqartirish")
                .replace(/Otdelka/gi, "Tishlarni oqartirish")
                .replace(/Briketlar/g, "Breketlar")
                .replace(/briketlar/g, "breketlar")
                .replace(/Kostny blok/gi, "Suyak bloki")
                .replace(/Yatratildi/gi, "Yaratildi");
              if (newNotes !== oldNotes) {
                item.notes = newNotes;
                itemChanged = true;
              }
            }

            if (item.interest) {
              const oldInterest = item.interest;
              let newInterest = oldInterest
                .replace(/Briketlar/g, "Breketlar")
                .replace(/briketlar/g, "breketlar")
                .replace(/Yatratildi/gi, "Yaratildi");
              if (newInterest !== oldInterest) {
                item.interest = newInterest;
                itemChanged = true;
              }
            }

            if (itemChanged) changed = true;
            return item;
          });

          if (changed) {
            localStorage.setItem(key, JSON.stringify(data));
            StaticStore.set(key, data); // Keep memory cache in sync
            console.log(`✨ Database correction applied: ${key}`);
          }
        } catch (e) {
          // ignore
        }
      }
    }
  } catch (e) {
    console.error('Migration failed:', e);
  }
};

// Auto-initialize on import
initializeSystem();

// System Admin (Owner) Storage
const DEFAULT_CLINICS = [
  { 
    id: 'ava-dent', 
    name: 'Ava Dent Clinic', 
    password: 'ava7', 
    logo: '/logo.png', 
    expires_at: '2026-12-31', 
    status: 'Active',
    created_at: '2024-01-01',
    monthly_fee: 189000,
    last_payment_date: '2025-10-01',
    plan: 'pro'
  },
  { 
    id: 'default_clinic', 
    name: 'Demo Clinic', 
    password: 'admin', 
    logo: null, 
    expires_at: '2030-01-01', 
    status: 'Active',
    created_at: '2024-01-01',
    monthly_fee: 189000,
    last_payment_date: new Date().toISOString().split('T')[0],
    plan: 'pro'
  }
];

export const base44 = {
  entities: {
    Patient: new HybridEntityLoader('Patient'),
    Appointment: new HybridEntityLoader('Appointment'),
    Payment: new HybridEntityLoader('Payment'),
    Service: new HybridEntityLoader('Service'),
    Inventory: new HybridEntityLoader('Inventory'),
    Lead: new HybridEntityLoader('Lead'),
    TreatmentPlan: new HybridEntityLoader('TreatmentPlan'),
    Recall: new HybridEntityLoader('Recall'),
    Debt: new HybridEntityLoader('Debt'),
    User: new HybridEntityLoader('User'),
    Expense: new HybridEntityLoader('Expense'),
    ToothRecord: new HybridEntityLoader('ToothRecord'),
    Implant: new HybridEntityLoader('Implant'),
    Note: new HybridEntityLoader('Note'),
    Xray: new HybridEntityLoader('Xray'),
    TechnicianJob: new HybridEntityLoader('TechnicianJob'),
    Technician: new HybridEntityLoader('Technician'),
    ServiceCategory: new HybridEntityLoader('ServiceCategory'),
    BotConfig: new HybridEntityLoader('BotConfig'),
    TelegramBooking: new HybridEntityLoader('TelegramBooking'),
    Case: new HybridEntityLoader('Case'),
    CaseCategory: new HybridEntityLoader('CaseCategory')
  },
  
  get: async (path, options = {}) => {
    const entityName = path.replace(/^\//, '').split('/')[0];
    const id = path.split('/')[2];
    
    if (base44.entities[entityName]) {
      if (id) {
         // This is a get-by-id, but we'll just filter for now
         const data = await base44.entities[entityName].filter({ id });
         return { data: data[0] || null };
      }
      const data = await base44.entities[entityName].list();
      return { data };
    }
    return { data: [] };
  },

  post: async (path, data) => {
    const entityName = path.replace(/^\//, '').split('/')[0];
    if (base44.entities[entityName]) {
      const res = await base44.entities[entityName].create(data);
      return { data: res };
    }
    return { data: null };
  },

  patch: async (path, data) => {
    const parts = path.replace(/^\//, '').split('/');
    const entityName = parts[0];
    const id = parts[1];
    if (base44.entities[entityName] && id) {
      const res = await base44.entities[entityName].update(id, data);
      return { data: res };
    }
    return { data: null };
  },
  
  clinic: {
    // ── Klinika qo'shimcha maydonlarini 'logo' ustuniga prefix sifatida encode ──
    // Supabase clinics jadvalida FAQAT bular bor:
    //   id, name, password, logo, expires_at, status,
    //   created_at, monthly_fee, last_payment_date, plan
    // Qolgan maydonlarni logo ustuniga '[EXT_DATA]{...}[/EXT_DATA]' prefix
    // sifatida encode qilamiz. Logo base64 shu prefixdan keyin davom etadi.
    _EXTRA_FIELDS: [
      'slug', 'is_public', 'description', 'address', 'working_hours',
      'telegram_link', 'instagram_link', 'whatsapp_link', 'yandex_map_link',
      'phone', 'subtitle', 'api_key'
    ],

    _encodeClinicNotes(clinic) {
      const extra = {};
      this._EXTRA_FIELDS.forEach(f => {
        if (clinic[f] !== undefined && clinic[f] !== null && clinic[f] !== '') {
          extra[f] = clinic[f];
        }
      });
      // Faqat DB ustunlari payloadda bo'ladi
      const payload = {};
      ['id','name','status','created_at','monthly_fee','last_payment_date','plan'].forEach(f => {
        if (clinic[f] !== undefined) payload[f] = clinic[f];
      });
      // logo = '[EXT]{...}[/EXT]base64...' yoki oddiy base64
      const rawLogo = typeof clinic.logo === 'string' && clinic.logo.startsWith('[EXT]')
        ? clinic.logo.replace(/^\[EXT\].*?\[\/EXT\]/, '') // eski encodeni tozalash
        : (clinic.logo || '');
      payload.logo = Object.keys(extra).length > 0
        ? '[EXT]' + JSON.stringify(extra) + '[/EXT]' + rawLogo
        : rawLogo;
      return payload;
    },

    _decodeClinicNotes(clinic) {
      if (!clinic) return clinic;
      const logo = clinic.logo || '';
      if (!logo.startsWith('[EXT]')) return clinic;
      try {
        const end = logo.indexOf('[/EXT]');
        if (end === -1) return clinic;
        const extra = JSON.parse(logo.substring(5, end)); // 5 = '[EXT]'.length
        const realLogo = logo.substring(end + 6); // 6 = '[/EXT]'.length
        return { ...clinic, ...extra, logo: realLogo };
      } catch { return clinic; }
    },
    // ──────────────────────────────────────────────────────────────────────

    getAll: async function() {
      if (!import.meta.env.VITE_SUPABASE_URL) {
        const stored = localStorage.getItem('system_clinics');
        if (!stored) {
          localStorage.setItem('system_clinics', JSON.stringify(DEFAULT_CLINICS));
          return DEFAULT_CLINICS;
        }
        return JSON.parse(stored);
      }
      
      try {
        const clinics = await db.clinics.getAll();
        if (clinics.length === 0) {
          // Insert default clinics
          for (const clinic of DEFAULT_CLINICS) {
            await db.clinics.create(this._encodeClinicNotes(clinic));
          }
          return DEFAULT_CLINICS;
        }
        // Decode notes to restore extra fields
        const decoded = clinics.map(c => this._decodeClinicNotes(c));
        // Also keep localStorage in sync
        try { localStorage.setItem('system_clinics', JSON.stringify(decoded)); } catch {}
        return decoded;
      } catch (error) {
        console.error('Error fetching clinics from Supabase:', error);
        // Fallback to localStorage
        const stored = localStorage.getItem('system_clinics');
        return stored ? JSON.parse(stored) : DEFAULT_CLINICS;
      }
    },

    saveAll: async function(clinics) {
      // Always keep localStorage in sync immediately
      try { localStorage.setItem('system_clinics', JSON.stringify(clinics)); } catch {}

      if (!import.meta.env.VITE_SUPABASE_URL) return;
      
      try {
        // Update or insert each clinic — encode extra fields into notes
        for (const clinic of clinics) {
          const payload = this._encodeClinicNotes(clinic);
          const { data: existing } = await supabase.from('clinics').select('id').eq('id', clinic.id).single();
          if (existing) {
            await db.clinics.update(clinic.id, payload);
          } else {
            await db.clinics.create(payload);
          }
        }
        console.log('✅ Clinics saved to Supabase');
      } catch (error) {
        console.error('Error saving clinics to Supabase:', error);
        localStorage.setItem('system_clinics', JSON.stringify(clinics));
      }
    },

    createClinic: async (clinicData, adminData) => {
      // 1. Check if clinic ID already taken
      const existingClinics = await base44.clinic.getAll();
      if (existingClinics.find(c => c.id.toLowerCase() === clinicData.id.toLowerCase())) {
        throw new Error('Ushbu Klinika ID band!');
      }

      const newClinic = {
        ...clinicData,
        status: clinicData.status || 'Active',
        created_at: new Date().toISOString(),
        plan: clinicData.plan || 'pro'
      };

      // 2. ALWAYS save clinic to localStorage FIRST (instant availability)
      try {
        const localClinics = JSON.parse(localStorage.getItem('system_clinics') || '[]');
        localClinics.push(newClinic);
        localStorage.setItem('system_clinics', JSON.stringify(localClinics));
        console.log('✅ Clinic saved to localStorage:', newClinic.id);
      } catch (e) {
        console.error('localStorage clinic save failed:', e);
      }

      // 3. Save admin user ALWAYS to localStorage FIRST  
      const fullAdminData = {
        ...adminData,
        id: adminData.id || 'user-' + Math.random().toString(36).substring(2, 11),
        clinic_id: newClinic.id,
        role: 'admin',
        commission_rate: 0,
        name: adminData.name || adminData.username,
        full_name: adminData.full_name || adminData.name || adminData.username,
        created_at: new Date().toISOString()
      };

      try {
        const sysUsers = JSON.parse(localStorage.getItem('system_users') || '[]');
        const alreadyExists = sysUsers.find(u => u.username === fullAdminData.username && u.clinic_id === fullAdminData.clinic_id);
        if (!alreadyExists) {
          sysUsers.push(fullAdminData);
          localStorage.setItem('system_users', JSON.stringify(sysUsers));
          console.log('✅ Admin user saved to localStorage:', fullAdminData.username, '| Clinic:', fullAdminData.clinic_id);
        }
      } catch (e) {
        console.error('localStorage admin user save failed:', e);
      }

      // 4. Also try Supabase (non-blocking — failures are OK)
      if (import.meta.env.VITE_SUPABASE_URL) {
        // Save clinic to Supabase
        try {
          await db.clinics.create(newClinic);
          console.log('✅ Clinic saved to Supabase:', newClinic.id);
        } catch (e) {
          console.warn('Supabase clinic save failed (localStorage fallback active):', e.message);
        }

        // Save admin user to Supabase
        try {
          let record = { ...fullAdminData };
          for (let attempt = 0; attempt < 20; attempt++) {
            const { data, error } = await supabase.from('users').insert([record]).select().single();
            if (error) {
              if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
                const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
                if (colMatch) { delete record[colMatch[1]]; continue; }
              }
              if (error.code === '23505') { console.warn('Admin user already in Supabase'); break; }
              console.warn('Supabase admin user save failed:', error.message);
              break;
            }
            console.log('✅ Admin user saved to Supabase:', fullAdminData.username);
            break;
          }
        } catch (e) {
          console.warn('Supabase admin user save failed (localStorage fallback active):', e.message);
        }
      }

      return newClinic;
    },


    getCurrentClinic: async () => {
      const id = localStorage.getItem('current_clinic_id') || localStorage.getItem('clinic_id') || 'default_clinic';
      const clinics = await base44.clinic.getAll();
      let current = clinics.find(c => c.id === id) || clinics.find(c => c.id === 'default_clinic');
      if (!current) {
        current = { id, name: 'Dental Clinic', status: 'Active' };
      }
      // If the database record doesn't have api_key, look up local storage
      const localApiKeyKey = `clinic_api_key_${current.id}`;
      if (!current.api_key) {
        current.api_key = localStorage.getItem(localApiKeyKey);
      }
      if (!current.api_key) {
        const generatedKey = 'sec_live_' + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
        current.api_key = generatedKey;
        localStorage.setItem(localApiKeyKey, generatedKey);
        try {
          await base44.clinic.updateClinic(current.id, { api_key: generatedKey });
        } catch (e) { console.warn('Could not auto-save generated api_key:', e); }
      }
      return current;
    },

    updateClinic: async function(id, dataToUpdate) {
      try {
        if (dataToUpdate.api_key) {
          localStorage.setItem(`clinic_api_key_${id}`, dataToUpdate.api_key);
        }
        const clinics = await base44.clinic.getAll();
        const index = clinics.findIndex(c => c.id === id);
        if (index !== -1) {
          clinics[index] = { ...clinics[index], ...dataToUpdate };
        } else if (clinics.length > 0) {
          clinics[0] = { ...clinics[0], ...dataToUpdate, id: id || clinics[0].id };
        } else {
          clinics.push({ id: id || 'default_clinic', name: 'Dental Clinic', ...dataToUpdate });
        }
        
        // Save merged clinics to localStorage IMMEDIATELY for instant persistence
        try {
          localStorage.setItem('system_clinics', JSON.stringify(clinics));
          const currentUpdated = clinics.find(c => c.id === id) || clinics[0];
          if (currentUpdated) {
            localStorage.setItem('clinic_settings', JSON.stringify(currentUpdated));
          }
        } catch(e) {}

        // Save to Supabase (encode extra fields into notes)
        await base44.clinic.saveAll(clinics);
      } catch (error) {
        console.error('Error updating clinic:', error);
      }
    },

    
    setCurrent: (id) => {
      localStorage.setItem('current_clinic_id', id);
      window.location.reload();
    },

    isValid: async (id) => {
      if (!import.meta.env.VITE_SUPABASE_URL) {
        const clinics = base44.clinic.getAll();
        return Array.isArray(clinics) ? clinics.find(c => c.id === id) : null;
      }
      
      try {
        const clinic = await db.clinics.getById(id);
        return clinic;
      } catch (error) {
        console.error('Error validating clinic:', error);
        return null;
      }
    },

    logout: () => {
      localStorage.removeItem('current_clinic_id');
      localStorage.removeItem('is_authenticated');
      localStorage.removeItem('user_id');
      localStorage.removeItem('user_name');
      localStorage.removeItem('user_role');
      window.location.reload();
    }
  },

  // User authentication and management
  auth: {
    // Get all users for a clinic
    getUsers: async (clinicId) => {
      try {
        const normId = clinicId?.toLowerCase().replace(/-/g, '');
        
        // 1. Fetch from all sources
        let supabaseUsers = [];
        if (import.meta.env.VITE_SUPABASE_URL) {
          const { data, error } = await supabase.from('users').select('*');
          if (!error && data) {
             supabaseUsers = data.filter(u => u.clinic_id?.toLowerCase().replace(/-/g, '') === normId);
          }
        }

        const sysUsers = JSON.parse(localStorage.getItem('system_users') || '[]');
        const mockUsers = JSON.parse(localStorage.getItem(`mock_db_${clinicId}_User`) || '[]');
        const mockUsersAlt = JSON.parse(localStorage.getItem(`mock_db_${clinicId?.replace(/-/g, '')}_User`) || '[]');

        const realUsers = [...supabaseUsers, ...mockUsers, ...mockUsersAlt];
        const uniqueMap = new Map();
        
        // 2. If we have REAL users, we ignore the DEFAULT demo users
        const sources = realUsers.length > 0 ? realUsers : [...realUsers, ...sysUsers];

        sources.forEach(u => {
          const uClinicNorm = u.clinic_id?.toLowerCase().replace(/-/g, '');
          if (uClinicNorm === normId) {
            uniqueMap.set(u.id || u.username, u);
          }
        });

        const merged = Array.from(uniqueMap.values());
        const userLoader = new HybridEntityLoader('User');
        const enriched = userLoader._enrich(merged);
        
        // If still empty, return filtered DEFAULT_USERS
        if (enriched.length === 0) {
          return userLoader._enrich(DEFAULT_USERS.filter(u => u.clinic_id?.toLowerCase().replace(/-/g, '') === normId));
        }

        return enriched;
      } catch (error) {
        console.error('Error in getUsers prioritization:', error);
        const userLoader = new HybridEntityLoader('User');
        return userLoader._enrich(DEFAULT_USERS.filter(u => u.clinic_id?.toLowerCase().replace(/-/g, '') === clinicId?.toLowerCase().replace(/-/g, '')));
      }
    },

    // Get all users (for super admin)
    getAllUsers: async () => {
      if (!import.meta.env.VITE_SUPABASE_URL) {
        const stored = localStorage.getItem('system_users');
        if (!stored) {
          localStorage.setItem('system_users', JSON.stringify(DEFAULT_USERS));
          return DEFAULT_USERS;
        }
        return JSON.parse(stored);
      }
      
      try {
        const users = await db.users.getAll();
        if (users.length === 0) {
          // Insert default users
          for (const user of DEFAULT_USERS) {
            await db.users.create(user);
          }
          return DEFAULT_USERS;
        }
        return users;
      } catch (error) {
        console.error('Error fetching users from Supabase:', error);
        // Fallback to localStorage
        const stored = localStorage.getItem('system_users');
        return stored ? JSON.parse(stored) : DEFAULT_USERS;
      }
    },

    // Get single user by ID — tez va samarali (faqat 1 qator DB so'rov)
    getUserById: async (userId) => {
      if (!userId) return null;

      // 1. Avval cache'dan tekshir (5 daqiqa davomida qayta so'rov ketmaydi)
      const cacheKey = `User:byId:${userId}`;
      const cached = RequestCache.get(cacheKey);
      if (cached) return cached;

      const userLoader = new HybridEntityLoader('User');

      if (!import.meta.env.VITE_SUPABASE_URL) {
        // localStorage fallback
        const stored = localStorage.getItem('system_users');
        const users = stored ? JSON.parse(stored) : DEFAULT_USERS;
        return users.find(u => u.id === userId) || null;
      }

      const promise = (async () => {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

          if (error || !data) {
            // Fallback: localStorage'dan qidirish
            const stored = localStorage.getItem('system_users');
            const users = stored ? JSON.parse(stored) : DEFAULT_USERS;
            return users.find(u => u.id === userId) || null;
          }

          // Tech fields ni decode qilib qaytarish
          return userLoader._decodeNotes(data);
        } catch (err) {
          console.error('[getUserById] Error:', err);
          const stored = localStorage.getItem('system_users');
          const users = stored ? JSON.parse(stored) : DEFAULT_USERS;
          return users.find(u => u.id === userId) || null;
        }
      })();

      return RequestCache.set(cacheKey, promise);
    },

    // Save users
    saveUsers: async (users) => {
      if (!import.meta.env.VITE_SUPABASE_URL) {
        localStorage.setItem('system_users', JSON.stringify(users));
        console.log('✅ Users saved to localStorage:', users.length, 'users');
        return;
      }
      
      try {
        // Update or insert each user
        for (const user of users) {
          const existing = await supabase.from('users').select('id').eq('id', user.id).single();
          if (existing.data) {
            await db.users.update(user.id, user);
          } else {
            await db.users.create(user);
          }
        }
        console.log('✅ Users saved to Supabase:', users.length, 'users');
      } catch (error) {
        console.error('Error saving users to Supabase:', error);
        localStorage.setItem('system_users', JSON.stringify(users));
      }
    },

    // Add new user - saves to BOTH Supabase AND localStorage for reliable login
    addUser: async (userData) => {
      const newUser = {
        ...userData,
        id: userData.id || 'user-' + Math.random().toString(36).substring(2, 11),
        name: userData.name || userData.full_name || userData.username,
        full_name: userData.full_name || userData.name || userData.username,
        created_at: new Date().toISOString()
      };

      // ALWAYS save to localStorage first (guaranteed fallback for login)
      try {
        const existing = JSON.parse(localStorage.getItem('system_users') || '[]');
        const alreadyExists = existing.find(u => u.username === newUser.username && u.clinic_id === newUser.clinic_id);
        if (!alreadyExists) {
          existing.push(newUser);
          localStorage.setItem('system_users', JSON.stringify(existing));
          console.log('✅ User saved to localStorage:', newUser.username);
        }
      } catch (e) {
        console.error('localStorage save failed:', e);
      }

      // Also save to Supabase if connected
      if (import.meta.env.VITE_SUPABASE_URL) {
        try {
          // Use a dummy HybridEntityLoader to get tech fields and encode them
          const userLoader = new HybridEntityLoader('User');
          let record = userLoader._encodeNotes({ ...newUser });
          
          for (let attempt = 0; attempt < 20; attempt++) {
            const { data, error } = await supabase.from('users').insert([record]).select().single();
            if (error) {
              if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
                const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
                if (colMatch) { delete record[colMatch[1]]; continue; }
              }
              if (error.code === '23505') {
                console.warn('User already exists in Supabase:', newUser.username);
                break;
              }
              console.error('Supabase user save error:', error);
              break;
            }
            console.log('✅ User saved to Supabase:', newUser.username);
            return data || newUser;
          }
        } catch (e) {
          console.error('Supabase addUser error (localStorage fallback active):', e);
        }
      }

      return newUser;
    },

    // Update user
    updateUser: async (id, data) => {
      // 1. Update in localStorage system_users
      try {
        const stored = localStorage.getItem('system_users');
        if (stored) {
          const users = JSON.parse(stored);
          const index = users.findIndex(u => u.id === id);
          if (index >= 0) {
            users[index] = { ...users[index], ...data };
            localStorage.setItem('system_users', JSON.stringify(users));
          }
        }
      } catch (e) {
        console.error('Update system_users in localStorage failed:', e);
      }

      // 2. Update via User entity loader (Supabase + local cache)
      try {
        const updatedUser = await base44.entities.User.update(id, data);
        console.log('✅ User updated:', id);
        return updatedUser || data;
      } catch (error) {
        console.error('Error updating user in entity loader:', error);
        return data;
      }
    },

    // Delete user
    deleteUser: async (id) => {
      // 1. Delete from localStorage system_users
      try {
        const stored = localStorage.getItem('system_users');
        if (stored) {
          let users = JSON.parse(stored).filter(u => u.id !== id);
          localStorage.setItem('system_users', JSON.stringify(users));
        }
      } catch (e) {
        console.error('Delete from system_users in localStorage failed:', e);
      }

      // 2. Delete via User entity loader
      try {
        await base44.entities.User.delete(id);
        console.log('✅ User deleted:', id);
        return true;
      } catch (error) {
        console.error('Error deleting user in entity loader:', error);
        return true;
      }
    },

    // Login validation (Clinic ID + Username + Password)
    login: async (clinicId, username, password) => {
      console.log('🔐 Login attempt:', { clinicId, username });
      
      // Search ALL sources for the user
      const normalizeId = (id) => (id || '').toLowerCase().trim().replace(/-/g, '_');
      
      let allUsers = [];

      // Source 1: Supabase
      if (import.meta.env.VITE_SUPABASE_URL) {
        try {
          const { data, error } = await supabase.from('users').select('*');
          if (data && !error) {
            allUsers.push(...data);
            console.log('✅ Supabase users loaded:', data.length);
          } else if (error) {
            console.warn('⚠️ Supabase users fetch error:', error.message);
          }
        } catch (e) { console.warn('Supabase users fetch failed:', e); }
      }

      // Source 2: localStorage system_users
      try {
        const sysUsers = JSON.parse(localStorage.getItem('system_users') || '[]');
        sysUsers.forEach(u => {
          if (!allUsers.find(au => au.id === u.id)) allUsers.push(u);
        });
      } catch (e) {}

      // Source 3: mock_db localStorage
      try {
        const keys = Object.keys(localStorage).filter(k => k.includes('_User'));
        keys.forEach(key => {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          arr.forEach(u => { if (!allUsers.find(au => au.id === u.id)) allUsers.push(u); });
        });
      } catch (e) {}

      // Decode any notes-encoded users (eski formatdagi foydalanuvchilar uchun)
      const userLoaderForLogin = new HybridEntityLoader('User');
      allUsers = allUsers.map(u => {
        if (u.notes && typeof u.notes === 'string' && u.notes.startsWith('[TECH_DATA]')) {
          const decoded = userLoaderForLogin._decodeNotes(u);
          // Agar password notes'dan decoded bo'lsa, uni asosiy ustun sifatida ishlatamiz
          return decoded;
        }
        return u;
      });

      console.log('🔍 Total users in all sources:', allUsers.length);
      
      // Find user by clinic_id and username (case-insensitive, flexible matching)
      const user = allUsers.find(u => {
        if (!u || !u.clinic_id || !u.username) return false;
        const clinicMatch = normalizeId(u.clinic_id) === normalizeId(clinicId);
        const usernameMatch = u.username.toLowerCase().trim() === username.toLowerCase().trim();
        const passwordMatch = String(u.password || '') === String(password || '');
        return clinicMatch && usernameMatch && passwordMatch;
      });
      
      if (!user) {
        console.warn('❌ Login failed. Users checked:', allUsers.map(u => `[${u.clinic_id}] ${u.username}`));
        return { success: false, error: 'Klinika ID, login yoki parol noto\'g\'ri' };
      }
      
      // Check if clinic exists and is active
      const clinics = await base44.clinic.getAll();
      const clinic = clinics.find(c => c.id.toLowerCase() === user.clinic_id.toLowerCase());
      
      if (!clinic) {
        return { success: false, error: 'Klinika topilmadi' };
      }
      
      if (clinic.status !== 'Active') {
        return { success: false, error: 'Klinika faol emas. Admin bilan bog\'laning!' };
      }

      // Check Expiry Date
      if (clinic.expires_at) {
        const expiryDate = new Date(clinic.expires_at);
        // Allow access until the end of the expiration day
        expiryDate.setHours(23, 59, 59, 999);
        
        const today = new Date();
        if (today > expiryDate) {
          return { success: false, error: 'Klinika uchun to\'lov muddati tugagan. Iltimos, to\'lovni amalga oshiring!' };
        }
      }
      
      console.log('✅ Login successful:', user.name, '| Role:', user.role);
      
      // Simulate JWT Token
      const mockToken = btoa(JSON.stringify({ 
        sub: user.id, 
        role: user.role, 
        exp: Date.now() + 86400000 
      }));

      // Set session - use actual clinic plan, default to 'pro' for security
      const clinicPlan = (clinic.plan || 'pro').toLowerCase();
      console.log('📋 Clinic plan:', clinicPlan, '| Clinic:', clinic.id);
      
      localStorage.setItem('auth_token', mockToken);
      localStorage.setItem('is_authenticated', 'true');
      localStorage.setItem('user_id', user.id);
      localStorage.setItem('user_name', user.name);
      localStorage.setItem('user_role', user.role);
      localStorage.setItem('clinic_id', user.clinic_id);
      localStorage.setItem('current_clinic_id', user.clinic_id);
      localStorage.setItem('clinic_plan', clinicPlan);
      localStorage.setItem('user_data', JSON.stringify(user));
      
      return { 
        success: true, 
        token: mockToken,
        user: { 
          id: user.id, 
          username: user.username,
          name: user.name, 
          role: user.role, 
          clinic_id: user.clinic_id 
        } 
      };
    },

    // Get current user
    getCurrentUser: () => {
      const userId = localStorage.getItem('user_id');
      if (!userId) return null;
      
      const users = base44.auth.getAllUsers();
      return users.find(u => u.id === userId) || null;
    },

    // Check if authenticated
    isAuthenticated: () => {
      return localStorage.getItem('is_authenticated') === 'true';
    }
  }
};

export const handleApiError = (error) => {
  console.error('API Error:', error);
  return { success: false, error: error.message };
};

export const authenticatedCall = async (apiCall) => {
  try {
    const res = await apiCall();
    return res;
  } catch (error) {
    return handleApiError(error);
  }
};

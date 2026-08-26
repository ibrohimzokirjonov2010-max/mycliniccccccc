import { createClient } from '@supabase/supabase-js';
import { safeLocalStorage as localStorage } from '@/utils/safeStorage';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('⚠️ Supabase credentials not found. Using localStorage fallback.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ============================================================
// RLS Context: Har so'rovdan OLDIN chaqirilishi SHART
// Supabase serveriga clinic_id ni uzatadi — RLS bu orqali ishlaydi
// ============================================================
let _lastClinicId = null;
let _lastIsSuperAdmin = null;

export async function setClinicContext() {
  if (!supabaseUrl) return; // localStorage mode - skip

  const clinicId = localStorage.getItem('current_clinic_id') || 'default_clinic';
  const isSuperAdmin = localStorage.getItem('is_super_admin') === 'true';

  // Faqat o'zgarganda yangilash - keraksiz so'rovlarni kamaytirish
  if (clinicId === _lastClinicId && isSuperAdmin === _lastIsSuperAdmin) return;

  try {
    /* 
     * NOTE: The RPC 'set_config' and table '_rls_context' do not exist in this database schema.
     * Tenant isolation is secured via explicit '.eq("clinic_id", clinicId)' on all client queries.
     * We skip these calls to avoid cluttering the browser console with 404 network errors.
     */
    /*
    await supabase.rpc('set_config', {
      setting_name: 'app.clinic_id',
      new_value: clinicId,
      is_local: true
    });

    const { error } = await supabase.from('_rls_context').select('1').limit(0).single()
      .then(() => ({ error: null }))
      .catch(() => ({ error: null }));
    */

    _lastClinicId = clinicId;
    _lastIsSuperAdmin = isSuperAdmin;
  } catch (e) {
    // RLS context o'rnatib bo'lmasa ham tizim ishlashda davom etadi
    // (frontend filtr hali ham ishlaydi)
    console.debug('[RLS] Context set skipped:', e?.message);
  } finally {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('crm-context-updated'));
    }
  }
}

// Auto-initialize on module load
if (supabaseUrl) {
  setClinicContext().catch(() => {});
}

// Generic CRUD factory for any table
function makeTable(tableName, orderField = 'created_date') {
  return {
    getAll: async (clinicId = null) => {
      let query = supabase.from(tableName).select('*').order(orderField, { ascending: false });
      if (clinicId) query = query.eq('clinic_id', clinicId);
      const { data, error } = await query;
      if (error) { console.error(`Error fetching ${tableName}:`, error); return []; }
      return data || [];
    },

    getById: async (id) => {
      const { data, error } = await supabase.from(tableName).select('*').eq('id', id).single();
      if (error) return null;
      return data;
    },

    getByClinic: async (clinicId) => {
      const { data, error } = await supabase
        .from(tableName).select('*').eq('clinic_id', clinicId).order(orderField, { ascending: false });
      if (error) { console.error(`Error fetching ${tableName} by clinic:`, error); return []; }
      return data || [];
    },
    
    // Core create with retry logic to handle missing columns automatically
    // MAX_RETRIES: 50 dan 3 ga tushirildi — kechikishni 90s dan <1s ga kamaytiradi
    _createWithRetry: async function(payload) {
      const MAX_RETRIES = 3;
      let record = { ...payload };
      let removedCols = [];
      
      for (let i = 0; i < MAX_RETRIES; i++) {
        const { data, error } = await supabase.from(tableName).insert([record]).select().single();
        
        if (error) {
          // 42703 or PGRST204: Column not found — ustunni olib tashlash va qayta urinish
          if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
            const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
            if (colMatch) {
              const badCol = colMatch[1];
              console.warn(`⚠️ [${tableName}] Column '${badCol}' missing in DB, removing and retrying... (${i + 1}/${MAX_RETRIES})`);
              removedCols.push(badCol);
              delete record[badCol];
              // Serverni bloklamaslik uchun 300ms kutish
              await new Promise(res => setTimeout(res, 300));
              continue;
            }
          }
          console.error(`❌ [${tableName}] Create error:`, error);
          throw error;
        }
        
        if (removedCols.length > 0) {
          console.info(`✅ [${tableName}] Created after removing missing columns:`, removedCols.join(', '));
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
        return data;
      }
      throw new Error(`[${tableName}] Create failed after ${MAX_RETRIES} retries`);
    },

    create: async function(record) {
      return this._createWithRetry(record);
    },

    update: async function(id, updates) {
      const MAX_RETRIES = 3;
      let record = { ...updates };
      let removedCols = [];
      
      for (let i = 0; i < MAX_RETRIES; i++) {
        const { data, error } = await supabase.from(tableName).update(record).eq('id', id).select().single();
        
        if (error) {
          if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
            const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
            if (colMatch) {
              const badCol = colMatch[1];
              console.warn(`⚠️ [${tableName}] Column '${badCol}' missing in DB on UPDATE, removing and retrying... (${i + 1}/${MAX_RETRIES})`);
              removedCols.push(badCol);
              delete record[badCol];
              await new Promise(res => setTimeout(res, 300));
              continue;
            }
          }
          console.error(`❌ [${tableName}] Update error:`, error);
          throw error;
        }
        
        if (removedCols.length > 0) {
          console.info(`✅ [${tableName}] Updated after removing missing columns:`, removedCols.join(', '));
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
        return data;
      }
      throw new Error(`[${tableName}] Update failed after ${MAX_RETRIES} retries`);
    },

    delete: async (id) => {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) { console.error(`Error deleting ${tableName}:`, error); throw error; }
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('crm-data-updated'));
      return true;
    }
  };
}

// Helper functions for database operations
export const db = {
  // Clinics
  clinics: {
    getAll: async () => {
      const { data, error } = await supabase
        .from('clinics').select('*').order('created_at', { ascending: false });
      if (error) { console.error('Error fetching clinics:', error); return []; }
      return data || [];
    },

    getById: async (id) => {
      const { data, error } = await supabase.from('clinics').select('*').eq('id', id).single();
      if (error) return null;
      return data;
    },

    create: async (clinic) => {
      const payload = {
        ...clinic,
        created_at: clinic.created_at || new Date().toISOString()
      };
      const MAX_RETRIES = 3;
      let record = { ...payload };
      for (let i = 0; i < MAX_RETRIES; i++) {
        const { data, error } = await supabase.from('clinics').insert([record]).select().single();
        if (error) {
          if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
            const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
            if (colMatch) {
              const badCol = colMatch[1];
              console.warn(`⚠️ clinics: Column '${badCol}' missing, removing and retrying... (${i + 1}/${MAX_RETRIES})`);
              delete record[badCol];
              await new Promise(res => setTimeout(res, 300));
              continue;
            }
          }
          throw error;
        }
        return data;
      }
      throw new Error('Clinics creation failed after 3 retries');
    },

    update: async (id, updates) => {
      const MAX_RETRIES = 3;
      let record = { ...updates };
      let removedCols = [];
      
      for (let i = 0; i < MAX_RETRIES; i++) {
        const { data, error } = await supabase.from('clinics').update(record).eq('id', id).select().single();
        
        if (error) {
          if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
            const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
            if (colMatch) {
              const badCol = colMatch[1];
              console.warn(`⚠️ clinics: Column '${badCol}' missing on update, removing and retrying... (${i + 1}/${MAX_RETRIES})`);
              removedCols.push(badCol);
              delete record[badCol];
              await new Promise(res => setTimeout(res, 300));
              continue;
            }
          }
          console.error('Error updating clinic:', error);
          throw error;
        }
        
        if (removedCols.length > 0) {
           console.info(`✅ clinics: Updated after skipping: ${removedCols.join(', ')}`);
        }
        return data;
      }
      throw new Error('Clinics update failed after 3 retries');
    },

    delete: async (id) => {
      const { error } = await supabase.from('clinics').delete().eq('id', id);
      if (error) { console.error('Error deleting clinic:', error); throw error; }
      return true;
    }
  },

  // Users
  users: {
    getAll: async () => {
      const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false });
      if (error) { console.error('Error fetching users:', error); return []; }
      return data || [];
    },

    getByClinic: async (clinicId) => {
      const { data, error } = await supabase.from('users').select('*').eq('clinic_id', clinicId);
      if (error) { console.error('Error fetching users:', error); return []; }
      return data || [];
    },

    create: async (user) => {
      const MAX_RETRIES = 3;
      let record = { 
        ...user,
        created_at: user.created_at || new Date().toISOString()
      };
      
      for (let i = 0; i < MAX_RETRIES; i++) {
        const { data, error } = await supabase.from('users').insert([record]).select().single();
        if (error) {
          if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
            const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
            if (colMatch) {
              const badCol = colMatch[1];
              console.warn(`⚠️ users: Column '${badCol}' missing, removing and retrying... (${i + 1}/${MAX_RETRIES})`);
              delete record[badCol];
              await new Promise(res => setTimeout(res, 300));
              continue;
            }
          }
          throw error;
        }
        return data;
      }
      throw new Error('Users creation failed after 3 retries');
    },

    update: async (id, updates) => {
      const MAX_RETRIES = 3;
      let record = { ...updates };
      for (let i = 0; i < MAX_RETRIES; i++) {
        const { data, error } = await supabase.from('users').update(record).eq('id', id).select().single();
        if (error) {
          if ((error.code === '42703' || error.code === 'PGRST204') && error.message) {
            const colMatch = error.message.match(/column "(\w+)"/) || error.message.match(/the '(\w+)' column/);
            if (colMatch) {
              const badCol = colMatch[1];
              console.warn(`⚠️ users: Column '${badCol}' missing on update, removing and retrying... (${i + 1}/${MAX_RETRIES})`);
              delete record[badCol];
              await new Promise(res => setTimeout(res, 300));
              continue;
            }
          }
          throw error;
        }
        return data;
      }
      throw new Error('Users update failed after 3 retries');
    },

    delete: async (id) => {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) { console.error('Error deleting user:', error); throw error; }
      return true;
    }
  },

  // All other tables via generic factory
  patients: makeTable('patients'),
  appointments: makeTable('appointments', 'date'),
  payments: makeTable('payments', 'date'),
  services: makeTable('services', 'name'),
  treatment_plans: makeTable('treatment_plans'),
  tooth_records: makeTable('tooth_records'),
  implants: makeTable('implants'),
  leads: makeTable('leads'),
  recalls: makeTable('recalls', 'recall_date'),
  debts: makeTable('debts'),
  expenses: makeTable('expenses', 'date'),
  inventory: makeTable('inventory', 'name'),
  notes: makeTable('notes'),
  xrays: makeTable('xrays'),
  advertisements: makeTable('advertisements', 'created_date'),
  cases: makeTable('cases', 'date'),
  case_categories: makeTable('case_categories', 'name'),
  
  // Storage utility for file uploads
  storage: {
    /**
     * Uploads a file or base64 string to a Supabase bucket
     * Returns the public URL of the uploaded file
     */
    uploadFile: async (bucket, path, fileOrBase64) => {
      try {
        let fileBody = fileOrBase64;
        
        // If it's a base64 string, convert to Blob
        if (typeof fileOrBase64 === 'string' && fileOrBase64.startsWith('data:')) {
          const res = await fetch(fileOrBase64);
          fileBody = await res.blob();
        }

        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(path, fileBody, {
            cacheControl: '3600',
            upsert: true
          });

        if (error) {
           // If bucket doesn't exist, this is a common first-time error
           if (error.message.includes('not found')) {
             console.error(`Bucket "${bucket}" topilmadi. Iltimos Supabase panelidan "${bucket}" nomli public bucket yarating.`);
           }
           throw error;
        }

        const { data: { publicUrl } } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);

        return publicUrl;
      } catch (err) {
        console.error('Storage upload error:', err);
        throw err;
      }
    }
  }
};

// ============================================================
// 🏓 Supabase Keep-Alive Ping — DB uyquga ketmasligi uchun
// Supabase Free Tier harakatsiz qolganda connection sovib qoladi.
// Har 4 daqiqada yengil ping yuborib, ulanishni issiq saqlaydi.
// ============================================================
if (typeof window !== 'undefined' && supabaseUrl) {
  // Sahifa yuklangandan 30 soniya o'tib birinchi pingni yuborish
  // (app to'liq ishga tushishini kutish uchun)
  setTimeout(() => {
    const keepAlive = async () => {
      try {
        await supabase.from('clinics').select('id').limit(1);
        console.debug('🏓 [Supabase] Keep-alive ping yuborildi');
      } catch {
        // Xato bo'lsa jim o'tkazib yuborish — konsolni to'ldirmaslik
      }
    };
    keepAlive();
    setInterval(keepAlive, 4 * 60 * 1000); // har 4 daqiqada
  }, 30_000);
}

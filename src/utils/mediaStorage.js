/**
 * IndexedDB Media Storage for Cases & Heavy Photos
 * Ensures high-res photos never exceed localStorage 5MB quota and are never lost on page refresh.
 */

const DB_NAME = 'ShifoCrmMediaDB';
const DB_VERSION = 1;
const STORE_NAME = 'case_media';

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => {
      console.warn('IndexedDB open error:', e);
      resolve(null);
    };
  });
}

export const mediaStorage = {
  async saveCaseMedia(caseId, images) {
    if (!caseId || !images) return;
    try {
      const db = await openDB();
      if (!db) return;

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
          id: String(caseId),
          images,
          updated_at: Date.now()
        });

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('saveCaseMedia error:', e);
    }
  },

  async getCaseMedia(caseId) {
    if (!caseId) return null;
    try {
      const db = await openDB();
      if (!db) return null;

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(String(caseId));

        req.onsuccess = () => {
          resolve(req.result ? req.result.images : null);
        };
        req.onerror = () => resolve(null);
      });
    } catch (e) {
      console.warn('getCaseMedia error:', e);
      return null;
    }
  },

  async getAllCaseMedia() {
    try {
      const db = await openDB();
      if (!db) return {};

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();

        req.onsuccess = () => {
          const map = {};
          if (Array.isArray(req.result)) {
            req.result.forEach(item => {
              if (item && item.id) {
                map[item.id] = item.images;
              }
            });
          }
          resolve(map);
        };
        req.onerror = () => resolve({});
      });
    } catch (e) {
      console.warn('getAllCaseMedia error:', e);
      return {};
    }
  },

  async deleteCaseMedia(caseId) {
    if (!caseId) return;
    try {
      const db = await openDB();
      if (!db) return;

      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(String(caseId));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      });
    } catch (e) {
      console.warn('deleteCaseMedia error:', e);
    }
  }
};

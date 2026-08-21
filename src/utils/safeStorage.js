// Safe localStorage and sessionStorage wrappers to prevent crashes when cookies/storage are blocked
const mockStorage = {};

export const safeLocalStorage = {
  getItem(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      return mockStorage[key] || null;
    }
  },
  setItem(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      mockStorage[key] = String(value);
    }
  },
  removeItem(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {
      delete mockStorage[key];
    }
  },
  clear() {
    try {
      window.localStorage.clear();
    } catch (e) {
      for (const k in mockStorage) delete mockStorage[k];
    }
  }
};

const mockSession = {};

export const safeSessionStorage = {
  getItem(key) {
    try {
      return window.sessionStorage.getItem(key);
    } catch (e) {
      return mockSession[key] || null;
    }
  },
  setItem(key, value) {
    try {
      window.sessionStorage.setItem(key, value);
    } catch (e) {
      mockSession[key] = String(value);
    }
  },
  removeItem(key) {
    try {
      window.sessionStorage.removeItem(key);
    } catch (e) {
      delete mockSession[key];
    }
  },
  clear() {
    try {
      window.sessionStorage.clear();
    } catch (e) {
      for (const k in mockSession) delete mockSession[k];
    }
  }
};

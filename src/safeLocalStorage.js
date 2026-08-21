// Safe localStorage and sessionStorage stubs for private browsing or disabled cookies
try {
  const testKey = '__storage_test__';
  window.localStorage.setItem(testKey, testKey);
  window.localStorage.removeItem(testKey);
} catch (e) {
  const mockStorage = {};
  try {
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: (key) => mockStorage[key] || null,
        setItem: (key, value) => { mockStorage[key] = String(value); },
        removeItem: (key) => { delete mockStorage[key]; },
        clear: () => { for (const key in mockStorage) delete mockStorage[key]; },
        key: (index) => Object.keys(mockStorage)[index] || null,
        get length() { return Object.keys(mockStorage).length; }
      },
      writable: true,
      configurable: true
    });
    console.warn('[Storage] localStorage polyfilled due to restriction');
  } catch (err) {
    console.error('[Storage] Could not polyfill localStorage:', err);
  }
}

try {
  const testKey = '__storage_test__';
  window.sessionStorage.setItem(testKey, testKey);
  window.sessionStorage.removeItem(testKey);
} catch (e) {
  const mockStorage = {};
  try {
    Object.defineProperty(window, 'sessionStorage', {
      value: {
        getItem: (key) => mockStorage[key] || null,
        setItem: (key, value) => { mockStorage[key] = String(value); },
        removeItem: (key) => { delete mockStorage[key]; },
        clear: () => { for (const key in mockStorage) delete mockStorage[key]; },
        key: (index) => Object.keys(mockStorage)[index] || null,
        get length() { return Object.keys(mockStorage).length; }
      },
      writable: true,
      configurable: true
    });
    console.warn('[Storage] sessionStorage polyfilled due to restriction');
  } catch (err) {
    console.error('[Storage] Could not polyfill sessionStorage:', err);
  }
}

/**
 * App Parameters Utility
 * 
 * Handles application parameter extraction from URL and localStorage.
 * Supports SSR-safe execution for Node.js environments.
 */

// Check if running in Node.js (SSR) environment
const isNode = typeof window === 'undefined';

// Mock window object for SSR compatibility
const windowObj = isNode ? { localStorage: new Map() } : window;
const storage = windowObj.localStorage;

/**
 * Convert camelCase string to snake_case
 * @param {string} str - Input string
 * @returns {string} Snake case string
 */
const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

/**
 * Get application parameter value from URL or localStorage
 * 
 * @param {string} paramName - Parameter name
 * @param {Object} options - Options object
 * @param {*} options.defaultValue - Default value if not found
 * @param {boolean} options.removeFromUrl - Whether to remove param from URL
 * @returns {string|null} Parameter value
 */
const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  // Return default for SSR
  if (isNode) {
    return defaultValue;
  }

  const storageKey = `base44_${toSnakeCase(paramName)}`;
  const urlParams = new URLSearchParams(window.location.search);
  const searchParam = urlParams.get(paramName);

  // Remove from URL if requested
  if (removeFromUrl && searchParam) {
    urlParams.delete(paramName);
    const newUrl = `${window.location.pathname}${
      urlParams.toString() ? `?${urlParams.toString()}` : ""
    }${window.location.hash}`;
    window.history.replaceState({}, document.title, newUrl);
  }

  // Priority: URL param > default value > stored value
  if (searchParam) {
    storage.setItem(storageKey, searchParam);
    return searchParam;
  }

  if (defaultValue) {
    storage.setItem(storageKey, defaultValue);
    return defaultValue;
  }

  const storedValue = storage.getItem(storageKey);
  if (storedValue) {
    return storedValue;
  }

  return null;
};

/**
 * Get all application parameters
 * 
 * @returns {Object} Application parameters object
 * @property {string} appId - Application ID
 * @property {string} token - Access token
 * @property {string} fromUrl - Source URL
 * @property {string} functionsVersion - Functions version
 * @property {string} appBaseUrl - Application base URL
 */
const getAppParams = () => {
  // Clear token if requested
  if (getAppParamValue("clear_access_token") === 'true') {
    storage.removeItem('base44_access_token');
    storage.removeItem('token');
  }

  return {
    appId: getAppParamValue("app_id", { 
      defaultValue: import.meta.env.VITE_BASE44_APP_ID 
    }),
    token: getAppParamValue("access_token", { 
      removeFromUrl: true 
    }),
    fromUrl: getAppParamValue("from_url", { 
      defaultValue: isNode ? '' : window.location.href 
    }),
    functionsVersion: getAppParamValue("functions_version", { 
      defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION 
    }),
    appBaseUrl: getAppParamValue("app_base_url", { 
      defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL 
    }),
  };
};

/**
 * Application parameters singleton
 */
export const appParams = {
  ...getAppParams()
};

export default appParams;

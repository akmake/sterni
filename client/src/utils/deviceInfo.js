/**
 * Utility to collect comprehensive device information
 * This data will be sent to the server for logging
 */

export const collectDeviceInfo = () => {
  const info = {
    // Screen info
    screen: {
      width: window.screen?.width || null,
      height: window.screen?.height || null,
      colorDepth: window.screen?.colorDepth || null,
      pixelDepth: window.screen?.pixelDepth || null,
      refreshRate: window.screen?.refreshRate || null,
      isRetina: (window.devicePixelRatio || 1) > 1,
      pixelRatio: window.devicePixelRatio || 1,
      // גודל חלון בפועל (לא המסך כולו)
      viewportWidth: window.innerWidth || null,
      viewportHeight: window.innerHeight || null,
    },

    // Processor info
    processor: {
      cores: navigator.hardwareConcurrency || null,
      threads: navigator.hardwareConcurrency || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
    },

    // Memory info
    deviceMemory: navigator.deviceMemory || null, // in GB
    hardwareConcurrency: navigator.hardwareConcurrency || null,

    // Cookies & Storage
    cookies: {
      enabled: navigator.cookieEnabled || false,
    },

    localStorage: {
      enabled: (() => {
        try {
          const test = '__test__';
          localStorage.setItem(test, test);
          localStorage.removeItem(test);
          return true;
        } catch (e) {
          return false;
        }
      })(),
    },

    // Platform info
    platform: navigator.platform || navigator.userAgentData?.platform || 'Unknown',

    // Language & Timezone
    userLanguage: navigator.language || navigator.userLanguage || 'Unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,

    // Connection info (if available)
    connection: (() => {
      const conn =
        navigator.connection ||
        navigator.mozConnection ||
        navigator.webkitConnection;
      if (!conn) return {};

      return {
        effectiveType: conn.effectiveType || 'Unknown',
        rtt: conn.rtt ?? null,
        downlink: conn.downlink ?? null,
        saveData: conn.saveData || false,
      };
    })(),

    // ★ חדש: GPU info (אם זמין)
    gpu: (() => {
      try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (!gl) return null;
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (!debugInfo) return null;
        return {
          vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
          renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
        };
      } catch (e) {
        return null;
      }
    })(),

    // ★ חדש: האם מכשיר מגע
    isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,

    // ★ חדש: האם Dark Mode
    prefersDarkMode: window.matchMedia?.('(prefers-color-scheme: dark)')?.matches || false,
  };

  return info;
};

/**
 * Wrapper to add device info to any request data
 */
export const addDeviceInfoToRequest = (data = {}) => {
  const deviceInfo = collectDeviceInfo();

  return {
    ...data,
    logData: deviceInfo,
  };
};

export default collectDeviceInfo;
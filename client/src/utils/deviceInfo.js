/**
 * Utility to collect comprehensive device information.
 * - Collects ALL sync data immediately
 * - Async data (battery, mediaDevices) is resolved once on init and cached
 * - Cached result is reused for ALL requests (GET, POST, etc.)
 */

let _cache = null;
let _initPromise = null;

// ── Sync collection — runs instantly ──────────────────────
const collectSync = () => ({
  screen: {
    width: window.screen?.width || null,
    height: window.screen?.height || null,
    colorDepth: window.screen?.colorDepth || null,
    pixelDepth: window.screen?.pixelDepth || null,
    isRetina: (window.devicePixelRatio || 1) > 1,
    pixelRatio: window.devicePixelRatio || 1,
    viewportWidth: window.innerWidth || null,
    viewportHeight: window.innerHeight || null,
    orientation: screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'),
  },
  processor: {
    cores: navigator.hardwareConcurrency || null,
    threads: navigator.hardwareConcurrency || null,
    maxTouchPoints: navigator.maxTouchPoints || 0,
  },
  deviceMemory: navigator.deviceMemory || null,
  hardwareConcurrency: navigator.hardwareConcurrency || null,
  cookies: { enabled: navigator.cookieEnabled ?? false },
  localStorage: {
    enabled: (() => {
      try { const t = '__t__'; localStorage.setItem(t, t); localStorage.removeItem(t); return true; } catch { return false; }
    })(),
  },
  platform: navigator.platform || navigator.userAgentData?.platform || 'Unknown',
  userLanguage: navigator.language || navigator.userLanguage || 'Unknown',
  languages: navigator.languages ? [...navigator.languages] : [],
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  connection: (() => {
    const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!c) return {};
    return { effectiveType: c.effectiveType || null, rtt: c.rtt ?? null, downlink: c.downlink ?? null, saveData: c.saveData || false };
  })(),
  gpu: (() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) return null;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      if (!ext) return null;
      return { vendor: gl.getParameter(ext.UNMASKED_VENDOR_WEBGL), renderer: gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) };
    } catch { return null; }
  })(),
  isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
  prefersDarkMode: window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false,
  prefersReducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false,
  doNotTrack: navigator.doNotTrack === '1' || window.doNotTrack === '1',
  isOnline: navigator.onLine ?? true,
  pdfViewerEnabled: navigator.pdfViewerEnabled ?? null,
  pluginsCount: navigator.plugins?.length || 0,
  adBlocker: (() => {
    try {
      const el = document.createElement('div');
      el.className = 'adsbox ad-banner textAd';
      el.style.cssText = 'position:absolute;top:-999px;left:-999px;width:1px;height:1px;';
      el.innerHTML = '&nbsp;';
      document.body.appendChild(el);
      const blocked = el.offsetHeight === 0 || el.clientHeight === 0;
      document.body.removeChild(el);
      return blocked;
    } catch { return false; }
  })(),
  webdriver: navigator.webdriver || false,
  battery: null,
  mediaDevices: null,
  session: null,
});

// ── Async resolution (battery + media devices) ───────────
const resolveAsync = async (info) => {
  const tasks = [];

  if (navigator.getBattery) {
    tasks.push(
      navigator.getBattery()
        .then(b => { info.battery = { level: Math.round(b.level * 100), charging: b.charging }; })
        .catch(() => {})
    );
  }

  if (navigator.mediaDevices?.enumerateDevices) {
    tasks.push(
      navigator.mediaDevices.enumerateDevices()
        .then(devices => {
          info.mediaDevices = {
            cameras: devices.filter(d => d.kind === 'videoinput').length,
            microphones: devices.filter(d => d.kind === 'audioinput').length,
            speakers: devices.filter(d => d.kind === 'audiooutput').length,
          };
        })
        .catch(() => {})
    );
  }

  if (tasks.length) await Promise.allSettled(tasks);
};

// ── Session tracking (updates each call) ──────────────────
const getSession = () => {
  try {
    let pv = parseInt(sessionStorage.getItem('_lpc') || '0', 10);
    pv++;
    sessionStorage.setItem('_lpc', String(pv));
    let ss = sessionStorage.getItem('_lss');
    if (!ss) { ss = Date.now().toString(); sessionStorage.setItem('_lss', ss); }
    return { pageViews: pv, durationSeconds: Math.floor((Date.now() - parseInt(ss, 10)) / 1000), isNewSession: pv === 1 };
  } catch { return null; }
};

/**
 * Initialize device info — call once at app startup.
 * Waits for async fields (battery, media) and caches the result.
 */
export const initDeviceInfo = async () => {
  if (_cache) return _cache;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const info = collectSync();
    await resolveAsync(info);
    info.session = getSession();
    _cache = info;
    return _cache;
  })();

  return _initPromise;
};

/**
 * Get device info synchronously — returns cached data.
 * If init hasn't completed yet, returns sync-only data (battery/media may be null).
 * Session tracking is always fresh.
 */
export const collectDeviceInfo = () => {
  if (!_cache) {
    // Shouldn't happen if initDeviceInfo was called, but fallback
    _cache = collectSync();
    // Kick off async in background
    resolveAsync(_cache);
  }
  // Always update session
  _cache.session = getSession();
  return _cache;
};

export default collectDeviceInfo;
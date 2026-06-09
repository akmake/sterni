/**
 * ★ Advanced Visitor Signals (disclosed via consent banner)
 *
 * Green (enriched fingerprint entropy): audio, fonts, math, voices
 * Gray (consent-disclosed): WebRTC IPs, persistent cross-storage ID, incognito detection
 *
 * All collection is best-effort and fails silently. Merged into the device-info
 * payload (deviceInfo.js) so it rides the existing transport to the server.
 */

const hash = (str) => {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
  return Math.abs(h).toString(36);
};

// ── Audio fingerprint (real, async) ────────────────────────────
const getAudioFingerprint = () => new Promise((resolve) => {
  try {
    const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Ctx) return resolve(null);
    const ctx = new Ctx(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(10000, ctx.currentTime);
    const comp = ctx.createDynamicsCompressor();
    osc.connect(comp);
    comp.connect(ctx.destination);
    osc.start(0);
    ctx.oncomplete = (e) => {
      try {
        const data = e.renderedBuffer.getChannelData(0);
        let sum = 0;
        for (let i = 4500; i < 5000; i++) sum += Math.abs(data[i]);
        resolve(hash(sum.toString()));
      } catch { resolve(null); }
    };
    ctx.startRendering();
    setTimeout(() => resolve(null), 1000); // safety timeout
  } catch { resolve(null); }
});

// ── Installed-font detection ───────────────────────────────────
const FONT_PROBES = [
  'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS', 'Consolas', 'Courier New',
  'Georgia', 'Impact', 'Lucida Console', 'Segoe UI', 'Tahoma', 'Times New Roman', 'Trebuchet MS',
  'Verdana', 'Helvetica', 'Helvetica Neue', 'Menlo', 'Monaco', 'Geneva', 'Optima', 'Gill Sans',
  'Futura', 'Palatino', 'Cochin', 'Ubuntu', 'Roboto', 'Noto Sans', 'DejaVu Sans', 'Liberation Sans',
  'David', 'Narkisim', 'FrankRuehl', 'Miriam', 'Gisha', 'Arial Hebrew',
];
const detectFonts = () => {
  try {
    const baseFonts = ['monospace', 'serif', 'sans-serif'];
    const testString = 'mmmmmmmmmmlli WjgQ אבגד';
    const testSize = '72px';
    const span = document.createElement('span');
    span.style.cssText = 'position:absolute;left:-9999px;font-size:' + testSize;
    span.textContent = testString;
    document.body.appendChild(span);

    const baseline = {};
    baseFonts.forEach((b) => {
      span.style.fontFamily = b;
      baseline[b] = { w: span.offsetWidth, h: span.offsetHeight };
    });

    const found = [];
    FONT_PROBES.forEach((font) => {
      const detected = baseFonts.some((b) => {
        span.style.fontFamily = `'${font}',${b}`;
        return span.offsetWidth !== baseline[b].w || span.offsetHeight !== baseline[b].h;
      });
      if (detected) found.push(font);
    });
    document.body.removeChild(span);
    return found;
  } catch { return []; }
};

// ── Math fingerprint (FPU/JS-engine precision) ─────────────────
const getMathFingerprint = () => {
  try {
    const ops = [
      Math.tan(-1e300), Math.acos(0.123456789), Math.asin(0.123456789),
      Math.atanh(0.5), Math.sinh(1), Math.cosh(10), Math.expm1(1),
      Math.pow(Math.PI, -100), Math.log(1e300),
    ];
    return hash(ops.join(','));
  } catch { return null; }
};

// ── Speech-synthesis voices ────────────────────────────────────
const getVoiceCount = () => new Promise((resolve) => {
  try {
    if (!window.speechSynthesis) return resolve(0);
    let v = speechSynthesis.getVoices();
    if (v.length) return resolve(v.length);
    const t = setTimeout(() => resolve(speechSynthesis.getVoices().length || 0), 500);
    speechSynthesis.onvoiceschanged = () => { clearTimeout(t); resolve(speechSynthesis.getVoices().length || 0); };
  } catch { resolve(0); }
});

// ── Incognito / private-mode detection (storage-quota heuristic) ──
const detectIncognito = async () => {
  try {
    if (navigator.storage?.estimate) {
      const { quota } = await navigator.storage.estimate();
      // Private mode caps quota far lower than normal (~< 300MB in many browsers)
      if (quota !== undefined && quota < 300 * 1024 * 1024) return true;
      return false;
    }
  } catch { /* fall through */ }
  return null;
};

// ── Persistent ID (survives cookie clearing) ───────────────────
const PID_KEY = 'sterni_pid';
const idbGet = (key) => new Promise((resolve) => {
  try {
    const req = indexedDB.open('sterni_pid_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction('kv', 'readonly').objectStore('kv').get(key);
        tx.onsuccess = () => resolve(tx.result || null);
        tx.onerror = () => resolve(null);
      } catch { resolve(null); }
    };
    req.onerror = () => resolve(null);
  } catch { resolve(null); }
});
const idbSet = (key, val) => new Promise((resolve) => {
  try {
    const req = indexedDB.open('sterni_pid_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('kv');
    req.onsuccess = () => {
      try {
        const db = req.result;
        const tx = db.transaction('kv', 'readwrite').objectStore('kv').put(val, key);
        tx.onsuccess = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch { resolve(false); }
    };
    req.onerror = () => resolve(false);
  } catch { resolve(false); }
});
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'pid-' + Date.now() + '-' + Math.random().toString(36).slice(2));
const getPersistentId = async () => {
  let ls = null;
  try { ls = localStorage.getItem(PID_KEY); } catch { /* ignore */ }
  const idb = await idbGet(PID_KEY);
  const id = ls || idb || uuid();
  // Re-seed both stores so the ID survives clearing either one
  try { localStorage.setItem(PID_KEY, id); } catch { /* ignore */ }
  if (idb !== id) await idbSet(PID_KEY, id);
  return id;
};

// ── WebRTC IP discovery (reveals local IP, and real IP behind some VPNs) ──
const getWebRTCIPs = () => new Promise((resolve) => {
  const result = { localIPs: [], publicIPs: [] };
  try {
    const RTCPeer = window.RTCPeerConnection || window.webkitRTCPeerConnection || window.mozRTCPeerConnection;
    if (!RTCPeer) return resolve(result);
    const pc = new RTCPeer({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const seen = new Set();
    const ipRe = /([0-9]{1,3}(\.[0-9]{1,3}){3})|([a-f0-9]{1,4}(:[a-f0-9]{1,4}){7})/gi;
    const isPrivate = (ip) => /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|169\.254\.|127\.|::1|f[cd])/i.test(ip);

    pc.onicecandidate = (e) => {
      if (!e.candidate || !e.candidate.candidate) return;
      const m = e.candidate.candidate.match(ipRe);
      if (!m) return;
      m.forEach((ip) => {
        if (seen.has(ip) || ip.endsWith('.local') || /\.local$/i.test(ip)) return;
        seen.add(ip);
        if (isPrivate(ip)) { if (!result.localIPs.includes(ip)) result.localIPs.push(ip); }
        else if (!result.publicIPs.includes(ip)) result.publicIPs.push(ip);
      });
    };
    pc.createDataChannel('x');
    pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(() => {});
    setTimeout(() => { try { pc.close(); } catch { /* ignore */ } resolve(result); }, 1500);
  } catch { resolve(result); }
});

// ── Public API ─────────────────────────────────────────────────
export const collectAdvancedSignals = async () => {
  const signals = {};
  try {
    const [audio, voices, incognito, persistentId, webrtc] = await Promise.all([
      getAudioFingerprint(),
      getVoiceCount(),
      detectIncognito(),
      getPersistentId(),
      getWebRTCIPs(),
    ]);
    const fonts = detectFonts();
    signals.audioFingerprint = audio;
    signals.voices = voices;
    signals.incognito = incognito;
    signals.persistentId = persistentId;
    signals.webrtc = webrtc;
    signals.fontFingerprint = fonts.length ? hash(fonts.join(',')) : null;
    signals.fontCount = fonts.length;
    signals.mathFingerprint = getMathFingerprint();
  } catch { /* best-effort */ }
  return signals;
};

export default collectAdvancedSignals;

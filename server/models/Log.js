import mongoose from 'mongoose';

const logSchema = new mongoose.Schema(
  {
    // User info (if logged in)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // Visitor info
    ipAddress: String,
    userAgent: String,

    // Browser/Device info (parsed from userAgent)
    browser: {
      name: String,
      version: String,
    },

    os: {
      name: String,
      version: String,
      architecture: String,
    },

    device: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown',
    },

    // Screen/Display info
    screen: {
      width: Number,
      height: Number,
      availWidth: Number,
      availHeight: Number,
      viewportWidth: Number,
      viewportHeight: Number,
      colorDepth: Number,
      pixelDepth: Number,
      pixelRatio: Number,
      refreshRate: Number,
      isRetina: Boolean,
      orientation: String,
    },

    // Processor info
    processor: {
      cores: Number,
      threads: Number,
      memory: Number,
      maxTouchPoints: Number,
    },

    // Cookies & Storage
    cookies: {
      enabled: Boolean,
      count: Number,
    },

    localStorage: {
      enabled: Boolean,
      size: Number,
    },

    // Page visited
    page: String,
    method: String,
    statusCode: Number,

    // Timing
    responseTime: Number,

    // Headers & Request Info
    referer: String,
    userLanguage: String,
    languages: [String],
    timezone: String,

    // Location (from IP geolocation)
    location: {
      country: String,
      countryCode: String,
      city: String,
      region: String,
      zip: String,
      latitude: Number,
      longitude: Number,
      timezone: String,        // geo timezone (from IP, e.g. "Asia/Jerusalem")
      // ★ Network / ISP intelligence
      isp: String,             // e.g. "Bezeq", "Cellcom"
      org: String,             // organization owning the IP
      asn: String,             // autonomous system, e.g. "AS8551"
      asName: String,          // AS owner name
      // ★ Threat / connection flags (from IP intelligence)
      proxy: Boolean,          // VPN / Tor / anonymizing proxy
      hosting: Boolean,        // datacenter / hosting / cloud IP (likely bot/server)
      mobileCarrier: Boolean,  // connected via mobile carrier network
    },

    // Connection Info
    connection: {
      effectiveType: String,
      rtt: Number,
      downlink: Number,
      saveData: Boolean,
    },

    // More Device Details
    platform: String,
    hardwareConcurrency: Number,
    deviceMemory: Number,

    // ★ GPU Info
    gpu: {
      vendor: String,
      renderer: String,
    },

    // ★ Battery Info
    battery: {
      level: Number,     // 0-100
      charging: Boolean,
    },

    // ★ User Preferences
    prefersDarkMode: Boolean,
    prefersReducedMotion: Boolean,
    doNotTrack: Boolean,
    isTouchDevice: Boolean,

    // ★ Session Tracking
    session: {
      pageViews: Number,
      durationSeconds: Number,
      isNewSession: Boolean,
    },

    // ★ On-page behavior (filled later by POST /api/logs/behavior beacon)
    behavior: {
      maxScrollDepth: Number,   // 0-100 (% of page scrolled)
      clicks: Number,           // total clicks on the page
      rageClicks: Number,       // rapid repeated clicks in same spot (frustration signal)
      activeSeconds: Number,    // real engaged time (focused + not idle)
      // ★ Behavioral biometrics (consent-gated) — identifies a person across devices
      biometrics: {
        mouseSamples: Number,        // # of mouse-move samples observed
        avgMouseSpeed: Number,       // px/sec
        avgClickInterval: Number,    // ms between clicks
        typingCadenceMs: Number,     // avg ms between keystrokes
        signature: String,           // hashed behavioral signature
      },
    },

    // ★ Advanced intelligence signals (collected client-side; consent disclosed)
    signals: {
      // Enriched fingerprint entropy
      audioFingerprint: String,   // AudioContext render hash
      fontFingerprint: String,    // hash of installed-font set
      fontCount: Number,
      mathFingerprint: String,    // FP-math precision hash
      voices: Number,             // # speechSynthesis voices
      // Privacy / environment
      incognito: Boolean,         // private-browsing mode detected
      persistentId: String,       // survives cookie-clearing (localStorage+IndexedDB)
      // WebRTC — can reveal the real IP even behind a VPN
      webrtc: {
        localIPs: [String],
        publicIPs: [String],
        mismatch: Boolean,        // WebRTC public IP ≠ server-detected IP
      },
      // VPN / fraud scoring (computed server-side)
      vpnScore: Number,           // 0-100 confidence the visitor is masking
      vpnSignals: [String],       // which signals fired: 'proxy','hosting','tz','lang','webrtc'
      tzMismatch: Boolean,        // browser timezone ≠ IP timezone
      langMismatch: Boolean,      // browser language ≠ IP country language
      // Consent record (disclosed via banner)
      consent: {
        given: Boolean,
        version: String,
        at: Date,
      },
    },

    // ★ Media Devices
    mediaDevices: {
      cameras: Number,
      microphones: Number,
      speakers: Number,
    },

    // ★ Detection Flags
    adBlocker: Boolean,
    webdriver: Boolean,          // automation/bot flag
    isOnline: Boolean,
    pdfViewerEnabled: Boolean,
    pluginsCount: Number,

    // ★ Fingerprinting
    fingerprint: String,
    canvasFingerprint: String,
    webglFingerprint: String,

    // ★ Browser Capabilities
    webGLSupported: Boolean,
    serviceWorkerSupported: Boolean,
    notificationPermission: String,

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: 'logs',
  }
);

logSchema.index({ timestamp: -1 });
logSchema.index({ userId: 1, timestamp: -1 });
logSchema.index({ ipAddress: 1 });
logSchema.index({ 'browser.name': 1 });
logSchema.index({ device: 1 });
logSchema.index({ 'location.country': 1 });
logSchema.index({ fingerprint: 1, timestamp: -1 });
logSchema.index({ 'signals.persistentId': 1 });
logSchema.index({ 'signals.vpnScore': -1 });
// TTL: מחיקה אוטומטית של לוגים אחרי 90 יום
logSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export default mongoose.model('Log', logSchema);
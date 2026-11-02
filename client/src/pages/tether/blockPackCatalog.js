// Port of the Android admin app's BlockPackCatalog (ManagerApk: admin/BlockPackCatalog.kt).
// Keep the two in sync — the device enforces whatever packages end up in `blockedApps`.
//
// Each category keeps its "everything" master flag (blockAllBrowsers / blockYoutube /
// blockAllStores), which still covers items nobody listed. Individual items are stored in the
// ordinary `blockedApps` list. "YouTube inside the browser" has no real package; it is stored as
// YOUTUBE_WEB_PSEUDO_PKG, which the device reads as "scan the address bar for YouTube".

export const YOUTUBE_WEB_PSEUDO_PKG = 'com.google.android.youtube.web';
export const GOOGLE_PLAY_PKG = 'com.android.vending';

const item = (id, label, packages, category) => ({ id, label, packages, category, iconPackage: packages[0] });

export const BROWSER_ITEMS = [
  item('chrome', 'Chrome', ['com.android.chrome', 'com.chrome.beta', 'com.chrome.dev', 'com.chrome.canary'], 'BROWSERS'),
  item('samsung_internet', 'דפדפן סמסונג (Samsung Internet)', [
    'com.sec.android.app.sbrowser', 'com.sec.android.app.sbrowser.beta',
    'com.sec.android.app.sbrowser.lite', 'com.sec.android.app.sbrowser.beta.lite',
    'com.samsung.android.app.sbrowseredge',
  ], 'BROWSERS'),
  item('firefox', 'Firefox', ['org.mozilla.firefox', 'org.mozilla.firefox_beta', 'org.mozilla.fenix', 'org.mozilla.focus', 'org.mozilla.klar'], 'BROWSERS'),
  item('edge', 'Microsoft Edge', ['com.microsoft.emmx', 'com.microsoft.emmx.canary'], 'BROWSERS'),
  item('opera', 'Opera', ['com.opera.browser', 'com.opera.browser.beta', 'com.opera.mini.native', 'com.opera.gx', 'com.opera.touch'], 'BROWSERS'),
  item('brave', 'Brave', ['com.brave.browser', 'com.brave.browser_beta'], 'BROWSERS'),
  item('duckduckgo', 'DuckDuckGo', ['com.duckduckgo.mobile.android'], 'BROWSERS'),
  item('xiaomi_browser', 'דפדפן שיאומי (Mi Browser)', ['com.mi.globalbrowser', 'com.android.browser.mi'], 'BROWSERS'),
  item('builtin_browser', 'דפדפן מובנה של היצרן', [
    'com.android.browser', 'com.google.android.browser', 'com.heytap.browser',
    'com.coloros.browser', 'com.vivo.browser', 'com.huawei.browser',
  ], 'BROWSERS'),
  item('uc', 'UC Browser', ['com.UCMobile.intl', 'com.uc.browser.en', 'com.ucmobile.lite'], 'BROWSERS'),
];

export const YOUTUBE_ITEMS = [
  item('youtube', 'YouTube', ['com.google.android.youtube'], 'YOUTUBE'),
  item('youtube_kids', 'YouTube Kids', ['com.google.android.apps.youtube.kids'], 'YOUTUBE'),
  item('youtube_music', 'YouTube Music', ['com.google.android.apps.youtube.music', 'com.google.android.youtube.music'], 'YOUTUBE'),
  item('youtube_mods', 'גרסאות פרוצות (ReVanced / Vanced)', ['app.revanced.android.youtube', 'app.rvx.android.youtube', 'com.vanced.android.youtube'], 'YOUTUBE'),
  item('youtube_other', 'YouTube TV / Go / Studio / Gaming', [
    'com.google.android.youtube.tv', 'com.google.android.apps.youtube.unplugged',
    'com.google.android.apps.youtube.mango', 'com.google.android.apps.youtube.creator',
    'com.google.android.apps.youtube.gaming',
  ], 'YOUTUBE'),
  item('youtube_web', 'יוטיוב בתוך הדפדפן (youtube.com)', [YOUTUBE_WEB_PSEUDO_PKG], 'YOUTUBE'),
];

// Google Play is deliberately absent: it has its own flag (hideGooglePlay), shown as the Play row.
export const STORE_ITEMS = [
  item('galaxy_store', 'Galaxy Store (חנות סמסונג)', ['com.sec.android.app.samsungapps'], 'STORES'),
  item('aptoide', 'Aptoide', ['cm.aptoide.pt', 'com.aptoide.partners'], 'STORES'),
  item('apkpure', 'APKPure', ['com.apkpure.aegon'], 'STORES'),
  item('apkmirror', 'APKMirror', ['com.apkmirror.helper.prod'], 'STORES'),
  item('fdroid', 'F-Droid', ['org.fdroid.fdroid', 'org.fdroid.basic'], 'STORES'),
  item('uptodown', 'Uptodown', ['com.uptodown', 'com.uptodown.installer'], 'STORES'),
  item('oem_stores', 'חנויות יצרן אחרות (שיאומי, הואווי, אופו…)', [
    'com.xiaomi.market', 'com.huawei.appmarket', 'com.oppo.market', 'com.heytap.market',
    'com.vivo.appstore', 'com.bbk.appstore', 'com.amazon.venezia',
  ], 'STORES'),
];

export const ALL_ITEMS = [...BROWSER_ITEMS, ...YOUTUBE_ITEMS, ...STORE_ITEMS];

/** Every package some item controls — used to keep raw package lists free of bundle entries. */
export const ALL_PACKAGES = new Set(ALL_ITEMS.flatMap(i => i.packages));

export const itemsOf = (category) =>
  ({ BROWSERS: BROWSER_ITEMS, YOUTUBE: YOUTUBE_ITEMS, STORES: STORE_ITEMS }[category]);

/** An item counts as blocked when any of its packages is — so a hand-added package shows up. */
export const isBlocked = (it, blockedApps = []) => it.packages.some(p => blockedApps.includes(p));

/** Adds or removes every package of `it`, leaving the rest of the list untouched and ordered. */
export const setBlocked = (blockedApps = [], it, blocked) =>
  blocked ? [...new Set([...blockedApps, ...it.packages])] : blockedApps.filter(p => !it.packages.includes(p));

/** Friendly name for a package the catalog knows, e.g. "com.android.chrome" → "Chrome". */
export const labelFor = (pkg) =>
  ALL_ITEMS.find(i => i.packages.includes(pkg))?.label ?? (pkg === GOOGLE_PLAY_PKG ? 'Google Play' : null);

/**
 * The name a person sees under the icon on the phone. Older devices may report an empty label or
 * the package itself; fall back to a name the catalog knows, and only then to the package.
 */
export const displayName = (app) =>
  (app.appName && app.appName.trim() && app.appName !== app.packageName ? app.appName : null)
  ?? labelFor(app.packageName) ?? app.packageName;

/**
 * Why `pkg` is blocked on a device by something other than that device's own list, judged from
 * the device's effective (community + device) policy — or null when it isn't.
 */
export const blockedElsewhereReason = (pkg, merged) => {
  if (!merged) return null;
  if ((merged.blockedApps || []).includes(pkg)) return 'חסום ברמת הקהילה';
  const category = ALL_ITEMS.find(i => i.packages.includes(pkg))?.category;
  if (category === 'BROWSERS' && (merged.blockPack || merged.blockAllBrowsers)) return 'חסום — כל הדפדפנים חסומים';
  if (category === 'YOUTUBE' && (merged.blockPack || merged.blockYoutube)) return 'חסום — יוטיוב חסום בכל צורה';
  if (pkg === GOOGLE_PLAY_PKG && (merged.hideGooglePlay || merged.blockAllStores || merged.blockInstallApps || merged.blockPack))
    return 'חסום — Google Play חסומה';
  if (category === 'STORES' && (merged.blockPack || merged.blockAllStores || merged.blockInstallApps))
    return 'חסום — כל החנויות חסומות';
  return null;
};

/**
 * Expands a legacy `blockPack = true` into the individual category flags it used to force, so each
 * becomes an ordinary flag the editor can turn off while the effective protection is unchanged.
 */
export const expandLegacyPack = (policy) =>
  !policy.blockPack ? policy : {
    ...policy, blockPack: false,
    blockAllBrowsers: true, blockYoutube: true, blockAllStores: true, blockApkInstall: true,
  };

/** Device-override version of expandLegacyPack (null = inherit from the community). */
export const expandLegacyDevicePack = (policy, communityPackOn) => {
  if (policy.blockPack === true) {
    return { ...policy, blockPack: false, blockAllBrowsers: true, blockYoutube: true, blockAllStores: true, blockApkInstall: true };
  }
  if (policy.blockPack == null && communityPackOn) {
    return {
      ...policy, blockPack: false,
      blockAllBrowsers: policy.blockAllBrowsers ?? true,
      blockYoutube: policy.blockYoutube ?? true,
      blockAllStores: policy.blockAllStores ?? true,
      blockApkInstall: policy.blockApkInstall ?? true,
    };
  }
  return policy;
};

/** The Android app's CommunityPolicy() defaults — what a new community starts with. */
export const DEFAULT_COMMUNITY_POLICY = {
  blockInstallApps: true,
  hideGooglePlay: true,
  blockAllStores: false,
  blockApkInstall: true,
  blockPack: false,
  blockAllBrowsers: false,
  blockYoutube: false,
  blockSafeBoot: true,
  blockFactoryReset: true,
  blockUsbTransfer: false,
  maxInstalledApps: null,
  appPolicyMode: 'BLACKLIST',
  allowedApps: [],
  blockedApps: [],
  appTimeLocks: [],
  blockedActionBehavior: 'SILENT',
  approvalResolverMode: 'OWNER_ONLY',
  logsEnabled: false,
  blockWhatsAppChannels: false,
  supportWhatsApp: null,
  supportEmail: null,
  supportName: 'מנהל הקהילה',
  webFilterMode: 'NONE',
  allowedDomains: [],
  blockedDomains: [],
  lockedUntilTs: null,
  adminEmergencyCode: null,
};

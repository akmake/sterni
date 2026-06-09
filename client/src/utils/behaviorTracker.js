/**
 * ★ On-page Behavior Tracker
 * Measures real engagement per page view and reports it via navigator.sendBeacon
 * on page leave / SPA route change:
 *   - maxScrollDepth (% of page actually scrolled)
 *   - clicks + rageClicks (rapid repeated clicks in one spot — frustration signal)
 *   - activeSeconds (focused + non-idle time only — not wall-clock)
 *
 * Values are monotonic (only grow), so re-sending the same page's snapshot is safe —
 * last write wins with the most complete data. Attached server-side to the matching
 * page-view log by (fingerprint + page).
 */

import { collectDeviceInfo } from './deviceInfo.js';

const RAGE_WINDOW = 1000;   // ms between clicks to count as "rage"
const RAGE_DISTANCE = 30;   // px proximity for "same spot"
const IDLE_TIMEOUT = 30000; // 30s without input = idle (paused from active time)

let state = null;
let tickTimer = null;
let started = false;

const newState = (page) => ({
  page,
  start: Date.now(),
  activeMs: 0,
  lastActivity: Date.now(),
  maxScroll: 0,
  clicks: 0,
  rageClicks: 0,
  lastClick: null,
});

const getScrollDepth = () => {
  const el = document.documentElement;
  const scrollable = el.scrollHeight - el.clientHeight;
  if (scrollable <= 0) return 100; // page fits — counts as fully seen
  const top = el.scrollTop || window.scrollY || 0;
  return Math.min(100, Math.max(0, Math.round((top / scrollable) * 100)));
};

const markActivity = () => { if (state) state.lastActivity = Date.now(); };

const onScroll = () => {
  if (!state) return;
  state.maxScroll = Math.max(state.maxScroll, getScrollDepth());
  markActivity();
};

const onClick = (e) => {
  if (!state) return;
  state.clicks++;
  const now = Date.now();
  const lc = state.lastClick;
  if (lc && now - lc.t < RAGE_WINDOW &&
      Math.abs(e.clientX - lc.x) < RAGE_DISTANCE &&
      Math.abs(e.clientY - lc.y) < RAGE_DISTANCE) {
    state.rageClicks++;
  }
  state.lastClick = { t: now, x: e.clientX, y: e.clientY };
  markActivity();
};

// Accumulate active time only while the tab is visible and the user isn't idle
const tick = () => {
  if (!state) return;
  if (document.visibilityState === 'visible' && Date.now() - state.lastActivity < IDLE_TIMEOUT) {
    state.activeMs += 1000;
  }
};

const flush = () => {
  if (!state) return;
  // Only report page views with some signal — skip instant bounces with nothing
  const activeSeconds = Math.round(state.activeMs / 1000);
  if (activeSeconds === 0 && state.clicks === 0 && state.maxScroll === 0) return;

  let fingerprint = null;
  try { fingerprint = collectDeviceInfo()?.fingerprint || null; } catch { /* ignore */ }
  if (!fingerprint) return;

  const payload = JSON.stringify({
    fingerprint,
    page: state.page,
    scrollDepth: state.maxScroll,
    clicks: state.clicks,
    rageClicks: state.rageClicks,
    activeSeconds,
  });

  try {
    const baseURL = import.meta.env?.VITE_API_URL || '/api';
    const url = `${baseURL}/logs/behavior`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true, credentials: 'include' });
    }
  } catch { /* non-critical */ }
};

// Called on SPA navigation — flush the page we're leaving, start the new one
const onRouteChange = () => {
  const page = window.location.pathname + window.location.search;
  if (state && state.page === page) return; // no real change
  flush();
  state = newState(page);
};

export const initBehaviorTracker = () => {
  if (started || typeof window === 'undefined') return;
  started = true;

  state = newState(window.location.pathname + window.location.search);

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('click', onClick, true);
  ['mousemove', 'keydown', 'touchstart'].forEach(ev =>
    window.addEventListener(ev, markActivity, { passive: true }));

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  window.addEventListener('pagehide', flush);

  // Detect SPA route changes by patching history + listening to popstate
  const patch = (type) => {
    const orig = history[type];
    return function (...args) {
      const ret = orig.apply(this, args);
      window.dispatchEvent(new Event('locationchange'));
      return ret;
    };
  };
  history.pushState = patch('pushState');
  history.replaceState = patch('replaceState');
  window.addEventListener('popstate', onRouteChange);
  window.addEventListener('locationchange', onRouteChange);

  tickTimer = setInterval(tick, 1000);
};

export default initBehaviorTracker;

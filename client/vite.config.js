import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath, parse as parseUrl } from 'url';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── השרת בפיתוח עשוי לעבור ל-5001+ אם 5000 תפוס (server/utils/listenWithFallback.js) ──
// הוא כותב את הפורט בפועל ל-server/.dev-port; ה-proxy קורא אותו בכל בקשה,
// כך שגם אם השרת עלה אחרי Vite או עבר פורט — לא צריך להפעיל מחדש.
const DEV_PORT_FILE = path.resolve(__dirname, '../server/.dev-port');
const apiTarget = () => {
  try {
    const p = fs.readFileSync(DEV_PORT_FILE, 'utf8').trim();
    if (/^\d+$/.test(p)) return `http://localhost:${p}`;
  } catch { /* אין קובץ — ברירת מחדל */ }
  return 'http://localhost:5000';
};
// http-proxy קורא את options.target בכל בקשה — מחליפים אותו ב-getter (אובייקט URL מפורק, כמו ש-http-proxy מצפה)
const followDevPort = (_proxy, opts) => {
  Object.defineProperty(opts, 'target', {
    get: () => parseUrl(apiTarget()),
    set: () => {},
    enumerable: true,
    configurable: true,
  });
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['opo.png', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'ניהול קבוצות ואירועים',
        short_name: 'ניהול',
        description: 'מערכת לניהול פרויקטים, קבוצות ואירועים',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      // --- התיקון לשגיאה: הגדלת המגבלה ל-4MB ---
      // index.html לא נשמר ב-precache ואין NavigationRoute אליו: ניווט = NetworkFirst (מהרשת, מטמון רק כשאין רשת),
      // כך שאחרי פריסה טעינה רגילה מביאה את הגרסה החדשה. ה-SW החדש מחליף מיד את הישן (skipWaiting/clientsClaim)
      // — אחרת SW ישן שכבר מותקן היה ממשיך להגיש index.html ישן. העמוד עצמו לא נטען מחדש אוטומטית:
      // UpdateBanner (App.jsx) מציג כפתור "עדכון", כדי לא למחוק טקסט שלא נשמר.
      workbox: {
        maximumFileSizeToCacheInBytes: 4000000,
        importScripts: ['company-push.js'],
        globIgnores: ['**/index.html'],
        navigateFallback: null,
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) => request.mode === 'navigate'
              && !url.pathname.startsWith('/api/') && !url.pathname.startsWith('/uploads/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-pages',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20 },
            },
          },
        ],
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        xfwd: true,
        configure: followDevPort,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        xfwd: true,
        configure: followDevPort,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
        configure: followDevPort,
      },
    },
  },
});
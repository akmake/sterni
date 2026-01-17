import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
// ייבוא התוסף שמאפשר את ההתקנה בטלפון
import { VitePWA } from 'vite-plugin-pwa';

// This is the robust way to get the directory name in an ES module environment
const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    // כאן הגדרנו את האפליקציה כניתנת להתקנה (PWA)
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'ניהול קבוצות ואירועים', // שנה לשם המלא של האפליקציה שלך
        short_name: 'ניהול', // השם שיופיע מתחת לאייקון בטלפון
        description: 'מערכת לניהול פרויקטים, קבוצות ואירועים',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone', // זה מה שמעלים את הדפדפן ונותן תחושת אפליקציה
        icons: [
          {
            src: 'pwa-192x192.png', // וודא שהקבצים האלה קיימים בתיקיית public
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // וודא שהקבצים האלה קיימים בתיקיית public
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      // The '@' alias now points directly to the 'src' directory
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
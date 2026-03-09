import axios from 'axios';
import { collectDeviceInfo } from './deviceInfo.js';

// משתנה להחזקת הפונקציות מה-Store כדי למנוע תלות מעגלית
let authStoreApi = {
  login: () => console.warn('Auth store not initialized yet (login).'),
  logout: () => console.warn('Auth store not initialized yet (logout).'),
};

/**
 * פונקציה להזרקת ה-Store לתוך ה-API
 */
export function injectAuthStore(store) {
  authStoreApi = store;
}

// יצירת מופע Axios
const api = axios.create({
  // אם משתמשים ב-Vite Proxy, זה בסדר להשאיר /api. 
  // לייצור, עדיף להשתמש ב-import.meta.env.VITE_API_URL
  baseURL: '/api', 
  withCredentials: true,
});

let csrfTokenPromise = null;

// פונקציה להשגת טוקן CSRF (מונעת קריאות כפולות)
const getCsrfToken = () => {
  if (!csrfTokenPromise) {
    csrfTokenPromise = api.get('/csrf-token')
      .then(response => {
        const csrfToken = response.data.csrfToken;
        api.defaults.headers.common['X-CSRF-Token'] = csrfToken;
        return csrfToken;
      })
      .catch(error => {
        console.error('Failed to fetch CSRF token', error);
        csrfTokenPromise = null;
        return Promise.reject(error);
      });
  }
  return csrfTokenPromise;
};

// Interceptor לבקשות - וידוא שיש CSRF
api.interceptors.request.use(async (config) => {
  // דילוג אם הבקשה היא לקבלת הטוקן עצמו
  if (config.url === '/csrf-token') {
    return config;
  }
  
  // אם אין טוקן בהדרים, ננסה להשיג אותו
  if (!api.defaults.headers.common['X-CSRF-Token']) {
    try {
      await getCsrfToken();
    } catch (err) {
      // אם נכשלנו להשיג טוקן, ייתכן שהשרת למטה או בעיית רשת.
      // נמשיך בכל זאת כדי שהשרת יחזיר שגיאה מתאימה.
    }
  }
  
  // ── FormData — don't touch Content-Type (browser sets boundary) ──
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }

  // ── Device info — sent as header on every request ──
  try {
    const deviceInfo = collectDeviceInfo();
    config.headers['X-Device-Info'] = btoa(unescape(encodeURIComponent(JSON.stringify(deviceInfo))));
  } catch (e) {
    // Silently fail — don't break the actual request
  }

  return config;
}, (error) => Promise.reject(error));

// משתנים לניהול חידוש טוקן (Refresh Token)
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Interceptor לתשובות - טיפול בשגיאות 401/403
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ── 403 CSRF invalid — רענן טוקן ונסה שוב פעם אחת ──
    // Only retry for CSRF errors, not for auth/refresh 403 responses
    const isCsrfError = error.response?.status === 403 
      && !originalRequest._csrfRetry
      && !originalRequest.url?.includes('/auth/refresh');
    if (isCsrfError) {
      originalRequest._csrfRetry = true;
      csrfTokenPromise = null; // פינוי cache
      try {
        await getCsrfToken();
        return api(originalRequest);
      } catch (e) {
        return Promise.reject(error);
      }
    }

    // ── 401 — חידוש טוקן ──
    // דילוג על נתיבי auth (login/register/refresh) — 401 שם = אישורים שגויים, לא טוקן פג
    const skipRefreshUrls = ['/auth/login', '/auth/register', '/auth/refresh'];
    if (error.response?.status === 401 && !originalRequest._retry && !skipRefreshUrls.some(u => originalRequest.url?.includes(u))) {
      
      // אם אנחנו כבר באמצע תהליך חידוש, הכנס לתור
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(() => api(originalRequest))
        .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // בקשת חידוש טוקן
        const { data } = await api.post('/auth/refresh');
        
        // עדכון ה-Store בהצלחה
        if (data && data.user) {
          authStoreApi.login(data.user);
        }

        // שחרור התור
        processQueue(null);
        
        // שליחה מחדש של הבקשה המקורית
        return api(originalRequest);
      } catch (refreshError) {
        // במקרה של כישלון בחידוש (למשל הטוקן פג תוקף לגמרי)
        processQueue(refreshError, null);
        authStoreApi.logout(); // ניתוק המשתמש
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;
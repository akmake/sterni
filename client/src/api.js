import axios from 'axios';
import { collectDeviceInfo } from './utils/deviceInfo.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ★ CSRF Token management
let csrfToken = null;

const getCsrfToken = async () => {
  if (csrfToken) return csrfToken;
  try {
    const response = await axios.get('/api/csrf-token', { withCredentials: true });
    csrfToken = response.data.csrfToken;
    return csrfToken;
  } catch (err) {
    console.error('Failed to fetch CSRF token:', err);
    return null;
  }
};

// ★ Request interceptor — sends device info on ALL methods via header
api.interceptors.request.use(
  async (config) => {
    // ── CSRF for mutations ──
    if (['post', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
      const token = await getCsrfToken();
      if (token) {
        config.headers['X-CSRF-Token'] = token;
      }

      // FormData — don't touch Content-Type (browser sets boundary)
      if (config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      }
    }

    // ── Device info — sent as header on EVERY request (GET, POST, etc.) ──
    try {
      const deviceInfo = collectDeviceInfo();
      config.headers['X-Device-Info'] = btoa(unescape(encodeURIComponent(JSON.stringify(deviceInfo))));
    } catch (e) {
      // Silently fail — don't break the actual request
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ★ FIX: Proper 401 handling with token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve();
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // אם 403 CSRF invalid — רענן טוקן ונסה שוב פעם אחת
    if (error.response?.status === 403 && !originalRequest._csrfRetry) {
      originalRequest._csrfRetry = true;
      csrfToken = null; // פינוי cache
      const newToken = await getCsrfToken();
      if (newToken) {
        originalRequest.headers['X-CSRF-Token'] = newToken;
        return api(originalRequest);
      }
    }

    // If 401 and we haven't tried refreshing yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue requests while refreshing
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Try to refresh the token
        await axios.post(
          `${api.defaults.baseURL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        // Redirect to login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
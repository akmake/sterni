import { io } from 'socket.io-client';
import api from './api';

let socket = null;
let refreshingAuth = false;
let visibilityHooked = false;

export const getSocket = () => socket;

/**
 * ה-access token (cookie jwt) חי 15 דקות, וה-handshake של הסוקט נבדק מולו.
 * באפליקציה שנשארת פתוחה בטלפון (PWA) החיבור נופל ברקע ומנסה לחזור עם token שפג —
 * אז מרעננים את ה-token (POST /auth/refresh) ומתחברים שוב.
 */
const refreshAndReconnect = async () => {
  if (refreshingAuth || !socket) return;
  refreshingAuth = true;
  try {
    await api.post('/auth/refresh');
    socket.connect();
  } catch (_) {
    /* לא מחובר — api.js מטפל ב-logout */
  } finally {
    setTimeout(() => { refreshingAuth = false; }, 5000);
  }
};

const hookVisibility = () => {
  if (visibilityHooked || typeof document === 'undefined') return;
  visibilityHooked = true;
  // חזרה לאפליקציה (מסך נדלק / חזרה מרקע) — מוודאים שהסוקט חי
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && socket && !socket.connected) socket.connect();
  });
};

export const connectSocket = () => {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  const url = import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace('/api', '')
    : '';

  socket = io(url, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 15000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket connected');
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('Socket connection error:', err.message);
    if (/token/i.test(err.message || '')) refreshAndReconnect();
  });

  hookVisibility();
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinFamilyRoom = () => {
  if (socket?.connected) {
    socket.emit('family:join');
  }
};

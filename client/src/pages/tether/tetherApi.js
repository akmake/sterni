import axios from 'axios';

export const tetherApi = axios.create({ baseURL: '/api/tether' });

export const getToken = () => localStorage.getItem('tetherToken');
export const authHeader = () => ({ Authorization: `Bearer ${getToken()}` });

export const saveTetherSession = (token, user) => {
  localStorage.setItem('tetherToken', token);
  localStorage.setItem('tetherUser', JSON.stringify(user));
};

export const clearTetherSession = () => {
  localStorage.removeItem('tetherToken');
  localStorage.removeItem('tetherUser');
};

export const loadTetherUser = () => {
  try { return JSON.parse(localStorage.getItem('tetherUser')); } catch { return null; }
};

export const timeAgo = (ts) => {
  if (!ts) return '—';
  const s = (Date.now() - new Date(ts)) / 1000;
  if (s < 60) return 'כרגע';
  if (s < 3600) return `לפני ${Math.floor(s / 60)} דק'`;
  if (s < 86400) return `לפני ${Math.floor(s / 3600)} שע'`;
  return `לפני ${Math.floor(s / 86400)} ימים`;
};

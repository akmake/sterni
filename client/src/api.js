import axios from 'axios';

// יצירת מופע של Axios עם הגדרות בסיס
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api', // כתובת השרת
  withCredentials: true, // חובה בשביל לשלוח Cookies/Token
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor לטיפול בשגיאות גלובליות (אופציונלי אך מומלץ)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // כאן אפשר לטפל בשגיאות כמו 401 (לא מחובר)
    if (error.response && error.response.status === 401) {
       // לוגיקה של יציאה או רענון טוקן
       console.error('Unauthorized, logging out...');
    }
    return Promise.reject(error);
  }
);

export default api;
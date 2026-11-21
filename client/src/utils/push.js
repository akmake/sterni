import api from './api';

/**
 * Web Push לאפליקציה הראשית — התראות על מטלות/פרויקטים שמישהו יצר עבורך.
 * ה-service worker הוא של vite-plugin-pwa; ה-handler של push נמצא ב-public/company-push.js
 * (payload.app === 'sterni').
 * Coupled: server/routes/pushRoutes.js, server/services/assignmentNotifier.js
 */

const urlBase64ToUint8Array = (base64) => {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export const isStandalone = () =>
    window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

export const pushSupported = () =>
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const getRegistration = async () => {
    // ה-SW נרשם אוטומטית ע"י vite-plugin-pwa; מחכים שיהיה פעיל (עד 10 שניות)
    return Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, rej) => setTimeout(() => rej(new Error('service worker לא זמין')), 10000)),
    ]);
};

/**
 * מצב ההתראות במכשיר הזה:
 * 'unsupported' | 'needs-install' (iPhone בלי התקנה) | 'disabled' (השרת לא מוגדר) |
 * 'denied' | 'off' | 'on'
 */
export const getPushState = async () => {
    if (!pushSupported()) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
    if (Notification.permission === 'denied') return 'denied';
    try {
        const { data } = await api.get('/push/config');
        if (!data.enabled) return 'disabled';
        const reg = await getRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (!sub) return 'off';
        const { data: st } = await api.post('/push/status', { endpoint: sub.endpoint });
        return st.subscribed ? 'on' : 'off';
    } catch (_) {
        return 'off';
    }
};

export const enablePush = async () => {
    if (!pushSupported()) throw new Error(isIOS() ? 'באייפון צריך קודם להתקין את האתר למסך הבית' : 'הדפדפן לא תומך בהתראות');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('לא אושרה הרשאה להתראות');

    const { data } = await api.get('/push/config');
    if (!data.enabled || !data.publicKey) throw new Error('ההתראות לא מוגדרות בשרת');

    const reg = await getRegistration();
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.publicKey),
        });
    }
    await api.post('/push/subscribe', sub.toJSON());
    return true;
};

export const disablePush = async () => {
    if (!pushSupported()) return;
    const reg = await getRegistration();
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
        await api.post('/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe().catch(() => {});
    }
};

export const sendTestPush = () => api.post('/push/test');

import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { companyApi, errorMessage } from './companyApi';

const toKeyBytes = (base64) => {
  const padded = `${base64}${'='.repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
};

const isSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export default function PushSettings() {
  const [config, setConfig] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupported()) return undefined;
    let active = true;
    companyApi.pushConfig().then((value) => active && setConfig(value)).catch(() => {});
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((value) => active && setSubscription(value))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!isSupported()) {
    return <p className="text-xs text-gray-500">במכשיר הזה יש להתקין את האפליקציה למסך הבית כדי לקבל התראות.</p>;
  }
  if (!config?.enabled) return null;

  const enable = async () => {
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error('לא ניתן אישור להתראות');
        return;
      }
      const registration = await navigator.serviceWorker.ready;
      const created = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: toKeyBytes(config.public_key),
      });
      await companyApi.pushSubscribe(created.toJSON());
      setSubscription(created);
    } catch (error) {
      toast.error(errorMessage(error, 'הפעלת ההתראות נכשלה'));
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await companyApi.pushUnsubscribe(subscription.endpoint);
      await subscription.unsubscribe();
      setSubscription(null);
    } catch (error) {
      toast.error(errorMessage(error, 'כיבוי ההתראות נכשל'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold">התראות למכשיר</span>
      <button disabled={busy} onClick={subscription ? disable : enable} className="text-sm text-blue-700 underline disabled:opacity-50">
        {subscription ? 'כיבוי' : 'הפעלה'}
      </button>
    </div>
  );
}

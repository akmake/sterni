import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi } from './tetherApi';

export default function LockCommunityModal({ community, onClose }) {
  const [lockType, setLockType] = useState('30m');
  const [adminPassword, setAdminPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLock = async () => {
    if (!adminPassword) return toast.error('סיסמת מנהל נדרשת');
    setLoading(true);
    try {
      let lockedUntilTs = null;
      const now = new Date();
      if (lockType === '30m') {
        lockedUntilTs = now.getTime() + 30 * 60 * 1000;
      } else if (lockType === '8am') {
        const tmrw = new Date(now); tmrw.setDate(tmrw.getDate() + 1); tmrw.setHours(8, 0, 0, 0);
        lockedUntilTs = tmrw.getTime();
      } else if (lockType === 'unlock') {
        lockedUntilTs = 0;
      }
      await tetherApi.post(
        `/community/${community?._id || community?.id}/lock`,
        { lockedUntilTs, adminPassword },
        { headers: { Authorization: `Bearer ${localStorage.getItem('tetherToken')}` } }
      );
      toast.success('פעולת הנעילה בוצעה בהצלחה ונשלחה למכשירים');
      onClose();
    } catch {
      toast.error('שגיאה. ודא סיסמת מנהל ונסה שוב');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl max-w-sm w-full p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Lock /> נעילת קהילה זמנית</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm mb-1">סוג הפעולה:</label>
            <select value={lockType} onChange={e => setLockType(e.target.value)} className="w-full border p-2 rounded">
              <option value="30m">נעל לחצי שעה</option>
              <option value="8am">נעל עד 8:00 מחר בבוקר</option>
              <option value="unlock">בטל נעילה באופן מיידי</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">אישור בסיסמת מנהל:</label>
            <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} className="w-full border p-2 rounded" />
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">ביטול</button>
            <button disabled={loading} onClick={handleLock} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
              {loading ? 'מבצע...' : 'אשר חסימה'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

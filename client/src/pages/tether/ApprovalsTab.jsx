import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader, timeAgo } from './tetherApi';

export default function ApprovalsTab() {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/approvals/all', { headers: authHeader() });
      setApprovals(data);
    } catch { toast.error('שגיאה בטעינת בקשות'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id, status) => {
    try {
      await tetherApi.put(`/admin/approvals/${id}`, { status }, { headers: authHeader() });
      setApprovals(a => a.filter(r => r._id !== id));
      toast.success(status === 'approved' ? 'אושר' : 'נדחה');
    } catch { toast.error('שגיאה'); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div dir="rtl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-800">בקשות אישור ממתינות ({approvals.length})</h2>
        <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      {approvals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle size={40} className="mx-auto mb-3 opacity-40 text-green-500" />
          <p>אין בקשות ממתינות</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map(req => (
            <div key={req._id} className="bg-white border border-orange-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-medium text-gray-800">{req.action}</div>
                {req.packageName && <div className="text-xs text-gray-500 mt-0.5">{req.packageName}</div>}
                <div className="text-xs text-gray-400 mt-1">מכשיר: {req.deviceId?.slice(-12)} · {timeAgo(req.createdAt)}</div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => resolve(req._id, 'approved')}
                  className="flex items-center gap-1 bg-green-100 text-green-700 px-3 py-1.5 rounded-lg text-sm hover:bg-green-200 transition">
                  <CheckCircle size={14} /> אשר
                </button>
                <button onClick={() => resolve(req._id, 'rejected')}
                  className="flex items-center gap-1 bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-red-200 transition">
                  <XCircle size={14} /> דחה
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

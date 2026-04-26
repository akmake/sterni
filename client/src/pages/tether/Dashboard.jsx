import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Smartphone, AlertTriangle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader, timeAgo } from './tetherApi';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, actRes] = await Promise.all([
        tetherApi.get('/admin/dashboard', { headers: authHeader() }),
        tetherApi.get('/admin/activity',  { headers: authHeader() }),
      ]);
      setStats(statsRes.data);
      setActivity(actRes.data);
    } catch {
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'קהילות',           value: stats?.totalCommunities ?? 0,  color: 'bg-blue-50 text-blue-800',   icon: <Shield size={20} /> },
          { label: 'מכשירים פעילים',   value: stats?.totalDevices ?? 0,       color: 'bg-green-50 text-green-800', icon: <Smartphone size={20} /> },
          { label: 'בקשות ממתינות',    value: stats?.pendingApprovals ?? 0,   color: 'bg-orange-50 text-orange-800', icon: <AlertTriangle size={20} /> },
          { label: 'לא פעילים 7 ימים', value: stats?.inactiveDevices ?? 0,   color: 'bg-red-50 text-red-800',     icon: <XCircle size={20} /> },
        ].map(card => (
          <div key={card.label} className={`${card.color} rounded-xl p-4 flex items-center gap-3`}>
            {card.icon}
            <div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium">{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h2 className="font-semibold text-gray-800 mb-4">פעילות אחרונה</h2>
        {activity.length === 0
          ? <p className="text-gray-400 text-sm">אין פעילות</p>
          : (
            <ul className="divide-y divide-gray-50">
              {activity.map((a, i) => (
                <li key={i} className="py-2.5 flex justify-between items-start text-sm">
                  <div>
                    <span className="font-medium text-gray-800">{a.description}</span>
                    {a.communityName && <span className="text-gray-500 mr-1"> — {a.communityName}</span>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 mr-4">{timeAgo(a.timestamp)}</span>
                </li>
              ))}
            </ul>
          )}
      </div>
    </div>
  );
}

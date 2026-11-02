import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Smartphone, AlertTriangle, XCircle, Users, QrCode, CheckCircle, UserCog, Globe2, AppWindow, ChevronLeft,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader, timeAgo } from './tetherApi';

export default function Dashboard({ onNavigate, isSuperAdmin }) {
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
          { label: 'קהילות',           value: stats?.totalCommunities ?? 0,  color: 'bg-blue-50 text-blue-800',   icon: <Shield size={20} />, tab: 'communities' },
          { label: 'מכשירים פעילים',   value: stats?.totalDevices ?? 0,       color: 'bg-green-50 text-green-800', icon: <Smartphone size={20} />, tab: 'devices' },
          { label: 'בקשות ממתינות',    value: stats?.pendingApprovals ?? 0,   color: 'bg-orange-50 text-orange-800', icon: <AlertTriangle size={20} />, tab: 'approvals' },
          { label: 'לא פעילים 7 ימים', value: stats?.inactiveDevices ?? 0,   color: 'bg-red-50 text-red-800',     icon: <XCircle size={20} />, tab: 'devices' },
        ].map(card => (
          <button key={card.label} onClick={() => onNavigate?.(card.tab)}
            className={`${card.color} rounded-xl p-4 flex items-center gap-3 text-right hover:brightness-95 transition`}>
            {card.icon}
            <div>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="text-xs font-medium">{card.label}</div>
            </div>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <LinkGroup title="ניהול הקהילה" onNavigate={onNavigate} links={[
          { tab: 'communities', label: 'קהילות ומכשירים', icon: Users },
          { tab: 'provisioning', label: 'חיבור מכשיר חדש', icon: QrCode },
          { tab: 'approvals', label: 'אישורים ובקשות', icon: CheckCircle },
        ]} />
        {isSuperAdmin && (
          <LinkGroup title="מנהל־על" onNavigate={onNavigate} links={[
            { tab: 'admins', label: 'מנהלי קהילות ושיוך קהילות', icon: UserCog },
            { tab: 'global', label: 'סקירה כללית', icon: Globe2 },
            { tab: 'catalog', label: 'קטלוג אפליקציות', icon: AppWindow },
          ]} />
        )}
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

function LinkGroup({ title, links, onNavigate }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <h2 className="font-semibold text-gray-800 text-sm px-4 pt-3 pb-2">{title}</h2>
      <ul className="divide-y divide-gray-50">
        {links.map(({ tab, label, icon: Icon }) => (
          <li key={tab}>
            <button onClick={() => onNavigate?.(tab)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 text-right">
              <Icon size={16} className="text-gray-500" />
              <span className="flex-1">{label}</span>
              <ChevronLeft size={14} className="text-gray-300" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

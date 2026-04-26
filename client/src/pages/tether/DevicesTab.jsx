import React, { useState, useEffect, useCallback } from 'react';
import { Smartphone, Search, RefreshCw, ChevronLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader, timeAgo } from './tetherApi';
import DeviceDetailPanel from './DeviceDetailPanel';

export default function DevicesTab() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/devices', { headers: authHeader() });
      setDevices(data);
    } catch { toast.error('שגיאה בטעינת מכשירים'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = devices.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.deviceModel?.toLowerCase().includes(q) ||
           d.deviceNickname?.toLowerCase().includes(q) ||
           d.communityName?.toLowerCase().includes(q) ||
           d.deviceId?.toLowerCase().includes(q);
  });

  const onlineCount = devices.filter(d => d.isOnline).length;

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">מכשירים ({devices.length})</h2>
          <p className="text-xs text-gray-400">{onlineCount} מחוברים כרגע</p>
        </div>
        <button onClick={load} className="text-gray-400 hover:text-gray-600"><RefreshCw size={16} /></button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="חפש לפי שם, קהילה, מזהה..."
          className="w-full border border-gray-200 rounded-xl pr-9 pl-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Smartphone size={40} className="mx-auto mb-3 opacity-40" />
          <p>אין מכשירים</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(dev => {
            const ps = dev.protectionStatus || {};
            return (
              <button key={dev.deviceId} onClick={() => setSelectedDeviceId(dev.deviceId)}
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-blue-300 hover:bg-blue-50/30 transition text-right">
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dev.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-gray-900 truncate">{dev.deviceNickname || dev.deviceModel}</div>
                  <div className="text-xs text-gray-500">{dev.communityName} · {timeAgo(dev.lastSeen)}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {[
                    { val: ps.accessibilityEnabled, title: 'נגישות',      letter: 'A' },
                    { val: ps.isDeviceAdmin,         title: 'מנהל מכשיר', letter: 'M' },
                    { val: ps.vpnActive,             title: 'VPN',         letter: 'V' },
                  ].map(({ val, title, letter }) => (
                    <span key={letter} title={title}
                      className={`w-5 h-5 rounded flex items-center justify-center text-xs font-medium ${val ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                      {letter}
                    </span>
                  ))}
                </div>
                <ChevronLeft size={14} className="text-gray-400 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      {selectedDeviceId && (
        <DeviceDetailPanel
          deviceId={selectedDeviceId}
          onClose={() => setSelectedDeviceId(null)}
          onNicknameUpdated={(id, nick) => setDevices(prev => prev.map(d => d.deviceId === id ? { ...d, deviceNickname: nick || null } : d))}
          onRemoved={(id) => { setDevices(prev => prev.filter(d => d.deviceId !== id)); setSelectedDeviceId(null); }}
        />
      )}
    </div>
  );
}

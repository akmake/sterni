import React, { useState, useEffect, useCallback } from 'react';
import { Users, Shield, Plus, Copy, ChevronLeft } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';
import CommunityDetail from './CommunityDetail';
import CreateCommunityWizard from './CreateCommunityWizard';

export default function CommunitiesTab() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/communities', { headers: authHeader() });
      setCommunities(data);
    } catch { toast.error('שגיאה בטעינת קהילות'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (openId) {
    return (
      <CommunityDetail communityId={openId}
        onBack={() => { setOpenId(null); load(); }}
        onDeleted={id => { setCommunities(prev => prev.filter(c => c.id !== id)); setOpenId(null); }} />
    );
  }

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  const copyCode = (code) => { navigator.clipboard.writeText(code); toast.success('קוד הועתק'); };

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">קהילות ({communities.length})</h2>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">
          <Plus size={15} /> צור קהילה
        </button>
      </div>

      {communities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield size={40} className="mx-auto mb-3 opacity-40" />
          <p>אין קהילות עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {communities.map(c => (
            <div key={c.id} role="button" tabIndex={0} onClick={() => setOpenId(c.id)}
              onKeyDown={e => { if (e.key === 'Enter') setOpenId(c.id); }}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 hover:bg-gray-50 hover:border-blue-200 transition cursor-pointer">
              <div className="bg-blue-100 text-blue-800 rounded-lg p-2"><Users size={18} /></div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{c.name}</div>
                <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                  קוד: <span className="font-mono font-medium">{c.code}</span>
                  <button onClick={e => { e.stopPropagation(); copyCode(c.code); }} aria-label="העתק קוד" className="text-gray-400 hover:text-gray-600">
                    <Copy size={12} />
                  </button>
                  <span className="mx-1">·</span>{c.deviceCount ?? 0} מכשירים
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${c.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {c.active !== false ? 'פעיל' : 'מושבת'}
              </span>
              <ChevronLeft size={16} className="text-gray-400" />
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCommunityWizard onClose={() => setShowCreate(false)}
          onCreated={data => { setCommunities(prev => [...prev, data]); setShowCreate(false); setOpenId(data.id); }} />
      )}
    </div>
  );
}

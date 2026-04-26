import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'react-qr-code';
import {
  Users, Shield, Plus, Trash2, ChevronDown, ChevronUp,
  Copy, Smartphone, CheckCircle, XCircle, AlertTriangle, Settings, Lock,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';
import PolicyEditor from './PolicyEditor';
import LockCommunityModal from './LockCommunityModal';
import DeviceDetailPanel from './DeviceDetailPanel';

function CommunityCard({ community, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [editPolicy, setEditPolicy] = useState(false);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);
  const [showLockModal, setShowLockModal] = useState(false);
  const [approvals, setApprovals] = useState([]);

  const loadDetail = async () => {
    if (detail) return;
    setLoadingDetail(true);
    try {
      const [detRes, appRes] = await Promise.all([
        tetherApi.get(`/admin/communities/${community?._id || community?.id}`, { headers: authHeader() }),
        tetherApi.get(`/admin/communities/${community?._id || community?.id}/approvals`, { headers: authHeader() }),
      ]);
      setDetail(detRes.data);
      setApprovals(appRes.data);
    } catch {
      toast.error('שגיאה בטעינת פרטים');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleToggle = () => { if (!open) loadDetail(); setOpen(!open); };

  const onDeviceRemoved = (deviceId) => {
    setDetail(d => ({ ...d, devices: d.devices.filter(dev => dev.deviceId !== deviceId) }));
    if (selectedDeviceId === deviceId) setSelectedDeviceId(null);
  };

  const resolveApproval = async (id, status) => {
    try {
      await tetherApi.put(`/admin/approvals/${id}`, { status }, { headers: authHeader() });
      setApprovals(a => a.filter(r => r._id !== id));
      toast.success(status === 'approved' ? 'אושר' : 'נדחה');
    } catch { toast.error('שגיאה'); }
  };

  const deleteCommunity = async () => {
    if (!confirm(`למחוק את קהילה "${community.name}"?`)) return;
    try {
      await tetherApi.delete(`/admin/communities/${community?._id || community?.id}`, { headers: authHeader() });
      toast.success('קהילה נמחקה');
      onDeleted(community?._id || community?.id);
    } catch { toast.error('שגיאה במחיקה'); }
  };

  const copyCode = () => { navigator.clipboard.writeText(community.code); toast.success('קוד הועתק'); };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition text-right cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 text-blue-800 rounded-lg p-2"><Users size={18} /></div>
          <div>
            <div className="font-semibold text-gray-900">{community.name}</div>
            <div className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
              קוד: <span className="font-mono font-medium">{community.code}</span>
              <button onClick={e => { e.stopPropagation(); copyCode(); }} className="text-gray-400 hover:text-gray-600">
                <Copy size={12} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full ${community.active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {community.active !== false ? 'פעיל' : 'מושבת'}
          </span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-4 pb-4" dir="rtl">
          {showLockModal && <LockCommunityModal community={community} onClose={() => setShowLockModal(false)} />}
          {selectedDeviceId && (
            <DeviceDetailPanel
              deviceId={selectedDeviceId}
              onClose={() => setSelectedDeviceId(null)}
              onRemoved={onDeviceRemoved}
            />
          )}

          <div className="flex justify-end mb-4 pt-2">
            <button onClick={() => setShowLockModal(true)}
              className="flex items-center gap-1 bg-red-100 text-red-700 font-bold px-3 py-1.5 rounded">
              <Lock size={16} /> אפשרויות נעילת מכשירים
            </button>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center gap-3 py-4 border-b border-gray-100 mb-2">
            <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100">
              <QRCode value={community.code} size={160} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-mono font-bold tracking-widest text-blue-900">{community.code}</span>
              <button onClick={copyCode} className="text-gray-400 hover:text-gray-600 p-1 rounded" title="העתק קוד">
                <Copy size={16} />
              </button>
            </div>
            <p className="text-xs text-gray-400">סרוק את ה-QR או הכנס את הקוד באפליקציה</p>
          </div>

          {loadingDetail ? (
            <div className="text-center py-6 text-gray-400 text-sm">טוען...</div>
          ) : detail ? (
            <div className="space-y-4 pt-4">

              {/* Devices */}
              <div>
                <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <Smartphone size={16} /> מכשירים ({detail.devices?.length ?? 0})
                </h4>
                {detail.devices?.length === 0
                  ? <p className="text-xs text-gray-400">אין מכשירים</p>
                  : (
                    <div className="space-y-2">
                      {detail.devices.map(dev => (
                        <div key={dev._id || dev.deviceId}
                          className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${dev.isOnline ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <div className="min-w-0">
                              <span className="font-medium text-gray-800 truncate">{dev.deviceNickname || dev.deviceModel}</span>
                              {dev.deviceNickname && <span className="text-xs text-gray-400 mr-1"> · {dev.deviceModel}</span>}
                              {dev.isDeviceOwner && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded mr-1">DO</span>}
                            </div>
                          </div>
                          <button onClick={() => setSelectedDeviceId(dev.deviceId)}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 shrink-0" title="ניהול מכשיר">
                            <Settings size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
              </div>

              {/* Approvals */}
              {approvals.length > 0 && (
                <div>
                  <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                    <AlertTriangle size={16} className="text-orange-500" /> בקשות אישור ({approvals.length})
                  </h4>
                  <div className="space-y-2">
                    {approvals.map(req => (
                      <div key={req._id} className="bg-orange-50 rounded-lg px-3 py-2 text-sm flex items-center justify-between">
                        <div>
                          <span className="font-medium">{req.action}</span>
                          {req.packageName && <span className="text-gray-500 mr-1 text-xs">({req.packageName})</span>}
                          <div className="text-xs text-gray-400">{req.deviceId?.slice(-8)}</div>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={() => resolveApproval(req._id, 'approved')} className="p-1.5 bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <CheckCircle size={14} />
                          </button>
                          <button onClick={() => resolveApproval(req._id, 'rejected')} className="p-1.5 bg-red-100 text-red-600 rounded hover:bg-red-200">
                            <XCircle size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Policy */}
              <div>
                <button onClick={() => setEditPolicy(!editPolicy)}
                  className="flex items-center gap-2 text-sm font-semibold text-blue-800 hover:text-blue-900">
                  <Settings size={15} />
                  {editPolicy ? 'סגור פוליסי' : 'ערוך פוליסי'}
                </button>
                {editPolicy && (
                  <PolicyEditor
                    communityId={community?._id || community?.id}
                    initialPolicy={detail.community.policy}
                    onSaved={(p) => setDetail(d => ({ ...d, community: { ...d.community, policy: p } }))}
                  />
                )}
              </div>

              {/* Delete */}
              <div className="pt-2 border-t border-gray-100">
                <button onClick={deleteCommunity} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <Trash2 size={12} /> מחק קהילה
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function CommunitiesTab() {
  const [communities, setCommunities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/communities', { headers: authHeader() });
      setCommunities(data);
    } catch { toast.error('שגיאה בטעינת קהילות'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const { data } = await tetherApi.post('/admin/communities', { name: newName.trim() }, { headers: authHeader() });
      setCommunities(c => [...c, data]);
      setNewName('');
      setShowCreate(false);
      toast.success(`קהילה "${data.name}" נוצרה`);
    } catch { toast.error('שגיאה ביצירת קהילה'); }
    finally { setCreating(false); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">קהילות ({communities.length})</h2>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">
          <Plus size={15} /> צור קהילה
        </button>
      </div>

      {showCreate && (
        <form onSubmit={create} className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="שם הקהילה" required
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={creating} className="bg-blue-900 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-60">
            {creating ? '...' : 'צור'}
          </button>
          <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 hover:text-gray-700 px-2">ביטול</button>
        </form>
      )}

      {communities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Shield size={40} className="mx-auto mb-3 opacity-40" />
          <p>אין קהילות עדיין</p>
        </div>
      ) : (
        <div className="space-y-3">
          {communities.map((c) => (
            <CommunityCard key={c._id} community={c}
              onDeleted={(id) => setCommunities(prev => prev.filter(x => x._id !== id))} />
          ))}
        </div>
      )}
    </div>
  );
}

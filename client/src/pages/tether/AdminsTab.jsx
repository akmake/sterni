import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';

export default function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [communities, setCommunities] = useState([]);
  const [assigning, setAssigning] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', communityId: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [members, owned] = await Promise.all([
        tetherApi.get('/admin/members', { headers: authHeader() }),
        tetherApi.get('/admin/communities', { headers: authHeader() }),
      ]);
      setAdmins(members.data);
      setCommunities(owned.data);
    } catch (err) {
      if (err.response?.status === 403) toast.error('גישה מותרת לסופר-אדמין בלבד');
      else toast.error('שגיאה בטעינה');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createAdmin = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const { data } = await tetherApi.post('/admin/members/invite', form, { headers: authHeader() });
      setAdmins(a => [...a, data]);
      setCommunities(list => list.map(c => c.id === form.communityId ? { ...c, adminId: data.id } : c));
      setForm({ name: '', email: '', password: '', communityId: '' });
      setShowCreate(false);
      toast.success('חשבון המנהל נוצר והקהילה שויכה אליו');
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally {
      setCreating(false);
    }
  };

  const assignManager = async (communityId, adminId) => {
    if (!adminId || assigning) return;
    const manager = admins.find(a => a.id === adminId);
    const community = communities.find(c => c.id === communityId);
    if (!confirm(`להעביר את ניהול הקהילה "${community.name}" וכל מכשיריה אל ${manager.name}?`)) return;
    setAssigning(communityId);
    try {
      await tetherApi.put(`/admin/communities/${communityId}/manager`, { adminId }, { headers: authHeader() });
      setCommunities(list => list.map(c => c.id === communityId ? { ...c, adminId } : c));
      toast.success('מנהל הקהילה עודכן');
    } catch (err) { toast.error(err.response?.data?.message || 'שיוך המנהל נכשל'); }
    finally { setAssigning(null); }
  };

  const removeAdmin = async (id) => {
    if (!confirm('להסיר מנהל זה?')) return;
    try {
      await tetherApi.delete(`/admin/members/${id}`, { headers: authHeader() });
      setAdmins(a => a.map(m => m.id === id ? { ...m, active: false } : m));
      toast.success('מנהל הוסר');
    } catch { toast.error('שגיאה'); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">מנהלי קהילות ({admins.length})</h2>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">
          <Plus size={15} /> הוסף מנהל
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createAdmin} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-gray-700">חשבון אישי למנהל קהילה</h3>
          <p className="text-sm text-gray-500">האימייל הוא שם המשתמש. החשבון מעניק שליטה במכשירי הקהילה שתבחר.</p>
          {[
            { key: 'name',     placeholder: 'שם מלא',  type: 'text' },
            { key: 'email',    placeholder: 'אימייל',  type: 'email' },
            { key: 'password', placeholder: 'סיסמה',   type: 'password' },
          ].map(f => (
            <input key={f.key} type={f.type} aria-label={f.placeholder} placeholder={f.placeholder} value={form[f.key]} required
              minLength={f.key === 'password' ? 8 : undefined} disabled={creating}
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          ))}
          <label className="block text-sm text-gray-700">
            קהילה לניהול
            <select required disabled={creating} value={form.communityId}
              onChange={e => setForm(prev => ({ ...prev, communityId: e.target.value }))}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
              <option value="">בחר קהילה קיימת</option>
              {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <p className="text-xs text-gray-500">השיוך מחליף את המנהל הקודם. המכשירים, קוד הקהילה וההגדרות נשמרים. הסיסמה חייבת להכיל לפחות 8 תווים.</p>
          {communities.length === 0 && <p>יש ליצור קהילה בלשונית הקהילות לפני שיוך מנהל.</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={creating || !form.communityId} className="bg-blue-900 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-60">
              {creating ? 'יוצר...' : 'צור חשבון ושייך קהילה'}
            </button>
            <button type="button" disabled={creating} onClick={() => { setShowCreate(false); setForm(prev => ({ ...prev, password: '' })); }} className="text-gray-500 text-sm hover:text-gray-700">ביטול</button>
          </div>
        </form>
      )}

      <section className="space-y-2">
        <h3 className="font-semibold text-gray-800">שיוך קהילות למנהלים</h3>
        {communities.map(c => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="font-medium">{c.name} · {c.deviceCount} מכשירים</div>
            <label className="block text-sm text-gray-600 mt-2">
              מנהל הקהילה
              <select value={c.adminId || ''} disabled={!!assigning || creating}
                onChange={e => assignManager(c.id, e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 bg-white">
                <option value="" disabled>בחר מנהל</option>
                {admins.map(a => <option key={a.id} value={a.id} disabled={a.active === false}>
                  {a.name} · {a.email}{a.active === false ? ' (הגישה בוטלה)' : ''}
                </option>)}
              </select>
            </label>
          </div>
        ))}
      </section>

      <div className="space-y-2">
        {admins.map(a => (
          <div key={a.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800">{a.name}</div>
              <div className="text-xs text-gray-500">{a.email}</div>
              {a.active === false && <div className="text-xs text-red-600">הגישה בוטלה</div>}
              <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${a.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {a.role === 'superadmin' ? 'סופר אדמין' : 'מנהל'}
              </span>
            </div>
            {a.active !== false && a.role !== 'superadmin' && (
              <button aria-label={`בטל גישה של ${a.name}`} onClick={() => removeAdmin(a.id)} className="text-red-400 hover:text-red-600 p-1.5 rounded">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

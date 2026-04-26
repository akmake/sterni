import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';

export default function AdminsTab() {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await tetherApi.get('/admin/members', { headers: authHeader() });
      setAdmins(data);
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
      setForm({ name: '', email: '', password: '' });
      setShowCreate(false);
      toast.success('מנהל נוסף');
    } catch (err) {
      toast.error(err.response?.data?.message || 'שגיאה');
    } finally {
      setCreating(false);
    }
  };

  const removeAdmin = async (id) => {
    if (!confirm('להסיר מנהל זה?')) return;
    try {
      await tetherApi.delete(`/admin/members/${id}`, { headers: authHeader() });
      setAdmins(a => a.filter(m => m._id !== id));
      toast.success('מנהל הוסר');
    } catch { toast.error('שגיאה'); }
  };

  if (loading) return <div className="text-center py-16 text-gray-400">טוען...</div>;

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">מנהלים ({admins.length})</h2>
        <button onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-1.5 bg-blue-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-800 transition">
          <Plus size={15} /> הוסף מנהל
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createAdmin} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-gray-700">הוספת מנהל חדש</h3>
          {[
            { key: 'name',     placeholder: 'שם מלא',  type: 'text' },
            { key: 'email',    placeholder: 'אימייל',  type: 'email' },
            { key: 'password', placeholder: 'סיסמה',   type: 'password' },
          ].map(f => (
            <input key={f.key} type={f.type} placeholder={f.placeholder} value={form[f.key]} required
              onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          ))}
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="bg-blue-900 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-60">
              {creating ? '...' : 'הוסף'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-500 text-sm hover:text-gray-700">ביטול</button>
          </div>
        </form>
      )}

      <div className="space-y-2">
        {admins.map(a => (
          <div key={a._id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="font-medium text-gray-800">{a.name}</div>
              <div className="text-xs text-gray-500">{a.email}</div>
              <span className={`text-xs px-2 py-0.5 rounded-full mt-1 inline-block ${a.role === 'superadmin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {a.role === 'superadmin' ? 'סופר אדמין' : 'מנהל'}
              </span>
            </div>
            {a.active !== false && (
              <button onClick={() => removeAdmin(a._id)} className="text-red-400 hover:text-red-600 p-1.5 rounded">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

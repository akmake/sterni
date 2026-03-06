import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, Trash2, Shield, Eye, Pencil } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';

export default function ProjectSharingModal({ projectId, isOpen, onClose, onUpdate, apiBase = '/projects' }) {
  const [allUsers, setAllUsers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('view');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setSearchTerm('');
      setSelectedUser(null);
      fetchData();
    }
  }, [isOpen, projectId]);

  const fetchData = async () => {
    try {
      const [usersRes, projectRes] = await Promise.all([
        api.get('/projects/users/all'),
        api.get(`${apiBase}/${projectId}`)
      ]);
      setAllUsers(usersRes.data || []);
      setCollaborators(projectRes.data.collaborators || []);
    } catch (error) {
      toast.error('שגיאה בטעינת נתונים');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!selectedUser) return;
    try {
      const res = await api.post(`${apiBase}/${projectId}/collaborators`, {
        userId: selectedUser._id,
        role: selectedRole,
      });
      setCollaborators(res.data.collaborators || []);
      setSelectedUser(null);
      setSearchTerm('');
      setSelectedRole('view');
      toast.success('משתתף נוסף');
      onUpdate?.();
    } catch (error) {
      toast.error(error.response?.data?.message?.includes('already') ? 'כבר משתתף' : 'שגיאה');
      console.error(error);
    }
  };

  const handleRemove = async (collabId) => {
    try {
      const res = await api.delete(`${apiBase}/${projectId}/collaborators/${collabId}`);
      setCollaborators(res.data.collaborators || []);
      toast.success('משתתף הוסר');
      onUpdate?.();
    } catch (error) {
      toast.error('שגיאה בהסרה');
      console.error(error);
    }
  };

  const handleRoleChange = async (collabId, newRole) => {
    try {
      const res = await api.patch(`${apiBase}/${projectId}/collaborators/${collabId}`, { role: newRole });
      setCollaborators(res.data.collaborators || []);
      toast.success('הרשאה עודכנה');
      onUpdate?.();
    } catch (error) {
      toast.error('שגיאה בעדכון');
      console.error(error);
    }
  };

  const filteredUsers = allUsers
    .filter(u => (u.name || '').includes(searchTerm) || (u.email || '').includes(searchTerm))
    .filter(u => !collaborators.some(c => (c.userId?._id || c.userId) === u._id));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" dir="rtl">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">שיתוף פרויקט</h2>
            <p className="text-xs text-slate-400 mt-0.5">הוסף אנשים שיוכלו לצפות או לערוך</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={20} className="text-slate-400" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* --- Add User Section --- */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <UserPlus size={16} className="text-blue-500" />
              הוסף משתתף
            </h3>

            {/* Search */}
            <div className="relative">
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="סנן לפי שם..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 px-4 py-2.5 pr-10 rounded-xl text-sm border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
              />
            </div>

            {/* User list - always visible */}
            <div className="bg-slate-50 rounded-xl border border-slate-100 max-h-48 overflow-y-auto">
              {loading ? (
                <p className="text-center text-sm text-slate-400 py-6">טוען...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-6">אין משתמשים להוסיף</p>
              ) : (
                filteredUsers.map(user => (
                  <button
                    key={user._id}
                    onClick={() => { setSelectedUser(user); setSearchTerm(''); }}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-white transition-colors text-right border-b border-slate-100 last:border-0 ${
                      selectedUser?._id === user._id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
                      {(user.name || '?')[0]}
                    </div>
                    <div className="min-w-0 flex-1 text-right">
                      <p className="text-sm font-medium text-slate-800 truncate">{user.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user.email}</p>
                    </div>
                    {selectedUser?._id === user._id && (
                      <span className="text-xs text-blue-600 font-bold shrink-0">נבחר</span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* Selected user + role + add */}
            {selectedUser && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                    {(selectedUser.name || '?')[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{selectedUser.name}</p>
                    <p className="text-xs text-slate-500">{selectedUser.email}</p>
                  </div>
                  <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-red-500 p-1">
                    <X size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex bg-white rounded-lg border border-slate-200 overflow-hidden flex-1">
                    <button
                      type="button"
                      onClick={() => setSelectedRole('view')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                        selectedRole === 'view' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Eye size={13} />
                      צפייה
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedRole('edit')}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                        selectedRole === 'edit' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <Pencil size={13} />
                      עריכה
                    </button>
                  </div>
                  <button
                    onClick={handleAdd}
                    className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    הוסף
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* --- Current Collaborators --- */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
              <Shield size={16} className="text-emerald-500" />
              משתתפים ({collaborators.length})
            </h3>

            {collaborators.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400">עדיין אין משתתפים בפרויקט</p>
                <p className="text-xs text-slate-300 mt-1">חפש משתמש למעלה כדי להוסיף</p>
              </div>
            ) : (
              <div className="space-y-2">
                {collaborators.map(collab => (
                  <div
                    key={collab._id}
                    className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 hover:bg-white transition-colors group"
                  >
                    <div className="w-9 h-9 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-sm font-bold shrink-0">
                      {(collab.userId?.name || '?')[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800">{collab.userId?.name || 'משתמש'}</p>
                      <p className="text-xs text-slate-400">{collab.userId?.email}</p>
                    </div>

                    <select
                      value={collab.role}
                      onChange={(e) => handleRoleChange(collab._id, e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer"
                    >
                      <option value="view">צפייה</option>
                      <option value="edit">עריכה</option>
                    </select>

                    <button
                      onClick={() => handleRemove(collab._id)}
                      className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
          <button
            onClick={onClose}
            className="w-full bg-slate-800 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-slate-900 transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

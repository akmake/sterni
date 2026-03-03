import React, { useState, useEffect } from 'react';
import { Edit2, Trash2, Lock, Shield, User, Mail, Calendar, Save, X, Check, Plus, Scissors } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createData, setCreateData] = useState({ name: '', email: '', password: '', role: 'user' });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/admin/users');
      setUsers(response.data.data?.users || []);
    } catch (error) {
      toast.error('שגיאה בטעינת משתמשים');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (user) => {
    setEditingId(user._id);
    setEditData({
      name: user.name,
      email: user.email,
      role: user.role
    });
  };

  const handleSaveEdit = async (userId) => {
    try {
      await api.patch(`/admin/users/${userId}`, editData);
      setUsers(users.map(u => u._id === userId ? { ...u, ...editData } : u));
      setEditingId(null);
      toast.success('משתמש עודכן בהצלחה');
    } catch (error) {
      toast.error('שגיאה בעדכון משתמש');
      console.error(error);
    }
  };

  const handleChangePassword = async (userId) => {
    if (!newPassword || newPassword.length < 4) {
      toast.error('הסיסמה חייבת להיות לפחות 4 תווים');
      return;
    }

    try {
      await api.patch(`/admin/users/${userId}/password`, { newPassword });
      setShowPasswordModal(null);
      setNewPassword('');
      toast.success('סיסמה התחדשה בהצלחה');
    } catch (error) {
      toast.error('שגיאה בשינוי סיסמה');
      console.error(error);
    }
  };

  const handleChangeRole = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(users.map(u => u._id === userId ? { ...u, role: newRole } : u));
      toast.success(`תפקיד עודכן ל${newRole}`);
    } catch (error) {
      toast.error('שגיאה בשינוי תפקיד');
      console.error(error);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את ${userName}?`)) return;

    try {
      await api.delete(`/admin/users/${userId}`);
      setUsers(users.filter(u => u._id !== userId));
      toast.success('משתמש נמחק בהצלחה');
    } catch (error) {
      toast.error('שגיאה במחיקת משתמש');
      console.error(error);
    }
  };

  const handleCreateUser = async () => {
    if (!createData.name || !createData.email || !createData.password) {
      toast.error('שם, אימייל וסיסמה הם שדות חובה');
      return;
    }
    if (createData.password.length < 4) {
      toast.error('הסיסמה חייבת להיות לפחות 4 תווים');
      return;
    }
    setCreating(true);
    try {
      const response = await api.post('/admin/users', createData);
      const newUser = response.data.data?.user;
      if (newUser) setUsers([newUser, ...users]);
      setShowCreateModal(false);
      setCreateData({ name: '', email: '', password: '', role: 'user' });
      toast.success('משתמש נוצר בהצלחה');
    } catch (error) {
      toast.error(error.response?.data?.message || 'שגיאה ביצירת משתמש');
      console.error(error);
    } finally {
      setCreating(false);
    }
  };

  const handleToggleTzitzitAccess = async (userId, currentAccess) => {
    try {
      await api.patch(`/admin/users/${userId}/tzitzit-access`, { tzitzitAccess: !currentAccess });
      setUsers(users.map(u => u._id === userId ? { ...u, tzitzitAccess: !currentAccess } : u));
      toast.success(!currentAccess ? 'גישה לציציות הופעלה' : 'גישה לציציות בוטלה');
    } catch (error) {
      toast.error('שגיאה בעדכון הגישה');
      console.error(error);
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">ניהול משתמשים</h1>
          <p className="text-gray-600 mt-1">ניהול משתמשים, הרשאות וסיסמאות</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={18} />
            יצירת משתמש
          </button>
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-semibold">
            {users.length} משתמשים
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <p className="text-gray-500">טוען משתמשים...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <User size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">אין משתמשים במערכת</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b-2 border-gray-300">
                <th className="px-4 py-3 text-right font-bold">שם</th>
                <th className="px-4 py-3 text-right font-bold">מייל</th>
                <th className="px-4 py-3 text-right font-bold">תפקיד</th>
                <th className="px-4 py-3 text-right font-bold">ציציות</th>
                <th className="px-4 py-3 text-right font-bold">הצטרפות</th>
                <th className="px-4 py-3 text-right font-bold">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id} className="border-b hover:bg-gray-50">
                  {editingId === user._id ? (
                    <>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="email"
                          value={editData.email}
                          onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                          className="w-full border border-gray-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={editData.role}
                          onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                          className="border border-gray-300 rounded px-2 py-1 bg-white"
                        >
                          <option value="user">משתמש</option>
                          <option value="admin">מנהל</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">-</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(user._id)}
                            className="flex items-center gap-1 text-green-600 hover:bg-green-50 px-2 py-1 rounded text-sm"
                            title="שמור"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 text-gray-600 hover:bg-gray-100 px-2 py-1 rounded text-sm"
                            title="בטל"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-medium">{user.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {user.role === 'admin' ? (
                            <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 px-3 py-1 rounded text-sm font-semibold">
                              <Shield size={14} /> מנהל
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-800 px-3 py-1 rounded text-sm">
                              משתמש
                            </span>
                          )}
                          <button
                            onClick={() => handleChangeRole(
                              user._id,
                              user.role === 'admin' ? 'user' : 'admin'
                            )}
                            className="text-xs text-blue-600 hover:bg-blue-50 px-2 py-1 rounded"
                            title={user.role === 'admin' ? 'הורד לחבר' : 'הקדם למנהל'}
                          >
                            {user.role === 'admin' ? 'הורד' : 'הקדם'}
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                          <button
                            onClick={() => handleToggleTzitzitAccess(user._id, user.tzitzitAccess)}
                            className={`inline-flex items-center gap-1 px-3 py-1 rounded text-sm font-medium transition-colors ${
                              user.tzitzitAccess
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                            title={user.tzitzitAccess ? 'לחץ לביטול גישה' : 'לחץ להפעלת גישה'}
                          >
                            <Scissors size={14} />
                            {user.tzitzitAccess ? 'מופעל' : 'כבוי'}
                          </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString('he-IL')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditStart(user)}
                            className="flex items-center gap-1 text-blue-600 hover:bg-blue-50 px-3 py-1 rounded text-sm"
                            title="עריכה"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => setShowPasswordModal(user._id)}
                            className="flex items-center gap-1 text-yellow-600 hover:bg-yellow-50 px-3 py-1 rounded text-sm"
                            title="שינוי סיסמה"
                          >
                            <Lock size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteUser(user._id, user.name)}
                            className="flex items-center gap-1 text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm"
                            title="מחיקה"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full space-y-4 p-6">
            <h2 className="text-lg font-bold text-gray-900">שינוי סיסמה</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">סיסמה חדשה</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="הזן סיסמה חדשה"
                className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">מינימום 4 תווים</p>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={() => handleChangePassword(showPasswordModal)}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700"
              >
                שינוי סיסמה
              </button>
              <button
                onClick={() => {
                  setShowPasswordModal(null);
                  setNewPassword('');
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded font-semibold hover:bg-gray-300"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full space-y-4 p-6">
            <h2 className="text-lg font-bold text-gray-900">יצירת משתמש חדש</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם</label>
                <input
                  type="text"
                  value={createData.name}
                  onChange={(e) => setCreateData({ ...createData, name: e.target.value })}
                  placeholder="שם מלא"
                  className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">אימייל</label>
                <input
                  type="email"
                  value={createData.email}
                  onChange={(e) => setCreateData({ ...createData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">סיסמה</label>
                <input
                  type="password"
                  value={createData.password}
                  onChange={(e) => setCreateData({ ...createData, password: e.target.value })}
                  placeholder="סיסמה (מינימום 4 תווים)"
                  className="w-full border border-gray-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תפקיד</label>
                <select
                  value={createData.role}
                  onChange={(e) => setCreateData({ ...createData, role: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="user">משתמש</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleCreateUser}
                disabled={creating}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded font-semibold hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'יוצר...' : 'צור משתמש'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateData({ name: '', email: '', password: '', role: 'user' });
                }}
                className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded font-semibold hover:bg-gray-300"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

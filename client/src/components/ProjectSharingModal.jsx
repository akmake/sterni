import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api.js';

export default function ProjectSharingModal({ projectId, isOpen, onClose, onUpdate }) {
  const [allUsers, setAllUsers] = useState([]);
  const [collaborators, setCollaborators] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState('view');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchUsersAndCollaborators();
    }
  }, [isOpen, projectId]);

  const fetchUsersAndCollaborators = async () => {
    try {
      const [usersRes, projectRes] = await Promise.all([
        api.get('/admin/users'),
        api.get(`/projects/${projectId}`)
      ]);
      
      setAllUsers(usersRes.data.data?.users || []);
      setCollaborators(projectRes.data.collaborators || []);
    } catch (error) {
      toast.error('שגיאה בטעינת נתונים');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedUser) {
      toast.error('בחר משתמש');
      return;
    }

    try {
      const response = await api.post(`/projects/${projectId}/collaborators`, {
        userId: selectedUser._id,
        role: selectedRole
      });
      
      setCollaborators(response.data.collaborators || response.data.data?.project?.collaborators || []);
      setSelectedUser(null);
      setSelectedRole('view');
      setSearchTerm('');
      toast.success('משתתף נוסף בהצלחה');
      onUpdate && onUpdate();
    } catch (error) {
      if (error.response?.data?.message?.includes('already')) {
        toast.error('משתמש זה כבר משתתף בפרויקט');
      } else {
        toast.error('שגיאה בהוספת משתתף');
      }
      console.error(error);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId) => {
    try {
      const response = await api.delete(
        `/projects/${projectId}/collaborators/${collaboratorId}`
      );
      
      setCollaborators(response.data.collaborators || []);
      toast.success('משתתף הוסר בהצלחה');
      onUpdate && onUpdate();
    } catch (error) {
      toast.error('שגיאה בהסרת משתתף');
      console.error(error);
    }
  };

  const handleChangeRole = async (collaboratorId, newRole) => {
    try {
      const response = await api.patch(
        `/projects/${projectId}/collaborators/${collaboratorId}`,
        { role: newRole }
      );
      
      setCollaborators(response.data.collaborators || []);
      toast.success('הרשאות עודכנו');
      onUpdate && onUpdate();
    } catch (error) {
      toast.error('שגיאה בעדכון הרשאות');
      console.error(error);
    }
  };

  const filteredUsers = allUsers.filter(user =>
    user.name.includes(searchTerm) || user.email.includes(searchTerm)
  ).filter(user => 
    !collaborators.some(c => c.userId._id === user._id)
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-96 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center border-b p-6">
          <h2 className="text-2xl font-bold text-gray-800">שתף פרויקט</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 gap-6">
          {/* Left: Add Users */}
          <div className="border-l pl-6">
            <h3 className="font-bold text-lg mb-4">הוסף משתמש</h3>
            
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search size={18} className="absolute right-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="חפש שם או אימייל..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Users List */}
            <div className="space-y-2 max-h-40 overflow-y-auto mb-4">
              {filteredUsers.length > 0 ? (
                filteredUsers.map(user => (
                  <button
                    key={user._id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full text-right p-3 rounded-lg border-2 transition ${
                      selectedUser?._id === user._id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-sm">{user.name}</div>
                    <div className="text-xs text-gray-500">{user.email}</div>
                  </button>
                ))
              ) : (
                <div className="text-center text-gray-500 py-4">
                  {searchTerm ? 'לא נמצאו משתמשים' : 'כל המשתמשים כבר משתתפים'}
                </div>
              )}
            </div>

            {/* Role Selection */}
            {selectedUser && (
              <div className="mb-4">
                <label className="text-sm font-semibold mb-2 block">הרשאות:</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full border rounded-lg p-2 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="view">צפייה בלבד</option>
                  <option value="edit">עריכה</option>
                </select>
              </div>
            )}

            {/* Add Button */}
            <button
              onClick={handleAddCollaborator}
              disabled={!selectedUser}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
            >
              <Plus size={18} />
              הוסף משתתף
            </button>
          </div>

          {/* Right: Collaborators */}
          <div>
            <h3 className="font-bold text-lg mb-4">משתתפים</h3>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {collaborators.length > 0 ? (
                collaborators.map(collab => (
                  <div
                    key={collab._id}
                    className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 text-right">
                      <div className="font-semibold text-sm">
                        {collab.userId?.name || 'משתמש'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {collab.userId?.email}
                      </div>
                    </div>
                    <select
                      value={collab.role}
                      onChange={(e) => handleChangeRole(collab._id, e.target.value)}
                      className="border rounded px-2 py-1 text-xs focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="view">צפייה</option>
                      <option value="edit">עריכה</option>
                    </select>
                    <button
                      onClick={() => handleRemoveCollaborator(collab._id)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-500 py-8">
                  עדיין אין משתתפים
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
}

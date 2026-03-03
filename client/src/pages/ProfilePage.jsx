import React, { useState, useEffect } from 'react';
import { User, Mail, Shield, Calendar, Edit2, Save, X, Lock, Eye, EyeOff, Check } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '@/utils/api';
import { useAuthStore } from '@/stores/authStore';

export default function ProfilePage() {
  const { user: authUser, login } = useAuthStore();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editData, setEditData] = useState({ name: '', email: '' });

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await api.get('/auth/profile');
      const userData = response.data.data?.user;
      setProfile(userData);
      setEditData({ name: userData.name, email: userData.email });
    } catch (error) {
      toast.error('שגיאה בטעינת הפרופיל');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!editData.name.trim()) {
      toast.error('שם הוא שדה חובה');
      return;
    }
    if (!editData.email.trim()) {
      toast.error('אימייל הוא שדה חובה');
      return;
    }

    setSaving(true);
    try {
      const response = await api.patch('/auth/profile', editData);
      const updatedUser = response.data.data?.user;
      setProfile(prev => ({ ...prev, ...updatedUser }));
      
      // Update authStore so navbar reflects changes
      login(updatedUser);
      
      setIsEditing(false);
      toast.success('הפרופיל עודכן בהצלחה');
    } catch (error) {
      toast.error(error.response?.data?.message || 'שגיאה בעדכון הפרופיל');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordData;

    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error('יש למלא את כל השדות');
      return;
    }

    if (newPassword.length < 4) {
      toast.error('הסיסמה החדשה חייבת להכיל לפחות 4 תווים');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('הסיסמאות החדשות אינן תואמות');
      return;
    }

    setChangingPassword(true);
    try {
      await api.patch('/auth/change-password', { currentPassword, newPassword });
      toast.success('הסיסמה שונתה בהצלחה');
      setShowPasswordForm(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.message || 'שגיאה בשינוי הסיסמה');
      console.error(error);
    } finally {
      setChangingPassword(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleBadge = (role) => {
    if (role === 'admin') {
      return (
        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-700">
          <Shield size={14} />
          מנהל מערכת
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
        <User size={14} />
        משתמש
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8" dir="rtl">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">פרופיל אישי</h1>
        <p className="text-gray-600 mt-2">ניהול פרטי החשבון שלך</p>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header with Avatar */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-12">
          <div className="flex flex-col items-center">
            <div className="h-24 w-24 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white text-4xl font-bold shadow-lg border-4 border-white/30">
              {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h2 className="mt-4 text-2xl font-bold text-white">{profile?.name}</h2>
            <p className="text-blue-100">{profile?.email}</p>
            <div className="mt-3">
              {getRoleBadge(profile?.role)}
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="p-8">
          {/* Info Section */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">פרטים אישיים</h3>
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit2 size={18} />
                עריכה
              </button>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {saving ? (
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Save size={18} />
                  )}
                  שמירה
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditData({ name: profile?.name, email: profile?.email });
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X size={18} />
                  ביטול
                </button>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Name Field */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <User className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-500 mb-1">שם מלא</label>
                {isEditing ? (
                  <input
                    type="text"
                    value={editData.name}
                    onChange={(e) => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-lg font-medium text-gray-900">{profile?.name}</p>
                )}
              </div>
            </div>

            {/* Email Field */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <Mail className="h-6 w-6 text-green-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-500 mb-1">כתובת אימייל</label>
                {isEditing ? (
                  <input
                    type="email"
                    value={editData.email}
                    onChange={(e) => setEditData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    dir="ltr"
                  />
                ) : (
                  <p className="text-lg font-medium text-gray-900" dir="ltr">{profile?.email}</p>
                )}
              </div>
            </div>

            {/* Role Field (Read Only) */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-500 mb-1">תפקיד</label>
                <p className="text-lg font-medium text-gray-900">
                  {profile?.role === 'admin' ? 'מנהל מערכת' : 'משתמש רגיל'}
                </p>
              </div>
            </div>

            {/* Created At Field */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <label className="block text-sm text-gray-500 mb-1">תאריך הצטרפות</label>
                <p className="text-lg font-medium text-gray-900">{formatDate(profile?.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password Change Section */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <Lock className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-800">שינוי סיסמה</h3>
                <p className="text-sm text-gray-500">עדכן את הסיסמה שלך לאבטחה טובה יותר</p>
              </div>
            </div>
            {!showPasswordForm && (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
              >
                <Lock size={18} />
                שנה סיסמה
              </button>
            )}
          </div>

          {showPasswordForm && (
            <div className="mt-6 p-6 bg-gray-50 rounded-xl space-y-4">
              {/* Current Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סיסמה נוכחית</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="הזן את הסיסמה הנוכחית"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">סיסמה חדשה</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="הזן סיסמה חדשה (לפחות 4 תווים)"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">אימות סיסמה חדשה</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="הזן שוב את הסיסמה החדשה"
                    dir="ltr"
                  />
                  {passwordData.confirmPassword && passwordData.newPassword === passwordData.confirmPassword && (
                    <Check className="absolute left-3 top-1/2 -translate-y-1/2 text-green-500" size={20} />
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleChangePassword}
                  disabled={changingPassword}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {changingPassword ? (
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Check size={18} />
                      שמור סיסמה חדשה
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  }}
                  className="px-6 py-3 text-gray-600 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

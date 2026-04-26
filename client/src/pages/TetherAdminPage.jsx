import React, { useState } from 'react';
import { Shield, LogOut } from 'lucide-react';
import { loadTetherUser, clearTetherSession } from './tether/tetherApi';
import TetherLogin    from './tether/TetherLogin';
import Dashboard      from './tether/Dashboard';
import CommunitiesTab from './tether/CommunitiesTab';
import DevicesTab     from './tether/DevicesTab';
import ApprovalsTab   from './tether/ApprovalsTab';
import AdminsTab      from './tether/AdminsTab';

const TABS = [
  { id: 'dashboard',   label: 'דשבורד' },
  { id: 'communities', label: 'קהילות' },
  { id: 'devices',     label: 'מכשירים' },
  { id: 'approvals',   label: 'אישורים' },
  { id: 'admins',      label: 'מנהלים' },
];

export default function TetherAdminPage() {
  const [tetherUser, setTetherUser] = useState(() => loadTetherUser());
  const [activeTab, setActiveTab] = useState('dashboard');

  const handleLogout = () => { clearTetherSession(); setTetherUser(null); };

  if (!tetherUser) return <TetherLogin onLogin={setTetherUser} />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-blue-900 text-white rounded-xl p-2.5">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Tether</h1>
            <p className="text-xs text-gray-500">
              שלום, {tetherUser.name} · {tetherUser.role === 'superadmin' ? 'סופר אדמין' : 'מנהל'}
            </p>
          </div>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition">
          <LogOut size={14} /> התנתק
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 text-sm font-medium py-1.5 rounded-lg transition ${
              activeTab === tab.id ? 'bg-white text-blue-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'dashboard'   && <Dashboard />}
      {activeTab === 'communities' && <CommunitiesTab />}
      {activeTab === 'devices'     && <DevicesTab />}
      {activeTab === 'approvals'   && <ApprovalsTab />}
      {activeTab === 'admins'      && <AdminsTab />}
    </div>
  );
}

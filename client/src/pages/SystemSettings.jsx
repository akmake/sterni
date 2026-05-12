import React, { useState, useEffect } from 'react';
import { Save, Plus, Server, Mail, MessageSquare, DollarSign, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import * as settingsService from '../services/settingsService';

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('accounts'); 
  const [accounts, setAccounts] = useState([]);
  const [config, setConfig] = useState({ 
    financeEmailId: '', 
    opsEmailId: '', 
    targetWhatsAppEmail: '' // השדה החדש
  });
  const [loading, setLoading] = useState(true);

  // טופס חשבון
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    friendlyName: '', host: 'smtp.gmail.com', port: 587, user: '', password: ''
  });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [accData, confData] = await Promise.all([
        settingsService.getAccounts(),
        settingsService.getSystemConfig()
      ]);
      setAccounts(accData);
      setConfig(confData || { financeEmailId: '', opsEmailId: '', targetWhatsAppEmail: '' });
    } catch (error) {
      toast.error('שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccount = async (e) => {
    e.preventDefault();
    try {
      await settingsService.saveAccount({ ...form, id: editingId || undefined });
      toast.success(editingId ? 'חשבון עודכן' : 'חשבון נשמר');
      setIsEditing(false);
      setEditingId(null);
      setForm({ friendlyName: '', host: 'smtp.gmail.com', port: 587, user: '', password: '' });
      fetchData();
    } catch (error) {
      toast.error('שגיאה בשמירה');
    }
  };

  const handleEditAccount = async (acc) => {
    setEditingId(acc._id);
    setShowPassword(false);
    setForm({ friendlyName: acc.friendlyName, host: acc.host, port: acc.port, user: acc.user, password: '' });
    try {
      const pwd = await settingsService.getAccountPassword(acc._id);
      setForm(prev => ({ ...prev, password: pwd }));
    } catch {
      toast.error('שגיאה בטעינת סיסמה');
    }
    setIsEditing(true);
  };

  const handleDeleteAccount = async (id) => {
    if (!window.confirm('למחוק חשבון זה?')) return;
    try {
      await settingsService.deleteAccount(id);
      toast.success('חשבון נמחק');
      fetchData();
    } catch {
      toast.error('שגיאה במחיקה');
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingId(null);
    setShowPassword(false);
    setForm({ friendlyName: '', host: 'smtp.gmail.com', port: 587, user: '', password: '' });
  };

  const handleSaveConfig = async () => {
    try {
      await settingsService.updateRouting(config);
      toast.success('ההגדרות נשמרו בהצלחה!');
    } catch (error) {
      toast.error('שגיאה בשמירה');
    }
  };

  const handleTestConnection = async () => {
      try {
        await settingsService.testConnection(form);
        toast.success('חיבור תקין!');
      } catch (e) { toast.error('חיבור נכשל'); }
  };

  if (loading) return <div className="p-10 text-center">טוען...</div>;

  return (
    <div className="max-w-5xl mx-auto p-8 bg-white rounded-xl shadow-lg my-10 font-sans" dir="rtl">
      <h1 className="text-3xl font-bold mb-8 text-gray-800 flex items-center gap-2">
        <Server className="text-blue-600"/> מרכז הגדרות תקשורת
      </h1>

      {/* תפריט ניווט עליון */}
      <div className="flex gap-4 mb-8 bg-gray-100 p-1 rounded-lg">
        <button onClick={() => setActiveTab('accounts')} className={`flex-1 py-3 rounded-md font-bold transition-all flex justify-center items-center gap-2 ${activeTab === 'accounts' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}>
          <Server size={18}/> מאגר חשבונות מייל
        </button>
        <button onClick={() => setActiveTab('finance')} className={`flex-1 py-3 rounded-md font-bold transition-all flex justify-center items-center gap-2 ${activeTab === 'finance' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:bg-gray-200'}`}>
          <DollarSign size={18}/> הגדרות כספים (הצעות/תשלום)
        </button>
        <button onClick={() => setActiveTab('whatsapp')} className={`flex-1 py-3 rounded-md font-bold transition-all flex justify-center items-center gap-2 ${activeTab === 'whatsapp' ? 'bg-white shadow text-teal-600' : 'text-gray-500 hover:bg-gray-200'}`}>
          <MessageSquare size={18}/> הגדרות וואצאפ ותפעול
        </button>
      </div>

      {/* --- טאב 1: מאגר חשבונות --- */}
      {activeTab === 'accounts' && (
        <div>
          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">חשבונות מחוברים</h2>
                <button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold"><Plus size={18}/> הוסף חשבון</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map(acc => (
                  <div key={acc._id} className="border p-4 rounded-lg bg-gray-50 flex justify-between items-center">
                    <div>
                      <div className="font-bold text-lg">{acc.friendlyName}</div>
                      <div className="text-gray-500 text-sm">{acc.user}</div>
                      <div className="text-xs text-gray-400 mt-1">{acc.host}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                      <button onClick={() => handleEditAccount(acc)} className="p-2 rounded hover:bg-blue-100 text-blue-600" title="ערוך"><Pencil size={16}/></button>
                      <button onClick={() => handleDeleteAccount(acc._id)} className="p-2 rounded hover:bg-red-100 text-red-500" title="מחק"><Trash2 size={16}/></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveAccount} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
               <h3 className="font-bold text-lg mb-4">{editingId ? 'עריכת חשבון' : 'הוספת חשבון חדש'}</h3>
               <div className="grid grid-cols-2 gap-4 mb-6">
                 <div><label className="text-sm font-bold">שם מזהה</label><input required className="w-full p-2 border rounded" value={form.friendlyName} onChange={e=>setForm({...form, friendlyName:e.target.value})} placeholder="למשל: מייל כספים"/></div>
                 <div><label className="text-sm font-bold">כתובת מייל</label><input required className="w-full p-2 border rounded" value={form.user} onChange={e=>setForm({...form, user:e.target.value})}/></div>
                 <div><label className="text-sm font-bold">שרת (Host)</label><input required className="w-full p-2 border rounded" value={form.host} onChange={e=>setForm({...form, host:e.target.value})}/></div>
                 <div>
                   <label className="text-sm font-bold">סיסמת אפליקציה</label>
                   <div className="relative">
                     <input required type={showPassword ? 'text' : 'password'} className="w-full p-2 border rounded pr-10" value={form.password} onChange={e=>setForm({...form, password:e.target.value})}/>
                     <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                       {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                     </button>
                   </div>
                 </div>
               </div>
               <div className="flex gap-3 justify-end">
                 <button type="button" onClick={handleTestConnection} className="bg-amber-500 text-white px-4 py-2 rounded">בדוק חיבור</button>
                 <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">שמור</button>
                 <button type="button" onClick={handleCancelEdit} className="text-gray-500 px-4 py-2">ביטול</button>
               </div>
            </form>
          )}
        </div>
      )}

      {/* --- טאב 2: כספים --- */}
      {activeTab === 'finance' && (
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="bg-green-50 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto text-green-600 mb-4"><DollarSign size={40}/></div>
          <h2 className="text-2xl font-bold">מי שולח הצעות מחיר ודרישות תשלום?</h2>
          <p className="text-gray-500">בחר איזה חשבון מייל יוצג ללקוח כשהוא מקבל מסמכים רשמיים.</p>
          
          <div className="text-right bg-gray-50 p-6 rounded-xl border">
            <label className="block font-bold mb-2 text-gray-700">בחר חשבון שולח:</label>
            <select className="w-full p-3 border rounded-lg bg-white text-lg" value={config.financeEmailId || ''} onChange={e => setConfig({...config, financeEmailId: e.target.value})}>
              <option value="">-- בחר חשבון --</option>
              {accounts.map(acc => <option key={acc._id} value={acc._id}>{acc.friendlyName} ({acc.user})</option>)}
            </select>
          </div>
          <button onClick={handleSaveConfig} className="bg-green-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-green-700 shadow-lg w-full">שמור הגדרות כספים</button>
        </div>
      )}

      {/* --- טאב 3: וואצאפ ותפעול --- */}
      {activeTab === 'whatsapp' && (
        <div className="max-w-2xl mx-auto space-y-6">
           <div className="bg-teal-50 p-6 rounded-full w-20 h-20 flex items-center justify-center mx-auto text-teal-600 mb-4"><MessageSquare size={40}/></div>
           <h2 className="text-2xl font-bold text-center">גישור מייל-וואצאפ</h2>
           <p className="text-center text-gray-500">הגדר איך המערכת ממירה הודעות וואצאפ למייל ולהפך.</p>

           <div className="bg-gray-50 p-6 rounded-xl border space-y-6">
             {/* שולח */}
             <div>
               <label className="block font-bold mb-2 text-gray-700">1. מייל השולח (המייל הטכני):</label>
               <p className="text-xs text-gray-400 mb-1">המייל הזה ישלח את ההתראות אליך.</p>
               <select className="w-full p-3 border rounded-lg bg-white" value={config.opsEmailId || ''} onChange={e => setConfig({...config, opsEmailId: e.target.value})}>
                  <option value="">-- בחר חשבון --</option>
                  {accounts.map(acc => <option key={acc._id} value={acc._id}>{acc.friendlyName} ({acc.user})</option>)}
               </select>
             </div>

             <div className="border-t border-gray-200"></div>

             {/* מקבל (השדה שהיה חסר!) */}
             <div>
               <label className="block font-bold mb-2 text-gray-700">2. מייל היעד (איפה אתה קורא את ההודעות?):</label>
               <p className="text-xs text-gray-400 mb-1">לכתובת הזו יגיעו כל ההודעות שנכנסות לוואצאפ.</p>
               <input 
                  type="email" 
                  className="w-full p-3 border rounded-lg" 
                  placeholder="my-personal-email@gmail.com"
                  value={config.targetWhatsAppEmail || ''}
                  onChange={e => setConfig({...config, targetWhatsAppEmail: e.target.value})}
               />
             </div>
           </div>

           <button onClick={handleSaveConfig} className="bg-teal-600 text-white px-8 py-3 rounded-lg font-bold text-lg hover:bg-teal-700 shadow-lg w-full">שמור הגדרות וואצאפ</button>
        </div>
      )}

    </div>
  );
};

export default SystemSettings;
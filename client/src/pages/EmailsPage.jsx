import { useState, useEffect } from 'react';
// 👇 התיקון: שימוש ב-api המרכזי של הפרויקט
import api from '../utils/api'; 
import { Mail, Clock, CheckCircle, RefreshCw, Search } from 'lucide-react';

const EmailsPage = () => {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchEmails = async () => {
    setLoading(true);
    try {
      // ✅ קריאה נקייה דרך api.js (כולל קוקיז אוטומטי)
      const res = await api.get('/emails');
      setEmails(res.data);
    } catch (err) {
      console.error("Error fetching emails:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmails();
    const interval = setInterval(fetchEmails, 15000); 
    return () => clearInterval(interval);
  }, []);

  const updateStatus = async (id, newStatus) => {
    try {
      // עדכון אופטימיסטי בסטייט
      setEmails(prev => prev.map(email => 
        email._id === id ? { ...email, status: newStatus } : email
      ));

      // ✅ שליחה דרך api.js (בלי headers ידניים)
      await api.patch(`/emails/${id}/status`, { status: newStatus });
    
    } catch (err) {
      console.error("Error updating status:", err);
      // במקרה שגיאה נרענן את הנתונים
      fetchEmails();
      // ה-api.js שלך כבר יקפיץ את המשתמש ללוגין אם ה-Token פג תוקף (401)
    }
  };

  const getStatusStyle = (status) => {
    switch(status) {
      case 'new': return 'bg-blue-50 text-blue-600 ring-blue-500/20';
      case 'in_progress': return 'bg-orange-50 text-orange-600 ring-orange-500/20';
      case 'done': return 'bg-green-50 text-green-600 ring-green-500/20 opacity-60';
      default: return 'bg-gray-50 text-gray-600';
    }
  };

  const getStatusIcon = (status) => {
    switch(status) {
      case 'new': return <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />;
      case 'in_progress': return <Clock size={14} />;
      case 'done': return <CheckCircle size={14} />;
      default: return null;
    }
  };

  // סינון לפי חיפוש
  const filteredEmails = emails.filter(email => 
    email.fromName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 font-sans text-gray-900">
      
      {/* Header Area */}
      <div className="max-w-7xl mx-auto mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-[#1D1D1F]">תיבת פניות</h1>
            <p className="text-gray-500 mt-1 text-sm font-medium">
              {emails.length} הודעות סה"כ • מתעדכן אוטומטית
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-gray-200/60">
            <div className="relative group">
              <Search className="absolute right-3 top-2.5 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="חיפוש..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 pl-4 py-2 bg-transparent text-sm w-48 focus:w-64 transition-all duration-300 outline-none placeholder-gray-400"
              />
            </div>
            <div className="w-px h-6 bg-gray-200 mx-1"></div>
            <button 
              onClick={fetchEmails} 
              className={`p-2 rounded-xl hover:bg-gray-100 transition-colors text-gray-500 ${loading ? 'animate-spin' : ''}`}
            >
              <RefreshCw size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Area */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmails.map((email) => (
          <div 
            key={email._id} 
            className="group bg-white rounded-3xl p-6 shadow-[0_2px_12px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] transition-all duration-300 border border-white hover:border-blue-500/10 flex flex-col h-[280px]"
          >
            {/* Top Row: Sender & Date */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-gray-100 to-gray-200 flex items-center justify-center text-gray-600 font-bold text-sm shadow-inner">
                  {email.fromName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm leading-tight">{email.fromName}</h3>
                  <p className="text-gray-400 text-xs mt-0.5">{email.fromAddress}</p>
                </div>
              </div>
              <span className="text-[11px] font-medium text-gray-400 bg-gray-50 px-2 py-1 rounded-full">
                {new Date(email.receivedAt).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute:'2-digit' })}
              </span>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-hidden relative">
              <h4 className="font-bold text-gray-800 mb-2 truncate">{email.subject}</h4>
              <p className="text-gray-500 text-sm leading-relaxed line-clamp-4">
                {email.body}
              </p>
              {/* Fade out effect at bottom of text */}
              <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent"></div>
            </div>

            {/* Bottom Row: Actions */}
            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
              
              <div className="relative">
                <select 
                  value={email.status}
                  onChange={(e) => updateStatus(email._id, e.target.value)}
                  className={`appearance-none pl-8 pr-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-colors focus:outline-none ring-1 ring-inset ${getStatusStyle(email.status)}`}
                >
                  <option value="new">חדש</option>
                  <option value="in_progress">בטיפול</option>
                  <option value="done">טופל</option>
                </select>
                {/* Custom Icon Overlay */}
                <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                   {getStatusIcon(email.status)}
                </div>
              </div>

              <button className="text-gray-300 hover:text-blue-500 transition-colors">
                <Mail size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>
      
      {filteredEmails.length === 0 && !loading && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <Mail size={24} />
          </div>
          <h3 className="text-gray-500 font-medium">אין הודעות להצגה</h3>
        </div>
      )}
    </div>
  );
};

export default EmailsPage;
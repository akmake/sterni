import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import { Plus, Users, Calendar, Trash2, Archive, LayoutGrid } from 'lucide-react'; // הוספתי אייקונים
import { Button } from '@/components/ui/button';

export default function GroupsPage() {
  const { groups, fetchGroups, deleteGroup } = useGroupsStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('active'); // 'active' or 'archive'

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation(); 
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הקבוצה הזו?')) {
      await deleteGroup(id);
    }
  };

  // --- לוגיקה של מיון וסינון לארכיון ---
  const processGroups = () => {
    const now = new Date();
    // מאפסים שעות כדי להשוות ימים נטו (אופציונלי, תלוי ברמת הדיוק שרצית)
    now.setHours(0, 0, 0, 0);

    // 1. קודם מסננים לפי חיפוש
    let processed = groups.filter(g => 
      g.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // 2. מפצלים לפעיל/ארכיון
    processed = processed.filter(group => {
      if (!group.endDate) return viewMode === 'active'; // אם אין תאריך, נשאיר בפעיל
      
      const end = new Date(group.endDate);
      // בדיקה: האם התאריך של היום גדול מתאריך הסיום?
      const isPast = now > end;

      return viewMode === 'active' ? !isPast : isPast;
    });

    // 3. מיון לפי תאריך
    processed.sort((a, b) => {
      const dateA = new Date(a.startDate || 0);
      const dateB = new Date(b.startDate || 0);
      
      // בארכיון נרצה לראות את מה שהיה הכי לאחרונה למעלה (סדר יורד)
      // בפעיל נרצה לראות את הקרוב ביותר למעלה (סדר עולה)
      return viewMode === 'active' 
        ? dateA - dateB 
        : dateB - dateA;
    });

    return processed;
  };

  const filteredGroups = processGroups();

  return (
    <div className="p-8 min-h-screen bg-[#F5F5F7] dir-rtl font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* כותרת עליונה */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 tracking-tight">ניהול קבוצות</h1>
            <p className="text-slate-500 mt-1 text-lg">כל הקבוצות והאירועים במקום אחד</p>
          </div>
          <Button 
            onClick={() => navigate('/groups/new')}
            className="bg-black hover:bg-slate-800 text-white rounded-2xl px-6 py-6 shadow-xl shadow-slate-200 flex items-center gap-2 transition-all duration-300 hover:scale-105"
          >
            <Plus size={20} /> קבוצה חדשה
          </Button>
        </div>

        {/* שורת חיפוש וטאבים */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 justify-between items-center">
           {/* טאבים - פעיל מול ארכיון */}
           <div className="bg-white p-1 rounded-2xl shadow-sm border border-slate-200 flex">
              <button
                onClick={() => setViewMode('active')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-medium ${
                  viewMode === 'active' 
                    ? 'bg-slate-100 text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutGrid size={18} />
                קבוצות פעילות
              </button>
              <button
                onClick={() => setViewMode('archive')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-200 font-medium ${
                  viewMode === 'archive' 
                    ? 'bg-slate-100 text-slate-900 shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <Archive size={18} />
                ארכיון
              </button>
           </div>

           {/* חיפוש */}
           <input 
             type="text" 
             placeholder="חפש קבוצה..." 
             className="w-full md:max-w-md p-4 rounded-2xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
             value={searchTerm}
             onChange={(e) => setSearchTerm(e.target.value)}
           />
        </div>

        {/* רשימת הקבוצות */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredGroups.map((group) => (
            <div 
              key={group._id}
              onClick={() => navigate(`/groups/${group._id}`)}
              className={`bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_20px_-5px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden ${viewMode === 'archive' ? 'opacity-80 grayscale-[0.3]' : ''}`}
            >
              {/* --- כפתור מחיקה (Ghost Button) --- */}
              <button
                onClick={(e) => handleDelete(e, group._id)}
                className="absolute top-4 left-4 p-2.5 rounded-full text-slate-300 
                           hover:text-red-500 hover:bg-red-50 
                           transition-all duration-300 ease-out
                           opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0
                           z-20"
                title="מחק קבוצה"
              >
                <Trash2 size={20} strokeWidth={2} />
              </button>
              {/* ------------------------- */}

              <div className="flex items-center justify-between mb-6">
                <div className={`${viewMode === 'archive' ? 'bg-slate-100 text-slate-500' : 'bg-blue-50/80 text-blue-600'} p-3.5 rounded-2xl backdrop-blur-sm`}>
                  <Users size={24} strokeWidth={2} />
                </div>
                {group.status && (
                    <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold tracking-wide">
                        {group.status}
                    </span>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-slate-800 mb-2 tracking-tight">{group.name}</h3>
              
              <div className="space-y-2.5 text-sm text-slate-500">
                <div className="flex items-center gap-2.5">
                   <Users size={16} className="text-slate-400" />
                   <span className="font-medium">{group.pax} משתתפים</span>
                </div>
                {group.startDate && (
                    <div className="flex items-center gap-2.5">
                        <Calendar size={16} className="text-slate-400" />
                        <span className="font-medium">
                            {new Date(group.startDate).toLocaleDateString('he-IL')} - {new Date(group.endDate).toLocaleDateString('he-IL')}
                        </span>
                    </div>
                )}
              </div>

              <div className="mt-6 pt-5 border-t border-slate-50 flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      {group.hostingType === 'seminar' ? 'יום עיון' : 'לינה'}
                  </span>
                  <span className="text-blue-600 text-sm font-bold group-hover:translate-x-1 transition-transform duration-300 flex items-center gap-1">
                      לפרטים נוספים <span className="text-lg">←</span>
                  </span>
              </div>
            </div>
          ))}
        </div>

        {filteredGroups.length === 0 && (
            <div className="text-center py-20 text-slate-400 flex flex-col items-center gap-4">
                <div className="bg-white p-6 rounded-full shadow-sm">
                  {viewMode === 'active' ? (
                     <Users size={48} className="opacity-20" />
                  ) : (
                     <Archive size={48} className="opacity-20" />
                  )}
                </div>
                <p className="text-lg font-medium opacity-60">
                  {viewMode === 'active' ? 'לא נמצאו קבוצות פעילות' : 'הארכיון ריק'}
                </p>
            </div>
        )}
      </div>
    </div>
  );
}
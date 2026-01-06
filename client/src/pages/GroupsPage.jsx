import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import { Plus, Users, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function GroupsPage() {
  const { groups, fetchGroups, deleteGroup } = useGroupsStore();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleDelete = async (e, id) => {
    e.stopPropagation(); 
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הקבוצה הזו?')) {
      await deleteGroup(id);
    }
  };

  const filteredGroups = groups.filter(g => 
    g.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

        {/* חיפוש */}
        <div className="mb-8">
           <input 
             type="text" 
             placeholder="חפש קבוצה..." 
             className="w-full max-w-md p-4 rounded-2xl border border-slate-200 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/5 transition-all"
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
              className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] hover:shadow-[0_10px_20px_-5px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all duration-300 cursor-pointer group relative overflow-hidden"
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
                <div className="bg-blue-50/80 p-3.5 rounded-2xl text-blue-600 backdrop-blur-sm">
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
                  <Users size={48} className="opacity-20" />
                </div>
                <p className="text-lg font-medium opacity-60">לא נמצאו קבוצות</p>
            </div>
        )}
      </div>
    </div>
  );
}
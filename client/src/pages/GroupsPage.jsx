import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import { Button } from '@/components/ui/Button';
import { Plus, ArrowRight, Users, Calendar } from 'lucide-react';

export default function GroupsPage() {
  const { groups, fetchGroups, loading } = useGroupsStore();
  const navigate = useNavigate();

  useEffect(() => { fetchGroups(); }, []);

  if (loading && groups.length === 0) return <div className="flex justify-center pt-20 text-slate-400">טוען קבוצות...</div>;

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900">ניהול קבוצות</h1>
            <p className="text-slate-500 mt-1 text-lg">מעקב אחר אירועים, אולמות ולוחות זמנים.</p>
          </div>
          <Button
            onClick={() => navigate('/groups/new')}
            className="bg-black hover:bg-slate-800 text-white rounded-full px-6 py-6 shadow-lg transition-transform active:scale-95"
          >
            <Plus className="mr-2 h-5 w-5" />
            קבוצה חדשה
          </Button>
        </div>

        {/* Grid */}
        {groups.length === 0 ? (
          <div className="text-center py-20 bg-white/60 backdrop-blur-xl rounded-3xl border border-white/20 shadow-sm">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Users size={32} />
            </div>
            <h2 className="text-2xl font-medium text-slate-700">אין קבוצות פעילות</h2>
            <p className="text-slate-500 mt-2">היומן ריק. זה הזמן ליצור את הקבוצה הראשונה.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {groups.map(group => (
                <Link
                  key={group._id}
                  to={`/groups/${group._id}`}
                  className="group relative bg-white rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100/50 flex flex-col justify-between h-[280px]"
                >
                  <div>
                    <div className="flex justify-between items-start mb-4">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        {/* תגית סטטוס (אפשר לשכלל בהמשך) */}
                        <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-full">
                            פעיל
                        </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 mb-1 truncate">
                        {group.name}
                    </h3>
                    <p className="text-sm text-slate-500 mb-4">{group.contactPerson?.name || 'ללא איש קשר'}</p>
                    
                    <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl">
                        <Calendar size={14} className="text-slate-400" />
                        <span>
                            {new Date(group.startDate).toLocaleDateString('he-IL')} - {new Date(group.endDate).toLocaleDateString('he-IL')}
                        </span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="text-sm font-bold">ניהול לו"ז</span>
                      <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
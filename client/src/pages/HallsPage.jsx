import React, { useEffect, useState } from 'react';
import useGroupsStore from '@/stores/groupsStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Trash2, Plus, MapPin } from 'lucide-react';

export default function HallsPage() {
  const { halls, fetchHalls, createHall, deleteHall } = useGroupsStore();
  const [newHallName, setNewHallName] = useState('');

  useEffect(() => {
    fetchHalls();
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newHallName.trim()) return;
    
    await createHall({ name: newHallName });
    setNewHallName('');
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <div>
            <h1 className="text-3xl font-bold text-slate-900">הגדרת אולמות וחללים</h1>
            <p className="text-slate-500 mt-1">כאן מגדירים את החללים הזמינים לשיבוץ במלון.</p>
        </div>

        {/* טופס הוספה מהירה */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-full text-blue-600">
                <MapPin size={24} />
            </div>
            <form onSubmit={handleAdd} className="flex-1 flex gap-4">
                <Input 
                    placeholder="שם האולם החדש (למשל: אולם גפן)" 
                    value={newHallName}
                    onChange={(e) => setNewHallName(e.target.value)}
                    className="h-12 text-lg bg-slate-50 border-transparent focus:bg-white"
                />
                <Button type="submit" className="h-12 px-6 rounded-xl bg-slate-900 text-white hover:bg-slate-800">
                    <Plus size={20} className="ml-2" /> הוסף
                </Button>
            </form>
        </div>

        {/* רשימת אולמות */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
            {halls.map(hall => (
                <div key={hall._id} className="group bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-all flex justify-between items-center">
                    <span className="font-bold text-lg text-slate-800">{hall.name}</span>
                    <button 
                        onClick={() => {
                            if(window.confirm('בטוח שברצונך למחוק אולם זה?')) deleteHall(hall._id);
                        }}
                        className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            ))}
        </div>
        
        {halls.length === 0 && (
            <div className="text-center py-10 text-slate-400">
                עדיין אין אולמות מוגדרים. התחל להוסיף!
            </div>
        )}

      </div>
    </div>
  );
}
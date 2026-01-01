import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import DayScheduler from '@/components/DayScheduler';
import { Button } from '@/components/ui/Button';
import { Plus, Calendar as CalIcon, Users, Edit2, Check, X, MapPin, Eye } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from 'react-hot-toast';

export default function GroupDetailsPage() {
  const { id } = useParams();
  const { groups, fetchGroups, updateGroup, halls, fetchHalls, addEvent } = useGroupsStore();
  
  const [selectedDate, setSelectedDate] = useState(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false); // סטייט לפתיחת הלוח הגדול
  
  const [editFormData, setEditFormData] = useState({});
  const [newEvent, setNewEvent] = useState({
      title: '', startTime: '', endTime: '', hallId: '', pax: '', requirements: ''
  });

  useEffect(() => { 
      if (groups.length === 0) fetchGroups();
      fetchHalls();
  }, []);

  const group = groups.find(g => g._id === id);

  useEffect(() => {
      if (group) {
          setEditFormData({
              name: group.name,
              pax: group.pax,
              contactName: group.contactPerson?.name || '',
              contactPhone: group.contactPerson?.phone || ''
          });
      }
  }, [group]);

  const getDaysArray = () => {
      if (!group) return [];
      const arr = [];
      const dt = new Date(group.startDate);
      const end = new Date(group.endDate);
      while (dt <= end) {
          arr.push(new Date(dt));
          dt.setDate(dt.getDate() + 1);
      }
      return arr;
  };
  
  const days = getDaysArray();

  useEffect(() => {
      if (!selectedDate && days.length > 0) setSelectedDate(days[0]);
  }, [group, days.length]);

  const handleAddEvent = async () => {
      if(!newEvent.title || !newEvent.hallId) {
          toast.error("יש למלא שם אירוע ולבחור אולם");
          return;
      }
      
      await addEvent(group._id, {
          ...newEvent,
          pax: parseInt(newEvent.pax) || 0,
          date: selectedDate,
          hall: newEvent.hallId
      });
      setIsEventDialogOpen(false);
      setNewEvent({ title: '', startTime: '', endTime: '', hallId: '', pax: '', requirements: '' });
  };

  const handleSaveDetails = async () => {
      await updateGroup(group._id, {
          name: editFormData.name,
          pax: parseInt(editFormData.pax),
          contactPerson: {
              ...group.contactPerson,
              name: editFormData.contactName,
              phone: editFormData.contactPhone
          }
      });
      setIsEditingDetails(false);
  };

  if (!group) return <div className="p-10 text-center text-slate-500">טוען נתונים...</div>;

  // סינון אירועים ליום הנבחר (עבור הרשימה הרגילה)
  const eventsForDay = group.schedule?.filter(e => 
      selectedDate && new Date(e.date).toDateString() === selectedDate.toDateString()
  ).sort((a,b) => a.startTime.localeCompare(b.startTime));

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* כותרת ופרטים (Edit Header) */}
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-700 to-slate-900"></div>
            <div className="flex justify-between items-start">
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-4">
                        {isEditingDetails ? (
                            <input 
                                className="text-3xl font-bold text-slate-900 border-b-2 border-blue-500 outline-none w-1/2"
                                value={editFormData.name}
                                onChange={e => setEditFormData({...editFormData, name: e.target.value})}
                            />
                        ) : (
                            <h1 className="text-4xl font-bold text-slate-900">{group.name}</h1>
                        )}
                        {!isEditingDetails && (
                            <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1 rounded-full text-sm">
                                <CalIcon size={14} />
                                {new Date(group.startDate).toLocaleDateString('he-IL')} - {new Date(group.endDate).toLocaleDateString('he-IL')}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-8 mt-2">
                        <div className="flex items-center gap-2 text-lg">
                            <Users size={20} className="text-slate-400" />
                            <span className="font-bold text-slate-700">כמות אורחים:</span>
                            {isEditingDetails ? (
                                <input 
                                    type="number" 
                                    className="w-20 font-bold border rounded px-1"
                                    value={editFormData.pax}
                                    onChange={e => setEditFormData({...editFormData, pax: e.target.value})}
                                />
                            ) : (
                                <span className="font-bold text-slate-900">{group.pax}</span>
                            )}
                        </div>
                        <div className="h-6 w-px bg-slate-200"></div>
                        <div className="flex items-center gap-2">
                            <span className="text-slate-500">איש קשר:</span>
                            {isEditingDetails ? (
                                <div className="flex gap-2">
                                    <input className="border rounded px-1 w-32" placeholder="שם" value={editFormData.contactName} onChange={e => setEditFormData({...editFormData, contactName: e.target.value})} />
                                    <input className="border rounded px-1 w-32" placeholder="טלפון" value={editFormData.contactPhone} onChange={e => setEditFormData({...editFormData, contactPhone: e.target.value})} />
                                </div>
                            ) : (
                                <span className="font-medium text-slate-800">{group.contactPerson?.name} ({group.contactPerson?.phone})</span>
                            )}
                        </div>
                    </div>
                </div>
                <div>
                    {isEditingDetails ? (
                        <div className="flex gap-2">
                             <Button onClick={() => setIsEditingDetails(false)} variant="ghost" className="text-red-500"><X size={20}/></Button>
                             <Button onClick={handleSaveDetails} className="bg-green-600 hover:bg-green-700 text-white"><Check size={20}/></Button>
                        </div>
                    ) : (
                        <Button onClick={() => setIsEditingDetails(true)} variant="ghost" className="text-slate-400 hover:text-blue-600"><Edit2 size={18} /></Button>
                    )}
                </div>
            </div>
        </div>

        {/* בחירת ימים */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {days.map((date, i) => {
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                return (
                    <button
                        key={i}
                        onClick={() => setSelectedDate(date)}
                        className={`
                            min-w-[90px] p-3 rounded-2xl border transition-all duration-300 flex-shrink-0 text-center
                            ${isSelected ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}
                        `}
                    >
                        <p className="text-xs opacity-70 mb-1">{date.toLocaleDateString('he-IL', { weekday: 'short' })}</p>
                        <p className="text-lg font-bold">{date.getDate()}.{date.getMonth()+1}</p>
                    </button>
                )
            })}
        </div>

        {/* --- רשימת האירועים (כמו בהתחלה) --- */}
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800">
                     לו"ז ליום {selectedDate?.toLocaleDateString('he-IL', { weekday: 'long' })}
                </h2>
                
                <div className="flex gap-2">
                    {/* כפתור בדיקת זמינות - פותח את הלוח הויזואלי */}
                    <Button 
                        onClick={() => setIsSchedulerOpen(true)}
                        className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl px-4 h-12 shadow-sm"
                    >
                        <Eye size={18} className="ml-2" /> בדיקת זמינות אולמות
                    </Button>

                    <Button 
                        onClick={() => {
                            setNewEvent({ title: '', startTime: '', endTime: '', hallId: '', pax: group.pax, requirements: '' });
                            setIsEventDialogOpen(true);
                        }} 
                        className="bg-slate-900 text-white rounded-xl px-6 h-12 shadow-lg"
                    >
                        <Plus size={18} className="ml-2" /> אירוע חדש
                    </Button>
                </div>
            </div>

            <div className="space-y-3">
                {(!eventsForDay || eventsForDay.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                        <CalIcon size={48} className="mb-4 opacity-20" />
                        <p>אין אירועים ליום זה.</p>
                    </div>
                )}
                
                {eventsForDay?.map(event => (
                    <div key={event._id} className="flex gap-6 p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md transition-all items-center">
                        <div className="w-24 text-center border-l pl-6 border-slate-100">
                            <p className="text-2xl font-bold text-slate-900">{event.startTime}</p>
                            <p className="text-sm text-slate-400 mt-1">{event.endTime}</p>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-bold text-slate-800">{event.title}</h3>
                            <div className="flex flex-wrap gap-3 mt-2">
                                <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                                    <MapPin size={14} /> {event.hall?.name || 'אולם לא ידוע'}
                                </span>
                                {event.pax > 0 && (
                                    <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                                        <Users size={12}/> {event.pax}
                                    </span>
                                )}
                                {event.requirements && (
                                    <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-full text-sm">{event.requirements}</span>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>

        {/* --- Dialog: לוח שנה ויזואלי (בדיקת זמינות) --- */}
        <Dialog open={isSchedulerOpen} onOpenChange={setIsSchedulerOpen}>
            <DialogContent className="max-w-6xl w-full h-[80vh] flex flex-col p-0 bg-slate-50 overflow-hidden">
                <DialogHeader className="p-6 bg-white border-b border-slate-200">
                    <DialogTitle>מצב אולמות - {selectedDate?.toLocaleDateString('he-IL')}</DialogTitle>
                </DialogHeader>
                <div className="flex-1 p-6 overflow-auto">
                    {selectedDate && (
                        <DayScheduler 
                            date={selectedDate}
                            halls={halls}
                            groups={groups}
                            currentGroupId={group._id}
                        />
                    )}
                </div>
                <div className="p-4 bg-white border-t border-slate-200 text-left">
                     <Button onClick={() => setIsSchedulerOpen(false)}>סגור</Button>
                </div>
            </DialogContent>
        </Dialog>

        {/* --- Dialog: הוספת אירוע --- */}
        <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
            <DialogContent className="sm:max-w-[500px] dir-rtl text-right">
                <DialogHeader>
                    <DialogTitle className="text-right mr-4 text-xl">אירוע חדש</DialogTitle>
                </DialogHeader>
                <div className="grid gap-5 py-4">
                    <div className="grid grid-cols-4 gap-4">
                        <div className="col-span-3 space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">שם האירוע</label>
                            <input className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 bg-slate-50 focus:bg-white" 
                                placeholder="לדוגמה: ארוחת ערב" autoFocus value={newEvent.title} onChange={e => setNewEvent({...newEvent, title: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">כמות</label>
                            <input type="number" className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100 text-center font-bold" 
                                value={newEvent.pax} onChange={e => setNewEvent({...newEvent, pax: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">אולם</label>
                        <select className="w-full p-3 border border-slate-200 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-100"
                            value={newEvent.hallId} onChange={e => setNewEvent({...newEvent, hallId: e.target.value})}>
                            <option value="">בחר אולם...</option>
                            {halls.map(hall => (<option key={hall._id} value={hall._id}>{hall.name}</option>))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">התחלה</label>
                            <input type="time" className="w-full p-3 border border-slate-200 rounded-xl text-center font-mono bg-slate-50" value={newEvent.startTime} onChange={e => setNewEvent({...newEvent, startTime: e.target.value})} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase">סיום</label>
                            <input type="time" className="w-full p-3 border border-slate-200 rounded-xl text-center font-mono bg-slate-50" value={newEvent.endTime} onChange={e => setNewEvent({...newEvent, endTime: e.target.value})} />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">הערות</label>
                        <textarea className="w-full p-3 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-100" rows={2}
                            value={newEvent.requirements} onChange={e => setNewEvent({...newEvent, requirements: e.target.value})} />
                    </div>
                </div>
                <Button onClick={handleAddEvent} className="w-full h-12 rounded-xl text-lg bg-slate-900 hover:bg-slate-800 shadow-xl">שמור ושריין</Button>
            </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
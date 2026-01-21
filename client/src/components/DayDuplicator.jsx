import React, { useState, useEffect } from 'react';
import { Copy, ArrowLeft, Loader2, CheckSquare, Square, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useGroupsStore from '@/stores/groupsStore';
import { toast } from 'react-hot-toast';

export default function DayDuplicator({ group }) {
  const [isOpen, setIsOpen] = useState(false);
  const [sourceDate, setSourceDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [selectedEventIds, setSelectedEventIds] = useState([]);
  const [availableEvents, setAvailableEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const { duplicateEvents } = useGroupsStore();

  // יצירת רשימת תאריכים לבחירה
  const getDaysArray = () => {
    if (!group?.startDate || !group?.endDate) return [];
    const arr = [];
    const dt = new Date(group.startDate);
    const end = new Date(group.endDate);
    
    while (dt <= end) {
      arr.push(new Date(dt));
      dt.setDate(dt.getDate() + 1);
    }
    return arr;
  };
  const datesList = getDaysArray();

  // ברגע שבוחרים תאריך מקור - שולפים את האירועים שלו
  useEffect(() => {
    if (!sourceDate) {
      setAvailableEvents([]);
      setSelectedEventIds([]);
      return;
    }

    const sDateObj = new Date(sourceDate);
    // סינון האירועים ששייכים ליום שנבחר
    const events = group.schedule.filter(evt => {
      const evtDate = new Date(evt.date);
      return evtDate.toDateString() === sDateObj.toDateString();
    });

    setAvailableEvents(events);
    // ברירת מחדל: מסמן את כולם
    setSelectedEventIds(events.map(e => e._id));
  }, [sourceDate, group.schedule]);

  // פונקציה לטיפול בסימון אירוע בודד
  const toggleEvent = (id) => {
    setSelectedEventIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // פונקציה לבחור הכל / לנקות הכל
  const toggleAll = () => {
    if (selectedEventIds.length === availableEvents.length) {
      setSelectedEventIds([]);
    } else {
      setSelectedEventIds(availableEvents.map(e => e._id));
    }
  };

  const handleDuplicate = async () => {
    if (!sourceDate || !targetDate) {
      toast.error('נא לבחור תאריכים');
      return;
    }
    if (sourceDate === targetDate) {
      toast.error('לא ניתן לשכפל לאותו יום');
      return;
    }
    if (selectedEventIds.length === 0) {
      toast.error('לא נבחרו אירועים לשכפול');
      return;
    }

    try {
      setLoading(true);
      // שליחת רק ה-IDs שסומנו ב-V
      await duplicateEvents(group._id, selectedEventIds, targetDate);
      
      setIsOpen(false);
      setSourceDate('');
      setTargetDate('');
      setSelectedEventIds([]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => new Intl.DateTimeFormat('he-IL', { weekday: 'long', day: 'numeric', month: 'numeric' }).format(date);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 border-slate-300 hover:bg-slate-50 text-slate-700">
          <Copy size={16} />
          <span>שכפול ימים</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[500px] text-right" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Copy className="text-blue-600" size={20}/>
            שכפול לו"ז מותאם אישית
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          
          {/* בחירת יום מקור */}
          <div className="grid grid-cols-2 gap-4 items-center">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">מאיזה יום להעתיק?</label>
              <Select onValueChange={setSourceDate} value={sourceDate}>
                <SelectTrigger className="w-full h-10 bg-slate-50">
                  <SelectValue placeholder="בחר יום מקור..." />
                </SelectTrigger>
                <SelectContent>
                  {datesList.map((d) => (
                    <SelectItem key={d.toISOString()} value={d.toISOString()} className="dir-rtl text-right">
                      {formatDate(d)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-center pt-5">
               <ArrowLeft className="text-slate-300" />
            </div>
          </div>

          {/* רשימת האירועים לבחירה (מופיעה רק אחרי בחירת יום) */}
          {sourceDate && (
            <div className="border rounded-xl p-3 bg-slate-50/50">
              <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-200">
                <span className="text-sm font-bold text-slate-700">בחר אירועים להעתקה ({selectedEventIds.length}/{availableEvents.length})</span>
                <button onClick={toggleAll} className="text-xs text-blue-600 font-medium hover:underline">
                  {selectedEventIds.length === availableEvents.length ? 'נקה הכל' : 'בחר הכל'}
                </button>
              </div>
              
              <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {availableEvents.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 py-4">אין אירועים ביום זה</p>
                ) : (
                  availableEvents.map((evt) => {
                    const isSelected = selectedEventIds.includes(evt._id);
                    return (
                      <div 
                        key={evt._id} 
                        onClick={() => toggleEvent(evt._id)}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer border transition-all ${isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-transparent hover:bg-slate-100'}`}
                      >
                        <div className={`text-blue-600 ${isSelected ? 'opacity-100' : 'opacity-40'}`}>
                          {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-bold text-slate-800">{evt.title}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock size={10} />
                            {evt.startTime} - {evt.endTime}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* בחירת יום יעד */}
          <div className="space-y-1 mt-2">
            <label className="text-xs font-bold text-slate-500">לאיזה יום להדביק?</label>
            <Select onValueChange={setTargetDate} value={targetDate}>
              <SelectTrigger className="w-full h-10 bg-slate-50">
                <SelectValue placeholder="בחר יום יעד..." />
              </SelectTrigger>
              <SelectContent>
                {datesList.map((d) => (
                  <SelectItem key={d.toISOString()} value={d.toISOString()} className="dir-rtl text-right">
                    {formatDate(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

        </div>

        <div className="flex justify-end gap-3 mt-4 border-t pt-4">
          <Button variant="ghost" onClick={() => setIsOpen(false)}>ביטול</Button>
          <Button onClick={handleDuplicate} disabled={loading || !targetDate || selectedEventIds.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px]">
            {loading ? <Loader2 className="animate-spin" /> : `שכפל (${selectedEventIds.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
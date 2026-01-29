import React, { useState } from 'react';
import { 
  Calendar as CalIcon, 
  Users, 
  Edit2, 
  Check, 
  X, 
  Briefcase, 
  Home, 
  Phone, 
  Mail, 
  UserCircle 
} from 'lucide-react';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import SmartCalendar from '@/components/SmartCalendar';
import useGroupsStore from '@/stores/groupsStore'; // כדי להציג תפוסה בלוח
import { toast } from 'react-hot-toast';

// רכיב Input בסגנון אפל
const CleanInput = (props) => (
  <input 
    {...props} 
    className={`bg-slate-100 hover:bg-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 
    transition-all duration-200 outline-none rounded-xl px-3 py-1.5 text-sm font-medium w-full ${props.className || ''}`} 
  />
);

export default function GroupPageHeader({ 
  group, 
  isEditingDetails, 
  setIsEditingDetails, 
  editFormData, 
  setEditFormData, 
  handleSaveDetails 
}) {
  // שליפת כל הקבוצות מהחנות כדי להציג תפוסה בלוח השנה
  const { groups } = useGroupsStore();
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // פונקציה שמטפלת בבחירה מהלוח החכם
  // פונקציה שמטפלת בבחירה מהלוח החכם
  const handleSmartDateSelect = (range) => {
    if (!range.start || !range.end) return;

    // 1. חישוב המשך המקורי (בימים)
    const originalStart = new Date(group.startDate);
    const originalEnd = new Date(group.endDate);
    originalStart.setHours(0,0,0,0);
    originalEnd.setHours(0,0,0,0);
    const originalDuration = (originalEnd - originalStart) / (1000 * 60 * 60 * 24);

    // 2. חישוב המשך החדש
    const newStart = new Date(range.start);
    const newEnd = new Date(range.end);
    newStart.setHours(0,0,0,0);
    newEnd.setHours(0,0,0,0);
    const newDuration = (newEnd - newStart) / (1000 * 60 * 60 * 24);

    // פונקציית עזר לתיקון הזזת שעות (מונע באג של יום אחורה)
    const toLocalISO = (date) => {
        const d = new Date(date);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        return d.toISOString().split('T')[0];
    };

    // 3. עדכון ה-State עם תאריך מתוקן
    setEditFormData({
        ...editFormData,
        startDate: toLocalISO(range.start),
        endDate: toLocalISO(range.end)
    });

    // 4. בדיקת התרעה למשתמש
    // אנו מאפשרים המרה ל-Int כדי למנוע שגיאות של חלקי מספרים
    if (Math.round(originalDuration) !== Math.round(newDuration)) {
        toast.error(`שים לב: שינית את אורך הקבוצה. הלו"ז הקיים לא יוזז אוטומטית!`, {
            duration: 5000,
            icon: '⚠️'
        });
    } else {
        toast.success('משך הקבוצה נשמר. הלו"ז יוזז אוטומטית לתאריכים החדשים.', {
             icon: '📅'
        });
    }

    // סגירת הלוח
    setTimeout(() => setIsCalendarOpen(false), 300);
  };

  return (
    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/20 shadow-xl shadow-slate-200/40 relative overflow-hidden">
      
      {/* כפתורי פעולה צפים (עריכה/שמירה) */}
      <div className="absolute top-8 left-8 z-10">
        {isEditingDetails ? (
          <div className="flex gap-2 bg-white/50 backdrop-blur-md p-1.5 rounded-full border border-slate-200/50 shadow-sm">
            <button onClick={() => setIsEditingDetails(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors">
              <X size={16} />
            </button>
            <button onClick={handleSaveDetails} className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 shadow-md transition-colors">
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => setIsEditingDetails(true)} className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-full text-slate-400 hover:text-blue-600 transition-all shadow-sm">
            <span className="text-xs font-bold hidden group-hover:block transition-all">ערוך פרטים</span>
            <Edit2 size={16} />
          </button>
        )}
      </div>

      <div className="space-y-8">
        {/* --- חלק עליון: כותרת וסטטוס --- */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            
            {/* סוג האירוח */}
            <div className="flex items-center gap-2">
              {!isEditingDetails && (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                  group.hostingType === 'overnight' ? 'bg-purple-50 text-purple-600 border border-purple-100' : 'bg-blue-50 text-blue-600 border border-blue-100'
                }`}>
                  {group.hostingType === 'overnight' ? <Home size={10} /> : <Briefcase size={10} />}
                  {group.hostingType === 'overnight' ? 'אירוח ולינה' : 'יום עיון'}
                </span>
              )}
              {!isEditingDetails && <span className="text-slate-300 text-xs">•</span>}
              <span className="text-slate-400 text-xs font-medium tracking-wide">
                נוצר ב-{new Date(group.createdAt || Date.now()).toLocaleDateString('he-IL')}
              </span>
            </div>

            {/* כותרת ראשית */}
            {isEditingDetails ? (
              <input 
                className="text-4xl font-black tracking-tight text-slate-900 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none w-full pb-2 placeholder:text-slate-300"
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="שם הקבוצה"
              />
            ) : (
              <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-tight">
                {group.name}
              </h1>
            )}
          </div>
        </div>

        <div className="pt-6 border-t border-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
              <UserCircle size={24} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">איש קשר ראשי</div>
              {isEditingDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <CleanInput placeholder="שם מלא" value={editFormData.contactName || ''} onChange={(e) => setEditFormData({ ...editFormData, contactName: e.target.value })} />
                  <CleanInput placeholder="טלפון" value={editFormData.contactPhone || ''} onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })} />
                  <CleanInput placeholder="אימייל" value={editFormData.contactEmail || ''} onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })} />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="text-lg font-bold text-slate-800">{group.contactPerson?.name || 'ללא שם'}</div>
                  {(group.contactPerson?.phone || group.contactPerson?.email) && <div className="h-4 w-px bg-slate-200 hidden md:block"></div>}
                  {group.contactPerson?.phone && (
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm hover:text-blue-600 transition-colors cursor-pointer">
                      <Phone size={14} /> {group.contactPerson.phone}
                    </div>
                  )}
                  {group.contactPerson?.email && (
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm hover:text-blue-600 transition-colors cursor-pointer">
                      <Mail size={14} /> {group.contactPerson.email}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- חלק אמצעי: גריד נתונים (Widgets) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* תאריכים - כעת עם הלוח החכם וההתרעות */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-200">
              <CalIcon size={20} />
            </div>
            <div className="flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">תאריכי הקבוצה</div>
              
              {isEditingDetails ? (
                // כפתור לפתיחת הלוח
                <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <DialogTrigger asChild>
                        <button 
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl text-sm font-bold w-full text-right flex justify-between items-center transition-all"
                            onClick={() => setIsCalendarOpen(true)}
                        >
                            <span>
                                {editFormData.startDate ? new Date(editFormData.startDate).toLocaleDateString('he-IL') : 'בחר תאריך'} 
                                <span className="mx-2">←</span> 
                                {editFormData.endDate ? new Date(editFormData.endDate).toLocaleDateString('he-IL') : 'בחר תאריך'}
                            </span>
                            <Edit2 size={12} className="opacity-50" />
                        </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-[90vw] w-fit p-0 bg-transparent border-none shadow-none">
                        <div className="bg-white p-2 rounded-3xl shadow-2xl overflow-hidden">
                            <SmartCalendar 
                                existingGroups={groups.filter(g => g._id !== group._id)} // מציג תפוסה של אחרים, לא של עצמנו
                                onSelectRange={handleSmartDateSelect}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
              ) : (
                <div className="text-base font-bold text-slate-800">
                    {new Date(group.startDate).toLocaleDateString('he-IL')}
                    <span className="mx-2 text-slate-300">→</span>
                    {new Date(group.endDate).toLocaleDateString('he-IL')}
                </div>
              )}
            </div>
          </div>

          {/* משתתפים */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-white flex flex-col justify-center gap-1">
            <div className="flex items-center gap-2 mb-1">
              <Users size={14} className="text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">משתתפים</span>
            </div>
            {isEditingDetails ? (
              <CleanInput type="number" placeholder="צפי" value={editFormData.pax ?? ''} onChange={(e) => setEditFormData({ ...editFormData, pax: e.target.value })} />
            ) : (
              <div className="text-2xl font-black text-slate-800">{group.pax} <span className="text-sm text-slate-400 font-medium">איש</span></div>
            )}
          </div>

          {/* מינימום */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-white flex flex-col justify-center gap-1">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">התחייבות מינימום</span>
            </div>
            {isEditingDetails ? (
              <CleanInput type="number" placeholder="מינימום" value={editFormData.minPax ?? ''} onChange={(e) => setEditFormData({ ...editFormData, minPax: e.target.value })} />
            ) : (
              <div className="text-2xl font-black text-slate-800">{group.minPax} <span className="text-sm text-slate-400 font-medium">איש</span></div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
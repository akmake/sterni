// client/src/pages/GroupDetails/GroupDetailsPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import { Button } from '@/components/ui/Button';
import {
  Calendar as CalIcon,
  Users,
  Edit2,
  Receipt,
  MapPin,
  Eye,
  FileText,
  DollarSign,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import DayDuplicator from '@/components/DayDuplicator';
// Imports from split files
import { SegmentedControl, AppleInput, AppleSelect } from './GroupPageComponents';
import GroupPageHeader from './GroupPageHeader';
import GroupPageModals from './GroupPageModals';
import GroupQuickAdd from './GroupQuickAdd';

// --- הגדרות ארוחות ---
const MEAL_DEFINITIONS = {
  breakfast: {
    label: 'ארוחת בוקר',
    kosherOptions: ['חלבי'],
    menuOptions: ['תפריט נוער', 'תפריט ימי עיון', 'פרטיים']
  },
  light_meal: {
    label: 'ארוחה קלה',
    kosherOptions: ['פרווה', 'בשרי', 'חלבי'],
    menuOptions: [
      'כיבוד קל', 'כיבוד קל משודרג', 'פיתה פלאפל', 
      'מזנון קליל', 'בורקס פיצה ופסטה', 
      'לחמניות סלטים ומעדן', 'וופל בלגי'
    ]
  },
  lunch: {
    label: 'ארוחת צהריים',
    kosherOptions: ['פרווה', 'בשרי', 'חלבי'],
    menuOptions: ['תפריט נוער', 'תפריט ימי עיון', 'פרטיים']
  },
  light_evening: {
    label: 'ארוחה קלה ערב',
    kosherOptions: ['פרווה', 'בשרי', 'חלבי'],
    menuOptions: [
      'כיבוד קל', 'כיבוד קל משודרג', 'פיתה פלאפל', 
      'מזנון קליל', 'בורקס פיצה ופסטה', 
      'לחמניות סלטים ומעדן', 'וופל בלגי'
    ]
  },
  dinner: {
    label: 'ארוחת ערב',
    kosherOptions: ['פרווה', 'בשרי', 'חלבי'],
    menuOptions: ['תפריט נוער', 'תפריט ימי עיון', 'פרטיים']
  },
  night_treats: {
    label: 'פינוקי לילה',
    isManual: true
  }
};

export default function GroupDetailsPage() {
  const { id } = useParams();
  const { groups, fetchGroups, updateGroup, halls, fetchHalls, addEvent, updateEvent, deleteEvent } =
    useGroupsStore();
  
  const [selectedDate, setSelectedDate] = useState(null);

  // דיאלוגים
  const [isEditEventDialogOpen, setIsEditEventDialogOpen] = useState(false);
  const [isEditingDetails, setIsEditingDetails] = useState(false);
  const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);

  // נתונים לעריכה
  const [editFormData, setEditFormData] = useState({});
  const [editingEventId, setEditingEventId] = useState(null);
  const [editEventData, setEditEventData] = useState({});

  // נתונים ליצירה מהירה (Inline)
  const [quickEvent, setQuickEvent] = useState({
    eventType: 'meal',
    title: '',
    startTime: '',
    endTime: '',
    hallId: '',
    locationText: '',
    pax: '',
    price: '',
    requirements: '',
    mealType: 'breakfast', 
    kosherType: 'halavi',
    menuItem: '' 
  });

  useEffect(() => {
    if (groups.length === 0) fetchGroups();
    fetchHalls();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const group = groups.find((g) => g._id === id);

  useEffect(() => {
    if (group) {
      setEditFormData({
        name: group.name,
        pax: group.pax,
        minPax: group.minPax || 0,
        contactName: group.contactPerson?.name || '',
        contactPhone: group.contactPerson?.phone || '',
        contactEmail: group.contactPerson?.email || '',
      });
      setQuickEvent((prev) => ({ ...prev, pax: group.pax }));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, days.length]);


  // --- פונקציות עזר ולוגיקה ---

  const validatePayload = (data, date) => {
    if (!data.startTime || !data.endTime) {
      toast.error('נא להזין שעות התחלה וסיום');
      return null;
    }

    let finalTitle = data.title;
    let finalHall = data.hallId;
    let finalLocation = data.locationText;

    // טיפול בכותרת ואולם לפי סוג אירוע
    const isMeal = data.eventType === 'meal';
    
    if (isMeal) {
      const def = MEAL_DEFINITIONS[data.mealType];
      if (!def) {
          toast.error('סוג ארוחה לא תקין');
          return null;
      }

      // בניית כותרת יפה לתצוגה
      if (def.isManual) {
          finalTitle = def.label; 
      } else {
          finalTitle = `${def.label}`;
          if (data.menuItem) finalTitle += ` - ${data.menuItem}`;
      }

      if (!finalHall) {
        toast.error('יש לבחור אולם לארוחה');
        return null;
      }
      finalLocation = '';
    } else {
      // אירוע כללי
      if (!finalTitle) {
        toast.error('יש להזין כותרת לאירוע');
        return null;
      }
      if (!finalHall && !finalLocation) {
      }
    }

    // --- תיקון לוגיקת לילה ---
    let finalDate = new Date(date);
    const [h] = data.startTime.split(':').map(Number);
    if (h < 6) {
        finalDate.setDate(finalDate.getDate() + 1);
    }

    return {
      ...data,
      title: finalTitle,
      hall: finalHall || null,
      locationText: finalLocation,
      pax: parseInt(data.pax, 10) || 0,
      price: parseInt(data.price, 10) || 0,
      date: finalDate,
      
      isMeal: isMeal, 
      mealType: isMeal ? data.mealType : '',
      kosherType: isMeal ? data.kosherType : '',
      menuItem: isMeal ? data.menuItem : '', 
      eventType: isMeal ? 'meal' : 'activity'
    };
  };

  const handleCreateQuickEvent = async () => {
    const payload = validatePayload(quickEvent, selectedDate);
    if (!payload) return;

    try {
      await addEvent(group._id, payload);
      toast.success('נוסף בהצלחה');

      setQuickEvent({
        eventType: 'meal',
        title: '',
        startTime: '',
        endTime: '',
        hallId: '',
        locationText: '',
        pax: group.pax,
        price: '',
        requirements: '',
        mealType: 'breakfast',
        kosherType: 'parve',
        menuItem: '' 
      });
    } catch (e) {
      console.error(e);
    }
  };

  // --- שמירה מה-Scheduler ---
  const handleSaveFromScheduler = async (eventData) => {
    try {
      await addEvent(group._id, eventData);
      toast.success('האירוע שובץ בלוח');
    } catch (error) {
      console.error(error);
      toast.error('שגיאה בשמירה מהלוח');
    }
  };

  const openEditDialog = (event) => {
    setEditingEventId(event._id);
    
    let type = event.eventType || 'meal';
    if (type === 'regular') type = 'meal';

    let finalMenu = event.menuItem || event.menu || '';

    if (!finalMenu && event.title && type === 'meal') {
        const dashMatch = event.title.match(/-\s+(.*?)(\s*\||$)/);
        if (dashMatch && dashMatch[1]) {
            finalMenu = dashMatch[1].trim();
        } else {
            const parts = event.title.split(' - ');
            if (parts.length > 1) finalMenu = parts[1].trim();
        }
    }

    setEditEventData({
      eventType: type,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      hallId: event.hall?._id || event.hall || '',
      locationText: event.locationText || '',
      pax: event.pax,
      price: event.price || '',
      requirements: event.requirements || '',
      mealType: event.mealType || 'breakfast',
      kosherType: event.kosherType || 'parve',
      menuItem: finalMenu 
    });
    
    setIsEditEventDialogOpen(true);
  };

  const handleUpdateEvent = async () => {
    const payload = validatePayload(editEventData, selectedDate);
    if (!payload) return;
    await updateEvent(group._id, editingEventId, payload);
    setIsEditEventDialogOpen(false);
  };

  const handleDeleteEvent = async () => {
    if (window.confirm('האם למחוק את האירוע?')) {
      await deleteEvent(group._id, editingEventId);
      setIsEditEventDialogOpen(false);
    }
  };

  const handleSaveDetails = async () => {
    await updateGroup(group._id, {
      name: editFormData.name,
      pax: parseInt(editFormData.pax, 10),
      minPax: parseInt(editFormData.minPax, 10),
      startDate: editFormData.startDate,
      endDate: editFormData.endDate,
      contactPerson: {
        ...group.contactPerson,
        name: editFormData.contactName,
        phone: editFormData.contactPhone,
        email: editFormData.contactEmail 
      },
    });
    setIsEditingDetails(false);
  };

  if (!group) return <div className="p-10 text-center text-slate-500">טוען נתונים...</div>;

  // --- לוגיקת תצוגה חכמה ---
  const eventsForDay = group.schedule
    ?.filter((e) => {
      if (!selectedDate) return false;
      const eventDate = new Date(e.date);
      const [h] = e.startTime.split(':').map(Number);
      const isTodayRegular = eventDate.toDateString() === selectedDate.toDateString() && h >= 6;
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const isTomorrowEarly = eventDate.toDateString() === nextDay.toDateString() && h < 6;
      return isTodayRegular || isTomorrowEarly;
    })
    .sort((a, b) => {
      const getMinutes = (timeStr) => {
        const [h, m] = timeStr.split(':').map(Number);
        const adjustedH = h < 6 ? h + 24 : h; 
        return adjustedH * 60 + m;
      };
      return getMinutes(a.startTime) - getMinutes(b.startTime);
    });

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 font-sans dir-rtl">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <GroupPageHeader 
          group={group}
          isEditingDetails={isEditingDetails}
          setIsEditingDetails={setIsEditingDetails}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          handleSaveDetails={handleSaveDetails}
        />

        {/* --- כפתורי פעולות --- */}
        <div className="flex justify-end px-1 items-center gap-3">
          {/* שכפול ימים */}
          <DayDuplicator group={group} />

          {/* ★ כפתור תשלומים (חדש!) */}
          <Link 
            to={`/groups/${group._id}/payments`} 
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition shadow-sm font-medium"
          >
              <DollarSign size={18} /> תשלומים
          </Link>

          {/* דרישת תשלום */}
          <Link 
            to={`/groups/${group._id}/payment-request`} 
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition shadow-sm font-medium"
          >
              <Receipt size={18} /> יצירת דרישת תשלום
          </Link>
        </div>

        {/* בחירת ימים */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {days.map((date, i) => {
            const isSelected = selectedDate?.toDateString() === date.toDateString();
            return (
              <button
                key={i}
                onClick={() => setSelectedDate(date)}
                className={`min-w-[90px] p-3 rounded-2xl border transition-all duration-300 flex-shrink-0 text-center
                ${
                  isSelected
                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg scale-105'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                <p className="text-xs opacity-70 mb-1">
                  {date.toLocaleDateString('he-IL', { weekday: 'short' })}
                </p>
                <p className="text-lg font-bold">
                  {date.getDate()}.{date.getMonth() + 1}
                </p>
              </button>
            );
          })}
        </div>

        <div className="space-y-4 pb-20">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">
              לו"ז ליום {selectedDate?.toLocaleDateString('he-IL', { weekday: 'long' })}
            </h2>
            <Button
              onClick={() => setIsSchedulerOpen(true)}
              className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl px-4 h-12 shadow-sm"
            >
              <Eye size={18} className="ml-2" /> בדיקת זמינות אולמות
            </Button>
          </div>

          <div className="space-y-3">
            {(!eventsForDay || eventsForDay.length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                <CalIcon size={48} className="mb-4 opacity-20" />
                <p>אין אירועים ליום זה.</p>
              </div>
            )}

            {eventsForDay?.map((event) => (
              <div
                key={event._id}
                onClick={() => openEditDialog(event)}
                className="flex gap-6 p-5 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-200 transition-all items-center cursor-pointer group"
              >
                <div className="w-24 text-center border-l pl-6 border-slate-100 group-hover:border-blue-100 transition-colors">
                  <p className="text-2xl font-bold text-slate-900">{event.startTime}</p>
                  <p className="text-sm text-slate-400 mt-1">{event.endTime}</p>
                </div>

                <div className="flex-1">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xl font-bold text-slate-800 group-hover:text-blue-700 transition-colors">
                          {event.title}
                        </h3>
                        {MEAL_DEFINITIONS[event.mealType] && 
                         !MEAL_DEFINITIONS[event.mealType].isManual && 
                         event.kosherType && (
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border 
                             ${event.kosherType === 'meat' 
                               ? 'bg-rose-50 text-rose-600 border-rose-100'
                               : event.kosherType === 'parve' 
                                 ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                 : 'bg-blue-50 text-blue-600 border-blue-100'
                             }
                           `}>
                             {event.kosherType === 'meat' ? 'בשרי' : event.kosherType === 'parve' ? 'פרווה' : 'חלבי'}
                           </span>
                        )}
                    </div>
                    <Edit2 size={16} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      <MapPin size={14} /> {event.hall?.name || event.locationText || 'ללא מיקום'}
                    </span>
                    {event.pax > 0 && (
                      <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1">
                        <Users size={12} /> {event.pax}
                      </span>
                    )}
                    {event.requirements && (
                      <span className="bg-slate-50 text-slate-500 px-3 py-1 rounded-full text-sm truncate max-w-md">
                        {event.requirements}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* --- שימוש בקומפוננטה החדשה --- */}
            <GroupQuickAdd
                quickEvent={quickEvent}
                setQuickEvent={setQuickEvent}
                handleCreateQuickEvent={handleCreateQuickEvent}
                halls={halls}
                MEAL_DEFINITIONS={MEAL_DEFINITIONS}
            />

          </div>
        </div>

        <GroupPageModals
          isSchedulerOpen={isSchedulerOpen}
          setIsSchedulerOpen={setIsSchedulerOpen}
          selectedDate={selectedDate}
          halls={halls}
          groups={groups}
          currentGroupId={group._id}
          isEditEventDialogOpen={isEditEventDialogOpen}
          setIsEditEventDialogOpen={setIsEditEventDialogOpen}
          editEventData={editEventData}
          setEditEventData={setEditEventData}
          handleUpdateEvent={handleUpdateEvent}
          handleDeleteEvent={handleDeleteEvent}
          onSaveEvent={handleSaveFromScheduler} 
          MEAL_DEFINITIONS={MEAL_DEFINITIONS}
        />
        
      </div>
    </div>
  );
}
// client/src/pages/GroupDetails/GroupDetailsPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import useMealsStore from '@/stores/mealsStore';
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
  Printer,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import DayDuplicator from '@/components/DayDuplicator';
// Imports from split files
import { SegmentedControl, AppleInput, AppleSelect } from './GroupPageComponents';
import GroupPageHeader from './GroupPageHeader';
import GroupPageModals from './GroupPageModals';
import GroupQuickAdd from './GroupQuickAdd';

const getKosherNormalized = (kosherType) => {
  if (!kosherType) return 'parve';
  const val = String(kosherType).toLowerCase().trim();
  if (val === 'meat' || val === 'בשרי' || val === 'בשר') return 'meat';
  if (val === 'halavi' || val === 'חלבי' || val === 'חלב' || val === 'dairy') return 'halavi';
  if (val === 'parve' || val === 'פרווה' || val === 'פרו') return 'parve';
  return 'parve';
};

const getKosherDisplay = (kosherType) => {
  const normalized = getKosherNormalized(kosherType);
  if (normalized === 'meat') return 'בשרי';
  if (normalized === 'halavi') return 'חלבי';
  return 'פרווה';
};

const getKosherColor = (kosherType) => {
  const normalized = getKosherNormalized(kosherType);
  if (normalized === 'meat') return 'bg-rose-50 text-rose-600 border-rose-100';
  if (normalized === 'halavi') return 'bg-blue-50 text-blue-600 border-blue-100';
  return 'bg-emerald-50 text-emerald-600 border-emerald-100';
};

export default function GroupDetailsPage() {
  const { id } = useParams();
  const { groups, fetchGroups, updateGroup, halls, fetchHalls, addEvent, updateEvent, deleteEvent } =
    useGroupsStore();
  const { meals, fetchMeals } = useMealsStore();
  
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
    mealId: '',
    kosherType: '',
    menuItem: '' 
  });

  useEffect(() => {
    if (groups.length === 0) fetchGroups();
    if (meals.length === 0) fetchMeals();
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

  // --- Helper: Convert meals array to MEAL_DEFINITIONS format ---
  const MEAL_DEFINITIONS = React.useMemo(() => {
    const result = {};
    if (!meals || meals.length === 0) return result;
    
    meals.forEach((meal) => {
      result[meal._id] = {
        label: meal.name,
        kosherOptions: meal.kosherOptions || [],
        menuOptions: meal.menuOptions || [],
        _id: meal._id
      };
    });
    return result;
  }, [meals]);

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
      // Validation for meal selection
      if (!data.mealId) {
        toast.error('אנא בחר ארוחה');
        return null;
      }

      const def = MEAL_DEFINITIONS[data.mealId];
      if (!def) {
          toast.error('סוג ארוחה לא תקין');
          return null;
      }

      // Validate kosher type selection if meal has options
      if (def.kosherOptions && def.kosherOptions.length > 0) {
        if (!data.kosherType) {
          toast.error('אנא בחר סוג כשרות');
          return null;
        }
        if (!def.kosherOptions.includes(data.kosherType)) {
          toast.error('סוג כשרות לא תקין');
          return null;
        }
      }

      // Validate menu item selection if meal has options
      if (def.menuOptions && def.menuOptions.length > 0) {
        if (!data.menuItem) {
          toast.error('אנא בחר תפריט');
          return null;
        }
        if (!def.menuOptions.includes(data.menuItem)) {
          toast.error('תפריט לא תקין');
          return null;
        }
      }

      // בניית כותרת יפה לתצוגה
      // הערה: אל תוסף kosherType לכותרת! זה יוצג בנפרד בדוחות
      finalTitle = def.label;
      if (data.menuItem) finalTitle += ` - ${data.menuItem}`;

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
      mealId: isMeal ? data.mealId : null,
      kosherType: isMeal ? data.kosherType : '',
      menuItem: isMeal ? data.menuItem : '', 
      eventType: isMeal ? 'meal' : 'general'
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
        mealId: '',
        kosherType: '',
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

    // השתמש ב-menuItem ישירות, אל תוציא מתוך title
    let finalMenu = event.menuItem || event.menu || '';

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
      mealId: event.mealId?._id || event.mealId || '',
      mealType: event.mealType || '',
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

  const handlePrintSchedule = () => {
    if (!group) return;
    
    const dataToPrint = {
      group: {
        _id: group._id,
        name: group.name,
        pax: group.pax,
        startDate: group.startDate,
        endDate: group.endDate,
        contactPerson: group.contactPerson,
      },
      schedule: (group.schedule || []).map(event => ({
        ...event,
        isMeal: event.isMeal || event.eventType === 'meal' || (event.mealType && event.mealType !== 'regular'),
      }))
    };
    
    localStorage.setItem('groupSchedulePrintData', JSON.stringify(dataToPrint));
    window.open('/print/group-schedule', '_blank');
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
          <div className="flex justify-between items-center gap-4 flex-wrap">
            <h2 className="text-2xl font-bold text-slate-800">
              לו"ז ליום {selectedDate?.toLocaleDateString('he-IL', { weekday: 'long' })}
            </h2>
            <div className="flex gap-2">
              <Button
                onClick={handlePrintSchedule}
                className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl px-4 h-12 shadow-sm"
              >
                <Printer size={18} className="ml-2" /> הדפס לו"ז
              </Button>
              <Button
                onClick={() => setIsSchedulerOpen(true)}
                className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl px-4 h-12 shadow-sm"
              >
                <Eye size={18} className="ml-2" /> בדיקת זמינות אולמות
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
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${getKosherColor(event.kosherType)}`}>
                             {getKosherDisplay(event.kosherType)}
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
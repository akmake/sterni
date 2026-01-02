// client/src/pages/GroupDetailsPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import DayScheduler from '@/components/DayScheduler';
import { Button } from '@/components/ui/Button';
import {
  Plus,
  Calendar as CalIcon,
  Users,
  Edit2,
  Check,
  X,
  MapPin,
  Eye,
  Trash2,
  Utensils,
  Truck,
  Briefcase,
  Home,
  Mail,
  Phone,
   // הוספתי את האייקון של השקל
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'react-hot-toast';

const MEAL_TYPES = [
  { id: 'breakfast', label: 'ארוחת בוקר' },
  { id: 'lunch', label: 'ארוחת צהריים' },
  { id: 'dinner', label: 'ארוחת ערב' },
  { id: 'light', label: 'ארוחה קלה' },
  { id: 'night_treats', label: 'פינוקי לילה' },
];

// --- רכיבים חיצוניים (תיקון לבעיית הפוקוס בהקלדה) ---

const SegmentedControl = ({ options, value, onChange }) => (
  <div className="bg-slate-100 p-1 rounded-xl flex w-full relative">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 z-10
        ${value === opt.value ? 'bg-white text-black shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        type="button"
      >
        {opt.label}
      </button>
    ))}
  </div>
);

const AppleInput = (props) => (
  <input
    {...props}
    className={`w-full bg-slate-50 border-none rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400 ${
      props.className || ''
    }`}
  />
);

const AppleSelect = (props) => (
  <select
    {...props}
    className={`w-full bg-slate-50 border-none rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
      props.className || ''
    }`}
  />
);

// --- סוף רכיבים חיצוניים ---

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
    price: '', // הוספתי שדה מחיר
    requirements: '',
    mealType: 'breakfast',
    kosherType: 'parve',
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
    if (data.eventType === 'meal') {
      const mealLabel = MEAL_TYPES.find((m) => m.id === data.mealType)?.label || 'ארוחה';
      finalTitle = mealLabel; 

      if (!finalHall) {
        toast.error('יש לבחור אולם לארוחה');
        return null;
      }
      finalLocation = '';
    } else {
      if (!finalTitle) {
        toast.error('יש להזין כותרת לאירוע');
        return null;
      }
      finalHall = null;
    }

    // --- תיקון לוגיקת לילה (Night Shift Logic) ---
    // אם השעה היא בין 00:00 ל-05:59, המערכת תבין שזה שייך ללילה של היום הזה,
    // ולכן תשמור את זה פיזית בתאריך של מחר, כדי שזה יופיע נכון במיון ובפילטור.
    let finalDate = new Date(date);
    const [h] = data.startTime.split(':').map(Number);
    if (h < 6) {
        finalDate.setDate(finalDate.getDate() + 1);
    }

    return {
      ...data,
      title: finalTitle,
      hall: finalHall,
      locationText: finalLocation,
      pax: parseInt(data.pax, 10) || 0,
      price: parseInt(data.price, 10) || 0, // הוספתי המרה של המחיר
      date: finalDate, // שליחת התאריך המתוקן
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
        price: '', // איפוס שדה המחיר
        requirements: '',
        mealType: 'breakfast',
        kosherType: 'parve',
      });
    } catch (e) {
      console.error(e);
    }
  };

  const openEditDialog = (event) => {
    setEditingEventId(event._id);
    let type = event.eventType || 'meal';
    if (type === 'regular') type = 'meal';
    setEditEventData({
      eventType: type,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      hallId: event.hall?._id || event.hall || '',
      locationText: event.locationText || '',
      pax: event.pax,
      price: event.price || '', // טעינת המחיר לעריכה
      requirements: event.requirements || '',
      mealType: event.mealType || 'breakfast',
      kosherType: event.kosherType || 'parve',
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

  // --- לוגיקת תצוגה חכמה (יום לוגי: 06:00 עד 06:00 למחרת) ---
  const eventsForDay = group.schedule
    ?.filter((e) => {
      if (!selectedDate) return false;
      
      const eventDate = new Date(e.date);
      const [h] = e.startTime.split(':').map(Number);
      
      // אירועים של היום (מ-06:00 עד חצות)
      const isTodayRegular = eventDate.toDateString() === selectedDate.toDateString() && h >= 6;

      // אירועים של הלילה (מחר לפנות בוקר עד 06:00)
      const nextDay = new Date(selectedDate);
      nextDay.setDate(nextDay.getDate() + 1);
      const isTomorrowEarly = eventDate.toDateString() === nextDay.toDateString() && h < 6;

      return isTodayRegular || isTomorrowEarly;
    })
    .sort((a, b) => {
      // מיון: שעות הלילה (00-05) נחשבות "גדולות יותר" מ-23 כדי שיופיעו בסוף הרשימה
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
        
        {/* --- Header: פרטי הקבוצה --- */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-slate-700 to-slate-900"></div>
          <div className="flex justify-between items-start">
            <div className="flex-1 space-y-3">
              
              {/* כותרת ושם קבוצה */}
              <div className="flex items-center gap-4">
                {isEditingDetails ? (
                  <input
                    className="text-3xl font-bold text-slate-900 border-b-2 border-blue-500 outline-none w-1/2"
                    value={editFormData.name || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  />
                ) : (
                  <h1 className="text-4xl font-bold text-slate-900">{group.name}</h1>
                )}
                {!isEditingDetails && (
                  <>
                    <div className="flex items-center gap-2 text-slate-500 bg-slate-50 px-3 py-1 rounded-full text-sm border border-slate-100">
                      <CalIcon size={14} />
                      {new Date(group.startDate).toLocaleDateString('he-IL')} -{' '}
                      {new Date(group.endDate).toLocaleDateString('he-IL')}
                    </div>
                    <div
                      className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold border ${
                        group.hostingType === 'overnight'
                          ? 'bg-purple-50 text-purple-700 border-purple-100'
                          : 'bg-blue-50 text-blue-700 border-blue-100'
                      }`}
                    >
                      {group.hostingType === 'overnight' ? (
                        <Home size={14} />
                      ) : (
                        <Briefcase size={14} />
                      )}
                      {group.hostingType === 'overnight' ? 'אירוח ולינה' : 'יום עיון'}
                    </div>
                  </>
                )}
              </div>

              {/* נתונים נוספים */}
              <div className="flex items-center gap-8 mt-2">
                <div className="flex items-center gap-2 text-lg">
                  <Users size={20} className="text-slate-400" />
                  <div className="flex flex-col leading-tight">
                    <div className="flex gap-2">
                      <span className="text-slate-500 text-sm">צפי:</span>
                      {isEditingDetails ? (
                        <input
                          type="number"
                          className="w-16 font-bold border rounded px-1"
                          value={editFormData.pax ?? ''}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, pax: e.target.value })
                          }
                        />
                      ) : (
                        <span className="font-bold text-slate-900">{group.pax}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <span className="text-red-500 text-sm font-medium">מינימום:</span>
                      {isEditingDetails ? (
                        <input
                          type="number"
                          className="w-16 font-bold border rounded px-1 text-red-600"
                          value={editFormData.minPax ?? ''}
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, minPax: e.target.value })
                          }
                        />
                      ) : (
                        <span className="font-bold text-red-600">{group.minPax}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="h-8 w-px bg-slate-200"></div>

                {/* איש קשר */}
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 self-start mt-1">איש קשר:</span>
                  
                  {isEditingDetails ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                         <input
                           className="border rounded px-1 w-32"
                           placeholder="שם"
                           value={editFormData.contactName || ''}
                           onChange={(e) => setEditFormData({ ...editFormData, contactName: e.target.value })}
                         />
                         <input
                           className="border rounded px-1 w-32"
                           placeholder="טלפון"
                           value={editFormData.contactPhone || ''}
                           onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                         />
                      </div>
                      <input
                          className="border rounded px-1 w-full"
                          placeholder="אימייל"
                          value={editFormData.contactEmail || ''}
                          onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
                       />
                    </div>
                  ) : (
                    <div className="flex flex-col">
                        <span className="font-bold text-slate-800 leading-tight">
                            {group.contactPerson?.name || 'לא הוזן שם'}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium mt-0.5">
                             {group.contactPerson?.phone && <span>{group.contactPerson.phone}</span>}
                             
                             {group.contactPerson?.email && group.contactPerson?.phone && (
                                <span className="text-slate-300">|</span>
                             )}
                             
                             {group.contactPerson?.email && <span>{group.contactPerson.email}</span>}
                        </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div>
              {isEditingDetails ? (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsEditingDetails(false)}
                    variant="ghost"
                    className="text-red-500"
                  >
                    <X size={20} />
                  </Button>
                  <Button
                    onClick={handleSaveDetails}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check size={20} />
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsEditingDetails(true)}
                  variant="ghost"
                  className="text-slate-400 hover:text-blue-600"
                >
                  <Edit2 size={18} />
                </Button>
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

          {/* רשימת האירועים */}
          <div className="space-y-3">
            {/* מצב ריק */}
            {(!eventsForDay || eventsForDay.length === 0) && (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white/50">
                <CalIcon size={48} className="mb-4 opacity-20" />
                <p>אין אירועים ליום זה.</p>
              </div>
            )}

            {/* אירועים קיימים */}
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

                        {['lunch', 'dinner', 'light'].includes(event.mealType) && event.kosherType && (
                           <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border 
                             ${event.kosherType === 'meat' 
                               ? 'bg-rose-50 text-rose-600 border-rose-100'
                               : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                             }
                           `}>
                              {event.kosherType === 'meat' ? 'בשרי' : 'פרווה'}
                           </span>
                        )}
                    </div>

                    <Edit2
                      size={16}
                      className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 mt-2">
                    <span className="flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-medium">
                      <MapPin size={14} /> {event.hall?.name || event.locationText || 'אולם לא ידוע'}
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

            {/* איזור הוספה מהירה */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-8 relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">הוספה מהירה</h3>
                  <div className="w-48">
                    <SegmentedControl
                      options={[
                        { label: 'ארוחה', value: 'meal' },
                        { label: 'כללי', value: 'general' },
                      ]}
                      value={quickEvent.eventType}
                      onChange={(val) => setQuickEvent({ ...quickEvent, eventType: val })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                  <div className="md:col-span-5 space-y-2">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                      מהות האירוע
                    </label>

                    {quickEvent.eventType === 'meal' ? (
                      <div className="flex gap-2">
                        <AppleSelect
                          value={quickEvent.mealType}
                          onChange={(e) => setQuickEvent({ ...quickEvent, mealType: e.target.value })}
                        >
                          {MEAL_TYPES.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </AppleSelect>

                        {['lunch', 'dinner', 'light'].includes(quickEvent.mealType) && (
                          <div className="bg-slate-50 rounded-xl p-1 flex items-center">
                            <button
                              onClick={() => setQuickEvent({ ...quickEvent, kosherType: 'meat' })}
                              className={`h-full px-3 rounded-lg text-xs font-bold transition-all ${
                                quickEvent.kosherType === 'meat'
                                  ? 'bg-white shadow-sm text-red-600'
                                  : 'text-slate-400'
                              }`}
                              type="button"
                            >
                              בשרי
                            </button>
                            <button
                              onClick={() => setQuickEvent({ ...quickEvent, kosherType: 'parve' })}
                              className={`h-full px-3 rounded-lg text-xs font-bold transition-all ${
                                quickEvent.kosherType === 'parve'
                                  ? 'bg-white shadow-sm text-green-600'
                                  : 'text-slate-400'
                              }`}
                              type="button"
                            >
                              פרווה
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <AppleInput
                        placeholder="כותרת (הגעה, קבלת פנים...)"
                        value={quickEvent.title}
                        onChange={(e) => setQuickEvent({ ...quickEvent, title: e.target.value })}
                      />
                    )}
                  </div>

                  <div className="md:col-span-3 space-y-2">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                      מיקום
                    </label>

                    {quickEvent.eventType === 'meal' ? (
                      <AppleSelect
                        value={quickEvent.hallId}
                        onChange={(e) => setQuickEvent({ ...quickEvent, hallId: e.target.value })}
                      >
                        <option value="">בחר אולם...</option>
                        {halls.map((hall) => (
                          <option key={hall._id} value={hall._id}>
                            {hall.name}
                          </option>
                        ))}
                      </AppleSelect>
                    ) : (
                      <AppleInput
                        placeholder="טקסט חופשי..."
                        value={quickEvent.locationText}
                        onChange={(e) =>
                          setQuickEvent({ ...quickEvent, locationText: e.target.value })
                        }
                      />
                    )}
                  </div>

                  {/* שורת קלטים: שעות, עלות, כמות */}
                  <div className="md:col-span-4 flex gap-2">
                    <div className="space-y-2 flex-1">
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                        שעות
                      </label>
                      <div className="flex gap-1">
                        <AppleInput
                          type="time"
                          className="text-center px-1"
                          value={quickEvent.startTime}
                          onChange={(e) =>
                            setQuickEvent({ ...quickEvent, startTime: e.target.value })
                          }
                        />
                        <AppleInput
                          type="time"
                          className="text-center px-1"
                          value={quickEvent.endTime}
                          onChange={(e) =>
                            setQuickEvent({ ...quickEvent, endTime: e.target.value })
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2 w-20">
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                        עלות
                      </label>
                      <div className="relative">
                         <AppleInput
                           type="number"
                           className="text-center px-1 font-bold pl-4"
                           placeholder="0"
                           value={quickEvent.price}
                           onChange={(e) => setQuickEvent({ ...quickEvent, price: e.target.value })}
                         />

                      </div>
                    </div>

                    <div className="space-y-2 w-20">
                      <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                        כמות
                      </label>
                      <AppleInput
                        type="number"
                        className="text-center px-1 font-bold"
                        value={quickEvent.pax}
                        onChange={(e) => setQuickEvent({ ...quickEvent, pax: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-3">
                  <AppleInput
                    placeholder="הערות מיוחדות לאירוע זה..."
                    value={quickEvent.requirements}
                    onChange={(e) =>
                      setQuickEvent({ ...quickEvent, requirements: e.target.value })
                    }
                    className="bg-slate-50/50"
                  />
                  <Button
                    onClick={handleCreateQuickEvent}
                    className="h-[42px] px-8 rounded-xl bg-black hover:bg-slate-800 text-white shadow-lg shadow-slate-200"
                  >
                    הוסף
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* --- דיאלוגים --- */}
        <Dialog open={isSchedulerOpen} onOpenChange={setIsSchedulerOpen}>
          <DialogContent className="max-w-6xl w-full h-[80vh] flex flex-col p-0 bg-slate-50 overflow-hidden">
            <DialogHeader className="p-6 bg-white border-b border-slate-200">
              <DialogTitle>מצב אולמות</DialogTitle>
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

        {/* עריכת אירוע */}
        <Dialog open={isEditEventDialogOpen} onOpenChange={setIsEditEventDialogOpen}>
          <DialogContent className="sm:max-w-[550px] dir-rtl text-right p-0 overflow-hidden rounded-2xl">
            <div className="bg-slate-900 p-6 text-white">
              <DialogTitle className="text-xl">עריכת אירוע</DialogTitle>
            </div>

            <div className="p-6 grid gap-6">
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setEditEventData({ ...editEventData, eventType: 'meal' })}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm ${
                    editEventData.eventType === 'meal' ? 'bg-white shadow-sm' : 'text-slate-400'
                  }`}
                  type="button"
                >
                  ארוחה
                </button>
                <button
                  onClick={() => setEditEventData({ ...editEventData, eventType: 'general' })}
                  className={`flex-1 py-2 rounded-lg font-bold text-sm ${
                    editEventData.eventType === 'general' ? 'bg-white shadow-sm' : 'text-slate-400'
                  }`}
                  type="button"
                >
                  כללי
                </button>
              </div>

              {editEventData.eventType === 'meal' ? (
                <div className="space-y-4">
                  <select
                    className="w-full p-3 border rounded-xl"
                    value={editEventData.mealType}
                    onChange={(e) => setEditEventData({ ...editEventData, mealType: e.target.value })}
                  >
                    {MEAL_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                  </select>

                  {['lunch', 'dinner', 'light'].includes(editEventData.mealType) && (
                    <div className="flex gap-4">
                      <label className="flex gap-2">
                        <input
                          type="radio"
                          checked={editEventData.kosherType === 'meat'}
                          onChange={() => setEditEventData({ ...editEventData, kosherType: 'meat' })}
                        />{' '}
                        בשרי
                      </label>
                      <label className="flex gap-2">
                        <input
                          type="radio"
                          checked={editEventData.kosherType === 'parve'}
                          onChange={() => setEditEventData({ ...editEventData, kosherType: 'parve' })}
                        />{' '}
                        פרווה
                      </label>
                    </div>
                  )}

                  <select
                    className="w-full p-3 border rounded-xl"
                    value={editEventData.hallId}
                    onChange={(e) => setEditEventData({ ...editEventData, hallId: e.target.value })}
                  >
                    <option value="">בחר אולם...</option>
                    {halls.map((h) => (
                      <option key={h._id} value={h._id}>
                        {h.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-4">
                  <input
                    className="w-full p-3 border rounded-xl"
                    value={editEventData.title || ''}
                    onChange={(e) => setEditEventData({ ...editEventData, title: e.target.value })}
                    placeholder="כותרת"
                  />
                  <input
                    className="w-full p-3 border rounded-xl"
                    value={editEventData.locationText || ''}
                    onChange={(e) =>
                      setEditEventData({ ...editEventData, locationText: e.target.value })
                    }
                    placeholder="מיקום"
                  />
                </div>
              )}

              {/* גריד לעריכת זמנים, כמות ומחיר */}
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500">התחלה</label>
                  <input
                    type="time"
                    className="w-full p-3 border rounded-xl text-center"
                    value={editEventData.startTime || ''}
                    onChange={(e) =>
                      setEditEventData({ ...editEventData, startTime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">סיום</label>
                  <input
                    type="time"
                    className="w-full p-3 border rounded-xl text-center"
                    value={editEventData.endTime || ''}
                    onChange={(e) =>
                      setEditEventData({ ...editEventData, endTime: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">עלות</label>
                  <input
                    type="number"
                    className="w-full p-3 border rounded-xl text-center"
                    placeholder="₪"
                    value={editEventData.price ?? ''}
                    onChange={(e) => setEditEventData({ ...editEventData, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">כמות</label>
                  <input
                    type="number"
                    className="w-full p-3 border rounded-xl text-center font-bold"
                    value={editEventData.pax ?? ''}
                    onChange={(e) => setEditEventData({ ...editEventData, pax: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500">הערות</label>
                <input
                  className="w-full p-3 border rounded-xl"
                  value={editEventData.requirements || ''}
                  onChange={(e) =>
                    setEditEventData({ ...editEventData, requirements: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-3 mt-4">
                <Button onClick={handleDeleteEvent} variant="ghost" className="text-red-500">
                  <Trash2 />
                </Button>
                <Button onClick={handleUpdateEvent} className="flex-1 bg-slate-900 text-white">
                  שמור שינויים
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
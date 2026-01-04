// client/src/pages/GroupDetailsPage.jsx

import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import { Button } from '@/components/ui/Button';
import {
  Calendar as CalIcon,
  Users,
  Edit2,
  MapPin,
  Eye,
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Imports from split files
import { MEAL_TYPES, SegmentedControl, AppleInput, AppleSelect } from './GroupPageComponents';
import GroupPageHeader from './GroupPageHeader';
import GroupPageModals from './GroupPageModals';

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
        <GroupPageHeader 
          group={group}
          isEditingDetails={isEditingDetails}
          setIsEditingDetails={setIsEditingDetails}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          handleSaveDetails={handleSaveDetails}
        />

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
        />
        
      </div>
    </div>
  );
}
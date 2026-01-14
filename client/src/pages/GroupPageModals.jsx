import React from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, MapPin, Info } from 'lucide-react'; // תיקון מ-info ל-Info
import DayScheduler from '@/components/DayScheduler';
import { MEAL_TYPES } from './GroupPageComponents';
export default function GroupPageModals({
  // Scheduler Props
  isSchedulerOpen,
  setIsSchedulerOpen,
  selectedDate,
  halls,
  groups,
  currentGroupId,

  // Edit Event Props
  isEditEventDialogOpen,
  setIsEditEventDialogOpen,
  editEventData,
  setEditEventData,
  handleUpdateEvent,
  handleDeleteEvent,
  onSaveEvent,
  
  // חובה: קבלת ההגדרות כדי להציג את התפריטים
  MEAL_DEFINITIONS 
}) {
  return (
    <>
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
                currentGroupId={currentGroupId}
                onSaveEvent={onSaveEvent}
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
            <DialogTitle className="text-xl font-bold">עריכת אירוע</DialogTitle>
          </div>

          <div className="p-6 grid gap-6">
            {/* טאבים לסוג אירוע */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setEditEventData({ ...editEventData, eventType: 'meal' })}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                  editEventData.eventType === 'meal' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'
                }`}
                type="button"
              >
                ארוחה
              </button>
              <button
                onClick={() => setEditEventData({ ...editEventData, eventType: 'general' })}
                className={`flex-1 py-2 rounded-lg font-bold text-sm transition-all ${
                  editEventData.eventType === 'general' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-400'
                }`}
                type="button"
              >
                כללי
              </button>
            </div>

            {/* תוכן הטופס - משתנה לפי סוג האירוע */}
            {editEventData.eventType === 'meal' ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">סוג ארוחה</label>
                  <select
                    className="w-full p-3 border rounded-xl bg-white shadow-sm"
                    value={editEventData.mealType}
                    onChange={(e) => setEditEventData({ ...editEventData, mealType: e.target.value })}
                  >
                    {MEAL_TYPES.map((t) => (
                      <option key={t.id} value={t.id}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* כשרות */}
                <div className="flex gap-4 mt-2">
                  {['meat', 'halavi', 'parve'].map((type) => (
                    <label key={type} className={`flex gap-2 items-center cursor-pointer p-2 rounded-lg flex-1 justify-center transition-all border ${
                      editEventData.kosherType === type 
                        ? (type === 'meat' ? 'bg-red-50 text-red-600 border-red-200 ring-1 ring-red-100' : 
                           type === 'halavi' ? 'bg-blue-50 text-blue-600 border-blue-200 ring-1 ring-blue-100' : 
                           'bg-green-50 text-green-600 border-green-200 ring-1 ring-green-100')
                        : 'bg-slate-50 border-transparent hover:bg-slate-100'
                    }`}>
                      <input
                        type="radio"
                        name="kosherTypeEdit"
                        checked={editEventData.kosherType === type}
                        onChange={() => setEditEventData({ ...editEventData, kosherType: type })}
                        className="hidden" 
                      />
                      <span className="font-bold text-sm">
                        {type === 'meat' ? 'בשרי' : type === 'halavi' ? 'חלבי' : 'פרווה'}
                      </span>
                    </label>
                  ))}
                </div>

                {/* תפריט */}
                {MEAL_DEFINITIONS?.[editEventData.mealType] && !MEAL_DEFINITIONS[editEventData.mealType].isManual && (
                   <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 mr-1">תפריט</label>
                      <select
                        className="w-full p-3 border rounded-xl bg-white shadow-sm"
                        value={editEventData.menuItem || ''}
                        onChange={(e) => setEditEventData({ ...editEventData, menuItem: e.target.value })}
                      >
                        <option value="">בחר תפריט...</option>
                        {MEAL_DEFINITIONS[editEventData.mealType].menuOptions.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                   </div>
                )}

                {/* בחירת אולם לארוחה */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">אולם</label>
                  <select
                    className="w-full p-3 border rounded-xl bg-white shadow-sm"
                    value={editEventData.hallId || ''}
                    onChange={(e) => setEditEventData({ ...editEventData, hallId: e.target.value })}
                  >
                    <option value="">ללא אולם (אופציונלי)</option>
                    {halls.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              /* --- אירוע כללי - התיקון כאן --- */
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">כותרת האירוע</label>
                  <input
                    className="w-full p-3 border rounded-xl bg-white shadow-sm"
                    value={editEventData.title || ''}
                    onChange={(e) => setEditEventData({ ...editEventData, title: e.target.value })}
                    placeholder="לדוגמה: הרצאה, סיור, התכנסות..."
                  />
                </div>
                
                {/* בחירת אולם לאירוע כללי - עכשיו זה מופיע! */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">מיקום (אולם)</label>
                  <select
                    className="w-full p-3 border rounded-xl bg-white shadow-sm"
                    value={editEventData.hallId || ''}
                    onChange={(e) => setEditEventData({ ...editEventData, hallId: e.target.value })}
                  >
                    <option value="">בחר אולם מתוך הרשימה...</option>
                    {halls.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 mr-1">מיקום חופשי (אם אין אולם)</label>
                  <input
                    className="w-full p-3 border rounded-xl bg-white shadow-sm"
                    value={editEventData.locationText || ''}
                    onChange={(e) => setEditEventData({ ...editEventData, locationText: e.target.value })}
                    placeholder="לדוגמה: חצר, לובי, אוטובוס..."
                  />
                </div>
              </div>
            )}

            {/* זמנים ועלויות - משותף לשני הסוגים */}
            <div className="grid grid-cols-4 gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">התחלה</label>
                <input
                  type="time"
                  className="w-full p-2 border rounded-lg text-center font-bold text-sm shadow-sm"
                  value={editEventData.startTime || ''}
                  onChange={(e) => setEditEventData({ ...editEventData, startTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">סיום</label>
                <input
                  type="time"
                  className="w-full p-2 border rounded-lg text-center font-bold text-sm shadow-sm"
                  value={editEventData.endTime || ''}
                  onChange={(e) => setEditEventData({ ...editEventData, endTime: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">מחיר</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg text-center font-bold text-sm shadow-sm"
                  placeholder="₪"
                  value={editEventData.price ?? ''}
                  onChange={(e) => setEditEventData({ ...editEventData, price: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-1">כמות</label>
                <input
                  type="number"
                  className="w-full p-2 border rounded-lg text-center font-bold text-sm shadow-sm text-indigo-600 bg-indigo-50 border-indigo-100"
                  value={editEventData.pax ?? ''}
                  onChange={(e) => setEditEventData({ ...editEventData, pax: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-500 mb-1 block mr-1">הערות ודרישות מיוחדות</label>
              <textarea
                className="w-full p-3 border rounded-xl min-h-[80px] text-sm shadow-sm"
                rows={3}
                value={editEventData.requirements || ''}
                onChange={(e) => setEditEventData({ ...editEventData, requirements: e.target.value })}
                placeholder="הערות למטבח, ציוד נדרש וכו'..."
              />
            </div>

            {/* כפתורי פעולה */}
            <div className="flex gap-3 mt-4 pt-4 border-t border-slate-100">
              <Button 
                onClick={handleDeleteEvent} 
                variant="ghost" 
                className="text-red-500 hover:bg-red-50 hover:text-red-600 rounded-xl px-4"
                title="מחק אירוע"
              >
                <Trash2 size={20} />
              </Button>
              <Button 
                onClick={handleUpdateEvent} 
                className="flex-1 bg-slate-900 hover:bg-black text-white rounded-xl font-bold h-12 shadow-lg transition-all"
              >
                שמור שינויים באירוע
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
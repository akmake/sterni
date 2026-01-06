import React from 'react';
import { Button } from '@/components/ui/Button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
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
  handleDeleteEvent
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
                  placeholder="מיייייקום"
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
    </>
  );
}
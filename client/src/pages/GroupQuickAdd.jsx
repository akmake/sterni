import React from 'react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl, AppleInput, AppleSelect } from './GroupPageComponents';

const getKosherLabel = (code) => {
  const labels = {
    'meat': 'בשרי',
    'halavi': 'חלבי',
    'parve': 'פרווה'
  };
  return labels[code] || code;
};

export default function GroupQuickAdd({
  quickEvent,
  setQuickEvent,
  handleCreateQuickEvent,
  halls,
  MEAL_DEFINITIONS
}) {
  return (
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
              <div className="flex flex-col gap-2">
                {/* בחירת סוג ארוחה */}
                <AppleSelect
                  value={quickEvent.mealId}
                  onChange={(e) => {
                    const newMealId = e.target.value;
                    setQuickEvent({ 
                      ...quickEvent, 
                      mealId: newMealId,
                      kosherType: '',
                      menuItem: ''
                    });
                  }}
                >
                  <option value="">בחר ארוחה...</option>
                  {Object.entries(MEAL_DEFINITIONS).map(([id, def]) => (
                    <option key={id} value={id}>
                      {def.label}
                    </option>
                  ))}
                </AppleSelect>

                {/* בחירת כשרות */}
                {quickEvent.mealId && MEAL_DEFINITIONS[quickEvent.mealId]?.kosherOptions?.length > 0 && (
                  <AppleSelect
                    value={quickEvent.kosherType}
                    onChange={(e) => setQuickEvent({ ...quickEvent, kosherType: e.target.value, menuItem: '' })}
                  >
                    <option value="">בחר כשרות...</option>
                    {MEAL_DEFINITIONS[quickEvent.mealId].kosherOptions.map(opt => (
                      <option key={opt} value={opt}>{getKosherLabel(opt)}</option>
                    ))}
                  </AppleSelect>
                )}

                {/* בחירת תפריט */}
                {quickEvent.mealId && MEAL_DEFINITIONS[quickEvent.mealId]?.menuOptions?.length > 0 && (
                   <AppleSelect
                     value={quickEvent.menuItem}
                     onChange={(e) => setQuickEvent({ ...quickEvent, menuItem: e.target.value })}
                   >
                     <option value="">בחר תפריט...</option>
                     {MEAL_DEFINITIONS[quickEvent.mealId].menuOptions.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                     ))}
                   </AppleSelect>
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

          {/* --- מיקום --- */}
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
              <div className="flex flex-col gap-2">
                <AppleSelect
                    value={quickEvent.hallId}
                    onChange={(e) => setQuickEvent({ ...quickEvent, hallId: e.target.value })}
                >
                    <option value="">אולם (אופציונלי)...</option>
                    {halls.map((hall) => (
                    <option key={hall._id} value={hall._id}>
                        {hall.name}
                    </option>
                    ))}
                </AppleSelect>

                <AppleInput
                    placeholder="או טקסט חופשי..."
                    value={quickEvent.locationText}
                    onChange={(e) =>
                    setQuickEvent({ ...quickEvent, locationText: e.target.value })
                    }
                />
              </div>
            )}
          </div>

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
              <AppleInput
                  type="number"
                  className="text-center px-1 font-bold pl-4"
                  placeholder="0"
                  value={quickEvent.price}
                  onChange={(e) => setQuickEvent({ ...quickEvent, price: e.target.value })}
                />
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

        {/* --- אזור ההערות החדש (תומך אנטרים) --- */}
        <div className="mt-4 flex items-start gap-3">
          <textarea
            placeholder="הערות מיוחדות לאירוע זה... (ניתן לרדת שורה עם Enter)"
            value={quickEvent.requirements}
            onChange={(e) =>
              setQuickEvent({ ...quickEvent, requirements: e.target.value })
            }
            className="flex-1 min-h-[42px] py-2.5 px-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white transition-all resize-y"
            rows={1}
            style={{
                // זה יגרום לשדה להיראות כמו אינפוט רגיל אבל יתרחב אם צריך
                fieldSizing: 'content' 
            }}
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
  );
}
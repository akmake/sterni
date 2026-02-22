import useMealsStore from '@/stores/mealsStore';
import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Button } from './ui/Button';
import { Input } from "./ui/Input";
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { toast } from 'react-hot-toast'; // הוספת ייבוא ל-Toast
// ייבוא הלוח החדש שיצרנו
import AvailabilityBoard from './AvailabilityBoard';

const getKosherLabel = (code) => {
  const labels = {
    'meat': 'בשרי',
    'halavi': 'חלבי',
    'parve': 'פרווה'
  };
  return labels[code] || code;
};

export default function DayScheduler({
  date,
  halls,
  groups,
  currentGroupId,
  onSaveEvent
}) {
  const { meals } = useMealsStore();

  // --- Build MEAL_DEFINITIONS from API meals (simplified)
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

  // -- ניהול הדיאלוג והטופס --
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  // ה-State של הטופס
  const [formData, setFormData] = useState({
    title: '',
    startTime: '08:00',
    endTime: '09:00',
    hallId: '',
    type: 'activity',
    mealId: '',
    kosherType: '',
    menuItem: '',
    notes: ''
  });

  // פונקציה שתופעל כשהמשתמש לוחץ על משבצת בלוח
  const handleSlotClick = (hallId, hour) => {
    const formattedHour = hour >= 24 ? hour - 24 : hour;
    const timeStr = `${formattedHour.toString().padStart(2, '0')}:00`;

    // איפוס והכנת הטופס
    setFormData({
      title: '',
      startTime: timeStr,
      endTime: `${(formattedHour + 1).toString().padStart(2, '0')}:00`,
      hallId: hallId,
      type: 'activity',
      mealId: '',
      kosherType: '',
      menuItem: '',
      notes: ''
    });
    setIsDialogOpen(true);
  };

  // בדיקת חפיפה (לוגיקה חדשה)
  const checkOverlap = () => {
    if (!formData.hallId) return false;

    const startA = parseInt(formData.startTime.replace(':', ''));
    const endA = parseInt(formData.endTime.replace(':', ''));

    // מעבר על כל הקבוצות והאירועים שלהן
    for (const group of groups || []) {
        if (!group.schedule) continue;
        for (const ev of group.schedule) {
            // התעלמות מאירועים ללא אולם או באולם אחר
            const evHallId = ev.hall?._id || ev.hall;
            if (evHallId !== formData.hallId) continue;

            // בדיקת תאריך (השוואה פשוטה לפי מחרוזת תאריך)
            const evDate = new Date(ev.date).toDateString();
            const currDate = new Date(date).toDateString();
            if (evDate !== currDate) continue;

            // בדיקת חפיפת שעות
            const startB = parseInt(ev.startTime.replace(':', ''));
            const endB = parseInt(ev.endTime.replace(':', ''));

            // לוגיקת חפיפה: התחלה של א' לפני הסוף של ב', וההתחלה של ב' לפני הסוף של א'
            if (startA < endB && startB < endA) {
                return true;
            }
        }
    }
    return false;
  };

  // שמירת הטופס
  const handleSave = () => {
    // Validate based on event type
    if (formData.type === 'meal') {
      if (!formData.mealId) {
        toast.error('אנא בחר ארוחה');
        return;
      }

      const def = MEAL_DEFINITIONS[formData.mealId];
      if (!def) {
        toast.error('ארוחה לא תקינה');
        return;
      }

      // Validate kosher type if meal has options
      if (def.kosherOptions && def.kosherOptions.length > 0) {
        if (!formData.kosherType) {
          toast.error('אנא בחר סוג כשרות');
          return;
        }
        if (!def.kosherOptions.includes(formData.kosherType)) {
          toast.error('סוג כשרות לא תקין');
          return;
        }
      }

      // Validate menu item if meal has options
      if (def.menuOptions && def.menuOptions.length > 0) {
        if (!formData.menuItem) {
          toast.error('אנא בחר תפריט');
          return;
        }
        if (!def.menuOptions.includes(formData.menuItem)) {
          toast.error('תפריט לא תקין');
          return;
        }
      }
    } else {
      // General event validation
      if (!formData.title) {
        toast.error('אנא הזן כותרת לאירוע');
        return;
      }
    }

    // 1. בדיקת חפיפה והצגת אזהרה (ללא חסימה)
    if (checkOverlap()) {
        toast('שים לב: קיים אירוע אחר באולם זה בשעות שנבחרו, אך האירוע נוצר.', {
            icon: '⚠️',
            style: {
                border: '1px solid #EAB308',
                padding: '16px',
                color: '#713200',
            },
            duration: 5000,
        });
    }

    let displayTitle = formData.title;

    if (formData.type === 'meal' && formData.mealId) {
      const def = MEAL_DEFINITIONS[formData.mealId];
      if (def) {
        displayTitle = `${def.label}`;
        if (formData.menuItem) displayTitle += ` - ${formData.menuItem}`;
      }
    }

    const eventToSave = {
      ...formData,
      title: displayTitle,
      date: date,
      isMeal: formData.type === 'meal',
    };

    if (onSaveEvent) {
      onSaveEvent(eventToSave);
    }

    setIsDialogOpen(false);
  };

  return (
    <div className="h-full flex flex-col">

        {/* --- שימוש בקומפוננטה החדשה לתצוגה --- */}
        <AvailabilityBoard
            date={date}
            halls={halls}
            groups={groups}
            currentGroupId={currentGroupId}
            onSlotClick={handleSlotClick}
        />

        {/* --- DIALOG: טופס יצירת אירוע החדש --- */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]" dir="rtl">
            <DialogHeader>
            <DialogTitle>הוספת אירוע / ארוחה</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 py-4">

            {/* שורת זמנים */}
            <div className="flex gap-4">
                <div className="flex-1">
                    <Label>התחלה</Label>
                    <Input type="time" value={formData.startTime} onChange={e => setFormData({...formData, startTime: e.target.value})} />
                </div>
                <div className="flex-1">
                    <Label>סיום</Label>
                    <Input type="time" value={formData.endTime} onChange={e => setFormData({...formData, endTime: e.target.value})} />
                </div>
            </div>

            {/* בחירת סוג הפעילות */}
            <div className="space-y-2">
                <Label>סוג פעילות</Label>
                <Select value={formData.type} onValueChange={val => setFormData({...formData, type: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="activity">פעילות רגילה</SelectItem>
                    <SelectItem value="meal">ארוחה / הסעדה</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* --- טופס חכם לארוחות (מוצג רק אם נבחר Meal) --- */}
            {formData.type === 'meal' ? (
                <div className="space-y-4 bg-slate-50 p-4 rounded-md border">
                <div className="space-y-2">
                    <Label>איזו ארוחה?</Label>
                    <Select
                    value={formData.mealId}
                    onValueChange={(val) => {
                        setFormData(prev => ({
                        ...prev,
                        mealId: val,
                        kosherType: '',
                        menuItem: ''
                        }));
                    }}
                    >
                    <SelectTrigger><SelectValue placeholder="בחר ארוחה..." /></SelectTrigger>
                    <SelectContent>
                        {Object.entries(MEAL_DEFINITIONS).map(([id, def]) => (
                        <SelectItem key={id} value={id}>
                          {def.label}
                        </SelectItem>
                        ))}
                    </SelectContent>
                    </Select>
                </div>

                {formData.mealId && MEAL_DEFINITIONS[formData.mealId]?.kosherOptions?.length > 0 && (
                  <div className="space-y-2">
                    <Label>כשרות</Label>
                    <Select
                      value={formData.kosherType}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, kosherType: val }))}
                    >
                      <SelectTrigger><SelectValue placeholder="בחר כשרות" /></SelectTrigger>
                      <SelectContent>
                        {MEAL_DEFINITIONS[formData.mealId].kosherOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{getKosherLabel(opt)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {formData.mealId && MEAL_DEFINITIONS[formData.mealId]?.menuOptions?.length > 0 && (
                  <div className="space-y-2">
                    <Label>תפריט</Label>
                    <Select
                      value={formData.menuItem}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, menuItem: val }))}
                    >
                      <SelectTrigger><SelectValue placeholder="בחר תפריט" /></SelectTrigger>
                      <SelectContent>
                        {MEAL_DEFINITIONS[formData.mealId].menuOptions.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-2">
                    <Label>הערות</Label>
                    <Textarea
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    placeholder="הערות מיוחדות למטבח..."
                    />
                </div>
                </div>
            ) : (
                <div className="space-y-2">
                <Label>כותרת האירוע</Label>
                <Input
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    placeholder="לדוגמה: הרצאה באולם ראשי"
                />
                </div>
            )}

            </div>

            <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>ביטול</Button>
            <Button onClick={handleSave}>שמור אירוע</Button>
            </DialogFooter>
        </DialogContent>
        </Dialog>
    </div>
  );
}
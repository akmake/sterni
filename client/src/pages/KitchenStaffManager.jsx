import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '@/api';
import { 
  format, 
  addWeeks, 
  startOfWeek, 
  endOfWeek, 
  startOfDay, 
  endOfDay, 
  isWithinInterval, 
  parseISO, 
  subDays 
} from 'date-fns';
import { he } from 'date-fns/locale';
import { Loader2, Printer, ChefHat, ChevronRight, ChevronLeft, Plus, X, Users } from 'lucide-react';

const getKosherType = (kosher) => {
  if (!kosher) return 'לא צוין';
  const k = kosher.toLowerCase();
  if (k.includes('meat') || k.includes('בשר')) return 'בשרי';
  if (k.includes('dairy') || k.includes('חלב') || k.includes('halavi')) return 'חלבי';
  if (k.includes('parve') || k.includes('פרו')) return 'פרווה';
  return 'לא צוין';
};

const getSmartMenuName = (event) => {
  if (event.menuItem) return event.menuItem;
  const title = event.title || '';
  const dashMatch = title.match(/-\s+(.*?)(\s*\||$)/);
  if (dashMatch && dashMatch[1]) return dashMatch[1].trim();
  const colonMatch = title.match(/:\s+(.*?)(\s*\||$)/);
  if (colonMatch && colonMatch[1]) return colonMatch[1].trim();
  return title || '-';
};

const KitchenStaffManager = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [meals, setMeals] = useState([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { weekStartsOn: 0 }));
  
  // ניהול עובדים
  const [staffList, setStaffList] = useState([]);
  const [newStaffName, setNewStaffName] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);
  
  // שיוכים והערות
  const [assignments, setAssignments] = useState({});
  const [notes, setNotes] = useState({});

  const currentWeekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
  const weekLabel = `${format(currentWeekStart, 'dd/MM/yyyy')} - ${format(currentWeekEnd, 'dd/MM/yyyy')}`;

  // טעינת עובדים
  useEffect(() => {
    const saved = localStorage.getItem('kitchenStaffList');
    if (saved) {
      setStaffList(JSON.parse(saved));
    }
  }, []);

  // טעינת שיוכים והערות
  useEffect(() => {
    const savedAssignments = sessionStorage.getItem('staffAssignments');
    const savedNotes = sessionStorage.getItem('staffNotes');
    if (savedAssignments) setAssignments(JSON.parse(savedAssignments));
    if (savedNotes) setNotes(JSON.parse(savedNotes));
  }, []);

  // שמירת שיוכים והערות
  useEffect(() => {
    sessionStorage.setItem('staffAssignments', JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    sessionStorage.setItem('staffNotes', JSON.stringify(notes));
  }, [notes]);

  const saveStaffList = (list) => {
    setStaffList(list);
    localStorage.setItem('kitchenStaffList', JSON.stringify(list));
  };

  const addStaff = () => {
    if (newStaffName.trim()) {
      const updated = [...staffList, newStaffName.trim()];
      saveStaffList(updated);
      setNewStaffName('');
    }
  };

  const removeStaff = (name) => {
    const updated = staffList.filter(s => s !== name);
    saveStaffList(updated);
  };

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/groups');
      const groups = res.data.data || res.data || [];
      const extracted = [];
      const rangeStart = startOfDay(currentWeekStart);
      const rangeEnd = endOfDay(currentWeekEnd);

      groups.forEach(group => {
        const schedule = group.schedule || [];
        schedule.forEach((event, idx) => {
          const isMeal = event.isMeal || event.eventType === 'meal' || (event.mealType && event.mealType !== 'regular');
          if (!isMeal || !event.date) return;

          let eventDate = parseISO(event.date);
          const [h] = String(event.startTime || '00:00').split(':');
          if (Number(h) < 6) eventDate = subDays(eventDate, 1);
          if (!isWithinInterval(eventDate, { start: rangeStart, end: rangeEnd })) return;

          const uniqueId = `${group._id}_${event._id || idx}`;
          extracted.push({
            uniqueId,
            groupName: group.name,
            date: eventDate,
            startTime: event.startTime,
            endTime: event.endTime,
            pax: event.pax || 0,
            kosherType: getKosherType(event.kosherType),
            kosherTypeRaw: event.kosherType,
            menuItem: getSmartMenuName(event),
            hall: event.hall?.name || event.locationText || '-',
            requirements: event.requirements || event.notes || ''
          });
        });
      });

      extracted.sort((a, b) => {
        if (a.date < b.date) return -1;
        if (a.date > b.date) return 1;
        return (a.startTime || '').localeCompare(b.startTime || '');
      });

      setMeals(extracted);
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleStaffAssignment = (mealId, staffName) => {
    setAssignments(prev => {
      const current = prev[mealId] || [];
      const exists = current.includes(staffName);
      
      if (exists) {
        return { ...prev, [mealId]: current.filter(s => s !== staffName) };
      } else {
        return { ...prev, [mealId]: [...current, staffName] };
      }
    });
  };

  const handleNoteChange = (mealId, value) => {
    setNotes(prev => ({ ...prev, [mealId]: value }));
  };

  const handlePrint = () => {
    const reportData = meals.map(meal => ({
      ...meal,
      assignedStaff: assignments[meal.uniqueId] || [],
      manualNotes: notes[meal.uniqueId] || ''
    }));

    navigate('/reports/staff-print-a3', {
      state: {
        reportData,
        weekLabel
      }
    });
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans dir-rtl" dir="rtl">
      <div className="max-w-[1800px] mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6">

        <div className="flex flex-col md:flex-row justify-between items-center mb-6 pb-6 border-b border-slate-100 gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
              <span className="p-2 bg-orange-100 rounded-lg text-orange-600"><ChefHat size={24}/></span>
              ניהול חלוקת עבודה למטבח
            </h1>
            <p className="text-slate-500 mt-1">בחר עובדים לכל ארוחה והוסף הערות</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowStaffModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-blue-700"
            >
              <Users size={18} />
              ניהול עובדים ({staffList.length})
            </button>

            <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, -1))} className="p-2 hover:bg-slate-200 rounded-lg">
                <ChevronRight size={20} />
              </button>
              <div className="flex flex-col items-center px-4">
                <span className="text-xs font-bold text-slate-500">שבוע</span>
                <span className="text-sm font-bold text-slate-900">{weekLabel}</span>
                <button onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 0 }))} className="text-xs text-blue-600 hover:underline mt-1">
                  שבוע נוכחי
                </button>
              </div>
              <button onClick={() => setCurrentWeekStart(prev => addWeeks(prev, 1))} className="p-2 hover:bg-slate-200 rounded-lg">
                <ChevronLeft size={20} />
              </button>
            </div>

            <button onClick={handlePrint} className="bg-slate-900 text-white px-5 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-slate-800">
              <Printer size={18} />
              הפק דוח A3
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-orange-500" size={40} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b-2 border-slate-300">
                  <th className="p-3 text-right font-bold text-slate-700">תאריך</th>
                  <th className="p-3 text-right font-bold text-slate-700">שעה</th>
                  <th className="p-3 text-right font-bold text-slate-700">קבוצה</th>
                  <th className="p-3 text-right font-bold text-slate-700">תפריט</th>
                  <th className="p-3 text-right font-bold text-slate-700">כמות</th>
                  <th className="p-3 text-right font-bold text-slate-700">כשרות</th>
                  <th className="p-3 text-right font-bold text-slate-700">אולם</th>
                  <th className="p-3 text-right font-bold text-slate-700 bg-blue-50">עובדים אחראים</th>
                  <th className="p-3 text-right font-bold text-slate-700 bg-green-50">הערות</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((meal) => (
                  <tr key={meal.uniqueId} className="border-b border-slate-200 hover:bg-slate-50">
                    <td className="p-3 text-sm">
                      {format(meal.date, 'dd/MM')}
                      <span className="text-slate-500 mr-2">{format(meal.date, 'EEEE', { locale: he })}</span>
                    </td>
                    <td className="p-3 text-sm font-mono">{meal.startTime}</td>
                    <td className="p-3 text-sm font-semibold">{meal.groupName}</td>
                    <td className="p-3 text-sm">{meal.menuItem}</td>
                    <td className="p-3 text-sm font-bold text-center">
                      <span className="inline-block bg-slate-900 text-white px-3 py-1 rounded-full">{meal.pax}</span>
                    </td>
                    <td className="p-3 text-sm">
                      <span className={`inline-block px-3 py-1 rounded-full font-bold ${
                        meal.kosherType === 'בשרי' ? 'bg-red-100 text-red-800' : 
                        meal.kosherType === 'חלבי' ? 'bg-blue-100 text-blue-800' :
                        meal.kosherType === 'פרווה' ? 'bg-green-100 text-green-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {meal.kosherType}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-slate-600">{meal.hall}</td>
                    
                    <td className="p-3 bg-blue-50">
                      <div className="flex flex-wrap gap-2">
                        {staffList.map(staff => (
                          <label key={staff} className="flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded border hover:bg-blue-50">
                            <input
                              type="checkbox"
                              checked={(assignments[meal.uniqueId] || []).includes(staff)}
                              onChange={() => toggleStaffAssignment(meal.uniqueId, staff)}
                              className="cursor-pointer"
                            />
                            <span className="text-sm">{staff}</span>
                          </label>
                        ))}
                      </div>
                    </td>

                    <td className="p-3 bg-green-50">
                      <input
                        type="text"
                        value={notes[meal.uniqueId] || ''}
                        onChange={(e) => handleNoteChange(meal.uniqueId, e.target.value)}
                        placeholder="הוסף הערה..."
                        className="w-full border border-green-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-green-500 outline-none"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {meals.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <p className="text-lg font-medium">לא נמצאו ארוחות</p>
              </div>
            )}
          </div>
        )}
      </div>

      {showStaffModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowStaffModal(false)}>
          <div className="bg-white rounded-xl p-6 w-96 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">ניהול עובדים</h2>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addStaff()}
                placeholder="שם עובד חדש..."
                className="flex-1 border border-slate-300 rounded-lg p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button onClick={addStaff} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                <Plus size={18} />
              </button>
            </div>

            <div className="space-y-2">
              {staffList.map(staff => (
                <div key={staff} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="font-semibold">{staff}</span>
                  <button onClick={() => removeStaff(staff)} className="text-red-500 hover:text-red-700">
                    <X size={18} />
                  </button>
                </div>
              ))}
              {staffList.length === 0 && (
                <p className="text-center text-slate-400 py-4">אין עובדים. הוסף עובד ראשון!</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default KitchenStaffManager;
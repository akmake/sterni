import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useGroupsStore from '@/stores/groupsStore';
import SmartCalendar from '@/components/SmartCalendar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ArrowRight, Calendar as CalendarIcon, Save, Briefcase, Home } from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogTrigger, 
  DialogTitle,      
  DialogDescription 
} from "@/components/ui/dialog";
import { toast } from 'react-hot-toast';

export default function NewGroupPage() {
  const navigate = useNavigate();
  // --- תיקון: שינוי מ-createGroup ל-addGroup ---
  const { addGroup, fetchGroups, groups } = useGroupsStore(); 

  useEffect(() => { fetchGroups(); }, []);

  const [formData, setFormData] = useState({
    name: '',
    pax: '',
    minPax: '', 
    hostingType: 'seminar', 
    contactName: '',
    contactPhone: '',
    contactEmail: ''
  });

  const [dates, setDates] = useState({ start: null, end: null });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const handleSubmit = async () => {
    if (!formData.name || !dates.start || !dates.end || !formData.pax || !formData.minPax) {
        toast.error('נא למלא את כל שדות החובה');
        return;
    }

    try {
      // --- תיקון: שימוש ב-addGroup ---
      await addGroup({
        name: formData.name,
        pax: parseInt(formData.pax),
        minPax: parseInt(formData.minPax),
        hostingType: formData.hostingType,
        contactPerson: {
            name: formData.contactName,
            phone: formData.contactPhone,
            email: formData.contactEmail
        },
        startDate: dates.start,
        endDate: dates.end
      });
      navigate('/groups');
    } catch (e) { 
        console.error(e);
        toast.error('שגיאה ביצירת הקבוצה');
    }
  };

  const getDateDisplay = () => {
      if (dates.start && dates.end) {
          return `${dates.start.toLocaleDateString('he-IL')} - ${dates.end.toLocaleDateString('he-IL')}`;
      }
      return "בחר תאריכי הגעה ועזיבה";
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] p-6 md:p-12 flex justify-center dir-rtl">
      <div className="w-full max-w-2xl">
        <div className="mb-8">
            <Button variant="ghost" onClick={() => navigate('/groups')} className="pl-0 hover:bg-transparent hover:text-blue-600">
                <ArrowRight className="ml-2 w-4 h-4" /> חזרה לרשימת הקבוצות
            </Button>
            <h1 className="text-3xl font-bold text-slate-900 mt-2">הקמת קבוצה חדשה</h1>
        </div>

        <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-200/60 space-y-6">

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">שם הקבוצה</label>
                <Input
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="h-12 bg-slate-50 border-slate-200"
                    placeholder="שם האירוע / הלקוח"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">כמות משתתפים (צפי)</label>
                    <Input
                        type="number"
                        value={formData.pax}
                        onChange={e => setFormData({...formData, pax: e.target.value})}
                        className="h-12 bg-slate-50 border-slate-200"
                        placeholder="0"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 text-red-600">התחייבות מינימלית</label>
                    <Input
                        type="number"
                        value={formData.minPax}
                        onChange={e => setFormData({...formData, minPax: e.target.value})}
                        className="h-12 bg-slate-50 border-slate-200"
                        placeholder="0"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">סוג אירוח</label>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        type="button"
                        onClick={() => setFormData({...formData, hostingType: 'seminar'})}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.hostingType === 'seminar' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                        <Briefcase size={24} />
                        <span className="font-bold">יום עיון</span>
                    </button>
                    <button 
                         type="button"
                         onClick={() => setFormData({...formData, hostingType: 'overnight'})}
                         className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${formData.hostingType === 'overnight' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                        <Home size={24} />
                        <span className="font-bold">אירוח עם לינה</span>
                    </button>
                </div>
            </div>

            <div className="border-t border-slate-100 my-4"></div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">שם איש קשר</label>
                <Input
                    value={formData.contactName}
                    onChange={e => setFormData({...formData, contactName: e.target.value})}
                    className="h-12 bg-slate-50 border-slate-200"
                />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">טלפון</label>
                    <Input
                        value={formData.contactPhone}
                        onChange={e => setFormData({...formData, contactPhone: e.target.value})}
                        className="h-12 bg-slate-50 border-slate-200"
                    />
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700">אימייל</label>
                    <Input
                        value={formData.contactEmail}
                        onChange={e => setFormData({...formData, contactEmail: e.target.value})}
                        className="h-12 bg-slate-50 border-slate-200"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700">תאריכים</label>
                <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <DialogTrigger asChild>
                        <button className={`w-full h-12 px-3 rounded-md border flex items-center justify-between transition-all ${dates.start ? 'bg-white border-slate-300' : 'bg-slate-50 border-slate-200'}`}>
                            <span className="flex items-center gap-2">
                                <CalendarIcon size={18} className="text-slate-400" />
                                {getDateDisplay()}
                            </span>
                        </button>
                    </DialogTrigger>
                    
                    <DialogContent className="sm:max-w-[800px] bg-transparent border-none shadow-none p-0">
                        <DialogTitle className="sr-only">בחירת תאריכים</DialogTitle>
                        <DialogDescription className="sr-only">
                            בחר תאריכי הגעה ועזיבה עבור הקבוצה
                        </DialogDescription>

                        <div className="bg-white rounded-3xl p-4 shadow-2xl">
                            <SmartCalendar
                                existingGroups={groups}
                                onSelectRange={(range) => {
                                    setDates(range);
                                    if (range.start && range.end) setTimeout(() => setIsCalendarOpen(false), 500);
                                }}
                            />
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <Button
                onClick={handleSubmit}
                disabled={!dates.start || !dates.end || !formData.name || !formData.pax || !formData.minPax}
                className="w-full h-14 text-lg font-bold rounded-xl bg-slate-900 text-white hover:bg-slate-800 mt-4"
            >
                <Save size={20} className="ml-2" /> שמור וצור קבוצה
            </Button>
        </div>
      </div>
    </div>
  );
}
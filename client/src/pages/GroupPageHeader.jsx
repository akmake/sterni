import React from 'react';
import { Button } from '@/components/ui/Button';
import {
  Calendar as CalIcon,
  Users,
  Edit2,
  Check,
  X,
  Briefcase,
  Home,
  Phone,
  Mail,
  UserCircle
} from 'lucide-react';

// רכיב עזר לקוביות מידע קטנות (Widget Style)
const InfoWidget = ({ icon: Icon, label, value, colorClass = "bg-slate-50 text-slate-700" }) => (
  <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-100 ${colorClass} transition-all hover:shadow-sm`}>
    <div className="p-2 bg-white rounded-full shadow-sm bg-opacity-60">
      <Icon size={16} className="opacity-70" />
    </div>
    <div className="flex flex-col">
      <span className="text-[10px] font-bold opacity-50 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-bold">{value}</span>
    </div>
  </div>
);

// רכיב Input בסגנון אפל (נקי, רקע אפור בהיר, מתרחב בפוקוס)
const CleanInput = (props) => (
  <input
    {...props}
    className={`bg-slate-100 hover:bg-slate-200 focus:bg-white focus:ring-2 focus:ring-blue-500/20 
    transition-all duration-200 outline-none rounded-xl px-3 py-1.5 text-sm font-medium w-full ${props.className || ''}`}
  />
);

export default function GroupPageHeader({
  group,
  isEditingDetails,
  setIsEditingDetails,
  editFormData,
  setEditFormData,
  handleSaveDetails
}) {
  return (
    <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[32px] border border-white/20 shadow-xl shadow-slate-200/40 relative overflow-hidden">
      
      {/* כפתורי פעולה צפים (עריכה/שמירה) */}
      <div className="absolute top-8 left-8 z-10">
        {isEditingDetails ? (
          <div className="flex gap-2 bg-white/50 backdrop-blur-md p-1.5 rounded-full border border-slate-200/50 shadow-sm">
            <button
              onClick={() => setIsEditingDetails(false)}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
            <button
              onClick={handleSaveDetails}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 shadow-md transition-colors"
            >
              <Check size={16} />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingDetails(true)}
            className="group flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-white border border-slate-100 hover:border-slate-200 rounded-full text-slate-400 hover:text-blue-600 transition-all shadow-sm"
          >
            <span className="text-xs font-bold hidden group-hover:block transition-all">ערוך פרטים</span>
            <Edit2 size={16} />
          </button>
        )}
      </div>

      <div className="space-y-8">
        
        {/* --- חלק עליון: כותרת וסטטוס --- */}
        <div className="space-y-4">
          <div className="flex flex-col gap-2">
            {/* סוג האירוח (תגית עליונה) */}
            <div className="flex items-center gap-2">
               {!isEditingDetails && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                    group.hostingType === 'overnight'
                      ? 'bg-purple-50 text-purple-600 border border-purple-100'
                      : 'bg-blue-50 text-blue-600 border border-blue-100'
                  }`}>
                    {group.hostingType === 'overnight' ? <Home size={10} /> : <Briefcase size={10} />}
                    {group.hostingType === 'overnight' ? 'אירוח ולינה' : 'יום עיון'}
                  </span>
               )}
               {!isEditingDetails && (
                 <span className="text-slate-300 text-xs">•</span>
               )}
               <span className="text-slate-400 text-xs font-medium tracking-wide">
                 נוצר ב-{new Date(group.createdAt || Date.now()).toLocaleDateString('he-IL')}
               </span>
            </div>

            {/* כותרת ראשית */}
            {isEditingDetails ? (
              <input
                className="text-4xl font-black tracking-tight text-slate-900 bg-transparent border-b-2 border-slate-200 focus:border-blue-500 outline-none w-full pb-2 placeholder:text-slate-300"
                value={editFormData.name || ''}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                placeholder="שם הקבוצה"
              />
            ) : (
              <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-tight">
                {group.name}
              </h1>
            )}
          </div>
        </div>
                <div className="pt-6 border-t border-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
              <UserCircle size={24} />
            </div>
            
            <div className="flex-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">איש קשר ראשי</div>
              
              {isEditingDetails ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <CleanInput
                    placeholder="שם מלא"
                    value={editFormData.contactName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, contactName: e.target.value })}
                  />
                  <CleanInput
                    placeholder="טלפון"
                    value={editFormData.contactPhone || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
                  />
                  <CleanInput
                    placeholder="אימייל"
                    value={editFormData.contactEmail || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, contactEmail: e.target.value })}
                  />
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                  <div className="text-lg font-bold text-slate-800">
                    {group.contactPerson?.name || 'ללא שם'}
                  </div>
                  
                  {(group.contactPerson?.phone || group.contactPerson?.email) && (
                    <div className="h-4 w-px bg-slate-200 hidden md:block"></div>
                  )}

                  {group.contactPerson?.phone && (
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm hover:text-blue-600 transition-colors cursor-pointer">
                      <Phone size={14} />
                      {group.contactPerson.phone}
                    </div>
                  )}
                  
                  {group.contactPerson?.email && (
                    <div className="flex items-center gap-2 text-slate-500 font-medium text-sm hover:text-blue-600 transition-colors cursor-pointer">
                      <Mail size={14} />
                      {group.contactPerson.email}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* --- חלק אמצעי: גריד נתונים (Widgets) --- */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          
          {/* תאריכים */}
          <div className="md:col-span-2 bg-gradient-to-br from-slate-50 to-white p-4 rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-200">
              <CalIcon size={20} />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">תאריכי הקבוצה</div>
              <div className="text-base font-bold text-slate-800">
                {new Date(group.startDate).toLocaleDateString('he-IL')} 
                <span className="mx-2 text-slate-300">→</span> 
                {new Date(group.endDate).toLocaleDateString('he-IL')}
              </div>
            </div>
          </div>

          {/* משתתפים (ניתן לעריכה) */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-white flex flex-col justify-center gap-1">
             <div className="flex items-center gap-2 mb-1">
               <Users size={14} className="text-slate-400" />
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">משתתפים</span>
             </div>
             {isEditingDetails ? (
               <div className="flex gap-2">
                 <CleanInput
                   type="number"
                   placeholder="צפי"
                   value={editFormData.pax ?? ''}
                   onChange={(e) => setEditFormData({ ...editFormData, pax: e.target.value })}
                 />
               </div>
             ) : (
               <div className="text-2xl font-black text-slate-800">{group.pax} <span className="text-sm text-slate-400 font-medium">איש</span></div>
             )}
          </div>

          {/* מינימום (ניתן לעריכה) */}
          <div className="p-4 rounded-2xl border border-slate-100 bg-white flex flex-col justify-center gap-1">
             <div className="flex items-center gap-2 mb-1">
               <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">התחייבות מינימום</span>
             </div>
             {isEditingDetails ? (
               <CleanInput
                 type="number"
                 placeholder="מינימום"
                 className="text-red-600 font-bold"
                 value={editFormData.minPax ?? ''}
                 onChange={(e) => setEditFormData({ ...editFormData, minPax: e.target.value })}
               />
             ) : (
               <div className="text-2xl font-black text-red-600/90">{group.minPax} <span className="text-sm text-red-200 font-medium">מינימום</span></div>
             )}
          </div>
        </div>

        {/* --- חלק תחתון: כרטיס איש קשר --- */}

      </div>
    </div>
  );
}
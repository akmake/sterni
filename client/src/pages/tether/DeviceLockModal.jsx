import React, { useState } from 'react';
import { Lock } from 'lucide-react';

export default function DeviceLockModal({ currentLockTs, onSave, onClose }) {
  const [preset, setPreset] = useState('30m');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('22:00');
  const [useCustom, setUseCustom] = useState(false);

  const isLocked = currentLockTs && currentLockTs > Date.now();

  const computeTs = () => {
    if (useCustom) {
      if (!customDate) return null;
      return new Date(`${customDate}T${customTime}`).getTime();
    }
    const now = Date.now();
    const tmrw8 = new Date(); tmrw8.setDate(tmrw8.getDate() + 1); tmrw8.setHours(8, 0, 0, 0);
    return { '30m': now + 30*60_000, '1h': now + 60*60_000, '2h': now + 2*60*60_000, '8am': tmrw8.getTime() }[preset];
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Lock size={16} /> נעל מכשיר זמנית</h3>

        {isLocked && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-2 rounded-lg mb-3">
            נעול עד: {new Date(currentLockTs).toLocaleString('he-IL')}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { val: '30m', label: '30 דקות' }, { val: '1h', label: 'שעה' },
            { val: '2h',  label: 'שעתיים' },  { val: '8am', label: 'עד 8:00 מחר' },
          ].map(opt => (
            <button key={opt.val} onClick={() => { setPreset(opt.val); setUseCustom(false); }}
              className={`py-2 px-3 rounded-lg text-sm border transition ${!useCustom && preset === opt.val ? 'bg-red-700 text-white border-red-700' : 'border-gray-200 hover:bg-gray-50'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="border-t pt-3 mb-4">
          <label className="text-xs text-gray-500 mb-1 block">עד תאריך ושעה מותאמים:</label>
          <div className="flex gap-2">
            <input type="date" value={customDate} onChange={e => { setCustomDate(e.target.value); setUseCustom(true); }}
              className="flex-1 border rounded px-2 py-1.5 text-sm" />
            <input type="time" value={customTime} onChange={e => { setCustomTime(e.target.value); setUseCustom(true); }}
              className="w-24 border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">ביטול</button>
          {isLocked && (
            <button onClick={() => onSave(0)} className="py-2 px-3 bg-green-100 text-green-700 rounded-lg text-sm hover:bg-green-200">בטל נעילה</button>
          )}
          <button onClick={() => { const ts = computeTs(); if (ts) onSave(ts); }}
            className="flex-1 py-2 bg-red-700 text-white rounded-lg text-sm hover:bg-red-800">נעל מכשיר</button>
        </div>
      </div>
    </div>
  );
}

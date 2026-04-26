import React, { useState } from 'react';

export default function AppTimeLockModal({ app, currentLock, onSave, onClose }) {
  const [mode, setMode] = useState('preset');
  const [preset, setPreset] = useState('30m');
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('08:00');

  const computeTs = () => {
    const now = Date.now();
    if (mode === 'custom') {
      const dt = new Date(`${customDate}T${customTime}`);
      return isNaN(dt.getTime()) ? null : dt.getTime();
    }
    const tmrw8 = new Date(); tmrw8.setDate(tmrw8.getDate() + 1); tmrw8.setHours(8, 0, 0, 0);
    return {
      '30m': now + 30*60_000, '1h': now + 60*60_000,
      '2h': now + 2*60*60_000, '8am': tmrw8.getTime(), 'permanent': null,
    }[preset];
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-xl w-full max-w-sm p-5">
        <h3 className="font-bold text-gray-900 mb-1">נעל שימוש — {app.appName}</h3>
        <p className="text-xs text-gray-500 mb-4">{app.packageName}</p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {[
            { val: '30m', label: '30 דקות' }, { val: '1h', label: 'שעה' },
            { val: '2h', label: 'שעתיים' },   { val: '8am', label: 'עד 8:00 מחר' },
            { val: 'permanent', label: 'חסום קבוע' },
          ].map(opt => (
            <button key={opt.val} onClick={() => { setMode('preset'); setPreset(opt.val); }}
              className={`py-2 px-3 rounded-lg text-sm border transition ${mode === 'preset' && preset === opt.val ? 'bg-blue-900 text-white border-blue-900' : 'border-gray-200 hover:bg-gray-50'}`}>
              {opt.label}
            </button>
          ))}
        </div>

        <div className="border-t pt-3 mb-4">
          <label className="text-xs text-gray-500 mb-1 block">זמן מותאם:</label>
          <div className="flex gap-2">
            <input type="date" value={customDate} onChange={e => { setCustomDate(e.target.value); setMode('custom'); }}
              className="flex-1 border rounded px-2 py-1.5 text-sm" />
            <input type="time" value={customTime} onChange={e => { setCustomTime(e.target.value); setMode('custom'); }}
              className="w-24 border rounded px-2 py-1.5 text-sm" />
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">ביטול</button>
          {currentLock && (
            <button onClick={() => onSave(app.packageName, -1)} className="py-2 px-3 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">הסר נעילה</button>
          )}
          <button onClick={() => onSave(app.packageName, computeTs())}
            className="flex-1 py-2 bg-blue-900 text-white rounded-lg text-sm hover:bg-blue-800">אשר נעילה</button>
        </div>
      </div>
    </div>
  );
}

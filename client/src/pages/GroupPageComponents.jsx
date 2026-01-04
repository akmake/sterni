import React from 'react';

export const MEAL_TYPES = [
  { id: 'breakfast', label: 'ארוחת בוקר' },
  { id: 'lunch', label: 'ארוחת צהריים' },
  { id: 'dinner', label: 'ארוחת ערב' },
  { id: 'light', label: 'ארוחה קלה' },
  { id: 'night_treats', label: 'פינוקי לילה' },
];

export const SegmentedControl = ({ options, value, onChange }) => (
  <div className="bg-slate-100 p-1 rounded-xl flex w-full relative">
    {options.map((opt) => (
      <button
        key={opt.value}
        onClick={() => onChange(opt.value)}
        className={`flex-1 py-1.5 text-sm font-semibold rounded-lg transition-all duration-200 z-10
        ${value === opt.value ? 'bg-white text-black shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        type="button"
      >
        {opt.label}
      </button>
    ))}
  </div>
);

export const AppleInput = (props) => (
  <input
    {...props}
    className={`w-full bg-slate-50 border-none rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400 ${
      props.className || ''
    }`}
  />
);

export const AppleSelect = (props) => (
  <select
    {...props}
    className={`w-full bg-slate-50 border-none rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none transition-all ${
      props.className || ''
    }`}
  />
);
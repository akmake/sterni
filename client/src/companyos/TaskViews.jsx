import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PRIORITY_LABELS, TASK_STATUS_LABELS } from './companyApi';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function ViewSwitcher({ views, value, onChange }) {
  return (
    <div className="inline-flex bg-gray-200 rounded-lg p-0.5" role="tablist">
      {Object.entries(views).map(([key, label]) => (
        <button
          key={key}
          role="tab"
          aria-selected={value === key}
          onClick={() => onChange(key)}
          className={`px-3 py-1 rounded-md text-xs font-semibold ${value === key ? 'bg-white shadow-sm' : 'text-gray-600'}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function TaskList({ tasks, onOpen, selectable, selected = [], onToggle }) {
  if (tasks.length === 0) return <p className="text-sm text-gray-500">אין משימות</p>;
  return (
    <ul className="bg-white rounded-xl shadow-sm divide-y">
      {tasks.map((task) => (
        <li key={task.id} className="p-3 flex items-center gap-2">
          {selectable && (
            <input
              type="checkbox"
              aria-label={`בחירת ${task.title}`}
              checked={selected.includes(task.id)}
              onChange={() => onToggle(task.id)}
            />
          )}
          <button className="flex-1 min-w-0 text-right" onClick={() => onOpen(task)}>
            <p className="font-semibold text-sm truncate">{task.title}</p>
            <p className="text-xs text-gray-500 truncate">
              {TASK_STATUS_LABELS[task.status]} · {PRIORITY_LABELS[task.priority]} · {task.assignee_name || 'ללא אחראי'}
              {task.due_at && ` · ${new Date(task.due_at).toLocaleDateString('he-IL')}`}
            </p>
          </button>
          {task.is_blocked && <span className="text-xs text-red-600 shrink-0">חסומה</span>}
        </li>
      ))}
    </ul>
  );
}

export function CalendarView({ tasks, onOpen }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const start = new Date(month);
  start.setDate(1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, index) => new Date(start.getTime() + index * MS_PER_DAY + 3600000));

  const byDay = new Map();
  tasks.filter((task) => task.due_at).forEach((task) => {
    const key = dayKey(new Date(task.due_at));
    byDay.set(key, [...(byDay.get(key) || []), task]);
  });

  const shift = (delta) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const today = dayKey(new Date());
  const undated = tasks.filter((task) => !task.due_at).length;

  return (
    <div className="bg-white rounded-xl shadow-sm p-2">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => shift(-1)} aria-label="חודש קודם"><ChevronRight size={18} /></button>
        <span className="font-bold text-sm">{month.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' })}</span>
        <button onClick={() => shift(1)} aria-label="חודש הבא"><ChevronLeft size={18} /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] text-gray-500">
        {WEEKDAYS.map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 border">
        {days.map((day) => {
          const items = byDay.get(dayKey(day)) || [];
          const inMonth = day.getMonth() === month.getMonth();
          return (
            <div key={day.getTime()} className={`bg-white min-h-16 p-0.5 ${inMonth ? '' : 'opacity-40'}`}>
              <div className={`text-[10px] ${dayKey(day) === today ? 'font-bold text-blue-700' : 'text-gray-500'}`}>{day.getDate()}</div>
              {items.slice(0, 3).map((task) => (
                <button
                  key={task.id}
                  onClick={() => onOpen(task)}
                  className="block w-full truncate text-[10px] bg-blue-100 text-blue-900 rounded px-0.5 mb-0.5 text-right"
                >
                  {task.title}
                </button>
              ))}
              {items.length > 3 && <div className="text-[10px] text-gray-500">+{items.length - 3}</div>}
            </div>
          );
        })}
      </div>
      {undated > 0 && <p className="text-xs text-gray-500 mt-2">{undated} משימות ללא תאריך יעד לא מוצגות</p>}
    </div>
  );
}

export function TimelineView({ tasks, onOpen }) {
  const dated = tasks
    .filter((task) => task.due_at)
    .map((task) => ({
      task,
      start: Math.min(new Date(task.created_at).getTime(), new Date(task.due_at).getTime()),
      end: new Date(task.due_at).getTime(),
    }))
    .sort((a, b) => a.end - b.end);

  if (dated.length === 0) return <p className="text-sm text-gray-500">אין משימות עם תאריך יעד</p>;

  const min = Math.min(...dated.map((row) => row.start));
  const max = Math.max(...dated.map((row) => row.end));
  const span = Math.max(max - min, MS_PER_DAY);
  const now = Date.now();
  const nowOffset = now >= min && now <= max ? ((now - min) / span) * 100 : null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-3 space-y-2 relative">
      <div className="flex justify-between text-[10px] text-gray-500">
        <span>{new Date(min).toLocaleDateString('he-IL')}</span>
        <span>{new Date(max).toLocaleDateString('he-IL')}</span>
      </div>
      {dated.map(({ task, start, end }) => {
        const left = ((start - min) / span) * 100;
        const width = Math.max(((end - start) / span) * 100, 2);
        return (
          <button key={task.id} onClick={() => onOpen(task)} className="block w-full text-right">
            <span className="block text-xs truncate">{task.title}</span>
            <span className="block h-2 bg-gray-100 rounded relative overflow-hidden">
              {nowOffset !== null && <span className="absolute top-0 bottom-0 w-px bg-red-500" style={{ right: `${nowOffset}%` }} />}
              <span
                className={`absolute top-0 bottom-0 rounded ${task.status === 'done' ? 'bg-green-500' : 'bg-blue-600'}`}
                style={{ right: `${left}%`, width: `${width}%` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}

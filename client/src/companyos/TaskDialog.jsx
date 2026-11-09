import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PRIORITY_LABELS,
  SEVERITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  companyApi,
  errorCode,
  errorMessage,
} from './companyApi';

const field = 'w-full border rounded-lg px-3 py-2 text-sm';

const Select = ({ label, value, onChange, options, disabled }) => (
  <label className="block text-xs text-gray-600">
    {label}
    <select className={`${field} mt-1 text-gray-900`} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([key, text]) => (
        <option key={key} value={key}>{text}</option>
      ))}
    </select>
  </label>
);

// `task` is null when creating a new task in `projectId`.
export default function TaskDialog({ orgId, projectId, task, onClose }) {
  const queryClient = useQueryClient();
  const isNew = !task;
  const readOnly = task ? !task.can_edit : false;

  const [form, setForm] = useState({
    title: task?.title ?? '',
    description: task?.description ?? '',
    status: task?.status ?? 'todo',
    priority: task?.priority ?? 'medium',
    type: task?.type ?? 'task',
    severity: task?.severity ?? '',
    resolution: task?.resolution ?? '',
    assignee_id: task?.assignee_id ?? '',
    due_at: task?.due_at ? task.due_at.slice(0, 10) : '',
    blocked_by: (task?.blocked_by ?? []).map(String),
  });
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const members = useQuery({
    queryKey: ['company', orgId, 'project', projectId, 'members'],
    queryFn: () => companyApi.projectMembers(orgId, projectId),
  });
  const siblings = useQuery({
    queryKey: ['company', orgId, 'tasks', { project_id: projectId }],
    queryFn: () => companyApi.tasks(orgId, { project_id: projectId, limit: 100 }),
    enabled: !isNew,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', orgId] });

  const save = useMutation({
    mutationFn: () => {
      const body = { ...form, severity: form.severity || null };
      if (isNew) {
        const { blocked_by: _ignored, resolution: _unused, ...fields } = body;
        return companyApi.createTask(orgId, { ...fields, project_id: projectId });
      }
      return companyApi.updateTask(orgId, task.id, { ...body, version: task.version });
    },
    onSuccess: () => {
      refresh();
      onClose();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      if (errorCode(error) === 'VERSION_CONFLICT') {
        refresh();
        onClose();
      }
    },
  });

  const assigneeOptions = {
    '': 'ללא אחראי',
    ...Object.fromEntries((members.data ?? []).map((member) => [member.user_id, member.name])),
  };
  if (form.assignee_id && !assigneeOptions[form.assignee_id]) {
    assigneeOptions[form.assignee_id] = task?.assignee_name ?? 'אחראי נוכחי';
  }
  const otherTasks = (siblings.data?.data ?? []).filter((other) => other.id !== task?.id);

  const toggleBlocker = (id) =>
    set('blocked_by')(form.blocked_by.includes(id) ? form.blocked_by.filter((x) => x !== id) : [...form.blocked_by, id]);

  return (
    <div className="fixed inset-0 z-20 bg-black/40 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <form
        className="bg-white w-full sm:max-w-lg rounded-t-xl sm:rounded-xl p-4 space-y-3 max-h-[90vh] overflow-y-auto"
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
      >
        <h2 className="font-bold">{isNew ? 'משימה חדשה' : 'פרטי משימה'}</h2>

        <input className={field} placeholder="כותרת" value={form.title} disabled={readOnly} required onChange={(e) => set('title')(e.target.value)} />
        <textarea className={field} rows={3} placeholder="תיאור" value={form.description} disabled={readOnly} onChange={(e) => set('description')(e.target.value)} />

        <div className="grid grid-cols-2 gap-2">
          <Select label="סטטוס" value={form.status} disabled={readOnly} onChange={set('status')} options={isNew ? { backlog: TASK_STATUS_LABELS.backlog, todo: TASK_STATUS_LABELS.todo } : TASK_STATUS_LABELS} />
          <Select label="עדיפות" value={form.priority} disabled={readOnly} onChange={set('priority')} options={PRIORITY_LABELS} />
          <Select label="סוג" value={form.type} disabled={readOnly} onChange={set('type')} options={TASK_TYPE_LABELS} />
          <Select label="חומרה" value={form.severity} disabled={readOnly} onChange={set('severity')} options={{ '': 'ללא', ...SEVERITY_LABELS }} />
          <Select label="אחראי" value={form.assignee_id} disabled={readOnly} onChange={set('assignee_id')} options={assigneeOptions} />
          <label className="block text-xs text-gray-600">
            תאריך יעד
            <input type="date" className={`${field} mt-1`} value={form.due_at} disabled={readOnly} onChange={(e) => set('due_at')(e.target.value)} />
          </label>
        </div>

        {!isNew && (
          <textarea className={field} rows={2} placeholder="תיעוד פתרון (חובה לסגירת באג חמור)" value={form.resolution} disabled={readOnly} onChange={(e) => set('resolution')(e.target.value)} />
        )}

        {!isNew && otherTasks.length > 0 && (
          <fieldset className="text-sm">
            <legend className="text-xs text-gray-600 mb-1">חסומה על ידי</legend>
            <div className="max-h-28 overflow-y-auto space-y-1">
              {otherTasks.map((other) => (
                <label key={other.id} className="flex items-center gap-2">
                  <input type="checkbox" disabled={readOnly} checked={form.blocked_by.includes(String(other.id))} onChange={() => toggleBlocker(String(other.id))} />
                  <span className="truncate">{other.title}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm">סגירה</button>
          {!readOnly && (
            <button disabled={save.isPending} className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
              {save.isPending ? 'שומר…' : 'שמירה'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

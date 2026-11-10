import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import TaskDialog from './TaskDialog';
import { CalendarView, TaskList, ViewSwitcher } from './TaskViews';
import { PRIORITY_LABELS, TASK_STATUS_LABELS, companyApi, errorMessage } from './companyApi';

const VIEWS = { list: 'רשימה', board: 'לוח', calendar: 'לוח שנה' };
const BULK_STATUSES = Object.fromEntries(Object.entries(TASK_STATUS_LABELS).filter(([key]) => key !== 'done'));

export default function MyWorkPage({ membership, currentUserId }) {
  const orgId = membership.organization.id;
  const queryClient = useQueryClient();
  const [view, setView] = useState('list');
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState([]);
  const params = { assignee: 'me', open: 'true', limit: 100 };

  const tasks = useQuery({
    queryKey: ['company', orgId, 'tasks', params],
    queryFn: () => companyApi.tasks(orgId, params),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', orgId] });
  const onError = (error) => toast.error(errorMessage(error));

  const complete = useMutation({
    mutationFn: (task) => companyApi.updateTask(orgId, task.id, { status: 'done', version: task.version }),
    onSettled: refresh,
    onError,
  });
  const bulk = useMutation({
    mutationFn: (changes) => companyApi.bulkUpdateTasks(orgId, { ids: checked, ...changes }),
    onSuccess: (result) => {
      toast.success(`עודכנו ${result.updated} משימות`);
      setChecked([]);
      refresh();
    },
    onError,
  });

  if (tasks.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (tasks.isError) {
    return (
      <p className="text-sm text-red-600">
        {errorMessage(tasks.error)}{' '}
        <button className="underline" onClick={() => tasks.refetch()}>נסה שוב</button>
      </p>
    );
  }

  const items = tasks.data.data;
  const toggle = (id) => setChecked((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  const bulkSelect = (label, options, field) => (
    <select
      className="border rounded-lg px-2 py-1 text-xs"
      value=""
      aria-label={label}
      disabled={bulk.isPending}
      onChange={(event) => event.target.value && bulk.mutate({ [field]: event.target.value })}
    >
      <option value="">{label}</option>
      {Object.entries(options).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  );

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold">העבודה שלי</h2>
        <ViewSwitcher views={VIEWS} value={view} onChange={setView} />
      </div>

      {items.length === 0 && <p className="text-sm text-gray-500">אין משימות פתוחות</p>}

      {checked.length > 0 && (
        <div className="bg-blue-50 rounded-lg p-2 flex flex-wrap items-center gap-2 text-sm">
          <span>{checked.length} נבחרו</span>
          {bulkSelect('שינוי סטטוס', BULK_STATUSES, 'status')}
          {bulkSelect('שינוי עדיפות', PRIORITY_LABELS, 'priority')}
        </div>
      )}

      {items.length > 0 && view === 'list' && (
        <TaskList tasks={items} onOpen={setSelected} selectable selected={checked} onToggle={toggle} />
      )}

      {items.length > 0 && view === 'board' && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Object.entries(TASK_STATUS_LABELS)
            .filter(([status]) => items.some((task) => task.status === status))
            .map(([status, label]) => (
              <div key={status} className="w-56 shrink-0 bg-gray-100 rounded-xl p-2 space-y-2">
                <h3 className="text-xs font-bold text-gray-600">{label}</h3>
                {items.filter((task) => task.status === status).map((task) => (
                  <div key={task.id} className="bg-white rounded-lg shadow-sm p-2">
                    <button className="block w-full text-right" onClick={() => setSelected(task)}>
                      <p className="text-sm font-semibold">{task.title}</p>
                      <p className="text-xs text-gray-500 truncate">{task.project_name}</p>
                    </button>
                    {task.can_edit && (
                      <button disabled={complete.isPending} onClick={() => complete.mutate(task)} className="text-xs text-blue-700 underline mt-1">סיום</button>
                    )}
                  </div>
                ))}
              </div>
            ))}
        </div>
      )}

      {items.length > 0 && view === 'calendar' && <CalendarView tasks={items} onOpen={setSelected} />}

      {selected && (
        <TaskDialog
          orgId={orgId}
          projectId={selected.project_id}
          task={selected}
          currentUserId={currentUserId}
          onClose={() => setSelected(null)}
        />
      )}
    </section>
  );
}

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import TaskDialog from './TaskDialog';
import { PRIORITY_LABELS, TASK_STATUS_LABELS, companyApi, errorMessage } from './companyApi';

export default function MyWorkPage({ membership }) {
  const orgId = membership.organization.id;
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(null);
  const params = { assignee: 'me', open: 'true', limit: 100 };

  const tasks = useQuery({
    queryKey: ['company', orgId, 'tasks', params],
    queryFn: () => companyApi.tasks(orgId, params),
  });

  const complete = useMutation({
    mutationFn: (task) => companyApi.updateTask(orgId, task.id, { status: 'done', version: task.version }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['company', orgId] }),
    onError: (error) => toast.error(errorMessage(error)),
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

  return (
    <section className="space-y-3">
      <h2 className="font-bold">העבודה שלי</h2>
      {tasks.data.data.length === 0 && <p className="text-sm text-gray-500">אין משימות פתוחות</p>}
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {tasks.data.data.map((task) => (
          <li key={task.id} className="p-3 flex items-center gap-2">
            <button className="flex-1 min-w-0 text-right" onClick={() => setSelected(task)}>
              <p className="font-semibold truncate">{task.title}</p>
              <p className="text-xs text-gray-500 truncate">
                {task.project_name} · {TASK_STATUS_LABELS[task.status]} · {PRIORITY_LABELS[task.priority]}
                {task.due_at && ` · ${new Date(task.due_at).toLocaleDateString('he-IL')}`}
              </p>
              {task.is_blocked && <p className="text-xs text-red-600">חסומה</p>}
            </button>
            {task.can_edit && (
              <button
                disabled={complete.isPending}
                onClick={() => complete.mutate(task)}
                className="text-sm text-blue-700 underline shrink-0"
              >
                סיום
              </button>
            )}
          </li>
        ))}
      </ul>
      {selected && (
        <TaskDialog orgId={orgId} projectId={selected.project_id} task={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

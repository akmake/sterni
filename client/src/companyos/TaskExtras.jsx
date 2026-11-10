import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { companyApi, errorMessage } from './companyApi';

const formatMinutes = (minutes) => `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;

// Comments and time log of an existing task, shown inside the task dialog.
export default function TaskExtras({ orgId, task, currentUserId }) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [minutes, setMinutes] = useState('');
  const commentsKey = ['company', orgId, 'task', task.id, 'comments'];
  const timeKey = ['company', orgId, 'task', task.id, 'time'];

  const comments = useQuery({ queryKey: commentsKey, queryFn: () => companyApi.taskComments(orgId, task.id) });
  const time = useQuery({ queryKey: timeKey, queryFn: () => companyApi.taskTime(orgId, task.id) });

  const onError = (error) => toast.error(errorMessage(error));
  const refreshComments = () => queryClient.invalidateQueries({ queryKey: commentsKey });
  const refreshTime = () => queryClient.invalidateQueries({ queryKey: timeKey });

  const addComment = useMutation({
    mutationFn: () => companyApi.addTaskComment(orgId, task.id, comment),
    onSuccess: () => {
      setComment('');
      refreshComments();
    },
    onError,
  });
  const removeComment = useMutation({
    mutationFn: (id) => companyApi.deleteTaskComment(orgId, task.id, id),
    onSuccess: refreshComments,
    onError,
  });
  const logTime = useMutation({
    mutationFn: () => companyApi.addTaskTime(orgId, task.id, Number(minutes)),
    onSuccess: () => {
      setMinutes('');
      refreshTime();
    },
    onError,
  });
  const removeTime = useMutation({
    mutationFn: (id) => companyApi.deleteTaskTime(orgId, task.id, id),
    onSuccess: refreshTime,
    onError,
  });

  const submitOnEnter = (action) => (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="space-y-3 border-t pt-3">
      <section className="space-y-1">
        <h3 className="text-xs font-bold text-gray-600">תגובות</h3>
        {(comments.data ?? []).map((item) => (
          <div key={item.id} className="text-sm bg-gray-50 rounded-lg p-2 flex gap-2">
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-xs">{item.author_name}</span>
              <p className="whitespace-pre-wrap break-words" dir="auto">{item.body}</p>
            </div>
            {String(item.author_id) === String(currentUserId) && (
              <button type="button" aria-label="מחיקת תגובה" onClick={() => removeComment.mutate(item.id)}><Trash2 size={12} /></button>
            )}
          </div>
        ))}
        {task.can_edit && (
          <div className="flex gap-2">
            <input
              className="flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm"
              placeholder="הוספת תגובה"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              onKeyDown={submitOnEnter(() => comment.trim() && addComment.mutate())}
            />
            <button type="button" disabled={!comment.trim() || addComment.isPending} onClick={() => addComment.mutate()} className="text-sm text-blue-700 font-semibold disabled:opacity-40">שליחה</button>
          </div>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-bold text-gray-600">
          זמן עבודה{time.data ? ` (סה״כ ${formatMinutes(time.data.meta.total_minutes)})` : ''}
        </h3>
        {(time.data?.data ?? []).map((entry) => (
          <div key={entry.id} className="text-xs flex items-center gap-2">
            <span className="flex-1">{entry.user_name} · {formatMinutes(entry.minutes)} · {new Date(entry.date).toLocaleDateString('he-IL')}</span>
            {String(entry.user_id) === String(currentUserId) && (
              <button type="button" aria-label="מחיקת רישום" onClick={() => removeTime.mutate(entry.id)}><Trash2 size={12} /></button>
            )}
          </div>
        ))}
        {task.can_edit && (
          <div className="flex gap-2 items-center">
            <input
              type="number"
              min="1"
              max="1440"
              className="w-24 border rounded-lg px-2 py-1 text-sm"
              placeholder="דקות"
              aria-label="דקות עבודה"
              value={minutes}
              onChange={(event) => setMinutes(event.target.value)}
              onKeyDown={submitOnEnter(() => Number(minutes) > 0 && logTime.mutate())}
            />
            <button type="button" disabled={!(Number(minutes) > 0) || logTime.isPending} onClick={() => logTime.mutate()} className="text-sm text-blue-700 font-semibold disabled:opacity-40">רישום</button>
          </div>
        )}
      </section>
    </div>
  );
}

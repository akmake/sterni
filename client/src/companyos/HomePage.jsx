import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckSquare, MessageCircle } from 'lucide-react';
import { PRIORITY_LABELS, companyApi, errorMessage } from './companyApi';

function Stat({ to, icon: Icon, value, label, alert }) {
  return (
    <Link to={to} className="bg-white rounded-2xl shadow-sm p-3 flex flex-col gap-1">
      <Icon size={18} className={alert ? 'text-red-600' : 'text-blue-700'} aria-hidden="true" />
      <span className={`text-2xl font-bold ${alert ? 'text-red-600' : ''}`}>{value}</span>
      <span className="text-xs text-gray-500">{label}</span>
    </Link>
  );
}

export default function HomePage({ membership, userName }) {
  const orgId = membership.organization.id;
  const home = useQuery({
    queryKey: ['company', orgId, 'home'],
    queryFn: () => companyApi.home(orgId),
  });

  if (home.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (home.isError) {
    return (
      <p className="text-sm text-red-600">
        {errorMessage(home.error)}{' '}
        <button className="underline" onClick={() => home.refetch()}>נסה שוב</button>
      </p>
    );
  }

  const data = home.data;

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold">שלום, {userName}</h2>

      <div className="grid grid-cols-3 gap-2">
        <Stat to="/company/my-work" icon={CheckSquare} value={data.open_tasks} label="משימות פתוחות" />
        <Stat to="/company/my-work" icon={AlertTriangle} value={data.overdue_tasks} label="באיחור" alert={data.overdue_tasks > 0} />
        <Stat to="/company/chat" icon={MessageCircle} value={data.unread_messages} label="לא נקראו" />
      </div>

      <section className="space-y-2">
        <h3 className="font-bold">הבא בתור</h3>
        {data.next_tasks.length === 0 && (
          <p className="text-sm text-gray-500">עדיין אין משימות מוקצות אליך</p>
        )}
        {data.next_tasks.length > 0 && (
          <ul className="bg-white rounded-2xl shadow-sm divide-y">
            {data.next_tasks.map((task) => (
              <li key={task.id} className="p-3">
                <Link to={`/company/projects/${task.project_id}`} className="block">
                  <p className="font-semibold truncate">{task.title}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {task.project_name} · {PRIORITY_LABELS[task.priority]}
                    {task.due_at && ` · ${new Date(task.due_at).toLocaleDateString('he-IL')}`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="font-bold">פרויקטים פעילים</h3>
        {data.active_projects.length === 0 && <p className="text-sm text-gray-500">אין פרויקטים פעילים</p>}
        <div className="space-y-2">
          {data.active_projects.map((project) => {
            const percent = project.task_count ? Math.round((project.completed_tasks / project.task_count) * 100) : 0;
            return (
              <Link key={project.id} to={`/company/projects/${project.id}`} className="block bg-white rounded-2xl shadow-sm p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-semibold truncate">{project.name}</span>
                  <span className="text-gray-500">{percent}%</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-blue-700" style={{ width: `${percent}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}

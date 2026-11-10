import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import TaskDialog from './TaskDialog';
import { CalendarView, TaskList, TimelineView, ViewSwitcher } from './TaskViews';
import {
  PROJECT_ROLE_LABELS,
  PROJECT_STATUS_LABELS,
  REQUIREMENT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TEST_RESULT_LABELS,
  companyApi,
  errorMessage,
} from './companyApi';

const useCompanyMutation = (orgId, mutationFn, onDone) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company', orgId] });
      onDone?.();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
};

const input = 'border rounded-lg px-3 py-2 text-sm';

const TASK_VIEWS = { board: 'לוח', list: 'רשימה', calendar: 'לוח שנה', timeline: 'Timeline' };

function TasksTab({ orgId, projectId, canWrite, currentUserId }) {
  const [dialog, setDialog] = useState(null);
  const [view, setView] = useState('board');
  const [dragOver, setDragOver] = useState(null);
  const queryClient = useQueryClient();
  const move = useMutation({
    mutationFn: ({ task, status }) => companyApi.updateTask(orgId, task.id, { status, version: task.version }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['company', orgId] }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const params = { project_id: projectId, limit: 100 };
  const tasks = useQuery({
    queryKey: ['company', orgId, 'tasks', params],
    queryFn: () => companyApi.tasks(orgId, params),
  });

  if (tasks.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (tasks.isError) return <p className="text-sm text-red-600">{errorMessage(tasks.error)}</p>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {canWrite ? (
          <button onClick={() => setDialog({ task: null })} className="bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold">
            משימה חדשה
          </button>
        ) : <span />}
        <ViewSwitcher views={TASK_VIEWS} value={view} onChange={setView} />
      </div>
      {view === 'list' && <TaskList tasks={tasks.data.data} onOpen={(task) => setDialog({ task })} />}
      {view === 'calendar' && <CalendarView tasks={tasks.data.data} onOpen={(task) => setDialog({ task })} />}
      {view === 'timeline' && <TimelineView tasks={tasks.data.data} onOpen={(task) => setDialog({ task })} />}
      {view === 'board' && <div className="flex gap-3 overflow-x-auto pb-2">
        {Object.entries(TASK_STATUS_LABELS).map(([status, label]) => {
          const column = tasks.data.data.filter((task) => task.status === status);
          return (
            <div
              key={status}
              className={`w-56 shrink-0 rounded-xl p-2 space-y-2 ${dragOver === status ? 'bg-blue-100' : 'bg-gray-100'}`}
              onDragOver={(event) => {
                if (canWrite) {
                  event.preventDefault();
                  setDragOver(status);
                }
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(null);
                const task = tasks.data.data.find((item) => String(item.id) === event.dataTransfer.getData('text/plain'));
                if (task && task.status !== status) move.mutate({ task, status });
              }}
            >
              <h3 className="text-xs font-bold text-gray-600">{label} ({column.length})</h3>
              {column.map((task) => (
                <button
                  key={task.id}
                  draggable={canWrite}
                  onDragStart={(event) => event.dataTransfer.setData('text/plain', String(task.id))}
                  onClick={() => setDialog({ task })}
                  className="block w-full text-right bg-white rounded-lg shadow-sm p-2"
                >
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="text-xs text-gray-500">{task.assignee_name || 'ללא אחראי'}</p>
                  {task.is_blocked && <p className="text-xs text-red-600">חסומה</p>}
                </button>
              ))}
            </div>
          );
        })}
      </div>}
      {dialog && <TaskDialog orgId={orgId} projectId={projectId} task={dialog.task} currentUserId={currentUserId} onClose={() => setDialog(null)} />}
    </div>
  );
}

function RequirementsTab({ orgId, projectId, canWrite }) {
  const [title, setTitle] = useState('');
  const requirements = useQuery({
    queryKey: ['company', orgId, 'project', projectId, 'requirements'],
    queryFn: () => companyApi.requirements(orgId, projectId),
  });
  const taskParams = { project_id: projectId, limit: 100 };
  const tasks = useQuery({
    queryKey: ['company', orgId, 'tasks', taskParams],
    queryFn: () => companyApi.tasks(orgId, taskParams),
  });

  const create = useCompanyMutation(orgId, () => companyApi.createRequirement(orgId, projectId, { title }), () => setTitle(''));
  const update = useCompanyMutation(orgId, ({ id, changes }) => companyApi.updateRequirement(orgId, projectId, id, changes));

  if (requirements.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (requirements.isError) return <p className="text-sm text-red-600">{errorMessage(requirements.error)}</p>;

  const taskList = tasks.data?.data ?? [];

  return (
    <div className="space-y-3">
      {canWrite && (
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <input className={`${input} flex-1`} placeholder="דרישה חדשה" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <button disabled={create.isPending} className="bg-blue-700 text-white rounded-lg px-4 text-sm font-semibold">הוספה</button>
        </form>
      )}
      {requirements.data.length === 0 && <p className="text-sm text-gray-500">אין דרישות עדיין</p>}
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {requirements.data.map((requirement) => {
          const linked = requirement.task_ids.map(String);
          return (
            <li key={requirement.id} className="p-3 space-y-1">
              <p className="font-semibold">{requirement.title}</p>
              <p className="text-xs text-gray-500">
                גרסה {requirement.revision} · {linked.length} משימות · {requirement.passing_tests}/{requirement.test_count} בדיקות עברו
              </p>
              {!requirement.has_tests && <p className="text-xs text-amber-700">אין בדיקה לדרישה הזו</p>}
              {canWrite && (
                <div className="flex flex-wrap gap-2">
                  <select
                    className="border rounded-lg px-2 py-1 text-xs"
                    value={requirement.status}
                    aria-label="סטטוס דרישה"
                    onChange={(e) => update.mutate({ id: requirement.id, changes: { status: e.target.value } })}
                  >
                    {Object.entries(REQUIREMENT_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                  <select
                    className="border rounded-lg px-2 py-1 text-xs"
                    value=""
                    aria-label="קישור משימה"
                    onChange={(e) => e.target.value && update.mutate({ id: requirement.id, changes: { task_ids: [...linked, e.target.value] } })}
                  >
                    <option value="">קישור משימה…</option>
                    {taskList.filter((task) => !linked.includes(String(task.id))).map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TestsTab({ orgId, projectId, canWrite }) {
  const [form, setForm] = useState({ title: '', expected: '', requirement_id: '', task_id: '' });
  const tests = useQuery({
    queryKey: ['company', orgId, 'project', projectId, 'tests'],
    queryFn: () => companyApi.tests(orgId, projectId),
  });
  const requirements = useQuery({
    queryKey: ['company', orgId, 'project', projectId, 'requirements'],
    queryFn: () => companyApi.requirements(orgId, projectId),
  });
  const taskParams = { project_id: projectId, limit: 100 };
  const tasks = useQuery({
    queryKey: ['company', orgId, 'tasks', taskParams],
    queryFn: () => companyApi.tasks(orgId, taskParams),
  });

  const create = useCompanyMutation(
    orgId,
    () => companyApi.createTest(orgId, projectId, form),
    () => setForm({ title: '', expected: '', requirement_id: '', task_id: '' })
  );
  const update = useCompanyMutation(orgId, ({ id, changes }) => companyApi.updateTest(orgId, projectId, id, changes));

  if (tests.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (tests.isError) return <p className="text-sm text-red-600">{errorMessage(tests.error)}</p>;

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="space-y-3">
      {canWrite && (
        <form className="bg-white rounded-xl shadow-sm p-3 space-y-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <input className={`${input} w-full`} placeholder="בדיקה חדשה" value={form.title} onChange={set('title')} required />
          <input className={`${input} w-full`} placeholder="תוצאה צפויה" value={form.expected} onChange={set('expected')} />
          <div className="flex flex-wrap gap-2">
            <select className={input} value={form.requirement_id} onChange={set('requirement_id')} aria-label="דרישה">
              <option value="">ללא דרישה</option>
              {(requirements.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <select className={input} value={form.task_id} onChange={set('task_id')} aria-label="משימה">
              <option value="">ללא משימה</option>
              {(tasks.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button disabled={create.isPending} className="bg-blue-700 text-white rounded-lg px-4 py-2 text-sm font-semibold">הוספה</button>
          </div>
        </form>
      )}
      {tests.data.length === 0 && <p className="text-sm text-gray-500">אין בדיקות עדיין</p>}
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {tests.data.map((test) => (
          <li key={test.id} className="p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{test.title}</p>
              {test.expected && <p className="text-xs text-gray-500">צפוי: {test.expected}</p>}
            </div>
            <select
              className="border rounded-lg px-2 py-1 text-xs"
              value={test.result}
              disabled={!canWrite}
              aria-label={`תוצאת ${test.title}`}
              onChange={(e) => update.mutate({ id: test.id, changes: { result: e.target.value } })}
            >
              {Object.entries(TEST_RESULT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MembersTab({ orgId, projectId, canManage, canListOrg }) {
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('contributor');

  const members = useQuery({
    queryKey: ['company', orgId, 'project', projectId, 'members'],
    queryFn: () => companyApi.projectMembers(orgId, projectId),
  });
  const orgMembers = useQuery({
    queryKey: ['company', orgId, 'members'],
    queryFn: () => companyApi.members(orgId),
    enabled: canManage && canListOrg,
  });

  const add = useCompanyMutation(orgId, () => companyApi.addProjectMember(orgId, projectId, { user_id: userId, role }), () => setUserId(''));
  const update = useCompanyMutation(orgId, ({ id, newRole }) => companyApi.updateProjectMember(orgId, projectId, id, newRole));
  const remove = useCompanyMutation(orgId, (id) => companyApi.removeProjectMember(orgId, projectId, id));

  if (members.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (members.isError) return <p className="text-sm text-red-600">{errorMessage(members.error)}</p>;

  const inProject = new Set(members.data.map((member) => String(member.user_id)));
  const candidates = (orgMembers.data?.data ?? []).filter(
    (member) => member.status === 'active' && !inProject.has(String(member.user_id))
  );

  return (
    <div className="space-y-3">
      {canManage && (
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}>
          <select className={`${input} flex-1 min-w-[10rem]`} value={userId} onChange={(e) => setUserId(e.target.value)} required aria-label="עובד">
            <option value="">בחירת עובד…</option>
            {candidates.map((member) => <option key={member.user_id} value={member.user_id}>{member.name}</option>)}
          </select>
          <select className={input} value={role} onChange={(e) => setRole(e.target.value)} aria-label="תפקיד בפרויקט">
            {Object.entries(PROJECT_ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <button disabled={add.isPending} className="bg-blue-700 text-white rounded-lg px-4 text-sm font-semibold">הוספה</button>
        </form>
      )}
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {members.data.map((member) => (
          <li key={member.id} className="p-3 flex items-center gap-2">
            <span className="flex-1 font-semibold truncate">{member.name}</span>
            {canManage ? (
              <>
                <select
                  className="border rounded-lg px-2 py-1 text-xs"
                  value={member.role}
                  aria-label={`תפקיד של ${member.name}`}
                  onChange={(e) => update.mutate({ id: member.id, newRole: e.target.value })}
                >
                  {Object.entries(PROJECT_ROLE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button className="text-xs text-red-700 underline" onClick={() => remove.mutate(member.id)}>הסרה</button>
              </>
            ) : (
              <span className="text-xs text-gray-600">{PROJECT_ROLE_LABELS[member.role]}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlanSection({ orgId, projectId, kind, title, canManage, statuses, withStart }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [due, setDue] = useState('');
  const items = useQuery({
    queryKey: ['company', orgId, 'project', projectId, kind],
    queryFn: () => companyApi.planItems(orgId, projectId, kind),
  });
  const body = withStart ? { name, start_at: start, end_at: due } : { name, due_at: due };
  const create = useCompanyMutation(orgId, () => companyApi.createPlanItem(orgId, projectId, kind, body), () => {
    setName('');
    setStart('');
    setDue('');
  });
  const update = useCompanyMutation(orgId, ({ id, status }) => companyApi.updatePlanItem(orgId, projectId, kind, id, { status }));
  const remove = useCompanyMutation(orgId, (id) => companyApi.deletePlanItem(orgId, projectId, kind, id));

  return (
    <section className="space-y-2">
      <h3 className="font-bold text-sm">{title}</h3>
      {canManage && (
        <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <input className={`${input} flex-1 min-w-[8rem]`} placeholder="שם" value={name} onChange={(e) => setName(e.target.value)} required />
          {withStart && <input type="date" className={input} aria-label="התחלה" value={start} onChange={(e) => setStart(e.target.value)} />}
          <input type="date" className={input} aria-label="סיום" value={due} onChange={(e) => setDue(e.target.value)} />
          <button disabled={create.isPending} className="bg-blue-700 text-white rounded-lg px-4 text-sm font-semibold">הוספה</button>
        </form>
      )}
      {items.data?.length === 0 && <p className="text-sm text-gray-500">אין עדיין</p>}
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {(items.data ?? []).map((item) => (
          <li key={item.id} className="p-3 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{item.name}</p>
              <p className="text-xs text-gray-500">
                {item.completed_tasks}/{item.task_count} משימות
                {item.due_at && ` · ${new Date(item.due_at).toLocaleDateString('he-IL')}`}
              </p>
            </div>
            {canManage && (
              <>
                <select className="border rounded-lg px-2 py-1 text-xs" value={item.status} aria-label={`סטטוס ${item.name}`} onChange={(e) => update.mutate({ id: item.id, status: e.target.value })}>
                  {Object.entries(statuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
                <button className="text-xs text-red-700 underline" onClick={() => remove.mutate(item.id)}>מחיקה</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanTab({ orgId, projectId, canManage, canSaveTemplate }) {
  const [templateName, setTemplateName] = useState('');
  const summary = useQuery({
    queryKey: ['company', orgId, 'project', projectId, 'time-summary'],
    queryFn: () => companyApi.timeSummary(orgId, projectId),
  });
  const save = useCompanyMutation(orgId, () => companyApi.saveAsTemplate(orgId, projectId, templateName), () => {
    setTemplateName('');
    toast.success('התבנית נשמרה');
  });
  const hours = (minutes) => (minutes / 60).toFixed(1);

  return (
    <div className="space-y-5">
      <PlanSection orgId={orgId} projectId={projectId} kind="milestones" title="אבני דרך" canManage={canManage} statuses={{ open: 'פתוחה', done: 'הושלמה' }} />
      <PlanSection orgId={orgId} projectId={projectId} kind="cycles" title="Sprints" canManage={canManage} withStart statuses={{ planned: 'מתוכנן', active: 'פעיל', done: 'הסתיים' }} />
      <section className="space-y-1">
        <h3 className="font-bold text-sm">שעות עבודה ({hours(summary.data?.total_minutes ?? 0)})</h3>
        {(summary.data?.people ?? []).map((person) => (
          <p key={person.user_id} className="text-sm">{person.name}: {hours(person.minutes)}</p>
        ))}
      </section>
      {canSaveTemplate && canManage && (
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
          <input className={`${input} flex-1`} placeholder="שמירת הפרויקט כתבנית: שם" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
          <button disabled={save.isPending} className="border rounded-lg px-4 text-sm">שמירה</button>
        </form>
      )}
    </div>
  );
}

const TABS = { tasks: 'משימות', plan: 'תכנון', requirements: 'דרישות', tests: 'בדיקות', members: 'חברים' };

export default function ProjectPage({ membership, currentUserId }) {
  const orgId = membership.organization.id;
  const queryClient = useQueryClient();
  const { projectId } = useParams();
  const [tab, setTab] = useState('tasks');

  const project = useQuery({
    queryKey: ['company', orgId, 'project', projectId],
    queryFn: () => companyApi.project(orgId, projectId),
    retry: false,
  });

  const navigate = useNavigate();
  const changeStatus = useCompanyMutation(orgId, (status) => companyApi.updateProject(orgId, projectId, { status }));
  const openChat = useMutation({
    mutationFn: () => companyApi.openProjectConversation(orgId, projectId),
    onSuccess: async (conversation) => {
      await queryClient.invalidateQueries({ queryKey: ['company', orgId, 'conversations'] });
      navigate(`/company/chat/${conversation.id}`);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  if (project.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (project.isError) {
    return (
      <div className="space-y-2">
        <p className="text-sm">אין לך הרשאה לפרויקט, או שהוא לא קיים.</p>
        <Link to="/company/projects" className="text-sm text-blue-700 underline">חזרה לפרויקטים</Link>
      </div>
    );
  }

  const { permissions } = project.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-bold truncate">{project.data.name}</h2>
        {permissions.edit_project ? (
          <select
            className="border rounded-lg px-2 py-1 text-sm"
            value={project.data.status}
            aria-label="סטטוס פרויקט"
            onChange={(e) => changeStatus.mutate(e.target.value)}
          >
            {Object.entries(PROJECT_STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        ) : (
          <span className="text-sm text-gray-600">{PROJECT_STATUS_LABELS[project.data.status]}</span>
        )}
      </div>

      <div className="flex gap-1 overflow-x-auto">
        {Object.entries(TABS).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1 rounded-lg text-sm whitespace-nowrap ${tab === key ? 'bg-gray-800 text-white' : 'bg-gray-200'}`}
          >
            {label}
          </button>
        ))}
        <button onClick={() => openChat.mutate()} disabled={openChat.isPending} className="px-3 py-1 rounded-lg text-sm whitespace-nowrap bg-blue-100 text-blue-800">
          שיחת פרויקט
        </button>
      </div>

      {tab === 'tasks' && <TasksTab orgId={orgId} projectId={projectId} canWrite={permissions.write} currentUserId={currentUserId} />}
      {tab === 'plan' && (
        <PlanTab orgId={orgId} projectId={projectId} canManage={permissions.edit_project} canSaveTemplate={membership.permissions.create_projects} />
      )}
      {tab === 'requirements' && <RequirementsTab orgId={orgId} projectId={projectId} canWrite={permissions.write} />}
      {tab === 'tests' && <TestsTab orgId={orgId} projectId={projectId} canWrite={permissions.write} />}
      {tab === 'members' && (
        <MembersTab
          orgId={orgId}
          projectId={projectId}
          canManage={permissions.manage_members}
          canListOrg={membership.permissions.view_members}
        />
      )}
    </div>
  );
}

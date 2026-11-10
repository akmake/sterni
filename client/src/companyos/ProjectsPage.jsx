import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { PROJECT_STATUS_LABELS, companyApi, errorMessage } from './companyApi';
import { EmptyState, PageHeader } from './CompanyUi';

export default function ProjectsPage({ membership }) {
  const orgId = membership.organization.id;
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [creating, setCreating] = useState(false);

  const projects = useQuery({
    queryKey: ['company', orgId, 'projects'],
    queryFn: () => companyApi.projects(orgId),
  });

  const templates = useQuery({
    queryKey: ['company', orgId, 'projects', 'templates'],
    queryFn: () => companyApi.templates(orgId),
    enabled: membership.permissions.create_projects,
  });

  const create = useMutation({
    mutationFn: () => (templateId ? companyApi.projectFromTemplate(orgId, templateId, name) : companyApi.createProject(orgId, { name })),
    onSuccess: () => {
      setName('');
      setCreating(false);
      queryClient.invalidateQueries({ queryKey: ['company', orgId, 'projects'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <section className="space-y-3">
      <PageHeader
        title="פרויקטים"
        subtitle="התקדמות, בעלות וכל העבודה הפעילה במקום אחד."
        action={membership.permissions.create_projects ? <button onClick={() => setCreating((value) => !value)}>פרויקט חדש</button> : null}
      />

      {membership.permissions.create_projects && creating && (
        <form
          className="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate();
          }}
        >
          <input
            className="flex-1 min-w-[10rem] border rounded-lg px-3 py-2"
            placeholder="שם פרויקט חדש"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          {templates.data?.length > 0 && (
            <select className="border rounded-lg px-2" aria-label="תבנית" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
              <option value="">ללא תבנית</option>
              {templates.data.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          )}
          <button disabled={create.isPending} className="bg-blue-700 text-white rounded-lg px-4 font-semibold disabled:opacity-50">
            יצירה
          </button>
        </form>
      )}

      {projects.isPending && <p className="text-sm text-gray-500">טוען…</p>}
      {projects.isError && <p className="text-sm text-red-600">{errorMessage(projects.error)}</p>}
      {projects.isSuccess && projects.data.data.length === 0 && (
        <EmptyState title="אין פרויקטים">פרויקטים שאתה משויך אליהם יופיעו כאן.</EmptyState>
      )}

      {projects.isSuccess && projects.data.data.length > 0 && (
        <ul className="bg-white rounded-xl shadow-sm divide-y">
          {projects.data.data.map((project) => (
            <li key={project.id}>
              <Link to={`/company/projects/${project.id}`} className="block p-5">
                <p className="font-bold text-lg">{project.name}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {PROJECT_STATUS_LABELS[project.status]} · {project.completed_tasks}/{project.task_count} משימות הושלמו
                </p>
                <div className="h-1.5 bg-gray-200 rounded-full mt-4 overflow-hidden">
                  <div className="h-full bg-[#147d6f]" style={{ width: `${project.task_count ? (project.completed_tasks / project.task_count) * 100 : 0}%` }} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

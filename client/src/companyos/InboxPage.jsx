import React from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { companyApi, errorMessage } from './companyApi';
import { EmptyState, PageHeader } from './CompanyUi';

const linkFor = (item) => {
  if (item.resource_type === 'conversation') return `/company/chat/${item.resource_id}`;
  if (item.resource_type === 'project') return `/company/projects/${item.resource_id}`;
  if (item.resource_type === 'lead') return `/company/crm?lead=${item.resource_id}`;
  if (item.resource_type === 'deal') return `/company/crm?deal=${item.resource_id}`;
  if (item.resource_type === 'document') return `/company/documents?id=${item.resource_id}`;
  return '/company/inbox';
};

export default function InboxPage({ membership }) {
  const orgId = membership.organization.id;
  const queryClient = useQueryClient();
  const key = ['company', orgId, 'notifications'];
  const inbox = useQuery({ queryKey: key, queryFn: () => companyApi.notifications(orgId) });
  const approvals = useQuery({ queryKey: ['company', orgId, 'approvals'], queryFn: () => companyApi.approvals(orgId) });

  const markAll = useMutation({
    mutationFn: () => companyApi.markNotificationsRead(orgId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
    onError: (error) => toast.error(errorMessage(error)),
  });
  const markOne = (id) => companyApi.markNotificationsRead(orgId, [id]).catch(() => {});

  const approvalLink = (item) => (item.resource_type === 'document'
    ? `/company/documents?id=${item.resource_id}`
    : `/company/crm?deal=${item.deal_id}`);

  if (inbox.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (inbox.isError) return <p className="text-sm text-red-600">{errorMessage(inbox.error)}</p>;

  return (
    <section className="space-y-3">
      <PageHeader
        title="דואר נכנס"
        subtitle="עדכונים ואישורים שמחכים לתשומת הלב שלך."
        action={inbox.data.meta.unread > 0 ? <button onClick={() => markAll.mutate()}>סימון הכול</button> : null}
      />
      {approvals.data?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-1">
          <h3 className="font-bold text-sm">ממתין לאישור שלך ({approvals.data.length})</h3>
          {approvals.data.map((item) => (
            <Link key={item.id} to={approvalLink(item)} className="block text-sm underline">
              {item.title}{item.total_steps > 1 && ` · שלב ${item.step}/${item.total_steps}`}
            </Link>
          ))}
        </div>
      )}
      {inbox.data.data.length === 0 && <EmptyState title="אין עדכונים חדשים">כשתהיה פעילות חדשה היא תופיע כאן.</EmptyState>}
      <ul className="bg-white rounded-2xl shadow-sm divide-y">
        {inbox.data.data.map((item) => (
          <li key={item.id}>
            <Link to={linkFor(item)} onClick={() => markOne(item.id)} className={`block p-5 ${item.is_read ? '' : 'bg-blue-50'}`}>
              <p className="font-semibold">{item.title}</p>
              {item.body && <p className="text-sm text-gray-600 truncate mt-1">{item.body}</p>}
              <p className="text-[11px] text-gray-400">{new Date(item.created_at).toLocaleString('he-IL')}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

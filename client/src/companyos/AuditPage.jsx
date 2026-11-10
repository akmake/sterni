import React from 'react';
import { Navigate } from 'react-router-dom';
import { useInfiniteQuery } from '@tanstack/react-query';
import { AUDIT_LABELS, ROLE_LABELS, STATUS_LABELS, companyApi, errorMessage } from './companyApi';
import { PageHeader } from './CompanyUi';

const describe = (entry) => {
  const { metadata } = entry;
  if (entry.action === 'member.updated' && metadata.before && metadata.after) {
    const changes = [];
    if (metadata.before.role !== metadata.after.role) {
      changes.push(`${ROLE_LABELS[metadata.before.role]} ← ${ROLE_LABELS[metadata.after.role]}`);
    }
    if (metadata.before.status !== metadata.after.status) {
      changes.push(`${STATUS_LABELS[metadata.before.status]} ← ${STATUS_LABELS[metadata.after.status]}`);
    }
    return changes.join(', ');
  }
  return metadata.email || metadata.name || metadata.after || '';
};

export default function AuditPage({ membership }) {
  const orgId = membership.organization.id;
  const canView = membership.permissions.view_audit;

  const audit = useInfiniteQuery({
    queryKey: ['company', orgId, 'audit'],
    queryFn: ({ pageParam }) => companyApi.audit(orgId, pageParam),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.meta.next_cursor ?? undefined,
    enabled: canView,
  });

  if (!canView) return <Navigate to="/company/" replace />;
  if (audit.isPending) return <p className="text-sm text-gray-500">טוען…</p>;
  if (audit.isError) return <p className="text-sm text-red-600">{errorMessage(audit.error)}</p>;

  const entries = audit.data.pages.flatMap((page) => page.data);

  return (
    <section className="space-y-3">
      <PageHeader title="יומן פעולות" subtitle="שינויים רגישים ופעולות ניהול בארגון." />
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {entries.map((entry) => (
          <li key={entry.id} className="p-5">
            <p className="font-semibold">{AUDIT_LABELS[entry.action] || entry.action}</p>
            <p className="text-sm text-gray-600 mt-1">{describe(entry)}</p>
            <p className="text-xs text-gray-400">
              {entry.actor_name} · {new Date(entry.created_at).toLocaleString('he-IL')}
            </p>
          </li>
        ))}
      </ul>
      {audit.hasNextPage && (
        <button
          disabled={audit.isFetchingNextPage}
          onClick={() => audit.fetchNextPage()}
          className="w-full border rounded-lg py-2 text-sm"
        >
          טעינת עוד
        </button>
      )}
    </section>
  );
}

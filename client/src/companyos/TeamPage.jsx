import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ROLE_LABELS, STATUS_LABELS, companyApi, errorMessage } from './companyApi';

function MemberRow({ member, assignableRoles, onChange, busy }) {
  return (
    <li className="p-3 flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[10rem]">
        <p className="font-semibold">
          {member.name} {member.is_self && <span className="text-xs text-gray-500">(אתה)</span>}
        </p>
        <p className="text-xs text-gray-500" dir="ltr" style={{ textAlign: 'right' }}>{member.email}</p>
      </div>

      {member.status !== 'active' && (
        <span className="text-xs bg-gray-200 rounded px-2 py-1">{STATUS_LABELS[member.status]}</span>
      )}

      {member.can_manage ? (
        <>
          <select
            className="border rounded-lg px-2 py-1 text-sm"
            value={member.role}
            disabled={busy}
            aria-label={`תפקיד של ${member.name}`}
            onChange={(event) => onChange(member.id, { role: event.target.value })}
          >
            {assignableRoles.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
          {member.status === 'active' ? (
            <button
              disabled={busy}
              className="text-sm text-red-700 underline"
              onClick={() => {
                if (window.confirm(`להשעות את ${member.name}? הגישה תיחסם מיד.`)) {
                  onChange(member.id, { status: 'suspended' });
                }
              }}
            >
              השעיה
            </button>
          ) : (
            <button
              disabled={busy}
              className="text-sm text-blue-700 underline"
              onClick={() => onChange(member.id, { status: 'active' })}
            >
              החזרה לפעילות
            </button>
          )}
        </>
      ) : (
        <span className="text-sm text-gray-600">{ROLE_LABELS[member.role]}</span>
      )}
    </li>
  );
}

function InvitesSection({ orgId }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [createdLink, setCreatedLink] = useState(null);

  const invites = useQuery({
    queryKey: ['company', orgId, 'invites'],
    queryFn: () => companyApi.invites(orgId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', orgId, 'invites'] });

  const create = useMutation({
    mutationFn: () => companyApi.createInvite(orgId, email, role),
    onSuccess: (invite) => {
      setCreatedLink({ email: invite.email, url: `${window.location.origin}/company/join/${invite.token}` });
      setEmail('');
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const revoke = useMutation({
    mutationFn: (inviteId) => companyApi.revokeInvite(orgId, inviteId),
    onSuccess: refresh,
    onError: (error) => toast.error(errorMessage(error)),
  });

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(createdLink.url);
      toast.success('הקישור הועתק');
    } catch {
      toast.error('לא הצלחנו להעתיק. אפשר לסמן את הקישור ולהעתיק ידנית');
    }
  };

  const invitableRoles = invites.data?.meta?.invitable_roles ?? [];

  return (
    <section className="space-y-3">
      <h2 className="font-bold">הזמנת עובד</h2>
      <form
        className="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <input
          className="flex-1 min-w-[12rem] border rounded-lg px-3 py-2"
          type="email"
          dir="ltr"
          placeholder="אימייל"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <select
          className="border rounded-lg px-2 py-2"
          value={role}
          aria-label="תפקיד"
          onChange={(event) => setRole(event.target.value)}
        >
          {invitableRoles.map((option) => (
            <option key={option} value={option}>{ROLE_LABELS[option]}</option>
          ))}
        </select>
        <button
          disabled={create.isPending}
          className="bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
        >
          יצירת קישור
        </button>
      </form>

      {createdLink && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <p className="text-sm">
            קישור להזמנת <span dir="ltr">{createdLink.email}</span>. הוא יוצג רק עכשיו, בתוקף ל-7 ימים ולשימוש חד-פעמי.
          </p>
          <input
            readOnly
            dir="ltr"
            className="w-full border rounded-lg px-2 py-1 text-xs"
            value={createdLink.url}
            onFocus={(event) => event.target.select()}
          />
          <button onClick={copyLink} className="text-sm text-blue-700 underline">העתקה</button>
        </div>
      )}

      {invites.isError && <p className="text-sm text-red-600">{errorMessage(invites.error)}</p>}

      {invites.data?.data.length > 0 && (
        <ul className="bg-white rounded-xl shadow-sm divide-y">
          {invites.data.data.map((invite) => (
            <li key={invite.id} className="p-3 flex items-center gap-2">
              <span className="flex-1 text-sm truncate" dir="ltr" style={{ textAlign: 'right' }}>{invite.email}</span>
              <span className="text-xs text-gray-500">{ROLE_LABELS[invite.role]}</span>
              <button
                disabled={revoke.isPending}
                className="text-sm text-red-700 underline"
                onClick={() => revoke.mutate(invite.id)}
              >
                ביטול
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function TeamPage({ membership }) {
  const orgId = membership.organization.id;
  const queryClient = useQueryClient();

  const members = useQuery({
    queryKey: ['company', orgId, 'members'],
    queryFn: () => companyApi.members(orgId),
    enabled: membership.permissions.view_members,
  });

  const update = useMutation({
    mutationFn: ({ memberId, changes }) => companyApi.updateMember(orgId, memberId, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company', orgId, 'members'] }),
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="font-bold">חברי הצוות</h2>
        {members.isPending && <p className="text-sm text-gray-500">טוען…</p>}
        {members.isError && (
          <div className="text-sm text-red-600">
            {errorMessage(members.error)}{' '}
            <button className="underline" onClick={() => members.refetch()}>נסה שוב</button>
          </div>
        )}
        {members.isSuccess && (
          <ul className="bg-white rounded-xl shadow-sm divide-y">
            {members.data.data.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                assignableRoles={members.data.meta.assignable_roles}
                busy={update.isPending}
                onChange={(memberId, changes) => update.mutate({ memberId, changes })}
              />
            ))}
          </ul>
        )}
      </section>

      {membership.permissions.manage_members && <InvitesSection orgId={orgId} />}
    </div>
  );
}

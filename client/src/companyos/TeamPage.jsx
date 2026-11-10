import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AVAILABILITY_LABELS, ROLE_LABELS, STATUS_LABELS, companyApi, errorMessage } from './companyApi';

function MemberRow({ member, assignableRoles, onChange, busy }) {
  const [temporary, setTemporary] = useState(false);
  const [until, setUntil] = useState('');
  const [tempRole, setTempRole] = useState('manager');

  return (
    <li className="p-3 flex flex-wrap items-center gap-2">
      <div className="flex-1 min-w-[10rem]">
        <p className="font-semibold">
          <span
            className={`inline-block w-2 h-2 rounded-full ml-1 ${member.online ? 'bg-green-500' : 'bg-gray-300'}`}
            title={member.online ? 'מחובר' : 'לא מחובר'}
          />
          {member.name} {member.is_self && <span className="text-xs text-gray-500">(אתה)</span>}
        </p>
        <p className="text-xs text-gray-500" dir="ltr" style={{ textAlign: 'right' }}>{member.email}</p>
        {(member.availability !== 'active' || member.status_text) && (
          <p className="text-xs text-gray-500">
            {member.availability !== 'active' && AVAILABILITY_LABELS[member.availability]}
            {member.status_text && ` ${member.status_text}`}
          </p>
        )}
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
          <button className="text-sm text-gray-600 underline" onClick={() => setTemporary((value) => !value)}>הרשאה זמנית</button>
          {member.role_expires_at && (
            <span className="text-xs text-amber-700 w-full">
              זמני עד {new Date(member.role_expires_at).toLocaleDateString('he-IL')}
            </span>
          )}
          {temporary && (
            <form
              className="w-full flex flex-wrap gap-2 items-center"
              onSubmit={(event) => {
                event.preventDefault();
                onChange(member.id, { role: tempRole, expires_at: until });
                setTemporary(false);
              }}
            >
              <select className="border rounded-lg px-2 py-1 text-sm" aria-label="תפקיד זמני" value={tempRole} onChange={(e) => setTempRole(e.target.value)}>
                {assignableRoles.filter((role) => role !== 'owner').map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}
              </select>
              <input type="date" required className="border rounded-lg px-2 py-1 text-sm" aria-label="בתוקף עד" value={until} onChange={(e) => setUntil(e.target.value)} />
              <button className="text-sm text-blue-700 font-semibold">הענקה</button>
            </form>
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
  const [role, setRole] = useState('member');
  const [createdLink, setCreatedLink] = useState(null);

  const invites = useQuery({
    queryKey: ['company', orgId, 'invites'],
    queryFn: () => companyApi.invites(orgId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', orgId, 'invites'] });

  const create = useMutation({
    mutationFn: () => companyApi.createInvite(orgId, role),
    onSuccess: (invite) => {
      setCreatedLink({ role: invite.role, url: `${window.location.origin}/company/join/${invite.token}` });
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
      <div>
        <h2 className="font-bold">קישור הצטרפות</h2>
        <p className="text-sm text-gray-500 mt-1">בוחרים תפקיד, יוצרים קישור ושולחים אותו. העובד ימלא את הפרטים בעצמו.</p>
      </div>
      <form
        className="bg-white rounded-xl shadow-sm p-3 flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate();
        }}
      >
        <select
          className="flex-1 min-w-[12rem] border rounded-lg px-3 py-2"
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
            הקישור מוכן לתפקיד {ROLE_LABELS[createdLink.role]}. הוא מוצג רק עכשיו, בתוקף ל-7 ימים ולשימוש חד-פעמי.
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
              <span className="flex-1 text-sm truncate">קישור פתוח</span>
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

function TeamsSection({ orgId, canManage, people }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const key = ['company', orgId, 'teams'];
  const teams = useQuery({ queryKey: key, queryFn: () => companyApi.teams(orgId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', orgId] });
  const onError = (error) => toast.error(errorMessage(error));

  const create = useMutation({
    mutationFn: () => companyApi.createTeam(orgId, name),
    onSuccess: () => {
      setName('');
      refresh();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: (id) => companyApi.deleteTeam(orgId, id), onSuccess: refresh, onError });
  const add = useMutation({ mutationFn: ({ id, userId }) => companyApi.addTeamMember(orgId, id, userId), onSuccess: refresh, onError });
  const drop = useMutation({ mutationFn: ({ id, userId }) => companyApi.removeTeamMember(orgId, id, userId), onSuccess: refresh, onError });

  return (
    <section className="space-y-2">
      <h2 className="font-bold">צוותים</h2>
      {canManage && (
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          <input className="flex-1 border rounded-lg px-3 py-2" placeholder="צוות חדש" value={name} onChange={(e) => setName(e.target.value)} required />
          <button disabled={create.isPending} className="bg-blue-700 text-white rounded-lg px-4 font-semibold">יצירה</button>
        </form>
      )}
      {teams.data?.length === 0 && <p className="text-sm text-gray-500">אין צוותים עדיין</p>}
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {(teams.data ?? []).map((team) => {
          const inTeam = new Set(team.members.map((m) => String(m.user_id)));
          const candidates = people.filter((p) => p.status === 'active' && !inTeam.has(String(p.user_id)));
          return (
            <li key={team.id} className="p-3 space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-semibold">{team.name}</span>
                {canManage && <button className="text-xs text-red-700 underline" onClick={() => remove.mutate(team.id)}>מחיקה</button>}
              </div>
              <div className="flex flex-wrap gap-1">
                {team.members.map((member) => (
                  <span key={member.user_id} className="text-xs bg-gray-100 rounded-full px-2 py-0.5">
                    {member.name}
                    {canManage && (
                      <button className="mr-1 text-gray-500" aria-label={`הסרת ${member.name}`} onClick={() => drop.mutate({ id: team.id, userId: member.user_id })}>✕</button>
                    )}
                  </span>
                ))}
              </div>
              {canManage && candidates.length > 0 && (
                <select
                  className="border rounded-lg px-2 py-1 text-xs"
                  value=""
                  aria-label={`הוספה לצוות ${team.name}`}
                  onChange={(e) => e.target.value && add.mutate({ id: team.id, userId: e.target.value })}
                >
                  <option value="">הוספת חבר…</option>
                  {candidates.map((person) => <option key={person.user_id} value={person.user_id}>{person.name}</option>)}
                </select>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function WorkloadSection({ orgId }) {
  const workload = useQuery({ queryKey: ['company', orgId, 'tasks', 'workload'], queryFn: () => companyApi.workload(orgId) });
  if (!workload.data?.length) return null;
  const max = Math.max(...workload.data.map((row) => row.open));
  return (
    <section className="space-y-2">
      <h2 className="font-bold">עומסים</h2>
      <ul className="bg-white rounded-xl shadow-sm divide-y">
        {workload.data.map((row) => (
          <li key={row.user_id} className="p-3">
            <div className="flex justify-between text-sm">
              <span className="font-semibold">{row.name}</span>
              <span className="text-xs text-gray-500">
                {row.open} פתוחות{row.overdue > 0 && <span className="text-red-600"> · {row.overdue} באיחור</span>}
              </span>
            </div>
            <div className="h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-blue-700" style={{ width: `${(row.open / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
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

      <TeamsSection orgId={orgId} canManage={membership.permissions.manage_members} people={members.data?.data ?? []} />

      <WorkloadSection orgId={orgId} />

      {membership.permissions.manage_members && <InvitesSection orgId={orgId} />}
    </div>
  );
}

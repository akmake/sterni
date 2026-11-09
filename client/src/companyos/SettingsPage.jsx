import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ROLE_LABELS, companyApi, errorMessage } from './companyApi';

export default function SettingsPage({ membership, user, onSignOut }) {
  const { organization, permissions, role } = membership;
  const queryClient = useQueryClient();
  const [name, setName] = useState(organization.name);

  const save = useMutation({
    mutationFn: () => companyApi.updateOrganization(organization.id, name),
    onSuccess: () => {
      toast.success('נשמר');
      queryClient.invalidateQueries({ queryKey: ['company', 'me'] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="space-y-4">
      <section className="bg-white rounded-xl shadow-sm p-4">
        <p className="font-semibold">{user.name}</p>
        <p className="text-sm text-gray-500" dir="ltr" style={{ textAlign: 'right' }}>{user.email}</p>
        <p className="text-sm text-gray-600 mt-1">{ROLE_LABELS[role]}</p>
      </section>

      {permissions.manage_organization && (
        <form
          className="bg-white rounded-xl shadow-sm p-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <label className="block text-sm font-semibold" htmlFor="company-name">שם הארגון</label>
          <input
            id="company-name"
            className="w-full border rounded-lg px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
          <button
            disabled={save.isPending}
            className="bg-blue-700 text-white rounded-lg px-4 py-2 font-semibold disabled:opacity-50"
          >
            שמירה
          </button>
        </form>
      )}

      {/* On phones these two aren't in the bottom bar. */}
      <div className="sm:hidden bg-white rounded-xl shadow-sm divide-y">
        {permissions.view_members && <Link to="/company/team" className="block p-3 font-semibold">צוות</Link>}
        {permissions.view_audit && <Link to="/company/audit" className="block p-3 font-semibold">יומן פעולות</Link>}
      </div>

      <button onClick={onSignOut} className="w-full border border-red-300 text-red-700 rounded-lg py-2">
        התנתקות
      </button>
    </div>
  );
}

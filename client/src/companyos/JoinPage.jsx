import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import CenteredCard from './CenteredCard';
import { ROLE_LABELS, companyApi, errorMessage } from './companyApi';

export default function JoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, login } = useAuthStore();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const invite = useQuery({
    queryKey: ['company', 'invite', token],
    queryFn: () => companyApi.getInvite(token),
    retry: false,
  });

  const accept = useMutation({
    mutationFn: (body) => companyApi.acceptInvite(token, body),
    onSuccess: (result) => {
      login(result.user);
      queryClient.removeQueries({ queryKey: ['company'] });
      navigate('/company/', { replace: true });
    },
  });

  if (invite.isPending) return <CenteredCard><p className="text-center">טוען…</p></CenteredCard>;

  if (invite.isError) {
    return (
      <CenteredCard title="ההזמנה לא זמינה">
        <p className="text-sm text-center text-gray-600">{errorMessage(invite.error)}</p>
      </CenteredCard>
    );
  }

  const { organization_name: organizationName, email, role, account_exists: accountExists } = invite.data;
  const isRightAccount = user?.email?.toLowerCase() === email;
  const acceptError = accept.isError && (
    <p className="text-sm text-red-600 text-center">{errorMessage(accept.error)}</p>
  );
  const intro = (
    <p className="text-sm text-center text-gray-600">
      הוזמנת להצטרף ל-{organizationName} בתפקיד {ROLE_LABELS[role]}.
    </p>
  );

  if (accountExists && !isRightAccount) {
    return (
      <CenteredCard title="הצטרפות">
        {intro}
        <p className="text-sm text-center">
          יש להתחבר עם <span dir="ltr">{email}</span> כדי לאשר את ההזמנה.
        </p>
        <Link
          to={`/company/login?next=${encodeURIComponent(`/company/join/${token}`)}`}
          className="block text-center bg-blue-700 text-white rounded-lg py-2 font-semibold"
        >
          התחברות
        </Link>
      </CenteredCard>
    );
  }

  if (accountExists) {
    return (
      <CenteredCard title="הצטרפות">
        {intro}
        {acceptError}
        <button
          onClick={() => accept.mutate({})}
          disabled={accept.isPending}
          className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {accept.isPending ? 'מצטרף…' : 'אישור והצטרפות'}
        </button>
      </CenteredCard>
    );
  }

  return (
    <CenteredCard title="הצטרפות">
      {intro}
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          accept.mutate({ name, password });
        }}
      >
        <input className="w-full border rounded-lg px-3 py-2 bg-gray-100" dir="ltr" value={email} readOnly />
        <input
          className="w-full border rounded-lg px-3 py-2"
          placeholder="שם מלא"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          type="password"
          dir="ltr"
          placeholder="סיסמה (לפחות 8 תווים)"
          autoComplete="new-password"
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {acceptError}
        <button
          disabled={accept.isPending}
          className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {accept.isPending ? 'יוצר חשבון…' : 'יצירת חשבון והצטרפות'}
        </button>
      </form>
    </CenteredCard>
  );
}

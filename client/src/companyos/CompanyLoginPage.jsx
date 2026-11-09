import React, { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import CenteredCard from './CenteredCard';
import { companyApi, errorMessage } from './companyApi';

export default function CompanyLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuthStore();

  // Only ever redirect inside this area, so a crafted link can't send users elsewhere.
  const requested = searchParams.get('next') || '';
  const next = /^\/company\/[^/]/.test(requested) ? requested : '/company/';

  const submit = useMutation({
    mutationFn: () => companyApi.login(email, password),
    onSuccess: (body) => {
      login(body.user);
      navigate(next, { replace: true });
    },
  });

  if (isAuthenticated && !submit.isSuccess && !searchParams.get('next')) {
    return <Navigate to="/company/" replace />;
  }

  return (
    <CenteredCard title="Company OS">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit.mutate();
        }}
      >
        <input
          className="w-full border rounded-lg px-3 py-2"
          type="email"
          dir="ltr"
          placeholder="אימייל"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <input
          className="w-full border rounded-lg px-3 py-2"
          type="password"
          dir="ltr"
          placeholder="סיסמה"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
        {submit.isError && (
          <p className="text-sm text-red-600 text-center">{errorMessage(submit.error, 'ההתחברות נכשלה')}</p>
        )}
        <button
          disabled={submit.isPending}
          className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50"
        >
          {submit.isPending ? 'מתחבר…' : 'התחברות'}
        </button>
      </form>
    </CenteredCard>
  );
}

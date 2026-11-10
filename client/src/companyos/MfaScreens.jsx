import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import CenteredCard from './CenteredCard';
import { companyApi, errorMessage } from './companyApi';

const codeInput = 'w-full border rounded-lg px-3 py-2 text-center tracking-widest';

export function MfaVerifyScreen({ onSignOut }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const verify = useMutation({
    mutationFn: () => companyApi.mfaVerify(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company'] }),
    onError: (error) => {
      setCode('');
      toast.error(errorMessage(error));
    },
  });

  return (
    <CenteredCard title="אימות דו-שלבי">
      <p className="text-sm text-center text-gray-600">הזינו את הקוד מאפליקציית האימות, או קוד שחזור.</p>
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          verify.mutate();
        }}
      >
        <input className={codeInput} dir="ltr" autoComplete="one-time-code" aria-label="קוד אימות" value={code} onChange={(e) => setCode(e.target.value)} required />
        <button disabled={verify.isPending} className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50">אימות</button>
      </form>
      <button onClick={onSignOut} className="w-full text-sm text-gray-500 underline">התנתקות</button>
    </CenteredCard>
  );
}

// Used both as a forced screen (organization policy) and inside Settings.
export function MfaSetup({ onDone }) {
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [recovery, setRecovery] = useState(null);
  const onError = (error) => toast.error(errorMessage(error));

  const start = useMutation({ mutationFn: companyApi.mfaSetup, onSuccess: setSetup, onError });
  const enable = useMutation({
    mutationFn: () => companyApi.mfaEnable(code),
    onSuccess: (result) => setRecovery(result.recovery_codes),
    onError,
  });

  const finish = () => {
    queryClient.invalidateQueries({ queryKey: ['company'] });
    onDone?.();
  };

  if (recovery) {
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold">שמרו את קודי השחזור במקום בטוח. הם יוצגו רק עכשיו.</p>
        <ul className="grid grid-cols-2 gap-1 font-mono text-sm" dir="ltr">
          {recovery.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <button onClick={finish} className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold">שמרתי, סיום</button>
      </div>
    );
  }

  if (!setup) {
    return (
      <button disabled={start.isPending} onClick={() => start.mutate()} className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50">
        הפעלת אימות דו-שלבי
      </button>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm">סרקו באפליקציית אימות, והזינו את הקוד שמוצג בה.</p>
      <img src={setup.qr} alt="קוד QR להגדרת אימות דו-שלבי" className="mx-auto w-44 h-44" />
      <p className="text-xs text-center break-all font-mono" dir="ltr">{setup.secret}</p>
      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          enable.mutate();
        }}
      >
        <input className={codeInput} dir="ltr" inputMode="numeric" autoComplete="one-time-code" aria-label="קוד אימות" value={code} onChange={(e) => setCode(e.target.value)} required />
        <button disabled={enable.isPending} className="w-full bg-blue-700 text-white rounded-lg py-2 font-semibold disabled:opacity-50">אישור</button>
      </form>
    </div>
  );
}

export function MfaSetupScreen({ onSignOut }) {
  return (
    <CenteredCard title="נדרש אימות דו-שלבי">
      <p className="text-sm text-center text-gray-600">הארגון מחייב מנהלים להפעיל אימות דו-שלבי.</p>
      <MfaSetup />
      <button onClick={onSignOut} className="w-full text-sm text-gray-500 underline">התנתקות</button>
    </CenteredCard>
  );
}

export function MfaSettings({ status, membership }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const organization = membership.organization;
  const onError = (error) => toast.error(errorMessage(error));
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['company', 'me'] });

  const disable = useMutation({
    mutationFn: () => companyApi.mfaDisable(code),
    onSuccess: () => {
      setCode('');
      refresh();
    },
    onError,
  });
  const policy = useMutation({
    mutationFn: (requireMfa) => companyApi.updateOrganizationSettings(organization.id, { require_mfa: requireMfa }),
    onSuccess: refresh,
    onError,
  });

  return (
    <section className="bg-white rounded-xl shadow-sm p-4 space-y-3">
      <h3 className="font-semibold text-sm">אימות דו-שלבי</h3>
      {!status.enabled && <MfaSetup onDone={refresh} />}
      {status.enabled && (
        <form
          className="flex gap-2 items-center"
          onSubmit={(event) => {
            event.preventDefault();
            disable.mutate();
          }}
        >
          <span className="text-sm text-green-700 shrink-0">פעיל</span>
          <input className="flex-1 min-w-0 border rounded-lg px-2 py-1 text-sm" dir="ltr" placeholder="קוד לכיבוי" aria-label="קוד לכיבוי" value={code} onChange={(e) => setCode(e.target.value)} required />
          <button disabled={disable.isPending} className="text-sm text-red-700 underline shrink-0">כיבוי</button>
        </form>
      )}
      {membership.role === 'owner' && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={organization.require_mfa} disabled={policy.isPending} onChange={(e) => policy.mutate(e.target.checked)} />
          לחייב אימות דו-שלבי לבעלים ולמנהלי מערכת
        </label>
      )}
    </section>
  );
}

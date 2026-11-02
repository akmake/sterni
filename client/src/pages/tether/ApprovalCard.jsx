// One pending approval request — same choices as the Android app's ApprovalCard: an app-access
// request can be granted for 15/30/60 minutes or "always"; anything else is a plain approve.
import React, { useState } from 'react';
import { CheckCircle, XCircle, Check, AppWindow } from 'lucide-react';
import { timeAgo } from './tetherApi';
import { labelFor } from './blockPackCatalog';

const GRANT_OPTIONS = [15, 30, 60];

export default function ApprovalCard({ request, onResolve, busy }) {
  const [minutes, setMinutes] = useState(30);
  const isAppAccess = request.action === 'APP_ACCESS';
  const title = (request.packageName && labelFor(request.packageName)) || request.packageName || request.action;

  return (
    <div className="bg-white border border-orange-200 rounded-xl p-4">
      <div className="flex items-center gap-2">
        <AppWindow size={18} className="text-gray-500" />
        <span className="font-semibold text-gray-800">{title}</span>
      </div>
      <div className="text-xs text-gray-500 mt-1 space-y-0.5">
        {request.packageName && title !== request.packageName && <div dir="ltr" className="text-right font-mono">{request.packageName}</div>}
        <div>מכשיר: {request.deviceLabel || `${request.deviceId?.slice(0, 8)}...`} · פעולה: {request.action}</div>
        <div>{timeAgo(request.createdAt || request.requestedAt)}</div>
      </div>

      {isAppAccess && (
        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1.5">אישור זמני (בדקות)</div>
          <div className="flex gap-1.5">
            {GRANT_OPTIONS.map(m => (
              <button key={m} type="button" onClick={() => setMinutes(m)}
                className={`text-xs px-3 py-1 rounded-full border ${minutes === m ? 'bg-blue-900 text-white border-blue-900' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-3">
        <button type="button" disabled={busy} onClick={() => onResolve(request, { status: 'rejected' })}
          className="flex-1 flex items-center justify-center gap-1 border border-red-200 text-red-600 rounded-lg py-1.5 text-sm hover:bg-red-50 disabled:opacity-50">
          <XCircle size={14} /> דחה
        </button>
        {isAppAccess ? (
          <>
            <button type="button" disabled={busy} onClick={() => onResolve(request, { status: 'approved', grantMinutes: minutes, permanentAllow: false })}
              className="flex-1 flex items-center justify-center gap-1 bg-blue-900 text-white rounded-lg py-1.5 text-sm hover:bg-blue-800 disabled:opacity-50">
              <Check size={14} /> אשר זמנית
            </button>
            <button type="button" disabled={busy} onClick={() => onResolve(request, { status: 'approved', grantMinutes: 120, permanentAllow: true })}
              className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white rounded-lg py-1.5 text-sm hover:bg-green-700 disabled:opacity-50">
              <CheckCircle size={14} /> אשר תמיד
            </button>
          </>
        ) : (
          <button type="button" disabled={busy} onClick={() => onResolve(request, { status: 'approved' })}
            className="flex-1 flex items-center justify-center gap-1 bg-green-600 text-white rounded-lg py-1.5 text-sm hover:bg-green-700 disabled:opacity-50">
            <Check size={14} /> אשר
          </button>
        )}
      </div>
    </div>
  );
}

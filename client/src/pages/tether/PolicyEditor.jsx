import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';

export default function PolicyEditor({ communityId, initialPolicy, onSaved }) {
  const [policy, setPolicy] = useState({
    webFilterMode: 'NONE',
    allowedDomains: [],
    blockedDomains: [],
    ...initialPolicy,
  });
  const [saving, setSaving] = useState(false);
  const [domainsInput, setDomainsInput] = useState({
    allowed: (initialPolicy.allowedDomains || []).join('\n'),
    blocked: (initialPolicy.blockedDomains || []).join('\n'),
  });

  const toggle = (key) => setPolicy(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      const finalPolicy = {
        ...policy,
        allowedDomains: domainsInput.allowed.split('\n').map(d => d.trim().toLowerCase()).filter(Boolean),
        blockedDomains: domainsInput.blocked.split('\n').map(d => d.trim().toLowerCase()).filter(Boolean),
      };
      await tetherApi.put(`/admin/communities/${communityId}/policy`, finalPolicy, { headers: authHeader() });
      toast.success('פוליסי עודכן');
      onSaved(finalPolicy);
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const ToggleRow = ({ k, label }) => (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-700">{label}</span>
      <button onClick={() => toggle(k)}
        className={`w-10 h-5 rounded-full transition relative ${policy[k] ? 'bg-blue-600' : 'bg-gray-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition ${policy[k] ? 'right-0.5' : 'left-0.5'}`} />
      </button>
    </div>
  );

  return (
    <div className="bg-gray-50 rounded-xl p-4 mt-3" dir="rtl">
      <h4 className="font-semibold text-gray-700 mb-3">הגדרות פוליסי</h4>

      <ToggleRow k="blockInstallApps" label="חסום התקנת אפליקציות" />
      <ToggleRow k="hideGooglePlay"   label="הסתר Google Play" />
      <ToggleRow k="blockSafeBoot"    label="חסום מצב בטוח" />
      <ToggleRow k="blockFactoryReset" label="חסום איפוס יצרן" />
      <ToggleRow k="blockUsbTransfer" label="חסום העברת קבצים USB" />
      <ToggleRow k="logsEnabled"      label="הפעל לוגים" />

      <div className="mt-3">
        <label className="text-xs text-gray-500 mb-1 block">התנהגות בפעולה חסומה</label>
        <select value={policy.blockedActionBehavior}
          onChange={e => setPolicy(p => ({ ...p, blockedActionBehavior: e.target.value }))}
          className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
          <option value="SILENT">שקט</option>
          <option value="SHOW_MESSAGE">הצג הודעה</option>
          <option value="REQUEST_APPROVAL">בקשת אישור</option>
        </select>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <h5 className="text-xs font-semibold text-gray-500 uppercase mb-3">🌐 סינון אינטרנט</h5>
        <div className="mb-3">
          <label className="text-xs text-gray-500 mb-1 block">מצב סינון</label>
          <select value={policy.webFilterMode}
            onChange={e => setPolicy(p => ({ ...p, webFilterMode: e.target.value }))}
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm">
            <option value="NONE">ללא סינון</option>
            <option value="BLACKLIST">חסום אתרים ספציפיים (רשימה שחורה)</option>
            <option value="WHITELIST">אפשר רק אתרים ספציפיים (רשימה לבנה)</option>
          </select>
        </div>

        {policy.webFilterMode === 'BLACKLIST' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">דומיינים חסומים (שורה לכל דומיין)</label>
            <textarea value={domainsInput.blocked}
              onChange={e => setDomainsInput(d => ({ ...d, blocked: e.target.value }))}
              placeholder={"instagram.com\ntiktok.com\nyoutube.com"} rows={5} dir="ltr"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        {policy.webFilterMode === 'WHITELIST' && (
          <div>
            <label className="text-xs text-gray-500 mb-1 block">דומיינים מותרים בלבד (שורה לכל דומיין)</label>
            <textarea value={domainsInput.allowed}
              onChange={e => setDomainsInput(d => ({ ...d, allowed: e.target.value }))}
              placeholder={"google.com\nwikipedia.org\ngmail.com"} rows={5} dir="ltr"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-gray-400 mt-1">הערה: שרת Tether מותר תמיד באופן אוטומטי</p>
          </div>
        )}
      </div>

      <button onClick={save} disabled={saving}
        className="mt-4 bg-blue-900 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-800 disabled:opacity-60 transition">
        {saving ? 'שומר...' : 'שמור פוליסי'}
      </button>
    </div>
  );
}

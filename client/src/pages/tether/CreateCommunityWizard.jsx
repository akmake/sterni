// Web port of the Android admin app's CreateCommunityScreen: name → starting policy → summary.
import React, { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';
import { ToggleRow, RadioRow } from './ui';
import { DEFAULT_COMMUNITY_POLICY } from './blockPackCatalog';

const STEP_TITLES = ['פרטי קהילה', 'הגדרות מדיניות', 'סיום'];
const BEHAVIOR_LABELS = { SILENT: 'שקט', SHOW_MESSAGE: 'הודעה', REQUEST_APPROVAL: 'בקשת אישור' };

export default function CreateCommunityWizard({ onCreated, onClose }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [policy, setPolicy] = useState(DEFAULT_COMMUNITY_POLICY);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const set = (patch) => setPolicy(p => ({ ...p, ...patch }));

  const create = async () => {
    setCreating(true);
    setError(null);
    try {
      const { data } = await tetherApi.post('/admin/communities', { name: name.trim(), policy }, { headers: authHeader() });
      toast.success(`קהילה "${data.name}" נוצרה`);
      onCreated(data);
    } catch {
      setError('שגיאה ביצירת הקהילה');
    } finally {
      setCreating(false);
    }
  };

  // Sets the four parts individually rather than the legacy blockPack master, so each one stays
  // independently changeable later (and per app) in the community screen.
  const fullPack = policy.blockAllBrowsers && policy.blockYoutube && policy.blockAllStores && policy.blockApkInstall;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div role="dialog" aria-modal="true" aria-label="יצירת קהילה" className="bg-white rounded-xl w-full max-w-md max-h-[92vh] flex flex-col">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <button onClick={() => (step > 0 ? setStep(step - 1) : onClose())} aria-label="חזרה" className="p-1 text-gray-500 hover:bg-gray-100 rounded">
            <ArrowRight size={18} />
          </button>
          <h3 className="flex-1 font-semibold text-gray-900">{STEP_TITLES[step]}</h3>
          <button onClick={onClose} aria-label="סגור" className="p-1 text-gray-400 hover:bg-gray-100 rounded"><X size={18} /></button>
        </div>
        <div className="h-1 bg-gray-100"><div className="h-1 bg-blue-700 transition-all" style={{ width: `${((step + 1) / 3) * 100}%` }} /></div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <form onSubmit={e => { e.preventDefault(); if (name.trim()) setStep(1); }}>
              <h4 className="font-semibold text-gray-900 text-lg">שם הקהילה</h4>
              <p className="text-sm text-gray-500 mt-1">הכנס שם מזהה לקהילה</p>
              <input value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="שם קהילה (לדוגמה: משפחת כהן)"
                className="mt-5 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </form>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <Group title="חבילת חסימה">
                <ToggleRow label="הפעל חבילת חסימה מלאה" checked={fullPack}
                  onChange={v => set({ blockPack: false, blockAllBrowsers: v, blockYoutube: v, blockAllStores: v, blockApkInstall: v })} />
                <p className="text-xs text-gray-500 pb-1">מסמן את כל הארבעה למטה. אחרי היצירה אפשר לחסום או לשחרר כל דפדפן, גרסת יוטיוב או חנות בנפרד, במסך הקהילה.</p>
                <ToggleRow label="חסום את כל הדפדפנים" checked={policy.blockAllBrowsers} onChange={v => set({ blockAllBrowsers: v })} />
                <ToggleRow label="חסום יוטיוב בכל צורה" checked={policy.blockYoutube} onChange={v => set({ blockYoutube: v })} />
                <ToggleRow label="חסום את כל החנויות" checked={policy.blockAllStores} onChange={v => set({ blockAllStores: v })} />
                <ToggleRow label="חסום התקנת APK ידנית" checked={policy.blockApkInstall} onChange={v => set({ blockApkInstall: v })} />
              </Group>
              <Group title="חסימות">
                <ToggleRow label="חסום התקנת אפליקציות" checked={policy.blockInstallApps} onChange={v => set({ blockInstallApps: v })} />
                <ToggleRow label="הסתר Google Play" checked={policy.hideGooglePlay} onChange={v => set({ hideGooglePlay: v })} />
                <ToggleRow label="חסום מצב בטוח (Safe Mode)" checked={policy.blockSafeBoot} onChange={v => set({ blockSafeBoot: v })} />
                <ToggleRow label="חסום איפוס יצרן" checked={policy.blockFactoryReset} onChange={v => set({ blockFactoryReset: v })} />
                <ToggleRow label="חסום העברת קבצים USB" checked={policy.blockUsbTransfer} onChange={v => set({ blockUsbTransfer: v })} />
              </Group>
              <Group title="כשפעולה חסומה">
                <RadioRow label="חסימה שקטה (ללא הודעה)" selected={policy.blockedActionBehavior === 'SILENT'} onClick={() => set({ blockedActionBehavior: 'SILENT' })} />
                <RadioRow label="הצג הודעת חסימה" selected={policy.blockedActionBehavior === 'SHOW_MESSAGE'} onClick={() => set({ blockedActionBehavior: 'SHOW_MESSAGE' })} />
                <RadioRow label="אפשר בקשת אישור" selected={policy.blockedActionBehavior === 'REQUEST_APPROVAL'} onClick={() => set({ blockedActionBehavior: 'REQUEST_APPROVAL' })} />
              </Group>
              <Group title="לוגים">
                <ToggleRow label="שמור לוג פעולות חסומות" checked={policy.logsEnabled} onChange={v => set({ logsEnabled: v })} />
              </Group>
            </div>
          )}

          {step === 2 && (
            <div>
              <h4 className="font-semibold text-gray-900 text-lg mb-3">סיכום</h4>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                {[
                  ['שם', name],
                  ['חבילת חסימה מלאה', fullPack ? 'כן' : 'לא'],
                  ['חסום התקנות', policy.blockInstallApps ? 'כן' : 'לא'],
                  ['מסתיר Google Play', policy.hideGooglePlay ? 'כן' : 'לא'],
                  ['חסום Safe Mode', policy.blockSafeBoot ? 'כן' : 'לא'],
                  ['חסום איפוס יצרן', policy.blockFactoryReset ? 'כן' : 'לא'],
                  ['כשפעולה חסומה', BEHAVIOR_LABELS[policy.blockedActionBehavior]],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-gray-500">{label}</span><span className="font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
              {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t">
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)} disabled={step === 0 && !name.trim()}
              className="w-full bg-blue-900 text-white py-2.5 rounded-xl font-medium hover:bg-blue-800 disabled:opacity-50">הבא</button>
          ) : (
            <button onClick={create} disabled={creating}
              className="w-full bg-blue-900 text-white py-2.5 rounded-xl font-semibold hover:bg-blue-800 disabled:opacity-60">
              {creating ? 'יוצר...' : 'צור קהילה'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 mb-1">{title}</div>
      <div className="bg-gray-50 rounded-xl px-3 py-1">{children}</div>
    </div>
  );
}

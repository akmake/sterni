// Web port of the Android admin app's DevicePolicyTab: per-device overrides on top of the
// community policy, edited as one draft and saved with "שמור הגדרות מכשיר".
// Every field is optional — null / empty means "follow the community".
import React, { useState } from 'react';
import { Info, Shield, Ban, SlidersHorizontal, AppWindow, Globe, Clock } from 'lucide-react';
import BlockPackEditor, { packStateFromPolicy } from './BlockPackEditor';
import {
  SectionCard, NullableToggleRow, ChipGroup, PackageListEditor, DomainListEditor,
  DeviceLockField, AppTimeLocksEditor, StickySaveBar,
} from './ui';
import { ALL_PACKAGES, expandLegacyDevicePack, labelFor } from './blockPackCatalog';

const TEXT_FIELDS = [
  { key: 'adminEmergencyCode', label: 'קוד חירום למכשיר (ריק = ירושה)', type: 'password' },
  { key: 'supportName', label: 'שם תמיכה (ריק = ירושה)' },
  { key: 'supportWhatsApp', label: 'WhatsApp תמיכה (ריק = ירושה)' },
  { key: 'supportEmail', label: 'אימייל תמיכה (ריק = ירושה)' },
];

export default function DevicePolicyTab({ policy, mergedPolicy, installedPackages, saving, onSave }) {
  // A legacy "everything" pack (on this device or inherited from the community) is shown as its
  // individual parts, so a single browser / YouTube variant / store can be released here.
  const communityPackOn = policy.blockPack == null && mergedPolicy?.blockPack === true;
  const packExpanded = policy.blockPack === true || communityPackOn;
  const [edited, setEdited] = useState(() => expandLegacyDevicePack({
    blockedApps: [], allowedApps: [], appTimeLocks: [], ...policy,
  }, communityPackOn));
  const set = (patch) => setEdited(p => ({ ...p, ...patch }));
  const blockedApps = edited.blockedApps || [];

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 bg-blue-50 text-blue-800 rounded-xl px-3 py-2.5 text-xs">
        <Info size={15} className="shrink-0 mt-0.5" />
        <span>הגדרות כאן מחליפות את מדיניות הקהילה למכשיר הזה בלבד. "לפי הקהילה" = שימוש בהגדרת קהילה.</span>
      </div>

      <SectionCard title="חבילת חסימה למכשיר" icon={Shield}>
        {packExpanded && (
          <p className="text-xs text-blue-800 mb-2">
            החבילה המלאה ("הכל יחד") פורקה לפריטים — אותן חסימות נשארות. לחץ "שמור הגדרות מכשיר" כדי לאשר.
          </p>
        )}
        <BlockPackEditor state={packStateFromPolicy(edited, setEdited, {
          nullable: true,
          installsBlocked: edited.blockInstallApps ?? (mergedPolicy?.blockInstallApps === true),
          installedPackages,
        })} />
        <p className="text-[11px] text-gray-500 mt-2">אפליקציה שנחסמה ברמת הקהילה נשארת חסומה גם במכשיר הזה.</p>
      </SectionCard>

      <SectionCard title="חסימות למכשיר" icon={Ban}>
        <NullableToggleRow label="חסום התקנת אפליקציות" value={edited.blockInstallApps} onChange={v => set({ blockInstallApps: v })} />
        <NullableToggleRow label="חסום Safe Boot" value={edited.blockSafeBoot} onChange={v => set({ blockSafeBoot: v })} />
        <NullableToggleRow label="חסום Factory Reset" value={edited.blockFactoryReset} onChange={v => set({ blockFactoryReset: v })} />
        <NullableToggleRow label="חסום USB Transfer" value={edited.blockUsbTransfer} onChange={v => set({ blockUsbTransfer: v })} />
        <NullableToggleRow label="איסוף לוגים" value={edited.logsEnabled} onChange={v => set({ logsEnabled: v })} />
        <NullableToggleRow label="חסום ערוצי WhatsApp" value={edited.blockWhatsAppChannels} onChange={v => set({ blockWhatsAppChannels: v })} />
      </SectionCard>

      <SectionCard title="התנהגות ופרטי ניהול" icon={SlidersHorizontal}>
        <div className="text-xs text-gray-500 mb-1.5">כשפעולה חסומה</div>
        <ChipGroup value={edited.blockedActionBehavior ?? null} onChange={v => set({ blockedActionBehavior: v })} options={[
          { value: null, label: 'לפי הקהילה' },
          { value: 'SILENT', label: 'שקט' },
          { value: 'SHOW_MESSAGE', label: 'הודעה' },
          { value: 'REQUEST_APPROVAL', label: 'בקשת אישור' },
        ]} />

        <label className="block mt-3">
          <span className="text-xs text-gray-500">מקסימום אפליקציות מותקנות (ריק = ירושה)</span>
          <input value={edited.maxInstalledApps ?? ''} inputMode="numeric"
            onChange={e => { const n = parseInt(e.target.value, 10); set({ maxInstalledApps: Number.isNaN(n) ? null : Math.max(0, n) }); }}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </label>

        <div className="grid sm:grid-cols-2 gap-2 mt-3">
          {TEXT_FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="text-xs text-gray-500">{f.label}</span>
              <input value={edited[f.key] ?? ''} type={f.type || 'text'} autoComplete="off"
                onChange={e => set({ [f.key]: e.target.value.trim() ? e.target.value : null })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="אפליקציות" icon={AppWindow}>
        <div className="space-y-4">
          <PackageListEditor title="חסום לפי package (נוסף על חבילת החסימה)" icon={Ban}
            // Bundle items are edited in the pack card above.
            apps={blockedApps.filter(p => !ALL_PACKAGES.has(p))} labelOf={labelFor}
            onChange={others => set({ blockedApps: [...blockedApps.filter(p => ALL_PACKAGES.has(p)), ...others] })} />
          <PackageListEditor title="אפשר תמיד (override)" apps={edited.allowedApps || []} labelOf={labelFor}
            onChange={list => set({ allowedApps: list })} />
        </div>
      </SectionCard>

      <SectionCard title="סינון רשת" icon={Globe}>
        <ChipGroup value={edited.webFilterMode ?? null} options={[
          { value: null, label: 'לפי הקהילה' },
          { value: 'NONE', label: 'ללא סינון' },
          { value: 'BLACKLIST', label: 'רשימה שחורה' },
          { value: 'WHITELIST', label: 'רשימה לבנה' },
        ]} onChange={mode => set({
          webFilterMode: mode,
          blockedDomains: mode === 'BLACKLIST' ? (edited.blockedDomains || []) : null,
          allowedDomains: mode === 'WHITELIST' ? (edited.allowedDomains || []) : null,
        })} />
        {edited.webFilterMode === 'BLACKLIST' && (
          <DomainListEditor title="דומיינים חסומים" domains={edited.blockedDomains || []} onChange={d => set({ blockedDomains: d })} />
        )}
        {edited.webFilterMode === 'WHITELIST' && (
          <DomainListEditor title="דומיינים מותרים" domains={edited.allowedDomains || []} onChange={d => set({ allowedDomains: d })} />
        )}
      </SectionCard>

      <SectionCard title="נעילות זמן" icon={Clock}>
        <DeviceLockField lockedUntilTs={edited.lockedUntilTs} onChange={ts => set({ lockedUntilTs: ts })}
          lockedPrefix="נעול עד:" lockLabel="נעל מכשיר זה עד..." changeLabel="שנה תאריך שחרור" />
        <div className="mt-4">
          <AppTimeLocksEditor locks={edited.appTimeLocks || []} onChange={locks => set({ appTimeLocks: locks })}
            hint="אפליקציה חדשה נחסמת לצמיתות — לחץ על השעון כדי לקבוע מועד שחרור" />
        </div>
      </SectionCard>

      <StickySaveBar onSave={() => onSave(edited)} saving={saving} label="שמור הגדרות מכשיר" />
    </div>
  );
}

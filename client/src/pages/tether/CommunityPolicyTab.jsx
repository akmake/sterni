// Web port of the Android admin app's community PolicyTab: the whole community policy as one
// draft, saved with a single "שמור שינויים" button.
import React, { useState } from 'react';
import { ShieldCheck, Shield, Ban, AppWindow, CheckCircle, Clock, Globe, SlidersHorizontal, KeyRound } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { tetherApi, authHeader } from './tetherApi';
import BlockPackEditor, { packStateFromPolicy } from './BlockPackEditor';
import {
  SectionCard, ToggleRow, RadioCard, RadioRow, ChipGroup, PackageListEditor, DomainListEditor,
  DeviceLockField, AppTimeLocksEditor, StickySaveBar,
} from './ui';
import { ALL_PACKAGES, DEFAULT_COMMUNITY_POLICY, expandLegacyPack, labelFor } from './blockPackCatalog';

// ── app-control mode: three presets over the store/install flags ──
const detectAppControlMode = (p) => {
  if (p.hideGooglePlay && p.blockAllStores && p.blockInstallApps && p.blockApkInstall) return 'FULL_LOCKDOWN';
  if (!p.hideGooglePlay && !p.blockAllStores && !p.blockInstallApps && p.blockApkInstall &&
      p.blockedActionBehavior === 'REQUEST_APPROVAL') return 'PLAY_VISIBLE_APPROVAL';
  if (!p.hideGooglePlay && !p.blockAllStores && !p.blockInstallApps && !p.blockApkInstall) return 'OPEN_INSTALLS';
  return 'PLAY_VISIBLE_APPROVAL';
};

const applyAppControlMode = (p, mode) => ({
  FULL_LOCKDOWN: { ...p, hideGooglePlay: true, blockAllStores: true, blockInstallApps: true, blockApkInstall: true, blockedActionBehavior: 'SILENT' },
  PLAY_VISIBLE_APPROVAL: { ...p, hideGooglePlay: false, blockAllStores: false, blockInstallApps: false, blockApkInstall: true, blockedActionBehavior: 'REQUEST_APPROVAL' },
  OPEN_INSTALLS: { ...p, hideGooglePlay: false, blockAllStores: false, blockInstallApps: false, blockApkInstall: false },
}[mode]);

export default function CommunityPolicyTab({ communityId, policy, onSaved }) {
  // A legacy "everything" pack is shown as its individual parts, so each one can be changed.
  const [edited, setEdited] = useState(() => expandLegacyPack({ ...DEFAULT_COMMUNITY_POLICY, ...policy }));
  const [saving, setSaving] = useState(false);
  const set = (patch) => setEdited(p => ({ ...p, ...patch }));

  const save = async () => {
    setSaving(true);
    try {
      await tetherApi.put(`/admin/communities/${communityId}/policy`, edited, { headers: authHeader() });
      toast.success('המדיניות נשמרה ✓');
      onSaved(edited);
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  const mode = detectAppControlMode(edited);
  const blockedApps = edited.blockedApps || [];

  return (
    <div className="space-y-3">
      <SectionCard title="מצב חסימת אפליקציות" icon={ShieldCheck}>
        <div className="space-y-2">
          <RadioCard title="חסימה מלאה" desc="כל חנויות האפליקציות חסומות ומוסתרות"
            selected={mode === 'FULL_LOCKDOWN'} onClick={() => setEdited(p => applyAppControlMode(p, 'FULL_LOCKDOWN'))} />
          <RadioCard title="Google Play פתוח + אישור מנהל" desc="אפשר להיכנס לחנות, התקנה תחסם עד אישור מנהל"
            selected={mode === 'PLAY_VISIBLE_APPROVAL'} onClick={() => setEdited(p => applyAppControlMode(p, 'PLAY_VISIBLE_APPROVAL'))} />
          <RadioCard title="פתוח" desc="ללא חסימת התקנות אפליקציות"
            selected={mode === 'OPEN_INSTALLS'} onClick={() => setEdited(p => applyAppControlMode(p, 'OPEN_INSTALLS'))} />
        </div>
      </SectionCard>

      <SectionCard title="חבילת חסימה" icon={Shield}>
        {policy.blockPack && (
          <p className="text-xs text-blue-800 mb-2">
            החבילה הישנה ("הכל יחד") פורקה לפריטים — אותן חסימות נשארות. לחץ "שמור שינויים" כדי לאשר.
          </p>
        )}
        <BlockPackEditor state={packStateFromPolicy(edited, setEdited, { nullable: false, installsBlocked: edited.blockInstallApps })} />
      </SectionCard>

      <SectionCard title="חסימות" icon={Ban}>
        <ToggleRow label="חסום התקנת אפליקציות" desc="מונע התקנה מ-Play Store ומהרשת (וחוסם את כל החנויות)"
          checked={edited.blockInstallApps} onChange={v => set({ blockInstallApps: v })} />
        <ToggleRow label="חסום מצב בטוח" checked={edited.blockSafeBoot} onChange={v => set({ blockSafeBoot: v })} />
        <ToggleRow label="חסום איפוס יצרן" checked={edited.blockFactoryReset} onChange={v => set({ blockFactoryReset: v })} />
        <ToggleRow label="חסום העברת קבצים USB" checked={edited.blockUsbTransfer} onChange={v => set({ blockUsbTransfer: v })} />
        <ToggleRow label="חסום ערוצי WhatsApp" checked={edited.blockWhatsAppChannels} onChange={v => set({ blockWhatsAppChannels: v })} />
      </SectionCard>

      <SectionCard title="אפליקציות" icon={AppWindow}>
        <div className="space-y-4">
          <PackageListEditor title="אפליקציות חסומות נוספות"
            desc="Package names לחסימה (דפדפנים, יוטיוב וחנויות — בחבילת החסימה למעלה)" icon={Ban}
            // Bundle items are edited in the pack card; listing their raw packages here too would
            // show the same choice twice, as unreadable addresses.
            apps={blockedApps.filter(p => !ALL_PACKAGES.has(p))} labelOf={labelFor}
            onChange={others => set({ blockedApps: [...blockedApps.filter(p => ALL_PACKAGES.has(p)), ...others] })} />
          <PackageListEditor title="אפליקציות מותרות תמיד" desc="Package names שלעולם לא ייחסמו" icon={CheckCircle}
            apps={edited.allowedApps || []} labelOf={labelFor} onChange={list => set({ allowedApps: list })} />
        </div>
      </SectionCard>

      <SectionCard title="נעילת זמן" icon={Clock}>
        <DeviceLockField lockedUntilTs={edited.lockedUntilTs} onChange={ts => set({ lockedUntilTs: ts })}
          lockedPrefix="כל המכשירים נעולים עד:" lockLabel="נעל את כל המכשירים עד..." changeLabel="שנה תאריך ושעת שחרור" />
        <div className="mt-4">
          <AppTimeLocksEditor locks={edited.appTimeLocks || []} onChange={locks => set({ appTimeLocks: locks })}
            hint="אפליקציה חדשה נחסמת לצמיתות — לחץ על השעון כדי לקבוע מועד שחרור" />
        </div>
      </SectionCard>

      <SectionCard title="מצב רשימת אפליקציות" icon={AppWindow}>
        <RadioRow label="רשימה שחורה — חסום אפליקציות ספציפיות"
          selected={edited.appPolicyMode !== 'WHITELIST'} onClick={() => set({ appPolicyMode: 'BLACKLIST' })} />
        <RadioRow label="רשימה לבנה — אפשר רק אפליקציות מאושרות" desc="מצב קיוסק — כל שאר האפליקציות חסומות"
          selected={edited.appPolicyMode === 'WHITELIST'} onClick={() => set({ appPolicyMode: 'WHITELIST' })} />
      </SectionCard>

      <SectionCard title="סינון אינטרנט" icon={Globe}>
        <RadioRow label="ללא סינון" selected={edited.webFilterMode === 'NONE'} onClick={() => set({ webFilterMode: 'NONE' })} />
        <RadioRow label="רשימה שחורה — חסום דומיינים" selected={edited.webFilterMode === 'BLACKLIST'} onClick={() => set({ webFilterMode: 'BLACKLIST' })} />
        <RadioRow label="רשימה לבנה — אפשר רק דומיינים" desc="כל שאר האינטרנט חסום"
          selected={edited.webFilterMode === 'WHITELIST'} onClick={() => set({ webFilterMode: 'WHITELIST' })} />
        {edited.webFilterMode === 'BLACKLIST' && (
          <DomainListEditor title="דומיינים חסומים" domains={edited.blockedDomains || []} onChange={d => set({ blockedDomains: d })} />
        )}
        {edited.webFilterMode === 'WHITELIST' && (
          <>
            <DomainListEditor title="דומיינים מותרים" domains={edited.allowedDomains || []} onChange={d => set({ allowedDomains: d })} />
            <p className="text-xs text-gray-400 mt-1">שרת Tether מותר תמיד באופן אוטומטי</p>
          </>
        )}
      </SectionCard>

      <SectionCard title="מתקדם" icon={SlidersHorizontal}>
        <ToggleRow label="אפשר לוגים" desc="שמירת רישום אירועי אבטחה" checked={edited.logsEnabled} onChange={v => set({ logsEnabled: v })} />

        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1.5">כשפעולה חסומה</div>
          <ChipGroup value={edited.blockedActionBehavior} onChange={v => set({ blockedActionBehavior: v })} options={[
            { value: 'SILENT', label: 'חסימה שקטה' },
            { value: 'SHOW_MESSAGE', label: 'הצג הודעה' },
            { value: 'REQUEST_APPROVAL', label: 'בקשת אישור' },
          ]} />
        </div>

        <div className="mt-3">
          <div className="text-xs text-gray-500 mb-1.5">מי יכול לאשר בקשות</div>
          <ChipGroup value={edited.approvalResolverMode} onChange={v => set({ approvalResolverMode: v })} options={[
            { value: 'OWNER_ONLY', label: 'מנהל הקהילה' },
            { value: 'SUPERADMIN_ONLY', label: 'מנהל־על' },
            { value: 'OWNER_OR_SUPERADMIN', label: 'שניהם' },
          ]} />
        </div>

        <label className="block mt-3">
          <span className="text-xs text-gray-500 flex items-center gap-1"><KeyRound size={12} /> קוד חירום להסרה</span>
          <input value={edited.adminEmergencyCode || ''} inputMode="numeric" placeholder="0000" type="password" autoComplete="off"
            onChange={e => set({ adminEmergencyCode: e.target.value.trim() || null })}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </label>

        <label className="block mt-3">
          <span className="text-xs text-gray-500">מקסימום אפליקציות מותקנות (ריק = ללא הגבלה)</span>
          <input value={edited.maxInstalledApps ?? ''} inputMode="numeric"
            onChange={e => { const n = parseInt(e.target.value, 10); set({ maxInstalledApps: Number.isNaN(n) ? null : Math.max(0, n) }); }}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
        </label>

        <div className="grid sm:grid-cols-3 gap-2 mt-3">
          {[
            { key: 'supportName', label: 'שם תמיכה' },
            { key: 'supportWhatsApp', label: 'WhatsApp תמיכה' },
            { key: 'supportEmail', label: 'אימייל תמיכה' },
          ].map(f => (
            <label key={f.key} className="block">
              <span className="text-xs text-gray-500">{f.label}</span>
              <input value={edited[f.key] || ''} onChange={e => set({ [f.key]: e.target.value || null })}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm" />
            </label>
          ))}
        </div>
      </SectionCard>

      <StickySaveBar onSave={save} saving={saving} label="שמור שינויים" />
    </div>
  );
}

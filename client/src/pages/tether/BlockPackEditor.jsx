// Web port of the Android admin app's BlockPackEditor: the block bundle as separate pieces —
// browsers, YouTube, stores and external installs — each with an "everything" switch and the
// individual apps inside it.
//
// A community stores plain booleans; a device override stores true/false/null where null means
// "follow the community" (flag.nullable = true).
import React, { useMemo, useState } from 'react';
import { Shield, LockOpen, Globe, Youtube, Store, Download, ChevronDown, ChevronUp } from 'lucide-react';
import { Switch, TriStateSelect, AppIcon } from './ui';
import { ALL_ITEMS, GOOGLE_PLAY_PKG, itemsOf, isBlocked, setBlocked } from './blockPackCatalog';

const FLAG_FIELDS = {
  allBrowsers: 'blockAllBrowsers',
  allYoutube: 'blockYoutube',
  allStores: 'blockAllStores',
  googlePlay: 'hideGooglePlay',
  externalInstalls: 'blockApkInstall',
};

/**
 * Builds the editor state from a policy being edited. `setPolicy` takes an updater, so "block
 * everything" applies every field in one update. A community (nullable = false) stores booleans.
 */
export function packStateFromPolicy(policy, setPolicy, { nullable, installsBlocked, installedPackages = null }) {
  const flags = Object.fromEntries(Object.entries(FLAG_FIELDS).map(([key, field]) => [key, {
    value: policy[field] ?? null,
    nullable,
    onChange: (v) => setPolicy(p => ({ ...p, [field]: nullable ? v : v === true })),
  }]));
  return {
    ...flags,
    installsBlocked,
    installedPackages,
    blockedApps: policy.blockedApps || [],
    onBlockedAppsChange: (list) => setPolicy(p => ({ ...p, blockedApps: list })),
    setMany: ({ blockedApps, ...values }) => setPolicy(p => ({
      ...p,
      ...Object.fromEntries(Object.entries(values).map(([key, v]) => [FLAG_FIELDS[key], v])),
      blockedApps,
    })),
  };
}

export default function BlockPackEditor({ state }) {
  const setAll = (blocked) => {
    state.setMany({
      allBrowsers: blocked, allYoutube: blocked, allStores: blocked, googlePlay: blocked, externalInstalls: blocked,
      blockedApps: ALL_ITEMS.reduce((list, it) => setBlocked(list, it, blocked), state.blockedApps),
    });
  };

  return (
    <div className="space-y-2.5">
      <p className="text-xs text-gray-500">בחר מה לחסום: אפשר לחסום קטגוריה שלמה, או רק אפליקציות מסוימות בתוכה.</p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setAll(true)}
          className="flex items-center justify-center gap-1.5 border border-gray-300 rounded-lg py-1.5 text-sm hover:bg-gray-50">
          <Shield size={15} /> חסום הכל
        </button>
        <button type="button" onClick={() => setAll(false)}
          className="flex items-center justify-center gap-1.5 border border-gray-300 rounded-lg py-1.5 text-sm hover:bg-gray-50">
          <LockOpen size={15} /> פתח הכל
        </button>
      </div>

      <PackCategoryCard title="דפדפנים" icon={Globe} masterLabel="כל הדפדפנים"
        masterDesc="כולל דפדפנים שלא ברשימה ודפדפן שיותקן בעתיד"
        master={state.allBrowsers} category="BROWSERS" state={state} />
      <PackCategoryCard title="יוטיוב" icon={Youtube} masterLabel="יוטיוב בכל צורה"
        masterDesc="כל האפליקציות של יוטיוב וגם youtube.com בתוך הדפדפן"
        master={state.allYoutube} category="YOUTUBE" state={state} />
      <PackCategoryCard title="חנויות אפליקציות" icon={Store} masterLabel="כל החנויות"
        masterDesc="כולל חנויות שלא ברשימה"
        master={state.allStores} category="STORES" state={state}
        lockedNote={state.installsBlocked ? '"חסום התקנת אפליקציות" פעיל — כל החנויות חסומות בכל מקרה' : null} />

      <div className="bg-white border border-gray-200 rounded-xl px-3.5 py-2 flex items-center gap-3">
        <Download size={18} className="text-gray-500 shrink-0" />
        <div className="flex-1">
          <FlagRow label="התקנות חיצוניות (APK)" desc="מונע התקנת קבצי APK שהורדו מהאינטרנט" flag={state.externalInstalls} enabled />
        </div>
      </div>
    </div>
  );
}

function PackCategoryCard({ title, icon: Icon, masterLabel, masterDesc, master, category, state, lockedNote }) {
  const [expanded, setExpanded] = useState(false);
  const installed = state.installedPackages;
  const items = useMemo(() => {
    const all = itemsOf(category);
    // On a device, show what is actually on the phone first.
    if (!installed) return all;
    return [...all].sort((a, b) => Number(b.packages.some(p => installed.has(p))) - Number(a.packages.some(p => installed.has(p))));
  }, [category, installed]);

  const allBlocked = master.value === true || !!lockedNote;
  const itemCount = items.filter(it => isBlocked(it, state.blockedApps)).length +
    (category === 'STORES' && state.googlePlay.value === true ? 1 : 0);

  const summary = allBlocked ? 'הכל חסום'
    : master.nullable && master.value == null && itemCount === 0 ? 'לפי הקהילה'
    : itemCount > 0 ? `${itemCount} חסומים` : 'פתוח';
  const highlighted = allBlocked || itemCount > 0;

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setExpanded(e => !e)} aria-expanded={expanded}
        className="w-full flex items-center gap-2.5 px-3.5 py-3 hover:bg-gray-50 text-right">
        <Icon size={18} className="text-gray-500 shrink-0" />
        <span className="flex-1 font-semibold text-sm text-gray-800">{title}</span>
        <span className={`text-[11px] px-2 py-0.5 rounded-md ${highlighted ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>{summary}</span>
        {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {expanded && (
        <div className="px-3.5 pb-3 border-t border-gray-100 pt-2">
          {lockedNote && <p className="text-xs text-red-600 mb-1.5">{lockedNote}</p>}
          <FlagRow label={masterLabel} desc={masterDesc} flag={master} enabled={!lockedNote} />
          <div className="border-t border-gray-100 my-1.5" />
          <p className="text-xs text-gray-500 mb-1">{allBlocked ? 'כל הרשימה חסומה כרגע' : 'או בחר אפליקציות מסוימות:'}</p>
          {category === 'STORES' && (
            <ItemRow label="Google Play" iconPackage={GOOGLE_PLAY_PKG}
              installedHere={installed ? installed.has(GOOGLE_PLAY_PKG) : null}
              checked={allBlocked || state.googlePlay.value === true} enabled={!allBlocked}
              inheritHint={state.googlePlay.nullable && state.googlePlay.value == null}
              onChange={v => state.googlePlay.onChange(v)} />
          )}
          {items.map(it => (
            <ItemRow key={it.id} label={it.label} iconPackage={it.iconPackage}
              installedHere={installed ? it.packages.some(p => installed.has(p)) : null}
              checked={allBlocked || isBlocked(it, state.blockedApps)} enabled={!allBlocked} inheritHint={false}
              onChange={v => state.onBlockedAppsChange(setBlocked(state.blockedApps, it, v))} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A master flag: a switch for a community, a three-way choice for a device override. */
function FlagRow({ label, desc, flag, enabled }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800">{label}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
      {flag.nullable
        ? <TriStateSelect value={flag.value} onChange={flag.onChange} disabled={!enabled} labels={['לפי הקהילה', 'חסום', 'פתוח']} ariaLabel={label} />
        : <Switch checked={flag.value === true} onChange={flag.onChange} disabled={!enabled} label={label} />}
    </div>
  );
}

function ItemRow({ label, iconPackage, installedHere, checked, enabled, inheritHint, onChange }) {
  return (
    <div className="flex items-center gap-2.5 py-1">
      <AppIcon packageName={iconPackage} label={label} size={30} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-800">{label}</div>
        {installedHere === true
          ? <div className="text-[11px] text-blue-700">מותקן במכשיר</div>
          : inheritHint ? <div className="text-[11px] text-gray-400">לפי הקהילה</div> : null}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={!enabled} label={label} />
    </div>
  );
}

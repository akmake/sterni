import React from 'react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export const MEAL_LABELS = {
  breakfast: 'ארוחת בוקר',
  lunch: 'ארוחת צהריים',
  dinner: 'ארוחת ערב',
  light: 'ארוחה קלה',
  light_meal: 'ארוחה קלה',
  night_treats: 'פינוקי לילה',
};

export function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function heDate(d, pattern = 'dd/MM/yyyy') {
  return format(d, pattern, { locale: he });
}

export function getKosherMeta(kosherType) {
  const isMeat = kosherType === 'meat';
  const isParve = kosherType === 'parve';
  const isDairy = kosherType === 'halavi';
  
  if (isMeat) return { label: 'בשרי', tone: 'meat' };
  if (isParve) return { label: 'פרווה', tone: 'parve' };
  if (isDairy) return { label: 'חלבי', tone: 'dairy' };
  return null;
}

export function KosherBadge({ kosherType }) {
  const meta = getKosherMeta(kosherType);
  if (!meta) return null;

  let toneClass = 'bg-gray-50 text-gray-700 border-gray-100';
  if (meta.tone === 'meat') toneClass = 'bg-red-50 text-red-700 border-red-100';
  if (meta.tone === 'parve') toneClass = 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (meta.tone === 'dairy') toneClass = 'bg-blue-50 text-blue-700 border-blue-100';

  return (
    <span
      className={cx(
        'text-[11px] px-2 py-0.5 rounded-md border font-bold',
        toneClass,
        'print:bg-transparent print:text-black print:border-black'
      )}
    >
      {meta.label}
    </span>
  );
}
export const getMealRank = (type) => {
  if (!type) return 4;
  const t = type.toLowerCase();
  if (t === 'breakfast' || t.includes('בוקר')) return 1;
  if (t === 'lunch' || t.includes('צהרים') || t.includes('צהריים')) return 2;
  if (t === 'dinner' || t.includes('ערב')) return 3;
  return 4; // כל השאר
};
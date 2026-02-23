/**
 * פונקציות עזר לתאריכים עבריים — המרה לגימטריה
 */

const GEMATRIA_LETTERS = {
  1: 'א', 2: 'ב', 3: 'ג', 4: 'ד', 5: 'ה', 6: 'ו', 7: 'ז', 8: 'ח', 9: 'ט',
  10: 'י', 20: 'כ', 30: 'ל', 40: 'מ', 50: 'נ', 60: 'ס', 70: 'ע', 80: 'פ', 90: 'צ',
  100: 'ק', 200: 'ר', 300: 'ש', 400: 'ת'
};

/**
 * ממיר מספר לגימטריה עברית עם גרשיים
 * לדוגמה: 14 → י"ד, 5 → ה', 25 → כ"ה
 */
export const toGematria = (num) => {
  let str = '';
  while (num >= 400) { str += GEMATRIA_LETTERS[400]; num -= 400; }
  if (num >= 300) { str += GEMATRIA_LETTERS[300]; num -= 300; }
  if (num >= 200) { str += GEMATRIA_LETTERS[200]; num -= 200; }
  if (num >= 100) { str += GEMATRIA_LETTERS[100]; num -= 100; }
  if (num >= 10) {
    if (num === 15) return str + 'ט"ו';
    if (num === 16) return str + 'ט"ז';
    const tens = Math.floor(num / 10) * 10;
    str += GEMATRIA_LETTERS[tens];
    num -= tens;
  }
  if (num > 0) str += GEMATRIA_LETTERS[num];
  if (str.length === 0) return '';
  if (str.length === 1) return str + "'";
  return str.slice(0, -1) + '"' + str.slice(-1);
};

/**
 * ממיר שנה עברית לגימטריה (בלי האלפים)
 * לדוגמה: 5786 → תשפ"ו
 */
export const yearToGematria = (year) => {
  const num = typeof year === 'string' ? parseInt(year) : year;
  if (isNaN(num)) return year;
  return toGematria(num % 1000);
};

/**
 * מקבל אובייקט Date ומחזיר תאריך עברי מלא בגימטריה
 * לדוגמה: י"ד אדר תשפ"ו
 */
export const formatFullHebrewDate = (date) => {
  try {
    const parts = new Intl.DateTimeFormat('he-IL', {
      calendar: 'hebrew',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).formatToParts(date);

    const hDay = parts.find(p => p.type === 'day')?.value;
    const hMonth = parts.find(p => p.type === 'month')?.value;
    const hYear = parts.find(p => p.type === 'year')?.value;

    const dayGematria = isNaN(hDay) ? hDay : toGematria(parseInt(hDay));
    const yearGematria = yearToGematria(hYear);

    return `${dayGematria} ${hMonth} ${yearGematria}`;
  } catch {
    return '';
  }
};

/**
 * מקבל אובייקט Date ומחזיר יום וחודש עברי בגימטריה (בלי שנה)
 * לדוגמה: י"ד אדר
 */
export const formatShortHebrewDate = (date) => {
  try {
    const parts = new Intl.DateTimeFormat('he-IL', {
      calendar: 'hebrew',
      day: 'numeric',
      month: 'long'
    }).formatToParts(date);

    const hDay = parts.find(p => p.type === 'day')?.value;
    const hMonth = parts.find(p => p.type === 'month')?.value;

    const dayGematria = isNaN(hDay) ? hDay : toGematria(parseInt(hDay));

    return `${dayGematria} ${hMonth}`;
  } catch {
    return '';
  }
};

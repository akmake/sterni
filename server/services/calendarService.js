import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const TORAHCALC_BASE = 'https://www.torahcalc.com';
const HEBCAL_BASE    = 'https://www.hebcal.com';
const SEFARIA_BASE   = 'https://www.sefaria.org';

// תהלים לפי יום בחודש העברי (מנהג חב"ד)
const TEHILLIM_SCHEDULE = [
  null,               // index 0 — unused
  'Psalms 1-9',       // א
  'Psalms 10-17',     // ב
  'Psalms 18-22',     // ג
  'Psalms 23-28',     // ד
  'Psalms 29-34',     // ה
  'Psalms 35-38',     // ו
  'Psalms 39-43',     // ז
  'Psalms 44-48',     // ח
  'Psalms 49-54',     // ט
  'Psalms 55-59',     // י
  'Psalms 60-65',     // יא
  'Psalms 66-68',     // יב
  'Psalms 69-71',     // יג
  'Psalms 72-76',     // יד
  'Psalms 77-78',     // טו
  'Psalms 79-82',     // טז
  'Psalms 83-87',     // יז
  'Psalms 88-89',     // יח
  'Psalms 90-96',     // יט
  'Psalms 97-103',    // כ
  'Psalms 104-105',   // כא
  'Psalms 106-107',   // כב
  'Psalms 108-112',   // כג
  'Psalms 113-118',   // כד
  'Psalms 119:1-96',  // כה
  'Psalms 119:97-176',// כו
  'Psalms 120-134',   // כז
  'Psalms 135-139',   // כח
  'Psalms 140-144',   // כט
  'Psalms 145-150',   // ל
];

async function getHebrewDayOfMonth(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const url = `${HEBCAL_BASE}/converter?gy=${y}&gm=${m}&gd=${d}&g2h=1&cfg=json`;
  const data = await fetchJson(url);
  return data?.hd ?? null; // מספר יום בחודש העברי (1-30)
}

// ── Tanya daily cache (persisted to disk) ───────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const TANYA_CACHE_PATH = join(__dirname, '../data/tanya-cache.json');

function loadTanyaCache() {
  try {
    if (existsSync(TANYA_CACHE_PATH)) {
      return new Map(Object.entries(JSON.parse(readFileSync(TANYA_CACHE_PATH, 'utf8'))));
    }
  } catch (_) {}
  return new Map();
}

function saveTanyaCache(map) {
  try {
    writeFileSync(TANYA_CACHE_PATH, JSON.stringify(Object.fromEntries(map), null, 2));
  } catch (_) {}
}

const tanyaCache = loadTanyaCache();

async function fetchJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data?.error) throw new Error(`API error: ${data.error}`);
    return data;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

function toShabbatDate(dateString) {
  const [y, m, d] = dateString.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun … 6=Sat
  const daysToShabbat = (6 - dow + 7) % 7;
  const dt = new Date(Date.UTC(y, m - 1, d + daysToShabbat));
  return dt.toISOString().slice(0, 10);
}

function rambamUrlToRef(url) {
  // "https://www.sefaria.org/Mishneh_Torah%2C_Sabbath.13-15?lang=bi"
  // → "Mishneh Torah, Sabbath.13-15"
  try {
    const path = new URL(url).pathname.slice(1); // "Mishneh_Torah%2C_Sabbath.13-15"
    return decodeURIComponent(path).replace(/_/g, ' ');
  } catch (_) {
    return null;
  }
}

// Parse a TorahCalc "name" field into individual Sefaria chapter refs.
// "Eruvin 4-6"  → ["Mishneh Torah, Eruvin.4", …, "Mishneh Torah, Eruvin.6"]
// "Eruvin 7, Eruvin 8, Rest on the Tenth of Tishrei 1"
//             → ["Mishneh Torah, Eruvin.7", "Mishneh Torah, Eruvin.8",
//                "Mishneh Torah, Rest on the Tenth of Tishrei.1"]
const HE_ORDS = ['','א','ב','ג','ד','ה','ו','ז','ח','ט','י','יא','יב','יג','יד','טו','טז','יז','יח','יט','כ','כא','כב','כג','כד','כה','כו','כז','כח','כט','ל'];
const heOrd = n => (n >= 1 && n < HE_ORDS.length) ? HE_ORDS[n] : String(n);

// Parse a TorahCalc hebrewName into individual "Book פרק N" strings.
// "עירובין 4-6"  → ["עירובין פרק ד", "עירובין פרק ה", "עירובין פרק ו"]
// "עירובין פרק ז, ..."  → split by ", "
function hebrewChapterEntries(hebrewName) {
  if (!hebrewName) return [];
  if (hebrewName.includes(',')) return hebrewName.split(', ');
  const m = hebrewName.match(/^(.+?)\s+(\d+)-(\d+)$/);
  if (m) {
    const book = m[1], start = parseInt(m[2], 10), end = parseInt(m[3], 10);
    return Array.from({ length: end - start + 1 }, (_, i) => `${book} פרק ${heOrd(start + i)}`);
  }
  return [hebrewName];
}

// Condenses 3 chapter entries into a compact label.
// e.g. ["הלכות שבת פרק כח","הלכות שבת פרק כט","הלכות שבת פרק ל"]
//   → "הלכות שבת פרקים כח-ל"
// e.g. ["הלכות שבת פרק ל","הלכות ערובין פרק א","הלכות ערובין פרק ב"]
//   → "הלכות שבת פרק ל, הלכות ערובין פרקים א-ב"
function condenseRambamLabel(entries) {
  if (!entries || entries.length === 0) return '';

  const parsed = entries.map(e => {
    const m = e?.match(/^(.+?)\s+פרק\s+(\S+)$/);
    return m ? { book: m[1], ordinal: m[2] } : { book: e || '', ordinal: '' };
  });

  const groups = [];
  for (const item of parsed) {
    const last = groups[groups.length - 1];
    if (last && last.book === item.book) {
      last.ordinals.push(item.ordinal);
    } else {
      groups.push({ book: item.book, ordinals: [item.ordinal] });
    }
  }

  return groups.map(g => {
    if (g.ordinals.length === 1) return `${g.book} פרק ${g.ordinals[0]}`;
    return `${g.book} פרקים ${g.ordinals[0]}-${g.ordinals[g.ordinals.length - 1]}`;
  }).join(', ');
}

function nameToChapterRefs(name) {
  if (!name) return [];
  // Split by comma first, then handle each part (single chapter or range).
  // This correctly handles cross-book entries like "Sabbath 30, Eruvin 1-2".
  return name.split(', ').flatMap(entry => {
    const rangeM = entry.match(/^(.+?)\s+(\d+)-(\d+)$/);
    if (rangeM) {
      const book = rangeM[1], start = parseInt(rangeM[2], 10), end = parseInt(rangeM[3], 10);
      return Array.from({ length: end - start + 1 }, (_, i) => `Mishneh Torah, ${book}.${start + i}`);
    }
    const m = entry.match(/^(.+?)\s+(\d+)$/);
    return m ? [`Mishneh Torah, ${m[1]}.${m[2]}`] : [];
  });
}

function seferHamitzvotNameToRef(name) {
  const match = String(name || '').match(/(Positive|Negative)\s+Commandments?\s+(\d+)(?:-(\d+))?/i);
  if (!match) return null;
  const type = match[1].toLowerCase();
  const start = match[2];
  const end = match[3];
  const base = type === 'positive'
    ? 'Sefer HaMitzvot, Positive Commandments'
    : 'Sefer HaMitzvot, Negative Commandments';
  return end ? `${base} ${start}-${end}` : `${base} ${start}`;
}

function buildSefariaCalendarUrl(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const params = new URLSearchParams({
    timezone: 'Asia/Jerusalem',
    year: String(year),
    month: String(month),
    day: String(day),
  });
  return `${SEFARIA_BASE}/api/calendars?${params.toString()}`;
}

export async function getDailyCalendar(dateString) {
  const items = [];
  let hebrewDate = '';
  let sefariaData = null;

  // ── 1. Rambam (1 & 3 chapters) + Sefer HaMitzvot ─────────────────────────
  try {
    // Sefaria gives clean refs directly — no offset hacks needed
    sefariaData = await fetchJson(buildSefariaCalendarUrl(dateString));
    const calItems = Array.isArray(sefariaData?.calendar_items) ? sefariaData.calendar_items : [];

    for (const item of calItems) {
      const en = String(item?.title?.en || '');

      if (en === 'Daily Rambam') {
        items.push({
          title: { en: 'Daily Rambam (1 chapter)', he: 'רמב"ם יומי (פרק 1)' },
          ref: item.ref,
          displayValue: { he: item.displayValue?.he || item.ref },
        });
      }

      if (en === 'Daily Rambam (3 Chapters)') {
        items.push({
          title: { en: 'Daily Rambam (3 chapters)', he: 'רמב"ם יומי' },
          ref: item.ref,
          displayValue: { he: item.displayValue?.he || item.ref },
        });
      }
    }

    // Sefer HaMitzvot — only available from TorahCalc
    const tc = await fetchJson(`${TORAHCALC_BASE}/api/dailylearning?date=${dateString}`);
    const shmToday = tc?.data?.dailySeferHamitzvos;
    if (shmToday?.name) {
      const shmRef = seferHamitzvotNameToRef(shmToday.name);
      if (shmRef) {
        items.push({
          title: { en: 'Daily Sefer HaMitzvot', he: 'ספר המצוות היומי' },
          ref: shmRef,
          displayValue: { he: shmToday.hebrewName || shmToday.name },
        });
      }
    }
  } catch (err) {
    console.error('[calendar] Rambam/SHM failed:', err.message);
  }

  // ── 2. Parasha (Chumash + Shnayim Mikra) from Hebcal ──────────────────────
  // If the upcoming Shabbat has no regular Torah reading (e.g. Pesach, Yom Tov),
  // skip ahead week by week until a regular parashat is found (max 4 attempts).
  try {
    const baseShabbat = toShabbatDate(dateString);
    const [bsy, bsm, bsd] = baseShabbat.split('-').map(Number);
    let parashat = null;

    for (let attempt = 0; attempt < 4; attempt++) {
      const shabbat = new Date(Date.UTC(bsy, bsm - 1, bsd + attempt * 7))
        .toISOString().slice(0, 10);
      console.log(`[calendar] Hebcal attempt ${attempt + 1}: shabbat=${shabbat} (for ${dateString})`);
      try {
        const hc = await fetchJson(
          `${HEBCAL_BASE}/shabbat?cfg=json&geonameid=281184&M=on&lg=he&leyning=on&dt=${shabbat}`
        );
        const found = (hc?.items || []).find(i => i.category === 'parashat');
        // Require all 7 aliyot — Yom Tov special readings have only 4-5.
        if (found?.leyning && found.leyning['7']) {
          parashat = found;
          break;
        }
        console.log(`[calendar] No regular parashat on ${shabbat} (found=${!!found}, has7=${!!(found?.leyning?.['7'])}), trying next week`);
      } catch (innerErr) {
        console.error(`[calendar] Hebcal attempt ${attempt + 1} failed:`, innerErr.message);
      }
    }

    if (parashat?.leyning) {
      const { leyning } = parashat;
      // 0-indexed aliyot array: index 0 = Sunday = leyning["1"], … index 6 = Shabbat = leyning["7"]
      const aliyot = ['1', '2', '3', '4', '5', '6', '7'].map(k => leyning[k] || null);
      const heParasha = parashat.hebrew || parashat.title_orig || '';
      hebrewDate = parashat.hdate || '';
      console.log(`[calendar] Parasha: ${heParasha} | shabbat aliyah: ${aliyot[6]}`);
      items.push({
        title: { en: 'Parashat HaShavua', he: heParasha },
        ref: leyning.torah || aliyot.find(Boolean) || '',
        displayValue: { he: heParasha },
        extraDetails: { aliyot },
      });
    }
  } catch (err) {
    console.error('[calendar] Hebcal failed:', err.message);
  }

  // ── 3. Tanya + Tehillim from Sefaria calendar ────────────────────────────────
  try {
    const cachedTanya = tanyaCache.get(dateString);
    if (cachedTanya) {
      items.push({
        title: { en: 'Tanya', he: 'תניא יומי' },
        ref: cachedTanya,
        displayValue: { he: cachedTanya },
      });
      console.log(`[calendar] Tanya from cache: ${cachedTanya}`);
    }

    // Reuse Sefaria data from section 1 (or fetch if it failed)
    const sefaria = sefariaData || await fetchJson(buildSefariaCalendarUrl(dateString));
    const calItems = Array.isArray(sefaria?.calendar_items) ? sefaria.calendar_items : [];

    for (const item of calItems) {
      const en = String(item?.title?.en || '').toLowerCase();

      if (!cachedTanya && en.includes('tanya')) {
        if (item.ref) { tanyaCache.set(dateString, item.ref); saveTanyaCache(tanyaCache); }
        items.push(item);
        console.log(`[calendar] Tanya from Sefaria (${dateString}): ${item.ref}`);
      }

      // (תהלים מחושב בנפרד — ראה למטה)
    }

    if (!hebrewDate && sefaria?.date?.hebrew) hebrewDate = sefaria.date.hebrew;
  } catch (err) {
    console.error('[calendar] Sefaria fetch failed:', err.message);
  }

  // ── 4. Tehillim — חישוב לפי יום בחודש העברי (HebCal) ───────────────────────
  try {
    const heDay = await getHebrewDayOfMonth(dateString);
    if (heDay >= 1 && heDay <= 30) {
      // בחודש של 29 ימים, יום כ"ט כולל גם את יום ל'
      const day = heDay === 30 ? 30 : heDay;
      const ref = TEHILLIM_SCHEDULE[day];
      if (ref) {
        function getTehillimHebrewNum(nStr) {
          let n = parseInt(nStr, 10);
          if (isNaN(n) || n <= 0) return String(n);
          let h = '';
          if (n >= 100) { h += 'ק'; n -= 100; }
          if (n === 15) return h + 'טו';
          if (n === 16) return h + 'טז';
          if (n >= 90) { h += 'צ'; n -= 90; }
          else if (n >= 80) { h += 'פ'; n -= 80; }
          else if (n >= 70) { h += 'ע'; n -= 70; }
          else if (n >= 60) { h += 'ס'; n -= 60; }
          else if (n >= 50) { h += 'נ'; n -= 50; }
          else if (n >= 40) { h += 'מ'; n -= 40; }
          else if (n >= 30) { h += 'ל'; n -= 30; }
          else if (n >= 20) { h += 'כ'; n -= 20; }
          else if (n >= 10) { h += 'י'; n -= 10; }
          const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
          if (n > 0) h += ones[n];
          return h;
        }

        const raw29 = heDay === 29 ? ('תהלים ' + TEHILLIM_SCHEDULE[29].replace('Psalms ', '') + '-' + TEHILLIM_SCHEDULE[30].replace('Psalms ', '')) : null;
        const he29 = raw29 ? raw29.replace(/\d+/g, match => getTehillimHebrewNum(match)).replace(':', ':').replace('-', '-') : null;
        const displayRef = ref.replace('Psalms ', 'תהלים ').replace(/\d+/g, match => getTehillimHebrewNum(match)).replace(':', ':').replace('-', '-');
        
        items.push({
          title: { en: 'Daily Psalms', he: 'תהלים יומי' },
          ref,
          displayValue: { he: he29 || displayRef },
        });
        console.log(`[calendar] Tehillim day ${heDay}: ${ref}`);
      }
    }
  } catch (err) {
    console.error('[calendar] Tehillim calc failed:', err.message);
  }

  return { items, hebrewDate };
}

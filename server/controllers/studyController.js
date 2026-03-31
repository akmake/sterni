import { getDailyCalendar } from '../services/calendarService.js';

const SEFARIA_BASE_URL = 'https://www.sefaria.org';
const DEFAULT_TIMEZONE = 'Asia/Jerusalem';

const STUDY_CONFIG = {
  chumash: {
    key: 'chumash',
    title: 'חומש עם רש"י',
    subtitle: 'העלייה היומית מתוך פרשת השבוע',
    accent: 'blue',
    kind: 'aliyah',
    matchers: ['daily chumash', 'chumash', 'parashat hashavua'],
    detailMode: 'rashi',
    rules: [
      'הלימוד הוא לפי עליית היום בפרשת השבוע.',
      'שישי כולל עלייה ו׳+ז׳ לפי מנהג חב"ד.',
      'בשבת מקובל לעשות חזרה כללית על הפרשה.',
    ],
    schedule: { sunday: "א'", monday: "ב'", tuesday: "ג'", wednesday: "ד'", thursday: "ה'", friday: "ו' + ז'", shabbat: 'חזרה' },
  },
  rambam: {
    key: 'rambam',
    title: "רמב\"ם יומי",
    subtitle: 'שלושה פרקים במשנה תורה',
    accent: 'emerald',
    kind: 'chapters',
    matchers: ['daily rambam (3 chapters)'],
    detailMode: 'rambam', // שינינו מצב ייעודי לרמב"ם שיתמוך במערך דו-ממדי
    rules: ['מסלול של 3 פרקים ביום.'],
  },
  rambamOne: {
    key: 'rambamOne',
    title: 'רמב"ם יומי (פרק 1)',
    subtitle: 'פרק אחד במשנה תורה',
    accent: 'emerald',
    kind: 'chapter',
    matchers: ['daily rambam (1 chapter)'],
    detailMode: 'rambam',
    rules: ['מסלול של פרק אחד ביום.'],
  },
  tanya: {
    key: 'tanya',
    title: 'תניא יומי',
    subtitle: 'קטע יומי',
    accent: 'violet',
    kind: 'segment',
    matchers: ['tanya yomi', 'daily tanya', 'tanya'],
    detailMode: 'plain',
    rules: ['חלוקה יומית רציפה לאורך שנה.'],
  },
  seferHamitzvot: {
    key: 'seferHamitzvot',
    title: 'ספר המצוות היומי',
    subtitle: 'לימוד יומי בספר המצוות לרמב"ם',
    accent: 'blue',
    kind: 'mitzvot',
    matchers: ['daily sefer hamitzvot', 'sefer hamitzvot'],
    detailMode: 'plain',
    rules: ['לימוד יומי של מצוות עשה/לא תעשה לפי המחזור.'],
  },
  shnayimMikra: {
    key: 'shnayimMikra',
    title: 'שניים מקרא',
    subtitle: 'פרשת השבוע עם אונקלוס',
    accent: 'amber',
    kind: 'parasha',
    matchers: ['parashat hashavua', 'weekly torah portion'],
    detailMode: 'onkelos',
    rules: ['מטרת המסלול להשלים את כל הפרשה לפני שבת.'],
  },
  tehillim: {
    key: 'tehillim',
    title: 'תהלים יומי',
    subtitle: 'תהלים לפי יום בחודש',
    accent: 'blue',
    kind: 'chapters',
    matchers: ['daily psalms', 'psalm', 'tehillim'],
    detailMode: 'tehillim',
    rules: ['קריאת תהלים לפי חלוקה חודשית.'],
  },
};

function getHebrewOrdinal(n) {
  if (n <= 0) return String(n);
  let h = '';
  let temp = n;
  if (temp >= 400) { h += 'ת'; temp -= 400; }
  if (temp >= 300) { h += 'ש'; temp -= 300; }
  if (temp >= 200) { h += 'ר'; temp -= 200; }
  if (temp >= 100) { h += 'ק'; temp -= 100; }
  
  if (temp === 15) return h + 'טו';
  if (temp === 16) return h + 'טז';
  
  if (temp >= 90) { h += 'צ'; temp -= 90; }
  else if (temp >= 80) { h += 'פ'; temp -= 80; }
  else if (temp >= 70) { h += 'ע'; temp -= 70; }
  else if (temp >= 60) { h += 'ס'; temp -= 60; }
  else if (temp >= 50) { h += 'נ'; temp -= 50; }
  else if (temp >= 40) { h += 'מ'; temp -= 40; }
  else if (temp >= 30) { h += 'ל'; temp -= 30; }
  else if (temp >= 20) { h += 'כ'; temp -= 20; }
  else if (temp >= 10) { h += 'י'; temp -= 10; }
  
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  if (temp > 0) h += ones[temp];
  
  return h;
}

function parseStartChapter(ref) {
  if (!ref) return 1;
  // Handle "Mishneh Torah, Sabbath.13-15" format (chapter after last dot)
  const dotMatch = ref.match(/\.(\d+)/);
  if (dotMatch) return parseInt(dotMatch[1], 10);
  // Fallback: standalone number in space-separated parts
  const parts = ref.split(' ');
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    if (/^\d+(-\d+)?$/.test(p)) return parseInt(p.split('-')[0], 10);
  }
  return 1;
}

function normalizeDateParam(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function shiftDate(dateString, offsetDays) {
  const [y, m, d] = dateString.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + offsetDays));
  return dt.toISOString().slice(0, 10);
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function buildSefariaCalendarParams(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return {
    timezone: DEFAULT_TIMEZONE,
    year: String(year),
    month: String(month),
    day: String(day),
  };
}

function parseChapterVerseRef(ref) {
  if (!ref) return null;
  const match = String(ref).match(/^(.*)\s(\d+):(\d+)$/);
  if (!match) return null;
  return {
    book: match[1],
    chapter: Number(match[2]),
    verse: Number(match[3]),
  };
}

async function getTanyaRefForDate(dateString) {
  const sefaria = await fetchJson('/api/calendars', buildSefariaCalendarParams(dateString));
  const item = (Array.isArray(sefaria?.calendar_items) ? sefaria.calendar_items : [])
    .find((i) => String(i?.title?.en || '').toLowerCase().includes('tanya'));
  return item?.ref || null;
}

async function getChapterLength(book, chapter) {
  const chapterRef = `${book} ${chapter}`;
  const safeRef = encodeURI(chapterRef.replace(/ /g, '_'));
  const textData = await fetchJson(`/api/texts/${safeRef}`, { context: 0, commentary: 0, pad: 0, lang: 'he' });
  const he = Array.isArray(textData?.he) ? textData.he : [];
  return he.length;
}

async function buildTanyaDailyRangeRef(startRef, dateString) {
  const start = parseChapterVerseRef(startRef);
  if (!start) return startRef;

  const nextDate = shiftDate(dateString, 1);
  let nextRef = null;
  try {
    nextRef = await getTanyaRefForDate(nextDate);
  } catch (_) {
    return startRef;
  }

  const next = parseChapterVerseRef(nextRef);
  if (!next || next.book !== start.book) return startRef;

  let endChapter = next.chapter;
  let endVerse = next.verse - 1;

  if (next.verse <= 1) {
    endChapter = next.chapter - 1;
    if (endChapter < start.chapter) return startRef;
    try {
      endVerse = await getChapterLength(start.book, endChapter);
    } catch (_) {
      return startRef;
    }
  }

  if (endChapter < start.chapter || (endChapter === start.chapter && endVerse < start.verse)) {
    return startRef;
  }

  if (start.chapter === endChapter) {
    return `${start.book} ${start.chapter}:${start.verse}-${endVerse}`;
  }
  return `${start.book} ${start.chapter}:${start.verse}-${endChapter}:${endVerse}`;
}

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&thinsp;/g, '')
    .replace(/\u2009/g, '')
    .replace(/\u05C0/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

async function fetchJson(pathname, searchParams = {}, { retries = 2, timeoutMs = 12000 } = {}) {
  const url = new URL(pathname, SEFARIA_BASE_URL);
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`Sefaria request failed: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(`Sefaria API Error: ${data.error}`);
      return data;
    } catch (err) {
      clearTimeout(timer);
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 800 * (attempt + 1)));
    }
  }
}

function flattenBlocks(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => flattenBlocks(entry));
  const text = String(value).trim();
  return text ? [text] : [];
}

function findCalendarItem(calendarItems, matchers, configKey) {
  const matchValues = matchers.map(normalizeText);
  const matches = calendarItems.filter((item) => {
    const titleEn = normalizeText(item?.title?.en);
    const titleHe = normalizeText(item?.title?.he);
    const displayEn = normalizeText(item?.displayValue?.en || item?.displayValue);
    return matchValues.some((needle) => [titleEn, titleHe, displayEn].some((hay) => hay.includes(needle)));
  });

  if (configKey === 'rambam' && matches.length > 0) {
    const threeChaptersTrack = matches.find(m => (m.refs && m.refs.length >= 2) || (m.ref && m.ref.includes('-')));
    if (threeChaptersTrack) return threeChaptersTrack;
  }
  return matches[0] || null;
}

// הלוגיקה החדשה לרמב"ם שמתרגמת את Java ל-JS
function parseRambamAndroidStyle(textData) {
  const heRaw = textData?.he || textData?.text;
  if (!heRaw || !Array.isArray(heRaw)) return [];

  const startChapter = parseStartChapter(textData.ref);
  const result = [];
  let globalId = 1;

  if (Array.isArray(heRaw[0])) {
    // מערך דו ממדי - 3 פרקים
    heRaw.forEach((chapterArr, chIndex) => {
      const actualChapterNum = startChapter + chIndex;
      
      // הזרקת כותרת הפרק בדומה לאנדרואיד
      result.push({
        id: String(globalId++),
        isHeader: true,
        he: `פרק ${getHebrewOrdinal(actualChapterNum)}`,
        en: '',
        rashi: []
      });

      // הזרקת ההלכות
      chapterArr.forEach((halakha, hIndex) => {
        if (halakha && typeof halakha === 'string') {
          result.push({
            id: String(globalId++),
            isHeader: false,
            ordinal: getHebrewOrdinal(hIndex + 1),
            he: stripHtml(halakha),
            en: '',
            rashi: []
          });
        }
      });
    });
  } else {
    // פרק יחיד — מוסיפים כותרת כדי ש-last1 slice יוכל לחתוך נכון
    result.push({
      id: String(globalId++),
      isHeader: true,
      he: `פרק ${getHebrewOrdinal(startChapter)}`,
      en: '',
      rashi: []
    });
    heRaw.forEach((halakha, hIndex) => {
      if (halakha && typeof halakha === 'string') {
        result.push({
          id: String(globalId++),
          isHeader: false,
          ordinal: getHebrewOrdinal(hIndex + 1),
          he: stripHtml(halakha),
          en: '',
          rashi: []
        });
      }
    });
  }
  return result;
}

function mapSectionsHebrew(textData, startVerse) {
  const raw = textData?.he || textData?.text;
  const result = [];

  // 1-D: single chapter (the normal case — cross-chapter rashi is handled in fetchTextByMode)
  const hebrew = flattenBlocks(raw);
  for (let i = 0; i < hebrew.length; i += 1) {
    result.push({
      id: String(i + 1),
      isHeader: false,
      he: stripHtml(hebrew[i]),
      en: '',
      rashi: [],
      verseNum: startVerse + i,
    });
  }
  return result.filter((row) => row.he);
}

function mapRashiOnly(textData) {
  const list = Array.isArray(textData?.commentary) ? textData.commentary : [];
  return list
    .filter(entry => entry?.collectiveTitle?.he === 'רש"י' || entry?.collectiveTitle?.en === 'Rashi')
    .map((entry, index) => ({
      id: entry?.ref || `rashi-${index + 1}`,
      anchorRef: entry?.anchorRef || '',
      he: stripHtml(flattenBlocks(entry?.he || entry?.text).join(' ')),
    }))
    .filter((row) => row.he);
}

function mapOnkelosSections(torahData, onkelosData) {
  const torahRaw = torahData?.he || torahData?.text;
  const onkelosRaw = onkelosData?.he || onkelosData?.text;
  const startChapter = Number(torahData?.sections?.[0]) || 1;
  const startVerse = Number(torahData?.sections?.[1]) || 1;
  const sections = [];

  if (Array.isArray(torahRaw) && Array.isArray(torahRaw[0])) {
    let chapter = startChapter;
    for (let ci = 0; ci < torahRaw.length; ci += 1) {
      const torahChapter = Array.isArray(torahRaw[ci]) ? torahRaw[ci] : [];
      const onkelosChapter = Array.isArray(onkelosRaw?.[ci]) ? onkelosRaw[ci] : [];
      const chapterStartVerse = ci === 0 ? startVerse : 1;
      const len = Math.max(torahChapter.length, onkelosChapter.length);

      for (let vi = 0; vi < len; vi += 1) {
        sections.push({
          id: String(sections.length + 1),
          isHeader: false,
          he: stripHtml(torahChapter[vi] || ''),
          en: stripHtml(onkelosChapter[vi] || ''),
          rashi: [],
          verseNum: chapterStartVerse + vi,
          chapterNum: chapter,
        });
      }
      chapter += 1;
    }
    return sections.filter((row) => row.he || row.en);
  }

  const torahHe = flattenBlocks(torahRaw);
  const onkelosHe = flattenBlocks(onkelosRaw);
  const len = Math.max(torahHe.length, onkelosHe.length);
  for (let i = 0; i < len; i += 1) {
    sections.push({
      id: String(i + 1),
      isHeader: false,
      he: stripHtml(torahHe[i] || ''),
      en: stripHtml(onkelosHe[i] || ''),
      rashi: [],
      verseNum: startVerse + i,
      chapterNum: startChapter,
    });
  }
  return sections.filter((row) => row.he || row.en);
}

function parseTehillimStyle(textData, ref) {
  const heRaw = textData?.he || textData?.text;
  if (!heRaw || !Array.isArray(heRaw)) return [];

  const cvMatch = String(ref).match(/Psalms?\s+(\d+):(\d+)/i);
  const chMatch = String(ref).match(/Psalms?\s+(\d+)/i);
  const startChapter = cvMatch ? parseInt(cvMatch[1], 10) : (chMatch ? parseInt(chMatch[1], 10) : 1);
  const startVerse   = cvMatch ? parseInt(cvMatch[2], 10) : 1;

  // Join all verses of a chapter into one flowing text block with inline verse numbers
  const joinVerses = (verses, firstVerseNum = 1) =>
    verses
      .map((v, vi) => (v && typeof v === 'string') ? `(${getHebrewOrdinal(firstVerseNum + vi)}) ${stripHtml(v)}` : '')
      .filter(Boolean)
      .join(' ');

  const result = [];
  let id = 1;

  if (Array.isArray(heRaw[0])) {
    // Multi-chapter: he = [[ch1v1, …], [ch2v1, …], …]
    heRaw.forEach((chVerses, ci) => {
      const chNum = startChapter + ci;
      result.push({ id: String(id++), isHeader: true, isChapterHeader: true,
        he: `פרק ${getHebrewOrdinal(chNum)}`, en: '', rashi: [] });
      const joined = joinVerses(chVerses);
      if (joined) result.push({ id: String(id++), isHeader: false, he: joined, en: '', rashi: [] });
    });
  } else {
    // Single-chapter range (e.g. Psalms 119:1-96)
    result.push({ id: String(id++), isHeader: true, isChapterHeader: true,
      he: `פרק ${getHebrewOrdinal(startChapter)}`, en: '', rashi: [] });
    const joined = joinVerses(heRaw, startVerse);
    if (joined) result.push({ id: String(id++), isHeader: false, he: joined, en: '', rashi: [] });
  }

  return result;
}

async function fetchTextByMode(ref, mode) {
  if (!ref) return { sections: [] };
  const safeRef = encodeURI(ref.replace(/ /g, '_'));

  if (mode === 'tehillim') {
    const textData = await fetchJson(`/api/texts/${safeRef}`, { context: 0, commentary: 0, pad: 0, lang: 'he' });
    return { sections: parseTehillimStyle(textData, ref) };
  }

  if (mode === 'onkelos') {
    try {
      const onkelosRef = ref.startsWith('Onkelos') ? ref : `Onkelos ${ref}`;
      const safeOnkelosRef = encodeURI(onkelosRef.replace(/ /g, '_'));
      const torahData = await fetchJson(`/api/texts/${safeRef}`, { context: 0, commentary: 0, pad: 0, lang: 'he' });
      const onkelosData = await fetchJson(`/api/texts/${safeOnkelosRef}`, { context: 0, commentary: 0, pad: 0, lang: 'he' });
      return { sections: mapOnkelosSections(torahData, onkelosData) };
    } catch (_) {}
  }

  // Rashi + cross-chapter: e.g. "Leviticus 6:12-7:10"
  // Sefaria returns only partial Rashi for multi-chapter ranges.
  // Fix: get the chapter structure first, then fetch each chapter separately.
  if (mode === 'rashi') {
    const crossMatch = ref.match(/^(.+)\s+(\d+):(\d+)-(\d+):(\d+)$/);
    if (crossMatch && crossMatch[2] !== crossMatch[4]) {
      const book      = crossMatch[1];
      const startCh   = parseInt(crossMatch[2], 10);
      const startVs   = parseInt(crossMatch[3], 10);
      const endVs     = parseInt(crossMatch[5], 10);

      // Step 1: get chapter boundaries from main text (no commentary needed)
      const mainData = await fetchJson(`/api/texts/${safeRef}`, { context: 0, commentary: 0, pad: 0, lang: 'he' });
      const he2D = mainData?.he || mainData?.text;

      if (Array.isArray(he2D) && Array.isArray(he2D[0])) {
        const allSections = [];
        let idCounter = 1;

        for (let ci = 0; ci < he2D.length; ci += 1) {
          const chapter   = startCh + ci;
          const chStartVs = ci === 0 ? startVs : 1;
          const chEndVs   = ci === he2D.length - 1 ? endVs : chStartVs + he2D[ci].length - 1;
          const chRef     = `${book} ${chapter}:${chStartVs}-${chEndVs}`;
          const safeChRef = encodeURI(chRef.replace(/ /g, '_'));

          // Chapter header between chapters
          if (ci > 0) {
            allSections.push({
              id: String(idCounter++),
              isHeader: true,
              isChapterHeader: true,
              he: `פרק ${getHebrewOrdinal(chapter)}`,
              en: '', rashi: [],
            });
          }

          // Fetch this chapter with full Rashi
          try {
            const chData = await fetchJson(`/api/texts/${safeChRef}`, { context: 0, commentary: 1, pad: 0, lang: 'he' });
            const chSections = mapSectionsHebrew(chData, chStartVs);

            const rashis = mapRashiOnly(chData);
            rashis.forEach(r => {
              const vMatch = r.anchorRef ? r.anchorRef.match(/:(\d+)/) : null;
              const vNum = vMatch ? parseInt(vMatch[1], 10) : chStartVs;
              const target = chSections.find(s => s.verseNum === vNum);
              if (target) target.rashi.push(r);
              else if (chSections.length > 0) chSections[chSections.length - 1].rashi.push(r);
            });

            chSections.forEach(s => allSections.push({ ...s, id: String(idCounter++) }));
          } catch (err) {
            console.error(`[rashi] Chapter ${chapter} fetch failed:`, err.message);
          }
        }

        return { sections: allSections };
      }
    }
  }

  // Standard flow (single chapter, or non-rashi mode)
  const textData = await fetchJson(`/api/texts/${safeRef}`, {
    context: 0,
    commentary: mode === 'rashi' ? 1 : 0,
    pad: 0,
    lang: 'he',
  });

  if (mode === 'rambam') {
    return { sections: parseRambamAndroidStyle(textData) };
  }

  const baseVerseMatch = textData.ref ? textData.ref.match(/:(\d+)/) : null;
  const startVerse = baseVerseMatch ? parseInt(baseVerseMatch[1], 10) : 1;
  const sections = mapSectionsHebrew(textData, startVerse);

  if (mode === 'rashi') {
    const rashis = mapRashiOnly(textData);
    rashis.forEach(r => {
      const vNumMatch = r.anchorRef ? r.anchorRef.match(/:(\d+)/) : null;
      const vNum = vNumMatch ? parseInt(vNumMatch[1], 10) : startVerse;
      const targetSec = sections.find(s => s.verseNum === vNum);
      if (targetSec) targetSec.rashi.push(r);
      else if (sections.length > 0) sections[sections.length - 1].rashi.push(r);
    });
  }

  return { sections };
}

async function resolveStudy(calendarItems, config, dateString) {
  const item = findCalendarItem(calendarItems, config.matchers, config.key);
  if (!item) {
    return { ...config, available: false, label: '', ref: '', sections: [], preview: '' };
  }

  let refsToFetch = Array.isArray(item.refs) && item.refs.length > 0 ? item.refs : [item.ref];
  let resolvedRef = item.ref;

  if (config.key === 'tanya' && item.ref) {
    const rangeRef = await buildTanyaDailyRangeRef(item.ref, dateString);
    refsToFetch = [rangeRef];
    resolvedRef = rangeRef;
  }

  // Rambam correctly uses item.refs from the Sefaria API cleanly

  // שניים מקרא – כל 7 העליות עם כותרות עליות + כותרות פרקים
  if (config.key === 'shnayimMikra' && item.extraDetails && Array.isArray(item.extraDetails.aliyot)) {
    const ALIYOT_NAMES = ['ראשונה', 'שנייה', 'שלישית', 'רביעית', 'חמישית', 'שישית', 'שביעית'];
    let allSections = [];
    let globalId = 1;
    let displayedChapter = null; // הפרק האחרון שהוצג

    for (let i = 0; i < 7; i++) {
      const r = item.extraDetails.aliyot[i];
      if (!r) continue;

      // כותרת עלייה
      allSections.push({ id: String(globalId++), isHeader: true, isAliyahHeader: true, he: `עלייה ${ALIYOT_NAMES[i]}`, en: '', rashi: [] });

      // פרק התחלה של עלייה זו (למשל "Leviticus 2:7-2:16" → 2)
      const chMatch = r.match(/(\d+):/);
      const aliyahStartChapter = chMatch ? parseInt(chMatch[1], 10) : null;

      // אם עלייה זו מתחילה בפרק חדש שטרם הוצג – הצג כותרת פרק
      if (aliyahStartChapter !== null && aliyahStartChapter !== displayedChapter) {
        displayedChapter = aliyahStartChapter;
        allSections.push({ id: String(globalId++), isHeader: true, isChapterHeader: true, he: `פרק ${getHebrewOrdinal(displayedChapter)}`, en: '', rashi: [] });
      }

      try {
        const payload = await fetchTextByMode(r, config.detailMode);
        let prevVerse = null;
        for (const s of payload.sections) {
          const currentChapter = Number(s.chapterNum) || null;
          // Preferred: real chapter transitions from parsed API structure.
          if (currentChapter !== null && currentChapter !== displayedChapter) {
            displayedChapter = currentChapter;
            allSections.push({ id: String(globalId++), isHeader: true, isChapterHeader: true, he: `פרק ${getHebrewOrdinal(displayedChapter)}`, en: '', rashi: [] });
          } else if (currentChapter === null && s.verseNum === 1 && prevVerse !== null && prevVerse > 1) {
            // Fallback for flat payloads without chapter info.
            if (displayedChapter !== null) displayedChapter++;
            allSections.push({ id: String(globalId++), isHeader: true, isChapterHeader: true, he: `פרק ${getHebrewOrdinal(displayedChapter)}`, en: '', rashi: [] });
          }
          allSections.push({ ...s, id: String(globalId++) });
          if (s.verseNum != null) prevVerse = s.verseNum;
        }
      } catch (err) {
        console.error(`[shnayimMikra] aliyah ${i + 1} failed:`, err.message);
      }
    }
    return {
      ...config, available: true,
      label: item?.displayValue?.he || item.ref,
      ref: item?.ref || '',
      preview: allSections.find(s => !s.isHeader)?.he?.slice(0, 180) || '',
      sections: allSections,
    };
  }

  // חומש – עלייה לפי יום השבוע
  if (config.kind === 'aliyah' && item.extraDetails && Array.isArray(item.extraDetails.aliyot)) {
    const dayOfWeek = new Date(dateString + 'T00:00:00Z').getUTCDay();
    if (dayOfWeek === 5) refsToFetch = [item.extraDetails.aliyot[5], item.extraDetails.aliyot[6]].filter(Boolean);
    else refsToFetch = [item.extraDetails.aliyot[dayOfWeek === 6 ? 6 : dayOfWeek]].filter(Boolean);
  }

  let allSections = [];

  for (const rEntry of refsToFetch) {
    const r     = typeof rEntry === 'string' ? rEntry : rEntry.ref;
    const slice = typeof rEntry === 'string' ? null    : rEntry.slice;
    if (!r) continue;
    try {
      const payload = await fetchTextByMode(r, config.detailMode);
      let sections = payload.sections;

      if (slice === 'last1') {
        // Keep only the last chapter (header + halakhot of chapter 3)
        const lastHeaderIdx = sections.map((s, i) => s.isHeader && s.isChapterHeader !== false && !s.isAliyahHeader ? i : -1)
          .filter(i => i >= 0);
        const cutFrom = lastHeaderIdx.length > 0 ? lastHeaderIdx[lastHeaderIdx.length - 1] : 0;
        sections = sections.slice(cutFrom);
      } else if (slice === 'first2') {
        // Keep only first two chapters (headers + halakhot of chapters 1-2)
        const headerIndices = sections.map((s, i) => s.isHeader && !s.isAliyahHeader ? i : -1).filter(i => i >= 0);
        const cutAt = headerIndices.length >= 3 ? headerIndices[2] : sections.length;
        sections = sections.slice(0, cutAt);
      }

      const startId = allSections.length;
      allSections = allSections.concat(
        sections.map((s, i) => ({ ...s, id: String(startId + i + 1) }))
      );
    } catch (err) {
      console.error(`Failed fetching chunk ${r}:`, err.message);
    }
  }

  const displayLabel = item?.displayValue?.he || item.ref;

  return {
    ...config,
    available: true,
    label: displayLabel,
    ref: resolvedRef || '',
    preview: allSections.length ? (allSections[0].he || '').slice(0, 180) : '',
    sections: allSections,
  };
}

export const getDailyStudy = async (req, res, next) => {
  try {
    const date = normalizeDateParam(req.query.date);
    if (!date) return res.status(400).json({ message: 'Invalid date.' });

    console.log(`[study] requested date: "${req.query.date}" → normalized: "${date}"`);

    const { items: calendarItems, hebrewDate } = await getDailyCalendar(date);
    const studies = {};

    for (const config of Object.values(STUDY_CONFIG)) {
      studies[config.key] = await resolveStudy(calendarItems, config, date);
    }

    const rambamLabel = studies.rambam?.label || '–';
    console.log(`[study] response for ${date} | rambam: ${rambamLabel}`);
    res.json({ date, timezone: DEFAULT_TIMEZONE, hebrewDate, studies });
  } catch (error) {
    next(error);
  }
};

// GET /api/study/tehillim-chapters?chapters=1,23,119
// מחזיר sections של פרקים ספציפיים בתהלים (לפרקים אישיים של המשתמש)
export const getTehillimChapters = async (req, res, next) => {
  try {
    const chaptersParam = String(req.query.chapters || '');
    const chapterNums = chaptersParam
      .split(',')
      .map(n => parseInt(n.trim(), 10))
      .filter(n => !isNaN(n) && n >= 1 && n <= 150);

    if (chapterNums.length === 0) return res.json({ sections: [] });

    const allSections = [];
    for (const chNum of chapterNums) {
      const ref = `Psalms ${chNum}`;
      const safeRef = encodeURI(ref.replace(/ /g, '_'));
      const textData = await fetchJson(`/api/texts/${safeRef}`, { context: 0, commentary: 0, pad: 0, lang: 'he' });
      const sections = parseTehillimStyle(textData, ref);
      allSections.push(...sections);
    }

    const numbered = allSections.map((s, i) => ({ ...s, id: String(i + 1) }));
    res.json({ sections: numbered });
  } catch (err) {
    next(err);
  }
};

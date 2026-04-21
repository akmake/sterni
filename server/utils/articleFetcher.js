import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

let browser = null;

async function getBrowser() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  return browser;
}

// cache פשוט בזיכרון
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 דקות

function getCached(url) {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL) { cache.delete(url); return null; }
  return entry.data;
}

function setCache(url, data) {
  cache.set(url, { data, ts: Date.now() });
}

export async function fetchArticleContent(url) {
  const cached = getCached(url);
  if (cached) return cached;

  const b = await getBrowser();
  const page = await b.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'he-IL,he;q=0.9' });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // מחכה שהתוכן יטען אחרי Cloudflare
    await page.waitForFunction(() => {
      // אם הכותרת היא "רק רגע..." סימן שקלאודפלייר עדיין חוסם
      return document.title !== 'רק רגע...' && 
             document.title !== 'Just a moment...' && 
             document.body && 
             document.body.innerText.length > 200;
    }, { timeout: 20000 }).catch(() => {});

    const result = await page.evaluate(() => {
      // YouTube embeds
      const youtubeEmbeds = Array.from(document.querySelectorAll('iframe[src*="youtube"], iframe[src*="youtu.be"]'))
        .map(el => ({ type: 'youtube', src: el.src, videoId: el.src.match(/embed\/([^?&]+)/)?.[1] }))
        .filter(e => e.videoId);

      // Twitter/X embeds
      const twitterEmbeds = Array.from(document.querySelectorAll('blockquote.twitter-tweet, blockquote[data-twitter-extracted-i]'))
        .map(el => {
          const a = el.querySelector('a[href*="twitter.com/"][href*="/status/"]') || el.querySelector('a[href*="x.com/"][href*="/status/"]');
          return a?.href || null;
        })
        .filter(Boolean);

      // Telegram embeds
      const tgEmbeds = Array.from(document.querySelectorAll('iframe[src*="t.me"]'))
        .map(el => ({ type: 'telegram', src: el.src }));

      // כותרת
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
      const title = document.title.replace(' - חדשות רוטר', '').trim() || ogTitle;

      // רוטר בונה כל הודעה ב-TR עם שני TDs: מחבר + תוכן.
      const allRows = Array.from(document.querySelectorAll('tr'));

      // מוצא את שורת הכתבה הראשית בעזרת הכותרת (h1)
      const h1 = document.querySelector('h1.text15b, h1');
      let mainRow = h1 ? h1.closest('tr') : null;

      // גיבוי למקרה שאין H1 - נחפש את ה-TR הראשון שיש בו את כותרת העמוד המנוקה
      if (!mainRow) {
        const cleanTitle = title.replace(/['"״]/g, '').substring(0, 15);
        for (const tr of allRows) {
          if (cleanTitle && tr.innerText.replace(/['"״]/g, '').includes(cleanTitle)) {
            mainRow = tr;
            break;
          }
        }
      }

      // ה-TD עם התוכן הוא האחרון בשורה של mainRow או בתוך ה-TD שבו ה-h1 יושב
      let contentTd = null;
      if (mainRow) {
        const contentTds = Array.from(mainRow.querySelectorAll('td')).filter(td => td.innerText.length > 20);
        contentTd = contentTds[contentTds.length - 1] || null;
      }

      // גוף הכתבה - מנקה את מטא המחבר וממיר לטקסט
      let articleText = '';
      if (contentTd) {
        let raw = contentTd.innerText.trim();
        // מוחק: שורות תאריך+שעה בפורמט DD.MM.YY / HH:MM
        raw = raw.replace(/\d{2}\.\d{2}\.\d{2}/g, '');
        raw = raw.replace(/\d{2}:\d{2}/g, '');
        // מוחק: כותרות ניהול, ציטוט וכו'
        raw = raw.replace(/תגובה עם ציטוט.*$/ms, '');
        raw = raw.replace(/מכתב זה.*$/ms, '');
        raw = raw.replace(/\(ניהול:.*?\)/g, '');
        // מנקה שורות ריקות מרובות
        articleText = raw.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
      }

      // שולף תגובות - כל TR אחרי הראשון שמכיל תוכן
      const comments = [];
      if (mainRow) {
        let foundMain = false;
        for (const tr of allRows) {
          if (tr === mainRow) { foundMain = true; continue; }
          if (!foundMain) continue;

          // דלג על שורות ניווט, תחתית, כותרות פורומים או רוטר
          if (tr.innerText.includes('בחר פורום') || tr.innerText.includes('כל הזכויות שמורות')) {
            break; // סיימנו את תוכן השרשור
          }

          const tds = Array.from(tr.querySelectorAll('td'));
          const lastTd = tds.filter(td => td.innerText.trim().length > 10).pop();
          if (!lastTd) continue;

          let commentText = lastTd.innerText.trim();
          commentText = commentText.replace(/תגובה עם ציטוט.*/ms, '').replace(/מכתב זה.*/ms, '').replace(/\(ניהול:.*?\)/g, '').replace(/\n{3,}/g, '\n\n').trim();

          // מסנן שורות שהן רק מטא (קצרות מדי או מכילות "חבר מתאריך")
          if (commentText.length > 15 && !commentText.startsWith('חבר מתאריך') && !commentText.includes('ראה משוב\t')) {
            // מנסה לחלץ רק את טקסט התגובה (בלי שם המשתמש)
            const lines = commentText.split('\n').map(l => l.trim()).filter(Boolean);
            // שם המשתמש הוא בדרך כלל השורה הראשונה, התוכן הוא השורות האחרות
            const contentLines = lines.filter(l =>
              !l.includes('חבר מתאריך') &&
              !l.includes('הודעות') &&
              !/^\d+$/.test(l) &&
              l.length > 5
            );
            const finalComment = contentLines.join('\n').trim();
            if (finalComment.length > 10) comments.push(finalComment);
          }
          if (comments.length >= 20) break; // מקסימום 20 תגובות
        }
      }

      // תמונות תוכן (לא אייקונים)
      const images = contentTd
        ? Array.from(contentTd.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => src?.startsWith('http') && /\.(jpg|jpeg|png|webp)/i.test(src))
            .slice(0, 5)
        : [];

      return { text: articleText, comments, images, youtubeEmbeds, twitterEmbeds, tgEmbeds, title };
    });

    setCache(url, result);
    return result;

  } finally {
    await page.close();
  }
}

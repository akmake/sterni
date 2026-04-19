import { scrapeChannel } from '../utils/telegramScraper.js';
import { scrapeRotter } from '../utils/rotterScraper.js';
import { fetchArticleContent } from '../utils/articleFetcher.js';

const TELEGRAM_CHANNELS = ['amitsegal', 'grinzaig', 'alexmehacarmel', 'abualiexpress'];

export const getNewsFeed = async (req, res) => {
  const [telegramResults, rotterItems] = await Promise.allSettled([
    Promise.allSettled(TELEGRAM_CHANNELS.map(ch =>
      scrapeChannel(ch).catch(err => { console.error(`Telegram ${ch} error:`, err.message); return []; })
    )),
    scrapeRotter().catch(err => { console.error('Rotter error:', err.message); return []; }),
  ]);

  const telegram = telegramResults.status === 'fulfilled'
    ? telegramResults.value.flatMap(r => r.status === 'fulfilled' ? r.value : [])
    : [];
  const rotter = rotterItems.status === 'fulfilled' ? rotterItems.value : [];

  const allItems = [...telegram, ...rotter].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (allItems.length === 0) {
    return res.status(503).json({ success: false, message: 'שגיאה בשליפת הפיד' });
  }

  res.json({ success: true, count: allItems.length, items: allItems });
};

export const getArticle = async (req, res) => {
  const { url } = req.query;
  if (!url || !url.startsWith('https://rotter.net/')) {
    return res.status(400).json({ success: false, message: 'URL לא תקין או חסר' });
  }
  
  try {
    const content = await fetchArticleContent(url);
    res.json({ success: true, content });
  } catch (err) {
    console.error('Article fetch error:', err.message);
    res.status(500).json({ success: false, message: 'שגיאה בטעינת הכתבה' });
  }
};

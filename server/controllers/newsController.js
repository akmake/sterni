import { scrapeChannel } from '../utils/telegramScraper.js';
import { scrapeRotter } from '../utils/rotterScraper.js';
import { fetchArticleContent } from '../utils/articleFetcher.js';

const TELEGRAM_CHANNELS = ['amitsegal', 'grinzaig', 'alexmehacarmel', 'abualiexpress'];

export const getNewsFeed = async (req, res) => {
  try {
    const [telegramResults, rotterItems] = await Promise.all([
      Promise.all(TELEGRAM_CHANNELS.map(scrapeChannel)),
      scrapeRotter(),
    ]);

    const allItems = [
      ...telegramResults.flat(),
      ...rotterItems,
    ].sort((a, b) => new Date(b.date) - new Date(a.date));

    res.json({ success: true, count: allItems.length, items: allItems });
  } catch (err) {
    console.error('Feed error:', err.message);
    res.status(500).json({ success: false, message: 'שגיאה בשליפת הפיד' });
  }
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

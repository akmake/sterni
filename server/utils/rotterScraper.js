import https from 'https';
import iconv from 'iconv-lite';

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': '*/*',
      }
    };

    https.get(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/);
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const guidMatch = block.match(/<guid[^>]*>([\s\S]*?)<\/guid>/);

    if (!titleMatch || !dateMatch) continue;

    const title = titleMatch[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(n))
      .trim();

    const link = linkMatch ? linkMatch[1].trim() : '';
    const date = new Date(dateMatch[1].trim());
    const id = 'rotter-' + (guidMatch ? guidMatch[1].split('/').pop().replace('.shtml', '') : Date.now());

    if (!title || isNaN(date.getTime())) continue;

    items.push({ id, title, link, date, source: 'rotter' });
  }

  return items;
}

export async function scrapeRotter() {
  const buf = await fetchBuffer('https://rotter.net/rss/rotternews.xml');
  const xml = iconv.decode(buf, 'windows-1255');
  return parseRSS(xml);
}

import https from 'https';

function fetchChannelHtml(channelName) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 't.me',
      path: `/s/${channelName}`,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'he,en;q=0.9',
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function cleanHtml(html) {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseMessages(html, channelName) {
  const messages = [];
  const blocks = html.split('tgme_widget_message_wrap');

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];

    // תאריך - חובה
    const dateMatch = block.match(/<time[^>]*datetime="([^"]+)"[^>]*>/);
    if (!dateMatch) continue;

    // Forwarded from
    const forwardedNameMatch = block.match(/<a class="tgme_widget_message_forwarded_from_name"[^>]*href="([^"]+)"[^>]*><span[^>]*>([^<]+)<\/span>/);
    const forwardedFrom = forwardedNameMatch
      ? { name: forwardedNameMatch[2], link: forwardedNameMatch[1] }
      : null;

    // לינק מה data-post attribute (אמין יותר)
    const postMatch = block.match(/data-post="([^"]+)"/);
    const link = postMatch ? `https://t.me/${postMatch[1]}` : `https://t.me/s/${channelName}`;
    const id = postMatch ? postMatch[1].replace('/', '-') : `${channelName}-${i}`;

    // ציטוט / reply - חייב לבוא לפני חיפוש הטקסט הראשי
    const replyLinkMatch = block.match(/<a class="tgme_widget_message_reply[^"]*"[^>]*href="([^"]+)"/);
    const replyTextMatch = block.match(/<div class="tgme_widget_message_text js-message_reply_text"[^>]*>([\s\S]*?)<\/div>/);

    // טקסט הודעה ראשית - מחפש js-message_text (לא reply)
    const textMatch = block.match(/<div class="tgme_widget_message_text js-message_text[^"]*"[^>]*>([\s\S]*?)<\/div>/)
      || block.match(/<div class="tgme_widget_message_text "[^>]*>([\s\S]*?)<\/div>/);
    const text = textMatch ? cleanHtml(textMatch[1]) : '';
    const replyText = replyTextMatch ? cleanHtml(replyTextMatch[1]) : null;

    // תמונה
    const photoMatch = block.match(/class="tgme_widget_message_photo_wrap[^"]*"[^>]*style="[^"]*background-image:url\('([^']+)'\)/);
    const image = photoMatch ? photoMatch[1] : null;

    // וידאו - URL ישיר מה-<video> tag
    const videoMatch = block.match(/<video[^>]*\ssrc="([^"]+)"[^>]*class="tgme_widget_message_video\s/);
    const video = videoMatch ? videoMatch[1] : null;

    // thumbnail של וידאו
    const videoThumbMatch = block.match(/class="tgme_widget_message_video_thumb"[^>]*style="background-image:url\('([^']+)'\)/);
    const videoThumb = videoThumbMatch ? videoThumbMatch[1] : null;

    if (!text && !image && !video) continue;

    messages.push({
      id,
      text,
      replyText,
      replyLink: replyLinkMatch ? replyLinkMatch[1] : null,
      forwardedFrom,
      date: new Date(dateMatch[1]),
      link,
      image,
      video,
      videoThumb,
      source: 'telegram',
      channel: channelName,
    });
  }

  return messages;
}

export async function scrapeChannel(channelName) {
  const html = await fetchChannelHtml(channelName);
  return parseMessages(html, channelName);
}

import { launchPdfBrowser } from '../utils/pdfBrowser.js';
import { readFile } from 'node:fs/promises';

const escape = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ltr = value => `<bdi dir="ltr">${escape(value)}</bdi>`;
const money = value => ltr(`${Number(value || 0).toLocaleString('he-IL', { maximumFractionDigits: 2 })} ₪`);
const date = value => value && !Number.isNaN(new Date(value).getTime()) ? new Date(value).toLocaleDateString('he-IL', { timeZone: 'Asia/Jerusalem' }) : '—';
const field = (label, value) => `<div class="field"><span>${label}</span><strong>${value || '—'}</strong></div>`;

export async function hotelOrderDocument(order, { type = 'quote', includePayment = false } = {}) {
  const confirmation = type === 'confirmation';
  const title = confirmation ? 'אישור הזמנה' : 'הצעת מחיר';
  const number = confirmation ? order.optimaNumber || order.orderNumber : order.orderNumber;
  const hotel = order.hotel?.name || order.hotelName || 'הזמנות מלון';
  const [font, boldFont, amountFont, logo] = await Promise.all([
    readFile(new URL('../assets/fonts/NotoSansHebrew-Regular.ttf', import.meta.url)),
    readFile(new URL('../assets/fonts/NotoSansHebrew-Bold.ttf', import.meta.url)),
    readFile(new URL('../assets/fonts/Assistant-SemiBold.ttf', import.meta.url)),
    readFile(new URL('../assets/hotel-company-logo.png', import.meta.url)),
  ]);
  const rooms = order.rooms || [];
  const extras = order.extras || [];
  const rows = rooms.map((room, index) => {
    const guests = [['adults', 'מבוגרים'], ['teens', 'נוער'], ['children', 'ילדים'], ['babies', 'תינוקות']]
      .filter(([key]) => Number(room[key]) > 0).map(([key, label]) => `${room[key]} ${label}`).join(' • ');
    return `<tr><td class="serial">${index + 1}</td><td><strong>${escape(room.roomType || 'חדר רגיל')}</strong><div class="package">${escape((room.price_list_names || []).join(' + '))}</div>${room.notes ? `<div class="note">הערה: ${escape(room.notes)}</div>` : ''}</td><td>${escape(guests || '—')}</td><td class="amount">${money(room.price)}</td></tr>`;
  }).join('');
  const subtotal = rooms.reduce((sum, room) => sum + Number(room.price || 0), 0) + extras.reduce((sum, extra) => sum + Number(extra.price || 0) * Number(extra.quantity || 0), 0);
  return { title, number, hotel, html: `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>${title}</title><style>
    @font-face{font-family:Hotel;src:url(data:font/ttf;base64,${font.toString('base64')}) format('truetype');font-weight:400}
    @font-face{font-family:Hotel;src:url(data:font/ttf;base64,${boldFont.toString('base64')}) format('truetype');font-weight:700 900}
    @font-face{font-family:HotelAmount;src:url(data:font/ttf;base64,${amountFont.toString('base64')}) format('truetype');font-weight:600}
    @page{size:A4}*{box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact}
    body{margin:0;font-family:Hotel,Arial,sans-serif;color:#1e293b;font-size:14px;line-height:1.45;direction:rtl}
    .masthead{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #f3f4f6;padding-bottom:24px;margin-bottom:26px;break-inside:avoid}
    .masthead>div{width:50%}.logo-side{text-align:left}.logo{height:140px;max-width:100%;object-fit:contain}h1{font-size:36px;line-height:1.15;margin:0 0 10px;font-weight:800;color:#0f172a}.meta{color:#64748b;font-size:13px;line-height:1.8}.meta strong{color:#334155}
    h2{font-size:18px;margin:0 0 14px;font-weight:700;break-after:avoid}.customer-card{background:#f9fafb;border:1px solid #f3f4f6;border-radius:12px;padding:20px;margin-bottom:26px;break-inside:avoid}.customer-card h2{border-bottom:1px solid #e5e7eb;padding-bottom:9px;margin-bottom:16px}.panel{display:grid;grid-template-columns:1fr 1fr;gap:14px 32px}.field span{display:block;color:#6b7280;font-size:12px;margin-bottom:4px}.field strong{font-size:17px;font-weight:400;overflow-wrap:anywhere}bdi{unicode-bidi:isolate}
    table{width:100%;border-collapse:collapse;border-spacing:0;table-layout:fixed;border:1px solid #e5e7eb;font-size:13px}thead{display:table-header-group}th{background:#f3f4f6;color:#4b5563;text-align:right;padding:11px 14px;font-size:13px;font-weight:700;border-bottom:1px solid #e5e7eb}td{padding:14px;border-bottom:1px solid #f3f4f6;vertical-align:top;overflow-wrap:anywhere}tbody tr:last-child td{border-bottom:0}tr{break-inside:avoid}.serial{width:7%;text-align:center;color:#6b7280}.amount{width:20%;text-align:left;white-space:nowrap;color:#0f172a}.description strong{font-size:16px;color:#1e293b}.package{font-size:11px;color:#6b7280;background:#f3f4f6;display:block;width:fit-content;border-radius:0;padding:2px 6px;margin-top:4px}.note{font-size:11px;font-style:italic;color:#b45309;background:#fffbeb;border:1px solid #fef3c7;border-radius:0;padding:3px 7px;margin-top:5px;white-space:pre-wrap}.extras-heading td{background:#f8fafc;font-weight:700;border-top:1px solid #e5e7eb;border-bottom:1px solid #e5e7eb;padding:8px 14px}.extra-label{font-size:11px;color:#6b7280;margin-top:4px}
    .notes-section{break-inside:avoid;border-top:1px dashed #d1d5db;padding-top:18px;margin-top:22px;margin-bottom:20px}.notes-section h2{font-size:14px;text-decoration:underline;text-decoration-color:#fbbf24;text-decoration-thickness:2px;text-underline-offset:4px;margin-bottom:12px}.notes{background:#fffef7;border:1px solid #fef9e3;border-radius:0;padding:14px;color:#334155;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;font-size:13px}
    .totals{margin-top:22px;border-top:2px solid #f1f5f9;padding-top:20px;break-inside:avoid}.discount{display:flex;justify-content:space-between;width:50%;margin-right:auto;color:#dc2626;margin-bottom:10px;font-size:13px}.summary{display:flex;justify-content:space-between;align-items:center;gap:20px}.disclaimer{width:50%;font-size:12px;color:#6b7280}.disclaimer p{margin:4px 0}.grand{text-align:left}.grand span{font-size:13px;color:#6b7280;display:block;margin-bottom:3px}.grand strong{font-family:HotelAmount,Arial,sans-serif;font-size:34px;color:#b45309;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}.confirmation .grand strong{color:#15803d}.terms{background:#f9fafb;border:1px solid #e5e7eb;border-radius:0;font-size:10px;color:#4b5563;padding:12px;margin-top:18px;break-inside:avoid}.terms h2{font-size:13px;margin:0 0 6px}.terms p{margin:3px 0}.branding{text-align:center;color:#9ca3af;font-size:10px;margin-top:28px;break-inside:avoid}.branding:before{content:'';display:block;width:90px;height:3px;background:#e5e7eb;border-radius:3px;margin:0 auto 12px}
    .payment{break-before:page}.payment .customer-card{padding:25px;margin-top:28px}.payment .panel{row-gap:26px}.blank{height:28px;border-bottom:2px solid #d1d5db}.signature{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:60px}.signature p{color:#9ca3af;font-size:11px}.eyebrow{color:#64748b;font-size:12px;margin-bottom:20px}
    </style></head><body>
    <main class="${confirmation ? 'confirmation' : 'quote'}">
    <header class="masthead"><div><h1>${title}</h1><div class="meta">תאריך הפקה: ${ltr(date(new Date()))}<br>מספר הזמנה: <strong>${ltr(`#${number}`)}</strong></div></div><div class="logo-side"><img class="logo" src="data:image/png;base64,${logo.toString('base64')}" alt="לוגו"></div></header>
    <section class="customer-card"><h2>פרטי המזמין</h2><div class="panel">${field('שם לקוח', escape(order.customerName))}${field('טלפון', ltr(order.customerPhone || '—'))}${order.customerEmail ? field('אימייל', ltr(order.customerEmail)) : ''}${field('תאריך אירוע/הגעה', ltr(date(order.eventDate)))}${field('מלון', escape(hotel))}${field('לילות', escape(order.numberOfNights || 1))}</div></section>
    <h2>פירוט ההזמנה</h2><table><thead><tr><th class="serial">#</th><th style="width:40%">תיאור</th><th style="width:33%">הרכב / כמות</th><th class="amount">מחיר</th></tr></thead><tbody>${rows.replaceAll('<td><strong>', '<td class="description"><strong>') || '<tr><td colspan="4">לא הוזנו חדרים</td></tr>'}${extras.length ? `<tr class="extras-heading"><td colspan="4">תוספות ושדרוגים</td></tr>${extras.map((extra, index) => `<tr><td class="serial">${rooms.length + index + 1}</td><td class="description"><strong>${escape(extra.extraType)}</strong><div class="extra-label">תוספת</div></td><td>כמות: ${escape(extra.quantity)}</td><td class="amount">${money(Number(extra.price) * Number(extra.quantity))}</td></tr>`).join('')}` : ''}</tbody></table>
    ${order.notes ? `<section class="notes-section"><h2>הערות ודגשים להזמנה:</h2><div class="notes">${escape(order.notes)}</div></section>` : ''}
    ${confirmation ? `<section class="terms"><h2>מדיניות ביטולים:</h2><p>ביטול הזמנה עד 30 יום ומעלה לפני תאריך ההגעה למלון: יחוייב ב-200 ₪ ליום לחדר עבור דמי טיפול בהזמנה.</p><p>ביטול הזמנה מ-30 יום ועד 14 יום לפני תאריך ההגעה יחוייב ב-25% מערך ההזמנה.</p><p>ביטול הזמנה מ-14 יום ועד 48 שעות לפני תאריך ההגעה יחוייב ב-50% מערך ההזמנה.</p><p>ביטול הזמנה 48 שעות לפני תאריך ההגעה יחוייב ב-100% מערך ההזמנה.</p></section>` : ''}
    <section class="totals">${Number(order.discountPercent) > 0 ? `<div class="discount"><span>הנחה (${ltr(`${order.discountPercent}%`)}):</span><strong>- ${money(subtotal - Number(order.total_price || 0))}</strong></div>` : ''}<div class="summary"><div class="disclaimer"><p>* ${confirmation ? 'הזמנה זו אושרה.' : 'הצעה זו תקפה בכפוף לזמינות החדרים במלון.'}</p><p>* ט.ל.ח.</p></div><div class="grand"><span>סה״כ לתשלום:</span><strong>${money(order.total_price)}</strong></div></div></section>
    <div class="branding">הופק באמצעות מערכת ניהול הזמנות · ${escape(hotel)}</div>
    ${confirmation && includePayment ? `<section class="payment"><div class="eyebrow">נספח להזמנה ${ltr(number)}</div><h1>תשלום וחתימה</h1><p>פרטי ההזמנה: ${escape(order.customerName)} · ${escape(hotel)}</p><div class="customer-card"><h2>פרטי אמצעי תשלום</h2><div class="panel">${['שם בעל הכרטיס', 'ת.ז. בעל הכרטיס', 'מספר כרטיס', 'תוקף', 'CVV', 'תשלומים'].map(label => field(label, '<div class="blank"></div>')).join('')}</div></div><h2>אישור הלקוח</h2><p>אני החתום מטה מאשר את פרטי ההזמנה כפי שמופיעים במסמך זה, ומאשר לחייב את כרטיס האשראי הנ״ל בסכום העסקה הכולל: ${money(order.total_price)}. ידוע לי כי ביטול עסקה כרוך בדמי ביטול ע״פ מדיניות המלון והחוק.</p><div class="signature"><div><p>שם וחתימת הלקוח</p><div class="blank"></div></div><div><p>תאריך</p><div class="blank"></div></div></div></section>` : ''}
    </main></body></html>` };
}

export async function renderHotelOrderPdf(order, options) {
  const document = await hotelOrderDocument(order, options);
  const browser = await launchPdfBrowser();
  try {
    const page = await browser.newPage();
    await page.setJavaScriptEnabled(false);
    await page.setContent(document.html, { waitUntil: 'load', timeout: 30000 });
    const pdf = await page.pdf({ format: 'A4', printBackground: true, waitForFonts: true, tagged: true,
      margin: { top: '15mm', bottom: '18mm', left: '15mm', right: '15mm' }, displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="font-family:Arial;font-size:9px;color:#555;width:100%;margin:0 17mm;display:flex;justify-content:space-between;border-top:1px solid #ddd;padding-top:8px"><span dir="rtl">${escape(document.hotel)} · ${escape(document.number)}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>` });
    return Buffer.from(pdf);
  } finally { await browser.close(); }
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { hotelOrderDocument, renderHotelOrderPdf } from './hotelOrderPdf.js';

const order = {
  orderNumber: 1042, optimaNumber: 'OPT-58219', customerName: 'משפחת כהן',
  customerPhone: '050-1234567', customerEmail: 'cohen@example.com',
  hotelName: 'מלון לדוגמה', eventDate: '2027-04-21T12:00:00Z', numberOfNights: 3,
  salespersonName: 'ישראל ישראלי', discountPercent: 10, total_price: 8190,
  rooms: [
    { roomType: 'חדר דלקס עם מרפסת', adults: 2, children: 1, price: 4800, price_list_names: ['חבילת חג - חצי פנסיון'], notes: 'בקשה לחדר בקומה גבוהה, בכפוף לזמינות.' },
    { roomType: 'חדר זוגי', adults: 2, price: 3900, price_list_names: ['חבילת חג - חצי פנסיון'] },
  ],
  extras: [{ extraType: 'ארוחת צהריים חגיגית', quantity: 5, price: 80 }],
  notes: 'נתוני הדגמה בלבד.\nבקשה לחדרים סמוכים ובדיקת אפשרות להגעה מוקדמת.',
};

test('escapes customer content and keeps mixed-direction values isolated', async () => {
  const { html } = await hotelOrderDocument({ ...order, customerName: '<script>alert(1)</script>' });
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('<bdi dir="ltr">050-1234567</bdi>'));
  assert.ok(html.includes('data:font/ttf;base64,'));
  assert.ok(!html.includes('http://') && !html.includes('https://'));
});

test('payment appendix only appears in requested confirmations', async () => {
  assert.ok(!(await hotelOrderDocument(order, { includePayment: true })).html.includes('class="payment"'));
  assert.ok(!(await hotelOrderDocument(order, { type: 'confirmation' })).html.includes('class="payment"'));
  assert.ok((await hotelOrderDocument(order, { type: 'confirmation', includePayment: true })).html.includes('class="payment"'));
});

test('uses the reference layout with one item table and notes before the summary', async () => {
  const { html } = await hotelOrderDocument(order);
  assert.equal((html.match(/<table>/g) || []).length, 1);
  assert.ok(html.includes('פרטי המזמין'));
  assert.ok(html.includes('פירוט ההזמנה'));
  assert.ok(html.includes('<td class="serial">3</td>'));
  assert.ok(html.indexOf('<section class="notes-section">') < html.indexOf('<section class="totals">'));
});

if (process.env.GENERATE_HOTEL_PDF_SAMPLES === '1') {
  await mkdir('output/pdf', { recursive: true });
  for (const [filename, data, options] of [
    ['hotel-quote-example.pdf', order, { type: 'quote' }],
    ['hotel-confirmation-example.pdf', order, { type: 'confirmation', includePayment: true }],
    ['hotel-quote-long-example.pdf', { ...order, rooms: Array.from({ length: 24 }, (_, i) => ({ ...order.rooms[i % 2], notes: i === 9 ? 'הערה ארוכה לבדיקת גלישת טקסט: '.repeat(16) : order.rooms[i % 2].notes })), notes: 'הערות רבות לבדיקת מסמך ארוך. '.repeat(80), discountPercent: 0, total_price: 104800 }, { type: 'quote' }],
  ]) {
    const pdf = await renderHotelOrderPdf(data, options);
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    await writeFile(`output/pdf/${filename}`, pdf);
    console.log(`Created ${filename}`);
  }
}

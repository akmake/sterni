import puppeteer from 'puppeteer';
import AppError from '../utils/AppError.js';
import catchAsync from '../utils/catchAsync.js';

const sanitizeFilename = (name = 'quote') => {
  return String(name)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120) || 'quote';
};

const toAsciiFilename = (name = 'quote') => {
  const ascii = String(name)
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
  return ascii || 'quote';
};

const wrapHtmlDocument = (htmlBody) => {
  return `<!doctype html>
<html lang="he" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Quote PDF</title>
    <style>
      @page { size: A4; margin: 0; }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
      }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        width: 210mm;
        max-width: 210mm;
      }
      body {
        direction: rtl;
        color: #0f172a;
        font-family: "Assistant", "Rubik", "Segoe UI", Arial, sans-serif;
      }
      .quote-page {
        width: 210mm !important;
        min-height: 297mm !important;
        height: 297mm !important;
        margin: 0 !important;
        box-shadow: none !important;
        overflow: hidden !important;
        position: relative !important;
        page-break-after: always;
        break-after: page;
      }
      .quote-page:last-child { page-break-after: auto; break-after: auto; }
      .quote-page img {
        image-rendering: -webkit-optimize-contrast;
        image-rendering: crisp-edges;
      }
      .quote-page header {
        border-bottom-color: #c5a059 !important;
        border-bottom-width: 2px !important;
        padding-bottom: 16px !important;
        margin-bottom: 18px !important;
      }
      .quote-page table {
        border-collapse: collapse !important;
        table-layout: fixed !important;
        width: 100% !important;
        border: 1px solid #dbe3ee !important;
      }
      .quote-page thead th {
        background: #f8fafc !important;
        color: #334155 !important;
        font-weight: 700 !important;
      }
      .quote-page th,
      .quote-page td {
        vertical-align: top;
        word-break: break-word;
        overflow-wrap: anywhere;
        border-color: #e2e8f0 !important;
      }
      .quote-page tbody tr:nth-child(even) td {
        background: #fcfdff !important;
      }
      .quote-page > div:first-of-type:not(header) {
        border-bottom-color: #e6d4ad !important;
        color: #64748b !important;
        font-weight: 600 !important;
      }
    </style>
  </head>
  <body>${htmlBody}</body>
</html>`;
};

export const renderQuotePdf = catchAsync(async (req, res, next) => {
  const { html, fileName } = req.body || {};

  if (!html || typeof html !== 'string') {
    return next(new AppError('HTML content is required for PDF rendering', 400));
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: 1240,
      height: 1754,
      deviceScaleFactor: 2,
    });

    await page.setContent(wrapHtmlDocument(html), {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 45000,
    });

    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }
      const images = Array.from(document.images || []);
      await Promise.all(
        images.map((img) => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = () => resolve();
            img.onerror = () => resolve();
          });
        })
      );
    });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
      tagged: true,
      waitForFonts: true,
    });

    const safeName = sanitizeFilename(fileName || 'quote');
    const asciiName = toAsciiFilename(safeName);
    const utf8Name = encodeURIComponent(safeName);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}.pdf"; filename*=UTF-8''${utf8Name}.pdf`
    );
    res.status(200).send(Buffer.from(pdf));
  } finally {
    await browser.close();
  }
});

# Android — article (maamar) PDF extraction

Screen: `android/.../ui/screens/mamaarim/ArticleUploadScreen.kt` · state: `ArticleUploadViewModel.kt`.
The user picks a PDF; the text is extracted, shown in a preview with an editable title, and saved to the
local library (`filesDir/articles_cache`) and optionally to the server (`POST /api/articles/save`).

## Two extraction modes (`ExtractionMode`, default `SERVER`)

| Mode | Code | What it does |
|---|---|---|
| `SERVER` | `server/controllers/articleController.js` `extractArticle` (`POST /api/articles/extract`) | `pdf-parse` + Hebrew code-point fix only. No reading order, no header/footnote removal, no title. |
| `LOCAL` | `android/.../util/ChabadPdfExtractor.kt` (PdfBox-Android 2.0.27) | Full pipeline below. Sets `detectedTitle`. |

The two modes do **not** produce the same text.

## `ChabadPdfExtractor` pipeline (LOCAL)

1. Each glyph: Hebrew code-point map (old Chabad encodings) + bracket flip + reverse per item.
   VT fonts (`VTFrank`/`VTNarksim`/`VTHadassah`): `B` → `ו` (vav-holam in the large opening word),
   `Z` → `—`, `«` (patach mark) dropped.
2. Items < 11pt dropped (numbered footnotes and their markers in the text).
3. Lines: items grouped by Y (±5pt), ordered right-to-left by X, a space where the gap > min(1.5, 0.15·size).
   Digit runs are turned back (`"81"` → `"18"`) after the RTL order reverses them.
4. **Running headers** removed on every book: a page's top line (page-number lines aside) whose words
   (digits removed) head another page too, or — from page 2 on — a short line with a page number in the
   top 12% of the page.
5. **Author's notes** removed: lines smaller than the document's body size (most common font size), below
   the page's last body line (e.g. `*) כ"כ ...` at 11–12pt under 13pt text).
6. **First-page heading** removed (it goes to the title field): every line on page 1 above the first line
   set in the body's font (most common font name, subset prefix stripped) — e.g. `בס"ד. ...` in
   VTHadassah-Bold and `(הנחה בלתי מוגה)`. By font, not size: the heading is set at the body's 13pt.
7. Clean-up: page-number-only lines, the fixed `RUNNING_HEADERS` list, `__`/`--` lines, < 2 chars;
   double spaces; no space before `, . : ; )` or after `(`.
8. Paragraphs rebuilt: a line ending with `. : ;` closes a paragraph.

**Title (`detectedTitle`)**: the distinct running-header texts — the name and the occasion, the one with
a year (`ה'ת…`) last: `העושה סוכתו תחת האילן — יום ב' דחג הסוכות, ה'תש"כ`. No running header (one-page
article) → page 1's first line. The ViewModel prefills `title` with it when the field is empty.

## Known limits

- PDFs whose text is an image (scans) give no text — intentional (no OCR).
- Multi-column layouts (main text with commentary columns on both sides, e.g. "ביאור בדרך אפשר" pages)
  are read across the whole width and come out mixed; their vowel-pointed fonts map to Latin glyphs.
  Not handled yet.

# Android — PDF library & reader ("ארון הספרים שלי")

Screen: `android/.../ui/screens/pdflibrary/PdfStudyScreen.kt` · state: `PdfStudyViewModel.kt` ·
rendering: `PdfRenderEngine.kt`. Route `pdfLibrary` (`NavGraph.kt`), opened from the home "ספריה" chip.
Local only — nothing here talks to the server.

The library now also has a visible Shulchan Aruch HaRav entry. Its independent body-only bundled
corpus, native reader, search and preferences are documented in [Shulchan Aruch](android-shulchan-aruch.md).

The `מפתח` chip additionally opens the live external catalogue, with selected-file downloads into this local library. See [Mafteach catalogue](android-mafteach-library.md). It uses source internet access, not the study server. `PdfBook` has nullable `sourceUrl`, `sourcePageUrl`, `sourceCategory` metadata; collection `mafteiach` also selects the native text reader. Owned downloaded PDFs are removed only after their last library reference is deleted. OCR consent is hosted by the shared screen so both upload and catalogue imports must ask before recognition.

## Data (SharedPreferences `PdfLibrary`)

| Key | Content |
|---|---|
| `books_list` | JSON list of `PdfBook(id, uriString, title, currentPage, totalPages, isLandscape, lastOpened?, bookmarks?, collection?, sichaPosition, sichaOffset, sichaCrops?, sichaTextPosition, sichaTextOffset)`. Nullable fields and zero-valued primitive fields preserve old entries. `collection == "sichot"` selects the dedicated reader. |
| `reader_mode` | `PAGED` / `SCROLL` (all books) |
| `reader_theme` | `WHITE` / `SEPIA` / `NIGHT` |
| `reader_crop` | white-margin cropping on/off |
| `sicha_font_size` | Native Sichot reader size, 18–40sp, default 24 |

Thumbnails: `filesDir/pdf_thumbs/<bookId>.png` (first page, 192px), made in the background for books
without one. Files are referenced by a persistable content-URI permission (taken on add, released on remove).

## Rendering (`PdfRenderEngine`)

- `android.graphics.pdf.PdfRenderer` (built in, works on minSdk 26). One open page at a time → every page
  access goes through a coroutine `Mutex` (overlapping renders from fast swipes used to fail silently).
- LRU bitmap cache sized by bytes (max(24MB, heap/6)); widths rounded to 64px; one page ≤ 12M pixels.
- `contentBounds(page)`: printed area from a 240px render (luma < 225), 1.5% padding; nearly empty pages
  (< 15% area) shown whole. Cropped renders use a transform matrix.
- Not used: `androidx.pdf` (needs minSdk 28, continuous scroll only, search useless on scanned sefarim).

## Reader

- Whole area forced RTL (`LocalLayoutDirection`) and standard platform font (`MaterialTheme(typography = Typography())`,
  not the app's `AppTypography`/SBL Hebrew/BaHaYetzira).
- PAGED: `HorizontalPager` (page 0 on the right). Tap left 28% = next page, right 28% = previous, middle = bars.
  SCROLL: `LazyColumn` of pages (aspect from page size + crop); composed only once the width is known
  (laid out at width 0 it snapped back to page 1 and lost the saved page).
- Pager and list states are re-created from an `anchor` page when the mode changes (keeps the page).
- Zoom: pinch (two fingers, intercepted on the Initial pass) or double-tap (2.5×, tapped spot kept);
  1×–4×, kept across pages, pager swipe disabled while zoomed, one-finger pan; each page `clipToBounds`;
  re-rendered sharp at the settled zoom (steps of 0.5, 200ms).
- Bars hide after 4s; bottom: "עמוד N מתוך M" (tap → go to page) + slider; top: close, title, bookmark toggle,
  bookmarks sheet, display sheet (mode, paper, orientation, crop).
- Paper: night inverts the page (ColorMatrix), sepia tints it. Screen kept on while reading.
  System Back closes the book. Open failures show a snackbar ("לא ניתן לפתוח את …").

## Library

"המשך קריאה" card (last opened book), all books sorted by last opened, thumbnail + progress, menu: rename /
remove (with confirmation; the file itself is not deleted).

## Likutei Sichot (לקוטי שיחות) — native text

The library has collection chips for general books and לקוטי שיחות. Imports belong to the selected
collection; existing books remain general. Adding a Sichot PDF opens conversion automatically.
Conversion progress reports completed pages; unsupported or unreadable files show a specific error.
All content and fonts stay local; there is no server upload. Rename/delete/continue work in both
collections. URI permission is released only after the last reference to the URI is removed.

The original bitmap-column reader has been replaced by `SichaReader.kt`, a selectable native Compose
text reader. Source pages are used only during import to identify columns and footnote boundaries;
no PDF renderer stays open while reading. Text reflows to screen width and the selected font size.
It preserves original content, section headings and inline font differences, rather than preserving
PDF line wraps at every screen width. Toolbar: search with highlighted results and previous/next
matching paragraph, text size 18–40sp, copy the entire conversation. Select text to copy excerpts.
The reader stays awake. General PDF theme/mode/zoom settings do not apply to this reader.

### Extraction and exact glyph fonts

- `SichaTextExtractor.kt`: Android PDFBox `TextPosition` collection page-by-page (IO dispatcher),
  cancellation checks, no automatic PDFTextStripper interleaving of the two columns.
- `SichaLayout.kt` / `PdfRenderEngine.sichaColumns`: 640px raster identifies the gutter, skips the
  top 6.5% running header band, detects independent footnote separators, and trims margins. Opening
  headings crossing the gutter are a third optional region kept whole. Raster pixels are never shown
  in the native text reader. Separator/header detection is heuristic for two-column printed Sichot;
  a sufficiently wide quiet gutter indicates two columns, otherwise a single column is preserved.
  Atypical layouts may need manual text review; there is no manual crop UI in text mode.
- `SichaTextParser.kt`: keeps opening heading, right column then left column; excludes small superscript
  note markers; groups baselines and paragraph indents; preserves font/style runs. Identified legacy
  GFrank/GDavid/GDrogolin/GMiryam ASCII Hebrew gets a specific mapping; proper Unicode and Latin fonts
  remain untouched. RTL glyph sorting also handles numeric/Latin LTR islands and logical brackets.
  Acrobat-renamed `TT<hex>o00` subsets are also decoded when their combined text has enough
  evidence of the same legacy Hebrew encoding (at least 80 lowercase letters, repeated backticks,
  frequent `z`, low vowel ratio, no Hebrew Unicode). The opaque name alone never enables decoding;
  fonts dominated by uppercase Latin stay untouched. This is a bounded heuristic, not support for
  every unknown PDF encoding. Identified fonts carry across later pages in the import.
  It does not rewrite/summarize source prose. Footnote content is excluded using source regions.
- `SichaFontRemapper.kt`: retains embedded TrueType outlines and metrics, replacing legacy cmap with
  a Unicode cmap built from PDF character-code-to-glyph IDs. Rebuilds SFNT table checksums and head
  checksum adjustment. Font extraction is local per imported document, never bundled into production
  assets. Scanned pages have no embedded font data and use SBL Hebrew. Non-TrueType/unusable fonts fall back to the existing SBL Hebrew font. Whitespace also uses
  SBL Hebrew because PDF subset fonts often omit the space glyph.
- Scan-only, incomplete-column or undecodable pages request explicit user approval before local Hebrew OCR. The reader
  receives Unicode text with confidence metadata and review images, never bitmap substitutes for prose.

### Storage and migration

`filesDir/sicha_text/<bookId>/text.json` holds `SichaTextDocument(version=3, pageCount, bodySize,
blocks, fonts)`. Blocks contain page/column/heading and `SichaTextRun(text, font, size)` arrays;
`fonts` maps original font names to local `font-N.ttf` files. JSON is cached via a temporary file
then rename after successful conversion; later opening reads this cache without re-extraction or
requiring the PDF, except native caches from older layout versions that require regeneration.
Removing a book removes its generated cache/fonts.

Before using an existing cache, the same renamed-font detector checks non-OCR runs for the old
Latin gibberish. Only affected caches are regenerated from the saved source on opening; Unicode
caches and reviewed OCR are retained. This repairs previously imported Mafteach volume 20,
Bereshit II (7 pages) without requiring deletion/reimport. Type1/CFF source fonts currently use
the Hebrew fallback; native TrueType mappings are decoded with the same inferred font set.

`PdfBook.sichaTextPosition` and `sichaTextOffset` hold native paragraph index and pixel offset.
`currentPage` comes from the paragraph's source page for library progress. Position writes are
debounced during scroll and flushed on close/dispose. Legacy `sichaPosition`, `sichaOffset` and
`sichaCrops` remain deserializable but are not applied to the new paragraph layout. Existing Sichot
imports convert on next open; general PDF books/settings are unaffected.
`PdfLibrary.sicha_font_size` stores the shared native text size (default 24sp).

### Verification

`SichaLayoutTest` validates region detection. `SichaTextParserTest` validates legacy decoding,
Unicode/Latin preservation, RTL column order, numeric order, superscript exclusion; its optional
reference-PDF regression extracts all 8 pages and checks Unicode mappings in remapped TrueType fonts.
Set `STERNI_SICHA_TEST_PDF` to the supplied reference PDF, `STERNI_SICHA_TEST_PAGES` to its 640px
big-endian raster fixtures (`page-N.argb`: width/height then ARGB32), and `STERNI_SICHA_TEXT_OUTPUT`
to a temporary output directory. Desktop PDFBox is a JVM test-only dependency; production uses
Android PDFBox. Reference PDF/font assets are not checked into the repository.

`SichaNativeReaderTest` is an optional instrumented regression. Temporarily place the reference PDF
at `android/app/src/androidTest/assets/sicha-reference.pdf`; run `connectedDebugAndroidTest` with
that class filter. It checks real Android extraction, original font loading, selectable native text,
resizing, search navigation, resume, and saves screenshots in the target app external-files directory.
Remove the reference fixture after testing. `ui-test-manifest` is a debug-only dependency.

`SichaRenamedFontsTest` uses temporary `androidTest/assets/sicha-renamed-fonts.pdf` for the
7-page volume-20 Bereshit II translation. It verifies actual Hebrew extraction without OCR,
reader display, and regeneration of a simulated old broken cache. The source fixture is not
checked in or bundled in the production APK. Parser unit tests also reject ordinary English
in opaque-name fonts and preserve already corrected/recognized text.


## Local Hebrew OCR and review

`SichaTextExtractor` first tries the PDF text layer. On the first page requiring OCR, it suspends
with `onOcrRequired(page)` before calling the OCR engine. `PdfStudyViewModel` exposes a transient
`OcrRequest(bookId, title, page)` and waits on `CompletableDeferred<Boolean>`. The library asks
"להפעיל סריקת טקסט?" with "כן, הפעל סריקה" / "לא עכשיו". Approving permits OCR for that
import only, including later scanned pages in the same file. Declining/dismissing/system Back
cancels the import and keeps the book available in the library; no OCR recognition or model
initialization runs before approval. A later uncached open asks again. Cached text opens directly
because it does not run recognition. Approval is never stored as a global preference.

`SichaOcrEngine.kt` lazily creates one Tesseract4Android 4.9.0 instance per approved import. It runs on the IO
worker using the bundled `tessdata_best` Hebrew LSTM model, with no network calls/document uploads.
The 3,704,077-byte model is copied once from APK assets to private `filesDir/sicha_ocr/tessdata`.
Provenance: https://github.com/tesseract-ocr/tessdata_best/blob/main/heb.traineddata
SHA256: `dbaa827aea6bc21215638447f17783a1004987c2d0bf5573d111fee397abdae5`.
Apache-2.0 license is bundled beside the model. Engine Maven coordinates are fetched only from an
exclusive JitPack repository filter, scoped to `cz.adaptech.tesseract4android`.

Pages render at approximately 300dpi (width bounded 1600–2600px, existing 12MP cap). Small scan skew
up to +/-5 degrees is estimated from horizontal ink projection by `SichaScanPreprocessor` and corrected
when the projection improves substantially. This does not handle arbitrary page rotation or perspective
warping; upright, legible printed scans are the supported input. Layout separates the optional heading,
then right/left body columns and footnotes before OCR. The engine uses single-column segmentation for
body and single-block segmentation for the centered title. It reuses recognition/model state while
clearing per-region results and images; native resources are always recycled at import completion.
Cancellation cancels the import job and calls Tesseract stop from recognition progress callbacks.

`SichaOcrParser.kt` consumes hOCR word bounding boxes, paragraphs and word confidence. OCR words are
already logical Unicode and are not reversed/legacy-decoded. It filters small numeric note markers,
groups paragraphs, recognizes section-label headings, and keeps confidence scores for review. OCR
style inference is approximate: source TrueType fonts are unavailable for image-only pages. The
system does not automatically rewrite uncertain words, even if they appear plausible.

Each scanned block has `ocr`, `reviewed`, `sourceImage`, `sourceBounds` and optional run `confidence`.
Words with confidence below 75 are shaded in the reader; this confidence is an engine heuristic, not
an accuracy guarantee. A count/banner links to the next paragraph requiring review. Every OCR paragraph
has an edit action opening the retained source snippet above an editable text field. Saving or confirming
marks the paragraph reviewed and atomically persists the corrected cache before closing the dialog;
Cancel leaves text/review status unchanged. Recognized source regions are saved as local
`scan-<page>-<region>.jpg`, removed with the book. Low-confidence highlighting disappears after review.
Older OCR caches remain readable; native v1/v2 caches upgrade their layout on opening and new imports use version 3. Extraction errors preserve the
source URI and show retryable errors in the library. A cancel button and system Back stop an ongoing import.

Tests: `SichaOcrParserTest` verifies hOCR logical direction, numbers/brackets, superscript filtering,
confidence preservation and review semantics. `SichaScannedPdfTest` rasterizes two reference pages into
an image-only PDF (including a tilted page), runs the real on-device OCR engine, verifies the consent prompt, absence of OCR output before approval, decline/retry,
one approval for the entire import, text rather than a PDF renderer, and edits/reopens a paragraph to verify correction persistence. Source
PDF fixtures remain temporary test-only assets. OCR tests save source-comparison screenshots and raw
recognized text in the emulator app external files directory for inspection.


Native packaging: the dependency's arm64-v8a and x86_64 ELF load segments are 16KB aligned. With this
project's AGP 8.2.2, `packaging.jniLibs.useLegacyPackaging = true` compresses libraries in the APK so
Android extracts them to aligned files instead of mmap-loading misaligned ZIP entries. This follows
https://developer.android.com/guide/practices/page-sizes#update-packaging and avoids the system's
16KB compatibility dialog. It affects APK packaging and increases extracted on-device library storage.
Validation includes checking every APK `.so` is compressed and running the instrumented OCR test on
the available modern Android emulator without the compatibility overlay.

### Native layout revision 3

New native caches use document version 3. Letter/digit baselines form the lines first; punctuation
is attached to the nearest line within 0.65em. This handles Type1/CFF quotes drawn 0.45em lower than
surrounding text without introducing quote-only lines or false paragraph indents. Short section
headings in renamed fonts are detected from their section label and alternate font, and their
continuation lines remain in the same heading. Paragraph starts use indentation and true line gaps.
Unindented native continuations across columns/pages join into one reflowing paragraph; its source
page/progress anchor is the first page of that paragraph. Heading and OCR boundaries remain separate.

Opening v1/v2 caches containing native blocks regenerates their layout from the saved PDF. Pure OCR
caches continue to open unchanged. Mixed caches retain all existing OCR page blocks, source images,
review status and user corrections while only native pages are re-extracted; retained pages do not
rerun OCR or ask again. The cache is replaced only after successful extraction. Old paragraph indexes
may shift when the number of blocks changes.

Regression checks include lowered quotes and real seven-page Mafteach text, a joined two-line
section heading, absence of detached quote blocks, correct quotation order, and regeneration of an
already decoded but structurally broken v2 cache. Parser tests cover column continuations and preserve
reviewed OCR boundaries. Optional geometry audit: set `STERNI_RENAMED_FONT_PDF` to the reference file
to emit `sicha-geometry.json` in the JVM temporary directory; test PDFs remain temporary assets.

The renamed-font instrumented test additionally covers volume 20 Bereshit I (page 1, seven-page
translation) using temporary `sicha-bereshit-first.pdf`: its entire three-line heading and the
opening Rashi quotation must form intact blocks without quote-only paragraphs. Distribution
version 1.1 / code 2 gives users an identifiable update instead of repeatedly publishing APKs
with the same version number. Downloaded Drive bytes were compared by SHA256 against the tested
local APK; distribute new builds as a new file/link to avoid ambiguity with earlier downloads.

# Android Mafteach catalogue

The PDF library's `מפתח` chip opens `MafteachBrowserScreen.kt` inside the app. The live public source is https://www.mafteiach.app. Its own RTL layout, volume/parsha/holiday selectors, expandable records, translations, summaries, search and media remain available through WebView. This is access to the live catalogue, not an offline mirror of the entire archive.

## Source sections

| Section | Route |
|---|---|
| Talks and discourses | `/all` |
| Discourses | `/maamorim` |
| Collected discourses | `/maamorim?melukat=true` |
| Likutei Sichot | `/likkutei_sichos/by_volume`, `/likkutei_sichos/by_parsha`, `/likkutei_sichos/by_moad` |
| Hadranim | `/hadranim/by_masechta` |
| General letters | `/michtavim_klolim_new/by_moed` |
| Diaries | `/yomanim/by_year` |
| Search | `/search` |

## Selected document import

Public Google Drive file links and source-host PDF links offer native continuous text or original PDF. The title comes from the selected record and link label and remains editable. `MafteachLinks.kt` validates HTTPS hosts and Drive IDs; `MafteachPdfDownloader.kt` uses anonymous per-download cookies, validates PDF magic bytes, streams with cancellation and a 100MB limit, and handles a bounded Drive confirmation flow. Source viewers remain available for media, non-PDF files and links that require access permissions. Downloads do not bypass source permissions.

Selected PDFs are cached in `filesDir/mafteiach_downloads`, keyed by SHA256 of the canonical source link. Unique partial filenames avoid cancellation/retry races. `PdfBook.sourceUrl`, `sourcePageUrl` and `sourceCategory` retain attribution; old library entries remain readable. Text imports use collection `sichot` for Likutei Sichot and `mafteiach` for other categories. Original PDF imports use the general collection. Matching source and reader mode reuse the existing book. The cached source is deleted only when its last library reference is removed; imported external content URIs are not deleted.

Text import uses the existing column/footnote extraction and native reader. If text is unavailable, the shared parent screen asks for approval before local OCR, including imports initiated from the catalogue. Declining keeps the downloaded book for retry. OCR is approximate and offers review/correction. Catalogue browsing needs internet; successfully downloaded files can reopen offline. WebView history is retained when entering and leaving the native reader.

WebView enables source JavaScript and DOM storage, disables file/content access, has no persistent native JavaScript bridge and does not override certificate validation. A one-shot script reads public link metadata. The app does not upload source documents or synchronize this library with the study server.

The source's viewport-height CSS variables are set from the measured WebView `innerHeight` after page load and on resize, avoiding Android WebView retaining a short initial `100vh` layout. This changes sizing only; source content and controls remain live.

## Verification

`MafteachLinksTest` covers canonical IDs, spoofed host/scheme rejection and category mapping. `MafteachIntegrationTest` visits all source sections and the three Likutei tabs on an emulator, taps a live translated PDF, verifies local import and reopening, and exercises native text or the OCR consent prompt. It requires internet and selects one small public file; it does not audit every third-party file in the archive. Its screenshot is saved as `mafteach-catalogue.png` in the target app external-files directory.

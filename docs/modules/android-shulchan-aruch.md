# Android Shulchan Aruch HaRav — body-only local library

Implemented in APK 1.2, with compatible native installation in 1.3 / code 4. The existing PDF library has a visible `שולחן ערוך אדמו״ר הזקן`
button opening `SahScreen`, an independent Compose text reader. No PDF extraction or website is used.
The user explicitly excluded notes and illustrations; the pack excludes their bodies, inline markers,
images and Kuntres Acharon. Source attribution remains in the information dialog and copied chapters.

## Corpus and build

`android/scripts/build_sah_pack.py` selects explicit Kehot editions from the existing measured Sefaria
audit. Vocalized addresses take priority; the unvocalized edition fills missing addresses. Each unit
retains its edition and source reference. Input hashes must match the audited snapshots. The result
contains 7,147 core source units plus 54 Hilkhot Talmud Torah sections: 7,201 units, 558 chapters
and 46 populated topic groups. This is the available core
Shulchan Arukh HaRav export, not a claim that every historical section/auxiliary work is present.
Hilkhot Talmud Torah is added directly from the four Wikisource revisions measured in the research,
with chapter counts 14/13/8/19, CC-BY-SA 4.0 attribution and revision hashes. Section headings are
excluded from the body and only main section paragraphs are imported, not Kuntres Acharon. Piskei
HaSiddur and Seder Birkat HaNehenin are separate auxiliary works and are not included. A distinct
Mikveh supplement was not established by the prior source audit.

Group titles and chapter mappings use the audited Chabad-library catalogue and source schema, not
invented prose. Two similarly named Netilat Yadayim topics have distinct IDs; Second/Last Edition
branches retain separate chapter IDs. Chapter titles also preserve the source's first bold heading.

BeautifulSoup removes superscript note markers, footnote bodies, commentator spans and images; safe
bold/italic/paragraph/line-break markup remains. SQLite keeps immutable groups/chapters/segments,
source references and an FTS4 unicode61 index. The generation script checks source counts, nonempty
bodies, omitted markup and database integrity before writing the compressed asset and manifest.

Assets: `app/src/main/assets/sah/corpus-v2.pack` (gzip NDJSON, about 3.9MB) and `manifest.json` (source metadata,
SHA256, byte counts, schema/content version, scope). Source snapshots are downloaded to temporary
storage; the redistributed pack is the cleaned body, not raw source annotations. Source metadata
labels these core editions CC-BY-NC; attribution and the original metadata are retained. The `.pack`
extension prevents AAPT from automatically decompressing/renaming assets ending in `.gz`.

## Installation and reading

`SahRepository` builds the bundled corpus once on first opening the book into private
`noBackupFilesDir/sah`. Unlike v1's desktop-built SQLite copy, v2 ships immutable records and creates
all tables/indexes (including FTS4) with the device's own SQLite engine. It streams bound inserts in a
transaction, bounds decompressed bytes, verifies the payload SHA256, checks all table/index counts and
native quick_check, then renames the staging database and records its local SHA256. Installed files
are verified against that local digest and the active corpus hash before reuse. Content is included
in the APK, so neither first installation nor later reading/search requires
network or a content server. This intentionally replaces the research proposal's server download
with a directly usable bundled pack; Room is not introduced for immutable content.

Installation is synchronized across repository instances and each staging file has a UUID, avoiding
shared-temp-file races during concurrent first opens. Validation failures name the specific table,
payload, size or native integrity result instead of displaying a bare `Check failed`. Version-1 files
are not reused by the new installer. User preferences remain intact because reference IDs are stable.
The reported device failure did not include its native integrity output, so its exact SQLite error
was not independently reproduced; native database generation removes the cross-version database
import dependency and detailed diagnostics expose any remaining failure.

Version 1.3 validation: three instrumented tests passed on the available emulator, covering full native
installation/search/UI, simulated corruption recovery and simultaneous repository opens. Older Android
system images were not installed on this host, so their SQLite versions were not independently run.

`SahScreen` provides part/topic/chapter navigation, local search, chapter-number lookup, selectable
Unicode Hebrew with source bold/italic markup, 18–40sp size, bookmarks, previous/next chapter and copy.
FTS input is normalized for Hebrew marks/punctuation and parameter-bound; explicit תפילין/תפלין and
ריבית/רבית aliases address common spelling variants. Results are bounded to 80. Reader renders a
single chapter in a keyed LazyColumn, never the entire corpus. Search hits target a specific segment.

`SahNumbers` formats Hebrew chapter/section labels and accepts direct Arabic or explicitly Hebrew
references such as `242`, `רמ״ב` or `סימן רמב`; ordinary search words such as שבת are not mistaken
for numerical references. The screen enforces RTL independently of its caller. A global bookmark
dialog is available in both the table of contents and reader. Copy attribution distinguishes the
Wikisource Torah-study chapters from the Sefaria/Kehot core.

`SahLibrary` SharedPreferences holds user-only settings: fontSize, bookmarks (stable segment IDs),
lastChapter, and index/offset per stable chapter ID. These are separate from immutable corpus and from
`UserManager` study-position sync. The corpus version can change without deleting these preferences.
The screen keeps the device awake while reading. Navigation back returns through chapter, search,
topic and the existing library.

## Validation

`SahLibraryTest` checks real Android database expansion, corpus counts, Orach Chayim/Yoreh Deah/Choshen
Mishpat groups, search equivalence with/without vowels, spelling aliases, chapter 242 and its 13
sections, absence of note/image markup, rich-text styling and reopening without source requests.
Compose checks library entry, search-to-reader, bookmarking, resizing and saved position. A reader
screenshot is saved as `shulchan-aruch-reader.png` in the emulator app external-files directory.

Validated: full Debug build, JVM tests including numerical reference checks, two instrumented corpus/UI
tests on Pixel 10, and visual inspection of Hebrew vowel marks and rich paragraph layout. Pack checks
cover all 7,201 body rows; reader tests exercise actual chapter 242 and its 13 sections plus all four
Torah-study chapter counts. Original PDF fixtures are not part of this pack or production APK.

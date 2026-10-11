package com.sterni.dailystudy.util

import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.PDPage
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.text.TextPosition

/**
 * מחלץ טקסט מ-PDF בדיוק כמו AdminPage.jsx:
 *
 *  - processTextPosition: אוסף כל התו עם מיקום X/Y/fontSize
 *  - מיון X יורד בתור שורה -> סדר RTL עברי נכון
 *  - hebrewMap + flipBrackets + reversed() per-item
 *  - fontSize < 11pt -> הסרת הערות שוליים
 *  - כותרת ריצה (השורה העליונה של עמוד, עם מספר העמוד) -> מזוהה ונמחקת, בכל ספר
 *  - מספרים -> חוזרים לסדר הנכון אחרי היפוך ה-RTL
 *  - רווח שנשאר לפני פיסוק (במקום מספר הערה שנמחק) -> נמחק
 *  - gap > 4 -> הוספת רווח בין מילים
 *  - שחזור פסקאות עם . : ;
 *  - detectedTitle: שם המאמר מתוך כותרות הריצה (או השורה הראשונה)
 *  - עיבוד ב-Batch של BATCH_SIZE עמודים -> מונע קריסה עם קבצים גדולים
 */
class ChabadPdfExtractor : PDFTextStripper() {

    private val hebrewMap = mapOf(
        0xe0 to 'א', 0x2021 to 'א', 0xe1 to 'ב', 0x00B7 to 'ב',
        0xe2 to 'ג', 0x201A to 'ג', 0xe3 to 'ד', 0x201E to 'ד',
        0xe4 to 'ה', 0x2030 to 'ה', 0xe5 to 'ו', 0x00C2 to 'ו',
        0xe6 to 'ז', 0x00CA to 'ז', 0xe7 to 'ח', 0x00C1 to 'ח',
        0xe8 to 'ט', 0x00CB to 'ט', 0xe9 to 'י', 0x00C8 to 'י',
        0xC8 to 'י', 0xea to 'ך', 0x00CD to 'ך', 0xCD to 'ך',
        0xeb to 'כ', 0x00CE to 'כ', 0xec to 'ל', 0x00CF to 'ל',
        0xCF to 'ל', 0xed to 'ם', 0x00CC to 'ם', 0xee to 'מ',
        0x00D3 to 'מ', 0xD3 to 'מ', 0xef to 'ן', 0x00D4 to 'ן',
        0xf0 to 'נ', 0xF8FF to 'נ', 0xf1 to 'ס', 0x00D2 to 'ס',
        0xf2 to 'ע', 0x00DA to 'ע', 0xf3 to 'ף', 0x00DB to 'ף',
        0xf4 to 'פ', 0x00D9 to 'פ', 0xD9 to 'פ', 0xf5 to 'ץ',
        0x0131 to 'ץ', 0xf6 to 'צ', 0x02C6 to 'צ', 0xf7 to 'ק',
        0x02DC to 'ק', 0xf8 to 'ר', 0x00AF to 'ר', 0xf9 to 'ש',
        0x02D8 to 'ש', 0xfa to 'ת', 0x02D9 to 'ת'
    )

    /**
     * The VT fonts (VTFrank / VTNarksim / VTHadassah) carry three glyphs whose unicode is Latin:
     * 'B' is a vav with holam (the large opening word "צBר" = צור), 'Z' a dash, '«' a patach mark
     * ("(«אלץ" = "(אַלץ") — dropped, like all the vowel points.
     */
    private val vtMap  = mapOf('B' to 'ו', 'Z' to '—')
    private val vtDrop = setOf('«')

    private val RUNNING_HEADERS = setOf(
        "ספר המאמרים", "תשכ\"ד", "ש\"פ צו",
        "שבת הגדול", "ניסן ה'תשכ\"ד"
    )

    // ── Internal state ────────────────────────────────────────────────────────
    private data class Item(
        val x: Float, val y: Float, val w: Float,
        val fontSize: Float, val font: String, val text: String
    )

    private data class Line(val y: Float, val text: String, val size: Float, val font: String)
    private data class PageLines(val page: Int, val height: Float, val lines: List<Line>)

    private val pageItems   = mutableMapOf<Int, MutableList<Item>>()
    private val pageHeights = mutableMapOf<Int, Float>()
    private val sizeCounts  = mutableMapOf<Float, Int>()   // font size (0.5pt) -> characters, whole document
    private val fontCounts  = mutableMapOf<String, Int>()  // font name -> characters, whole document

    /** שם המאמר שזוהה בחילוץ האחרון; null אם לא נמצא. */
    var detectedTitle: String? = null
        private set

    init { sortByPosition = true }

    // ── PDFTextStripper hooks ──────────────────────────────────────────────────

    override fun startPage(page: PDPage) {
        super.startPage(page)
        val absPage = currentPageNo
        pageItems[absPage]   = mutableListOf()
        pageHeights[absPage] = page.mediaBox.height
    }

    override fun processTextPosition(text: TextPosition) {
        val raw = text.unicode ?: return
        if (raw.isBlank()) return

        val vt = text.font?.name?.contains("VT") == true
        val fixed = raw
            .filter { !(vt && it in vtDrop) }
            .map  { if (vt) vtMap[it] ?: it else it }
            .map  { hebrewMap[it.code] ?: it }
            .map  { flipBrackets(it) }
            .reversed()
            .joinToString("")

        if (fixed.isBlank()) return

        val absPage = currentPageNo
        pageItems[absPage]?.add(
            Item(
                x        = text.x,
                y        = text.y,
                w        = text.width,
                fontSize = text.fontSizeInPt,
                font     = fontFamily(text.font?.name),
                text     = fixed
            )
        )
    }

    override fun writeString(text: String, textPositions: List<TextPosition>) { }

    // ── Public API ─────────────────────────────────────────────────────────────

    fun extract(
        document: PDDocument,
        onProgress: ((Int, Int) -> Unit)? = null
    ): Pair<String, Int> {
        val pageCount = document.numberOfPages
        val pages     = mutableListOf<PageLines>()
        sizeCounts.clear()
        fontCounts.clear()

        var processed = 0
        while (processed < pageCount) {
            val batchStart = processed + 1
            val batchEnd   = minOf(processed + BATCH_SIZE, pageCount)

            pageItems.clear()
            pageHeights.clear()
            startPage   = batchStart
            endPage     = batchEnd

            getText(document)

            for (pageNum in batchStart..batchEnd) {
                pages += PageLines(pageNum, pageHeights[pageNum] ?: 0f, buildPageLines(pageNum))
            }

            processed = batchEnd
            onProgress?.invoke(processed, pageCount)
        }

        val headers  = findRunningHeaders(pages)
        detectedTitle = buildTitle(pages, headers)
        val notes    = findNotes(pages) + findHeading(pages)
        val allLines = pages.flatMap { p ->
            p.lines.filterIndexed { i, _ -> (p.page to i) !in headers && (p.page to i) !in notes }.map { it.text }
        }

        val cleanLines = allLines
            .map { it.trim() }
            .filter { line ->
                if (line.isEmpty())                             return@filter false
                if (line.matches(Regex("^\\d{1,4}$")))         return@filter false
                if (RUNNING_HEADERS.any { line.contains(it) }) return@filter false
                if (line.contains("__") || line.contains("--")) return@filter false
                if (line.length < 2)                            return@filter false
                true
            }
            .map { it.replace(Regex("\\s{2,}"), " ") }
            // the gap of a deleted footnote number used to stay as a space: "הבית , וצריך"
            .map { it.replace(Regex("\\s+([,.:;)])"), "$1").replace(Regex("\\(\\s+"), "(") }

        val paragraphs  = mutableListOf<String>()
        val currentPara = mutableListOf<String>()
        for (line in cleanLines) {
            currentPara.add(line)
            if (line.endsWith('.') || line.endsWith(':') || line.endsWith(';')) {
                paragraphs.add(currentPara.joinToString(" "))
                currentPara.clear()
            }
        }
        if (currentPara.isNotEmpty()) paragraphs.add(currentPara.joinToString(" "))

        return Pair(paragraphs.joinToString("\n\n"), pageCount)
    }

    // ── Running headers & title ───────────────────────────────────────────────

    private fun isPageNumber(s: String) = s.trim().matches(Regex("^\\d{1,4}$"))

    /** A header's identity: its words without the page number. */
    private fun headerKey(s: String) =
        s.replace(Regex("\\d+"), " ").replace(Regex("\\s+"), " ").trim()

    /**
     * The running header of each page: its top line (page-number lines aside), when the
     * same words head another page too ("18 העושה סוכתו תחת האילן" on 18, 20, 22), or —
     * from the second page on — when it is short, carries a page number and sits in the
     * top 12% of the page. -> (page, line index) pairs to drop.
     */
    private fun findRunningHeaders(pages: List<PageLines>): Set<Pair<Int, Int>> {
        val firstPage = pages.firstOrNull()?.page ?: return emptySet()
        val tops = pages.mapNotNull { p ->
            val i = p.lines.indexOfFirst { it.text.isNotBlank() && !isPageNumber(it.text) }
            if (i < 0) null else Triple(p, i, p.lines[i])
        }
        val counts = tops.groupingBy { headerKey(it.third.text) }.eachCount()
        return tops.filter { (p, _, line) ->
            val key = headerKey(line.text)
            if (key.isEmpty()) return@filter false
            val repeats = (counts[key] ?: 0) >= 2
            val numbered = p.page != firstPage &&
                line.text.contains(Regex("(^|\\s)\\d{1,4}(\\s|$)")) &&
                key.split(' ').size <= 10 &&
                p.height > 0f && line.y < 0.12f * p.height
            repeats || numbered
        }.map { (p, i, _) -> p.page to i }.toSet()
    }

    /**
     * The notes at the foot of a page: lines in a smaller font than the body text, below the
     * page's last body line. The numbered footnotes are already gone (< 11pt); this takes the
     * author's notes too ("*) כ"כ בד"ה ..." at 11–12pt under 13pt text), which were spliced
     * into the middle of the sentence that runs on to the next page.
     */
    private fun findNotes(pages: List<PageLines>): Set<Pair<Int, Int>> {
        val body = sizeCounts.maxByOrNull { it.value }?.key ?: return emptySet()
        val out = mutableSetOf<Pair<Int, Int>>()
        for (p in pages) {
            val lastBody = p.lines.indexOfLast { it.size >= body - 0.5f }
            if (lastBody < 0) continue
            for (i in lastBody + 1 until p.lines.size)
                if (p.lines[i].size < body - 0.5f) out += p.page to i
        }
        return out
    }

    /**
     * The heading on the first page — every line above the first line set in the body's font
     * ("בס"ד. שבת בראשית, מבה"ח מרחשון, ה'תשי"ט" in VTHadassah-Bold and "(הנחה בלתי מוגה)" above the
     * VTFrank-Normal text). It is the title, which goes to the title field, not into the text.
     * By font, not size: the heading is set at the body's 13pt.
     */
    private fun findHeading(pages: List<PageLines>): Set<Pair<Int, Int>> {
        val bodyFont = fontCounts.maxByOrNull { it.value }?.key ?: return emptySet()
        val first = pages.firstOrNull() ?: return emptySet()
        val firstBody = first.lines.indexOfFirst { it.font == bodyFont && !isPageNumber(it.text) }
        if (firstBody <= 0) return emptySet()
        return (0 until firstBody).map { first.page to it }.toSet()
    }

    /**
     * The maamar's name and its occasion from the running headers (name — occasion); else page 1's
     * first line. The occasion is the header with the year ("ה'תש..."): which of the two heads the
     * even pages differs between books.
     */
    private fun buildTitle(pages: List<PageLines>, headers: Set<Pair<Int, Int>>): String? {
        val names = mutableListOf<String>()
        for (p in pages) for ((i, line) in p.lines.withIndex()) {
            if ((p.page to i) !in headers) continue
            val key = headerKey(line.text)
            if (key.isNotEmpty() && key !in names) names += key
        }
        val year = Regex("ה'ת")
        if (names.isNotEmpty()) return names.take(2).sortedBy { year.containsMatchIn(it) }.joinToString(" — ")
        val first = pages.firstOrNull()?.lines?.firstOrNull { it.text.isNotBlank() && !isPageNumber(it.text) }
        return first?.text?.trim()?.replace(Regex("\\s{2,}"), " ")?.take(80)?.ifEmpty { null }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun buildPageLines(pageNum: Int): List<Line> {
        val items = pageItems[pageNum] ?: return emptyList()

        val filtered = items.filter { item ->
            if (item.text.trim().isEmpty())         return@filter false
            if (item.fontSize in 0.01f..10.99f)     return@filter false
            true
        }
        if (filtered.isEmpty()) return emptyList()
        for (item in filtered) {
            val key = Math.round(item.fontSize * 2) / 2f
            sizeCounts[key] = (sizeCounts[key] ?: 0) + item.text.length
            fontCounts[item.font] = (fontCounts[item.font] ?: 0) + item.text.length
        }

        val sortedByY  = filtered.sortedBy { it.y }
        val lineGroups = mutableListOf<MutableList<Item>>()
        for (item in sortedByY) {
            val last = lineGroups.lastOrNull()
            if (last == null || kotlin.math.abs(item.y - last.first().y) > 5f)
                lineGroups.add(mutableListOf(item))
            else
                last.add(item)
        }

        return lineGroups.map { group ->
            val rtl = group.sortedByDescending { it.x }
            val text = buildString {
                var lastLeft = Float.MIN_VALUE
                for (item in rtl) {
                    if (lastLeft != Float.MIN_VALUE) {
                        val gap = lastLeft - (item.x + item.w)
                        val threshold = minOf(1.5f, item.fontSize * 0.15f)
                        if (gap > threshold) append(' ')
                    }
                    append(item.text)
                    lastLeft = item.x
                }
            }
            // digits come out reversed with the RTL order ("18" -> "81"): turn each run back
            val size = group.groupingBy { Math.round(it.fontSize * 2) / 2f }
                .fold(0) { acc, it -> acc + it.text.length }.maxByOrNull { it.value }!!.key
            val font = group.groupingBy { it.font }
                .fold(0) { acc, it -> acc + it.text.length }.maxByOrNull { it.value }!!.key
            Line(group.first().y, text.replace(Regex("\\d+")) { it.value.reversed() }, size, font)
        }
    }

    /** "KAMHBJ+VTFrank-Normal" -> "VTFrank-Normal": the subset prefix differs per file. */
    private fun fontFamily(name: String?): String = name?.substringAfter('+') ?: ""

    private fun flipBrackets(c: Char) = when (c) {
        '(' -> ')'; ')' -> '('
        '[' -> ']'; ']' -> '['
        '{' -> '}'; '}' -> '{'
        '<' -> '>'; '>' -> '<'
        else -> c
    }

    companion object {
        private const val BATCH_SIZE = 2500
    }
}

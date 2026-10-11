package com.sterni.dailystudy.ui.screens.pdflibrary

import kotlin.math.abs

data class SichaGlyph(
    val text: String, val x: Float, val y: Float, val width: Float,
    val size: Float, val font: String
)
data class SichaTextRun(val text: String, val font: String, val size: Float, val confidence: Int? = null)
data class SichaTextBlock(val page: Int, val column: Int, val heading: Boolean, val runs: List<SichaTextRun>,
    val ocr: Boolean = false, val reviewed: Boolean = false, val sourceImage: String? = null,
    val sourceBounds: SichaCrop? = null, val continuesPrevious: Boolean = false) {
    val text: String get() = runs.joinToString("") { it.text }
    val needsReview: Boolean get() = ocr && !reviewed && runs.any { (it.confidence ?: 100) < 75 }
}
data class SichaTextDocument(
    val version: Int = 3, val pageCount: Int, val bodySize: Float,
    val blocks: List<SichaTextBlock>, val fonts: Map<String, String> = emptyMap()
)

/** Decode only the identified legacy families. Real Unicode/Latin fonts remain untouched. */
object SichaTextParser {
    private val opaqueFont = Regex("TT[0-9A-Fa-f]+o00")
    private const val legacyChars = "`abcdefghijklmnopqrstuvwxyz"
    private const val hebrewChars = "אבגדהוזחטיךכלםמןנסעףפץצקרשת"
    fun isLegacy(font: String) = font.substringAfter('+').let {
        it.startsWith("GFrank") || it.startsWith("GDavid") ||
            it.startsWith("GDrogolin") || it.startsWith("GMiryam")
    }
    /** Renamed Acrobat subsets require text evidence; a TT name alone also occurs in Latin PDFs. */
    fun inferredLegacyFonts(samples: Map<String, String>): Set<String> {
        val candidates = samples.filterKeys { opaqueFont.matches(it.substringAfter('+')) }
        val text = candidates.values.joinToString("")
        val letters = text.count { it in 'a'..'z' }
        val evidence = letters >= 80 && text.count { it == '`' } >= 2 &&
            text.count { it == 'z' } >= letters * .04 &&
            text.count { it in "aeiou" } < letters * .35 &&
            text.none { it in '\u0590'..'\u05ff' }
        if (!evidence) return emptySet()
        return candidates.filterValues { sample ->
            val lower = sample.count { it in 'a'..'z' }
            val upper = sample.count { it in 'A'..'Z' }
            lower > 0 && upper <= lower * .1
        }.keys
    }

    fun hasBrokenLegacyCache(document: SichaTextDocument): Boolean = inferredLegacyFonts(
        document.blocks.filterNot { it.ocr }.flatMap { it.runs }.groupBy { it.font }
            .mapValues { (_, runs) -> runs.joinToString("") { it.text } }).isNotEmpty()

    /** Column/page boundaries are not paragraph boundaries when the next line has no indent. */
    fun joinContinuations(blocks: List<SichaTextBlock>): List<SichaTextBlock> {
        val out = mutableListOf<SichaTextBlock>()
        for (block in blocks) {
            val previous = out.lastOrNull()
            if (previous != null && block.continuesPrevious && !block.heading && !previous.heading &&
                !block.ocr && !previous.ocr) {
                val runs = previous.runs.toMutableList()
                append(runs, SichaTextRun(" ", runs.last().font, runs.last().size))
                block.runs.forEach { append(runs, it) }
                out[out.lastIndex] = previous.copy(runs = runs)
            } else out += block
        }
        return out
    }

    fun decode(text: String, font: String, inferredFonts: Set<String> = emptySet()): String =
        if (!isLegacy(font) && font !in inferredFonts) text else
        text.map { char ->
            val index = legacyChars.indexOf(char)
            when {
                index >= 0 -> hebrewChars[index]
                char == '±' -> '–'
                char == 'Î' -> '־'
                else -> char
            }
        }.joinToString("")

    private fun logicalGlyph(glyph: SichaGlyph, inferredFonts: Set<String>): String {
        val text = decode(glyph.text, glyph.font, inferredFonts)
        // Positions arrive in visual order. Hebrew runs become logical order; digits and
        // Latin runs must remain LTR. Bidi rendering mirrors logical brackets afterwards.
        if (text.none { it in '\u0590'..'\u05ff' }) return text.map { mirror(it) }.joinToString("")
        return text.reversed().map { mirror(it) }.joinToString("")
    }
    private fun mirror(c: Char) = when (c) {
        '(' -> ')'; ')' -> '('; '[' -> ']'; ']' -> '['; '{' -> '}'; '}' -> '{'; else -> c
    }

    fun bodySize(glyphs: List<SichaGlyph>): Float = glyphs.filter { it.y > 0f && it.size > 0 }
        .groupingBy { kotlin.math.round(it.size * 2) / 2f }
        .fold(0) { count, glyph -> count + glyph.text.count { !it.isWhitespace() } }
        .maxByOrNull { it.value }?.key ?: 11f

    fun parsePage(page: Int, glyphs: List<SichaGlyph>, width: Float, height: Float,
        regions: List<SichaCrop?>, bodySize: Float,
        inferredFonts: Set<String> = inferredLegacyFonts(glyphs.groupBy { it.font }
            .mapValues { (_, values) -> values.joinToString("") { it.text } })): List<SichaTextBlock> {
        val out = mutableListOf<SichaTextBlock>()
        val heading = regions.getOrNull(2)
        if (heading != null) out += regionBlocks(page, 0, glyphs, width, height, heading, bodySize, true, inferredFonts)
        for (column in 0..1) {
            val region = regions.getOrNull(column) ?: continue
            out += regionBlocks(page, column, glyphs, width, height, region, bodySize, false, inferredFonts)
        }
        return out
    }

    private fun regionBlocks(page: Int, column: Int, glyphs: List<SichaGlyph>, width: Float,
        height: Float, crop: SichaCrop, body: Float, title: Boolean, inferredFonts: Set<String>): List<SichaTextBlock> {
        val filtered = glyphs.filter { g ->
            val cx = (g.x + g.width / 2) / width
            // PDFTextStripper y is baseline measured from the top, not the glyph's top.
            val cy = (g.y - g.size * .35f) / height
            cx >= crop.left && cx <= crop.right && cy >= crop.top && cy <= crop.bottom &&
                (title || g.size >= body * .80f) && g.text.isNotBlank()
        }
        // Some CFF PDFs position quote glyphs 0.45em below the text baseline to compensate
        // for their font outlines. Punctuation must not create its own line or paragraph.
        fun isPunctuation(g: SichaGlyph) = decode(g.text, g.font, inferredFonts)
            .none { it.isLetterOrDigit() }
        val lines = mutableListOf<MutableList<SichaGlyph>>()
        for (g in filtered.filterNot { isPunctuation(it) }.sortedBy { it.y }) {
            val line = lines.lastOrNull()
            if (line == null || abs(g.y - line.first().y) > body * .27f) lines += mutableListOf(g)
            else line += g
        }
        for (g in filtered.filter { isPunctuation(it) }) {
            val nearest = lines.minByOrNull { abs(it.first().y - g.y) }
            if (nearest != null && abs(nearest.first().y - g.y) <= maxOf(body, g.size) * .65f)
                nearest += g
            else lines += mutableListOf(g)
        }
        lines.sortBy { it.first().y }
        if (lines.isEmpty()) return emptyList()
        val lineStep = lines.zipWithNext().map { (a, b) -> b.first().y - a.first().y }
            .filter { it > body * .7f }.sorted().let { it.getOrNull(it.size / 2) } ?: body * 1.3f
        val rightEdge = filtered.filterNot { isPunctuation(it) }.maxOfOrNull { it.x + it.width }
            ?: filtered.maxOf { it.x + it.width }
        val bodyFont = filtered.filterNot { isPunctuation(it) }.groupBy { it.font }
            .maxByOrNull { (_, values) -> values.sumOf { it.text.length } }?.key
        val blocks = mutableListOf<SichaTextBlock>()
        val runs = mutableListOf<SichaTextRun>()
        var previousY: Float? = null
        var previousHeading = title
        var headingFont: String? = null
        var continuesPrevious = false
        fun flush() {
            if (runs.isNotEmpty()) blocks += SichaTextBlock(page, column, previousHeading, runs.toList(),
                continuesPrevious = blocks.isEmpty() && continuesPrevious)
            runs.clear()
        }
        for (line in lines) {
            val y = line.first().y
            val letters = line.filter { decode(it.text, it.font, inferredFonts).any { c -> c.isLetter() } }
            val lineFont = letters.groupBy { it.font }.maxByOrNull { it.value.size }?.key
            val lineText = line.sortedByDescending { it.x }.joinToString("") { logicalGlyph(it, inferredFonts) }
            val alternativeStyle = lineFont != null && lineFont != bodyFont &&
                letters.all { it.font == lineFont && it.size >= body * .95f }
            val sectionStart = Regex("^[א-ת][.)]").containsMatchIn(lineText)
            val continuesHeading = previousHeading && headingFont == lineFont &&
                previousY?.let { y - it <= lineStep * 1.28f } == true
            val lineHeading = title || (letters.isNotEmpty() && letters.all { it.font.contains("Bold", true) }) ||
                (alternativeStyle && (sectionStart || continuesHeading))
            if (lineHeading) headingFont = lineFont
            val indented = rightEdge - line.maxOf { it.x + it.width } > body * .65f
            if (previousY == null) continuesPrevious = !indented && !lineHeading && !sectionStart
            if (previousY != null && (lineHeading != previousHeading ||
                    y - previousY!! > lineStep * 1.28f || (!lineHeading && (indented || sectionStart)))) flush()
            previousHeading = lineHeading
            if (runs.isNotEmpty()) append(runs, SichaTextRun(" ", runs.last().font, runs.last().size))
            val rtl = line.sortedByDescending { it.x }
            var lastLeft: Float? = null
            var i = 0
            while (i < rtl.size) {
                val g = rtl[i]
                val text = logicalGlyph(g, inferredFonts)
                val gap = lastLeft?.minus(g.x + g.width) ?: 0f
                if (gap > minOf(1.5f, body * .14f)) append(runs, SichaTextRun(" ", g.font, g.size))
                // Adjacent numeric/Latin glyphs are an LTR island inside the RTL line.
                if (text.isNotEmpty() && text.all { it.isDigit() || it in 'A'..'Z' || it in 'a'..'z' }) {
                    val island = mutableListOf(g)
                    var end = i + 1
                    while (end < rtl.size) {
                        val next = rtl[end]; val t = logicalGlyph(next, inferredFonts)
                        if (t.isEmpty() || !t.all { it.isDigit() || it in 'A'..'Z' || it in 'a'..'z' } ||
                            island.last().x - (next.x + next.width) > body * .14f) break
                        island += next; end++
                    }
                    for (part in island.asReversed()) append(runs, SichaTextRun(logicalGlyph(part, inferredFonts), part.font, part.size))
                    lastLeft = island.last().x; i = end
                } else {
                    append(runs, SichaTextRun(text, g.font, g.size)); lastLeft = g.x; i++
                }
            }
            previousY = y
        }
        flush()
        return blocks.map { block -> block.copy(runs = cleanRuns(block.runs)) }.filter { it.text.isNotBlank() }
    }

    private fun append(runs: MutableList<SichaTextRun>, run: SichaTextRun) {
        val last = runs.lastOrNull()
        if (last != null && last.font == run.font && abs(last.size - run.size) < .1f)
            runs[runs.lastIndex] = last.copy(text = last.text + run.text)
        else runs += run
    }
    private fun cleanRuns(runs: List<SichaTextRun>): List<SichaTextRun> {
        // Remove spacing introduced by omitted superscript note markers, across style runs too.
        val out = runs.toMutableList()
        for (i in out.indices) {
            var text = out[i].text.replace(Regex("\\s+([,.;:!?\\)])"), "$1").replace(Regex("\\(\\s+"), "(")
            if (i == 0) text = text.trimStart()
            if (i == out.lastIndex) text = text.trimEnd()
            if (i > 0 && text.firstOrNull() in listOf(',', '.', ';', ':', '!', '?', ')'))
                out[i - 1] = out[i - 1].copy(text = out[i - 1].text.trimEnd())
            out[i] = out[i].copy(text = text)
        }
        return out.filter { it.text.isNotEmpty() }
    }
}

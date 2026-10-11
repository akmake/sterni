package com.sterni.dailystudy.ui.screens.pdflibrary

import java.io.StringReader
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element
import org.xml.sax.InputSource
import kotlin.math.abs

/** hOCR already contains logical Unicode words: never apply PDF legacy decoding or reversal. */
object SichaOcrParser {
    private data class Word(val text: String, val left: Int, val top: Int, val right: Int,
        val bottom: Int, val confidence: Int)
    private data class Line(val words: List<Word>, val paragraph: String) {
        val top get() = words.minOf { it.top }
        val bottom get() = words.maxOf { it.bottom }
        val left get() = words.minOf { it.left }
        val right get() = words.maxOf { it.right }
        val text get() = words.joinToString(" ") { it.text }
    }
    fun parse(hocr: String, page: Int, column: Int, width: Int, height: Int,
        sourceImage: String, title: Boolean = false, bodySize: Float = 10f): List<SichaTextBlock> {
        require(!Regex("<!DOCTYPE|<!ENTITY", RegexOption.IGNORE_CASE).containsMatchIn(hocr))
        val factory = DocumentBuilderFactory.newInstance()
        // Android's built-in XML parser does not implement every JAXP feature flag.
        // Engine-generated hOCR never needs a DTD; reject declarations before parsing.
        runCatching { factory.setFeature("http://xml.org/sax/features/external-general-entities", false) }
        runCatching { factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false) }
        factory.isExpandEntityReferences = false
        val document = factory.newDocumentBuilder().parse(InputSource(StringReader("<root>$hocr</root>")))
        val spans = document.getElementsByTagName("span")
        val lines = mutableListOf<Line>()
        for (i in 0 until spans.length) {
            val line = spans.item(i) as? Element ?: continue
            if (line.getAttribute("class").split(' ').none { it == "ocr_line" || it == "ocr_header" }) continue
            val words = mutableListOf<Word>()
            val children = line.getElementsByTagName("span")
            for (j in 0 until children.length) {
                val element = children.item(j) as? Element ?: continue
                if ("ocrx_word" !in element.getAttribute("class").split(' ')) continue
                val bounds = Regex("bbox (\\d+) (\\d+) (\\d+) (\\d+)").find(element.getAttribute("title")) ?: continue
                val text = element.textContent.trim().replace(Regex("\\s+"), " ")
                if (text.isEmpty()) continue
                words += Word(text, bounds.groupValues[1].toInt(), bounds.groupValues[2].toInt(),
                    bounds.groupValues[3].toInt(), bounds.groupValues[4].toInt(),
                    Regex("x_wconf (\\d+)").find(element.getAttribute("title"))?.groupValues?.get(1)?.toInt()?.coerceIn(0, 100) ?: 0)
            }
            if (words.isEmpty()) continue
            var parent = line.parentNode as? Element
            while (parent != null && "ocr_par" !in parent.getAttribute("class").split(' ')) parent = parent.parentNode as? Element
            lines += Line(words.sortedByDescending { it.left }, parent?.getAttribute("id") ?: "")
        }
        if (lines.isEmpty()) return emptyList()
        val sorted = lines.sortedBy { it.top }
        val typicalHeight = sorted.flatMap { it.words }.map { it.bottom - it.top }.filter { it > 0 }.sorted()
            .let { it[it.size / 2].toFloat() }
        val lineStep = sorted.zipWithNext().map { (a, b) -> b.top - a.top }.filter { it > typicalHeight * .8f }
            .sorted().let { it.getOrNull(it.size / 2)?.toFloat() } ?: typicalHeight * 1.5f
        val result = mutableListOf<SichaTextBlock>()
        val current = mutableListOf<Line>()
        var heading = title
        fun flush() {
            if (current.isEmpty()) return
            val runs = mutableListOf<SichaTextRun>()
            for (line in current) {
                if (runs.isNotEmpty()) runs += SichaTextRun(" ", if (heading) "ocr-Bold" else "ocr", bodySize)
                for ((i, word) in line.words.withIndex()) {
                    if (i > 0) runs += SichaTextRun(" ", if (heading) "ocr-Bold" else "ocr", bodySize)
                    runs += SichaTextRun(word.text, if (heading) "ocr-Bold" else "ocr", bodySize, word.confidence)
                }
            }
            result += SichaTextBlock(page, column, heading, runs, ocr = true, sourceImage = sourceImage,
                sourceBounds = SichaCrop(0f, (current.minOf { it.top } - 10).coerceAtLeast(0) / height.toFloat(),
                    1f, (current.maxOf { it.bottom } + 10).coerceAtMost(height) / height.toFloat()))
            current.clear()
        }
        for (line in sorted) {
            // Smaller isolated numeric words are superscript footnote references, not prose.
            val clean = line.copy(words = line.words.filterNot {
                it.text.matches(Regex("\\d+\\*?")) && it.bottom - it.top < typicalHeight * .70f
            })
            if (clean.words.isEmpty()) continue
            val previous = current.lastOrNull()
            // A scan often loses the dot after the Hebrew section letter.
            val section = Regex("^(?:[א-ת][.׃]?|[א-ת]{2}[.׃])\\s+").containsMatchIn(clean.text)
            val centered = abs((clean.left + clean.right) / 2f - width / 2f) < width * .08f &&
                clean.right - clean.left < width * .90f
            val nextHeading = title || section || (heading && centered && previous != null &&
                previous.paragraph == clean.paragraph && clean.paragraph.isNotEmpty() && clean.top - previous.top < lineStep * 1.35f)
            val indented = width - clean.right > typicalHeight * .55f
            if (previous != null && (heading != nextHeading || clean.top - previous.top > lineStep * 1.30f ||
                    (previous.paragraph != clean.paragraph && clean.paragraph.isNotEmpty()) || (!nextHeading && indented))) flush()
            heading = nextHeading
            current += clean
        }
        flush()
        return result
    }
}

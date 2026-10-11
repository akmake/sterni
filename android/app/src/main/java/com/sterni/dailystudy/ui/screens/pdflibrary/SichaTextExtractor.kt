package com.sterni.dailystudy.ui.screens.pdflibrary

import com.tom_roush.pdfbox.pdmodel.PDDocument
import com.tom_roush.pdfbox.pdmodel.font.PDTrueTypeFont
import com.tom_roush.pdfbox.text.PDFTextStripper
import com.tom_roush.pdfbox.text.TextPosition
import java.io.File
import android.content.Context
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import kotlinx.coroutines.CancellationException

/** Uses glyph geometry, rather than PDFTextStripper's mixed-column output. */
class SichaTextExtractor(private val context: Context) : PDFTextStripper() {
    private val glyphs = mutableListOf<SichaGlyph>()
    private val embedded = linkedMapOf<String, ByteArray>()
    private val mappings = mutableMapOf<String, MutableMap<Int, Int>>()

    override fun processTextPosition(position: TextPosition) {
        val raw = position.unicode ?: return
        val name = position.font.name ?: ""
        glyphs += SichaGlyph(raw, position.xDirAdj, position.yDirAdj, position.widthDirAdj,
            position.fontSizeInPt, name)
        val font = position.font as? PDTrueTypeFont ?: return
        if (!embedded.containsKey(name)) {
            font.fontDescriptor?.fontFile2?.let { stream ->
                embedded[name] = stream.createInputStream().use { it.readBytes() }
            }
        }
        if (!embedded.containsKey(name)) return
        val map = mappings.getOrPut(name) { mutableMapOf() }
        for (code in position.characterCodes) {
            val unicode = font.toUnicode(code) ?: continue
            val decoded = SichaTextParser.decode(unicode, name)
            if (decoded.length == 1) {
                val gid = font.codeToGID(code)
                if (gid > 0) map[decoded[0].code] = gid
            }
        }
    }
    override fun writeString(text: String, textPositions: List<TextPosition>) = Unit

    suspend fun extract(document: PDDocument, engine: PdfRenderEngine, directory: File,
        onOcrRequired: suspend (Int) -> Boolean,
        preservedOcrBlocks: List<SichaTextBlock> = emptyList(),
        onProgress: (Int, Int) -> Unit): SichaTextDocument {
        val blocks = mutableListOf<SichaTextBlock>()
        var body = 11f
        val ocr = SichaOcrEngine(context)
        var ocrApproved = false
        val inferredFonts = mutableSetOf<String>()
        val cachedOcrPages = preservedOcrBlocks.filter { it.ocr }.groupBy { it.page }
        try {
        for (index in 0 until document.numberOfPages) {
            currentCoroutineContext().ensureActive()
            cachedOcrPages[index]?.let { cached ->
                blocks += cached
                onProgress(index + 1, document.numberOfPages)
            }
            if (index in cachedOcrPages) continue
            glyphs.clear()
            startPage = index + 1; endPage = index + 1
            getText(document)
            inferredFonts += SichaTextParser.inferredLegacyFonts(glyphs.groupBy { it.font }
                .mapValues { (_, values) -> values.joinToString("") { it.text } })
            if (glyphs.isNotEmpty()) body = SichaTextParser.bodySize(glyphs)
            val size = engine.pageSize(index)
            val regions = engine.sichaColumns(index)
            val pageBlocks = SichaTextParser.parsePage(index, glyphs, size.width, size.height,
                regions, body, inferredFonts)
            val missingColumn = (0..1).any { column -> regions.getOrNull(column) != null &&
                pageBlocks.none { it.column == column && !it.heading } }
            if (pageBlocks.isEmpty() || missingColumn || pageBlocks.any { '\uFFFD' in it.text }) {
                if (!ocrApproved) {
                    if (!onOcrRequired(index + 1)) throw CancellationException("OCR declined")
                    ocrApproved = true
                }
                onProgress(index, document.numberOfPages)
                blocks += ocr.recognize(index, engine, directory, body)
            } else blocks += pageBlocks
            onProgress(index + 1, document.numberOfPages)
        }
        require(blocks.isNotEmpty()) { "לא נמצא טקסט בקובץ" }
        directory.mkdirs()
        val fonts = mutableMapOf<String, String>()
        val usedFonts = blocks.flatMap { it.runs }.map { it.font }.toSet()
        for ((name, bytes) in embedded) {
            if (name !in usedFonts) continue
            try {
                val originalMap = mappings[name] ?: continue
                val map = originalMap.mapKeys { (unicode, _) ->
                    SichaTextParser.decode(unicode.toChar().toString(), name, inferredFonts).first().code
                }
                val file = File(directory, "font-${fonts.size}.ttf")
                file.writeBytes(SichaFontRemapper.remap(bytes, map))
                fonts[name] = file.name
            } catch (_: Exception) {
                // Text remains valid; the reader uses its existing Hebrew font for this family.
            }
        }
        return SichaTextDocument(pageCount = document.numberOfPages, bodySize = body,
            blocks = SichaTextParser.joinContinuations(blocks), fonts = fonts)
        } finally { ocr.close() }
    }
}

package com.sterni.dailystudy.ui.screens.pdflibrary

import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.apache.pdfbox.pdmodel.PDDocument
import org.apache.pdfbox.pdmodel.font.PDTrueTypeFont
import org.apache.pdfbox.text.PDFTextStripper
import org.apache.pdfbox.text.TextPosition
import org.apache.fontbox.ttf.TTFParser
import com.google.gson.Gson
import java.io.DataInputStream
import java.io.File

class SichaTextParserTest {
    @Test fun joinsColumnContinuationsButKeepsHeadingsAndReviewedOcr() {
        fun block(text: String, continuation: Boolean = false, heading: Boolean = false, ocr: Boolean = false) =
            SichaTextBlock(0, 0, heading, listOf(SichaTextRun(text, "Unicode", 10f)),
                ocr = ocr, reviewed = ocr, continuesPrevious = continuation)
        val joined = SichaTextParser.joinContinuations(listOf(block("הרי דבר זה"),
            block("מובן מן הפסוק", true), block("ב. כותרת", true, true), block("פסקה חדשה"),
            block("תיקון סריקה", true, ocr = true)))
        assertEquals(listOf("הרי דבר זה מובן מן הפסוק", "ב. כותרת", "פסקה חדשה", "תיקון סריקה"), joined.map { it.text })
        assertTrue(joined.last().reviewed)
    }
    @Test fun attachesRaisedAndLoweredPunctuationWithoutCreatingParagraphs() {
        val glyphs = mutableListOf<SichaGlyph>()
        fun line(text: String, y: Float) {
            text.forEachIndexed { i, c -> glyphs += SichaGlyph(c.toString(), 190f - i * 6f,
                if (c == '"') y + 4.5f else y, 6f, 10f, "Unicode") }
        }
        line("אמר \"שלום\"", 30f)
        line("וממשיך באותה פסקה", 44f)
        val blocks = SichaTextParser.parsePage(0, glyphs, 200f, 100f,
            listOf(SichaCrop(0f, 0f, 1f, 1f)), 10f)
        assertEquals(1, blocks.size)
        assertEquals("אמר \"שלום\" וממשיך באותה פסקה", blocks.single().text)
    }
    @Test fun renamedFontGeometryReference() {
        val path = System.getenv("STERNI_RENAMED_FONT_PDF")
        assumeTrue(path != null)
        val glyphs = mutableListOf<SichaGlyph>()
        val stripper = object : PDFTextStripper() {
            override fun processTextPosition(p: TextPosition) {
                glyphs += SichaGlyph(p.unicode, p.xDirAdj, p.yDirAdj, p.widthDirAdj, p.fontSizeInPt, p.font.name)
            }
            override fun writeString(text: String, positions: List<TextPosition>) = Unit
        }
        PDDocument.load(File(path!!)).use { pdf ->
            stripper.startPage = 1; stripper.endPage = 1; stripper.getText(pdf)
            File(System.getProperty("java.io.tmpdir"), "sicha-geometry.json").writeText(Gson().toJson(glyphs))
        }
    }
    @Test fun recognizesRenamedHebrewSubsetsWithoutTreatingEnglishAsHebrew() {
        val font = "ONDNMJ+TTB651o00"
        val sample = "ziy`xa zenda mdl deyd zece` dxezd zxtqny xg`l zece`e ux`a miigd ilra ly mz`ixa ".repeat(4)
        val inferred = SichaTextParser.inferredLegacyFonts(mapOf(font to sample))
        assertTrue(font in inferred)
        assertEquals("בראשית", SichaTextParser.decode("ax`yiz", font, inferred))
        assertTrue(SichaTextParser.inferredLegacyFonts(mapOf(font to "This is ordinary English text with a `code` example. ".repeat(12))).isEmpty())
        assertTrue(SichaTextParser.inferredLegacyFonts(mapOf("Arial" to sample)).isEmpty())
        val broken = SichaTextDocument(pageCount = 7, bodySize = 11f,
            blocks = listOf(SichaTextBlock(0, 0, false, listOf(SichaTextRun(sample, font, 11f)))))
        assertTrue(SichaTextParser.hasBrokenLegacyCache(broken))
        assertFalse(SichaTextParser.hasBrokenLegacyCache(broken.copy(blocks = broken.blocks.map { it.copy(ocr = true) })))
        assertFalse(SichaTextParser.hasBrokenLegacyCache(broken.copy(blocks = listOf(
            SichaTextBlock(0, 0, false, listOf(SichaTextRun("בראשית", font, 11f)))))))
    }
    @Test fun decodesKnownLegacyFontsWithoutCorruptingLatinOrUnicode() {
        assertEquals("בראשית", SichaTextParser.decode("ax`yiz", "ABCDEF+GFrank"))
        assertEquals("שלום ABC", SichaTextParser.decode("שלום ABC", "Arial"))
        assertEquals("שיחה", SichaTextParser.decode("yigd", "GDavid,Bold"))
    }

    @Test fun readsRightColumnFirstKeepsDigitsAndRemovesSuperscripts() {
        val glyphs = mutableListOf<SichaGlyph>()
        fun line(text: String, right: Float, baseline: Float, size: Float = 11f) {
            text.forEachIndexed { i, c -> glyphs += SichaGlyph(c.toString(), right - i * 6, baseline, 5f, size, "Unicode") }
        }
        line("ימין", 180f, 30f)
        line("שמאל", 80f, 30f)
        // Visual order on a Hebrew line: digit 2 is right of digit 1.
        line("21", 180f, 45f)
        glyphs += SichaGlyph("9", 190f, 27f, 3f, 7f, "Unicode")
        val blocks = SichaTextParser.parsePage(0, glyphs, 200f, 200f,
            listOf(SichaCrop(.5f, .05f, 1f, .5f), SichaCrop(0f, .05f, .5f, .5f)), 11f)
        val text = blocks.joinToString(" ") { it.text }
        assertTrue(text.startsWith("ימין")); assertTrue(text.contains("12")); assertFalse(text.contains("9"))
        assertTrue(text.indexOf("ימין") < text.indexOf("שמאל"))
    }

    @Test fun referencePdfTextAndOriginalFonts() {
        val source = System.getenv("STERNI_SICHA_TEST_PDF")
        val rasters = System.getenv("STERNI_SICHA_TEST_PAGES")
        val output = System.getenv("STERNI_SICHA_TEXT_OUTPUT")
        assumeTrue(source != null && rasters != null && output != null)
        val blocks = mutableListOf<SichaTextBlock>()
        val embedded = linkedMapOf<String, ByteArray>()
        val mappings = mutableMapOf<String, MutableMap<Int, Int>>()
        val glyphs = mutableListOf<SichaGlyph>()
        val stripper = object : PDFTextStripper() {
            override fun processTextPosition(p: TextPosition) {
                val name = p.font.name
                glyphs += SichaGlyph(p.unicode, p.xDirAdj, p.yDirAdj, p.widthDirAdj, p.fontSizeInPt, name)
                val font = p.font as? PDTrueTypeFont ?: return
                if (!embedded.containsKey(name)) font.fontDescriptor.fontFile2?.let {
                    embedded[name] = it.createInputStream().use { stream -> stream.readBytes() }
                }
                val map = mappings.getOrPut(name) { mutableMapOf() }
                for (code in p.characterCodes) {
                    val raw = font.toUnicode(code) ?: continue
                    val decoded = SichaTextParser.decode(raw, name)
                    val gid = font.codeToGID(code)
                    if (decoded.length == 1 && gid > 0) map[decoded[0].code] = gid
                }
            }
            override fun writeString(text: String, positions: List<TextPosition>) = Unit
        }
        val directory = File(output).also { it.mkdirs() }
        var body = 11f
        PDDocument.load(File(source)).use { pdf ->
            assertEquals(8, pdf.numberOfPages)
            for (index in 0 until pdf.numberOfPages) {
                glyphs.clear(); stripper.startPage = index + 1; stripper.endPage = index + 1
                stripper.getText(pdf)
                if (index == 0) body = SichaTextParser.bodySize(glyphs)
                val regions = DataInputStream(File(rasters, "page-${index + 1}.argb").inputStream()).use { input ->
                    val w = input.readInt(); val h = input.readInt()
                    SichaLayout.detect(IntArray(w * h) { input.readInt() }, w, h)
                }
                val box = pdf.getPage(index).cropBox
                val parsed = SichaTextParser.parsePage(index, glyphs, box.width, box.height, regions, body)
                assertTrue("Page ${index + 1} contains native text", parsed.isNotEmpty())
                blocks += parsed
            }
        }
        val fonts = mutableMapOf<String, String>()
        for ((name, bytes) in embedded) {
            val map = mappings[name]!!
            val remapped = SichaFontRemapper.remap(bytes, map)
            val file = File(directory, "font-${fonts.size}.ttf").also { it.writeBytes(remapped) }
            TTFParser().parse(file).use { ttf ->
                val cmap = ttf.getUnicodeCmapLookup()
                for ((unicode, gid) in map.filter { it.value > 0 })
                    assertEquals("Glyph for ${unicode.toChar()} in $name", gid, cmap.getGlyphId(unicode))
            }
            fonts[name] = file.name
        }
        val document = SichaTextDocument(pageCount = 8, bodySize = body, blocks = blocks, fonts = fonts)
        val text = blocks.joinToString("\n\n") { it.text }
        File(directory, "text.json").writeText(Gson().toJson(document))
        File(directory, "bereshit-3.txt").writeText(text)
        assertTrue(text.contains("בראשית"))
        assertTrue(text.contains("חכמת אדם הראשון"))
        assertTrue(text.contains("קריאת השמות"))
        assertTrue(text.indexOf("ב. קריאת השמות") < text.indexOf("ג. כדי לקרוא שמות"))
        assertFalse(text.contains("�"))
        assertFalse("No undecoded ASCII Hebrew", Regex("[a-z]{3}").containsMatchIn(text))
        assertFalse("Footnotes removed", text.contains("225"))
        println("Native blocks: ${blocks.size}; body size: $body; original fonts: ${fonts.keys}")
        println(text.take(4000))
    }
}

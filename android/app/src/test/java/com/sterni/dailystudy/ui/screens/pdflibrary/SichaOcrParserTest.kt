package com.sterni.dailystudy.ui.screens.pdflibrary

import org.junit.Assert.*
import org.junit.Test

class SichaOcrParserTest {
    private val hocr = """
        <div class='ocr_carea'><p class='ocr_par' id='p1'>
        <span class='ocr_line'><span class='ocrx_word' title='bbox 280 10 300 40; x_wconf 96'>א.</span>
        <span class='ocrx_word' title='bbox 150 10 260 40; x_wconf 91'>קריאת</span>
        <span class='ocrx_word' title='bbox 40 10 140 40; x_wconf 89'>השמות</span></span></p>
        <p class='ocr_par' id='p2'><span class='ocr_line'>
        <span class='ocrx_word' title='bbox 240 70 310 100; x_wconf 94'>טקסט</span>
        <span class='ocrx_word' title='bbox 160 70 230 100; x_wconf 45'>לבדיקה</span>
        <span class='ocrx_word' title='bbox 130 67 150 79; x_wconf 90'>12</span>
        <span class='ocrx_word' title='bbox 50 70 120 100; x_wconf 88'>(בעברית)</span>
        </span><span class='ocr_line'>
        <span class='ocrx_word' title='bbox 250 110 310 140; x_wconf 92'>מספר</span>
        <span class='ocrx_word' title='bbox 160 110 240 140; x_wconf 91'>123</span></span>
        </p></div>
    """.trimIndent()

    @Test fun logicalHebrewAndNumbersAreNotReversedAndUncertaintyIsKept() {
        val blocks = SichaOcrParser.parse(hocr, 2, 0, 320, 200, "scan.jpg")
        assertEquals("א. קריאת השמות", blocks.first().text)
        assertTrue(blocks.first().heading)
        val body = blocks.drop(1).joinToString(" ") { it.text }
        assertTrue(body.contains("(בעברית)")); assertTrue(body.contains("123")); assertFalse(body.contains("12 "))
        assertTrue(blocks.any { it.needsReview })
        assertTrue(blocks.all { it.ocr && it.sourceImage == "scan.jpg" && it.sourceBounds != null })
    }

    @Test fun reviewedTextStopsWarningWithoutDiscardingSource() {
        val block = SichaOcrParser.parse(hocr, 0, 1, 320, 200, "scan.jpg").first { it.needsReview }
        assertFalse(block.copy(reviewed = true).needsReview)
        assertEquals("scan.jpg", block.copy(reviewed = true).sourceImage)
    }

    @Test fun emptyRecognitionDoesNotInventProse() {
        assertTrue(SichaOcrParser.parse("<div/>", 0, 0, 200, 300, "empty.jpg").isEmpty())
    }

    @Test fun shortHebrewBodyWordsAreNotSectionNumbers() {
        val blocks = SichaOcrParser.parse(hocr.replace(">טקסט<", ">יש<"), 0, 0, 320, 200, "scan.jpg")
        assertFalse(blocks.first { it.text.startsWith("יש ") }.heading)
    }
}

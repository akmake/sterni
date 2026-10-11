package com.sterni.dailystudy.ui.screens.pdflibrary

import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.io.DataInputStream

class SichaLayoutTest {
    private val width = 640
    private val height = 900
    private fun fixture(): IntArray {
        val pixels = IntArray(width * height) { -1 }
        fun stroke(left: Int, right: Int, top: Int, bottom: Int) {
            for (y in top until bottom) for (x in left until right) pixels[y * width + x] = -0x1000000
        }
        // Running header, two staggered columns and differently positioned footnote separators.
        stroke(100, 540, 30, 34)
        for (y in 80..550 step 20) for (x in 70..270 step 15) stroke(x, x + 7, y, y + 8)
        for (y in 90..690 step 20) for (x in 350..550 step 15) stroke(x, x + 7, y, y + 8)
        stroke(180, 280, 600, 602); stroke(450, 550, 740, 742)
        for (y in 630..850 step 15) stroke(100, 110, y, y + 5)
        for (y in 770..850 step 15) stroke(390, 400, y, y + 5)
        return pixels
    }

    @Test fun keepsRightColumnFirstAndRemovesHeadersAndNotes() {
        val columns = SichaLayout.detect(fixture(), width, height)
        val right = columns[0]!!; val left = columns[1]!!
        assertTrue(right.left > .5f); assertTrue(left.right < .5f)
        assertTrue(right.top > .08f); assertTrue(left.top > .08f)
        assertTrue(right.bottom > .77f && right.bottom < .82f)
        assertTrue(left.bottom > .60f && left.bottom < .67f)
    }

    @Test fun blankPagesAreNotMagnified() {
        assertEquals(listOf(null, null, null), SichaLayout.detect(IntArray(width * height) { -1 }, width, height))
    }

    @Test fun noSeparatorKeepsAllBodyText() {
        val pixels = fixture()
        // Remove rules and notes, keeping all main text.
        for (y in 720 until height) for (x in 0 until width) pixels[y * width + x] = -1
        for (y in 580 until height) for (x in 0 until 320) pixels[y * width + x] = -1
        val columns = SichaLayout.detect(pixels, width, height)
        assertTrue(columns[0]!!.bottom > .77f)
        assertTrue(columns[1]!!.bottom > .60f)
    }

    @Test fun wideTextWithNoColumnGutterStaysInOneColumn() {
        val pixels = IntArray(width * height) { -1 }
        for ((row, y) in (80..700 step 20).withIndex()) {
            for (x in (40 + row % 3 * 7)..600 step 14) {
                for (dy in 0..8) for (dx in 0..8) pixels[(y + dy) * width + x + dx] = -0x1000000
            }
        }
        val regions = SichaLayout.detect(pixels, width, height)
        assertNull(regions[1])
        assertTrue(regions[0]!!.left < .1f && regions[0]!!.right > .9f)
    }

    /** Optional regression against the user-provided PDF, rasterized outside the repository. */
    @Test fun suppliedEightPageSicha() {
        val directory = System.getenv("STERNI_SICHA_TEST_PAGES")
        assumeTrue(directory != null)
        for (page in 1..8) {
            val columns = DataInputStream(File(directory, "page-$page.argb").inputStream()).use { input ->
                val w = input.readInt(); val h = input.readInt()
                SichaLayout.detect(IntArray(w * h) { input.readInt() }, w, h)
            }
            assertNotNull("Right column of page $page", columns[0])
            if (page < 8) assertNotNull("Left column of page $page", columns[1])
            if (page == 1) {
                assertNotNull("Opening heading remains whole", columns[2])
                assertTrue(columns[0]!!.top > columns[2]!!.bottom)
                assertTrue(columns[1]!!.bottom < .80f)
            } else assertNull("Body lines must not be mistaken for a title on page $page", columns[2])
            columns.filterNotNull().forEach { crop ->
                assertTrue(crop.top >= .065f)
                assertTrue(crop.right > crop.left && crop.bottom > crop.top)
            }
            println("Sicha page $page: $columns")
        }
    }
}

package com.sterni.dailystudy.ui.screens.pdflibrary

import android.app.Application
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import com.google.gson.Gson
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class SichaRenamedFontsTest {
    @get:Rule val compose = createComposeRule()

    @Test fun repairsSavedLatinGibberishUsingTheOriginalSevenPageSource() {
        verifySource("sicha-renamed-fonts", "בראשית ב — חלק כ", "השוה להם בהמות",
            "א. \"השוה להם בהמות וחיות...\"", "\"ויברך... פרו ורבו... ורדו בדגת הים...\"")
    }

    @Test fun bereshitFirstTalkKeepsTheWholeHeadingAndQuotation() {
        verifySource("sicha-bereshit-first", "בראשית א — חלק כ", "פירוש רש\"י",
            "א. פירוש רש\"י על \"בראשית...\" והשאלה על כך", "\"לא היה צריך להתחיל את התורה")
    }

    private fun verifySource(asset: String, title: String, phrase: String, heading: String, quotation: String) {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val fixture = runCatching { instrumentation.context.assets.open("$asset.pdf") }.getOrNull()
        assumeTrue(fixture != null)
        val context = instrumentation.targetContext
        val source = File(context.cacheDir, "$asset.pdf")
        fixture!!.use { input -> source.outputStream().use { input.copyTo(it) } }
        val vm = PdfStudyViewModel(context.applicationContext as Application)
        compose.setContent { MaterialTheme { PdfStudyScreen(onBack = {}, vm = vm) } }
        compose.runOnIdle { vm.addBook(Uri.fromFile(source), title, false, "sichot") }
        compose.waitUntil(60_000) { vm.state.value.currentBook != null || vm.state.value.errorMsg != null || vm.state.value.ocrRequest != null }
        assertNull(vm.state.value.errorMsg)
        assertNull("Decodable renamed fonts do not require OCR", vm.state.value.ocrRequest)
        val doc = vm.state.value.sichaText!!
        assertEquals(7, doc.pageCount)
        val text = doc.blocks.joinToString("\n") { it.text }
        File(context.getExternalFilesDir(null), "$asset.txt").writeText(text)
        assertTrue(text.contains("בראשית"))
        assertTrue(text.contains(phrase))
        assertFalse(text.contains("zenda"))
        assertFalse(text.contains("ziy`xa"))
        assertTrue("Whole heading: $heading", doc.blocks.any { it.heading && it.text == heading })
        assertFalse("No detached quote paragraphs", doc.blocks.any { it.text.trim() == "\"" })
        assertTrue("Quote follows the correct baseline", text.contains(quotation))
        compose.onAllNodesWithText(phrase, substring = true).onFirst().assertIsDisplayed()
        val book = vm.state.value.currentBook!!
        compose.onAllNodes(isRoot()).onFirst().captureToImage().asAndroidBitmap().let { image ->
            File(context.getExternalFilesDir(null), "$asset.png").outputStream().use {
                image.compress(Bitmap.CompressFormat.PNG, 100, it)
            }
        }
        File(context.getExternalFilesDir(null), "$asset.txt").writeText(text)
        compose.runOnIdle { vm.closeBook() }
        // An already decoded v2 cache still needs its paragraph structure regenerated.
        val broken = doc.copy(version = 2, blocks = listOf(
            SichaTextBlock(0, 0, false, listOf(SichaTextRun("\"", "ONDNMK+TTB654o00", 10f))),
            SichaTextBlock(0, 0, false, listOf(SichaTextRun("בראשית", "ONDNMJ+TTB651o00", 11f)))))
        File(context.filesDir, "sicha_text/${book.id}/text.json").writeText(Gson().toJson(broken))
        compose.runOnIdle { vm.openBook(book.id) }
        compose.waitUntil(60_000) { vm.state.value.currentBook != null || vm.state.value.errorMsg != null }
        assertNull(vm.state.value.errorMsg)
        assertTrue(vm.state.value.sichaText!!.blocks.any { phrase in it.text })
        assertEquals(7, vm.state.value.sichaText!!.pageCount)
        assertEquals(3, vm.state.value.sichaText!!.version)
        assertFalse(vm.state.value.sichaText!!.blocks.any { it.text.trim() == "\"" })
    }
}


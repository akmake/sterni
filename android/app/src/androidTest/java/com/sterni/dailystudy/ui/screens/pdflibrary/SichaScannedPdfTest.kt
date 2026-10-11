package com.sterni.dailystudy.ui.screens.pdflibrary

import android.app.Application
import android.graphics.Bitmap
import android.graphics.RectF
import android.graphics.pdf.PdfDocument
import android.net.Uri
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import kotlinx.coroutines.runBlocking
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

class SichaScannedPdfTest {
    @get:Rule val compose = createComposeRule()

    @Test fun imageOnlyPdfIsRecognizedLocallyAndCorrectionsSurviveReopening() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val fixture = runCatching { instrumentation.context.assets.open("sicha-reference.pdf") }.getOrNull()
        assumeTrue(fixture != null)
        val context = instrumentation.targetContext
        val original = File(context.cacheDir, "ocr-original.pdf")
        fixture!!.use { input -> original.outputStream().use { input.copyTo(it) } }
        val scanned = File(context.cacheDir, "ocr-image-only.pdf")
        runBlocking {
            PdfRenderEngine.open(context, Uri.fromFile(original)).use { engine ->
                val pdf = PdfDocument()
                try {
                    for (index in 0..1) {
                        val size = engine.pageSize(index)
                        val page = pdf.startPage(PdfDocument.PageInfo.Builder(size.width.toInt(), size.height.toInt(), index + 1).create())
                        // The second page is deliberately tilted to exercise scan deskew.
                        if (index == 1) page.canvas.rotate(2f, size.width / 2, size.height / 2)
                        val image = engine.render(index, 2000, false)
                        page.canvas.drawBitmap(image, null, RectF(0f, 0f, size.width, size.height), null)
                        pdf.finishPage(page)
                    }
                    scanned.outputStream().use { pdf.writeTo(it) }
                } finally { pdf.close() }
            }
        }
        val vm = PdfStudyViewModel(context.applicationContext as Application)
        compose.setContent { MaterialTheme { PdfStudyScreen(onBack = {}, vm = vm) } }
        compose.runOnIdle {
            vm.setSichaFontSize(22)
            vm.addBook(Uri.fromFile(scanned), "בראשית ג · סריקה", false, "sichot")
        }
        compose.waitUntil(20_000) { vm.state.value.ocrRequest != null || vm.state.value.errorMsg != null }
        assertNull(vm.state.value.errorMsg)
        assertNotNull(vm.state.value.ocrRequest)
        assertNull("No recognized text before approval", vm.state.value.sichaText)
        val importedId = vm.state.value.books.last().id
        assertTrue("No OCR output before approval", vm.sichaFontDirectory(importedId).listFiles().orEmpty()
            .none { it.name.startsWith("scan-") || it.name == "text.json" })
        compose.onNodeWithText("להפעיל סריקת טקסט?").assertIsDisplayed()
        compose.onNodeWithText("לא עכשיו").performClick()
        compose.waitUntil(10_000) { !vm.state.value.isOpening && vm.state.value.ocrRequest == null }
        assertNull(vm.state.value.currentBook)
        assertNull(vm.state.value.sichaText)
        compose.runOnIdle { vm.openBook(importedId) }
        compose.waitUntil(20_000) { vm.state.value.ocrRequest != null }
        compose.onNodeWithText("כן, הפעל סריקה").performClick()
        compose.waitUntil(120_000) { vm.state.value.currentBook != null || vm.state.value.errorMsg != null }
        assertNull(vm.state.value.errorMsg)
        val document = vm.state.value.sichaText!!
        assertEquals(2, document.pageCount)
        assertTrue(document.blocks.isNotEmpty())
        assertTrue(document.blocks.all { it.ocr })
        assertTrue(document.blocks.any { "בראשית" in it.text })
        assertTrue(document.blocks.any { "השמות" in it.text })
        assertTrue(document.blocks.any { it.page == 1 && "הנברא" in it.text })
        val fullText = document.blocks.joinToString("\n") { it.text }
        assertTrue("Right column precedes left column", fullText.indexOf("קריאת השמות היא") < fullText.indexOf("כדי לקרוא שמות אין"))
        assertFalse("Footnote content excluded", fullText.contains("225"))
        assertTrue(document.blocks.filter { it.page == 0 && it.column == 0 }.lastIndex >= 0)
        assertNull(vm.state.value.engine)
        File(context.getExternalFilesDir(null), "sicha-ocr-text.txt").writeText(document.blocks.joinToString("\n\n") { it.text })
        compose.onAllNodes(isRoot()).onFirst().captureToImage().asAndroidBitmap().let { image ->
            File(context.getExternalFilesDir(null), "sicha-ocr-reader.png").outputStream().use {
                image.compress(Bitmap.CompressFormat.PNG, 100, it)
            }
        }
        compose.onAllNodesWithText("השוואה למקור ותיקון").onFirst().performClick()
        compose.onNode(hasSetTextAction()).performTextReplacement("בראשית ג — תיקון שנשמר")
        instrumentation.uiAutomation.takeScreenshot().let { image ->
            File(context.getExternalFilesDir(null), "sicha-ocr-review.png").outputStream().use {
                image.compress(Bitmap.CompressFormat.PNG, 100, it)
            }
        }
        compose.onNodeWithText("שמירה ואישור").performClick()
        compose.waitUntil(10_000) { vm.state.value.sichaText!!.blocks.any { it.text == "בראשית ג — תיקון שנשמר" && it.reviewed } }
        val bookId = vm.state.value.currentBook!!.id
        compose.onNodeWithContentDescription("חזרה לספרייה").performClick()
        compose.runOnIdle { vm.openBook(bookId) }
        compose.waitUntil(10_000) { vm.state.value.currentBook != null }
        assertNull("Cached text does not run OCR or require approval again", vm.state.value.ocrRequest)
        assertTrue(vm.state.value.sichaText!!.blocks.any { it.text == "בראשית ג — תיקון שנשמר" && it.reviewed })
    }
}

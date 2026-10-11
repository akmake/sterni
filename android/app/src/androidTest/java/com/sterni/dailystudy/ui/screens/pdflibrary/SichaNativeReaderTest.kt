package com.sterni.dailystudy.ui.screens.pdflibrary

import android.app.Application
import android.graphics.Bitmap
import android.net.Uri
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.junit.Assert.*
import org.junit.Assume.assumeTrue
import org.junit.Rule
import org.junit.Test
import java.io.File

/** Supply the reference PDF as androidTest/assets/sicha-reference.pdf for this optional regression. */
class SichaNativeReaderTest {
    @get:Rule val compose = createComposeRule()

    @Test fun importsAsNativeTextSearchesResizesAndResumes() {
        val instrumentation = InstrumentationRegistry.getInstrumentation()
        val fixture = runCatching { instrumentation.context.assets.open("sicha-reference.pdf") }.getOrNull()
        assumeTrue(fixture != null)
        val context = instrumentation.targetContext
        val source = File(context.cacheDir, "sicha-reference.pdf")
        fixture!!.use { input -> source.outputStream().use { input.copyTo(it) } }
        val vm = PdfStudyViewModel(context.applicationContext as Application)
        compose.setContent { MaterialTheme { PdfStudyScreen(onBack = {}, vm = vm) } }
        compose.runOnIdle { vm.addBook(Uri.fromFile(source), "בראשית ג", false, "sichot") }
        compose.waitUntil(60_000) { vm.state.value.currentBook != null || vm.state.value.errorMsg != null }
        assertNull(vm.state.value.errorMsg)
        assertNull("Native-text PDFs do not ask to run OCR", vm.state.value.ocrRequest)
        val document = vm.state.value.sichaText!!
        assertNull("Text reader must not keep a PDF renderer open", vm.state.value.engine)
        assertEquals(8, document.pageCount)
        assertTrue(document.blocks.any { "במדרש נאמר" in it.text })
        assertTrue(document.fonts.isNotEmpty())
        compose.onNodeWithText("חכמת אדם הראשון", substring = true).assertIsDisplayed()
        val output = File(context.getExternalFilesDir(null), "sicha-native-reader.png")
        compose.onAllNodes(isRoot()).onFirst().captureToImage().asAndroidBitmap().let { image ->
            output.outputStream().use { image.compress(Bitmap.CompressFormat.PNG, 100, it) }
        }
        val previousSize = vm.state.value.sichaFontSize
        compose.onNodeWithContentDescription("אפשרויות קריאה").performClick()
        compose.onNodeWithText("הגדלת טקסט", substring = true).performClick()
        assertEquals((previousSize + 2).coerceAtMost(40), vm.state.value.sichaFontSize)
        // Dismiss dropdown, then search for a heading on a later source page.
        compose.onNodeWithContentDescription("אפשרויות קריאה").performClick()
        compose.onNodeWithContentDescription("חיפוש בשיחה").performClick()
        compose.onNode(hasSetTextAction()).performTextInput("הגשמת הכוונה")
        compose.waitUntil(10_000) {
            compose.onAllNodesWithText("ח. הגשמת הכוונה", substring = true).fetchSemanticsNodes().isNotEmpty()
        }
        compose.waitForIdle()
        compose.onNodeWithText("ח. הגשמת הכוונה", substring = true).assertIsDisplayed()
        val highlighted = compose.onNodeWithText("ח. הגשמת הכוונה", substring = true)
            .fetchSemanticsNode().config[SemanticsProperties.Text].first()
        assertTrue("Search results highlighted", highlighted.spanStyles.any { it.item.background != Color.Unspecified })
        compose.onAllNodes(isRoot()).onFirst().captureToImage().asAndroidBitmap().let { image ->
            File(context.getExternalFilesDir(null), "sicha-native-search.png").outputStream().use {
                image.compress(Bitmap.CompressFormat.PNG, 100, it)
            }
        }
        compose.onNodeWithContentDescription("סגירת חיפוש").performClick()
        val bookId = vm.state.value.currentBook!!.id
        compose.onNodeWithContentDescription("חזרה לספרייה").performClick()
        val saved = vm.state.value.books.first { it.id == bookId }
        assertTrue("Position saved after navigating through text", saved.sichaTextPosition > 0)
        compose.runOnIdle { vm.openBook(bookId) }
        compose.waitUntil(10_000) { vm.state.value.currentBook != null }
        assertEquals(saved.sichaTextPosition, vm.state.value.currentBook!!.sichaTextPosition)
        assertNotNull(vm.state.value.sichaText)
    }
}

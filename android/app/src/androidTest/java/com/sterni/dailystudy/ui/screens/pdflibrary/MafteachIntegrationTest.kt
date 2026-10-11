package com.sterni.dailystudy.ui.screens.pdflibrary

import android.app.Application
import android.graphics.Bitmap
import android.os.SystemClock
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File
import java.util.concurrent.atomic.AtomicReference

/** Live public-source integration; requires internet, imports only the selected small PDF. */
class MafteachIntegrationTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()
    private var expectedUrl = MafteachLinks.HOME

    private fun findWeb(view: View): WebView? {
        if (view is WebView) return view
        if (view is ViewGroup) for (i in 0 until view.childCount) findWeb(view.getChildAt(i))?.let { return it }
        return null
    }
    private fun web(): WebView = findWeb(compose.activity.window.decorView)!!
    private fun js(code: String): String {
        val result = AtomicReference<String?>(null)
        compose.runOnIdle { web().evaluateJavascript(code) { result.set(it) } }
        compose.waitUntil(15_000) { result.get() != null }
        return result.get()!!
    }
    private fun waitPage() {
        compose.waitUntil(45_000) {
            val ready = AtomicReference(false)
            InstrumentationRegistry.getInstrumentation().runOnMainSync {
                val view = web()
                ready.set(view.progress == 100 && view.url?.startsWith(expectedUrl) == true)
            }
            ready.get()
        }
        assertEquals("Source page loaded", "true", js("document.readyState === 'complete' && !!document.querySelector('main')"))
    }

    private fun load(url: String) {
        expectedUrl = url
        compose.runOnIdle { web().loadUrl(url) }
        waitPage()
    }

    @Test fun browseAllCollectionsAndImportTheSelectedSourcePdf() {
        val context = InstrumentationRegistry.getInstrumentation().targetContext
        val vm = PdfStudyViewModel(context.applicationContext as Application)
        compose.setContent { MaterialTheme { PdfStudyScreen(onBack = {}, vm = vm) } }
        compose.onNodeWithText("מפתח", useUnmergedTree = true).performClick()
        compose.waitUntil(15_000) { findWeb(compose.activity.window.decorView) != null }
        waitPage()
        assertTrue(js("document.body.innerText.includes('לפי חלקים') && document.body.innerText.includes('פרשיות') && document.body.innerText.includes('מועדים')") == "true")
        for (route in listOf("/maamorim", "/maamorim?melukat=true", "/all", "/hadranim/by_masechta",
            "/michtavim_klolim_new/by_moed", "/yomanim/by_year", "/search")) {
            load("https://www.mafteiach.app$route")
            assertFalse("Source collection is available: $route", js("document.body.innerText").contains("ERR_"))
        }
        load("https://www.mafteiach.app/likkutei_sichos/by_parsha")
        assertTrue(js("!!document.querySelector('.tab-button.active[data-key=\"by_parsha\"]')") == "true")
        load("https://www.mafteiach.app/likkutei_sichos/by_moad")
        assertTrue(js("!!document.querySelector('.tab-button.active[data-key=\"by_moad\"]')") == "true")
        load(MafteachLinks.HOME)
        assertEquals("Catalogue fills the available viewport", "true", js("document.querySelector('main').getBoundingClientRect().height > innerHeight * 0.7"))
        val painted = AtomicReference(false)
        compose.runOnIdle {
            web().postVisualStateCallback(1, object : WebView.VisualStateCallback() {
                override fun onComplete(requestId: Long) { painted.set(true) }
            })
        }
        compose.waitUntil(15_000) { painted.get() }
        InstrumentationRegistry.getInstrumentation().waitForIdleSync()
        val screenshot = AtomicReference<Bitmap>()
        compose.runOnIdle {
            val view = web()
            val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
            view.draw(android.graphics.Canvas(bitmap))
            screenshot.set(bitmap)
        }
        File(context.getExternalFilesDir(null), "mafteach-catalogue.png").outputStream().use {
            screenshot.get().compress(Bitmap.CompressFormat.PNG, 100, it)
        }
        js("document.querySelector('.parsha-button').click(); document.querySelector('.likkut-sicha-button').click(); true")
        val rect = JSONObject(js("""(function() {
          const link = Array.from(document.querySelectorAll('a.sicha')).find(a => a.innerText.trim() === 'מתורגם');
          link.scrollIntoView({block:'center'});
          const r=link.getBoundingClientRect();
          return {x:(r.left+r.width/2)*devicePixelRatio,y:(r.top+r.height/2)*devicePixelRatio};
        })();"""))
        compose.runOnIdle {
            val view = web(); val now = SystemClock.uptimeMillis()
            view.dispatchTouchEvent(MotionEvent.obtain(now, now, MotionEvent.ACTION_DOWN, rect.getDouble("x").toFloat(), rect.getDouble("y").toFloat(), 0))
            view.dispatchTouchEvent(MotionEvent.obtain(now, now + 80, MotionEvent.ACTION_UP, rect.getDouble("x").toFloat(), rect.getDouble("y").toFloat(), 0))
        }
        compose.waitUntil(15_000) { compose.onAllNodesWithText("פתיחה בקורא שלנו").fetchSemanticsNodes().isNotEmpty() }
        compose.onNodeWithText("PDF בעימוד המקורי").performClick()
        compose.onNodeWithText("פתיחה", substring = false).performClick()
        compose.waitUntil(60_000) { vm.state.value.currentBook != null || vm.state.value.errorMsg != null }
        assertNull(vm.state.value.errorMsg)
        val imported = vm.state.value.currentBook!!
        assertNotNull(imported.sourceUrl)
        assertEquals("לקוטי שיחות", imported.sourceCategory)
        assertTrue(imported.totalPages > 0)
        assertTrue(File(android.net.Uri.parse(imported.uriString).path!!).exists())
        compose.runOnIdle { vm.closeBook() }
        compose.waitUntil(15_000) { findWeb(compose.activity.window.decorView) != null }
        waitPage()
        assertTrue("Returning from reader preserves catalogue context", js("location.href").contains("likkutei_sichos"))
        // Opening the local copy uses no source request or download stage.
        compose.runOnIdle { vm.openBook(imported.id) }
        compose.waitUntil(15_000) { vm.state.value.currentBook != null }
        assertFalse(vm.state.value.downloading)
        assertEquals(imported.id, vm.state.value.currentBook!!.id)
        compose.runOnIdle {
            vm.closeBook()
            vm.importMafteachDocument(imported.sourceUrl!!, imported.title, imported.sourcePageUrl!!, true)
        }
        compose.waitUntil(45_000) { vm.state.value.sichaText != null || vm.state.value.ocrRequest != null || vm.state.value.errorMsg != null }
        assertNull(vm.state.value.errorMsg)
        if (vm.state.value.ocrRequest != null) {
            compose.onNodeWithText("להפעיל סריקת טקסט?").assertIsDisplayed()
            assertNull("OCR must wait for consent even for a remote document", vm.state.value.sichaText)
            compose.onNodeWithText("לא עכשיו").performClick()
        } else {
            assertTrue("Text reading contains actual Hebrew", vm.state.value.sichaText!!.blocks.any { block ->
                block.text.any { it in '\u0590'..'\u05ff' }
            })
        }
    }
}

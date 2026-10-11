package com.sterni.dailystudy.ui.screens.shulchanaruch

import androidx.activity.ComponentActivity
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.graphics.asAndroidBitmap
import androidx.compose.ui.test.*
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.test.platform.app.InstrumentationRegistry
import android.app.Application
import android.graphics.Bitmap
import com.sterni.dailystudy.ui.screens.pdflibrary.PdfStudyScreen
import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import java.io.File

class SahLibraryTest {
    @get:Rule val compose = createAndroidComposeRule<ComponentActivity>()

    @Test fun failedLocalInstallationIsRebuiltAndConcurrentOpensKeepContentIntact() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        var version=0
        SahRepository(context).use {repo ->repo.install();version=repo.manifest.getInt("version")}
        File(context.noBackupFilesDir,"sah/body-$version.sqlite").writeBytes(byteArrayOf(0,1,2))
        val pool=java.util.concurrent.Executors.newFixedThreadPool(2)
        try {
            val results=(1..2).map {pool.submit<Int> {
                SahRepository(context).use {repo ->repo.install();repo.segments("sah/oc/main/242").size}
            }}
            results.forEach {assertEquals(13,it.get(45,java.util.concurrent.TimeUnit.SECONDS))}
        } finally {pool.shutdownNow()}
    }

    @Test fun corpusInstallsLocallyAndSearchesHebrewWithAndWithoutVowels() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        SahRepository(context).use { repo ->
            repo.install()
            assertEquals(7201,repo.manifest.getInt("segments"))
            assertEquals(19,repo.segments("sah/talmud-torah/4").size)
            assertTrue(repo.groups().any {it.part=="יורה דעה"})
            assertTrue(repo.groups().any {it.part=="חושן משפט"})
            val plain=repo.search("שבת");val vocal=repo.search("שַׁבָּת")
            assertTrue(plain.isNotEmpty());assertEquals(plain.map {it.segment},vocal.map {it.segment})
            assertEquals(repo.search("תפילין").map {it.segment},repo.search("תפלין").map {it.segment})
            assertTrue(repo.search("242").any {it.chapter=="sah/oc/main/242"})
            val segments=repo.segments("sah/oc/main/242")
            assertEquals(13,segments.size)
            assertTrue(segments.first().text.contains("שַׁבָּת"))
            assertFalse(segments.any {it.html.contains("data-commentator") || it.html.contains("<sup") || it.html.contains("<img")})
            assertTrue(sahRichText(segments.first().html).spanStyles.isNotEmpty())
        }
        // Reopening a prepared book reuses the authenticated local database, without network.
        SahRepository(context).use {repo ->repo.install();assertEquals(13,repo.segments("sah/oc/main/242").size)}
    }

    @Test fun libraryReaderSearchBookmarksAndResumeWorkWithoutTheSourceWebsite() {
        val context=InstrumentationRegistry.getInstrumentation().targetContext
        context.getSharedPreferences("SahLibrary",0).edit().clear().commit()
        val vm=SahViewModel(context.applicationContext as Application)
        val direct=androidx.compose.runtime.mutableStateOf(false)
        compose.setContent { MaterialTheme { if(direct.value) SahScreen(onBack={},vm=vm) else PdfStudyScreen(onBack={}) } }
        compose.onNodeWithText("שולחן ערוך אדמו״ר הזקן").performClick()
        compose.waitUntil(30_000) {compose.onAllNodes(hasSetTextAction()).fetchSemanticsNodes().isNotEmpty()}
        // Then exercise the same native screen with an inspectable VM.
        compose.runOnIdle {direct.value=true}
        compose.waitUntil(30_000) {!vm.state.value.loading}
        assertNull(vm.state.value.error)
        compose.onNode(hasSetTextAction()).performTextInput("242")
        compose.waitUntil(15_000) {vm.state.value.hits.isNotEmpty() && !vm.state.value.searching}
        val hit=vm.state.value.hits.first {it.chapter=="sah/oc/main/242"}
        compose.onNodeWithText(hit.title).performClick()
        compose.waitUntil(15_000) {vm.state.value.chapter!=null && !vm.state.value.loading}
        assertEquals("sah/oc/main/242",vm.state.value.chapter!!.id)
        compose.onAllNodesWithContentDescription("הוספת סימנייה").onFirst().performClick()
        assertTrue(vm.state.value.segments.first().id in vm.state.value.bookmarks)
        compose.onNodeWithContentDescription("אפשרויות קריאה").performClick()
        val size=vm.state.value.fontSize
        compose.onNodeWithText("הגדלת טקסט").performClick()
        assertEquals((size+2).coerceAtMost(40),vm.state.value.fontSize)
        compose.onAllNodes(isRoot()).onFirst().captureToImage().asAndroidBitmap().let { image ->
            File(context.getExternalFilesDir(null),"shulchan-aruch-reader.png").outputStream().use {image.compress(Bitmap.CompressFormat.PNG,100,it)}
        }
        compose.onNode(hasScrollAction()).performScrollToIndex(5)
        compose.waitForIdle()
        val chapter=vm.state.value.chapter!!.id
        compose.runOnIdle {vm.back();vm.openChapter(chapter)}
        compose.waitUntil(15_000) {vm.state.value.chapter!=null && !vm.state.value.loading}
        assertTrue("Saved position after reopening",vm.state.value.index>=4)
        assertTrue(vm.state.value.segments.first().id in vm.state.value.bookmarks)
    }
}

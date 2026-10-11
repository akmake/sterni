package com.sterni.dailystudy.ui.screens.pdflibrary

import org.junit.Assert.*
import org.junit.Test

class MafteachLinksTest {
    private val id = "11FZ50P-0mNZksFO-Xj89uA7vIO76BFzm"

    @Test fun publicDriveLinksIdentifyTheSameFileAcrossSourceVariants() {
        val file = "https://drive.google.com/file/d/$id/view?usp=drivesdk"
        val open = "https://drive.google.com/open?id=$id"
        assertEquals(id, MafteachLinks.driveId(file))
        assertEquals(MafteachLinks.key(file), MafteachLinks.key(open))
        assertEquals("https://drive.google.com/uc?export=download&id=$id", MafteachLinks.downloadUrl(file))
    }

    @Test fun lookalikeHostsAndUnsupportedSchemesCannotBecomeNativeDownloads() {
        for (url in listOf("https://drive.google.com.evil.example/open?id=$id",
            "https://drive.google.com@evil.example/open?id=$id", "http://drive.google.com/open?id=$id",
            "file:///sdcard/test.pdf", "javascript:alert(1)", "https://mafteiach.app.evil.example/book.pdf")) {
            assertFalse(url, MafteachLinks.isDocument(url))
            assertNull(MafteachLinks.driveId(url))
        }
    }

    @Test fun allMainSourceCollectionsAreNamedForTheLocalReader() {
        assertEquals("לקוטי שיחות", MafteachLinks.category(MafteachLinks.HOME))
        assertEquals("מאמרים", MafteachLinks.category("https://www.mafteiach.app/maamorim?melukat=true"))
        assertEquals("הדרנים על הש״ס", MafteachLinks.category("https://www.mafteiach.app/hadranim/1"))
        assertEquals("מכתבים כלליים", MafteachLinks.category("https://www.mafteiach.app/michtavim_klolim_new/by_moed"))
        assertEquals("יומנים", MafteachLinks.category("https://www.mafteiach.app/yomanim/by_year"))
        assertEquals("שיחות ומאמרים", MafteachLinks.category("https://www.mafteiach.app/all"))
    }
}

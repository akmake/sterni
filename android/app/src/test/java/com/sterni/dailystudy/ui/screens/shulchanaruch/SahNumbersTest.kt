package com.sterni.dailystudy.ui.screens.shulchanaruch
import org.junit.Assert.*
import org.junit.Test

class SahNumbersTest {
    @Test fun numbersAndHebrewReferencesAreUnambiguous() {
        assertEquals("רמ״ב",SahNumbers.label(242))
        assertEquals("ט״ו",SahNumbers.label(15))
        assertEquals("ט״ז",SahNumbers.label(16))
        assertEquals(242,SahNumbers.directQuery("רמ״ב"))
        assertEquals(242,SahNumbers.directQuery("סימן רמב"))
        assertEquals(242,SahNumbers.directQuery("242"))
        assertNull(SahNumbers.directQuery("שבת"))
        assertNull(SahNumbers.directQuery("סימן xyz"))
    }
}

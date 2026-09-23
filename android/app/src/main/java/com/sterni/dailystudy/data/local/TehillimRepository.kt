package com.sterni.dailystudy.data.local

import android.content.Context
import com.google.gson.Gson
import com.kosherjava.zmanim.hebrewcalendar.JewishCalendar
import com.sterni.dailystudy.data.model.*
import java.io.InputStreamReader
import java.util.Calendar

class TehillimRepository(private val context: Context) {

    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    private val gson = Gson()

    private var cachedChapters: List<TehillimChapter>? = null

    init {
        loadChapters()
    }

    @Synchronized
    private fun loadChapters(): List<TehillimChapter> {
        cachedChapters?.let { return it }

        return try {
            context.assets.open("tehillim.json").use { inputStream ->
                InputStreamReader(inputStream, Charsets.UTF_8).use { reader ->
                    val data = gson.fromJson(reader, TehillimData::class.java)
                    cachedChapters = data.chapters
                    data.chapters
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
            emptyList()
        }
    }

    fun getAllChapters(): List<TehillimChapter> = loadChapters()

    fun getChapter(chapter: Int): TehillimChapter? {
        return loadChapters().find { it.chapter == chapter }
    }

    fun getChapters(chapterNumbers: List<Int>): List<TehillimChapter> {
        val all = loadChapters()
        val set = chapterNumbers.toSet()
        return all.filter { it.chapter in set }
    }

    fun getChaptersByDayOfMonth(day: Int): List<TehillimChapter> {
        val validDay = day.coerceIn(1, 30)
        return if (validDay == 25) {
            // Day 25: 119:1-96
            loadChapters().filter { it.dayOfMonth == 25 }
        } else if (validDay == 26) {
            // Day 26: 119:97-176
            loadChapters().filter { it.dayOfMonth == 25 } // Psalm 119
        } else {
            loadChapters().filter { it.dayOfMonth == validDay }
        }
    }

    fun getChaptersByDayOfWeek(dayOfWeek: Int): List<TehillimChapter> {
        val validDay = dayOfWeek.coerceIn(1, 7)
        return loadChapters().filter { it.dayOfWeek == validDay }
    }

    fun getChaptersByBook(book: Int): List<TehillimChapter> {
        val validBook = book.coerceIn(1, 5)
        return loadChapters().filter { it.book == validBook }
    }

    fun searchChapters(query: String): List<TehillimChapter> {
        val q = query.trim()
        if (q.isEmpty()) return getAllChapters()

        // Match numeric
        val num = q.toIntOrNull()
        if (num != null && num in 1..150) {
            return loadChapters().filter { it.chapter == num }
        }

        // Match Hebrew letter or title
        return loadChapters().filter { ch ->
            ch.hebrewChapter.contains(q, ignoreCase = true) ||
            ch.title.contains(q, ignoreCase = true) ||
            ch.verses.any { v -> v.text.contains(q) }
        }
    }

    // ── Reading Position ────────────────────────────────────────────────────────

    fun saveReadingPosition(chapter: Int, verse: Int = 1) {
        prefs.edit()
            .putInt(KEY_LAST_CHAPTER, chapter)
            .putInt(KEY_LAST_VERSE, verse)
            .putLong(KEY_LAST_TIME, System.currentTimeMillis())
            .apply()
    }

    fun getLastReadingPosition(): TehillimReadingPosition {
        val chapter = prefs.getInt(KEY_LAST_CHAPTER, 1)
        val verse = prefs.getInt(KEY_LAST_VERSE, 1)
        val timestamp = prefs.getLong(KEY_LAST_TIME, 0L)
        return TehillimReadingPosition(chapter, verse, timestamp)
    }

    // ── Bookmarks ───────────────────────────────────────────────────────────────

    fun isBookmarked(chapter: Int): Boolean {
        val set = prefs.getStringSet(KEY_BOOKMARKS, emptySet()) ?: emptySet()
        return set.contains(chapter.toString())
    }

    fun toggleBookmark(chapter: Int): Boolean {
        val set = (prefs.getStringSet(KEY_BOOKMARKS, emptySet()) ?: emptySet()).toMutableSet()
        val str = chapter.toString()
        val newState = if (set.contains(str)) {
            set.remove(str)
            false
        } else {
            set.add(str)
            true
        }
        prefs.edit().putStringSet(KEY_BOOKMARKS, set).apply()
        return newState
    }

    fun getBookmarkedChapters(): List<TehillimChapter> {
        val set = prefs.getStringSet(KEY_BOOKMARKS, emptySet()) ?: emptySet()
        val nums = set.mapNotNull { it.toIntOrNull() }
        return getChapters(nums)
    }

    // ── Helpers ─────────────────────────────────────────────────────────────────

    fun getTodayHebrewDayOfMonth(): Int {
        return try {
            val jc = JewishCalendar()
            jc.jewishDayOfMonth
        } catch (e: Exception) {
            1
        }
    }

    fun getTodayDayOfWeek(): Int {
        val cal = Calendar.getInstance()
        return cal.get(Calendar.DAY_OF_WEEK) // 1=Sunday ... 7=Saturday
    }

    fun getSpecialCollections(): List<SpecialCollection> = listOf(
        SpecialCollection(
            id = "tikkun_haklali",
            title = "תיקון הכללי",
            subtitle = "עשרה מזמורים מסוגלים שגילה רבי נחמן מברסלב",
            chapters = listOf(16, 32, 41, 42, 59, 77, 90, 105, 137, 150)
        ),
        SpecialCollection(
            id = "shir_hamaalot",
            title = "שירי המעלות",
            subtitle = "חמישה עשר מזמורי שיר המעלות (ק״כ–קל״ד)",
            chapters = (120..134).toList()
        ),
        SpecialCollection(
            id = "refuah",
            title = "תהילים לרפואה וישועה",
            subtitle = "מזמורים מיוחדים להחלמה, בריאות ורפואה שלמה",
            chapters = listOf(6, 13, 20, 30, 38, 41, 88, 102, 103, 121, 130)
        ),
        SpecialCollection(
            id = "parnassa",
            title = "תהילים לפרנסה והצלחה",
            subtitle = "מזמורי ביטחון, שפע והצלחה בכל מעשי ידיך",
            chapters = listOf(23, 112, 128, 144, 145)
        ),
        SpecialCollection(
            id = "protection",
            title = "מזמורי שמירה והגנה",
            subtitle = "שמירה מכל רע, שיר של פגעים וישועת ה׳",
            chapters = listOf(20, 27, 91, 118, 121)
        ),
        SpecialCollection(
            id = "shir_shel_pgaim",
            title = "שיר של פגעים",
            subtitle = "יושב בסתר עליון (מזמור צ״א)",
            chapters = listOf(91)
        ),
        SpecialCollection(
            id = "menorah",
            title = "למנצח בצורת המנורה",
            subtitle = "א-להים יחננו ויברכנו (מזמור ס״ז)",
            chapters = listOf(67)
        ),
        SpecialCollection(
            id = "hodaah",
            title = "מזמור לתודה",
            subtitle = "מזמור ק׳ – להודות ולהלל על הניסים והחסדים",
            chapters = listOf(100)
        )
    )

    companion object {
        private const val PREFS_NAME = "TehillimPrefs"
        private const val KEY_LAST_CHAPTER = "last_chapter"
        private const val KEY_LAST_VERSE = "last_verse"
        private const val KEY_LAST_TIME = "last_timestamp"
        private const val KEY_BOOKMARKS = "bookmarks"
    }
}

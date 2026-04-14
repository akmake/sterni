package com.sterni.dailystudy.omer

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

/**
 * Utility object: Omer day calculations, Hebrew date/time conversions, Zmanim lookups.
 * Based on Israeli timezone. Omer 5786 starts night of 12 April 2026 (15 Nisan).
 */
object OmerHelper {

    private const val DAY_MS = 86_400_000L
    private const val TZ_ID = "Asia/Jerusalem"
    private val TZ: TimeZone = TimeZone.getTimeZone(TZ_ID)

    // 15 Nisan 5786 = 12 April 2026.  Omer day 1 starts night of 12 Apr (counted 13 Apr).
    // We store the midnight epoch of the *first* day (13 Apr 2026 00:00 Israel).
    private val OMER_START_MILLIS: Long by lazy {
        val cal = Calendar.getInstance(TZ)
        cal.set(2026, Calendar.APRIL, 13, 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        cal.timeInMillis
    }

    private val HEBREW_NUMERALS = arrayOf(
        "", "א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳",
        "י״א", "י״ב", "י״ג", "י״ד", "ט״ו", "ט״ז", "י״ז", "י״ח", "י״ט", "כ׳",
        "כ״א", "כ״ב", "כ״ג", "כ״ד", "כ״ה", "כ״ו", "כ״ז", "כ״ח", "כ״ט", "ל׳",
        "ל״א", "ל״ב", "ל״ג", "ל״ד", "ל״ה", "ל״ו", "ל״ז", "ל״ח", "ל״ט", "מ׳",
        "מ״א", "מ״ב", "מ״ג", "מ״ד", "מ״ה", "מ״ו", "מ״ז", "מ״ח", "מ״ט"
    )

    // --- public API ---

    /** Omer day (1-49) for a given night (ISO date). Returns -1 if outside Omer period. */
    fun omerDayForNightDate(isoDate: String): Int {
        val midnight = parseDateMidnight(isoDate)
        val diff = midnight - OMER_START_MILLIS
        val day = (diff / DAY_MS).toInt() + 1
        return if (day in 1..49) day else -1
    }

    /** ISO date of the night when `day` starts counting (the calendar date following Tzeis). */
    fun nightDateForOmerDay(day: Int): String {
        val cal = Calendar.getInstance(TZ)
        cal.timeInMillis = OMER_START_MILLIS + (day - 1) * DAY_MS
        return isoDate(cal)
    }

    fun todayIsrael(): String {
        val cal = Calendar.getInstance(TZ)
        return isoDate(cal)
    }

    fun yesterdayIsrael(): String {
        val cal = Calendar.getInstance(TZ)
        cal.add(Calendar.DAY_OF_MONTH, -1)
        return isoDate(cal)
    }

    fun tomorrowIsrael(): String {
        val cal = Calendar.getInstance(TZ)
        cal.add(Calendar.DAY_OF_MONTH, 1)
        return isoDate(cal)
    }

    /**
     * The currently-active Omer day based on actual Tzeis/Shkiah times.
     * Returns 1-49 for a valid day, -1 if outside Omer, -2 if in twilight (between Shkiah and Tzeis).
     */
    fun activeOmerDay(ctx: Context): Int {
        val now = System.currentTimeMillis()
        val today = todayIsrael()
        val yesterday = yesterdayIsrael()

        val tzeisToday = getTzeisMillis(ctx, today)
        val shkiahToday = getShkiahMillis(ctx, today)

        // After Tzeis tonight → it's now the *next* day's Omer
        if (now >= tzeisToday) {
            val tomorrow = tomorrowIsrael()
            return omerDayForNightDate(tomorrow)
        }
        // Between Shkiah and Tzeis → twilight zone
        if (now >= shkiahToday) {
            return -2
        }
        // Daytime → still yesterday's Omer day
        return omerDayForNightDate(today)
    }

    /** Sunset millis for a given ISO date. Falls back to 19:00 if no zmanim data. */
    fun getShkiahMillis(ctx: Context, isoDate: String): Long {
        val time = lookupZmanTime(ctx, isoDate, "sunset", "shkia")
        return time ?: fallbackShkiahMillis(isoDate)
    }

    /** Tzeis millis for a given ISO date. Falls back to 20:00 if no zmanim data. */
    fun getTzeisMillis(ctx: Context, isoDate: String): Long {
        val time = lookupZmanTime(ctx, isoDate, "tzeit_hakochavim", "tzeis", "tzeit")
        return time ?: fallbackTzeisMillis(isoDate)
    }

    /** Hebrew numeral representation for 1-49. */
    fun hebrewNumeral(n: Int): String =
        if (n in 1..49) HEBREW_NUMERALS[n] else n.toString()

    /** Generates the full counting declaration text for a given day (1-49). */
    fun omerDeclarationText(day: Int): String {
        if (day !in 1..49) return ""
        val dayWord = dayHebrew(day)
        val weeks = day / 7
        val remaining = day % 7

        val sb = StringBuilder("הַיּוֹם ")
        sb.append(dayWord)
        if (day == 1) {
            sb.append(" לָעֹֽמֶר:")
        } else {
            sb.append(" יוֹם")
            if (day < 7) {
                sb.append(" לָעֹֽמֶר:")
            } else if (remaining == 0) {
                sb.append(" לָעֹֽמֶר, שֶׁהֵם ")
                sb.append(weekHebrew(weeks))
                sb.append(":")
            } else {
                sb.append(" לָעֹֽמֶר, שֶׁהֵם ")
                sb.append(weekHebrew(weeks))
                sb.append(" וְ")
                sb.append(dayHebrew(remaining))
                sb.append(" יוֹם:")
            }
        }
        return sb.toString()
    }

    fun isoDate(cal: Calendar): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        sdf.timeZone = TZ
        return sdf.format(cal.time)
    }

    /** Format Shkiah time as "HH:MM" for display. */
    fun formatShkiahTime(ctx: Context, isoDate: String): String {
        val millis = getShkiahMillis(ctx, isoDate)
        val sdf = SimpleDateFormat("HH:mm", Locale.US)
        sdf.timeZone = TZ
        return sdf.format(Date(millis))
    }

    // --- private helpers ---

    private fun dayHebrew(n: Int): String = when (n) {
        1 -> "יוֹם אֶחָד"; 2 -> "שְׁנֵי יָמִים"; 3 -> "שְׁלֹשָׁה יָמִים"
        4 -> "אַרְבָּעָה יָמִים"; 5 -> "חֲמִשָּׁה יָמִים"; 6 -> "שִׁשָּׁה יָמִים"
        7 -> "שִׁבְעָה יָמִים"; 8 -> "שְׁמוֹנָה יָמִים"; 9 -> "תִּשְׁעָה יָמִים"
        10 -> "עֲשָׂרָה יָמִים"; 11 -> "אַחַד עָשָׂר יוֹם"; 12 -> "שְׁנֵים עָשָׂר יוֹם"
        13 -> "שְׁלֹשָׁה עָשָׂר יוֹם"; 14 -> "אַרְבָּעָה עָשָׂר יוֹם"
        15 -> "חֲמִשָּׁה עָשָׂר יוֹם"; 16 -> "שִׁשָּׁה עָשָׂר יוֹם"
        17 -> "שִׁבְעָה עָשָׂר יוֹם"; 18 -> "שְׁמוֹנָה עָשָׂר יוֹם"
        19 -> "תִּשְׁעָה עָשָׂר יוֹם"; 20 -> "עֶשְׂרִים יוֹם"
        21 -> "אֶחָד וְעֶשְׂרִים יוֹם"; 22 -> "שְׁנַיִם וְעֶשְׂרִים יוֹם"
        23 -> "שְׁלֹשָׁה וְעֶשְׂרִים יוֹם"; 24 -> "אַרְבָּעָה וְעֶשְׂרִים יוֹם"
        25 -> "חֲמִשָּׁה וְעֶשְׂרִים יוֹם"; 26 -> "שִׁשָּׁה וְעֶשְׂרִים יוֹם"
        27 -> "שִׁבְעָה וְעֶשְׂרִים יוֹם"; 28 -> "שְׁמוֹנָה וְעֶשְׂרִים יוֹם"
        29 -> "תִּשְׁעָה וְעֶשְׂרִים יוֹם"; 30 -> "שְׁלֹשִׁים יוֹם"
        31 -> "אֶחָד וּשְׁלֹשִׁים יוֹם"; 32 -> "שְׁנַיִם וּשְׁלֹשִׁים יוֹם"
        33 -> "שְׁלֹשָׁה וּשְׁלֹשִׁים יוֹם"; 34 -> "אַרְבָּעָה וּשְׁלֹשִׁים יוֹם"
        35 -> "חֲמִשָּׁה וּשְׁלֹשִׁים יוֹם"; 36 -> "שִׁשָּׁה וּשְׁלֹשִׁים יוֹם"
        37 -> "שִׁבְעָה וּשְׁלֹשִׁים יוֹם"; 38 -> "שְׁמוֹנָה וּשְׁלֹשִׁים יוֹם"
        39 -> "תִּשְׁעָה וּשְׁלֹשִׁים יוֹם"; 40 -> "אַרְבָּעִים יוֹם"
        41 -> "אֶחָד וְאַרְבָּעִים יוֹם"; 42 -> "שְׁנַיִם וְאַרְבָּעִים יוֹם"
        43 -> "שְׁלֹשָׁה וְאַרְבָּעִים יוֹם"; 44 -> "אַרְבָּעָה וְאַרְבָּעִים יוֹם"
        45 -> "חֲמִשָּׁה וְאַרְבָּעִים יוֹם"; 46 -> "שִׁשָּׁה וְאַרְבָּעִים יוֹם"
        47 -> "שִׁבְעָה וְאַרְבָּעִים יוֹם"; 48 -> "שְׁמוֹנָה וְאַרְבָּעִים יוֹם"
        49 -> "תִּשְׁעָה וְאַרְבָּעִים יוֹם"
        else -> "$n יוֹם"
    }

    private fun weekHebrew(n: Int): String = when (n) {
        1 -> "שָׁבוּעַ אֶחָד"; 2 -> "שְׁנֵי שָׁבוּעוֹת"; 3 -> "שְׁלֹשָׁה שָׁבוּעוֹת"
        4 -> "אַרְבָּעָה שָׁבוּעוֹת"; 5 -> "חֲמִשָּׁה שָׁבוּעוֹת"
        6 -> "שִׁשָּׁה שָׁבוּעוֹת"; 7 -> "שִׁבְעָה שָׁבוּעוֹת"
        else -> "$n שָׁבוּעוֹת"
    }

    private fun parseDateMidnight(isoDate: String): Long {
        val parts = isoDate.split("-")
        val cal = Calendar.getInstance(TZ)
        cal.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(), 0, 0, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun fallbackTzeisMillis(isoDate: String): Long =
        timeStringToMillis(isoDate, "20:00")

    private fun fallbackShkiahMillis(isoDate: String): Long =
        timeStringToMillis(isoDate, "19:00")

    private fun timeStringToMillis(isoDate: String, time: String): Long {
        val parts = isoDate.split("-")
        val tp = time.split(":")
        val cal = Calendar.getInstance(TZ)
        cal.set(parts[0].toInt(), parts[1].toInt() - 1, parts[2].toInt(),
            tp[0].toInt(), tp[1].toInt(), 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    /**
     * Looks up a zman time from cached JSON files.
     * Cache files are at filesDir/zmanim_cache/city_*.json
     */
    private fun lookupZmanTime(ctx: Context, isoDate: String, vararg keys: String): Long? {
        val prefs = ctx.getSharedPreferences("ZmanimPrefs", Context.MODE_PRIVATE)
        val cityIds = intArrayOf(531, 247, 689, 688)
        val selectedCity = prefs.getInt("selected_city", 0)
        val cityId = cityIds.getOrElse(selectedCity) { 531 }

        val cacheDir = File(ctx.filesDir, "zmanim_cache")
        val cacheFile = File(cacheDir, "city_$cityId.json")
        if (!cacheFile.exists()) return null

        return try {
            val json = JSONObject(cacheFile.readText())
            val daysArray: JSONArray = json.optJSONArray("days") ?: return null
            for (i in 0 until daysArray.length()) {
                val dayObj = daysArray.getJSONObject(i)
                val date = dayObj.optString("date", "")
                if (date == isoDate) {
                    val times = dayObj.optJSONObject("times") ?: continue
                    for (key in keys) {
                        val timeStr = times.optString(key, "")
                        if (timeStr.isNotEmpty() && timeStr.contains(":")) {
                            return timeStringToMillis(isoDate, timeStr)
                        }
                    }
                }
            }
            null
        } catch (_: Exception) {
            null
        }
    }
}

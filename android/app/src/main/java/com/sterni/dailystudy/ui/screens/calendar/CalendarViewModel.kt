package com.sterni.dailystudy.ui.screens.calendar

import android.app.Application
import android.content.ContentUris
import android.database.Cursor
import android.provider.CalendarContract
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.kosherjava.zmanim.hebrewcalendar.JewishCalendar
import com.kosherjava.zmanim.hebrewcalendar.JewishDate
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Calendar

data class CalendarState(
    val year: Int = 0,
    val month: Int = 0,
    val hebrewYear: Int = 0,
    val hebrewMonth: Int = 0,
    val days: List<DayCell> = emptyList(),
    val startOffset: Int = 0,
    val monthLabel: String = "",
    val hebrewMonthLabel: String = "",
    val loading: Boolean = false,
    val calendars: List<CalendarInfo> = emptyList(),
    val hebrewMode: Boolean = false
)

data class CalendarInfo(
    val id: Long,
    val name: String,
    val color: Int,
    val accountName: String,
    val isEnabled: Boolean = false
)

data class CalEvent(
    val id: Long,
    val title: String,
    val color: Int,
    val startMinute: Int,
    val endMinute: Int,
    val isAllDay: Boolean,
    val calendarId: Long
)

data class DayCell(
    val day: Int,
    val dayOfWeek: Int,
    val hebrewLetters: String,
    val jewishDayOfMonth: Int,
    val isToday: Boolean,
    val isShabbat: Boolean,
    val isFriday: Boolean,
    val isYomTov: Boolean,
    val events: List<CalEvent> = emptyList(),
    val gregDay: Int = 0,
    val gregMonth: Int = 0,
    val gregYear: Int = 0
)

class CalendarViewModel(app: Application) : AndroidViewModel(app) {

    private val _state = MutableStateFlow(CalendarState())
    val state: StateFlow<CalendarState> = _state.asStateFlow()

    private val prefs = app.getSharedPreferences("cal_prefs", 0)

    companion object {
        val GREG_MONTHS = arrayOf(
            "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
            "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"
        )

        fun hebrewDay(day: Int): String {
            val u = listOf("", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט")
            return when {
                day == 15 -> "ט״ו"
                day == 16 -> "ט״ז"
                day in 1..9 -> "${u[day]}׳"
                day == 10 -> "י׳"
                day in 11..14 -> "י״${u[day - 10]}"
                day in 17..19 -> "י״${u[day - 10]}"
                day == 20 -> "כ׳"
                day in 21..29 -> "כ״${u[day - 20]}"
                day == 30 -> "ל׳"
                else -> "$day"
            }
        }
    }

    init {
        val today = Calendar.getInstance()
        val jcToday = JewishCalendar(today)
        _state.value = _state.value.copy(
            year        = today.get(Calendar.YEAR),
            month       = today.get(Calendar.MONTH),
            hebrewYear  = jcToday.jewishYear,
            hebrewMonth = jcToday.jewishMonth,
            hebrewMode  = prefs.getBoolean("hebrew_mode", false)
        )
    }

    fun onPermissionGranted() {
        viewModelScope.launch {
            val cals = loadCalendarsFromDevice()
            _state.value = _state.value.copy(calendars = cals)
            load()
        }
    }

    fun reloadEvents() { load() }
    fun prevMonth() { shiftMonth(-1) }
    fun nextMonth() { shiftMonth(1) }

    fun goToToday() {
        val t = Calendar.getInstance()
        val jct = JewishCalendar(t)
        _state.value = _state.value.copy(
            year        = t.get(Calendar.YEAR),
            month       = t.get(Calendar.MONTH),
            hebrewYear  = jct.jewishYear,
            hebrewMonth = jct.jewishMonth,
            loading     = true
        )
        load()
    }

    fun toggleHebrewMode() {
        val m = !_state.value.hebrewMode
        prefs.edit().putBoolean("hebrew_mode", m).apply()
        _state.value = _state.value.copy(hebrewMode = m)
        load()
    }

    fun toggleCalendar(id: Long) {
        val updated = _state.value.calendars.map {
            if (it.id == id) it.copy(isEnabled = !it.isEnabled) else it
        }
        prefs.edit().putStringSet(
            "enabled_cals",
            updated.filter { it.isEnabled }.map { it.id.toString() }.toSet()
        ).apply()
        _state.value = _state.value.copy(calendars = updated)
        load()
    }

    private fun shiftMonth(delta: Int) {
        if (_state.value.hebrewMode) {
            val jc = JewishDate()
            jc.setJewishDate(_state.value.hebrewYear, _state.value.hebrewMonth, 1)
            if (delta > 0) jc.forward(5, jc.daysInJewishMonth)
            else jc.back()
            _state.value = _state.value.copy(
                hebrewYear  = jc.jewishYear,
                hebrewMonth = jc.jewishMonth,
                loading     = true
            )
        } else {
            val cal = Calendar.getInstance()
            cal.set(_state.value.year, _state.value.month, 1)
            cal.add(Calendar.MONTH, delta)
            _state.value = _state.value.copy(
                year    = cal.get(Calendar.YEAR),
                month   = cal.get(Calendar.MONTH),
                loading = true
            )
        }
        load()
    }

    private fun load() {
        viewModelScope.launch {
            val snap = _state.value
            val enabledIds = snap.calendars.filter { it.isEnabled }.map { it.id }.toSet()
            val today = Calendar.getInstance()
            if (snap.hebrewMode) {
                loadHebrewMonth(snap.hebrewYear, snap.hebrewMonth, enabledIds, today)
            } else {
                loadGregMonth(snap.year, snap.month, enabledIds, today)
            }
        }
    }

    private suspend fun loadGregMonth(
        year: Int, month: Int,
        enabledIds: Set<Long>, today: Calendar
    ) {
        val cal = Calendar.getInstance().apply { set(year, month, 1) }
        val daysInMonth = cal.getActualMaximum(Calendar.DAY_OF_MONTH)
        val startDow    = cal.get(Calendar.DAY_OF_WEEK)
        val startOffset = startDow - 1

        val rangeStart = Calendar.getInstance().apply { set(year, month, 1, 0, 0, 0) }
        val rangeEnd   = Calendar.getInstance().apply { set(year, month, daysInMonth, 23, 59, 59) }
        val eventMap   = loadEventsForRange(rangeStart.timeInMillis, rangeEnd.timeInMillis, enabledIds)

        val todayYear  = today.get(Calendar.YEAR)
        val todayMonth = today.get(Calendar.MONTH)
        val todayDay   = today.get(Calendar.DAY_OF_MONTH)

        val cells = (1..daysInMonth).map { d ->
            cal.set(Calendar.DAY_OF_MONTH, d)
            val jc  = JewishCalendar(cal)
            val dow = cal.get(Calendar.DAY_OF_WEEK)
            val key = "${year}_${month}_$d"
            DayCell(
                day              = d,
                dayOfWeek        = dow,
                hebrewLetters    = hebrewDay(jc.jewishDayOfMonth),
                jewishDayOfMonth = jc.jewishDayOfMonth,
                isToday          = year == todayYear && month == todayMonth && d == todayDay,
                isShabbat        = dow == Calendar.SATURDAY,
                isFriday         = dow == Calendar.FRIDAY,
                isYomTov         = jc.isYomTov,
                events           = eventMap[key] ?: emptyList(),
                gregDay          = d,
                gregMonth        = month,
                gregYear         = year
            )
        }

        val hebrewLabel = hebrewMonthNameForGreg(year, month)
        _state.value = _state.value.copy(
            days             = cells,
            startOffset      = startOffset,
            monthLabel       = "${GREG_MONTHS[month]} $year",
            hebrewMonthLabel = hebrewLabel,
            loading          = false
        )
    }

    private suspend fun loadHebrewMonth(
        hebrewYear: Int, hebrewMonth: Int,
        enabledIds: Set<Long>, today: Calendar
    ) {
        val jd = JewishDate()
        jd.setJewishDate(hebrewYear, hebrewMonth, 1)
        val daysInMonth = jd.daysInJewishMonth

        val todayYear  = today.get(Calendar.YEAR)
        val todayMonth = today.get(Calendar.MONTH)
        val todayDay   = today.get(Calendar.DAY_OF_MONTH)

        val startJd = JewishDate().apply { setJewishDate(hebrewYear, hebrewMonth, 1) }
        val endJd   = JewishDate().apply { setJewishDate(hebrewYear, hebrewMonth, daysInMonth) }

        val startCal = Calendar.getInstance().apply {
            set(startJd.gregorianYear, startJd.gregorianMonth, startJd.gregorianDayOfMonth, 0, 0, 0)
        }
        val endCal = Calendar.getInstance().apply {
            set(endJd.gregorianYear, endJd.gregorianMonth, endJd.gregorianDayOfMonth, 23, 59, 59)
        }

        val eventMap = loadEventsForRange(startCal.timeInMillis, endCal.timeInMillis, enabledIds)

        val cells = (1..daysInMonth).map { d ->
            jd.setJewishDate(hebrewYear, hebrewMonth, d)
            val gCal = Calendar.getInstance().apply {
                set(jd.gregorianYear, jd.gregorianMonth, jd.gregorianDayOfMonth)
            }
            val dow    = gCal.get(Calendar.DAY_OF_WEEK)
            val gYear  = gCal.get(Calendar.YEAR)
            val gMonth = gCal.get(Calendar.MONTH)
            val gDay   = gCal.get(Calendar.DAY_OF_MONTH)
            val key    = "${gYear}_${gMonth}_$gDay"
            val jc     = JewishCalendar(gCal)
            DayCell(
                day              = d,
                dayOfWeek        = dow,
                hebrewLetters    = hebrewDay(d),
                jewishDayOfMonth = d,
                isToday          = gYear == todayYear && gMonth == todayMonth && gDay == todayDay,
                isShabbat        = dow == Calendar.SATURDAY,
                isFriday         = dow == Calendar.FRIDAY,
                isYomTov         = jc.isYomTov,
                events           = eventMap[key] ?: emptyList(),
                gregDay          = gDay,
                gregMonth        = gMonth,
                gregYear         = gYear
            )
        }

        val startDow    = cells.firstOrNull()?.dayOfWeek ?: Calendar.SUNDAY
        val startOffset = startDow - 1

        val hdf = com.kosherjava.zmanim.hebrewcalendar.HebrewDateFormatter().apply {
            isHebrewFormat = true
        }
        val hebrewMonthName = hdf.formatMonth(startJd)
        val hebrewYearFormatted = hdf.formatHebrewNumber(hebrewYear)

        // Build Gregorian month label from the range of Gregorian dates this Hebrew month spans
        val firstGreg = cells.firstOrNull()
        val lastGreg  = cells.lastOrNull()
        val gregLabel = if (firstGreg != null && lastGreg != null) {
            if (firstGreg.gregMonth == lastGreg.gregMonth) {
                "${GREG_MONTHS[firstGreg.gregMonth]} ${firstGreg.gregYear}"
            } else {
                "${GREG_MONTHS[firstGreg.gregMonth]}–${GREG_MONTHS[lastGreg.gregMonth]} ${lastGreg.gregYear}"
            }
        } else ""

        _state.value = _state.value.copy(
            days             = cells,
            startOffset      = startOffset,
            monthLabel       = gregLabel,
            hebrewMonthLabel = "$hebrewMonthName $hebrewYearFormatted",
            loading          = false
        )
    }

    private suspend fun loadEventsForRange(
        rangeStartMs: Long, rangeEndMs: Long, enabledIds: Set<Long>
    ): Map<String, List<CalEvent>> = withContext(Dispatchers.IO) {
        if (enabledIds.isEmpty()) return@withContext emptyMap()
        try {
            val builder = CalendarContract.Instances.CONTENT_URI.buildUpon()
            ContentUris.appendId(builder, rangeStartMs)
            ContentUris.appendId(builder, rangeEndMs)
            val proj = arrayOf(
                "event_id", "begin", "end", "title",
                "calendar_color", "eventColor", "allDay", "calendar_id"
            )
            val cursor: Cursor = getApplication<Application>().contentResolver.query(
                builder.build(), proj, null, null, "begin ASC"
            ) ?: return@withContext emptyMap()

            val result = mutableMapOf<String, MutableList<CalEvent>>()
            cursor.use { c ->
                val colId       = c.getColumnIndex("event_id")
                val colBegin    = c.getColumnIndex("begin")
                val colEnd      = c.getColumnIndex("end")
                val colTitle    = c.getColumnIndex("title")
                val colCalColor = c.getColumnIndex("calendar_color")
                val colEvColor  = c.getColumnIndex("eventColor")
                val colAllDay   = c.getColumnIndex("allDay")
                val colCalId    = c.getColumnIndex("calendar_id")

                while (c.moveToNext()) {
                    val calId  = c.getLong(colCalId)
                    if (calId !in enabledIds) continue
                    val title  = c.getString(colTitle) ?: continue
                    val begin  = c.getLong(colBegin)
                    val end    = c.getLong(colEnd)
                    val allDay = c.getInt(colAllDay) == 1
                    val evColor = (if (colEvColor >= 0) c.getInt(colEvColor).takeIf { it != 0 } else null)
                        ?: c.getInt(colCalColor)

                    val bCal = Calendar.getInstance().apply { timeInMillis = begin }
                    val key = "${bCal.get(Calendar.YEAR)}_${bCal.get(Calendar.MONTH)}_${bCal.get(Calendar.DAY_OF_MONTH)}"
                    val startMin = if (allDay) -1 else bCal.get(Calendar.HOUR_OF_DAY) * 60 + bCal.get(Calendar.MINUTE)
                    val eCal = Calendar.getInstance().apply { timeInMillis = end }
                    val endMin = if (allDay) -1 else eCal.get(Calendar.HOUR_OF_DAY) * 60 + eCal.get(Calendar.MINUTE)

                    result.getOrPut(key) { mutableListOf() }
                        .add(CalEvent(c.getLong(colId), title, evColor, startMin, endMin, allDay, calId))
                }
            }
            result
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private suspend fun loadCalendarsFromDevice(): List<CalendarInfo> = withContext(Dispatchers.IO) {
        try {
            val proj = arrayOf("_id", "calendar_displayName", "calendar_color", "account_name", "visible")
            val cursor: Cursor = getApplication<Application>().contentResolver.query(
                CalendarContract.Calendars.CONTENT_URI, proj, null, null, "account_name"
            ) ?: return@withContext emptyList()

            val saved  = prefs.getStringSet("enabled_cals", null)
            val result = mutableListOf<CalendarInfo>()
            cursor.use { c ->
                val colId      = c.getColumnIndex("_id")
                val colName    = c.getColumnIndex("calendar_displayName")
                val colColor   = c.getColumnIndex("calendar_color")
                val colAccount = c.getColumnIndex("account_name")
                val colVisible = c.getColumnIndex("visible")
                while (c.moveToNext()) {
                    val id = c.getLong(colId)
                    result.add(
                        CalendarInfo(
                            id          = id,
                            name        = c.getString(colName) ?: "",
                            color       = c.getInt(colColor),
                            accountName = c.getString(colAccount) ?: "",
                            isEnabled   = saved?.contains(id.toString()) ?: (c.getInt(colVisible) == 1)
                        )
                    )
                }
            }
            result
        } catch (_: SecurityException) {
            emptyList()
        }
    }

    private fun hebrewMonthNameForGreg(year: Int, month: Int): String {
        return try {
            val cal = Calendar.getInstance().apply { set(year, month, 15) }
            val jc  = JewishCalendar(cal)
            val hdf = com.kosherjava.zmanim.hebrewcalendar.HebrewDateFormatter().apply {
                isHebrewFormat = true
            }
            "${hdf.formatMonth(jc)} ${hdf.formatHebrewNumber(jc.jewishYear)}"
        } catch (_: Exception) { "" }
    }
}

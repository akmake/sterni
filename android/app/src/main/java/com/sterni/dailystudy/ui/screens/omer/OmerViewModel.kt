package com.sterni.dailystudy.ui.screens.omer

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import com.sterni.dailystudy.omer.OmerHelper
import com.sterni.dailystudy.omer.OmerScheduler
import com.sterni.dailystudy.omer.OmerTracker
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

private const val PREFS_NAME   = "omer_prefs"
private const val KEY_NOTIF    = "notifications_enabled"

data class OmerDayEntry(
    val day: Int,
    val hebNumeral: String,
    val week: Int,
    val dayOfWeek: Int,
    val counted: Boolean,
    val canMark: Boolean,
    val isActive: Boolean,
    val nightDate: String
)

data class OmerState(
    val days: List<OmerDayEntry> = emptyList(),
    val activeDay: Int = -1,
    val notificationsEnabled: Boolean = false
)

class OmerViewModel(application: Application) : AndroidViewModel(application) {

    private val _state = MutableStateFlow(OmerState())
    val state: StateFlow<OmerState> = _state.asStateFlow()

    init { load() }

    fun markDay(day: Int) {
        if (day !in 1 until 50) return
        val ctx = getApplication<Application>()
        OmerTracker.markCounted(ctx, day)
        load()
    }

    fun unmarkDay(day: Int) {
        if (day !in 1 until 50) return
        OmerTracker.unmarkCounted(getApplication(), day)
        load()
    }

    fun setNotificationsEnabled(enabled: Boolean) {
        val ctx = getApplication<Application>()
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putBoolean(KEY_NOTIF, enabled).apply()
        if (enabled) {
            OmerScheduler.scheduleIfNeeded(ctx)
        } else {
            OmerScheduler.cancelAll(ctx)
        }
        _state.value = _state.value.copy(notificationsEnabled = enabled)
    }

    fun refresh() { load() }

    private fun load() {
        val ctx = getApplication<Application>()
        val counted  = OmerTracker.getAllCounted(ctx)
        val activeDay = OmerHelper.activeOmerDay(ctx)
        val today    = OmerHelper.todayIsrael()
        val notifEnabled = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_NOTIF, false)

        val highestMarkableDay = when {
            activeDay in 1 until 50 -> activeDay
            activeDay == -2 -> OmerHelper.omerDayForNightDate(OmerHelper.yesterdayIsrael()).coerceAtLeast(0)
            activeDay == -1 -> if (today > OmerHelper.nightDateForOmerDay(49)) 49 else 0
            else -> 0
        }

        val days = (1..49).map { d ->
            OmerDayEntry(
                day         = d,
                hebNumeral  = OmerHelper.hebrewNumeral(d),
                week        = (d - 1) / 7 + 1,
                dayOfWeek   = (d - 1) % 7 + 1,
                counted     = d in counted,
                canMark     = d <= highestMarkableDay,
                isActive    = d == activeDay,
                nightDate   = OmerHelper.nightDateForOmerDay(d)
            )
        }
        _state.value = OmerState(days, activeDay, notifEnabled)
    }
}

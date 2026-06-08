package com.sterni.dailystudy.data.model

import java.time.LocalTime
import java.util.UUID

data class AppBlockSchedule(
    val id: String = UUID.randomUUID().toString(),
    val label: String = "",
    val startHour: Int = 22,
    val startMinute: Int = 0,
    val endHour: Int = 6,
    val endMinute: Int = 0,
    val blockedPackages: List<String> = emptyList(),
    val enabled: Boolean = true
) {
    fun isActiveNow(): Boolean {
        if (!enabled || blockedPackages.isEmpty()) return false
        val now   = LocalTime.now()
        val start = LocalTime.of(startHour, startMinute)
        val end   = LocalTime.of(endHour, endMinute)
        return if (start <= end) now >= start && now < end
               else             now >= start || now < end  // overnight
    }

    fun formattedRange(): String =
        "%02d:%02d – %02d:%02d".format(startHour, startMinute, endHour, endMinute)
}

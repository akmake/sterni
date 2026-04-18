package com.sterni.dailystudy.notification

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.database.Cursor
import android.provider.CalendarContract
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Calendar

object CalendarReminderManager {

    /**
     * Set a notification reminder for all events from today.
     * We will check the user's defined "minutes before" via SharedPrefs.
     */
    suspend fun scheduleTodayReminders(app: Application) = withContext(Dispatchers.IO) {
        val prefs = app.getSharedPreferences("cal_prefs", Context.MODE_PRIVATE)
        val enabledIds = prefs.getStringSet("enabled_cals", emptySet())?.mapNotNull { it.toLongOrNull() }?.toSet() ?: emptySet()
        val minutesBefore = prefs.getInt("reminder_minutes", 10) // default 10 minutes popup

        if (minutesBefore < 0 || enabledIds.isEmpty()) return@withContext

        val nowMs = System.currentTimeMillis()
        val endOfDay = Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 23); set(Calendar.MINUTE, 59); set(Calendar.SECOND, 59) }.timeInMillis

        try {
            val builder = CalendarContract.Instances.CONTENT_URI.buildUpon()
            ContentUris.appendId(builder, nowMs)
            ContentUris.appendId(builder, endOfDay)
            val proj = arrayOf("event_id", "begin", "title", "allDay", "calendar_id")

            val cursor: Cursor = app.contentResolver.query(
                builder.build(), proj, null, null, "begin ASC"
            ) ?: return@withContext

            val alarmManager = app.getSystemService(Context.ALARM_SERVICE) as AlarmManager

            while (cursor.moveToNext()) {
                val calId = cursor.getLong(4)
                val allDay = cursor.getInt(3) == 1
                val begin = cursor.getLong(1)

                val offset = if (allDay) java.util.TimeZone.getDefault().getOffset(begin).toLong() else 0L
                val actualStartTime = begin - offset

                if (!enabledIds.contains(calId) || allDay) continue // Skip all day for now or logic gets complex

                // calculate when to alert
                val triggerTime = actualStartTime - (minutesBefore * 60 * 1000)

                // if triggerTime is in the future, schedule an alarm
                if (triggerTime > System.currentTimeMillis()) {
                    val eventId = cursor.getLong(0)
                    val title = cursor.getString(2) ?: "(ללא כותרת)"
                    
                    val calObj = Calendar.getInstance().apply { timeInMillis = actualStartTime }
                    val timeString = String.format("%02d:%02d", calObj.get(Calendar.HOUR_OF_DAY), calObj.get(Calendar.MINUTE))

                    val intent = Intent(app, CalendarReminderReceiver::class.java).apply {
                        putExtra("event_title", title)
                        putExtra("event_time", timeString)
                        putExtra("minutes_before", minutesBefore)
                    }

                    val pendingIntent = PendingIntent.getBroadcast(
                        app,
                        eventId.hashCode(), // unique request code per event
                        intent,
                        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                    )

                    try {
                        alarmManager.setExactAndAllowWhileIdle(
                            AlarmManager.RTC_WAKEUP,
                            triggerTime,
                            pendingIntent
                        )
                    } catch (e: SecurityException) {
                        alarmManager.setExact(
                            AlarmManager.RTC_WAKEUP,
                            triggerTime,
                            pendingIntent
                        )
                    }
                }
            }
            cursor.close()
        } catch (_: Exception) { }
    }
}

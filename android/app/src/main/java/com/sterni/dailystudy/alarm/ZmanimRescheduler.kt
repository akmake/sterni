package com.sterni.dailystudy.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.google.gson.Gson
import com.sterni.dailystudy.zmanim.ChabadZmanimCalculator
import com.sterni.dailystudy.zmanim.ZmanimLocationRepository
import java.util.Calendar

object ZmanimRescheduler {

    private val LABEL_TO_TYPE = mapOf(
        "עלות השחר"       to "AlosHashachar",
        "משיכיר"          to "EarliestTefillin",
        "הנץ החמה"        to "NetzHachamah",
        "סוף זמן ק\"ש"   to "LatestShema",
        "סוף זמן תפילה"  to "LatestTefillah",
        "חצות היום"       to "Chatzos",
        "מנחה גדולה"     to "MinchahGedolah",
        "מנחה קטנה"      to "MinchahKetanah",
        "פלג המנחה"      to "PlagHaminchah",
        "הדלקת נרות"     to "CandleLighting",
        "שקיעת החמה"     to "Shkiah",
        "צאת הכוכבים"    to "Tzeis",
        "חצות הלילה"     to "ChatzosNight",
    )

    private val gson = Gson()

    fun rescheduleNext(context: Context, zmanLabel: String) {
        val prefs = context.getSharedPreferences("ZmanimAlarms", Context.MODE_PRIVATE)
        val configJson = prefs.getString("alarm_$zmanLabel", null) ?: return
        val config = try { gson.fromJson(configJson, AlarmConfig::class.java) } catch (_: Exception) { return }
        scheduleForDay(context, config, daysFromNow = 1)
    }

    fun rescheduleAll(context: Context) {
        val prefs = context.getSharedPreferences("ZmanimAlarms", Context.MODE_PRIVATE)
        prefs.all
            .filterKeys { it.startsWith("alarm_") }
            .forEach { (_, value) ->
                try {
                    val config = gson.fromJson(value as String, AlarmConfig::class.java) ?: return@forEach
                    if (!scheduleForDay(context, config, daysFromNow = 0)) {
                        scheduleForDay(context, config, daysFromNow = 1)
                    }
                } catch (_: Exception) {}
            }
    }

    private fun scheduleForDay(context: Context, config: AlarmConfig, daysFromNow: Int): Boolean {
        val type = LABEL_TO_TYPE[config.zmanLabel]

        val selectedId = ZmanimLocationRepository.getSelectedLocationId(context)
        val location = ZmanimLocationRepository.findLocationById(context, selectedId)

        val cal = Calendar.getInstance(location.getTimeZone()).apply {
            add(Calendar.DAY_OF_YEAR, daysFromNow)
        }
        val dateStr = "%04d-%02d-%02d".format(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )

        return try {
            val zmanim = ChabadZmanimCalculator.calculateZmanim(dateStr, location)
            val zman = zmanim.find { it.type == type || it.label == config.zmanLabel } ?: return false

            val zmanMillis = zman.timeMillis
            if (zmanMillis <= 0) return false

            val offsetMs = config.offsetMinutes * 60_000L
            val alarmMs  = if (config.isBefore) zmanMillis - offsetMs else zmanMillis + offsetMs
            if (alarmMs <= System.currentTimeMillis()) return false

            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) return false

            val intent = Intent(context, ZmanimAlarmReceiver::class.java).apply {
                putExtra(ZmanimAlarmReceiver.EXTRA_ZMAN_LABEL,   config.zmanLabel)
                putExtra(ZmanimAlarmReceiver.EXTRA_RING_COUNT,   config.ringCount)
                putExtra(ZmanimAlarmReceiver.EXTRA_RING_DURATION, config.ringDurationSeconds)
                putExtra(ZmanimAlarmReceiver.EXTRA_RINGTONE_URI, config.ringtoneUri)
            }
            val pi = PendingIntent.getBroadcast(
                context, config.zmanLabel.hashCode(), intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarmMs, pi)
            true
        } catch (_: Exception) {
            false
        }
    }
}

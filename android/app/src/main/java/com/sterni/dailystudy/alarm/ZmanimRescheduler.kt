package com.sterni.dailystudy.alarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import com.sterni.dailystudy.data.api.ZmanimDay
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.util.Calendar
import java.util.TimeZone

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

    private val CITY_LOCATION_IDS = listOf(531, 247, 689, 688)
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
        val type = LABEL_TO_TYPE[config.zmanLabel] ?: return false

        val cityPrefs  = context.getSharedPreferences("ZmanimPrefs", Context.MODE_PRIVATE)
        val cityIndex  = cityPrefs.getInt("selected_city", 0).coerceIn(0, CITY_LOCATION_IDS.lastIndex)
        val locationId = CITY_LOCATION_IDS[cityIndex]

        val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem")).apply {
            add(Calendar.DAY_OF_YEAR, daysFromNow)
        }
        val dateStr = "%04d-%02d-%02d".format(
            cal.get(Calendar.YEAR),
            cal.get(Calendar.MONTH) + 1,
            cal.get(Calendar.DAY_OF_MONTH)
        )

        val cacheFile = File(File(context.filesDir, "zmanim_cache"), "city_$locationId.json")
        if (!cacheFile.exists()) return false

        return try {
            val listType = object : TypeToken<List<ZmanimDay>>() {}.type
            val days: List<ZmanimDay> = gson.fromJson(cacheFile.readText(), listType) ?: return false
            val day = days.find { it.date == dateStr } ?: return false
            val dto = day.zmanim.find { it.type == type } ?: return false

            val zmanMillis = timeToMillis(dateStr, dto.time)
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
        } catch (_: Exception) { false }
    }

    private fun timeToMillis(isoDate: String, timeStr: String): Long {
        return try {
            val (y, m, d) = isoDate.split("-").map { it.toInt() }
            val parts = timeStr.split(":")
            Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem")).apply {
                set(y, m - 1, d, parts[0].toInt(), parts[1].toInt(), 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        } catch (_: Exception) { 0L }
    }
}

package com.sterni.dailystudy.omer

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.*

/**
 * Schedules nightly Omer reminder alarms & rescue alarm.
 *
 * NIGHT alarm  — fires at Tzeis each night during the Omer so the user gets a "count tonight" notification.
 * RESCUE alarm — fires at 23:55 as a last-chance reminder ("you haven't counted yet!").
 */
object OmerScheduler {

    const val CHANNEL_ID = "omer_reminder_channel"
    private const val NIGHT_REQUEST_CODE  = 7001
    private const val RESCUE_REQUEST_CODE = 7002

    fun createNotificationChannel(ctx: Context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "תזכורת ספירת העומר",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "תזכורת לספירת העומר בכל לילה"
            }
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    /**
     * Schedule the nightly Omer alarm for tonight's Tzeis.
     * @param tzeisMillis exact epoch millis of tonight's Tzeis HaKochavim
     */
    fun scheduleNightAlarm(ctx: Context, tzeisMillis: Long) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(ctx, OmerNightReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            ctx, NIGHT_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, tzeisMillis, pi)
    }

    /**
     * Schedule a rescue alarm at 23:55 tonight, in case they missed the main alarm.
     */
    fun scheduleRescueAlarm(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(ctx, OmerRescueReceiver::class.java)
        val pi = PendingIntent.getBroadcast(
            ctx, RESCUE_REQUEST_CODE, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem"))
        cal.set(Calendar.HOUR_OF_DAY, 23)
        cal.set(Calendar.MINUTE, 55)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)

        // If 23:55 already passed, schedule for tomorrow
        if (cal.timeInMillis <= System.currentTimeMillis()) {
            cal.add(Calendar.DAY_OF_MONTH, 1)
        }
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, pi)
    }

    fun cancelAll(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        val nightPi = PendingIntent.getBroadcast(
            ctx, NIGHT_REQUEST_CODE,
            Intent(ctx, OmerNightReceiver::class.java),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        nightPi?.let { am.cancel(it) }

        val rescuePi = PendingIntent.getBroadcast(
            ctx, RESCUE_REQUEST_CODE,
            Intent(ctx, OmerRescueReceiver::class.java),
            PendingIntent.FLAG_NO_CREATE or PendingIntent.FLAG_IMMUTABLE
        )
        rescuePi?.let { am.cancel(it) }
    }

    /**
     * Called at app start / boot: schedule tonight's alarms if we're in the Omer period.
     */
    fun scheduleIfNeeded(ctx: Context) {
        createNotificationChannel(ctx)
        val today = OmerHelper.todayIsrael()
        val day = OmerHelper.activeOmerDay(ctx)
        if (day in 1..49) {
            val tzeisMillis = OmerHelper.getTzeisMillis(ctx, today)
            if (tzeisMillis > System.currentTimeMillis()) {
                scheduleNightAlarm(ctx, tzeisMillis)
            }
            scheduleRescueAlarm(ctx)
        }
    }
}

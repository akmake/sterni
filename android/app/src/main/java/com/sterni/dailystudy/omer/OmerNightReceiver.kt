package com.sterni.dailystudy.omer

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.sterni.dailystudy.R

/**
 * Fires at Tzeis HaKochavim each night during the Omer.
 * Shows a notification reminding the user to count.
 */
class OmerNightReceiver : BroadcastReceiver() {

    companion object {
        private const val NOTIFICATION_ID = 7701
    }

    override fun onReceive(ctx: Context, intent: Intent?) {
        val day = OmerHelper.activeOmerDay(ctx)
        if (day !in 1..49) return
        if (OmerTracker.isCounted(ctx, day)) return      // already counted

        val hebrewDay = OmerHelper.hebrewNumeral(day)
        val nusach = OmerNusach.getDayNusach(day)

        val title = "ספירת העומר — יום $hebrewDay"
        val body = nusach?.sefirah ?: "הגיע הזמן לספור!"

        // Tapping the notification = mark as counted
        val markIntent = Intent(ctx, OmerMarkReceiver::class.java).apply {
            putExtra("omer_day", day)
        }
        val markPi = PendingIntent.getBroadcast(
            ctx, day + 8000, markIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(ctx, OmerScheduler.CHANNEL_ID)
            .setSmallIcon(R.drawable.app_logo)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(0, "ספרתי ✓", markPi)
            .build()

        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)

        // Schedule tomorrow's alarm
        val tomorrow = OmerHelper.tomorrowIsrael()
        val tomorrowDay = OmerHelper.omerDayForNightDate(tomorrow)
        if (tomorrowDay in 1..49) {
            val tzeisMillis = OmerHelper.getTzeisMillis(ctx, OmerHelper.todayIsrael())
            if (tzeisMillis > System.currentTimeMillis()) {
                OmerScheduler.scheduleNightAlarm(ctx, tzeisMillis)
            }
        }
        OmerScheduler.scheduleRescueAlarm(ctx)
    }
}

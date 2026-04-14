package com.sterni.dailystudy.omer

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.sterni.dailystudy.R

/**
 * Rescue alarm — fires at 23:55 if the user hasn't counted yet.
 * Last-chance reminder before midnight.
 */
class OmerRescueReceiver : BroadcastReceiver() {

    companion object {
        private const val NOTIFICATION_ID = 7702
    }

    override fun onReceive(ctx: Context, intent: Intent?) {
        val day = OmerHelper.activeOmerDay(ctx)
        if (day !in 1..49) return
        if (OmerTracker.isCounted(ctx, day)) return

        val hebrewDay = OmerHelper.hebrewNumeral(day)

        val markIntent = Intent(ctx, OmerMarkReceiver::class.java).apply {
            putExtra("omer_day", day)
        }
        val markPi = PendingIntent.getBroadcast(
            ctx, day + 9000, markIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(ctx, OmerScheduler.CHANNEL_ID)
            .setSmallIcon(R.drawable.app_logo)
            .setContentTitle("⚠️ עוד לא ספרת היום!")
            .setContentText("יום $hebrewDay — עוד מעט חצות!")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .addAction(0, "ספרתי ✓", markPi)
            .build()

        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }
}

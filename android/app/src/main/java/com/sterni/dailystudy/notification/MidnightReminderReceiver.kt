package com.sterni.dailystudy.notification

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.sterni.dailystudy.MainActivity
import com.sterni.dailystudy.R
import com.sterni.dailystudy.tracker.StudyTracker
import java.util.*

class MidnightReminderReceiver : BroadcastReceiver() {

    companion object {
        const val CHANNEL_ID = "midnight_reminder_channel"
        const val NOTIFICATION_ID = 9002
        private const val REQUEST_CODE = 9055
        private const val PREFS = "MidnightReminderPrefs"
        private const val KEY_ENABLED = "midnight_enabled"

        fun isEnabled(ctx: Context): Boolean =
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

        fun setEnabled(ctx: Context, enabled: Boolean) {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean(KEY_ENABLED, enabled).apply()
            if (enabled) schedule(ctx) else cancel(ctx)
        }

        fun schedule(ctx: Context) {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val cal = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem")).apply {
                set(Calendar.HOUR_OF_DAY, 23)
                set(Calendar.MINUTE, 55)
                set(Calendar.SECOND, 0)
                set(Calendar.MILLISECOND, 0)
                if (timeInMillis <= System.currentTimeMillis()) {
                    add(Calendar.DAY_OF_YEAR, 1)
                }
            }
            val intent = Intent(ctx, MidnightReminderReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                ctx, REQUEST_CODE, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
            )
            am.setInexactRepeating(
                AlarmManager.RTC_WAKEUP,
                cal.timeInMillis,
                AlarmManager.INTERVAL_DAY,
                pi
            )
        }

        fun cancel(ctx: Context) {
            val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(ctx, MidnightReminderReceiver::class.java)
            val pi = PendingIntent.getBroadcast(
                ctx, REQUEST_CODE, intent,
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE
            )
            pi?.let { am.cancel(it); it.cancel() }
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIFICATION_ID)
        }

        fun createChannel(ctx: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID, "תזכורת לימודים", NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "תזכורת לפני חצות על לימודים שלא הושלמו"
                }
                (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                    .createNotificationChannel(channel)
            }
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        val uncompleted = StudyTracker.getUncompleted(context)
        if (uncompleted.isEmpty()) return

        createChannel(context)
        val labels = uncompleted.mapNotNull { StudyTracker.STUDY_LABELS[it] }
        val text = "נשארו: ${labels.joinToString(", ")}"

        val openIntent = Intent(context, MainActivity::class.java)
        val pi = PendingIntent.getActivity(
            context, 0, openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = androidx.core.app.NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.app_logo)
            .setContentTitle("לא סיימת את כל הלימודים היום!")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()

        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }
}

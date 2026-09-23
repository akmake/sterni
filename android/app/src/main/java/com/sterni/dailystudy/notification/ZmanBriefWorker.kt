package com.sterni.dailystudy.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.sterni.dailystudy.MainActivity
import com.sterni.dailystudy.R
import com.sterni.dailystudy.data.api.ZmanimDay
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.io.File
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class ZmanBriefWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    companion object {
        const val CHANNEL_ID = "zman_brief_channel_v2"
        const val NOTIFICATION_ID = 9001
        private const val WORK_NAME = "ZmanBriefWorker"
        private const val PREFS = "ZmanBriefPrefs"
        private const val KEY_ENABLED = "brief_enabled"

        fun enqueue(ctx: Context) {
            val request = PeriodicWorkRequestBuilder<ZmanBriefWorker>(30, TimeUnit.MINUTES)
                .setInitialDelay(0, TimeUnit.SECONDS)
                .build()
            WorkManager.getInstance(ctx).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }

        fun cancel(ctx: Context) {
            WorkManager.getInstance(ctx).cancelUniqueWork(WORK_NAME)
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.cancel(NOTIFICATION_ID)
        }

        fun isEnabled(ctx: Context): Boolean =
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false)

        fun setEnabled(ctx: Context, enabled: Boolean) {
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean(KEY_ENABLED, enabled).apply()
            if (enabled) {
                enqueue(ctx)
                val oneTime = OneTimeWorkRequestBuilder<ZmanBriefWorker>().build()
                WorkManager.getInstance(ctx).enqueue(oneTime)
            } else {
                cancel(ctx)
            }
        }

        fun createChannel(ctx: Context) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    CHANNEL_ID, "הזמן הבא (Brief)", NotificationManager.IMPORTANCE_DEFAULT
                ).apply {
                    description = "מציג את הזמן ההלכתי הקרוב"
                    setShowBadge(false)
                    setSound(null, null)
                    enableVibration(false)
                }
                (ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
                    .createNotificationChannel(channel)
            }
        }
    }

    override fun doWork(): Result {
        createChannel(applicationContext)
        val nextZman = findNextZman(applicationContext)
        if (nextZman != null) {
            showNotification(applicationContext, nextZman.first, nextZman.second)
        }
        return Result.success()
    }

    private fun showNotification(ctx: Context, label: String, time: String) {
        val openIntent = Intent(ctx, MainActivity::class.java)
        val pi = PendingIntent.getActivity(
            ctx, 0, openIntent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notification = NotificationCompat.Builder(ctx, CHANNEL_ID)
            .setSmallIcon(R.drawable.app_logo)
            .setContentTitle("הזמן הבא: $label")
            .setContentText(time)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pi)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .build()
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIFICATION_ID, notification)
    }

    private fun findNextZman(ctx: Context): Pair<String, String>? {
        val now = System.currentTimeMillis()
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val today = sdf.format(Date())

        val selectedId = com.sterni.dailystudy.zmanim.ZmanimLocationRepository.getSelectedLocationId(ctx)
        val location = com.sterni.dailystudy.zmanim.ZmanimLocationRepository.findLocationById(ctx, selectedId)

        return try {
            val zmanim = com.sterni.dailystudy.zmanim.ChabadZmanimCalculator.calculateZmanim(today, location)
            for (zman in zmanim) {
                if (zman.timeMillis > now) {
                    return zman.label to zman.time
                }
            }
            null
        } catch (_: Exception) { null }
    }
}

package com.sterni.dailystudy.notification

import android.app.Application
import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

class CalendarReminderWorker(
    appContext: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        CalendarReminderManager.scheduleTodayReminders(applicationContext as Application)
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "calendar_reminder_sync"

        fun enqueuePeriodic(context: Context) {
            val request = PeriodicWorkRequestBuilder<CalendarReminderWorker>(
                4, TimeUnit.HOURS // Sync events every 4 hours to fetch newly added events
            ).build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                request
            )
        }
    }
}

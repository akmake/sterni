package com.sterni.dailystudy.sync

import android.content.Context
import androidx.work.*
import java.util.concurrent.TimeUnit

class UserSyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        UserManager.ensureRegistered(applicationContext)
        UserManager.pushToServer(applicationContext)
        return Result.success()
    }

    companion object {
        private const val WORK_NAME = "UserSyncWork"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<UserSyncWorker>(1, TimeUnit.HOURS)
                .setConstraints(constraints)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }
    }
}

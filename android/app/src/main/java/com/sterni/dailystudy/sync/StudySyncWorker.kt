package com.sterni.dailystudy.sync

import android.content.Context
import android.util.Log
import androidx.work.*
import com.sterni.dailystudy.cache.StudyCache
import com.sterni.dailystudy.data.api.ApiService
import dagger.hilt.android.qualifiers.ApplicationContext
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit
import javax.inject.Inject

class StudySyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val ctx = applicationContext
        val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        val calendar = Calendar.getInstance()
        var successCount = 0
        val total = 30

        // We need to use the ApiService — get it from the Hilt module indirectly via Retrofit
        val retrofit = try {
            retrofit2.Retrofit.Builder()
                .baseUrl("https://dahanswebsite.com/api/")
                .addConverterFactory(retrofit2.converter.gson.GsonConverterFactory.create())
                .build()
        } catch (_: Exception) { return Result.retry() }

        val apiService = retrofit.create(ApiService::class.java)

        for (i in 0 until total) {
            val dateStr = sdf.format(calendar.time)
            if (StudyCache.get(ctx, dateStr) == null) {
                try {
                    val response = apiService.getDailyStudy(dateStr)
                    val day = if (response.isSuccessful) response.body() else null
                    if (day != null) StudyCache.save(ctx, dateStr, day)
                    successCount++
                    Log.d("StudySyncWorker", "Downloaded $dateStr")
                } catch (e: Exception) {
                    Log.w("StudySyncWorker", "Failed for $dateStr: ${e.message}")
                }
            } else {
                successCount++
            }
            calendar.add(Calendar.DAY_OF_YEAR, 1)
        }

        return if (successCount >= total) Result.success() else Result.retry()
    }

    companion object {
        private const val WORK_NAME = "StudySyncWork"

        fun enqueue(context: Context) {
            val constraints = Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
            val request = PeriodicWorkRequestBuilder<StudySyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(constraints)
                .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 6, TimeUnit.MINUTES)
                .build()
            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                WORK_NAME, ExistingPeriodicWorkPolicy.KEEP, request
            )
        }
    }
}

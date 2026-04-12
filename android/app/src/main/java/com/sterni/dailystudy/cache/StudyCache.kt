package com.sterni.dailystudy.cache

import android.content.Context
import com.google.gson.Gson
import com.sterni.dailystudy.data.model.StudyDay
import java.io.File

object StudyCache {
    private val gson = Gson()

    fun save(context: Context, date: String, day: StudyDay) {
        try { File(context.filesDir, "study_$date.json").writeText(gson.toJson(day)) }
        catch (_: Exception) {}
    }

    fun get(context: Context, date: String): StudyDay? = try {
        val f = File(context.filesDir, "study_$date.json")
        if (f.exists()) gson.fromJson(f.readText(), StudyDay::class.java) else null
    } catch (_: Exception) { null }

    fun clearAll(context: Context): Int =
        context.filesDir.listFiles()
            ?.filter { it.name.startsWith("study_") && it.name.endsWith(".json") }
            ?.count { it.delete() } ?: 0

    fun cachedCount(context: Context): Int =
        context.filesDir.listFiles()
            ?.count { it.name.startsWith("study_") && it.name.endsWith(".json") } ?: 0
}

package com.sterni.dailystudy.data.local

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.sterni.dailystudy.data.model.AppBlockSchedule

object AppBlockerPrefs {
    private const val PREFS    = "app_blocker_prefs"
    private const val KEY      = "schedules"
    private val gson           = Gson()

    fun getSchedules(context: Context): List<AppBlockSchedule> {
        val json = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, null) ?: return emptyList()
        return try {
            gson.fromJson(json, object : TypeToken<List<AppBlockSchedule>>() {}.type)
                ?: emptyList()
        } catch (e: Exception) { emptyList() }
    }

    fun saveSchedules(context: Context, schedules: List<AppBlockSchedule>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY, gson.toJson(schedules)).apply()
    }
}

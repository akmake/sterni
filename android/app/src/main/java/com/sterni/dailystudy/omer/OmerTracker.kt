package com.sterni.dailystudy.omer

import android.content.Context

/**
 * SharedPreferences-based tracker for which Omer days have been counted.
 *
 * Prefs file: "OmerTracker"
 * Keys: "counted_1" … "counted_49"  (value = timestamp when marked)
 */
object OmerTracker {

    private const val PREFS_NAME = "OmerTracker"

    fun isCounted(ctx: Context, day: Int): Boolean {
        if (day !in 1..49) return false
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong("counted_$day", 0L) > 0L
    }

    fun getCountedAt(ctx: Context, day: Int): Long {
        if (day !in 1..49) return 0L
        return ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong("counted_$day", 0L)
    }

    fun markCounted(ctx: Context, day: Int) {
        if (day !in 1..49) return
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putLong("counted_$day", System.currentTimeMillis()).apply()
    }

    fun unmarkCounted(ctx: Context, day: Int) {
        if (day !in 1..49) return
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove("counted_$day").apply()
    }

    fun getAllCounted(ctx: Context): Set<Int> {
        val prefs = ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val result = mutableSetOf<Int>()
        for (d in 1..49) {
            if (prefs.getLong("counted_$d", 0L) > 0L) result.add(d)
        }
        return result
    }
}

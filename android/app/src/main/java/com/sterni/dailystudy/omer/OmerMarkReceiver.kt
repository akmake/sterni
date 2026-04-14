package com.sterni.dailystudy.omer

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Triggered when the user taps "ספרתי ✓" on the Omer notification.
 * Marks the day as counted and dismisses the notification.
 */
class OmerMarkReceiver : BroadcastReceiver() {

    override fun onReceive(ctx: Context, intent: Intent?) {
        val day = intent?.getIntExtra("omer_day", -1) ?: -1
        if (day !in 1..49) return

        OmerTracker.markCounted(ctx, day)

        // Dismiss all Omer notifications
        val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.cancel(7701) // night notification
        nm.cancel(7702) // rescue notification
    }
}

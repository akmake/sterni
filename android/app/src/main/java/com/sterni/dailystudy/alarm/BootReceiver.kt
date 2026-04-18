package com.sterni.dailystudy.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

import com.sterni.dailystudy.notification.CalendarReminderWorker

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {
            ZmanimRescheduler.rescheduleAll(context)
            CalendarReminderWorker.enqueuePeriodic(context)
        }
    }
}

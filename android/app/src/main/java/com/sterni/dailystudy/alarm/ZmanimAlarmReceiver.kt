package com.sterni.dailystudy.alarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class ZmanimAlarmReceiver : BroadcastReceiver() {

    companion object {
        const val EXTRA_ZMAN_LABEL    = "zman_label"
        const val EXTRA_RING_COUNT    = "ring_count"
        const val EXTRA_RING_DURATION = "ring_duration"
        const val EXTRA_RINGTONE_URI  = "ringtone_uri"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val zmanLabel    = intent.getStringExtra(EXTRA_ZMAN_LABEL) ?: ""
        val ringCount    = intent.getIntExtra(EXTRA_RING_COUNT, 3)
        val ringDuration = intent.getIntExtra(EXTRA_RING_DURATION, 20)
        val ringtoneUri  = intent.getStringExtra(EXTRA_RINGTONE_URI) ?: ""

        val serviceIntent = Intent(context, ZmanimAlarmService::class.java).apply {
            putExtra(ZmanimAlarmService.EXTRA_ZMAN_LABEL,    zmanLabel)
            putExtra(ZmanimAlarmService.EXTRA_RING_COUNT,     ringCount)
            putExtra(ZmanimAlarmService.EXTRA_RING_DURATION,  ringDuration)
            putExtra(ZmanimAlarmService.EXTRA_RINGTONE_URI,   ringtoneUri)
        }
        context.startForegroundService(serviceIntent)

        if (zmanLabel.isNotEmpty()) {
            ZmanimRescheduler.rescheduleNext(context, zmanLabel)
        }
    }
}

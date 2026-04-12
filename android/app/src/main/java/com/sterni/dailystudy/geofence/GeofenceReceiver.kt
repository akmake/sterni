package com.sterni.dailystudy.geofence

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import com.sterni.dailystudy.R
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingEvent

class GeofenceReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val event = GeofencingEvent.fromIntent(intent) ?: return
        if (event.hasError()) {
            Log.e("GeofenceReceiver", "Geofencing event error code: ${event.errorCode}")
            return
        }
        val transition = event.geofenceTransition
        Log.d("GeofenceReceiver", "Transition detected: $transition")
        runMuteLogic(context, transition)
    }

    companion object {
        private const val GEOFENCE_NOTIFICATION_ID = 8500

        fun runMuteLogic(context: Context, transition: Int) {
            val audio = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            val message: String
            when (transition) {
                Geofence.GEOFENCE_TRANSITION_ENTER, Geofence.GEOFENCE_TRANSITION_DWELL -> {
                    try {
                        if (nm.isNotificationPolicyAccessGranted) {
                            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE)
                        }
                        audio.ringerMode = AudioManager.RINGER_MODE_SILENT
                    } catch (e: Exception) {
                        try { audio.ringerMode = AudioManager.RINGER_MODE_VIBRATE } catch (_: Exception) {}
                        Log.e("GeofenceReceiver", "Failed to set silent", e)
                    }
                    message = "הטלפון הושתק אוטומטית (אזור שקט)"
                }
                Geofence.GEOFENCE_TRANSITION_EXIT -> {
                    try {
                        if (nm.isNotificationPolicyAccessGranted) {
                            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
                        }
                        audio.ringerMode = AudioManager.RINGER_MODE_NORMAL
                    } catch (e: Exception) {
                        Log.e("GeofenceReceiver", "Failed to restore sound", e)
                    }
                    message = "יצאת מהאזור - חזר למצב רגיל"
                }
                else -> return
            }
            sendNotification(context, message)
        }

        private fun sendNotification(context: Context, message: String) {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val channelId = "geofence_channel"

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(channelId, "אזורי שקט", NotificationManager.IMPORTANCE_HIGH)
                nm.createNotificationChannel(channel)
            }

            val notification = NotificationCompat.Builder(context, channelId)
                .setSmallIcon(R.drawable.app_logo)
                .setContentTitle("אזורי שקט - הפעלה!")
                .setContentText(message)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            nm.notify(GEOFENCE_NOTIFICATION_ID, notification)
        }
    }
}

package com.sterni.dailystudy.alarm

import android.app.*
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.sterni.dailystudy.MainActivity
import com.sterni.dailystudy.R

class ZmanimAlarmService : Service() {

    companion object {
        const val CHANNEL_ID = "zmanim_alarm_channel"
        const val EXTRA_RING_COUNT = "ring_count"
        const val EXTRA_RING_DURATION = "ring_duration"
        const val EXTRA_RINGTONE_URI = "ringtone_uri"
        const val EXTRA_ZMAN_LABEL = "zman_label"
        const val ACTION_STOP_ALARM = "com.sterni.dailystudy.STOP_ALARM"
        private const val NOTIF_ID = 7777
    }

    private var mediaPlayer: MediaPlayer? = null
    private var ringCount = 3
    private var ringDurationMs = 20_000L
    private var currentRing = 0
    private var ringtoneUri: Uri? = null
    private var audioManager: AudioManager? = null
    private var previousVolume = -1
    private var stopReceiver: BroadcastReceiver? = null
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    override fun onCreate() {
        super.onCreate()
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP_ALARM) {
            stopAlarm()
            return START_NOT_STICKY
        }

        val zmanLabel = intent?.getStringExtra(EXTRA_ZMAN_LABEL) ?: "זמן הלכתי"
        ringCount = intent?.getIntExtra(EXTRA_RING_COUNT, 3) ?: 3
        ringDurationMs = (intent?.getIntExtra(EXTRA_RING_DURATION, 20) ?: 20) * 1000L
        val ringtoneUriStr = intent?.getStringExtra(EXTRA_RINGTONE_URI) ?: ""
        ringtoneUri = if (ringtoneUriStr.isNotEmpty()) {
            Uri.parse(ringtoneUriStr)
        } else {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        }

        createNotificationChannel()
        startForeground(NOTIF_ID, buildNotification(zmanLabel))
        registerStopReceiver()
        setAlarmVolume()
        currentRing = 0
        playRing()

        return START_NOT_STICKY
    }

    private fun setAlarmVolume() {
        val stream = AudioManager.STREAM_ALARM
        val maxVol = audioManager?.getStreamMaxVolume(stream) ?: 7
        previousVolume = audioManager?.getStreamVolume(stream) ?: maxVol
        audioManager?.setStreamVolume(stream, maxVol, 0)
    }

    private fun playRing() {
        handler.removeCallbacksAndMessages(null)
        try {
            mediaPlayer?.release()
            mediaPlayer = MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                )
                setDataSource(this@ZmanimAlarmService, ringtoneUri!!)
                isLooping = true
                prepare()
                start()
            }
            handler.postDelayed({
                mediaPlayer?.stop()
                mediaPlayer?.release()
                mediaPlayer = null
                currentRing++
                if (currentRing < ringCount) playRing() else stopAlarm()
            }, ringDurationMs)
        } catch (e: Exception) {
            stopAlarm()
        }
    }

    private fun stopAlarm() {
        handler.removeCallbacksAndMessages(null)
        mediaPlayer?.stop()
        mediaPlayer?.release()
        mediaPlayer = null
        if (previousVolume >= 0) {
            audioManager?.setStreamVolume(AudioManager.STREAM_ALARM, previousVolume, 0)
            previousVolume = -1
        }
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private fun registerStopReceiver() {
        stopReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) = stopAlarm()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(stopReceiver, IntentFilter(ACTION_STOP_ALARM), RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            registerReceiver(stopReceiver, IntentFilter(ACTION_STOP_ALARM))
        }
    }

    private fun buildNotification(zmanLabel: String): Notification {
        val stopIntent = PendingIntent.getService(
            this, 0,
            Intent(this, ZmanimAlarmService::class.java).apply { action = ACTION_STOP_ALARM },
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val openIntent = PendingIntent.getActivity(
            this, 1,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.app_logo)
            .setContentTitle("התראת זמנים")
            .setContentText("הגיע הזמן: $zmanLabel")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setFullScreenIntent(openIntent, true)
            .addAction(android.R.drawable.ic_media_pause, "עצור", stopIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "שעון מעורר זמני היום",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "התראות זמני היום עם צלצול"
                setBypassDnd(true)
                enableVibration(true)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacksAndMessages(null)
        stopReceiver?.let { unregisterReceiver(it) }
        mediaPlayer?.release()
        mediaPlayer = null
    }

    override fun onBind(intent: Intent?): IBinder? = null
}

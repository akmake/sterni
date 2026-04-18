package com.sterni.dailystudy

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.view.WindowCompat
import androidx.lifecycle.lifecycleScope
import androidx.navigation.compose.rememberNavController
import com.sterni.dailystudy.alarm.ZmanimRescheduler
import com.sterni.dailystudy.geofence.GeofenceCheckWorker
import com.sterni.dailystudy.geofence.GeofenceHelper
import com.sterni.dailystudy.notification.MidnightReminderReceiver
import com.sterni.dailystudy.notification.ZmanBriefWorker
import com.sterni.dailystudy.notification.CalendarReminderWorker
import com.sterni.dailystudy.sync.StudySyncWorker
import com.sterni.dailystudy.sync.UserManager
import com.sterni.dailystudy.sync.UserSyncWorker
import com.sterni.dailystudy.ui.navigation.NavGraph
import com.sterni.dailystudy.ui.theme.DailyStudyTheme
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Sync workers
        StudySyncWorker.enqueue(this)
        UserSyncWorker.enqueue(this)

        // Auto-register user identity
        lifecycleScope.launch(Dispatchers.IO) {
            UserManager.ensureRegistered(this@MainActivity)
        }

        // Geofence silent zones
        val hasActiveZones = GeofenceHelper.loadZones(this).any { it.active }
        if (hasActiveZones) {
            GeofenceHelper.registerActiveGeofences(this)
            GeofenceCheckWorker.enqueue(this)
        }

        // Notification channels + schedules
        ZmanBriefWorker.createChannel(this)
        MidnightReminderReceiver.createChannel(this)
        if (ZmanBriefWorker.isEnabled(this)) ZmanBriefWorker.enqueue(this)
        if (MidnightReminderReceiver.isEnabled(this)) MidnightReminderReceiver.schedule(this)

        // Queue custom Calendar alerts processing continuously
        CalendarReminderWorker.enqueuePeriodic(this)

        // Re-schedule all active zmanim alarms
        ZmanimRescheduler.rescheduleAll(this)

        enableEdgeToEdge()
        WindowCompat.setDecorFitsSystemWindows(window, false)
        setContent {
            DailyStudyTheme {
                val navController = rememberNavController()
                NavGraph(navController = navController)
            }
        }
    }
}

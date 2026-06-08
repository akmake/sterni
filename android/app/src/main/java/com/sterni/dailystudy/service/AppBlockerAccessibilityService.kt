package com.sterni.dailystudy.service

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent
import android.widget.Toast
import com.sterni.dailystudy.data.local.AppBlockerPrefs

class AppBlockerAccessibilityService : AccessibilityService() {

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg == applicationContext.packageName) return

        val active = AppBlockerPrefs.getSchedules(applicationContext)
            .firstOrNull { it.isActiveNow() && pkg in it.blockedPackages }
            ?: return

        performGlobalAction(GLOBAL_ACTION_HOME)
        Toast.makeText(
            applicationContext,
            "חסום בין ${active.formattedRange().replace("–", "ל-")}",
            Toast.LENGTH_SHORT
        ).show()
    }

    override fun onInterrupt() {}
}

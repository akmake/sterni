package com.sterni.dailystudy.widget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.sterni.dailystudy.R
import com.sterni.dailystudy.tracker.StudyTracker

class StudyWidgetProvider : AppWidgetProvider() {

    companion object {
        const val ACTION_TOGGLE = "com.sterni.dailystudy.ACTION_STUDY_TOGGLE"
        const val EXTRA_STUDY_KEY = "extra_study_key"

        fun updateAll(context: Context) {
            val mgr = AppWidgetManager.getInstance(context)
            val ids = mgr.getAppWidgetIds(ComponentName(context, StudyWidgetProvider::class.java))
            if (ids.isNotEmpty()) {
                ids.forEach { updateWidget(context, mgr, it) }
            }
        }

        fun updateWidget(context: Context, mgr: AppWidgetManager, widgetId: Int) {
            val done = StudyTracker.completedCount(context)
            val total = StudyTracker.totalEnabled(context)
            val views = RemoteViews(context.packageName, R.layout.widget_study_checklist)
            views.setTextViewText(R.id.widget_progress, "$done/$total")
            mgr.updateAppWidget(widgetId, views)
        }
    }

    override fun onUpdate(context: Context, mgr: AppWidgetManager, widgetIds: IntArray) {
        widgetIds.forEach { updateWidget(context, mgr, it) }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_TOGGLE) {
            val key = intent.getStringExtra(EXTRA_STUDY_KEY) ?: return
            StudyTracker.toggleCompleted(context, key)
            updateAll(context)
        }
    }
}

package com.sterni.dailystudy

import android.app.Application
import com.tom_roush.pdfbox.android.PDFBoxResourceLoader
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class DailyStudyApp : Application() {
    override fun onCreate() {
        super.onCreate()
        PDFBoxResourceLoader.init(applicationContext)
    }
}

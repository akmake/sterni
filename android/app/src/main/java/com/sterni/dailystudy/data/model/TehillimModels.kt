package com.sterni.dailystudy.data.model

import com.google.gson.annotations.SerializedName

data class TehillimVerse(
    @SerializedName("num") val num: Int,
    @SerializedName("heNum") val heNum: String,
    @SerializedName("text") val text: String
)

data class TehillimChapter(
    @SerializedName("chapter") val chapter: Int,
    @SerializedName("hebrewChapter") val hebrewChapter: String,
    @SerializedName("title") val title: String,
    @SerializedName("book") val book: Int,
    @SerializedName("dayOfMonth") val dayOfMonth: Int,
    @SerializedName("dayOfWeek") val dayOfWeek: Int,
    @SerializedName("verseCount") val verseCount: Int,
    @SerializedName("verses") val verses: List<TehillimVerse>
)

data class TehillimData(
    @SerializedName("version") val version: Int,
    @SerializedName("totalChapters") val totalChapters: Int,
    @SerializedName("chapters") val chapters: List<TehillimChapter>
)

data class TehillimReadingPosition(
    val chapter: Int = 1,
    val verse: Int = 1,
    val timestamp: Long = 0L
)

enum class TehillimTab(val title: String) {
    MONTH("יום בחודש"),
    WEEK("יום בשבוע"),
    ALL("כל הפרקים"),
    BOOKS("חמישה ספרים"),
    SPECIAL("סגולות ומיוחדים")
}

data class SpecialCollection(
    val id: String,
    val title: String,
    val subtitle: String,
    val chapters: List<Int>
)

package com.sterni.dailystudy.data.model

data class StudyDay(
    val date: String? = null,
    val hebrewDate: String? = null,
    val studies: Map<String, Study>? = null
)

data class Study(
    val key: String? = null,
    val title: String? = null,
    val subtitle: String? = null,
    val accent: String? = null,
    val kind: String? = null,
    val label: String? = null,
    val ref: String? = null,
    val preview: String? = null,
    val available: Boolean = false,
    val sections: List<Section>? = null,
    val rules: List<String>? = null
)

data class Section(
    val id: String? = null,
    val isHeader: Boolean = false,
    val isAliyahHeader: Boolean = false,
    val isChapterHeader: Boolean = false,
    val he: String? = null,
    val en: String? = null,
    val ordinal: String? = null,
    val rashi: List<RashiItem>? = null,
    val verseNum: Int? = null,
    val chapterNum: Int? = null
) {
    data class RashiItem(val he: String? = null)
}

data class TehillimChaptersResponse(
    val sections: List<Section>? = null
)

package com.sterni.dailystudy.ui.screens.study

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.sterni.dailystudy.cache.StudyCache
import com.sterni.dailystudy.data.model.Section
import com.sterni.dailystudy.data.model.Study
import com.sterni.dailystudy.data.api.ApiService
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

private const val TEHILLIM_PREFS          = "TehillimPrefs"
private const val KEY_CUSTOM_CHAPTERS     = "custom_chapters"
private const val KEY_LAST_DATE           = "last_tehillim_date"
private const val KEY_LAST_LABEL          = "last_tehillim_label"
private const val KEY_CACHED_CHAPTERS_KEY = "cached_chapters_key"
private const val KEY_CACHED_SECTIONS     = "cached_custom_sections_json"

data class StudyDetailUiState(
    val loading: Boolean = true,
    val title: String = "",
    val subtitle: String = "",
    val sections: List<Section> = emptyList(),
    val customChapters: List<Int> = emptyList(),
    val error: String? = null,
    val isRangeMode: Boolean = false,
    val rangeDates: List<String> = emptyList()
)


@HiltViewModel
class StudyDetailViewModel @Inject constructor(
    private val apiService: ApiService,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(StudyDetailUiState())
    val uiState: StateFlow<StudyDetailUiState> = _uiState.asStateFlow()

    private fun tehillimPrefs() =
        getApplication<Application>().getSharedPreferences(TEHILLIM_PREFS, Context.MODE_PRIVATE)

    fun getCustomChapters(): List<Int> {
        val str = tehillimPrefs().getString(KEY_CUSTOM_CHAPTERS, "") ?: ""
        return str.split(",").mapNotNull { it.trim().toIntOrNull() }.filter { it in 1..150 }
    }

    fun saveCustomChapters(chapters: List<Int>, date: String, label: String) {
        val prefs = tehillimPrefs()
        prefs.edit().putString(KEY_CUSTOM_CHAPTERS, chapters.joinToString(",")).apply()

        if (chapters.isEmpty()) {
            prefs.edit().remove(KEY_CACHED_CHAPTERS_KEY).remove(KEY_CACHED_SECTIONS).apply()
            load("tehillim", date, label)
            return
        }

        // Download once and cache — no more downloading every day
        viewModelScope.launch {
            try {
                val chaptersStr = chapters.joinToString(",")
                val resp = apiService.getTehillimChapters(chaptersStr)
                val sections = if (resp.isSuccessful) resp.body()?.sections ?: emptyList() else emptyList()
                if (sections.isNotEmpty()) {
                    val json = Gson().toJson(sections)
                    prefs.edit()
                        .putString(KEY_CACHED_CHAPTERS_KEY, chaptersStr)
                        .putString(KEY_CACHED_SECTIONS, json)
                        .apply()
                }
            } catch (_: Exception) {}
            load("tehillim", date, label)
        }
    }

    private fun getCachedCustomSections(chapters: List<Int>): List<Section>? {
        val prefs = tehillimPrefs()
        val cachedKey = prefs.getString(KEY_CACHED_CHAPTERS_KEY, null) ?: return null
        if (cachedKey != chapters.joinToString(",")) return null
        val json = prefs.getString(KEY_CACHED_SECTIONS, null) ?: return null
        return try {
            val type = object : TypeToken<List<Section>>() {}.type
            Gson().fromJson(json, type)
        } catch (_: Exception) { null }
    }

    fun load(key: String, date: String, label: String) {
        val ctx = getApplication<Application>()

        if (key == "tehillim") {
            tehillimPrefs().edit()
                .putString(KEY_LAST_DATE, date)
                .putString(KEY_LAST_LABEL, label)
                .apply()
        }

        viewModelScope.launch {
            val customChapters = if (key == "tehillim") getCustomChapters() else emptyList()
            _uiState.value = StudyDetailUiState(loading = true, customChapters = customChapters)

            // Try cache first
            var dailySections: List<Section> = emptyList()
            val cached = StudyCache.get(ctx, date)
            val cachedStudy = cached?.studies?.get(key)

            if (cachedStudy?.sections?.isNotEmpty() == true) {
                dailySections = cachedStudy.sections!!
            } else {
                try {
                    val tz = java.util.TimeZone.getDefault().id
                    val isDiaspora = tz != "Asia/Jerusalem"
                    val response = apiService.getDailyStudy(date, diaspora = isDiaspora, timezone = tz)
                    val day = if (response.isSuccessful) response.body() else null
                    if (day != null) {
                        StudyCache.save(ctx, date, day)
                        dailySections = day.studies?.get(key)?.sections ?: emptyList()
                    }
                } catch (e: Exception) {
                    _uiState.value = StudyDetailUiState(
                        loading = false,
                        error = "No connection: ${e.message}",
                        customChapters = customChapters
                    )
                    return@launch
                }
            }

            // Append custom tehillim chapters — use cache, never re-download
            var allSections = dailySections
            if (key == "tehillim" && customChapters.isNotEmpty()) {
                val cachedSections = getCachedCustomSections(customChapters)
                if (cachedSections != null) {
                    val separator = Section(
                        id = "custom_sep",
                        isHeader = true,
                        isAliyahHeader = true,
                        he = "— פרקים אישיים —",
                        en = ""
                    )
                    allSections = dailySections + separator + cachedSections
                }
            }

            if (allSections.isEmpty()) {
                _uiState.value = StudyDetailUiState(
                    loading = false,
                    error = "No content for this study today",
                    customChapters = customChapters
                )
            } else {
                val studyTitle = cached?.studies?.get(key)?.title ?: ""
                _uiState.value = StudyDetailUiState(
                    loading = false,
                    title = studyTitle,
                    subtitle = label,
                    sections = allSections,
                    customChapters = customChapters
                )
            }
        }
    }

    fun loadRange(key: String, fromDate: String, toDate: String, label: String) {
        val ctx = getApplication<Application>()
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(loading = true, error = null)

            val formatter = DateTimeFormatter.ISO_LOCAL_DATE
            val start = try { LocalDate.parse(fromDate, formatter) } catch (_: Exception) { null }
            val end = try { LocalDate.parse(toDate, formatter) } catch (_: Exception) { null }

            if (start == null || end == null || start.isAfter(end)) {
                load(key, fromDate, label)
                return@launch
            }

            val dates = mutableListOf<String>()
            var curr: LocalDate = start
            while (!curr.isAfter(end)) {
                dates.add(curr.format(formatter))
                curr = curr.plusDays(1)
            }


            val tz = java.util.TimeZone.getDefault().id
            val isDiaspora = tz != "Asia/Jerusalem"

            val allSections = mutableListOf<Section>()
            val dayNames = arrayOf("ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת")
            var resolvedTitle = label

            for (dStr in dates) {
                var dayStudy: Study? = null
                var hebrewDateStr = ""

                val cached = StudyCache.get(ctx, dStr)
                if (cached?.studies?.containsKey(key) == true) {
                    dayStudy = cached.studies[key]
                    hebrewDateStr = cached.hebrewDate ?: ""
                } else {
                    try {
                        val response = apiService.getDailyStudy(dStr, diaspora = isDiaspora, timezone = tz)
                        val body = if (response.isSuccessful) response.body() else null
                        if (body != null) {
                            StudyCache.save(ctx, dStr, body)
                            dayStudy = body.studies?.get(key)
                            hebrewDateStr = body.hebrewDate ?: ""
                        }
                    } catch (_: Exception) {}
                }

                if (resolvedTitle.isEmpty() && !dayStudy?.title.isNullOrEmpty()) {
                    resolvedTitle = dayStudy?.title ?: label
                }

                val daySections = dayStudy?.sections ?: emptyList()
                if (daySections.isNotEmpty()) {
                    val dt = LocalDate.parse(dStr, formatter)
                    val dow = dt.dayOfWeek.value % 7 // 7 (Sun) -> 0 ... 6 (Sat) -> 6
                    val dowHeb = dayNames[dow]

                    val headerText = if (hebrewDateStr.isNotEmpty()) {
                        "— יום $dowHeb, $hebrewDateStr —"
                    } else {
                        "— יום $dowHeb ($dStr) —"
                    }

                    // Add Day Separator Header
                    allSections.add(
                        Section(
                            id = "day_header_$dStr",
                            isHeader = true,
                            isAliyahHeader = false,
                            he = headerText,
                            dayDate = dStr,
                            indexInDay = 0
                        )
                    )

                    // Add the day's sections tagged with date and indexInDay
                    daySections.forEachIndexed { idx, sec ->
                        allSections.add(
                            sec.copy(
                                id = "${dStr}_${sec.id ?: idx}",
                                dayDate = dStr,
                                indexInDay = idx
                            )
                        )
                    }
                }
            }

            if (allSections.isEmpty()) {
                load(key, fromDate, label)
                return@launch
            }

            _uiState.value = StudyDetailUiState(
                loading = false,
                title = resolvedTitle,
                subtitle = "השלמת שיעורים (${dates.size} ימים)",
                sections = allSections,
                isRangeMode = true,
                rangeDates = dates
            )
        }
    }
}


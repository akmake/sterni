package com.sterni.dailystudy.ui.screens.mamaarim

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sterni.dailystudy.data.api.ArticleDto
import com.sterni.dailystudy.data.api.RetrofitClient
import com.sterni.dailystudy.data.model.Mamaar
import com.sterni.dailystudy.data.model.MamaarSection
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class MamaarimState(
    val mamaarim: List<Mamaar> = emptyList(),
    val isLoading: Boolean = false,
    val error: String? = null
)

class MamaarimViewModel(app: Application) : AndroidViewModel(app) {

    private val _state = MutableStateFlow(MamaarimState())
    val state = _state.asStateFlow()

    private val _selectedMamaar = MutableStateFlow<Mamaar?>(null)
    val selectedMamaar = _selectedMamaar.asStateFlow()

    private val gson     = Gson()
    private val cacheDir = File(app.filesDir, "articles_cache").also { it.mkdirs() }

    init { loadAll() }

    fun loadAll() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }

            val cached = loadListCache()
            if (cached.isNotEmpty()) {
                _state.update { it.copy(mamaarim = cached, isLoading = false) }
            }

            withContext(Dispatchers.IO) {
                try {
                    val response = RetrofitClient.articleService.getArticles().execute()
                    if (response.isSuccessful) {
                        val serverDtos = response.body() ?: emptyList()

                        val file = File(cacheDir, "list.json")
                        val localDtos: List<ArticleDto> = try {
                            if (file.exists()) {
                                val type = object : TypeToken<List<ArticleDto>>() {}.type
                                val existing: List<ArticleDto> = gson.fromJson(file.readText(), type) ?: emptyList()
                                existing.filter { it.id.startsWith("local_") }
                            } else emptyList()
                        } catch (e: Exception) { emptyList() }

                        val mergedDtos = localDtos + serverDtos

                        saveListCache(mergedDtos)
                        val list = mergedDtos.map { dto ->
                            Mamaar(
                                id        = dto.id,
                                title     = dto.title,
                                fileName  = "",
                                sections  = emptyList(),
                                createdAt = parseDate(dto.createdAt)
                            )
                        }
                        withContext(Dispatchers.Main) {
                            _state.update { it.copy(mamaarim = list, isLoading = false, error = null) }
                        }
                    } else if (cached.isEmpty()) {
                        withContext(Dispatchers.Main) {
                            _state.update { it.copy(error = "שגיאה בטעינת מאמרים", isLoading = false) }
                        }
                    } else {
                        withContext(Dispatchers.Main) { _state.update { it.copy(isLoading = false) } }
                    }
                } catch (e: Exception) {
                    withContext(Dispatchers.Main) {
                        _state.update { it.copy(isLoading = false) }
                    }
                }
            }
        }
    }

    fun loadArticleContent(id: String) {
        viewModelScope.launch {
            val cachedText = loadTextCache(id)
            if (cachedText != null) {
                _selectedMamaar.value = buildMamaar(id, cachedText)
            }

            if (cachedText == null) {
                withContext(Dispatchers.IO) {
                    try {
                        val response = RetrofitClient.articleService.getArticleById(id).execute()
                        if (response.isSuccessful) {
                            val dto      = response.body() ?: return@withContext
                            val fullText = dto.rawText ?: ""
                            saveTextCache(id, fullText)
                            withContext(Dispatchers.Main) {
                                _selectedMamaar.value = buildMamaar(dto.id, fullText, dto.title)
                            }
                        }
                    } catch (_: Exception) {
                        if (cachedText == null)
                            withContext(Dispatchers.Main) { _selectedMamaar.value = null }
                    }
                }
            }
        }
    }

    fun clearSelectedMamaar() { _selectedMamaar.value = null }
    fun clearError()          = _state.update { it.copy(error = null) }

    private fun loadListCache(): List<Mamaar> {
        val file = File(cacheDir, "list.json")
        if (!file.exists()) return emptyList()
        return try {
            val type: java.lang.reflect.Type = object : TypeToken<List<ArticleDto>>() {}.type
            val dtos: List<ArticleDto>       = gson.fromJson(file.readText(), type) ?: return emptyList()
            dtos.map { Mamaar(it.id, it.title, "", emptyList(), parseDate(it.createdAt)) }
        } catch (_: Exception) { emptyList() }
    }

    private fun saveListCache(dtos: List<ArticleDto>) {
        try { File(cacheDir, "list.json").writeText(gson.toJson(dtos)) } catch (_: Exception) {}
    }

    private fun loadTextCache(id: String): String? {
        val file = File(cacheDir, "text_$id.txt")
        return try { if (file.exists()) file.readText() else null } catch (_: Exception) { null }
    }

    private fun saveTextCache(id: String, text: String) {
        try { File(cacheDir, "text_$id.txt").writeText(text) } catch (_: Exception) {}
    }

    fun deleteMamaar(id: String) {
        viewModelScope.launch {
            val file = File(cacheDir, "list.json")
            val localDtos = try {
                if (file.exists()) {
                    val type = object : TypeToken<List<ArticleDto>>() {}.type
                    val existing: List<ArticleDto> = gson.fromJson(file.readText(), type) ?: emptyList()
                    existing.filter { it.id != id }
                } else emptyList()
            } catch (e: Exception) { emptyList() }
            saveListCache(localDtos)
            File(cacheDir, "text_$id.txt").delete()
            loadAll()
        }
    }

    fun updateMamaarTitle(id: String, newTitle: String) {
        viewModelScope.launch {
            val file = File(cacheDir, "list.json")
            val localDtos = try {
                if (file.exists()) {
                    val type = object : TypeToken<List<ArticleDto>>() {}.type
                    val list = (gson.fromJson<List<ArticleDto>>(file.readText(), type) ?: emptyList()).toMutableList()
                    val idx = list.indexOfFirst { it.id == id }
                    if (idx != -1) {
                        list[idx] = list[idx].copy(title = newTitle)
                    }
                    list
                } else emptyList()
            } catch (e: Exception) { emptyList() }
            saveListCache(localDtos)
            loadAll()
        }
    }

    fun updateMamaarContent(id: String, newText: String) {
        viewModelScope.launch {
            saveTextCache(id, newText)
            if (_selectedMamaar.value?.id == id) {
                _selectedMamaar.value = buildMamaar(id, newText)
            }
        }
    }

    fun loadRawText(id: String): String? = loadTextCache(id)

    private fun buildMamaar(id: String, text: String, title: String = ""): Mamaar {
        val resolvedTitle = _state.value.mamaarim.find { it.id == id }?.title ?: title
        return Mamaar(
            id        = id,
            title     = resolvedTitle,
            fileName  = "",
            sections  = splitIntoSections(text),
            createdAt = System.currentTimeMillis()
        )
    }

    private fun parseDate(iso: String?): Long {
        if (iso == null) return System.currentTimeMillis()
        return try {
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
                .apply { timeZone = TimeZone.getTimeZone("UTC") }
                .parse(iso)?.time ?: System.currentTimeMillis()
        } catch (_: Exception) { System.currentTimeMillis() }
    }

    private fun splitIntoSections(text: String): List<MamaarSection> {
        val markerRe = Regex("(?m)^([א-ת]\\)\\s)")
        val matches  = markerRe.findAll(text).toList()

        if (matches.isEmpty()) return splitByParagraphGroups(text)

        val sections = mutableListOf<MamaarSection>()
        val intro    = text.substring(0, matches.first().range.first).trim()
        if (intro.isNotEmpty()) sections.add(MamaarSection(null, intro))

        for (i in matches.indices) {
            val start = matches[i].range.first
            val end   = if (i + 1 < matches.size) matches[i + 1].range.first else text.length
            val chunk = text.substring(start, end).trim()
            sections.add(MamaarSection(null, chunk))
        }

        return sections.ifEmpty { listOf(MamaarSection(null, text.trim())) }
    }

    private fun splitByParagraphGroups(text: String): List<MamaarSection> {
        val paragraphs = text.split(Regex("\\n{2,}"))
            .map { it.trim() }.filter { it.isNotEmpty() }

        if (paragraphs.isEmpty()) return listOf(MamaarSection(null, text.trim()))

        val sections = mutableListOf<MamaarSection>()
        sections.add(MamaarSection(null, paragraphs.first()))
        paragraphs.drop(1).chunked(4).forEach { chunk ->
            sections.add(MamaarSection(null, chunk.joinToString("\n\n")))
        }
        return sections
    }
}

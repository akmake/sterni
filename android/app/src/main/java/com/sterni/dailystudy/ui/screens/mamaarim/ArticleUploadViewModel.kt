package com.sterni.dailystudy.ui.screens.mamaarim

import android.app.Application
import android.net.Uri
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sterni.dailystudy.data.api.ArticleDto
import com.sterni.dailystudy.data.api.RetrofitClient
import com.sterni.dailystudy.data.api.SaveArticleBody
import com.sterni.dailystudy.util.ChabadPdfExtractor
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import com.tom_roush.pdfbox.pdmodel.PDDocument
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

enum class ExtractionMode { SERVER, LOCAL }

sealed class UploadState {
    object Idle : UploadState()
    data class Extracting(val page: Int = 0, val total: Int = 0) : UploadState()
    data class Preview(val pageCount: Int) : UploadState()
    object Uploading : UploadState()
    object Success   : UploadState()
    data class Error(val message: String) : UploadState()
}

class ArticleUploadViewModel(app: Application) : AndroidViewModel(app) {

    private val _state = MutableStateFlow<UploadState>(UploadState.Idle)
    val state = _state.asStateFlow()

    val title          = MutableStateFlow("")
    val rawText        = MutableStateFlow("")
    val extractionMode = MutableStateFlow(ExtractionMode.SERVER)

    fun onPdfPicked(uri: Uri) {
        _state.value = UploadState.Extracting()
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val (extractedText, pageCount) = when (extractionMode.value) {
                    ExtractionMode.SERVER -> extractViaServer(uri)
                    ExtractionMode.LOCAL  -> extractLocally(uri)
                }

                if (extractedText.isBlank()) {
                    _state.value = UploadState.Error("לא נמצא טקסט בקובץ")
                } else {
                    rawText.value = extractedText
                    _state.value  = UploadState.Preview(pageCount)
                }
            } catch (e: Exception) {
                _state.value = UploadState.Error("שגיאה בחילוץ: ${e.message}")
            }
        }
    }

    // ── Extraction ────────────────────────────────────────────────────────────

    private suspend fun extractViaServer(uri: Uri): Pair<String, Int> {
        val ctx   = getApplication<Application>()
        val bytes = ctx.contentResolver.openInputStream(uri)
            ?.use { it.readBytes() }
            ?: throw Exception("לא ניתן לפתוח את הקובץ")

        val pdfPart = MultipartBody.Part.createFormData(
            name     = "pdf",
            filename = "upload.pdf",
            body     = bytes.toRequestBody("application/pdf".toMediaType())
        )
        val response = RetrofitClient.articleService.extractText(pdfPart)
        return Pair(response.rawText, response.pageCount)
    }

    private fun extractLocally(uri: Uri): Pair<String, Int> {
        val ctx      = getApplication<Application>()
        val tempFile = File(ctx.cacheDir, "extract_${System.currentTimeMillis()}.pdf")

        ctx.contentResolver.openInputStream(uri)?.use { input ->
            tempFile.outputStream().use { input.copyTo(it, bufferSize = 64 * 1024) }
        } ?: throw Exception("לא ניתן לפתוח את הקובץ")

        return try {
            val document = PDDocument.load(tempFile)
            try {
                ChabadPdfExtractor().extract(document) { done, total ->
                    _state.value = UploadState.Extracting(done, total)
                }
            } finally {
                document.close()
            }
        } finally {
            tempFile.delete()
        }
    }

    // ── Save ──────────────────────────────────────────────────────────────────

    fun save(uploadToServer: Boolean) {
        val preview = _state.value as? UploadState.Preview ?: return
        _state.value = UploadState.Uploading
        viewModelScope.launch(Dispatchers.IO) {
            try {
                val finalTitle = title.value.trim().ifEmpty { "מאמר משלי" }
                val finalText  = rawText.value.trim()

                if (uploadToServer) {
                    RetrofitClient.articleService.saveArticle(
                        SaveArticleBody(
                            rawText   = finalText,
                            pageCount = preview.pageCount,
                            title     = finalTitle
                        )
                    )
                } else {
                    saveToLocalLibrary(finalTitle, finalText, preview.pageCount)
                }

                _state.value = UploadState.Success
            } catch (e: Exception) {
                _state.value = UploadState.Error("שגיאה בשמירה: ${e.message}")
            }
        }
    }

    private fun saveToLocalLibrary(titleStr: String, text: String, pages: Int) {
        val ctx      = getApplication<Application>()
        val cacheDir = File(ctx.filesDir, "articles_cache").also { it.mkdirs() }

        val id     = "local_${System.currentTimeMillis()}"
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            .apply { timeZone = TimeZone.getTimeZone("UTC") }
            .format(Date())

        val listFile = File(cacheDir, "list.json")
        val gson     = Gson()
        val type     = object : TypeToken<List<ArticleDto>>() {}.type

        val currentList: MutableList<ArticleDto> = try {
            if (listFile.exists()) gson.fromJson(listFile.readText(), type) else mutableListOf()
        } catch (e: Exception) { mutableListOf() }

        val newArticle = ArticleDto(id = id, title = titleStr, createdAt = nowIso, rawText = null)
        currentList.add(0, newArticle)
        listFile.writeText(gson.toJson(currentList))

        File(cacheDir, "text_$id.txt").writeText(text)
    }

    fun reset() {
        _state.value = UploadState.Idle
        title.value  = ""
        rawText.value = ""
    }
}

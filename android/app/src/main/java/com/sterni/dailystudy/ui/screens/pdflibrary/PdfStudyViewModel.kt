package com.sterni.dailystudy.ui.screens.pdflibrary

import android.app.Application
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.util.Log
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Job
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import com.tom_roush.pdfbox.pdmodel.PDDocument
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID

/**
 * A book in "ארון הספרים שלי". Stored as JSON in SharedPreferences ("books_list").
 * Fields added later are nullable / defaulted: Gson leaves them null in books saved before them.
 */
data class PdfBook(
    val id: String,
    val uriString: String,
    val title: String,
    val currentPage: Int = 0,
    val totalPages: Int = 0,
    val isLandscape: Boolean = false,
    val lastOpened: Long? = null,
    val bookmarks: List<Int>? = null,
    val collection: String? = null,
    val sichaPosition: Int = 0,
    val sichaOffset: Int = 0,
    val sichaCrops: Map<String, SichaCrop>? = null,
    val sichaTextPosition: Int = 0,
    val sichaTextOffset: Int = 0,
    val sourceUrl: String? = null,
    val sourcePageUrl: String? = null,
    val sourceCategory: String? = null
)

enum class ReadMode { PAGED, SCROLL }
enum class PaperTheme { WHITE, SEPIA, NIGHT }

data class ReaderSettings(
    val mode: ReadMode = ReadMode.PAGED,
    val theme: PaperTheme = PaperTheme.WHITE,
    val cropMargins: Boolean = true
)

data class OcrRequest(val bookId: String, val title: String, val page: Int)

data class PdfState(
    val books: List<PdfBook> = emptyList(),
    val currentBook: PdfBook? = null,
    val engine: PdfRenderEngine? = null,
    val isOpening: Boolean = false,
    val errorMsg: String? = null,
    val settings: ReaderSettings = ReaderSettings(),
    val thumbsVersion: Int = 0,
    val sichaText: SichaTextDocument? = null,
    val extractionProgress: Pair<Int, Int>? = null,
    val sichaFontSize: Int = 24,
    val ocrRequest: OcrRequest? = null,
    val downloading: Boolean = false,
    val downloadProgress: Pair<Long, Long?>? = null,
    val previewRemoteUrl: String? = null
)

class PdfStudyViewModel(app: Application) : AndroidViewModel(app) {

    private val ctx   = app.applicationContext
    private val prefs = ctx.getSharedPreferences("PdfLibrary", Context.MODE_PRIVATE)
    private val gson  = Gson()
    private val downloadsDir = File(ctx.filesDir, "mafteiach_downloads").also { it.mkdirs() }
    private val textDir = File(ctx.filesDir, "sicha_text").also { it.mkdirs() }
    private val thumbDir = File(ctx.filesDir, "pdf_thumbs").also { it.mkdirs() }

    private var openingJob: Job? = null
    private var ocrApproval: CompletableDeferred<Boolean>? = null
    private val _state = MutableStateFlow(PdfState())
    val state = _state.asStateFlow()

    init {
        loadBooks()
        loadSettings()
        _state.value = _state.value.copy(sichaFontSize = prefs.getInt("sicha_font_size", 24).coerceIn(18, 40))
        makeMissingThumbnails()
    }

    // ── Books list ────────────────────────────────────────────────────────────

    private fun loadBooks() {
        val json = prefs.getString("books_list", "[]")
        val type = object : TypeToken<List<PdfBook>>() {}.type
        val books: List<PdfBook> = try {
            gson.fromJson<List<PdfBook>>(json, type) ?: emptyList()
        } catch (e: Exception) { emptyList() }
        _state.value = _state.value.copy(books = books)
    }

    private fun saveBooks(books: List<PdfBook>) {
        prefs.edit().putString("books_list", gson.toJson(books)).apply()
        _state.value = _state.value.copy(books = books)
    }

    private fun update(bookId: String, change: (PdfBook) -> PdfBook) {
        val list = _state.value.books.map { if (it.id == bookId) change(it) else it }
        saveBooks(list)
        _state.value.currentBook?.takeIf { it.id == bookId }?.let { cur ->
            _state.value = _state.value.copy(currentBook = list.firstOrNull { it.id == cur.id })
        }
    }

    fun addBook(uri: Uri, title: String, isLandscape: Boolean, collection: String? = null) {
        try {
            ctx.contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        } catch (e: SecurityException) {
            Log.e("PdfStudyVM", "Could not take persistable perm", e)
        }
        val book = PdfBook(
            id          = UUID.randomUUID().toString(),
            uriString   = uri.toString(),
            title       = title.trim().ifEmpty { "ספר חדש" },
            isLandscape = isLandscape,
            collection = collection
        )
        saveBooks(_state.value.books + book)
        makeMissingThumbnails()
        if (collection == "sichot") openBook(book.id)
    }

    fun renameBook(bookId: String, title: String) {
        val t = title.trim()
        if (t.isNotEmpty()) update(bookId) { it.copy(title = t) }
    }

    fun removeBook(bookId: String) {
        val book = _state.value.books.find { it.id == bookId } ?: return
        if (_state.value.books.none { it.id != bookId && it.uriString == book.uriString }) {
            try {
                ctx.contentResolver.releasePersistableUriPermission(Uri.parse(book.uriString), Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (_: Exception) {}
        }
        thumbFile(bookId).delete()
        File(textDir, bookId).deleteRecursively()
        if (book.sourceUrl != null && _state.value.books.none { it.id != bookId && it.uriString == book.uriString }) {
            runCatching {
                val file = File(Uri.parse(book.uriString).path ?: "")
                if (file.canonicalFile.parentFile == downloadsDir.canonicalFile) file.delete()
            }
        }
        saveBooks(_state.value.books.filter { it.id != bookId })
    }

    fun setLandscape(bookId: String, landscape: Boolean) = update(bookId) { it.copy(isLandscape = landscape) }

    // ── Thumbnails ────────────────────────────────────────────────────────────

    fun thumbFile(bookId: String) = File(thumbDir, "$bookId.png")

    private fun makeMissingThumbnails() {
        val missing = _state.value.books.filter { !thumbFile(it.id).exists() }
        if (missing.isEmpty()) return
        viewModelScope.launch(Dispatchers.IO) {
            for (b in missing) {
                try {
                    PdfRenderEngine.open(ctx, Uri.parse(b.uriString)).use { eng ->
                        val bmp = eng.thumbnail(192)
                        thumbFile(b.id).outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
                        if (b.totalPages == 0) withContext(Dispatchers.Main) { update(b.id) { it.copy(totalPages = eng.pageCount) } }
                    }
                } catch (e: Exception) {
                    Log.w("PdfStudyVM", "thumbnail failed for ${b.title}", e)
                }
            }
            _state.value = _state.value.copy(thumbsVersion = _state.value.thumbsVersion + 1)
        }
    }

    // ── Open / close ──────────────────────────────────────────────────────────

    fun openBook(bookId: String) {
        val book = _state.value.books.find { it.id == bookId } ?: return
        if (_state.value.isOpening) return
        _state.value = _state.value.copy(isOpening = true, errorMsg = null)
        openingJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                if (book.collection == "sichot" || book.collection == "mafteiach") {
                    val directory = File(textDir, book.id)
                    val cache = File(directory, "text.json")
                    val cachedText = runCatching { gson.fromJson(cache.readText(), SichaTextDocument::class.java) }
                        .getOrNull()?.takeIf { it.version in 1..3 && it.blocks.isNotEmpty() }
                    val saved = cachedText?.takeIf { (it.version >= 3 || it.blocks.all { block -> block.ocr }) &&
                            !SichaTextParser.hasBrokenLegacyCache(it) }
                    val text = saved ?: PdfRenderEngine.open(ctx, Uri.parse(book.uriString)).use { render ->
                        ctx.contentResolver.openInputStream(Uri.parse(book.uriString))?.use { input ->
                            PDDocument.load(input).use { document ->
                                SichaTextExtractor(ctx).extract(document, render, directory,
                                    preservedOcrBlocks = cachedText?.blocks.orEmpty(),
                                    onOcrRequired = { page -> requestOcrApproval(book, page) }) { page, total ->
                                    _state.value = _state.value.copy(extractionProgress = page to total)
                                }
                            }
                        } ?: throw IllegalArgumentException("לא ניתן לקרוא את הקובץ")
                    }.also { extracted ->
                        directory.mkdirs()
                        val temporary = File(directory, "text.json.tmp")
                        temporary.writeText(gson.toJson(extracted))
                        if (!temporary.renameTo(cache)) throw java.io.IOException("לא ניתן לשמור את הטקסט")
                    }
                    withContext(Dispatchers.Main) {
                        update(book.id) { it.copy(totalPages = text.pageCount, lastOpened = System.currentTimeMillis()) }
                        _state.value = _state.value.copy(currentBook = _state.value.books.first { it.id == book.id },
                            sichaText = text, engine = null, isOpening = false, extractionProgress = null)
                    }
                    return@launch
                }
                val engine = PdfRenderEngine.open(ctx, Uri.parse(book.uriString))
                val total  = engine.pageCount
                val start  = book.currentPage.coerceIn(0, (total - 1).coerceAtLeast(0))
                withContext(Dispatchers.Main) {
                    update(book.id) { it.copy(totalPages = total, currentPage = start, lastOpened = System.currentTimeMillis()) }
                    _state.value = _state.value.copy(
                        currentBook = _state.value.books.first { it.id == book.id },
                        engine      = engine,
                        isOpening   = false
                    )
                }
            } catch (e: CancellationException) { throw e
            } catch (e: Exception) {
                Log.e("PdfStudyVM", "Error opening PDF", e)
                withContext(Dispatchers.Main) {
                    _state.value = _state.value.copy(
                        isOpening = false,
                        extractionProgress = null,
                        errorMsg  = if (book.collection == "sichot" || book.collection == "mafteiach") "לא ניתן להמיר את הקובץ לטקסט: ${e.message ?: "שגיאה בקריאת הקובץ"}" else "לא ניתן לפתוח את \"${book.title}\". ייתכן שהקובץ הועבר או נמחק מהטלפון."
                    )
                }
            }
        }
    }

    fun importMafteachDocument(url: String, title: String, pageUrl: String, asText: Boolean) {
        if (_state.value.isOpening) return
        val key = runCatching { MafteachLinks.key(url) }.getOrElse {
            _state.value = _state.value.copy(errorMsg = it.message ?: "קישור לא נתמך")
            return
        }
        val existing = _state.value.books.firstOrNull {
            it.sourceUrl?.let { source -> runCatching { MafteachLinks.key(source) }.getOrNull() } == key &&
                (it.collection == "sichot" || it.collection == "mafteiach") == asText
        }
        if (existing != null) { openBook(existing.id); return }
        _state.value = _state.value.copy(isOpening = true, downloading = true, errorMsg = null, downloadProgress = null)
        openingJob = viewModelScope.launch(Dispatchers.IO) {
            try {
                val file = MafteachPdfDownloader(downloadsDir).download(url) { bytes, total ->
                    _state.value = _state.value.copy(downloadProgress = bytes to total)
                }
                withContext(Dispatchers.Main) {
                    val category = MafteachLinks.category(pageUrl)
                    val book = PdfBook(UUID.randomUUID().toString(), Uri.fromFile(file).toString(),
                        title.filterNot { it.isISOControl() }.trim().take(160).ifBlank { category },
                        collection = if (!asText) null else if (category == "לקוטי שיחות") "sichot" else "mafteiach",
                        sourceUrl = url, sourcePageUrl = pageUrl, sourceCategory = category)
                    saveBooks(_state.value.books + book)
                    _state.value = _state.value.copy(isOpening = false, downloading = false, downloadProgress = null)
                    makeMissingThumbnails()
                    openBook(book.id)
                }
            } catch (e: CancellationException) { throw e
            } catch (_: MafteachNonPdfException) {
                withContext(Dispatchers.Main) {
                    _state.value = _state.value.copy(isOpening = false, downloading = false,
                        downloadProgress = null, previewRemoteUrl = url)
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    _state.value = _state.value.copy(isOpening = false, downloading = false, downloadProgress = null,
                        errorMsg = "לא ניתן לפתוח את הקובץ: ${e.message}")
                }
            }
        }
    }

    fun clearRemotePreview() { _state.value = _state.value.copy(previewRemoteUrl = null) }

    fun cancelOpening() {
        ocrApproval?.complete(false)
        openingJob?.cancel()
        _state.value = _state.value.copy(isOpening = false, extractionProgress = null, ocrRequest = null, downloading = false, downloadProgress = null)
    }

    private suspend fun requestOcrApproval(book: PdfBook, page: Int): Boolean {
        val answer = CompletableDeferred<Boolean>()
        withContext(Dispatchers.Main) {
            ocrApproval = answer
            _state.value = _state.value.copy(ocrRequest = OcrRequest(book.id, book.title, page))
        }
        return try { answer.await() } finally {
            withContext(NonCancellable + Dispatchers.Main) {
                if (ocrApproval === answer) {
                    ocrApproval = null
                    _state.value = _state.value.copy(ocrRequest = null)
                }
            }
        }
    }

    fun approveOcr() {
        if (_state.value.ocrRequest != null) ocrApproval?.complete(true)
    }

    suspend fun saveSichaTextBlock(index: Int, text: String): Boolean {
        val book = _state.value.currentBook ?: return false
        val document = _state.value.sichaText ?: return false
        if (index !in document.blocks.indices || text.isBlank()) return false
        val blocks = document.blocks.toMutableList()
        val previous = blocks[index]
        blocks[index] = previous.copy(runs = listOf(SichaTextRun(text.trim(),
            if (previous.heading) "ocr-Bold" else "ocr", document.bodySize)), reviewed = true)
        val changed = document.copy(blocks = blocks)
        return try {
            withContext(Dispatchers.IO) {
                val file = File(sichaFontDirectory(book.id), "text.json")
                val temporary = File(file.parentFile, "text.json.tmp")
                temporary.writeText(gson.toJson(changed))
                check(temporary.renameTo(file))
            }
            _state.value = _state.value.copy(sichaText = changed)
            true
        } catch (e: CancellationException) { throw e
        } catch (_: Exception) { false }
    }

    fun closeBook() {
        val engine = _state.value.engine
        _state.value = _state.value.copy(currentBook = null, engine = null, sichaText = null)
        if (engine != null) viewModelScope.launch(Dispatchers.IO) { engine.close() }
    }

    fun sichaFontDirectory(bookId: String) = File(textDir, bookId)

    fun setSichaFontSize(size: Int) {
        val value = size.coerceIn(18, 40)
        prefs.edit().putInt("sicha_font_size", value).apply()
        _state.value = _state.value.copy(sichaFontSize = value)
    }

    fun saveSichaTextPosition(index: Int, offset: Int, page: Int) {
        val book = _state.value.currentBook ?: return
        if (book.sichaTextPosition == index && book.sichaTextOffset == offset && book.currentPage == page) return
        update(book.id) { it.copy(sichaTextPosition = index, sichaTextOffset = offset,
            currentPage = page, lastOpened = System.currentTimeMillis()) }
    }

    fun clearError() { _state.value = _state.value.copy(errorMsg = null) }

    // ── Reading position & bookmarks ──────────────────────────────────────────

    fun setPage(page: Int) {
        val book = _state.value.currentBook ?: return
        if (book.currentPage == page) return
        update(book.id) { it.copy(currentPage = page, lastOpened = System.currentTimeMillis()) }
    }

    fun toggleBookmark(page: Int) {
        val book = _state.value.currentBook ?: return
        val marks = (book.bookmarks ?: emptyList()).toMutableList()
        if (page in marks) marks.remove(page) else marks.add(page)
        update(book.id) { it.copy(bookmarks = marks.sorted()) }
    }

    // ── Reader settings (all books) ───────────────────────────────────────────

    private fun loadSettings() {
        val s = ReaderSettings(
            mode        = runCatching { ReadMode.valueOf(prefs.getString("reader_mode", null) ?: "") }.getOrDefault(ReadMode.PAGED),
            theme       = runCatching { PaperTheme.valueOf(prefs.getString("reader_theme", null) ?: "") }.getOrDefault(PaperTheme.WHITE),
            cropMargins = prefs.getBoolean("reader_crop", true)
        )
        _state.value = _state.value.copy(settings = s)
    }

    fun updateSettings(change: (ReaderSettings) -> ReaderSettings) {
        val s = change(_state.value.settings)
        prefs.edit()
            .putString("reader_mode", s.mode.name)
            .putString("reader_theme", s.theme.name)
            .putBoolean("reader_crop", s.cropMargins)
            .apply()
        _state.value = _state.value.copy(settings = s)
    }

    override fun onCleared() {
        super.onCleared()
        _state.value.engine?.let { eng -> Thread { eng.close() }.start() }
    }
}

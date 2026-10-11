package com.sterni.dailystudy.ui.screens.pdflibrary

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.RectF
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.util.LruCache
import android.util.SizeF
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.Closeable
import java.io.IOException
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * One open PDF: renders pages to bitmaps, safely and within a memory budget.
 *
 *  - PdfRenderer allows ONE open page at a time; every page access goes through [mutex]
 *    (fast swipes used to launch overlapping renders that failed silently).
 *  - Bitmaps live in an LRU cache sized by bytes (a fraction of the app's heap), widths are
 *    rounded to 64px so neighbouring zoom levels share entries, and a single page never
 *    exceeds [MAX_PIXELS].
 *  - [contentBounds] finds the printed area of a page (white margins cut off), from a small render.
 */
class PdfRenderEngine private constructor(
    private val pfd: ParcelFileDescriptor,
    private val renderer: PdfRenderer
) : Closeable {

    val pageCount: Int = renderer.pageCount

    private val mutex  = Mutex()
    private val sizes  = arrayOfNulls<SizeF>(pageCount)
    private val bounds = arrayOfNulls<RectF>(pageCount)
    private val sichaBounds = arrayOfNulls<List<SichaCrop?>>(pageCount)
    private var closed = false

    private val cache = object : LruCache<String, Bitmap>(cacheBytes()) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    /** Page size in PDF points. */
    suspend fun pageSize(index: Int): SizeF {
        sizes[index]?.let { return it }
        return withPage(index) { page -> SizeF(page.width.toFloat(), page.height.toFloat()) }
            .also { sizes[index] = it }
    }

    /** The printed part of the page, normalized 0..1; the whole page when nothing stands out. */
    suspend fun contentBounds(index: Int): RectF {
        bounds[index]?.let { return it }
        val full = RectF(0f, 0f, 1f, 1f)
        val r = try {
            val size = pageSize(index)
            val w = 240
            val h = max(1, (w * size.height / size.width).roundToInt())
            val bmp = withPage(index) { page ->
                Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also {
                    it.eraseColor(Color.WHITE)
                    page.render(it, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                }
            }
            val px = IntArray(w * h).also { bmp.getPixels(it, 0, w, 0, 0, w, h) }
            bmp.recycle()
            fun ink(p: Int): Boolean {
                val l = (Color.red(p) * 299 + Color.green(p) * 587 + Color.blue(p) * 114) / 1000
                return l < 225
            }
            var top = -1; var bottom = -1; var left = w; var right = -1
            for (y in 0 until h) {
                var any = false
                for (x in 0 until w) if (ink(px[y * w + x])) {
                    any = true
                    if (x < left) left = x
                    if (x > right) right = x
                }
                if (any) { if (top < 0) top = y; bottom = y }
            }
            if (top < 0 || right <= left) full
            else {
                val pad = 0.015f
                val rect = RectF(
                    max(0f, left / w.toFloat() - pad), max(0f, top / h.toFloat() - pad),
                    min(1f, (right + 1) / w.toFloat() + pad), min(1f, (bottom + 1) / h.toFloat() + pad)
                )
                // a nearly empty page (a lone page number) is shown whole, not blown up
                if (rect.width() * rect.height() < 0.15f) full else rect
            }
        } catch (e: Exception) { full }
        bounds[index] = r
        return r
    }

    /** Aspect (height / width) of what will be drawn for the page. */
    suspend fun aspect(index: Int, crop: Boolean): Float {
        val s = pageSize(index)
        val b = if (crop) contentBounds(index) else RectF(0f, 0f, 1f, 1f)
        return (b.height() * s.height) / (b.width() * s.width)
    }

    fun cached(index: Int, widthPx: Int, crop: Boolean): Bitmap? =
        cache.get(key(index, quantize(widthPx), crop))?.takeIf { !it.isRecycled }

    /** The page rendered [widthPx] wide (margins cut when [crop]). */
    suspend fun render(index: Int, widthPx: Int, crop: Boolean): Bitmap {
        val wq = quantize(widthPx)
        cached(index, wq, crop)?.let { return it }
        val size = pageSize(index)
        val b = if (crop) contentBounds(index) else RectF(0f, 0f, 1f, 1f)
        val srcW = b.width() * size.width
        val srcH = b.height() * size.height
        var w = wq
        var h = max(1, (w * srcH / srcW).roundToInt())
        if (w.toLong() * h > MAX_PIXELS) {
            val f = kotlin.math.sqrt(MAX_PIXELS.toDouble() / (w.toLong() * h)).toFloat()
            w = max(1, (w * f).roundToInt()); h = max(1, (h * f).roundToInt())
        }
        val scale = w / srcW
        val matrix = Matrix().apply {
            setScale(scale, scale)
            postTranslate(-b.left * size.width * scale, -b.top * size.height * scale)
        }
        val bmp = withPage(index) { page ->
            Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888).also {
                it.eraseColor(Color.WHITE)
                page.render(it, null, matrix, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            }
        }
        cache.put(key(index, wq, crop), bmp)
        return bmp
    }

    /** First page, small, for the library card. */
    suspend fun thumbnail(widthPx: Int): Bitmap = render(0, widthPx, crop = false)

    suspend fun sichaColumns(index: Int): List<SichaCrop?> {
        sichaBounds[index]?.let { return it }
        return withContext(Dispatchers.IO) {
            val bitmap = render(index, 640, crop = false)
            val pixels = IntArray(bitmap.width * bitmap.height)
            bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
            SichaLayout.detect(pixels, bitmap.width, bitmap.height).also { sichaBounds[index] = it }
        }
    }

    private suspend fun <T> withPage(index: Int, block: (PdfRenderer.Page) -> T): T =
        withContext(Dispatchers.IO) {
            mutex.withLock {
                if (closed) throw IOException("closed")
                val page = renderer.openPage(index)
                try { block(page) } finally { page.close() }
            }
        }

    override fun close() {
        // under the lock: a render still running must finish before the renderer goes
        kotlinx.coroutines.runBlocking {
            mutex.withLock {
                if (closed) return@withLock
                closed = true
                try { renderer.close() } catch (_: Exception) {}
                try { pfd.close() } catch (_: Exception) {}
            }
        }
        cache.evictAll()
    }

    private fun key(i: Int, w: Int, crop: Boolean) = "$i:$w:${if (crop) 1 else 0}"

    companion object {
        /** ~48MB for one page at most (a page zoomed in on a large phone). */
        private const val MAX_PIXELS = 12_000_000L

        private fun quantize(w: Int) = max(64, ((w + 63) / 64) * 64)

        private fun cacheBytes(): Int {
            val heap = Runtime.getRuntime().maxMemory()
            return max(24L * 1024 * 1024, heap / 6).coerceAtMost(Int.MAX_VALUE.toLong()).toInt()
        }

        /** Opens [uri]; throws when the file is gone or unreadable. */
        fun open(context: Context, uri: Uri): PdfRenderEngine {
            val pfd = context.contentResolver.openFileDescriptor(uri, "r")
                ?: throw IOException("Cannot open file")
            return try {
                PdfRenderEngine(pfd, PdfRenderer(pfd))
            } catch (e: Exception) {
                pfd.close(); throw e
            }
        }
    }
}

package com.sterni.dailystudy.ui.screens.pdflibrary

import android.content.Context
import android.graphics.Bitmap
import com.googlecode.tesseract.android.TessBaseAPI
import java.io.Closeable
import java.io.File
import kotlin.math.roundToInt
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive

/** One engine per import, lazily initialized; no network requests or document uploads. */
class SichaOcrEngine(private val context: Context) : Closeable {
    private var api: TessBaseAPI? = null

    suspend fun recognize(page: Int, render: PdfRenderEngine, directory: File, bodySize: Float): List<SichaTextBlock> {
        val coroutine = currentCoroutineContext()
        coroutine.ensureActive()
        val tess = api ?: run {
            val dataRoot = File(context.filesDir, "sicha_ocr").also { it.mkdirs() }
            val target = File(dataRoot, "tessdata/heb.traineddata")
            if (!target.exists()) {
                target.parentFile!!.mkdirs()
                val temporary = File(target.parentFile, "heb.traineddata.tmp")
                context.assets.open("tessdata/heb.traineddata").use { input -> temporary.outputStream().use { input.copyTo(it) } }
                check(temporary.renameTo(target)) { "לא ניתן להכין את מנוע הסריקה" }
            }
            lateinit var engine: TessBaseAPI
            engine = TessBaseAPI { if (!coroutine[kotlinx.coroutines.Job]!!.isActive) engine.stop() }
            if (!engine.init(dataRoot.absolutePath, "heb", TessBaseAPI.OEM_LSTM_ONLY)) {
                engine.recycle(); error("לא ניתן להפעיל זיהוי טקסט בעברית")
            }
            engine.pageSegMode = TessBaseAPI.PageSegMode.PSM_SINGLE_COLUMN
            engine.setVariable("user_defined_dpi", "300")
            api = engine
            engine
        }
        val size = render.pageSize(page)
        val original = render.render(page, (size.width * 300 / 72).roundToInt().coerceIn(1600, 2600), false)
        val bitmap = SichaScanPreprocessor.deskew(original)
        try {
            // Analyze at the same resolution as digital PDFs so padding and rule detection
            // remain consistent; OCR itself receives the high-resolution source pixels.
            val small = Bitmap.createScaledBitmap(bitmap, 640,
                (640f * bitmap.height / bitmap.width).roundToInt().coerceAtLeast(1), true)
            val pixels = IntArray(small.width * small.height)
            small.getPixels(pixels, 0, small.width, 0, 0, small.width, small.height)
            val regions = SichaLayout.detect(pixels, small.width, small.height)
            small.recycle()
            val blocks = mutableListOf<SichaTextBlock>()
            directory.mkdirs()
            for (regionIndex in listOf(2, 0, 1)) {
                coroutine.ensureActive()
                val crop = regions.getOrNull(regionIndex) ?: continue
                val left = (crop.left * bitmap.width).toInt().coerceIn(0, bitmap.width - 1)
                val top = (crop.top * bitmap.height).toInt().coerceIn(0, bitmap.height - 1)
                val w = ((crop.right - crop.left) * bitmap.width).roundToInt().coerceIn(1, bitmap.width - left)
                val h = ((crop.bottom - crop.top) * bitmap.height).roundToInt().coerceIn(1, bitmap.height - top)
                val image = Bitmap.createBitmap(bitmap, left, top, w, h)
                try {
                    tess.setImage(image)
                    tess.pageSegMode = if (regionIndex == 2) TessBaseAPI.PageSegMode.PSM_SINGLE_BLOCK else TessBaseAPI.PageSegMode.PSM_SINGLE_COLUMN
                    val hocr = tess.getHOCRText(page) ?: ""
                    coroutine.ensureActive()
                    val filename = "scan-${page + 1}-$regionIndex.jpg"
                    val parsed = SichaOcrParser.parse(hocr, page, if (regionIndex == 2) 0 else regionIndex,
                        image.width, image.height, filename, regionIndex == 2, bodySize)
                    if (parsed.isNotEmpty()) {
                        File(directory, filename).outputStream().use { image.compress(Bitmap.CompressFormat.JPEG, 92, it) }
                        blocks += parsed
                    }
                } finally {
                    tess.clear()
                    if (image !== bitmap) image.recycle()
                }
            }
            check(blocks.isNotEmpty()) { "לא ניתן לזהות טקסט בעמוד ${page + 1}. נסה סריקה חדה וישרה יותר." }
            return blocks
        } finally { if (bitmap !== original) bitmap.recycle() }
    }

    override fun close() { api?.recycle(); api = null }
}

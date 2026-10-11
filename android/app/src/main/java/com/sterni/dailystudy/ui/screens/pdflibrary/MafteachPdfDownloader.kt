package com.sterni.dailystudy.ui.screens.pdflibrary

import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.ensureActive
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import org.jsoup.Jsoup
import java.io.File
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

class MafteachNonPdfException : Exception()

/** Streams only the selected public document. Never downloads the entire archive. */
class MafteachPdfDownloader(private val directory: File) {
    suspend fun download(url: String, onProgress: (Long, Long?) -> Unit): File {
        val key = MafteachLinks.key(url)
        val name = MessageDigest.getInstance("SHA-256").digest(key.toByteArray()).joinToString("") { "%02x".format(it) } + ".pdf"
        directory.mkdirs()
        val destination = File(directory, name)
        if (destination.exists() && destination.inputStream().use { val prefix = ByteArray(5); it.read(prefix) == 5 && String(prefix, Charsets.US_ASCII) == "%PDF-" }) return destination
        val cookies = mutableListOf<Cookie>()
        val client = OkHttpClient.Builder().connectTimeout(25, TimeUnit.SECONDS).readTimeout(45, TimeUnit.SECONDS)
            .cookieJar(object : CookieJar {
                override fun loadForRequest(url: HttpUrl) = cookies.filter { it.matches(url) }
                override fun saveFromResponse(url: HttpUrl, values: List<Cookie>) { cookies += values }
            }).build()
        var requestUrl = MafteachLinks.downloadUrl(url)
        val temporary = File(directory, "$name.${java.util.UUID.randomUUID()}.part")
        try {
            repeat(3) {
                currentCoroutineContext().ensureActive()
                client.newCall(Request.Builder().url(requestUrl).header("User-Agent", "DailyStudy-MafteachReader/1.0").build()).execute().use { response ->
                    check(response.isSuccessful) { "לא ניתן להוריד את הקובץ (${response.code}). אפשר לפתוח את המקור." }
                    val body = response.body ?: error("התקבלה תשובה ריקה מהמקור")
                    val source = body.source()
                    if (!source.request(5)) throw MafteachNonPdfException()
                    val signature = source.buffer.clone().readUtf8(5)
                    if (signature != "%PDF-") {
                        // Google may return its public-file download confirmation instead of PDF.
                        // Follow only a form for the same file, on the exact Google download host.
                        if (body.contentType()?.subtype?.contains("html") != true) throw MafteachNonPdfException()
                        val htmlBytes = java.io.ByteArrayOutputStream()
                        val htmlBuffer = ByteArray(4096)
                        while (htmlBytes.size() < 128_000) {
                            currentCoroutineContext().ensureActive()
                            val count = source.read(htmlBuffer, 0, minOf(htmlBuffer.size, 128_000 - htmlBytes.size()))
                            if (count < 0) break
                            htmlBytes.write(htmlBuffer, 0, count)
                        }
                        val html = htmlBytes.toString("UTF-8")
                        val form = Jsoup.parse(html, response.request.url.toString()).selectFirst("form[action]")
                            ?: throw MafteachNonPdfException()
                        val action = form.absUrl("action").toHttpUrl()
                        check(action.isHttps && action.host == "drive.usercontent.google.com") { "הקובץ דורש פתיחה במקור" }
                        val fields = form.select("input[name]").associate { input -> input.attr("name") to input.attr("value") }
                        check(fields["id"] == MafteachLinks.driveId(url)) { "המקור לא החזיר את הקובץ המבוקש" }
                        requestUrl = action.newBuilder().apply { fields.forEach { (field, value) -> addQueryParameter(field, value) } }.build().toString()
                        return@use
                    }
                    val total = body.contentLength().takeIf { length -> length >= 0 }
                    check(total == null || total <= MAX_BYTES) { "הקובץ גדול מדי לקריאה מקומית. פתח אותו במקור." }
                    var bytes = 0L
                    temporary.outputStream().use { output ->
                        val buffer = ByteArray(64 * 1024)
                        while (true) {
                            currentCoroutineContext().ensureActive()
                            val count = source.read(buffer)
                            if (count < 0) break
                            currentCoroutineContext().ensureActive()
                            bytes += count
                            check(bytes <= MAX_BYTES) { "הקובץ גדול מדי לקריאה מקומית. פתח אותו במקור." }
                            output.write(buffer, 0, count)
                            onProgress(bytes, total)
                        }
                    }
                    currentCoroutineContext().ensureActive()
                    check(bytes > 5 && (total == null || bytes == total)) { "ההורדה לא הושלמה. נסה שוב." }
                    check(temporary.renameTo(destination)) { "לא ניתן לשמור את הקובץ במכשיר" }
                    return destination
                }
            }
            error("לא ניתן לקבל את הקובץ. אפשר לפתוח אותו במקור.")
        } finally { temporary.delete() }
    }

    companion object { private const val MAX_BYTES = 100L * 1024 * 1024 }
}

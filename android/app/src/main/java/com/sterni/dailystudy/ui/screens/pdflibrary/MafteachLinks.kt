package com.sterni.dailystudy.ui.screens.pdflibrary

import java.net.URI
import java.net.URLDecoder

/** Public source navigation and document URLs; no credentials or undocumented private API. */
object MafteachLinks {
    const val HOME = "https://www.mafteiach.app/likkutei_sichos/by_volume"
    private val siteHosts = setOf("www.mafteiach.app", "mafteiach.app")
    fun isSite(url: String): Boolean = runCatching {
        val uri = URI(url)
        uri.scheme == "https" && uri.host in siteHosts && uri.userInfo == null && uri.port in listOf(-1, 443)
    }.getOrDefault(false)

    fun driveId(url: String): String? = runCatching {
        val uri = URI(url)
        if (uri.scheme != "https" || uri.host != "drive.google.com" || uri.userInfo != null || uri.port !in listOf(-1, 443)) return null
        val pathId = Regex("^/file/d/([A-Za-z0-9_-]+)(?:/|$)").find(uri.path)?.groupValues?.get(1)
        val queryId = uri.rawQuery?.split('&')?.firstOrNull { it.substringBefore('=') == "id" }
            ?.substringAfter('=')?.let { URLDecoder.decode(it, "UTF-8") }
        (pathId ?: queryId)?.takeIf { it.matches(Regex("[A-Za-z0-9_-]{10,200}")) }
    }.getOrNull()

    fun isDocument(url: String) = driveId(url) != null ||
        (isSite(url) && URI(url).path.endsWith(".pdf", true))

    fun downloadUrl(url: String): String {
        driveId(url)?.let { return "https://drive.google.com/uc?export=download&id=$it" }
        require(isSite(url) && URI(url).path.endsWith(".pdf", true)) { "קישור ההורדה אינו נתמך. ניתן לצפות במקור." }
        return url
    }

    fun key(url: String) = driveId(url) ?: downloadUrl(url)
    fun category(pageUrl: String): String = when {
        "/likkutei_sichos" in pageUrl -> "לקוטי שיחות"
        "/maamorim" in pageUrl -> "מאמרים"
        "/hadranim" in pageUrl -> "הדרנים על הש״ס"
        "/michtavim" in pageUrl -> "מכתבים כלליים"
        "/yomanim" in pageUrl -> "יומנים"
        else -> "שיחות ומאמרים"
    }
}

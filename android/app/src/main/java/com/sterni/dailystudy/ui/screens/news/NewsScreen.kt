package com.sterni.dailystudy.ui.screens.news

import android.content.Intent
import android.net.Uri
import android.webkit.WebView
import android.widget.VideoView
import android.widget.MediaController
import androidx.compose.animation.*
import androidx.compose.foundation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.sterni.dailystudy.data.model.ArticleContent
import com.sterni.dailystudy.data.model.NewsItem
import com.sterni.dailystudy.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val PageBg  = Color(0xFFF2F2F7)
private val CardBg  = Color.White
private val Divider = Color(0xFFF0F0F0)

private val ChannelColors = mapOf(
    "amitsegal"      to (Color(0xFF38BDF8) to Color(0xFF0284C7)),
    "rotter"         to (Color(0xFFFB923C) to Color(0xFFEF4444)),
    "grinzaig"       to (Color(0xFFC084FC) to Color(0xFF9333EA)),
    "alexmehacarmel" to (Color(0xFF818CF8) to Color(0xFF2563EB)),
    "abualiexpress"  to (Color(0xFF34D399) to Color(0xFF059669))
)

private val ChannelLabels = mapOf(
    "amitsegal"      to "עמית סגל",
    "rotter"         to "רוטר",
    "grinzaig"       to "אבישי גרינצייג",
    "alexmehacarmel" to "אלכס מהכרמל",
    "abualiexpress"  to "אבו עלי אקספרס"
)

private fun timeAgo(dateStr: String?): String {
    if (dateStr == null) return ""
    return try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US),
            SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss Z", Locale.US)
        )
        formats.forEach { it.timeZone = TimeZone.getTimeZone("UTC") }
        val date = formats.firstNotNullOfOrNull { fmt ->
            try { fmt.parse(dateStr) } catch (_: Exception) { null }
        } ?: return ""
        val diff = (System.currentTimeMillis() - date.time) / 1000
        when {
            diff < 60    -> "עכשיו"
            diff < 3600  -> "${diff / 60}ד׳"
            diff < 86400 -> "${diff / 3600}ש׳"
            else         -> "${diff / 86400}י׳"
        }
    } catch (_: Exception) { "" }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsScreen(
    onBack: () -> Unit,
    vm: NewsViewModel = viewModel()
) {
    val state           by vm.state.collectAsStateWithLifecycle()
    val articleContents by vm.articleContents.collectAsStateWithLifecycle()
    val articleLoading  by vm.articleLoading.collectAsStateWithLifecycle()
    val articleErrors   by vm.articleErrors.collectAsStateWithLifecycle()
    val context         = LocalContext.current

    Scaffold(
        containerColor      = PageBg,
        contentWindowInsets = WindowInsets(0.dp),
        topBar = {
            Column(Modifier.background(CardBg)) {
                Spacer(Modifier.statusBarsPadding())
                Row(
                    modifier              = Modifier
                        .fillMaxWidth()
                        .height(54.dp)
                        .padding(horizontal = 4.dp),
                    verticalAlignment     = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזרה", tint = Ink, modifier = Modifier.size(20.dp))
                    }
                    Text(
                        text       = "חדשות",
                        modifier   = Modifier.weight(1f),
                        fontSize   = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SblHebrew,
                        color      = Ink
                    )
                    if (state.lastUpdated != null) {
                        val timeStr = remember(state.lastUpdated) {
                            SimpleDateFormat("HH:mm", Locale.US).format(Date(state.lastUpdated!!))
                        }
                        Row(
                            verticalAlignment     = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(5.dp),
                            modifier              = Modifier.padding(end = 4.dp)
                        ) {
                            Box(modifier = Modifier.size(6.dp).clip(CircleShape).background(Color(0xFF22C55E)))
                            Text(timeStr, fontSize = 12.sp, fontFamily = SblHebrew, color = Muted)
                        }
                    }
                    IconButton(onClick = { vm.loadFeed() }, enabled = !state.loading) {
                        Icon(
                            Icons.Default.Refresh,
                            contentDescription = "רענון",
                            tint               = if (state.loading) Muted.copy(alpha = 0.3f) else Ink,
                            modifier           = Modifier.size(20.dp)
                        )
                    }
                }
                HorizontalDivider(color = Divider, thickness = 0.5.dp)
            }
        }
    ) { padding ->
        Box(modifier = Modifier.fillMaxSize().padding(padding)) {
            when {
                state.error != null && state.items.isEmpty() -> {
                    Column(
                        modifier            = Modifier.align(Alignment.Center).padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Icon(Icons.Default.CloudOff, contentDescription = null, tint = Muted, modifier = Modifier.size(40.dp))
                        Text(state.error ?: "", fontSize = 15.sp, fontFamily = SblHebrew, color = Muted, textAlign = TextAlign.Center)
                        Button(
                            onClick = { vm.loadFeed() },
                            colors  = ButtonDefaults.buttonColors(containerColor = Primary),
                            shape   = RoundedCornerShape(10.dp)
                        ) {
                            Text("נסה שוב", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }

                state.loading && state.items.isEmpty() -> {
                    LazyColumn(
                        modifier            = Modifier.fillMaxSize(),
                        contentPadding      = PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(5) { SkeletonCard() }
                    }
                }

                else -> {
                    LazyColumn(
                        modifier            = Modifier.fillMaxSize(),
                        contentPadding      = PaddingValues(horizontal = 12.dp, vertical = 10.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(state.items, key = { it.id ?: it.hashCode() }) { item ->
                            NewsFeedCard(
                                item            = item,
                                articleContent  = articleContents[item.link],
                                articleLoading  = articleLoading.contains(item.link),
                                articleError    = articleErrors.contains(item.link),
                                onExpandArticle = { url -> vm.loadArticle(url) },
                                onOpenLink      = { url ->
                                    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                                }
                            )
                        }

                        item {
                            Box(
                                modifier         = Modifier.fillMaxWidth().padding(vertical = 28.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text("· · ·", fontSize = 16.sp, color = Color(0xFFD1D5DB), letterSpacing = 6.sp)
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Feed Card ─────────────────────────────────────────────────────────────────

@Composable
private fun NewsFeedCard(
    item: NewsItem,
    articleContent: ArticleContent?,
    articleLoading: Boolean,
    articleError: Boolean,
    onExpandArticle: (String) -> Unit,
    onOpenLink: (String) -> Unit
) {
    val sourceKey = if (item.source == "rotter") "rotter" else item.channel ?: ""
    val colors    = ChannelColors[sourceKey] ?: (Color(0xFF94A3B8) to Color(0xFF64748B))
    val label     = ChannelLabels[sourceKey] ?: sourceKey
    val isRecent  = try {
        val formats = listOf(
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US),
            SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US),
            SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss Z", Locale.US)
        )
        formats.forEach { it.timeZone = TimeZone.getTimeZone("UTC") }
        val date = formats.firstNotNullOfOrNull { fmt ->
            try { fmt.parse(item.date ?: "") } catch (_: Exception) { null }
        }
        date != null && (System.currentTimeMillis() - date.time) < 1800_000
    } catch (_: Exception) { false }

    var expanded by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(CardBg)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {

            // ── Meta ──────────────────────────────────────────────────────────
            Row(
                modifier          = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier         = Modifier
                        .size(40.dp)
                        .clip(CircleShape)
                        .background(Brush.linearGradient(listOf(colors.first, colors.second))),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text       = label.firstOrNull()?.toString() ?: "",
                        fontSize   = 15.sp,
                        fontWeight = FontWeight.Black,
                        color      = Color.White
                    )
                }

                Spacer(Modifier.width(10.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(label, fontSize = 13.sp, fontWeight = FontWeight.Bold, fontFamily = SblHebrew, color = Ink)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        if (isRecent) Box(modifier = Modifier.size(5.dp).clip(CircleShape).background(Color(0xFF22C55E)))
                        Text(
                            text       = timeAgo(item.date),
                            fontSize   = 11.sp,
                            fontFamily = SblHebrew,
                            color      = if (isRecent) Color(0xFF16A34A) else Muted
                        )
                    }
                }

                if (item.link != null) {
                    IconButton(onClick = { onOpenLink(item.link!!) }, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Muted.copy(alpha = 0.4f), modifier = Modifier.size(15.dp))
                    }
                }
            }

            Spacer(Modifier.height(10.dp))

            // ── Forwarded from ────────────────────────────────────────────────
            if (item.forwardedFrom != null) {
                Row(
                    modifier                  = Modifier.padding(bottom = 8.dp),
                    verticalAlignment         = Alignment.CenterVertically,
                    horizontalArrangement     = Arrangement.spacedBy(4.dp)
                ) {
                    Icon(Icons.Default.Reply, contentDescription = null, tint = Muted.copy(0.4f), modifier = Modifier.size(12.dp))
                    Text("הועבר מ ${item.forwardedFrom?.name ?: ""}", fontSize = 11.sp, fontFamily = SblHebrew, color = Muted.copy(alpha = 0.6f))
                }
            }

            // ── Reply quote ───────────────────────────────────────────────────
            if (item.replyText != null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                        .clip(RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp))
                        .background(Color(0xFFF8F8F8))
                ) {
                    Box(
                        modifier = Modifier
                            .width(3.dp)
                            .defaultMinSize(minHeight = 36.dp)
                            .height(IntrinsicSize.Min)
                            .background(Brush.verticalGradient(listOf(colors.first, colors.second)))
                    )
                    Text(
                        text       = item.replyText ?: "",
                        modifier   = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                        fontSize   = 13.sp,
                        fontFamily = SblHebrew,
                        color      = Muted,
                        maxLines   = 2,
                        overflow   = TextOverflow.Ellipsis,
                        lineHeight = 19.sp,
                        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )
                }
            }

            // ── Text ──────────────────────────────────────────────────────────
            if (!item.text.isNullOrBlank()) {
                Text(
                    text       = item.text!!,
                    fontSize   = 15.sp,
                    fontFamily = SblHebrew,
                    color      = Ink,
                    lineHeight = 24.sp,
                    style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl),
                    modifier   = Modifier.padding(bottom = if (item.image != null || item.video != null) 10.dp else 0.dp)
                )
            }
        }

        // ── Image (full-width, clipped to card bottom corners if last element) ──
        if (item.image != null && item.video == null) {
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(item.image)
                    .addHeader("Referer", "https://t.me/")
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                contentScale       = ContentScale.Crop,
                modifier           = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 300.dp)
                    .background(Color(0xFFF1F5F9))
            )
        }

        // ── Video ─────────────────────────────────────────────────────────────
        if (item.video != null) {
            var playing by remember { mutableStateOf(false) }
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 260.dp)
                    .background(Color.Black)
            ) {
                if (playing) {
                    AndroidView(
                        factory = { ctx ->
                            VideoView(ctx).apply {
                                setVideoURI(Uri.parse(item.video))
                                val mc = MediaController(ctx)
                                mc.setAnchorView(this)
                                setMediaController(mc)
                                requestFocus()
                                start()
                            }
                        },
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    if (item.videoThumb != null) {
                        AsyncImage(
                            model = ImageRequest.Builder(LocalContext.current)
                                .data(item.videoThumb)
                                .addHeader("Referer", "https://t.me/")
                                .crossfade(true)
                                .build(),
                            contentDescription = null,
                            contentScale       = ContentScale.Crop,
                            modifier           = Modifier.fillMaxWidth()
                        )
                    }
                    Box(
                        modifier         = Modifier
                            .align(Alignment.Center)
                            .size(54.dp)
                            .clip(CircleShape)
                            .background(Color.Black.copy(alpha = 0.45f))
                            .clickable { playing = true },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(Icons.Default.PlayArrow, contentDescription = "נגן", tint = Color.White, modifier = Modifier.size(30.dp))
                    }
                }
            }
        }

        // ── Title + expand (Rotter) ───────────────────────────────────────────
        if (item.title != null) {
            Column(modifier = Modifier.padding(horizontal = 14.dp, vertical = if (item.image != null || item.video != null) 12.dp else 0.dp)) {
                if (item.image != null || item.video != null) Spacer(Modifier.height(0.dp))
                Row(
                    modifier          = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(6.dp))
                        .clickable {
                            expanded = !expanded
                            if (expanded && item.link != null && articleContent == null) onExpandArticle(item.link!!)
                        },
                    verticalAlignment = Alignment.Top
                ) {
                    Text(
                        text       = item.title!!,
                        modifier   = Modifier.weight(1f),
                        fontSize   = 15.sp,
                        fontWeight = FontWeight.Medium,
                        fontFamily = SblHebrew,
                        color      = Ink,
                        lineHeight = 23.sp,
                        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )
                    Spacer(Modifier.width(6.dp))
                    Icon(
                        if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                        contentDescription = null,
                        tint     = Muted.copy(alpha = 0.4f),
                        modifier = Modifier.size(20.dp).padding(top = 2.dp)
                    )
                }
            }
        }

        // ── Expanded article ──────────────────────────────────────────────────
        AnimatedVisibility(visible = expanded && item.source == "rotter") {
            Column(modifier = Modifier.padding(horizontal = 14.dp).padding(top = 12.dp, bottom = 14.dp)) {
                HorizontalDivider(color = Divider, thickness = 0.5.dp, modifier = Modifier.padding(bottom = 14.dp))
                when {
                    articleLoading -> Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        listOf(1f, 0.88f, 0.65f).forEach { w ->
                            Box(modifier = Modifier.fillMaxWidth(w).height(13.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFF4F4F5)))
                        }
                    }
                    articleError -> Column(
                        modifier            = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color(0xFFFFF1F2)).padding(14.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Text("שגיאה בטעינת הכתבה", fontSize = 13.sp, fontFamily = SblHebrew, color = Color(0xFFDC2626))
                        if (item.link != null) {
                            Text("פתח במקור ↗", fontSize = 12.sp, fontFamily = SblHebrew, color = Color(0xFFEF4444),
                                modifier = Modifier.clickable { onOpenLink(item.link!!) })
                        }
                    }
                    articleContent != null -> ArticleContentView(content = articleContent, articleUrl = item.link, onOpenLink = onOpenLink)
                }
            }
        }

        // Bottom padding when no extra content
        if (item.title == null && item.image == null && item.video == null) Spacer(Modifier.height(14.dp))
    }
}

// ── Article Content ───────────────────────────────────────────────────────────

@Composable
private fun ArticleContentView(
    content: ArticleContent,
    articleUrl: String?,
    onOpenLink: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        content.images?.forEach { imgUrl ->
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current).data(imgUrl).crossfade(true).build(),
                contentDescription = null,
                contentScale = ContentScale.FillWidth,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(Color(0xFFF8FAFC))
            )
        }

        content.youtubeEmbeds?.forEach { embed ->
            if (embed.videoId != null) {
                AndroidView(
                    factory = { ctx ->
                        WebView(ctx).apply {
                            settings.javaScriptEnabled = true
                            settings.mediaPlaybackRequiresUserGesture = false
                            loadUrl("https://www.youtube.com/embed/${embed.videoId}?playsinline=1")
                        }
                    },
                    modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(10.dp))
                )
            }
        }

        content.twitterEmbeds?.forEach { tweetUrl ->
            val html = """
                <html><head><meta name="viewport" content="width=device-width, initial-scale=1">
                <style>body{margin:0;padding:0;background:#fff;}</style></head>
                <body><blockquote class="twitter-tweet" data-lang="he"><a href="$tweetUrl"></a></blockquote>
                <script async src="https://platform.twitter.com/widgets.js"></script></body></html>
            """.trimIndent()
            AndroidView(
                factory = { ctx ->
                    WebView(ctx).apply {
                        settings.javaScriptEnabled = true
                        settings.domStorageEnabled = true
                        loadDataWithBaseURL("https://twitter.com", html, "text/html", "utf-8", null)
                    }
                },
                modifier = Modifier.fillMaxWidth().height(280.dp).clip(RoundedCornerShape(10.dp))
            )
        }

        if (!content.text.isNullOrBlank()) {
            Text(
                text       = content.text!!,
                fontSize   = 14.sp,
                fontFamily = SblHebrew,
                color      = Color(0xFF374151),
                lineHeight = 24.sp,
                style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
            )
        }

        if (!content.comments.isNullOrEmpty()) {
            HorizontalDivider(color = Divider, thickness = 0.5.dp)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("תגובות", fontSize = 12.sp, fontWeight = FontWeight.Bold, fontFamily = SblHebrew, color = Ink)
                Text("${content.comments!!.size}", fontSize = 11.sp, fontFamily = SblHebrew, color = Muted)
            }
            content.comments!!.forEachIndexed { i, comment ->
                Row(
                    modifier              = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(Color(0xFFF8F8F8)).padding(10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text("${i + 1}", fontSize = 11.sp, fontFamily = SblHebrew, color = Muted, modifier = Modifier.width(18.dp))
                    Text(comment, fontSize = 13.sp, fontFamily = SblHebrew, color = Color(0xFF4B5563), lineHeight = 20.sp,
                        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl))
                }
            }
        }

        if (articleUrl != null) {
            Row(
                modifier              = Modifier.clip(RoundedCornerShape(6.dp)).clickable { onOpenLink(articleUrl) }.padding(vertical = 2.dp),
                verticalAlignment     = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Text("קריאה במקור", fontSize = 12.sp, fontFamily = SblHebrew, color = Primary)
                Icon(Icons.Default.OpenInNew, contentDescription = null, tint = Primary, modifier = Modifier.size(11.dp))
            }
        }
    }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

@Composable
private fun SkeletonCard() {
    Column(
        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(CardBg).padding(14.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(40.dp).clip(CircleShape).background(Color(0xFFEEEEEE)))
            Spacer(Modifier.width(10.dp))
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Box(modifier = Modifier.width(88.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFEEEEEE)))
                Box(modifier = Modifier.width(50.dp).height(10.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFF4F4F5)))
            }
        }
        Spacer(Modifier.height(14.dp))
        listOf(1f, 0.9f, 0.7f).forEach { w ->
            Box(modifier = Modifier.fillMaxWidth(w).height(13.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFEEEEEE)))
            Spacer(Modifier.height(8.dp))
        }
    }
}

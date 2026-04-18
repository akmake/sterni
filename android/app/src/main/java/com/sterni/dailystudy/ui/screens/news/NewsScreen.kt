package com.sterni.dailystudy.ui.screens.news

import android.content.Intent
import android.net.Uri
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
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import coil.request.ImageRequest
import com.sterni.dailystudy.data.model.ArticleContent
import com.sterni.dailystudy.data.model.NewsItem
import com.sterni.dailystudy.ui.theme.*
import java.text.SimpleDateFormat
import java.util.*

private val PageBg = Color(0xFFF8FAFC)

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
            diff < 3600  -> "לפני ${diff / 60} דק'"
            diff < 86400 -> "לפני ${diff / 3600} שע'"
            else         -> "לפני ${diff / 86400} ימים"
        }
    } catch (_: Exception) { "" }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NewsScreen(
    onBack: () -> Unit,
    vm: NewsViewModel = viewModel()
) {
    val state          by vm.state.collectAsStateWithLifecycle()
    val articleContents by vm.articleContents.collectAsStateWithLifecycle()
    val articleLoading  by vm.articleLoading.collectAsStateWithLifecycle()
    val articleErrors   by vm.articleErrors.collectAsStateWithLifecycle()
    val context        = LocalContext.current

    Scaffold(
        containerColor = PageBg,
        contentWindowInsets = WindowInsets(0.dp),
        topBar = {
            Surface(
                color = Color.White,
                shadowElevation = 2.dp
            ) {
                Column(modifier = Modifier.statusBarsPadding()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 4.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowBack,
                                contentDescription = "חזרה",
                                tint = Ink
                            )
                        }

                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "פיד חדשות",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Black,
                                fontFamily = BaHaYetzira,
                                color = Ink
                            )
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                if (state.items.isNotEmpty()) {
                                    Surface(
                                        shape = RoundedCornerShape(4.dp),
                                        color = Color(0xFFF1F5F9),
                                    ) {
                                        Text(
                                            text = "${state.items.size} פריטים",
                                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.SemiBold,
                                            fontFamily = SblHebrew,
                                            color = Muted
                                        )
                                    }
                                    Spacer(Modifier.width(6.dp))
                                }
                                if (state.lastUpdated != null) {
                                    Box(
                                        modifier = Modifier
                                            .size(6.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFF22C55E))
                                    )
                                    Spacer(Modifier.width(4.dp))
                                    val timeStr = remember(state.lastUpdated) {
                                        val sdf = SimpleDateFormat("HH:mm", Locale.US)
                                        sdf.format(Date(state.lastUpdated!!))
                                    }
                                    Text(
                                        text = "עודכן $timeStr",
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.SemiBold,
                                        fontFamily = SblHebrew,
                                        color = Muted
                                    )
                                }
                            }
                        }

                        IconButton(
                            onClick = { vm.loadFeed() },
                            enabled = !state.loading
                        ) {
                            Icon(
                                Icons.Default.Refresh,
                                contentDescription = "רענון",
                                tint = if (state.loading) Muted else Ink,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                    }
                }
            }
        }
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                state.error != null && state.items.isEmpty() -> {
                    Column(
                        modifier = Modifier.align(Alignment.Center).padding(32.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Icon(
                            Icons.Default.CloudOff,
                            contentDescription = null,
                            tint = Muted,
                            modifier = Modifier.size(48.dp)
                        )
                        Spacer(Modifier.height(12.dp))
                        Text(
                            state.error ?: "",
                            fontSize = 16.sp,
                            fontFamily = SblHebrew,
                            color = Muted,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(16.dp))
                        Button(
                            onClick = { vm.loadFeed() },
                            colors = ButtonDefaults.buttonColors(containerColor = Primary),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Text("נסה שוב", fontFamily = SblHebrew)
                        }
                    }
                }

                state.loading && state.items.isEmpty() -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(5) {
                            SkeletonCard()
                        }
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
                        verticalArrangement = Arrangement.spacedBy(16.dp)
                    ) {
                        items(state.items, key = { it.id ?: it.hashCode() }) { item ->
                            NewsFeedCard(
                                item = item,
                                articleContent = articleContents[item.link],
                                articleLoading = articleLoading.contains(item.link),
                                articleError = articleErrors.contains(item.link),
                                onExpandArticle = { url -> vm.loadArticle(url) },
                                onOpenLink = { url ->
                                    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                    context.startActivity(intent)
                                }
                            )
                        }

                        item {
                            // End of feed indicator
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(vertical = 24.dp),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(CircleShape)
                                        .border(1.dp, Color(0xFFE2E8F0), CircleShape),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Box(
                                        modifier = Modifier
                                            .size(5.dp)
                                            .clip(CircleShape)
                                            .background(Color(0xFFCBD5E1))
                                    )
                                }
                                Spacer(Modifier.height(10.dp))
                                Text(
                                    "סיימנו, להשתמע!",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = SblHebrew,
                                    color = Color(0xFFA0AEC0),
                                    letterSpacing = 1.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Feed Card ────────────────────────────────────────────────────────────────

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
    val colors = ChannelColors[sourceKey] ?: (Color(0xFF94A3B8) to Color(0xFF64748B))
    val label = ChannelLabels[sourceKey] ?: sourceKey
    val isRecent = try {
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

    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 2.dp,
        border = BorderStroke(0.5.dp, Color(0xFFE2E8F0))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            // ── Meta row ──
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Channel icon
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Brush.linearGradient(listOf(colors.first, colors.second))),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = label.firstOrNull()?.toString() ?: "",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Black,
                        color = Color.White
                    )
                }

                Spacer(Modifier.width(10.dp))

                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = label,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SblHebrew,
                        color = Ink
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        if (isRecent) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF22C55E))
                            )
                            Spacer(Modifier.width(4.dp))
                        }
                        Text(
                            text = timeAgo(item.date),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = SblHebrew,
                            color = if (isRecent) Color(0xFF16A34A) else Muted
                        )
                    }
                }

                // Open link button
                if (item.link != null) {
                    IconButton(
                        onClick = { onOpenLink(item.link!!) },
                        modifier = Modifier.size(32.dp)
                    ) {
                        Icon(
                            Icons.Default.OpenInNew,
                            contentDescription = "צפייה במקור",
                            tint = Muted,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // ── Forwarded from ──
            if (item.forwardedFrom != null) {
                Surface(
                    shape = RoundedCornerShape(8.dp),
                    color = Color(0xFFF8FAFC),
                    border = BorderStroke(0.5.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier.padding(bottom = 8.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(
                            Icons.Default.Reply,
                            contentDescription = null,
                            tint = Muted,
                            modifier = Modifier.size(14.dp)
                        )
                        Spacer(Modifier.width(6.dp))
                        Text(
                            text = "הועבר מ ",
                            fontSize = 11.sp,
                            fontFamily = SblHebrew,
                            color = Muted
                        )
                        Text(
                            text = item.forwardedFrom?.name ?: "",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            fontFamily = SblHebrew,
                            color = Ink
                        )
                    }
                }
            }

            // ── Reply quote ──
            if (item.replyText != null) {
                Surface(
                    shape = RoundedCornerShape(12.dp),
                    color = Color(0xFFF8FAFC),
                    border = BorderStroke(0.5.dp, Color(0xFFE2E8F0)),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(bottom = 10.dp)
                ) {
                    Row(modifier = Modifier.fillMaxWidth()) {
                        Box(
                            modifier = Modifier
                                .width(3.dp)
                                .height(IntrinsicSize.Min)
                                .defaultMinSize(minHeight = 32.dp)
                                .clip(RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp))
                                .background(Brush.verticalGradient(listOf(Color(0xFF60A5FA), Color(0xFF6366F1))))
                        )
                        Text(
                            text = item.replyText ?: "",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp),
                            fontSize = 13.sp,
                            fontFamily = SblHebrew,
                            color = Color(0xFF475569),
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                            lineHeight = 18.sp,
                            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                        )
                    }
                }
            }

            // ── Text content (Telegram) ──
            if (!item.text.isNullOrBlank()) {
                Text(
                    text = item.text!!,
                    fontSize = 14.sp,
                    fontFamily = SblHebrew,
                    color = Ink,
                    lineHeight = 22.sp,
                    fontWeight = FontWeight.Medium,
                    style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl),
                    modifier = Modifier.padding(bottom = 10.dp)
                )
            }

            // ── Image ──
            if (item.image != null && item.video == null) {
                AsyncImage(
                    model = ImageRequest.Builder(LocalContext.current)
                        .data(item.image)
                        .crossfade(true)
                        .build(),
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 300.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF1F5F9))
                        .padding(bottom = 10.dp)
                )
            }

            // ── Video thumbnail ──
            if (item.video != null) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .heightIn(max = 280.dp)
                        .clip(RoundedCornerShape(14.dp))
                        .background(Color(0xFFF1F5F9))
                        .clickable { item.link?.let { onOpenLink(it) } }
                        .padding(bottom = 10.dp)
                ) {
                    if (item.videoThumb != null) {
                        AsyncImage(
                            model = ImageRequest.Builder(LocalContext.current)
                                .data(item.videoThumb)
                                .crossfade(true)
                                .build(),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    // Play button overlay
                    Box(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .size(52.dp)
                            .clip(CircleShape)
                            .background(Color.White.copy(alpha = 0.8f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            Icons.Default.PlayArrow,
                            contentDescription = "נגן סרטון",
                            tint = Ink,
                            modifier = Modifier.size(28.dp)
                        )
                    }
                }
            }

            // ── Rotter title (expandable) ──
            if (item.title != null) {
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(8.dp))
                        .clickable {
                            expanded = !expanded
                            if (expanded && item.link != null && articleContent == null) {
                                onExpandArticle(item.link!!)
                            }
                        },
                    color = Color.Transparent
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = item.title!!,
                            modifier = Modifier.weight(1f),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = SblHebrew,
                            color = Ink,
                            lineHeight = 22.sp,
                            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                        )
                        Spacer(Modifier.width(8.dp))
                        Box(
                            modifier = Modifier
                                .size(28.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFF1F5F9))
                                .border(0.5.dp, Color(0xFFE2E8F0), CircleShape),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                if (expanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                                contentDescription = null,
                                tint = Muted,
                                modifier = Modifier.size(18.dp)
                            )
                        }
                    }
                }
            }

            // ── Expanded article content ──
            AnimatedVisibility(visible = expanded && item.source == "rotter") {
                Column(modifier = Modifier.padding(top = 12.dp)) {
                    HorizontalDivider(
                        color = Color(0xFFE2E8F0),
                        thickness = 0.5.dp,
                        modifier = Modifier.padding(bottom = 12.dp)
                    )

                    when {
                        articleLoading -> {
                            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                repeat(3) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxWidth(if (it == 2) 0.6f else (0.9f - it * 0.05f))
                                            .height(14.dp)
                                            .clip(RoundedCornerShape(4.dp))
                                            .background(Color(0xFFF1F5F9))
                                    )
                                }
                            }
                        }

                        articleError -> {
                            Surface(
                                shape = RoundedCornerShape(12.dp),
                                color = Color(0xFFFEF2F2),
                                border = BorderStroke(0.5.dp, Color(0xFFFECACA))
                            ) {
                                Column(
                                    modifier = Modifier.padding(16.dp),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Text(
                                        "שגיאה בטעינת תוכן הכתבה",
                                        fontSize = 13.sp,
                                        fontFamily = SblHebrew,
                                        color = Color(0xFFDC2626)
                                    )
                                    if (item.link != null) {
                                        Spacer(Modifier.height(8.dp))
                                        Text(
                                            "מעבר לכתבה המקורית ↗",
                                            fontSize = 12.sp,
                                            fontFamily = SblHebrew,
                                            color = Color(0xFFEF4444),
                                            modifier = Modifier.clickable { onOpenLink(item.link!!) }
                                        )
                                    }
                                }
                            }
                        }

                        articleContent != null -> {
                            ArticleContentView(
                                content = articleContent,
                                articleUrl = item.link,
                                onOpenLink = onOpenLink
                            )
                        }
                    }
                }
            }
        }
    }
}

// ── Article Content View ────────────────────────────────────────────────────

@Composable
private fun ArticleContentView(
    content: ArticleContent,
    articleUrl: String?,
    onOpenLink: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        // Images
        content.images?.forEach { imgUrl ->
            AsyncImage(
                model = ImageRequest.Builder(LocalContext.current)
                    .data(imgUrl)
                    .crossfade(true)
                    .build(),
                contentDescription = null,
                contentScale = ContentScale.FillWidth,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(Color(0xFFF8FAFC))
                    .border(0.5.dp, Color(0xFFE2E8F0), RoundedCornerShape(14.dp))
            )
        }

        // Text body
        if (!content.text.isNullOrBlank()) {
            Text(
                text = content.text!!,
                fontSize = 14.sp,
                fontFamily = SblHebrew,
                color = Color(0xFF334155),
                lineHeight = 24.sp,
                fontWeight = FontWeight.Medium,
                style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
            )
        }

        // Comments
        if (!content.comments.isNullOrEmpty()) {
            HorizontalDivider(color = Color(0xFFE2E8F0), thickness = 0.5.dp)

            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "תגובות נבחרות",
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SblHebrew,
                    color = Ink
                )
                Spacer(Modifier.weight(1f))
                Surface(
                    shape = RoundedCornerShape(4.dp),
                    color = Color(0xFFF8FAFC),
                    border = BorderStroke(0.5.dp, Color(0xFFE2E8F0))
                ) {
                    Text(
                        "${content.comments!!.size}",
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        fontSize = 10.sp,
                        fontFamily = SblHebrew,
                        color = Muted
                    )
                }
            }

            content.comments!!.forEachIndexed { index, comment ->
                Surface(
                    shape = RoundedCornerShape(10.dp),
                    color = Color(0xFFF8FAFC),
                    border = BorderStroke(0.5.dp, Color(0xFFE2E8F0))
                ) {
                    Row(modifier = Modifier.padding(10.dp)) {
                        Text(
                            "${index + 1}.",
                            fontSize = 11.sp,
                            fontFamily = SblHebrew,
                            color = Muted,
                            modifier = Modifier.width(20.dp)
                        )
                        Text(
                            comment,
                            fontSize = 13.sp,
                            fontFamily = SblHebrew,
                            color = Color(0xFF475569),
                            lineHeight = 20.sp,
                            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                        )
                    }
                }
            }
        }

        // Link to source
        if (articleUrl != null) {
            Surface(
                modifier = Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable { onOpenLink(articleUrl) },
                color = Color.Transparent
            ) {
                Row(
                    modifier = Modifier.padding(vertical = 4.dp, horizontal = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "לקריאה במקור: רוטר.נט",
                        fontSize = 12.sp,
                        fontFamily = SblHebrew,
                        color = Muted
                    )
                    Spacer(Modifier.width(4.dp))
                    Icon(
                        Icons.Default.OpenInNew,
                        contentDescription = null,
                        tint = Muted,
                        modifier = Modifier.size(12.dp)
                    )
                }
            }
        }
    }
}

// ── Skeleton Card ──────────────────────────────────────────────────────────

@Composable
private fun SkeletonCard() {
    Surface(
        shape = RoundedCornerShape(20.dp),
        color = Color.White,
        shadowElevation = 1.dp,
        border = BorderStroke(0.5.dp, Color(0xFFE2E8F0))
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0xFFF1F5F9))
                )
                Spacer(Modifier.width(10.dp))
                Column {
                    Box(
                        modifier = Modifier
                            .width(80.dp)
                            .height(12.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFFF1F5F9))
                    )
                    Spacer(Modifier.height(6.dp))
                    Box(
                        modifier = Modifier
                            .width(50.dp)
                            .height(8.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFFF8FAFC))
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(12.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFFF1F5F9))
            )
            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.85f)
                    .height(12.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFFF1F5F9))
            )
            Spacer(Modifier.height(8.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.6f)
                    .height(12.dp)
                    .clip(RoundedCornerShape(4.dp))
                    .background(Color(0xFFF8FAFC))
            )
        }
    }
}

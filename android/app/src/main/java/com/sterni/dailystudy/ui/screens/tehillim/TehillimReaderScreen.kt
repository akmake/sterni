package com.sterni.dailystudy.ui.screens.tehillim

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.snapshotFlow
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.data.local.TehillimRepository
import com.sterni.dailystudy.data.model.TehillimChapter
import com.sterni.dailystudy.data.model.TehillimVerse
import com.sterni.dailystudy.sync.UserManager
import com.sterni.dailystudy.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

// ── Hebrew Number Helpers (Exact match to server studyController.js) ──────────

private fun getHebrewOrdinal(n: Int): String {
    if (n <= 0) return n.toString()
    var h = ""
    var temp = n
    if (temp >= 400) { h += "ת"; temp -= 400 }
    if (temp >= 300) { h += "ש"; temp -= 300 }
    if (temp >= 200) { h += "ר"; temp -= 200 }
    if (temp >= 100) { h += "ק"; temp -= 100 }

    if (temp == 15) return h + "טו"
    if (temp == 16) return h + "טז"

    if (temp >= 90) { h += "צ"; temp -= 90 }
    else if (temp >= 80) { h += "פ"; temp -= 80 }
    else if (temp >= 70) { h += "ע"; temp -= 70 }
    else if (temp >= 60) { h += "ס"; temp -= 60 }
    else if (temp >= 50) { h += "נ"; temp -= 50 }
    else if (temp >= 40) { h += "מ"; temp -= 40 }
    else if (temp >= 30) { h += "ל"; temp -= 30 }
    else if (temp >= 20) { h += "כ"; temp -= 20 }
    else if (temp >= 10) { h += "י"; temp -= 10 }

    val ones = arrayOf("", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט")
    if (temp > 0) h += ones[temp]

    return h
}

// ── Flattened Reader Item Hierarchy ──────────────────────────────────────────

private sealed class TehillimReaderItem {
    abstract val chapterNum: Int

    data class ChapterHeader(
        override val chapterNum: Int
    ) : TehillimReaderItem()

    data class ChapterBody(
        override val chapterNum: Int,
        val verses: List<TehillimVerse>
    ) : TehillimReaderItem()
}

// ── Screen Implementation ────────────────────────────────────────────────────

@Composable
fun TehillimReaderScreen(
    initialChapter: Int = 1,
    chapterList: List<Int> = emptyList(),
    displayTitle: String = "",
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val repository = remember { TehillimRepository(context) }
    val studyPrefs = remember { context.getSharedPreferences("StudyPrefs", Context.MODE_PRIVATE) }
    val coroutineScope = rememberCoroutineScope()

    // Sync on entry and exit across devices
    LaunchedEffect(Unit) {
        UserManager.triggerSync(context)
    }

    DisposableEffect(Unit) {
        onDispose {
            UserManager.triggerSync(context)
        }
    }

    // Preferences for font & auto-scroll (matching StudyDetailScreen keys)
    val fontSize = remember { mutableIntStateOf(studyPrefs.getInt("font_tehillim", 20)) }
    val scrollSpeed = remember { mutableIntStateOf(studyPrefs.getInt("scroll_speed", 40)) }
    var autoScrolling by remember { mutableStateOf(false) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    // Chapters to display: if empty list, load all 150 chapters for free continuous scroll
    val chapters = remember(chapterList) {
        if (chapterList.isNotEmpty()) {
            repository.getChapters(chapterList)
        } else {
            repository.getAllChapters()
        }
    }

    // Flatten all chapters into exact StudyDetailScreen structure:
    // 1. HeaderRow: "פרק כג"
    // 2. VerseRow: Flowing paragraph with inline "(א) ... (ב) ..."
    val flatItems = remember(chapters) {
        val list = mutableListOf<TehillimReaderItem>()
        chapters.forEach { ch ->
            list.add(TehillimReaderItem.ChapterHeader(ch.chapter))
            list.add(TehillimReaderItem.ChapterBody(ch.chapter, ch.verses))
        }
        list
    }

    // Lookup table from chapter number to item index of its HeaderRow
    val chapterHeaderIndices = remember(flatItems) {
        flatItems.mapIndexedNotNull { index, item ->
            if (item is TehillimReaderItem.ChapterHeader) item.chapterNum to index else null
        }.toMap()
    }

    val listState = rememberLazyListState()
    var scrollRestored by remember { mutableStateOf(false) }
    var currentVisibleChapter by remember { mutableIntStateOf(if (initialChapter > 0) initialChapter else 1) }

    val isContinueMode = displayTitle.contains("המשך") || initialChapter <= 0

    // Initial scroll position restoration
    LaunchedEffect(flatItems.isNotEmpty()) {
        if (flatItems.isNotEmpty() && !scrollRestored) {
            if (isContinueMode) {
                val savedIdx = repository.getLastScrollIndex()
                val savedOff = repository.getLastScrollOffset()
                if (savedIdx in flatItems.indices) {
                    listState.scrollToItem(savedIdx, savedOff)
                    val item = flatItems[savedIdx]
                    currentVisibleChapter = item.chapterNum
                } else if (initialChapter in chapterHeaderIndices) {
                    val idx = chapterHeaderIndices[initialChapter] ?: 0
                    listState.scrollToItem(idx, 0)
                }
            } else {
                val targetIdx = chapterHeaderIndices[initialChapter] ?: 0
                listState.scrollToItem(targetIdx, 0)
            }
            scrollRestored = true
        }
    }

    // Track scroll position continuously and persist where user stopped
    LaunchedEffect(listState) {
        snapshotFlow { Pair(listState.firstVisibleItemIndex, listState.firstVisibleItemScrollOffset) }
            .distinctUntilChanged()
            .collect { (idx, off) ->
                if (scrollRestored && idx in flatItems.indices) {
                    val item = flatItems[idx]
                    val ch = item.chapterNum
                    currentVisibleChapter = ch
                    repository.saveScrollPosition(ch, 1, idx, off)
                    studyPrefs.edit()
                        .putInt("scroll_tehillim_idx", idx)
                        .putInt("scroll_tehillim_off", off)
                        .apply()
                }
            }
    }

    // Auto-scroll loop (matching StudyDetailScreen msPerPx timing)
    LaunchedEffect(autoScrolling) {
        if (!autoScrolling) return@LaunchedEffect
        val msPerPx = (1000L / scrollSpeed.intValue.coerceAtLeast(1))
        while (isActive && autoScrolling) {
            delay(msPerPx)
            listState.scroll { scrollBy(1f) }
        }
    }

    // Settings Dialog
    if (showSettingsDialog) {
        TehillimReadingSettingsDialog(
            fontSize = fontSize.intValue,
            scrollSpeed = scrollSpeed.intValue,
            onDismiss = { showSettingsDialog = false },
            onSave = { size, speed ->
                fontSize.intValue = size
                scrollSpeed.intValue = speed
                studyPrefs.edit()
                    .putInt("font_tehillim", size)
                    .putInt("scroll_speed", speed)
                    .apply()
                UserManager.triggerSync(context)
                showSettingsDialog = false
            }
        )
    }

    // Title for Top Bar
    val topTitle = remember(currentVisibleChapter, displayTitle) {
        if (displayTitle.isNotEmpty() && !isContinueMode && chapterList.size <= 1) {
            displayTitle
        } else {
            "תהילים • פרק ${getHebrewOrdinal(currentVisibleChapter)}"
        }
    }

    Scaffold(
        topBar = {
            Surface(shadowElevation = 0.dp, color = Color(0xFFFDFBF7)) {
                Column {
                    Spacer(Modifier.statusBarsPadding())
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .padding(horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Default.ArrowForward, contentDescription = "חזרה", tint = Primary)
                        }
                        Text(
                            text = topTitle,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                            maxLines = 1,
                            fontFamily = SblHebrew
                        )
                        // פרק אקראי בגלילה חופשית
                        IconButton(onClick = {
                            val available = chapters.map { it.chapter }
                            if (available.isNotEmpty()) {
                                val randomCh = available.random()
                                val targetIdx = chapterHeaderIndices[randomCh] ?: 0
                                coroutineScope.launch {
                                    listState.animateScrollToItem(targetIdx)
                                }
                            }
                        }) {
                            Icon(Icons.Default.Shuffle, contentDescription = "פרק אקראי", tint = Primary)
                        }
                        IconButton(onClick = { showSettingsDialog = true }) {
                            Icon(Icons.Default.Settings, contentDescription = "הגדרות", tint = Primary)
                        }
                    }
                }
            }
        },
        containerColor = Color(0xFFFDFBF7),
        floatingActionButton = {
            Button(
                onClick = { autoScrolling = !autoScrolling },
                colors = ButtonDefaults.buttonColors(
                    containerColor = Color.White.copy(alpha = 0.95f),
                    contentColor = Primary
                ),
                elevation = ButtonDefaults.buttonElevation(defaultElevation = 6.dp),
                shape = RoundedCornerShape(24.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, Primary.copy(alpha = 0.1f)),
                modifier = Modifier
                    .height(48.dp)
                    .padding(bottom = 16.dp)
            ) {
                Icon(
                    if (autoScrolling) Icons.Default.PauseCircle else Icons.Default.PlayCircle,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = if (autoScrolling) "Stop Scroll" else "Auto Scroll",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        },
        floatingActionButtonPosition = FabPosition.Center
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
            LazyColumn(
                state = listState,
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp)
            ) {
                items(
                    items = flatItems,
                    key = { item ->
                        when (item) {
                            is TehillimReaderItem.ChapterHeader -> "header_${item.chapterNum}"
                            is TehillimReaderItem.ChapterBody -> "body_${item.chapterNum}"
                        }
                    }
                ) { item ->
                    when (item) {
                        is TehillimReaderItem.ChapterHeader -> {
                            // Exact HeaderRow from StudyDetailScreen
                            Text(
                                text = "פרק ${getHebrewOrdinal(item.chapterNum)}",
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(top = 12.dp, bottom = 12.dp),
                                textAlign = TextAlign.Center,
                                fontSize = 30.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = SblHebrew,
                                color = Primary,
                                style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                            )
                        }
                        is TehillimReaderItem.ChapterBody -> {
                            // Exact VerseRow from StudyDetailScreen:
                            // Flowing justified paragraph with inline (א) ... (ב) ...
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .absolutePadding(left = 12.dp, right = 16.dp)
                            ) {
                                val annotated = buildAnnotatedString {
                                    item.verses.forEach { v ->
                                        withStyle(
                                            SpanStyle(
                                                color = Primary,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = (fontSize.intValue - 1).sp
                                            )
                                        ) {
                                            append("(${getHebrewOrdinal(v.num)}) ")
                                        }
                                        val cleanText = v.text
                                            .replace("{פ}", "")
                                            .replace("{ס}", "")
                                            .trim()
                                        append(cleanText)
                                        append(" ")
                                    }
                                }
                                Text(
                                    text = annotated,
                                    fontSize = fontSize.intValue.sp,
                                    fontFamily = SblHebrew,
                                    color = Color.Black,
                                    lineHeight = (fontSize.intValue * 2f).sp,
                                    textAlign = TextAlign.Justify,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(bottom = 6.dp),
                                    style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                                )
                            }
                        }
                    }
                }
            }

            // Bottom Progress Bar (identical to StudyDetailScreen)
            if (flatItems.isNotEmpty()) {
                TehillimProgressBar(
                    items = flatItems,
                    listState = listState,
                    modifier = Modifier.align(Alignment.BottomCenter)
                )
            }
        }
    }
}

// ── Progress Bar ─────────────────────────────────────────────────────────────

@Composable
private fun TehillimProgressBar(
    items: List<TehillimReaderItem>,
    listState: LazyListState,
    modifier: Modifier = Modifier
) {
    val total = items.size
    val progress by remember {
        derivedStateOf {
            if (total > 1) (listState.firstVisibleItemIndex.toFloat() / (total - 1).toFloat()).coerceIn(0f, 1f)
            else 0f
        }
    }
    val markers = remember(items) {
        items.mapIndexedNotNull { index, item ->
            if (item is TehillimReaderItem.ChapterHeader) index.toFloat() / total.toFloat()
            else null
        }
    }

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(5.dp)
            .background(Color(0xFFE5E7EB))
    ) {
        drawRect(color = Primary, size = size.copy(width = size.width * progress))
        markers.forEach { markerProgress ->
            val x = size.width * markerProgress
            drawLine(
                color = Color.Black.copy(alpha = 0.15f),
                start = Offset(x, 0f),
                end = Offset(x, size.height),
                strokeWidth = 1.5.dp.toPx()
            )
        }
    }
}

// ── Reading Settings Dialog (Matching StudyDetailScreen) ──────────────────────

@Composable
private fun TehillimReadingSettingsDialog(
    fontSize: Int,
    scrollSpeed: Int,
    onDismiss: () -> Unit,
    onSave: (Int, Int) -> Unit
) {
    var size by remember { mutableIntStateOf(fontSize) }
    var speed by remember { mutableIntStateOf(scrollSpeed) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFFDFBF7),
        title = {
            Text(
                text = "Reading Settings",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = Primary,
                modifier = Modifier.fillMaxWidth(),
                textAlign = TextAlign.Center
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Font size: ${size}sp", fontSize = 14.sp, color = Ink)
                Slider(
                    value = size.toFloat(),
                    onValueChange = { size = it.toInt() },
                    valueRange = 14f..34f,
                    steps = 19,
                    colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary)
                )
                Text("Scroll speed: $speed", fontSize = 14.sp, color = Ink)
                Slider(
                    value = speed.toFloat(),
                    onValueChange = { speed = it.toInt() },
                    valueRange = 10f..100f,
                    steps = 17,
                    colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary)
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(size, speed) },
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("Save")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = Muted)
            }
        }
    )
}

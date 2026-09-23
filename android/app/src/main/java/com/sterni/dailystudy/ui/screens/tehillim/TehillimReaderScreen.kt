package com.sterni.dailystudy.ui.screens.tehillim

import android.content.Context
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
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
import com.sterni.dailystudy.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TehillimReaderScreen(
    initialChapter: Int = 1,
    chapterList: List<Int> = emptyList(),
    displayTitle: String = "",
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val repository = remember { TehillimRepository(context) }
    val prefs = remember { context.getSharedPreferences("TehillimReaderPrefs", Context.MODE_PRIVATE) }

    // Chapters to display
    val chapters = remember(initialChapter, chapterList) {
        if (chapterList.isNotEmpty()) {
            repository.getChapters(chapterList)
        } else {
            val single = repository.getChapter(initialChapter)
            if (single != null) listOf(single) else emptyList()
        }
    }

    var currentChapterIndex by remember { mutableIntStateOf(0) }
    val activeChapter = chapters.getOrNull(currentChapterIndex) ?: chapters.firstOrNull()

    // Preferences for font & auto-scroll
    var fontSize by remember { mutableIntStateOf(prefs.getInt("tehillim_font_size", 21)) }
    var scrollSpeed by remember { mutableIntStateOf(prefs.getInt("tehillim_scroll_speed", 35)) }
    var isAutoScrolling by remember { mutableStateOf(false) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()

    // Save reading position whenever chapter changes
    LaunchedEffect(activeChapter) {
        activeChapter?.let {
            repository.saveReadingPosition(it.chapter, 1)
        }
    }

    // Auto-scroll loop
    LaunchedEffect(isAutoScrolling, scrollSpeed) {
        if (!isAutoScrolling) return@LaunchedEffect
        while (isActive && isAutoScrolling) {
            val delayMs = (1000L / scrollSpeed.coerceIn(5, 100)).coerceAtLeast(10L)
            delay(delayMs)
            listState.scroll {
                scrollBy(2f)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = if (displayTitle.isNotEmpty()) displayTitle else "פרק ${activeChapter?.hebrewChapter ?: ""}",
                            fontWeight = FontWeight.Bold,
                            fontFamily = BaHaYetzira,
                            fontSize = 19.sp,
                            color = Ink
                        )
                        if (chapters.size > 1 && activeChapter != null) {
                            Text(
                                text = "מזמור ${activeChapter.hebrewChapter} (${currentChapterIndex + 1} מתוך ${chapters.size})",
                                fontSize = 11.sp,
                                color = Muted,
                                fontFamily = SblHebrew
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "חזרה",
                            tint = Ink
                        )
                    }
                },
                actions = {
                    // Auto-scroll toggle
                    IconButton(onClick = { isAutoScrolling = !isAutoScrolling }) {
                        Icon(
                            imageVector = if (isAutoScrolling) Icons.Default.PauseCircle else Icons.Default.PlayCircle,
                            contentDescription = "גלילה אוטומטית",
                            tint = if (isAutoScrolling) Primary else Muted
                        )
                    }
                    // Font settings dialog
                    IconButton(onClick = { showSettingsDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.FormatSize,
                            contentDescription = "גודל כתב",
                            tint = Ink
                        )
                    }
                    // Bookmark toggle
                    activeChapter?.let { ch ->
                        var bookmarked by remember(ch.chapter) { mutableStateOf(repository.isBookmarked(ch.chapter)) }
                        IconButton(onClick = {
                            bookmarked = repository.toggleBookmark(ch.chapter)
                        }) {
                            Icon(
                                imageVector = if (bookmarked) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                                contentDescription = "סימניה",
                                tint = if (bookmarked) Primary else Muted
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFFFDFBF7))
            )
        },
        bottomBar = {
            if (chapters.size > 1 || chapterList.isEmpty()) {
                Surface(
                    color = Color.White,
                    shadowElevation = 8.dp,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .navigationBarsPadding()
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        // Prev button
                        val canGoPrev = if (chapters.size > 1) currentChapterIndex > 0 else (activeChapter?.chapter ?: 1) > 1
                        TextButton(
                            onClick = {
                                if (chapters.size > 1) {
                                    if (currentChapterIndex > 0) currentChapterIndex--
                                } else {
                                    val prevNum = (activeChapter?.chapter ?: 1) - 1
                                    val prevCh = repository.getChapter(prevNum)
                                    if (prevCh != null) {
                                        repository.saveReadingPosition(prevNum, 1)
                                    }
                                }
                            },
                            enabled = canGoPrev
                        ) {
                            Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(4.dp))
                            Text("פרק קודם", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
                        }

                        Text(
                            text = "פרק ${activeChapter?.hebrewChapter ?: ""}",
                            fontFamily = SblHebrew,
                            fontWeight = FontWeight.Bold,
                            fontSize = 15.sp,
                            color = Primary
                        )

                        // Next button
                        val canGoNext = if (chapters.size > 1) currentChapterIndex < chapters.size - 1 else (activeChapter?.chapter ?: 1) < 150
                        TextButton(
                            onClick = {
                                if (chapters.size > 1) {
                                    if (currentChapterIndex < chapters.size - 1) currentChapterIndex++
                                } else {
                                    val nextNum = (activeChapter?.chapter ?: 1) + 1
                                    val nextCh = repository.getChapter(nextNum)
                                    if (nextCh != null) {
                                        repository.saveReadingPosition(nextNum, 1)
                                    }
                                }
                            },
                            enabled = canGoNext
                        ) {
                            Text("פרק הבא", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.width(4.dp))
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = null, modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }
        },
        containerColor = Color(0xFFFDFBF7)
    ) { innerPadding ->
        if (showSettingsDialog) {
            TehillimSettingsDialog(
                fontSize = fontSize,
                scrollSpeed = scrollSpeed,
                onDismiss = { showSettingsDialog = false },
                onSave = { newSize, newSpeed ->
                    fontSize = newSize
                    scrollSpeed = newSpeed
                    prefs.edit()
                        .putInt("tehillim_font_size", newSize)
                        .putInt("tehillim_scroll_speed", newSpeed)
                        .apply()
                }
            )
        }

        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp),
            contentPadding = PaddingValues(top = 16.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            activeChapter?.let { ch ->
                item(key = "header_${ch.chapter}") {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(bottom = 12.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "מזמור ${ch.hebrewChapter}",
                            fontSize = (fontSize + 6).sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = BaHaYetzira,
                            color = Primary,
                            textAlign = TextAlign.Center
                        )
                        Spacer(Modifier.height(6.dp))
                        HorizontalDivider(
                            modifier = Modifier.width(60.dp),
                            thickness = 2.dp,
                            color = Primary.copy(alpha = 0.3f)
                        )
                    }
                }

                // Continuous Chapter verses
                item(key = "text_${ch.chapter}") {
                    val annotatedText = buildAnnotatedString {
                        ch.verses.forEach { v ->
                            withStyle(
                                SpanStyle(
                                    fontWeight = FontWeight.Bold,
                                    color = Primary,
                                    fontSize = (fontSize - 3).sp
                                )
                            ) {
                                append("(${v.heNum}) ")
                            }
                            withStyle(
                                SpanStyle(
                                    fontWeight = FontWeight.Normal,
                                    color = Ink,
                                    fontSize = fontSize.sp
                                )
                            ) {
                                append("${v.text}  ")
                            }
                        }
                    }

                    Text(
                        text = annotatedText,
                        lineHeight = (fontSize * 1.6f).sp,
                        fontFamily = SblHebrew,
                        textAlign = TextAlign.Justify,
                        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl),
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            }
        }
    }
}

// ── Settings Dialog ───────────────────────────────────────────────────────────

@Composable
private fun TehillimSettingsDialog(
    fontSize: Int,
    scrollSpeed: Int,
    onDismiss: () -> Unit,
    onSave: (fontSize: Int, scrollSpeed: Int) -> Unit
) {
    var size by remember { mutableIntStateOf(fontSize) }
    var speed by remember { mutableIntStateOf(scrollSpeed) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("הגדרות קריאה", fontFamily = SblHebrew, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                // Font Size
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("גודל כתב", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
                        Text("$size pt", fontFamily = SblHebrew, color = Primary, fontWeight = FontWeight.Bold)
                    }
                    Slider(
                        value = size.toFloat(),
                        onValueChange = { size = it.toInt() },
                        valueRange = 16f..34f,
                        steps = 8
                    )
                }

                // Scroll Speed
                Column {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text("מהירות גלילה אוטומטית", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
                        Text("$speed", fontFamily = SblHebrew, color = Primary, fontWeight = FontWeight.Bold)
                    }
                    Slider(
                        value = speed.toFloat(),
                        onValueChange = { speed = it.toInt() },
                        valueRange = 10f..70f,
                        steps = 11
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    onSave(size, speed)
                    onDismiss()
                },
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Text("אישור", fontFamily = SblHebrew, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("סגור", fontFamily = SblHebrew, color = Muted)
            }
        }
    )
}

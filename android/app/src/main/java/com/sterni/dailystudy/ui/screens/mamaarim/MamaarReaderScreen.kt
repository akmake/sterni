package com.sterni.dailystudy.ui.screens.mamaarim

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
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.FormatSize
import androidx.compose.material.icons.filled.PauseCircle
import androidx.compose.material.icons.filled.PlayCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.data.model.Mamaar
import com.sterni.dailystudy.data.model.MamaarSection
import com.sterni.dailystudy.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

@Composable
fun MamaarReaderScreen(
    mamaarId: String,
    onBack: () -> Unit,
    vm: MamaarimViewModel = viewModel()
) {
    val mamaar by vm.selectedMamaar.collectAsState()

    LaunchedEffect(mamaarId) {
        if (mamaar?.id != mamaarId) {
            vm.loadArticleContent(mamaarId)
        }
    }

    if (mamaar == null || mamaar?.id != mamaarId) {
        Box(Modifier.fillMaxSize(), Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Primary)
                Spacer(Modifier.height(12.dp))
                Text("טוען מאמר משרת...", color = Muted)
            }
        }
        return
    }

    ReaderContent(mamaar = mamaar!!, onBack = {
        vm.clearSelectedMamaar()
        onBack()
    })
}

@Composable
private fun ReaderContent(mamaar: Mamaar, onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences("RambamPrefs", Context.MODE_PRIVATE) }

    val fontSize    = remember { mutableIntStateOf(prefs.getInt("mamaar_text_size_sp", 20)) }
    val scrollSpeed = remember { mutableIntStateOf(prefs.getInt("scroll_speed", 40)) }

    val listState = rememberLazyListState()
    var autoScrolling by remember { mutableStateOf(false) }
    var showSettings  by remember { mutableStateOf(false) }

    val scrollKey = "scroll_mamaar_${mamaar.id}"
    var scrollRestored by remember { mutableStateOf(false) }

    LaunchedEffect(mamaar.sections.isNotEmpty()) {
        if (mamaar.sections.isNotEmpty() && !scrollRestored) {
            val idx = prefs.getInt("${scrollKey}_idx", 0)
            val off = prefs.getInt("${scrollKey}_off", 0)
            if (idx > 0) listState.scrollToItem(idx, off)
            scrollRestored = true
        }
    }

    DisposableEffect(scrollKey) {
        onDispose {
            prefs.edit()
                .putInt("${scrollKey}_idx", listState.firstVisibleItemIndex)
                .putInt("${scrollKey}_off", listState.firstVisibleItemScrollOffset)
                .apply()
        }
    }

    LaunchedEffect(autoScrolling) {
        if (!autoScrolling) return@LaunchedEffect
        val msPerPx = (1000L / scrollSpeed.intValue.coerceAtLeast(1))
        while (isActive && autoScrolling) {
            delay(msPerPx)
            listState.scroll { scrollBy(1f) }
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
                            Icon(Icons.Default.ArrowForward, contentDescription = "חזור", tint = Primary)
                        }
                        Text(
                            text = mamaar.title,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                            maxLines = 1
                        )
                        IconButton(onClick = { showSettings = true }) {
                            Icon(Icons.Default.FormatSize, contentDescription = "גודל טקסט", tint = Primary)
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
                modifier = Modifier.height(48.dp).padding(bottom = 16.dp)
            ) {
                Icon(
                    if (autoScrolling) Icons.Default.PauseCircle else Icons.Default.PlayCircle,
                    contentDescription = null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    if (autoScrolling) "עצור גלילה" else "גלילה אוטומטית",
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
                items(mamaar.sections) { section ->
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .absolutePadding(left = 12.dp, right = 16.dp)
                    ) {
                        MamaarSectionRow(section, fontSize.intValue)
                    }
                }
            }

            if (mamaar.sections.isNotEmpty()) {
                MamaarProgressBar(
                    total = mamaar.sections.size,
                    listState = listState,
                    modifier = Modifier.align(Alignment.BottomCenter)
                )
            }
        }
    }

    if (showSettings) {
        AlertDialog(
            onDismissRequest = { showSettings = false },
            title = { Text("הגדרות קריאה", textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth()) },
            text = {
                Column(modifier = Modifier.fillMaxWidth()) {
                    Text("גודל טקסט: ${fontSize.intValue}", textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth())
                    Slider(
                        value = fontSize.intValue.toFloat(),
                        onValueChange = {
                            fontSize.intValue = it.toInt()
                            prefs.edit().putInt("mamaar_text_size_sp", it.toInt()).apply()
                        },
                        valueRange = 12f..48f
                    )
                    Spacer(Modifier.height(16.dp))
                    Text("מהירות גלילה אוטומטית: ${scrollSpeed.intValue}", textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth())
                    Slider(
                        value = scrollSpeed.intValue.toFloat(),
                        onValueChange = {
                            scrollSpeed.intValue = it.toInt()
                            prefs.edit().putInt("scroll_speed", it.toInt()).apply()
                        },
                        valueRange = 10f..100f
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { showSettings = false }) { Text("סגור", color = Primary) }
            }
        )
    }
}

@Composable
private fun MamaarProgressBar(
    total: Int,
    listState: LazyListState,
    modifier: Modifier = Modifier
) {
    val firstVisible by remember { derivedStateOf { listState.firstVisibleItemIndex } }
    val progress by remember {
        derivedStateOf {
            if (total > 1) (firstVisible.toFloat() / (total - 1).toFloat()).coerceIn(0f, 1f)
            else 0f
        }
    }

    Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(5.dp)
            .background(Color(0xFFE5E7EB))
    ) {
        drawRect(color = Primary, size = size.copy(width = size.width * progress))
    }
}

@Composable
private fun MamaarSectionRow(section: MamaarSection, fontSize: Int) {
    val paragraphs = section.body
        .split(Regex("\\n{1,}"))
        .map { it.trim() }
        .filter { it.isNotEmpty() }

    if (paragraphs.isEmpty() && section.heading.isNullOrBlank()) return

    Column(modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp)) {
        val firstPara = buildAnnotatedString {
            if (!section.heading.isNullOrBlank()) {
                withStyle(SpanStyle(color = Color.Black, fontWeight = FontWeight.Normal, fontSize = fontSize.sp)) {
                    append(section.heading)
                    if (paragraphs.isNotEmpty()) append("\u00A0")
                }
            }
            if (paragraphs.isNotEmpty()) {
                append(paragraphs.first())
            }
        }

        Text(
            text = firstPara,
            fontSize = fontSize.sp,
            fontFamily = SblHebrew,
            color = Color.Black,
            lineHeight = (fontSize * 1.8f).sp,
            textAlign = TextAlign.Justify,
            modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
        )

        if (paragraphs.size > 1) {
            paragraphs.drop(1).forEach { para ->
                Text(
                    text = para,
                    fontSize = fontSize.sp,
                    fontFamily = SblHebrew,
                    color = Color.Black,
                    lineHeight = (fontSize * 1.8f).sp,
                    textAlign = TextAlign.Justify,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                    style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                )
            }
        }
    }
}

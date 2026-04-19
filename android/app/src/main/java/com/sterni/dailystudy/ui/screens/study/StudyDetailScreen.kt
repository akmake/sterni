package com.sterni.dailystudy.ui.screens.study

import android.content.Context
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sterni.dailystudy.data.model.Section
import com.sterni.dailystudy.ui.theme.*
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive

private val HE_NUMS = arrayOf(
    "", "א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י",
    "יא", "יב", "יג", "יד", "טו", "טז", "יז", "יח", "יט", "כ",
    "כא", "כב", "כג", "כד", "כה", "כו", "כז", "כח", "כט", "ל",
    "לא", "לב", "לג", "לד", "לה", "לו", "לז", "לח", "לט", "מ",
    "מא", "מב", "מג", "מד", "מה", "מו", "מז", "מח", "מט", "נ",
    "נא", "נב", "נג", "נד", "נה", "נו", "נז", "נח", "נט", "ס",
    "סא", "סב", "סג", "סד", "סה", "סו", "סז", "סח", "סט", "ע",
    "עא", "עב", "עג", "עד", "עה", "עו"
)

private fun toHebNum(n: Int) = if (n in 1 until HE_NUMS.size) HE_NUMS[n] else n.toString()

@Composable
fun StudyDetailScreen(
    studyKey: String,
    date: String,
    title: String,
    label: String,
    onBack: () -> Unit,
    viewModel: StudyDetailViewModel = hiltViewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current

    LaunchedEffect(studyKey, date) { viewModel.load(studyKey, date, label) }

    val prefs = remember { context.getSharedPreferences("StudyPrefs", Context.MODE_PRIVATE) }
    val isShnayim = studyKey == "shnayimMikra"
    val isTanya = studyKey == "tanya"
    val isTehillim = studyKey == "tehillim"
    val isChumash = studyKey == "chumash"
    val chumashPrefs = remember { context.getSharedPreferences("ChumashPrefs", Context.MODE_PRIVATE) }

    val fontSize = remember {
        mutableIntStateOf(
            if (isChumash) chumashPrefs.getInt("chumash_text_size", 20)
            else prefs.getInt("text_size_sp", 20)
        )
    }
    val rashiFontSize = remember { mutableIntStateOf(chumashPrefs.getInt("rashi_text_size", 17)) }
    val scrollSpeed = remember {
        mutableIntStateOf(
            if (isChumash) chumashPrefs.getInt("chumash_scroll_speed", 40)
            else prefs.getInt("scroll_speed", 40)
        )
    }
    val connected = remember {
        context.getSharedPreferences("ShnayimPrefs", Context.MODE_PRIVATE)
            .getBoolean("shnayim_mikra_connected", true)
    }

    var showCustomChaptersDialog by remember { mutableStateOf(false) }
    var showSettingsDialog by remember { mutableStateOf(false) }

    if (showCustomChaptersDialog) {
        CustomTehillimChaptersDialog(
            currentChapters = state.customChapters,
            onDismiss = { showCustomChaptersDialog = false },
            onSave = { chapters ->
                viewModel.saveCustomChapters(chapters, date, label)
                showCustomChaptersDialog = false
            }
        )
    }

    if (showSettingsDialog) {
        if (isChumash) {
            ChumashSettingsDialog(
                chumashFontSize = fontSize.intValue,
                rashiFontSize = rashiFontSize.intValue,
                scrollSpeed = scrollSpeed.intValue,
                onDismiss = { showSettingsDialog = false },
                onSave = { cSize, rSize, speed ->
                    fontSize.intValue = cSize
                    rashiFontSize.intValue = rSize
                    scrollSpeed.intValue = speed
                    chumashPrefs.edit()
                        .putInt("chumash_text_size", cSize)
                        .putInt("rashi_text_size", rSize)
                        .putInt("chumash_scroll_speed", speed)
                        .apply()
                    showSettingsDialog = false
                }
            )
        } else if (isTehillim) {
            TehillimSettingsDialog(
                fontSize = fontSize.intValue,
                scrollSpeed = scrollSpeed.intValue,
                currentChapters = state.customChapters,
                onDismiss = { showSettingsDialog = false },
                onSave = { size, speed, chapters ->
                    fontSize.intValue = size
                    scrollSpeed.intValue = speed
                    prefs.edit()
                        .putInt("text_size_sp", size)
                        .putInt("scroll_speed", speed)
                        .apply()
                    if (chapters != null) {
                        viewModel.saveCustomChapters(chapters, date, label)
                    }
                    showSettingsDialog = false
                }
            )
        } else {
            ReadingSettingsDialog(
                fontSize = fontSize.intValue,
                scrollSpeed = scrollSpeed.intValue,
                onDismiss = { showSettingsDialog = false },
                onSave = { size, speed ->
                    fontSize.intValue = size
                    scrollSpeed.intValue = speed
                    prefs.edit()
                        .putInt("text_size_sp", size)
                        .putInt("scroll_speed", speed)
                        .apply()
                    showSettingsDialog = false
                }
            )
        }
    }

    val listState = rememberLazyListState()
    var autoScrolling by remember { mutableStateOf(false) }
    val scrollKey = "scroll_${studyKey}_${date}"
    var scrollRestored by remember { mutableStateOf(false) }

    LaunchedEffect(state.sections.isNotEmpty()) {
        if (state.sections.isNotEmpty() && !scrollRestored) {
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
                            Icon(Icons.Default.ArrowForward, contentDescription = "Back", tint = Primary)
                        }
                        Text(
                            text = title,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                            maxLines = 1,
                            fontFamily = SblHebrew
                        )
                        IconButton(onClick = { showSettingsDialog = true }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Primary)
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
                    null,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    if (autoScrolling) "Stop Scroll" else "Auto Scroll",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium
                )
            }
        },
        floatingActionButtonPosition = FabPosition.Center
    ) { innerPadding ->
        Box(modifier = Modifier.padding(innerPadding).fillMaxSize()) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    CircularProgressIndicator(color = Primary)
                }
                state.error != null -> Column(
                    Modifier.fillMaxSize().padding(32.dp),
                    Arrangement.Center,
                    Alignment.CenterHorizontally
                ) {
                    Text(state.error!!, color = Muted, fontSize = 16.sp, textAlign = TextAlign.Center)
                    Spacer(Modifier.height(16.dp))
                    Button(onClick = { viewModel.load(studyKey, date, label) }) { Text("Try again") }
                }
                else -> {
                    LazyColumn(
                        state = listState,
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(top = 8.dp, bottom = 120.dp)
                    ) {
                        if (state.subtitle.isNotEmpty()) {
                            item {
                                Text(
                                    text = state.subtitle,
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .absolutePadding(left = 12.dp, right = 16.dp, bottom = 20.dp),
                                    textAlign = TextAlign.Center,
                                    fontSize = 14.sp,
                                    color = Primary.copy(alpha = 0.7f),
                                    fontFamily = SblHebrew
                                )
                            }
                        }
                        items(state.sections, key = { it.id ?: it.hashCode().toString() }) { section ->
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .absolutePadding(left = 12.dp, right = 16.dp)
                            ) {
                                SectionRow(section, isShnayim, isTanya, connected, fontSize.intValue, if (isChumash) rashiFontSize.intValue else null)
                            }
                        }
                    }
                }
            }

            if (state.sections.isNotEmpty()) {
                StudyProgressBar(
                    sections = state.sections,
                    listState = listState,
                    modifier = Modifier.align(Alignment.BottomCenter)
                )
            }
        }
    }
}

@Composable
private fun StudyProgressBar(
    sections: List<Section>,
    listState: LazyListState,
    modifier: Modifier = Modifier
) {
    val total = sections.size
    val progress by remember {
        derivedStateOf {
            if (total > 1) (listState.firstVisibleItemIndex.toFloat() / (total - 1).toFloat()).coerceIn(0f, 1f)
            else 0f
        }
    }
    val markers = remember(sections) {
        sections.mapIndexedNotNull { index, section ->
            if (section.isHeader || section.isChapterHeader || section.isAliyahHeader)
                index.toFloat() / total.toFloat()
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

@Composable
private fun SectionRow(
    section: Section,
    isShnayim: Boolean,
    isTanya: Boolean,
    connected: Boolean,
    fontSize: Int,
    rashiFontSizeOverride: Int? = null
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        when {
            section.isHeader -> HeaderRow(section, fontSize)
            !section.ordinal.isNullOrEmpty() -> HalachaRow(section, fontSize)
            else -> VerseRow(section, isShnayim, isTanya, connected, fontSize, rashiFontSizeOverride)
        }
    }
}

@Composable
private fun HeaderRow(section: Section, fontSize: Int) {
    if (section.isAliyahHeader) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 28.dp, bottom = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Box(modifier = Modifier.weight(1f).height(1.dp).background(Primary.copy(alpha = 0.15f)))
            Text(
                text = section.he ?: "",
                modifier = Modifier.padding(horizontal = 16.dp),
                textAlign = TextAlign.Center,
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = SblHebrew,
                color = Primary,
                style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
            )
            Box(modifier = Modifier.weight(1f).height(1.dp).background(Primary.copy(alpha = 0.15f)))
        }
    } else {
        Text(
            text = section.he ?: "",
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp, bottom = 12.dp),
            textAlign = TextAlign.Center,
            fontSize = 30.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = SblHebrew,
            color = Primary,
            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
        )
    }
}

@Composable
private fun HalachaRow(section: Section, fontSize: Int) {
    val ordinal = (section.ordinal ?: "") + "\u00A0"
    val annotated = buildAnnotatedString {
        withStyle(SpanStyle(color = Primary, fontWeight = FontWeight.Bold, fontSize = (fontSize + 6).sp)) {
            append(ordinal)
        }
        append(section.he ?: "")
    }
    Text(
        text = annotated,
        modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp),
        fontSize = fontSize.sp,
        fontFamily = SblHebrew,
        color = Color.Black,
        lineHeight = (fontSize * 1.8f).sp,
        textAlign = TextAlign.Justify,
        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

@Composable
private fun VerseRow(
    section: Section,
    isShnayim: Boolean,
    isTanya: Boolean,
    connected: Boolean,
    fontSize: Int,
    rashiFontSizeOverride: Int? = null
) {
    val hasRashi = !section.rashi.isNullOrEmpty()
    val he = section.he ?: ""
    val en = section.en ?: ""
    val showPrefix = !isTanya && section.verseNum != null

    Column(modifier = Modifier.fillMaxWidth().padding(bottom = if (hasRashi) 20.dp else 6.dp)) {
        if (isShnayim && connected) {
            val annotated = buildAnnotatedString {
                if (showPrefix) {
                    withStyle(SpanStyle(color = Primary, fontWeight = FontWeight.Bold, fontSize = (fontSize - 1).sp)) {
                        append(toHebNum(section.verseNum!!)); append("\u00A0")
                    }
                }
                append("$he ")
                if (showPrefix) {
                    withStyle(SpanStyle(color = Primary, fontWeight = FontWeight.Bold, fontSize = (fontSize - 1).sp)) {
                        append(toHebNum(section.verseNum!!)); append("\u00A0")
                    }
                }
                append(he)
                if (en.isNotEmpty()) { append(" "); withStyle(SpanStyle(color = Muted)) { append(en) } }
            }
            Text(
                text = annotated,
                fontSize = fontSize.sp,
                fontFamily = SblHebrew,
                color = Color.Black,
                lineHeight = (fontSize * 1.8f).sp,
                textAlign = TextAlign.Justify,
                modifier = Modifier.fillMaxWidth(),
                style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
            )
        } else {
            val annotated = buildAnnotatedString {
                if (showPrefix) {
                    withStyle(SpanStyle(color = Primary, fontWeight = FontWeight.Bold, fontSize = (fontSize - 1).sp)) {
                        append(toHebNum(section.verseNum!!))
                    }
                    append(" ")
                }
                append(he)
            }
            Text(
                text = annotated,
                fontSize = fontSize.sp,
                fontFamily = SblHebrew,
                color = Color.Black,
                lineHeight = (fontSize * 2f).sp,
                textAlign = TextAlign.Justify,
                modifier = Modifier.fillMaxWidth(),
                style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
            )
            if (isShnayim && !connected && en.isNotEmpty()) {
                Text(
                    text = he,
                    fontSize = fontSize.sp,
                    fontFamily = SblHebrew,
                    color = Color.Black,
                    lineHeight = (fontSize * 1.8f).sp,
                    textAlign = TextAlign.Justify,
                    modifier = Modifier.fillMaxWidth(),
                    style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                )
                Text(en, fontSize = maxOf(14, fontSize - 3).sp, color = Muted, lineHeight = (maxOf(14, fontSize - 3) * 1.3f).sp, modifier = Modifier.fillMaxWidth())
            }
        }
        if (hasRashi) RashiBlock(section.rashi!!, rashiFontSizeOverride ?: fontSize)
    }
}

@Composable
private fun RashiBlock(rashiList: List<Section.RashiItem>, fontSize: Int) {
    val rashiSize = maxOf(14, fontSize - 3)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 10.dp, bottom = 4.dp)
            .background(color = Amber.copy(alpha = 0.04f), shape = RoundedCornerShape(topEnd = 8.dp, bottomEnd = 8.dp))
            .height(IntrinsicSize.Min)
    ) {
        Box(modifier = Modifier.width(3.dp).fillMaxHeight().background(Amber.copy(alpha = 0.55f)))
        Column(modifier = Modifier.padding(start = 14.dp, end = 8.dp, top = 8.dp, bottom = 6.dp)) {
            Text("רש\u05F4י", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Amber, modifier = Modifier.padding(bottom = 6.dp))
            rashiList.forEach { item ->
                if (!item.he.isNullOrEmpty()) {
                    Text(
                        text = item.he,
                        fontSize = rashiSize.sp,
                        fontFamily = SblHebrew,
                        color = Color.Black.copy(alpha = 0.85f),
                        lineHeight = (rashiSize * 1.7f).sp,
                        modifier = Modifier.fillMaxWidth().padding(bottom = 8.dp),
                        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )
                }
            }
        }
    }
}

// ── Custom Tehillim Chapters Dialog ─────────────────────────────────────────
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun CustomTehillimChaptersDialog(
    currentChapters: List<Int>,
    onDismiss: () -> Unit,
    onSave: (List<Int>) -> Unit
) {
    var chapters by remember { mutableStateOf(currentChapters.toMutableList()) }
    var inputText by remember { mutableStateOf("") }
    var inputError by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFFDFBF7),
        title = {
            Text(
                "Personal Tehillim Chapters",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = Primary,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth()
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "Add chapters to show daily after the regular study",
                    fontSize = 13.sp,
                    color = Muted,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
                if (chapters.isNotEmpty()) {
                    FlowRow(
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        chapters.forEach { ch ->
                            InputChip(
                                selected = false,
                                onClick = { chapters = chapters.toMutableList().also { it.remove(ch) } },
                                label = { Text("פרק $ch", fontSize = 13.sp) },
                                trailingIcon = { Icon(Icons.Default.Close, null, modifier = Modifier.size(14.dp)) },
                                colors = InputChipDefaults.inputChipColors(containerColor = Primary.copy(alpha = 0.1f))
                            )
                        }
                    }
                }
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    OutlinedTextField(
                        value = inputText,
                        onValueChange = { inputText = it.filter { c -> c.isDigit() }; inputError = false },
                        label = { Text("Chapter (1–150)", fontSize = 12.sp) },
                        singleLine = true,
                        isError = inputError,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        modifier = Modifier.weight(1f),
                        textStyle = LocalTextStyle.current.copy(textDirection = TextDirection.Ltr)
                    )
                    Button(
                        onClick = {
                            val n = inputText.toIntOrNull()
                            if (n != null && n in 1..150 && n !in chapters) {
                                chapters = chapters.toMutableList().also { it.add(n); it.sort() }
                                inputText = ""
                            } else inputError = true
                        },
                        colors = ButtonDefaults.buttonColors(containerColor = Primary)
                    ) { Text("Add") }
                }
                if (inputError) {
                    Text("Invalid chapter (1–150)", fontSize = 11.sp, color = MaterialTheme.colorScheme.error)
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(chapters.toList()) },
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Muted) }
        }
    )
}

// ── Reading Settings Dialog ──────────────────────────────────────────────────
@Composable
fun ReadingSettingsDialog(
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
            Text("Reading Settings", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Primary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("Font size: ${size}sp", fontSize = 14.sp, color = Ink)
                Slider(value = size.toFloat(), onValueChange = { size = it.toInt() }, valueRange = 14f..32f, steps = 17, colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary))
                Text("Scroll speed: $speed", fontSize = 14.sp, color = Ink)
                Slider(value = speed.toFloat(), onValueChange = { speed = it.toInt() }, valueRange = 10f..100f, steps = 8, colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary))
            }
        },
        confirmButton = {
            Button(onClick = { onSave(size, speed) }, colors = ButtonDefaults.buttonColors(containerColor = Primary)) { Text("Save") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel", color = Muted) }
        }
    )
}

// ── Chumash Settings Dialog ─────────────────────────────────────────────────
@Composable
fun ChumashSettingsDialog(
    chumashFontSize: Int,
    rashiFontSize: Int,
    scrollSpeed: Int,
    onDismiss: () -> Unit,
    onSave: (Int, Int, Int) -> Unit
) {
    var cSize by remember { mutableIntStateOf(chumashFontSize) }
    var rSize by remember { mutableIntStateOf(rashiFontSize) }
    var speed by remember { mutableIntStateOf(scrollSpeed) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFFDFBF7),
        title = {
            Text("הגדרות חומש", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Primary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("גודל טקסט חומש: ${cSize}sp", fontSize = 14.sp, color = Ink)
                Slider(value = cSize.toFloat(), onValueChange = { cSize = it.toInt() }, valueRange = 14f..32f, steps = 17, colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary))
                Text("גודל טקסט רש\"י: ${rSize}sp", fontSize = 14.sp, color = Ink)
                Slider(value = rSize.toFloat(), onValueChange = { rSize = it.toInt() }, valueRange = 12f..28f, steps = 15, colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary))
                Text("מהירות גלילה: $speed", fontSize = 14.sp, color = Ink)
                Slider(value = speed.toFloat(), onValueChange = { speed = it.toInt() }, valueRange = 10f..100f, steps = 8, colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary))
            }
        },
        confirmButton = {
            Button(onClick = { onSave(cSize, rSize, speed) }, colors = ButtonDefaults.buttonColors(containerColor = Primary)) { Text("שמור") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
        }
    )
}

// ── Tehillim Settings Dialog ────────────────────────────────────────────────
@Composable
fun TehillimSettingsDialog(
    fontSize: Int,
    scrollSpeed: Int,
    currentChapters: List<Int>,
    onDismiss: () -> Unit,
    onSave: (Int, Int, List<Int>?) -> Unit
) {
    var size by remember { mutableIntStateOf(fontSize) }
    var speed by remember { mutableIntStateOf(scrollSpeed) }
    var showChaptersDialog by remember { mutableStateOf(false) }
    var savedChapters by remember { mutableStateOf<List<Int>?>(null) }

    if (showChaptersDialog) {
        CustomTehillimChaptersDialog(
            currentChapters = savedChapters ?: currentChapters,
            onDismiss = { showChaptersDialog = false },
            onSave = { chapters ->
                savedChapters = chapters
                showChaptersDialog = false
            }
        )
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFFDFBF7),
        title = {
            Text("הגדרות תהילים", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = Primary, modifier = Modifier.fillMaxWidth(), textAlign = TextAlign.Center)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                Text("גודל טקסט: ${size}sp", fontSize = 14.sp, color = Ink)
                Slider(value = size.toFloat(), onValueChange = { size = it.toInt() }, valueRange = 14f..32f, steps = 17, colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary))
                Text("מהירות גלילה: $speed", fontSize = 14.sp, color = Ink)
                Slider(value = speed.toFloat(), onValueChange = { speed = it.toInt() }, valueRange = 10f..100f, steps = 8, colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary))
                HorizontalDivider(color = Muted.copy(alpha = 0.2f))
                Button(
                    onClick = { showChaptersDialog = true },
                    colors = ButtonDefaults.buttonColors(containerColor = Primary.copy(alpha = 0.1f)),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, tint = Primary, modifier = Modifier.size(18.dp))
                    Spacer(modifier = Modifier.width(8.dp))
                    Text("פרקים אישיים", color = Primary, fontSize = 14.sp)
                }
            }
        },
        confirmButton = {
            Button(onClick = { onSave(size, speed, savedChapters) }, colors = ButtonDefaults.buttonColors(containerColor = Primary)) { Text("שמור") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
        }
    )
}

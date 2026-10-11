package com.sterni.dailystudy.ui.screens.pdflibrary

import android.graphics.Typeface
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.Primary
import com.sterni.dailystudy.ui.theme.SblHebrew
import java.io.File
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SichaReader(book: PdfBook, document: SichaTextDocument, fontSize: Int, vm: PdfStudyViewModel) {
    val list = rememberLazyListState(book.sichaTextPosition.coerceIn(0, document.blocks.lastIndex), book.sichaTextOffset)
    val scope = rememberCoroutineScope()
    val view = LocalView.current
    val clipboard = LocalClipboardManager.current
    var menu by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf<Int?>(null) }
    var searching by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var resultIndex by remember(query) { mutableIntStateOf(0) }
    val results = remember(query, document) {
        if (query.isBlank()) emptyList() else document.blocks.indices.filter { document.blocks[it].text.contains(query, true) }
    }
    val fonts = remember(book.id, document.fonts) {
        document.fonts.mapValues { (_, filename) ->
            runCatching {
                val file = File(vm.sichaFontDirectory(book.id), filename)
                require(file.name == filename && file.extension == "ttf")
                FontFamily(Typeface.createFromFile(file))
            }.getOrDefault(SblHebrew)
        }
    }
    fun savePosition() {
        val index = list.firstVisibleItemIndex
        vm.saveSichaTextPosition(index, list.firstVisibleItemScrollOffset, document.blocks[index].page)
    }
    fun close() { savePosition(); vm.closeBook() }
    fun goToResult(index: Int) {
        if (results.isNotEmpty()) {
            resultIndex = index.coerceIn(0, results.lastIndex)
            scope.launch { list.animateScrollToItem(results[resultIndex]) }
        }
    }
    BackHandler { if (searching) { searching = false; query = "" } else close() }
    DisposableEffect(view) {
        val previous = view.keepScreenOn
        view.keepScreenOn = true
        onDispose { savePosition(); view.keepScreenOn = previous }
    }
    LaunchedEffect(list) {
        snapshotFlow { list.firstVisibleItemIndex to list.firstVisibleItemScrollOffset }
            .collectLatest { (index, offset) ->
                delay(400)
                vm.saveSichaTextPosition(index, offset, document.blocks[index].page)
            }
    }
    LaunchedEffect(query) {
        delay(300)
        if (results.isNotEmpty()) list.animateScrollToItem(results.first())
    }
    Scaffold(containerColor = Color(0xFFFFFDF8), topBar = {
        Column {
            TopAppBar(
                title = { Column {
                    Text(book.title, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text("${book.sourceCategory ?: "לקוטי שיחות"} · עמוד ${document.blocks[list.firstVisibleItemIndex].page + 1} מתוך ${document.pageCount}",
                        style = MaterialTheme.typography.labelMedium)
                } },
                navigationIcon = { IconButton({ close() }) { Icon(Icons.AutoMirrored.Filled.ArrowForward, "חזרה לספרייה") } },
                actions = {
                    IconButton({ searching = !searching; if (!searching) query = "" }) { Icon(Icons.Default.Search, "חיפוש בשיחה") }
                    Box {
                        IconButton({ menu = !menu }) { Icon(Icons.Default.MoreVert, "אפשרויות קריאה") }
                        DropdownMenu(menu, { menu = false }) {
                            DropdownMenuItem(text = { Text("הגדלת טקסט · $fontSize") }, enabled = fontSize < 40,
                                onClick = { vm.setSichaFontSize(fontSize + 2) })
                            DropdownMenuItem(text = { Text("הקטנת טקסט · $fontSize") }, enabled = fontSize > 18,
                                onClick = { vm.setSichaFontSize(fontSize - 2) })
                            DropdownMenuItem(text = { Text("העתקת כל השיחה") }, onClick = {
                                clipboard.setText(AnnotatedString(document.blocks.joinToString("\n\n") { it.text })); menu = false
                            })
                        }
                    }
                }
            )
            if (searching) {
                OutlinedTextField(query, { query = it }, label = { Text("חיפוש בטקסט") }, singleLine = true,
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                    trailingIcon = { IconButton({ searching = false; query = "" }) { Icon(Icons.Default.Close, "סגירת חיפוש") } })
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(if (query.isBlank()) "" else if (results.isEmpty()) "לא נמצאו תוצאות" else "${resultIndex + 1} מתוך ${results.size} פסקאות")
                    TextButton({ goToResult(resultIndex - 1) }, enabled = resultIndex > 0) { Text("הקודמת") }
                    TextButton({ goToResult(resultIndex + 1) }, enabled = resultIndex < results.lastIndex) { Text("הבאה") }
                }
            }
            if (document.blocks.any { it.ocr }) Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically) {
                val count = document.blocks.count { it.needsReview }
                Text(if (count > 0) "זוהה מסריקה · $count קטעים עם זיהוי לא בטוח" else "זוהה מסריקה · ניתן לבדוק ולתקן את הטקסט",
                    style = MaterialTheme.typography.labelMedium, modifier = Modifier.weight(1f))
                if (count > 0) TextButton({
                    val next = document.blocks.indices.firstOrNull { it >= list.firstVisibleItemIndex && document.blocks[it].needsReview }
                        ?: document.blocks.indexOfFirst { it.needsReview }
                    scope.launch { list.animateScrollToItem(next) }
                }) { Text("בדיקה") }
            }
        }
    }) { padding ->
        SelectionContainer(Modifier.padding(padding).fillMaxSize()) {
            LazyColumn(state = list, contentPadding = PaddingValues(horizontal = 24.dp, vertical = 20.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)) {
                itemsIndexed(document.blocks, key = { index, _ -> index }) { index, block ->
                    Column(Modifier.fillMaxWidth()) {
                        if (index == 0 || document.blocks[index - 1].page != block.page) {
                            Text("עמוד ${block.page + 1}", color = Color.Gray, fontSize = 12.sp,
                                modifier = Modifier.padding(bottom = 12.dp))
                        }
                        val text = remember(block, fonts, fontSize, query) {
                            buildAnnotatedString {
                                for (run in block.runs) {
                                    val family = fonts[run.font] ?: SblHebrew
                                    val style = SpanStyle(fontFamily = family,
                                        fontSize = (fontSize * run.size / document.bodySize).coerceIn(fontSize * .8f, fontSize * 1.5f).sp,
                                        background = if (!block.reviewed && (run.confidence ?: 100) < 75) Color(0xFFFFE8CA) else Color.Unspecified,
                                        fontWeight = if (run.font.contains("Bold", true) && fonts[run.font] == null) FontWeight.Bold else FontWeight.Normal)
                                    // A subset PDF font may not contain a space glyph. Use the app's
                                    // Hebrew font for whitespace while keeping original printed glyphs.
                                    Regex("\\s+|\\S+").findAll(run.text).forEach { token ->
                                        withStyle(if (token.value.isBlank()) style.copy(fontFamily = SblHebrew) else style) { append(token.value) }
                                    }
                                }
                                if (query.isNotBlank()) {
                                    val full = block.text
                                    var start = full.indexOf(query, ignoreCase = true)
                                    while (start >= 0) {
                                        addStyle(SpanStyle(background = Color(0xFFFFE59A)), start, start + query.length)
                                        start = full.indexOf(query, start + query.length, true)
                                    }
                                }
                            }
                        }
                        Text(text, color = Color(0xFF24201C), fontSize = fontSize.sp,
                            lineHeight = (fontSize * 1.65f).sp, modifier = Modifier.fillMaxWidth(),
                            style = LocalTextStyle.current.copy(textDirection = TextDirection.ContentOrRtl),
                            textAlign = if (block.heading) TextAlign.Center else TextAlign.Justify)
                        if (block.ocr) TextButton({ editing = index }, contentPadding = PaddingValues(0.dp)) {
                            Text(if (block.reviewed) "נבדק · עריכת הטקסט" else "השוואה למקור ותיקון", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }
        }
    }
    editing?.let { index ->
        SichaTextReviewDialog(book, index, document.blocks[index], vm) { editing = null }
    }
}

@Composable
private fun SichaTextReviewDialog(book: PdfBook, index: Int, block: SichaTextBlock,
    vm: PdfStudyViewModel, onDismiss: () -> Unit) {
    var text by remember(index) { mutableStateOf(block.text) }
    var saving by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val image by produceState<Bitmap?>(null, index) {
        value = withContext(Dispatchers.IO) {
            runCatching {
                val name = block.sourceImage ?: return@runCatching null
                require(File(name).name == name)
                val original = BitmapFactory.decodeFile(File(vm.sichaFontDirectory(book.id), name).path) ?: return@runCatching null
                val crop = block.sourceBounds ?: SichaCrop(0f, 0f, 1f, 1f)
                val top = (crop.top * original.height).toInt().coerceIn(0, original.height - 1)
                val height = ((crop.bottom - crop.top) * original.height).toInt().coerceIn(1, original.height - top)
                Bitmap.createBitmap(original, 0, top, original.width, height).also { if (it !== original) original.recycle() }
            }.getOrNull()
        }
    }
    AlertDialog(onDismissRequest = { if (!saving) onDismiss() },
        title = { Text("בדיקה ותיקון · עמוד ${block.page + 1}") },
        text = { Column(Modifier.heightIn(max = 560.dp).verticalScroll(rememberScrollState())) {
            Text("התמונה מהקובץ מוצגת מעל הטקסט שזוהה. אפשר לתקן או לאשר אותו כפי שהוא.")
            image?.let { bitmap -> Image(bitmap.asImageBitmap(), "קטע המקור", Modifier.fillMaxWidth()
                .padding(vertical = 12.dp).aspectRatio(bitmap.width.toFloat() / bitmap.height)) }
            OutlinedTextField(text, { text = it }, enabled = !saving, label = { Text("הטקסט לקריאה") },
                modifier = Modifier.fillMaxWidth().heightIn(min = 120.dp, max = 260.dp),
                textStyle = LocalTextStyle.current.copy(textDirection = TextDirection.ContentOrRtl))
            if (error) Text("לא ניתן לשמור את התיקון. נסה שוב.", color = MaterialTheme.colorScheme.error)
        } },
        confirmButton = { Button(enabled = !saving && text.isNotBlank(), onClick = {
            saving = true
            scope.launch {
                if (vm.saveSichaTextBlock(index, text)) onDismiss() else { error = true; saving = false }
            }
        }) { Text(if (saving) "שומר…" else "שמירה ואישור") } },
        dismissButton = { TextButton(onClick = onDismiss, enabled = !saving) { Text("ביטול") } }
    )
}

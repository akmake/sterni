package com.sterni.dailystudy.ui.screens.pdflibrary

import android.app.Activity
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Bundle
import androidx.compose.runtime.saveable.rememberSaveable
import android.provider.OpenableColumns
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.calculatePan
import androidx.compose.foundation.gestures.calculateZoom
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.ColorMatrix
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.ui.theme.Primary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.abs
import kotlin.math.roundToInt

/*
 * ארון הספרים — library + reader for the user's own PDF books.
 *
 * Reader (PdfReader): paged mode (HorizontalPager, Hebrew direction: page 0 on the right, the next
 * page comes from the left) or continuous scroll; tap the side to turn, tap the middle for the bars
 * (they hide by themselves); double-tap or pinch to zoom, zoom kept across pages and re-rendered
 * sharp; bottom page slider; bookmarks; white / sepia / night paper; white margins cut off; screen
 * kept on; system Back closes the book.
 *
 * All text here uses the platform's standard font (default Material typography), not the app's
 * decorative fonts.
 */

private fun getFileName(context: android.content.Context, uri: Uri): String {
    var result: String? = null
    if (uri.scheme == "content") {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) result = cursor.getString(index)
            }
        }
    }
    return result ?: uri.lastPathSegment ?: "ספר חדש"
}

private val SepiaPaper  = Color(0xFFF4ECD8)
private val NightPaper  = Color(0xFF121212)
private val InvertColors = ColorFilter.colorMatrix(
    ColorMatrix(floatArrayOf(
        -1f, 0f, 0f, 0f, 255f,
        0f, -1f, 0f, 0f, 255f,
        0f, 0f, -1f, 0f, 255f,
        0f, 0f, 0f, 1f, 0f
    ))
)
/** Sepia tint for the white of the page (multiplies white toward the paper colour). */
private val SepiaTint = ColorFilter.colorMatrix(
    ColorMatrix(floatArrayOf(
        0.957f, 0f, 0f, 0f, 0f,
        0f, 0.925f, 0f, 0f, 0f,
        0f, 0f, 0.847f, 0f, 0f,
        0f, 0f, 0f, 1f, 0f
    ))
)

private fun paperColor(t: PaperTheme) = when (t) {
    PaperTheme.WHITE -> Color.White
    PaperTheme.SEPIA -> SepiaPaper
    PaperTheme.NIGHT -> NightPaper
}

private fun pageFilter(t: PaperTheme) = when (t) {
    PaperTheme.WHITE -> null
    PaperTheme.SEPIA -> SepiaTint
    PaperTheme.NIGHT -> InvertColors
}

@Composable
fun PdfStudyScreen(
    onBack: () -> Unit,
    vm: PdfStudyViewModel = viewModel()
) {
    // standard platform font for everything in this area
    MaterialTheme(colorScheme = MaterialTheme.colorScheme, typography = Typography(), shapes = MaterialTheme.shapes) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            val state by vm.state.collectAsState()
            var showMafteach by rememberSaveable { mutableStateOf(false) }
            var showSah by rememberSaveable { mutableStateOf(false) }
            var siteState by rememberSaveable { mutableStateOf<Bundle?>(null) }
            val book = state.currentBook
            val engine = state.engine
            if (book != null && state.sichaText != null) {
                SichaReader(book, state.sichaText!!, state.sichaFontSize, vm)
            } else if (book != null && engine != null) {
                PdfReader(book, engine, state.settings, vm)
            }
            else if (showSah) com.sterni.dailystudy.ui.screens.shulchanaruch.SahScreen(onBack = { showSah = false })
            else if (showMafteach) MafteachBrowserScreen(state, vm, siteState,
                onSaveState = { siteState = it }, onBack = { showMafteach = false })
            else PdfLibrary(state, vm, onBack, onMafteach = { showMafteach = true }, onSah = { showSah = true })
            state.ocrRequest?.let { request ->
                AlertDialog(
                    onDismissRequest = { vm.cancelOpening() },
                    title = { Text("להפעיל סריקת טקסט?") },
                    text = { Text("לא ניתן לחלץ את כל הטקסט בעמוד ${request.page} בקובץ \"${request.title}\". להפעיל סריקה כדי לזהות את הטקסט מתוך התמונות? הסריקה נעשית במכשיר ועשויה להימשך זמן ולכלול טעויות זיהוי.") },
                    confirmButton = { Button({ vm.approveOcr() }) { Text("כן, הפעל סריקה") } },
                    dismissButton = { TextButton({ vm.cancelOpening() }) { Text("לא עכשיו") } }
                )
            }
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Library
// ═════════════════════════════════════════════════════════════════════════════

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PdfLibrary(state: PdfState, vm: PdfStudyViewModel, onBack: () -> Unit, onMafteach: () -> Unit, onSah: () -> Unit) {
    val context = LocalContext.current
    var sichot by remember { mutableStateOf(false) }
    val visibleBooks = state.books.filter { (it.collection == "sichot") == sichot }
    BackHandler(enabled = sichot || state.isOpening) {
        if (state.isOpening) vm.cancelOpening() else sichot = false
    }
    var addUri       by remember { mutableStateOf<Uri?>(null) }
    var newTitle     by remember { mutableStateOf("") }
    var newLandscape by remember { mutableStateOf(false) }
    var renaming     by remember { mutableStateOf<PdfBook?>(null) }
    var deleting     by remember { mutableStateOf<PdfBook?>(null) }
    val snackbar = remember { SnackbarHostState() }

    DisposableEffect(Unit) {
        (context as? Activity)?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        onDispose { }
    }
    LaunchedEffect(state.errorMsg) {
        state.errorMsg?.let { snackbar.showSnackbar(it, withDismissAction = true); vm.clearError() }
    }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            newTitle = getFileName(context, uri).replace(".pdf", "", ignoreCase = true)
            newLandscape = false
            addUri = uri
        }
    }

    addUri?.let { uri ->
        AlertDialog(
            onDismissRequest = { addUri = null },
            title = { Text("הוספת ספר") },
            text = {
                Column {
                    OutlinedTextField(newTitle, { newTitle = it }, label = { Text("שם הספר") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Spacer(Modifier.height(12.dp))
                    if (!sichot) Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(newLandscape, { newLandscape = it })
                        Text("קריאה לרוחב המסך")
                    }
                }
            },
            confirmButton = { Button({ vm.addBook(uri, newTitle, newLandscape, if (sichot) "sichot" else null); addUri = null }, colors = ButtonDefaults.buttonColors(containerColor = Primary)) { Text("הוספה") } },
            dismissButton = { TextButton({ addUri = null }) { Text("ביטול") } }
        )
    }
    renaming?.let { b ->
        var t by remember(b.id) { mutableStateOf(b.title) }
        AlertDialog(
            onDismissRequest = { renaming = null },
            title = { Text("שינוי שם") },
            text = { OutlinedTextField(t, { t = it }, singleLine = true, modifier = Modifier.fillMaxWidth()) },
            confirmButton = { Button({ vm.renameBook(b.id, t); renaming = null }, colors = ButtonDefaults.buttonColors(containerColor = Primary)) { Text("שמירה") } },
            dismissButton = { TextButton({ renaming = null }) { Text("ביטול") } }
        )
    }
    deleting?.let { b ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("להסיר את הספר?") },
            text = { Text("\"${b.title}\" יוסר מארון הספרים. הקובץ עצמו נשאר בטלפון.") },
            confirmButton = { TextButton({ vm.removeBook(b.id); deleting = null }) { Text("הסרה", color = Color(0xFFC62828)) } },
            dismissButton = { TextButton({ deleting = null }) { Text("ביטול") } }
        )
    }

    Scaffold(
        containerColor = Color(0xFFF7F7F8),
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text(if (sichot) "לקוטי שיחות" else "ארון הספרים שלי", fontWeight = FontWeight.Bold, color = Primary) },
                navigationIcon = { IconButton({ if (sichot) sichot = false else onBack() }) { Icon(Icons.Default.ArrowForward, "חזרה", tint = Primary) } },
                actions = { IconButton({ launcher.launch(arrayOf("application/pdf")) }) { Icon(Icons.Default.Add, "הוספת ספר", tint = Primary) } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        floatingActionButton = {
            if (visibleBooks.isNotEmpty()) ExtendedFloatingActionButton(
                onClick = { launcher.launch(arrayOf("application/pdf")) },
                containerColor = Primary, contentColor = Color.White,
                icon = { Icon(Icons.Default.Add, null) }, text = { Text("הוספת ספר") }
            )
        }
    ) { pad ->
        Column(Modifier.padding(pad).fillMaxSize()) {
            Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(selected = !sichot, onClick = { sichot = false }, label = { Text("כל הספרים") })
                FilterChip(selected = sichot, onClick = { sichot = true }, label = { Text("לקוטי שיחות") })
                FilterChip(selected = false, onClick = onMafteach, label = { Text("מפתח") })
            }
            if (!sichot) FilledTonalButton(onClick = onSah,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 4.dp)) {
                Icon(Icons.AutoMirrored.Filled.MenuBook, null)
                Spacer(Modifier.width(12.dp))
                Column { Text("שולחן ערוך אדמו״ר הזקן"); Text("גוף הספר · קריאה וחיפוש ללא אינטרנט", fontSize = 12.sp) }
            }
            if (sichot) Text("PDF רגיל או סרוק · קריאה רציפה · ללא הערות שוליים",
                modifier = Modifier.padding(horizontal = 20.dp, vertical = 8.dp), color = Color.Gray, fontSize = 13.sp)
            Box(Modifier.weight(1f).fillMaxWidth()) {
            if (visibleBooks.isEmpty()) {
                Column(Modifier.align(Alignment.Center).padding(40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Icon(Icons.Default.PictureAsPdf, null, tint = Primary.copy(alpha = 0.3f), modifier = Modifier.size(72.dp))
                    Spacer(Modifier.height(16.dp))
                    Text(if (sichot) "הוסף את השיחה הראשונה שלך" else "ארון הספרים ריק", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Primary)
                    Spacer(Modifier.height(6.dp))
                    Text("הוסף קובץ PDF מהטלפון כדי להתחיל לקרוא", fontSize = 14.sp, color = Color.Gray)
                    Spacer(Modifier.height(20.dp))
                    Button({ launcher.launch(arrayOf("application/pdf")) }, colors = ButtonDefaults.buttonColors(containerColor = Primary), shape = RoundedCornerShape(12.dp)) {
                        Text("הוספת קובץ PDF", fontSize = 16.sp)
                    }
                }
            } else {
                val sorted = visibleBooks.sortedByDescending { it.lastOpened ?: 0L }
                val last = sorted.firstOrNull { (it.lastOpened ?: 0L) > 0L }
                LazyColumn(contentPadding = PaddingValues(16.dp, 12.dp, 16.dp, 96.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    if (last != null) item(key = "continue") {
                        ContinueCard(last, vm, state.thumbsVersion) { vm.openBook(last.id) }
                    }
                    item(key = "header") {
                        Text("כל הספרים (${visibleBooks.size})", fontSize = 14.sp, color = Color.Gray, modifier = Modifier.padding(top = 6.dp, start = 4.dp))
                    }
                    items(sorted, key = { it.id }) { b ->
                        BookRow(b, vm, state.thumbsVersion,
                            onOpen = { vm.openBook(b.id) },
                            onRename = { renaming = b },
                            onDelete = { deleting = b })
                    }
                }
            }
            if (state.isOpening && state.ocrRequest == null) Column(Modifier.align(Alignment.Center).background(Color.White, RoundedCornerShape(12.dp)).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally) {
                CircularProgressIndicator(color = Primary)
                Spacer(Modifier.height(12.dp))
                Text(state.extractionProgress?.let { "ממיר לטקסט · ${it.first} מתוך ${it.second} עמודים" } ?: "פותח את הקובץ…")
                TextButton({ vm.cancelOpening() }) { Text("ביטול") }
            }
            }
        }
    }
}

@Composable
private fun Thumb(vm: PdfStudyViewModel, book: PdfBook, version: Int, w: Int, h: Int) {
    val bmp = remember(book.id, version) {
        val f = vm.thumbFile(book.id)
        if (f.exists()) BitmapFactory.decodeFile(f.path) else null
    }
    Box(
        Modifier.size(w.dp, h.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFFECEFF1)),
        contentAlignment = Alignment.Center
    ) {
        if (bmp != null) Image(bmp.asImageBitmap(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
        else Icon(Icons.Default.PictureAsPdf, null, tint = Color(0xFFD32F2F))
    }
}

private fun progressOf(b: PdfBook) = if (b.totalPages > 0) (b.currentPage + 1f) / b.totalPages else 0f

@Composable
private fun ContinueCard(b: PdfBook, vm: PdfStudyViewModel, version: Int, onOpen: () -> Unit) {
    Card(
        Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Primary)
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Thumb(vm, b, version, 60, 82)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text("המשך קריאה", fontSize = 13.sp, color = Color.White.copy(alpha = 0.8f))
                Text(b.title, fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Color.White, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(progress = { progressOf(b) }, color = Color.White, trackColor = Color.White.copy(alpha = 0.25f), modifier = Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)))
                Spacer(Modifier.height(4.dp))
                if (b.totalPages > 0) Text("עמוד ${b.currentPage + 1} מתוך ${b.totalPages}", fontSize = 12.sp, color = Color.White.copy(alpha = 0.8f))
            }
            Icon(Icons.AutoMirrored.Filled.MenuBook, null, tint = Color.White, modifier = Modifier.padding(start = 8.dp))
        }
    }
}

@Composable
private fun BookRow(b: PdfBook, vm: PdfStudyViewModel, version: Int, onOpen: () -> Unit, onRename: () -> Unit, onDelete: () -> Unit) {
    var menu by remember { mutableStateOf(false) }
    Card(
        Modifier.fillMaxWidth().clickable(onClick = onOpen),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Thumb(vm, b, version, 44, 60)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(b.title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF1F2937), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(4.dp))
                val pages = if (b.totalPages > 0) "עמוד ${b.currentPage + 1} מתוך ${b.totalPages}" else "עוד לא נפתח"
                val orient = if (b.isLandscape) "לרוחב" else "לאורך"
                Text("$pages · $orient${if (b.sourceUrl != null) " · מפתח" else ""}", fontSize = 13.sp, color = Color.Gray)
                if (b.totalPages > 0) {
                    Spacer(Modifier.height(6.dp))
                    LinearProgressIndicator(progress = { progressOf(b) }, color = Primary, trackColor = Color(0xFFE5E7EB), modifier = Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(2.dp)))
                }
            }
            Box {
                IconButton({ menu = true }) { Icon(Icons.Default.MoreVert, "אפשרויות", tint = Color.Gray) }
                DropdownMenu(menu, { menu = false }) {
                    DropdownMenuItem(text = { Text("שינוי שם") }, leadingIcon = { Icon(Icons.Default.Edit, null) }, onClick = { menu = false; onRename() })
                    DropdownMenuItem(text = { Text("הסרה מהארון") }, leadingIcon = { Icon(Icons.Default.Delete, null) }, onClick = { menu = false; onDelete() })
                }
            }
        }
    }
}

// ═════════════════════════════════════════════════════════════════════════════
// Reader
// ═════════════════════════════════════════════════════════════════════════════

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
private fun PdfReader(book: PdfBook, engine: PdfRenderEngine, settings: ReaderSettings, vm: PdfStudyViewModel) {
    val context = LocalContext.current
    val view = LocalView.current
    val scope = rememberCoroutineScope()
    val count = engine.pageCount

    BackHandler { vm.closeBook() }
    DisposableEffect(Unit) {
        view.keepScreenOn = true
        onDispose { view.keepScreenOn = false }
    }
    DisposableEffect(book.isLandscape) {
        val activity = context as? Activity
        activity?.requestedOrientation = if (book.isLandscape) ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                                         else ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
        onDispose { activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
    }

    var showBars  by remember { mutableStateOf(true) }
    var barsTouch by remember { mutableIntStateOf(0) }       // any use of the bars restarts their timer
    var zoom      by remember { mutableFloatStateOf(1f) }
    var showSettings  by remember { mutableStateOf(false) }
    var showBookmarks by remember { mutableStateOf(false) }
    var showGoTo      by remember { mutableStateOf(false) }

    LaunchedEffect(showBars, barsTouch, showSettings, showBookmarks, showGoTo) {
        if (showBars && !showSettings && !showBookmarks && !showGoTo) { delay(4000); showBars = false }
    }

    // the page being read survives a switch between paged and scroll mode: both states are
    // re-created from it when the mode changes (scrolling an existing state jumped to page 1)
    var anchor by remember { mutableIntStateOf(book.currentPage.coerceIn(0, count - 1)) }
    val pagerState = key(settings.mode) { rememberPagerState(initialPage = anchor) { count } }
    val listState  = key(settings.mode) { rememberLazyListState(initialFirstVisibleItemIndex = anchor) }
    val currentPage = if (settings.mode == ReadMode.PAGED) pagerState.currentPage else listState.firstVisibleItemIndex
    LaunchedEffect(currentPage) { anchor = currentPage }

    LaunchedEffect(pagerState.settledPage, settings.mode) { if (settings.mode == ReadMode.PAGED) vm.setPage(pagerState.settledPage) }
    LaunchedEffect(listState.firstVisibleItemIndex, settings.mode) { if (settings.mode == ReadMode.SCROLL) vm.setPage(listState.firstVisibleItemIndex) }

    fun goTo(page: Int, animate: Boolean = true) {
        val p = page.coerceIn(0, count - 1)
        scope.launch {
            if (settings.mode == ReadMode.PAGED) { if (animate) pagerState.animateScrollToPage(p) else pagerState.scrollToPage(p) }
            else listState.scrollToItem(p)
        }
    }

    val paper  = paperColor(settings.theme)
    val filter = pageFilter(settings.theme)
    val barBg  = Color(0xF2202124)

    Box(Modifier.fillMaxSize().background(paper)) {
        when (settings.mode) {
            ReadMode.PAGED -> HorizontalPager(
                state = pagerState,
                userScrollEnabled = zoom <= 1.01f,
                beyondBoundsPageCount = 1,
                key = { it },
                modifier = Modifier.fillMaxSize()
            ) { page ->
                PagedPage(
                    engine = engine, page = page, crop = settings.cropMargins, filter = filter,
                    zoom = zoom, onZoom = { zoom = it },
                    onTapSide = { forward -> if (zoom <= 1.01f) goTo(if (forward) page + 1 else page - 1) },
                    onTapMiddle = { showBars = !showBars; barsTouch++ }
                )
            }
            ReadMode.SCROLL -> ScrollPages(
                engine = engine, listState = listState, crop = settings.cropMargins, filter = filter, paper = paper,
                zoom = zoom, onZoom = { zoom = it }, onTap = { showBars = !showBars; barsTouch++ }
            )
        }

        // ── top bar ──────────────────────────────────────────────────────────
        AnimatedVisibility(showBars, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.TopCenter)) {
            val marked = currentPage in (book.bookmarks ?: emptyList())
            Row(
                Modifier.fillMaxWidth().background(barBg).statusBarsPadding().padding(horizontal = 4.dp, vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton({ vm.closeBook() }) { Icon(Icons.Default.Close, "סגירה", tint = Color.White) }
                Text(book.title, color = Color.White, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f).padding(horizontal = 8.dp))
                IconButton({ vm.toggleBookmark(currentPage); barsTouch++ }) {
                    Icon(if (marked) Icons.Default.Bookmark else Icons.Outlined.BookmarkBorder, if (marked) "הסרת סימניה" else "סימניה", tint = if (marked) Color(0xFFFFC107) else Color.White)
                }
                IconButton({ showBookmarks = true }) { Icon(Icons.Default.CollectionsBookmark, "סימניות", tint = Color.White) }
                IconButton({ showSettings = true }) { Icon(Icons.Default.Tune, "תצוגה", tint = Color.White) }
            }
        }

        // ── bottom bar: page slider ─────────────────────────────────────────
        AnimatedVisibility(showBars, enter = fadeIn(), exit = fadeOut(), modifier = Modifier.align(Alignment.BottomCenter)) {
            var dragging by remember { mutableStateOf<Float?>(null) }
            val shown = ((dragging ?: currentPage.toFloat()).roundToInt() + 1).coerceIn(1, count)
            Column(Modifier.fillMaxWidth().background(barBg).navigationBarsPadding().padding(horizontal = 16.dp, vertical = 8.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "עמוד $shown מתוך $count",
                        color = Color.White, fontSize = 15.sp,
                        modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { showGoTo = true }.padding(horizontal = 8.dp, vertical = 6.dp)
                    )
                    Spacer(Modifier.weight(1f))
                    if (zoom > 1.01f) TextButton({ zoom = 1f; barsTouch++ }) { Text("${(zoom * 100).roundToInt()}% · איפוס", color = Color.White) }
                }
                if (count > 1) Slider(
                    value = dragging ?: currentPage.toFloat(),
                    onValueChange = { dragging = it; barsTouch++ },
                    onValueChangeFinished = { dragging?.let { goTo(it.roundToInt(), animate = false) }; dragging = null },
                    valueRange = 0f..(count - 1).toFloat(),
                    colors = SliderDefaults.colors(thumbColor = Color.White, activeTrackColor = Color.White, inactiveTrackColor = Color.White.copy(alpha = 0.3f))
                )
            }
        }
    }

    if (showGoTo) {
        var text by remember { mutableStateOf("${currentPage + 1}") }
        AlertDialog(
            onDismissRequest = { showGoTo = false },
            title = { Text("מעבר לעמוד") },
            text = {
                OutlinedTextField(
                    text, { text = it.filter(Char::isDigit) }, singleLine = true,
                    keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Number),
                    supportingText = { Text("1 עד $count") }
                )
            },
            confirmButton = { TextButton({ text.toIntOrNull()?.let { goTo(it - 1, animate = false) }; showGoTo = false }) { Text("מעבר", color = Primary) } },
            dismissButton = { TextButton({ showGoTo = false }) { Text("ביטול") } }
        )
    }

    if (showBookmarks) ModalBottomSheet(onDismissRequest = { showBookmarks = false }, containerColor = Color.White) {
        val marks = book.bookmarks ?: emptyList()
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
            Text("סימניות", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            if (marks.isEmpty()) Text("אין עדיין סימניות. לחיצה על סמל הסימניה למעלה מסמנת את העמוד.", color = Color.Gray, fontSize = 14.sp, modifier = Modifier.padding(vertical = 12.dp))
            else marks.forEach { p ->
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable { goTo(p, animate = false); showBookmarks = false }.padding(vertical = 12.dp, horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(Icons.Default.Bookmark, null, tint = Color(0xFFFFC107))
                    Spacer(Modifier.width(12.dp))
                    Text("עמוד ${p + 1}", fontSize = 16.sp, modifier = Modifier.weight(1f))
                    IconButton({ vm.toggleBookmark(p) }) { Icon(Icons.Default.Close, "הסרה", tint = Color.Gray) }
                }
            }
        }
    }

    if (showSettings) ModalBottomSheet(onDismissRequest = { showSettings = false }, containerColor = Color.White) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
            Text("תצוגה", fontSize = 18.sp, fontWeight = FontWeight.Bold)
            OptionRow("מצב קריאה", listOf("דפדוף" to (settings.mode == ReadMode.PAGED), "גלילה" to (settings.mode == ReadMode.SCROLL))) { i ->
                val mode = if (i == 0) ReadMode.PAGED else ReadMode.SCROLL
                if (mode != settings.mode) { anchor = currentPage; zoom = 1f; vm.updateSettings { it.copy(mode = mode) } }
            }
            OptionRow("רקע", listOf("לבן" to (settings.theme == PaperTheme.WHITE), "ספיה" to (settings.theme == PaperTheme.SEPIA), "לילה" to (settings.theme == PaperTheme.NIGHT))) { i ->
                vm.updateSettings { it.copy(theme = PaperTheme.entries[i]) }
            }
            OptionRow("כיוון מסך", listOf("לאורך" to !book.isLandscape, "לרוחב" to book.isLandscape)) { i ->
                vm.setLandscape(book.id, i == 1)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("חיתוך שוליים לבנים", fontSize = 15.sp)
                    Text("העמוד ממלא את המסך והאותיות גדולות יותר", fontSize = 12.sp, color = Color.Gray)
                }
                Switch(settings.cropMargins, { on -> vm.updateSettings { it.copy(cropMargins = on) } }, colors = SwitchDefaults.colors(checkedTrackColor = Primary))
            }
        }
    }
}

@Composable
private fun OptionRow(label: String, options: List<Pair<String, Boolean>>, onPick: (Int) -> Unit) {
    Column {
        Text(label, fontSize = 14.sp, color = Color.Gray)
        Spacer(Modifier.height(6.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEachIndexed { i, (text, selected) ->
                FilterChip(
                    selected = selected, onClick = { onPick(i) }, label = { Text(text, fontSize = 15.sp) },
                    colors = FilterChipDefaults.filterChipColors(selectedContainerColor = Primary, selectedLabelColor = Color.White)
                )
            }
        }
    }
}

/** Renders [page] at [widthPx] (re-rendered when the width or crop changes, keeping the old bitmap meanwhile). */
@Composable
private fun rememberPageBitmap(engine: PdfRenderEngine, page: Int, widthPx: Int, crop: Boolean): Bitmap? {
    var bmp by remember(page, crop) { mutableStateOf(engine.cached(page, widthPx, crop)) }
    LaunchedEffect(page, widthPx, crop) {
        if (widthPx <= 0) return@LaunchedEffect
        try { bmp = engine.render(page, widthPx, crop) } catch (_: Exception) {}
    }
    return bmp
}

/** One page in paged mode: fits the screen; pinch / double-tap zoom with pan; taps turn pages. */
@Composable
private fun PagedPage(
    engine: PdfRenderEngine, page: Int, crop: Boolean, filter: ColorFilter?,
    zoom: Float, onZoom: (Float) -> Unit,
    onTapSide: (forward: Boolean) -> Unit, onTapMiddle: () -> Unit
) {
    var box by remember { mutableStateOf(IntSize.Zero) }
    var pan by remember(page) { mutableStateOf(Offset.Zero) }
    // a sharper render once the zoom settles (steps of 0.5)
    val renderZoom = (zoom * 2).roundToInt() / 2f
    var settledZoom by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(renderZoom) { delay(200); settledZoom = renderZoom.coerceAtLeast(1f) }
    val bmp = rememberPageBitmap(engine, page, (box.width * settledZoom).roundToInt(), crop)
    val currentZoom by rememberUpdatedState(zoom)

    fun clampPan(p: Offset, z: Float): Offset {
        val mx = box.width * (z - 1f) / 2f
        val my = box.height * (z - 1f) / 2f
        return Offset(p.x.coerceIn(-mx, mx), p.y.coerceIn(-my, my))
    }

    Box(
        Modifier
            .fillMaxSize()
            .clipToBounds()      // a zoomed page stays inside its own slot (the neighbour showed beside it)
            .onSizeChanged { box = it }
            .pointerInput(page) {
                // two fingers: zoom; one finger while zoomed: pan. Taken before the pager sees it.
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    do {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        val fingers = event.changes.count { it.pressed }
                        if (fingers >= 2) {
                            val z = (currentZoom * event.calculateZoom()).coerceIn(1f, 4f)
                            onZoom(z)
                            pan = if (z <= 1.01f) Offset.Zero else clampPan(pan + event.calculatePan(), z)
                            event.changes.forEach { it.consume() }
                        } else if (fingers == 1 && currentZoom > 1.01f) {
                            pan = clampPan(pan + event.calculatePan(), currentZoom)
                            event.changes.forEach { it.consume() }
                        }
                    } while (event.changes.any { it.pressed })
                }
            }
            .pointerInput(page) {
                detectTapGestures(
                    onDoubleTap = { at ->
                        if (currentZoom > 1.01f) { onZoom(1f); pan = Offset.Zero }
                        else {
                            val z = 2.5f
                            onZoom(z)
                            // keep the tapped spot under the finger
                            val c = Offset(box.width / 2f, box.height / 2f)
                            pan = clampPan((c - at) * (z - 1f), z)
                        }
                    },
                    onTap = { at ->
                        val w = box.width
                        when {
                            at.x < w * 0.28f -> onTapSide(true)    // left = next page (Hebrew book)
                            at.x > w * 0.72f -> onTapSide(false)   // right = previous page
                            else -> onTapMiddle()
                        }
                    }
                )
            },
        contentAlignment = Alignment.Center
    ) {
        if (bmp != null) {
            Image(
                bitmap = bmp.asImageBitmap(), contentDescription = "עמוד ${page + 1}",
                contentScale = ContentScale.Fit, colorFilter = filter,
                modifier = Modifier.fillMaxSize().graphicsLayer(
                    scaleX = zoom, scaleY = zoom, translationX = pan.x, translationY = pan.y
                )
            )
        } else CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(28.dp))
    }
    LaunchedEffect(zoom) { if (zoom <= 1.01f) pan = Offset.Zero }
}

/** Continuous scroll: pages one under the other; pinch / double-tap widens them (side-scroll when wider than the screen). */
@Composable
private fun ScrollPages(
    engine: PdfRenderEngine, listState: androidx.compose.foundation.lazy.LazyListState,
    crop: Boolean, filter: ColorFilter?, paper: Color,
    zoom: Float, onZoom: (Float) -> Unit, onTap: () -> Unit
) {
    var box by remember { mutableStateOf(IntSize.Zero) }
    val density = LocalDensity.current
    val currentZoom by rememberUpdatedState(zoom)
    val hScroll = rememberScrollState()
    val renderZoom = (zoom * 2).roundToInt() / 2f
    var settledZoom by remember { mutableFloatStateOf(1f) }
    LaunchedEffect(renderZoom) { delay(200); settledZoom = renderZoom.coerceAtLeast(1f) }

    Box(
        Modifier
            .fillMaxSize()
            .onSizeChanged { box = it }
            .pointerInput(Unit) {
                awaitEachGesture {
                    awaitFirstDown(requireUnconsumed = false)
                    do {
                        val event = awaitPointerEvent(PointerEventPass.Initial)
                        if (event.changes.count { it.pressed } >= 2) {
                            onZoom((currentZoom * event.calculateZoom()).coerceIn(1f, 4f))
                            event.changes.forEach { it.consume() }
                        }
                    } while (event.changes.any { it.pressed })
                }
            }
            .pointerInput(Unit) {
                detectTapGestures(
                    onDoubleTap = { onZoom(if (currentZoom > 1.01f) 1f else 2f) },
                    onTap = { onTap() }
                )
            }
    ) {
        // not before the width is known: laid out at width 0 every page had height 0, the whole
        // book fitted on the screen and the list snapped back to page 1 — losing the saved page
        if (box.width == 0) return@Box
        val pageW = with(density) { (box.width * zoom).toDp() }
        Box(Modifier.fillMaxSize().horizontalScroll(hScroll, enabled = zoom > 1.01f)) {
            LazyColumn(
                state = listState,
                modifier = Modifier.width(pageW).fillMaxHeight(),
                contentPadding = PaddingValues(vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(engine.pageCount, key = { it }) { page ->
                    var aspect by remember(page, crop) { mutableFloatStateOf(1.414f) }
                    LaunchedEffect(page, crop) { try { aspect = engine.aspect(page, crop) } catch (_: Exception) {} }
                    val bmp = rememberPageBitmap(engine, page, (box.width * settledZoom).roundToInt(), crop)
                    Box(
                        Modifier.fillMaxWidth().aspectRatio(1f / aspect).background(if (paper == NightPaper) Color(0xFF1E1E1E) else Color.White),
                        contentAlignment = Alignment.Center
                    ) {
                        if (bmp != null) Image(bmp.asImageBitmap(), "עמוד ${page + 1}", contentScale = ContentScale.FillBounds, colorFilter = filter, modifier = Modifier.fillMaxSize())
                        else CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
                    }
                }
            }
        }
    }
}

package com.sterni.dailystudy.ui.screens.pdflibrary

import android.app.Activity
import android.content.pm.ActivityInfo
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.Primary

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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PdfStudyScreen(
    onBack: () -> Unit,
    vm: PdfStudyViewModel = viewModel()
) {
    val state   by vm.state.collectAsState()
    val context = LocalContext.current

    var showAddDialog    by remember { mutableStateOf<Uri?>(null) }
    var newBookTitle     by remember { mutableStateOf("") }
    var newBookLandscape by remember { mutableStateOf(false) }

    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument()
    ) { uri: Uri? ->
        if (uri != null) {
            newBookTitle = getFileName(context, uri).replace(".pdf", "", ignoreCase = true)
            showAddDialog = uri
        }
    }

    // ── דיאלוג הוספת ספר ──────────────────────────────────────────────────────
    if (showAddDialog != null) {
        AlertDialog(
            onDismissRequest = { showAddDialog = null },
            title = { Text("הוסף ספר לספרייה") },
            text = {
                Column {
                    OutlinedTextField(
                        value         = newBookTitle,
                        onValueChange = { newBookTitle = it },
                        label         = { Text("שם הספר") },
                        modifier      = Modifier.fillMaxWidth()
                    )
                    Spacer(Modifier.height(16.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked         = newBookLandscape,
                            onCheckedChange = { newBookLandscape = it }
                        )
                        Text("קריאה לרוחב (Landscape)")
                    }
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        vm.addBook(showAddDialog!!, newBookTitle, newBookLandscape)
                        showAddDialog = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                ) { Text("שמור") }
            },
            dismissButton = {
                TextButton(onClick = { showAddDialog = null }) { Text("ביטול") }
            }
        )
    }

    val currentBook = state.currentBook

    // ── מסך הקריאה ────────────────────────────────────────────────────────────
    if (currentBook != null) {
        DisposableEffect(currentBook.isLandscape) {
            val activity = context as? Activity
            activity?.requestedOrientation = if (currentBook.isLandscape)
                ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
            else
                ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
            onDispose {
                activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            }
        }

        var scale       by remember { mutableStateOf(1f) }
        var offsetX     by remember { mutableStateOf(0f) }
        var offsetY     by remember { mutableStateOf(0f) }
        var showControls by remember { mutableStateOf(true) }
        var showGoToPageDialog by remember { mutableStateOf(false) }
        var goToPageStr by remember { mutableStateOf("") }

        if (showGoToPageDialog) {
            AlertDialog(
                onDismissRequest = { showGoToPageDialog = false },
                title = { Text("מעבר לעמוד") },
                text = {
                    OutlinedTextField(
                        value = goToPageStr,
                        onValueChange = { goToPageStr = it },
                        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
                            keyboardType = androidx.compose.ui.text.input.KeyboardType.Number
                        ),
                        singleLine = true,
                        placeholder = { Text("הכנס מספר עמוד (1-${currentBook.totalPages})") }
                    )
                },
                confirmButton = {
                    TextButton(onClick = {
                        val p = goToPageStr.toIntOrNull()
                        if (p != null) {
                            vm.goToPage(p - 1)
                            scale = 1f; offsetX = 0f; offsetY = 0f
                        }
                        showGoToPageDialog = false
                    }) { Text("עבור", color = Primary) }
                },
                dismissButton = {
                    TextButton(onClick = { showGoToPageDialog = false }) { Text("ביטול", color = Primary) }
                }
            )
        }

        Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        var swipeAccX = 0f
                        detectTransformGestures { _, pan, zoom, _ ->
                            if (zoom != 1f) {
                                scale = (scale * zoom).coerceIn(1f, 3f)
                                val maxOffsetX = (size.width * (scale - 1f)) / 2f
                                val maxOffsetY = (size.height * (scale - 1f)) / 2f
                                if (scale > 1f) {
                                    offsetX = (offsetX + pan.x).coerceIn(-maxOffsetX, maxOffsetX)
                                    offsetY = (offsetY + pan.y).coerceIn(-maxOffsetY, maxOffsetY)
                                } else {
                                    offsetX = 0f; offsetY = 0f
                                }
                                swipeAccX = 0f
                            } else if (scale > 1f) {
                                val maxOffsetX = (size.width * (scale - 1f)) / 2f
                                val maxOffsetY = (size.height * (scale - 1f)) / 2f
                                offsetX = (offsetX + pan.x).coerceIn(-maxOffsetX, maxOffsetX)
                                offsetY = (offsetY + pan.y).coerceIn(-maxOffsetY, maxOffsetY)
                                swipeAccX = 0f
                            } else {
                                offsetX = 0f; offsetY = 0f
                                swipeAccX += pan.x
                                if (swipeAccX > 120f) {
                                    vm.nextPage()
                                    scale = 1f; offsetX = 0f; offsetY = 0f; swipeAccX = 0f
                                } else if (swipeAccX < -120f) {
                                    vm.prevPage()
                                    scale = 1f; offsetX = 0f; offsetY = 0f; swipeAccX = 0f
                                }
                            }
                        }
                    }
                    .clickable(
                        indication        = null,
                        interactionSource = remember { MutableInteractionSource() }
                    ) { showControls = !showControls },
                contentAlignment = Alignment.Center
            ) {
                if (state.currentBitmap != null) {
                    Image(
                        bitmap             = state.currentBitmap!!.asImageBitmap(),
                        contentDescription = "PDF Page",
                        modifier           = Modifier
                            .fillMaxSize()
                            .graphicsLayer(
                                scaleX       = scale,
                                scaleY       = scale,
                                translationX = offsetX,
                                translationY = offsetY
                            )
                    )
                }
            }

            if (showControls) {
                // ── כותרת עליונה ──────────────────────────────────────────────
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.6f))
                        .statusBarsPadding()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment     = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { vm.closeBook() }) {
                        Icon(Icons.Default.Close, "Close", tint = Color.White)
                    }
                    Text(
                        text       = currentBook.title,
                        color      = Color.White,
                        fontSize   = 18.sp,
                        fontWeight = FontWeight.Bold,
                        maxLines   = 1,
                        modifier   = Modifier.weight(1f).padding(horizontal = 16.dp)
                    )
                    Text(
                        text     = "${currentBook.currentPage + 1}/${currentBook.totalPages}",
                        color    = Color.White,
                        fontSize = 16.sp
                    )
                }

                // ── ניווט תחתון ───────────────────────────────────────────────
                Row(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .background(Color.Black.copy(alpha = 0.6f))
                        .navigationBarsPadding()
                        .padding(horizontal = 24.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment     = Alignment.CenterVertically
                ) {
                    FilledIconButton(
                        onClick  = { vm.prevPage(); scale = 1f; offsetX = 0f; offsetY = 0f },
                        enabled  = currentBook.currentPage > 0,
                        colors   = IconButtonDefaults.filledIconButtonColors(containerColor = Primary)
                    ) {
                        Icon(Icons.Default.ChevronRight, "Prev Page", tint = Color.White)
                    }

                    Text(
                        "עמוד ${currentBook.currentPage + 1}",
                        color = Color.White,
                        fontSize = 16.sp,
                        modifier = Modifier.clickable { 
                            goToPageStr = "${currentBook.currentPage + 1}"
                            showGoToPageDialog = true 
                        }.padding(8.dp)
                    )

                    FilledIconButton(
                        onClick  = { vm.nextPage(); scale = 1f; offsetX = 0f; offsetY = 0f },
                        enabled  = currentBook.currentPage < currentBook.totalPages - 1,
                        colors   = IconButtonDefaults.filledIconButtonColors(containerColor = Primary)
                    ) {
                        Icon(Icons.Default.ChevronLeft, "Next Page", tint = Color.White)
                    }
                }
            }

            if (state.isLoading) {
                CircularProgressIndicator(
                    color    = Primary,
                    modifier = Modifier.align(Alignment.Center)
                )
            }
        }
        return
    }

    // ── מסך הרשימה ────────────────────────────────────────────────────────────
    DisposableEffect(Unit) {
        val activity = context as? Activity
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        onDispose { }
    }

    Column(modifier = Modifier.fillMaxSize().background(Color(0xFFFDFBF7))) {
        Surface(shadowElevation = 2.dp, color = Color.White) {
            Column {
                Spacer(Modifier.statusBarsPadding())
                Row(
                    modifier          = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowForward, "Back", tint = Primary)
                    }
                    Text(
                        text       = "ארון הספרים שלי",
                        modifier   = Modifier.weight(1f),
                        fontSize   = 20.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = BaHaYetzira,
                        color      = Primary
                    )
                    IconButton(onClick = { launcher.launch(arrayOf("application/pdf")) }) {
                        Icon(Icons.Default.Add, "Add Book", tint = Primary)
                    }
                }
            }
        }

        if (state.books.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier            = Modifier.padding(40.dp)
                ) {
                    Icon(
                        Icons.Default.PictureAsPdf,
                        contentDescription = null,
                        tint               = Primary.copy(alpha = 0.3f),
                        modifier           = Modifier.size(72.dp)
                    )
                    Spacer(Modifier.height(20.dp))
                    Text(
                        "הספרייה שלך ריקה",
                        fontSize   = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = BaHaYetzira,
                        color      = Primary
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "לחץ + להוספת קובץ PDF",
                        fontSize = 14.sp,
                        color    = Color.Gray
                    )
                    Spacer(Modifier.height(24.dp))
                    Button(
                        onClick = { launcher.launch(arrayOf("application/pdf")) },
                        colors  = ButtonDefaults.buttonColors(containerColor = Primary),
                        shape   = RoundedCornerShape(12.dp)
                    ) {
                        Text("הוסף קובץ PDF", fontSize = 16.sp)
                    }
                }
            }
        } else {
            LazyColumn(
                modifier        = Modifier.fillMaxSize().padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                items(state.books, key = { it.id }) { book ->
                    Card(
                        modifier  = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable { vm.openBook(book.id) },
                        shape     = RoundedCornerShape(12.dp),
                        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
                        colors    = CardDefaults.cardColors(containerColor = Color.White)
                    ) {
                        Row(
                            modifier          = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.PictureAsPdf,
                                contentDescription = null,
                                tint     = Color(0xFFD32F2F),
                                modifier = Modifier.size(40.dp)
                            )
                            Spacer(Modifier.width(16.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text       = book.title,
                                    fontSize   = 18.sp,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = BaHaYetzira,
                                    color      = Primary,
                                    maxLines   = 1,
                                    overflow   = TextOverflow.Ellipsis
                                )
                                val pageText   = if (book.totalPages > 0)
                                    "עמוד ${book.currentPage + 1} מתוך ${book.totalPages}"
                                else "לא נפתח עדיין"
                                val orientText = if (book.isLandscape) "לרוחב" else "לאורך"
                                Text(
                                    "$pageText · $orientText",
                                    fontSize = 13.sp,
                                    color    = Color.Gray
                                )
                            }
                            IconButton(onClick = { vm.removeBook(book.id) }) {
                                Icon(Icons.Default.Delete, "Delete", tint = Color.Gray)
                            }
                        }
                    }
                }
            }
        }
    }
}

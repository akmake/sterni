package com.sterni.dailystudy.ui.screens.mamaarim

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.data.model.Mamaar
import com.sterni.dailystudy.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MamaarimScreen(
    onBack:   () -> Unit,
    onOpen:   (String) -> Unit,
    onUpload: () -> Unit = {},
    vm: MamaarimViewModel = viewModel()
) {
    val state by vm.state.collectAsState()

    var mamaarToEdit by remember { mutableStateOf<Mamaar?>(null) }
    var editTitleText by remember { mutableStateOf("") }

    var mamaarToDelete by remember { mutableStateOf<Mamaar?>(null) }

    var mamaarToEditContent by remember { mutableStateOf<Mamaar?>(null) }
    var editContentText by remember { mutableStateOf("") }

    val snackHost = remember { SnackbarHostState() }
    LaunchedEffect(state.error) {
        state.error?.let {
            snackHost.showSnackbar(it)
            vm.clearError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackHost) },
        floatingActionButton = {
            FloatingActionButton(
                onClick        = onUpload,
                containerColor = Primary,
                contentColor   = Color.White,
                shape          = RoundedCornerShape(16.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "העלה מאמר")
            }
        },
        topBar = {
            Surface(shadowElevation = 2.dp, color = Color.White) {
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
                            text = "מאמרים",
                            modifier = Modifier.weight(1f),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = BaHaYetzira,
                            color = Primary
                        )
                        IconButton(onClick = { vm.loadAll() }) {
                            Icon(Icons.Default.Refresh, contentDescription = "רענן", tint = Primary)
                        }
                    }
                }
            }
        },
        containerColor = BgColor
    ) { padding ->

        Box(modifier = Modifier.fillMaxSize().padding(padding)) {

            if (state.mamaarim.isEmpty() && !state.isLoading) {
                MamaarimEmptyState(onRefresh = { vm.loadAll() })
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(state.mamaarim, key = { it.id }) { mamaar ->
                        MamaarCard(
                            mamaar  = mamaar,
                            onClick  = { onOpen(mamaar.id) },
                            onEdit = {
                                editTitleText = mamaar.title
                                mamaarToEdit = mamaar
                            },
                            onEditContent = {
                                editContentText = vm.loadRawText(mamaar.id) ?: ""
                                mamaarToEditContent = mamaar
                            },
                            onDelete = { mamaarToDelete = mamaar }
                        )
                    }
                }
            }

            if (state.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.35f)),
                    contentAlignment = Alignment.Center
                ) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        CircularProgressIndicator(color = Primary)
                        Spacer(Modifier.height(12.dp))
                        Text("טוען מאמרים...", color = Color.White, fontSize = 15.sp)
                    }
                }
            }
        }
    }

    mamaarToEdit?.let { mamaar ->
        AlertDialog(
            onDismissRequest = { mamaarToEdit = null },
            title = { Text("עריכת שם המאמר", textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth()) },
            text = {
                OutlinedTextField(
                    value = editTitleText,
                    onValueChange = { editTitleText = it },
                    modifier = Modifier.fillMaxWidth()
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    if (editTitleText.isNotBlank()) {
                        vm.updateMamaarTitle(mamaar.id, editTitleText.trim())
                    }
                    mamaarToEdit = null
                }) {
                    Text("שמור", color = Primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { mamaarToEdit = null }) { Text("ביטול", color = Muted) }
            }
        )
    }

    mamaarToEditContent?.let { mamaar ->
        AlertDialog(
            onDismissRequest = { mamaarToEditContent = null },
            title = { Text("עריכת תוכן המאמר", textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth()) },
            text = {
                Column(modifier = Modifier.fillMaxWidth().heightIn(max = 400.dp)) {
                    OutlinedTextField(
                        value = editContentText,
                        onValueChange = { editContentText = it },
                        modifier = Modifier
                            .fillMaxWidth()
                            .weight(1f),
                        textStyle = LocalTextStyle.current.copy(
                            fontSize = 14.sp,
                            textAlign = TextAlign.Right
                        ),
                        shape = RoundedCornerShape(12.dp)
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    vm.updateMamaarContent(mamaar.id, editContentText)
                    mamaarToEditContent = null
                }) {
                    Text("שמור", color = Primary)
                }
            },
            dismissButton = {
                TextButton(onClick = { mamaarToEditContent = null }) { Text("ביטול", color = Muted) }
            }
        )
    }

    mamaarToDelete?.let { mamaar ->
        AlertDialog(
            onDismissRequest = { mamaarToDelete = null },
            title = { Text("מחיקת מאמר", textAlign = TextAlign.Right, modifier = Modifier.fillMaxWidth()) },
            text = { Text("האם אתה בטוח שברצונך למחוק את המאמר '${mamaar.title}'?\nפעולה זו אינה ניתנת לביטול.", textAlign = TextAlign.Right) },
            confirmButton = {
                TextButton(onClick = {
                    vm.deleteMamaar(mamaar.id)
                    mamaarToDelete = null
                }) {
                    Text("מחק", color = Color.Red)
                }
            },
            dismissButton = {
                TextButton(onClick = { mamaarToDelete = null }) { Text("ביטול", color = Muted) }
            }
        )
    }
}

@Composable
private fun MamaarimEmptyState(onRefresh: () -> Unit) {
    Box(Modifier.fillMaxSize(), Alignment.Center) {
        Column(
            modifier = Modifier.padding(40.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(
                imageVector = Icons.Default.MenuBook,
                contentDescription = null,
                tint = Primary.copy(alpha = 0.3f),
                modifier = Modifier.size(72.dp)
            )
            Spacer(Modifier.height(20.dp))
            Text(
                text = "אין מאמרים עדיין",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = BaHaYetzira,
                color = Ink
            )
            Spacer(Modifier.height(8.dp))
            Text(
                text = "לחץ לרענון המאמרים מהשרת",
                fontSize = 14.sp,
                color = Muted,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(24.dp))
            Button(
                onClick = onRefresh,
                colors = ButtonDefaults.buttonColors(containerColor = Primary)
            ) {
                Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(8.dp))
                Text("רענן משרת")
            }
        }
    }
}

@Composable
private fun MamaarCard(mamaar: Mamaar, onClick: () -> Unit, onEdit: () -> Unit, onEditContent: () -> Unit, onDelete: () -> Unit) {
    Surface(
        modifier        = Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).clickable(onClick = onClick),
        shape           = RoundedCornerShape(12.dp),
        shadowElevation = 1.dp,
        color           = CardBg
    ) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .width(4.dp)
                    .height(56.dp)
                    .background(Primary, RoundedCornerShape(2.dp))
            )
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text       = mamaar.title,
                    fontSize   = 16.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = BaHaYetzira,
                    color      = Ink,
                    maxLines   = 2,
                    overflow   = TextOverflow.Ellipsis
                )
                Spacer(Modifier.height(4.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text     = formatDate(mamaar.createdAt),
                        fontSize = 12.sp,
                        color    = Muted
                    )
                    Spacer(Modifier.weight(1f))
                    IconButton(onClick = onEditContent, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Article, contentDescription = "ערוך תוכן", tint = Muted, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onEdit, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Edit, contentDescription = "ערוך", tint = Muted, modifier = Modifier.size(16.dp))
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(28.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "מחק", tint = Muted, modifier = Modifier.size(16.dp))
                    }
                }
            }
            Spacer(Modifier.width(8.dp))
            Icon(Icons.Default.ChevronLeft, contentDescription = null, tint = Primary, modifier = Modifier.size(20.dp))
        }
    }
}

private fun formatDate(ms: Long): String {
    val sdf = SimpleDateFormat("dd/MM/yy", Locale.getDefault())
    return sdf.format(Date(ms))
}

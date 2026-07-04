package com.sterni.dailystudy.ui.screens.appblocker

import android.content.Intent
import android.graphics.drawable.Drawable
import android.provider.Settings
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sterni.dailystudy.data.model.AppBlockSchedule
import com.sterni.dailystudy.ui.theme.*
import com.sterni.dailystudy.ui.components.AppScreenHeader
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AppBlockerScreen(
    onBack: () -> Unit,
    viewModel: AppBlockerViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope   = rememberCoroutineScope()
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    // Check accessibility permission
    val isAccessibilityEnabled = remember(context) {
        val enabled = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: ""
        enabled.contains(context.packageName)
    }

    Scaffold(
        topBar = { AppScreenHeader("חוסם אפליקציות", onBack, "זמנים שקטים מהסחות דעת") },
        floatingActionButton = {
            FloatingActionButton(
                onClick          = { viewModel.startNewSchedule() },
                containerColor   = Primary,
                contentColor     = Color.White,
                shape            = CircleShape
            ) {
                Icon(Icons.Default.Add, contentDescription = "הוסף לוח זמנים")
            }
        }
    ) { padding ->
        LazyColumn(
            modifier       = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // ── Accessibility warning ──────────────────────────
            if (!isAccessibilityEnabled) {
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape    = RoundedCornerShape(14.dp),
                        colors   = CardDefaults.cardColors(containerColor = Color(0xFFFFF3CD))
                    ) {
                        Row(
                            modifier          = Modifier.padding(16.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Warning,
                                contentDescription = null,
                                tint               = Color(0xFFB45309),
                                modifier           = Modifier.size(24.dp)
                            )
                            Spacer(Modifier.width(12.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    "נדרשת הרשאת נגישות",
                                    fontWeight = FontWeight.Bold,
                                    fontSize   = 14.sp,
                                    fontFamily = SblHebrew,
                                    color      = Color(0xFF7C4D00)
                                )
                                Spacer(Modifier.height(4.dp))
                                Text(
                                    "כדי לחסום אפליקציות יש להפעיל את השירות בהגדרות הנגישות",
                                    fontSize   = 12.sp,
                                    fontFamily = SblHebrew,
                                    color      = Color(0xFF7C4D00)
                                )
                            }
                        }
                        TextButton(
                            onClick  = {
                                context.startActivity(Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS))
                            },
                            modifier = Modifier.align(Alignment.End).padding(end = 8.dp, bottom = 4.dp)
                        ) {
                            Text("פתח הגדרות", fontFamily = SblHebrew, color = Color(0xFF7C4D00))
                        }
                    }
                }
            }

            // ── Empty state ────────────────────────────────────
            if (uiState.schedules.isEmpty()) {
                item {
                    Column(
                        modifier            = Modifier.fillMaxWidth().padding(vertical = 48.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Icon(
                            Icons.Default.Block,
                            contentDescription = null,
                            tint               = Muted.copy(alpha = 0.3f),
                            modifier           = Modifier.size(64.dp)
                        )
                        Text(
                            "אין לוחות זמנים עדיין",
                            fontSize   = 16.sp,
                            fontFamily = SblHebrew,
                            color      = Muted,
                            textAlign  = TextAlign.Center
                        )
                        Text(
                            "לחץ + כדי להוסיף לוח זמנים חדש",
                            fontSize   = 13.sp,
                            fontFamily = SblHebrew,
                            color      = Muted.copy(alpha = 0.6f),
                            textAlign  = TextAlign.Center
                        )
                    }
                }
            }

            // ── Schedule cards ─────────────────────────────────
            items(uiState.schedules, key = { it.id }) { schedule ->
                ScheduleCard(
                    schedule = schedule,
                    onEdit   = { viewModel.editSchedule(schedule) },
                    onDelete = { viewModel.deleteSchedule(schedule.id) },
                    onToggle = { viewModel.toggleSchedule(schedule.id, it) }
                )
            }

            item { Spacer(Modifier.height(80.dp)) }
        }
    }

    // ── Editor bottom sheet ────────────────────────────────────
    if (uiState.showEditor && uiState.editingSchedule != null) {
        ModalBottomSheet(
            onDismissRequest  = { viewModel.dismissEditor() },
            sheetState        = sheetState,
            containerColor    = MaterialTheme.colorScheme.surface,
            dragHandle        = { BottomSheetDefaults.DragHandle() }
        ) {
            ScheduleEditor(
                schedule     = uiState.editingSchedule!!,
                installedApps= uiState.installedApps,
                isLoadingApps= uiState.isLoadingApps,
                onChange     = { viewModel.updateEditing(it) },
                onSave       = {
                    scope.launch { sheetState.hide() }
                    viewModel.saveSchedule(uiState.editingSchedule!!)
                },
                onDismiss    = {
                    scope.launch { sheetState.hide() }
                    viewModel.dismissEditor()
                }
            )
        }
    }
}

// ── Schedule card ─────────────────────────────────────────────────────────────

@Composable
private fun ScheduleCard(
    schedule: AppBlockSchedule,
    onEdit:   () -> Unit,
    onDelete: () -> Unit,
    onToggle: (Boolean) -> Unit
) {
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape    = RoundedCornerShape(16.dp),
        colors   = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation= CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier          = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = Primary.copy(alpha = 0.1f),
                modifier = Modifier.size(52.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        if (schedule.enabled && schedule.isActiveNow()) Icons.Default.Block
                        else Icons.Default.Schedule,
                        contentDescription = null,
                        tint               = Primary,
                        modifier           = Modifier.size(28.dp)
                    )
                }
            }

            Spacer(Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text       = schedule.formattedRange(),
                    fontSize   = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SblHebrew,
                    color      = Ink
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text       = "${schedule.blockedPackages.size} אפליקציות חסומות",
                    fontSize   = 13.sp,
                    fontFamily = SblHebrew,
                    color      = Muted
                )
                if (schedule.label.isNotEmpty()) {
                    Text(
                        text       = schedule.label,
                        fontSize   = 12.sp,
                        fontFamily = SblHebrew,
                        color      = Primary
                    )
                }
            }

            Switch(
                checked         = schedule.enabled,
                onCheckedChange = onToggle,
                colors          = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = Primary)
            )
        }

        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant, thickness = 0.5.dp)

        Row(
            modifier              = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
            horizontalArrangement = Arrangement.End
        ) {
            TextButton(onClick = onEdit) {
                Icon(Icons.Default.Edit, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("עריכה", fontFamily = SblHebrew)
            }
            TextButton(
                onClick = { showDeleteConfirm = true },
                colors  = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
            ) {
                Icon(Icons.Default.Delete, null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text("מחיקה", fontFamily = SblHebrew)
            }
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title   = { Text("מחיקת לוח זמנים", fontFamily = SblHebrew) },
            text    = { Text("למחוק את לוח הזמנים הזה?", fontFamily = SblHebrew) },
            confirmButton = {
                TextButton(
                    onClick = { showDeleteConfirm = false; onDelete() },
                    colors  = ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error)
                ) { Text("מחק", fontFamily = SblHebrew) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("ביטול", fontFamily = SblHebrew) }
            }
        )
    }
}

// ── Schedule editor ───────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ScheduleEditor(
    schedule:      AppBlockSchedule,
    installedApps: List<InstalledApp>,
    isLoadingApps: Boolean,
    onChange:      (AppBlockSchedule) -> Unit,
    onSave:        () -> Unit,
    onDismiss:     () -> Unit
) {
    var showStartPicker by remember { mutableStateOf(false) }
    var showEndPicker   by remember { mutableStateOf(false) }
    var appSearch       by remember { mutableStateOf("") }

    val startState = rememberTimePickerState(schedule.startHour, schedule.startMinute, is24Hour = true)
    val endState   = rememberTimePickerState(schedule.endHour,   schedule.endMinute,   is24Hour = true)

    Column(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 32.dp)
    ) {
        Text(
            text       = if (schedule.label.isEmpty()) "לוח זמנים חדש" else "עריכת לוח זמנים",
            fontSize   = 18.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = BaHaYetzira,
            modifier   = Modifier.padding(bottom = 20.dp)
        )

        // ── Label ────────────────────────────────────────────
        OutlinedTextField(
            value         = schedule.label,
            onValueChange = { onChange(schedule.copy(label = it)) },
            label         = { Text("שם (אופציונלי)", fontFamily = SblHebrew) },
            modifier      = Modifier.fillMaxWidth(),
            shape         = RoundedCornerShape(12.dp),
            singleLine    = true
        )

        Spacer(Modifier.height(16.dp))

        // ── Time range ────────────────────────────────────────
        Text("טווח שעות", fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
            fontFamily = SblHebrew, color = Muted)
        Spacer(Modifier.height(8.dp))
        Row(
            modifier              = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            TimeButton(
                label   = "מ-",
                time    = "%02d:%02d".format(schedule.startHour, schedule.startMinute),
                onClick = { showStartPicker = true },
                modifier= Modifier.weight(1f)
            )
            TimeButton(
                label   = "עד-",
                time    = "%02d:%02d".format(schedule.endHour, schedule.endMinute),
                onClick = { showEndPicker = true },
                modifier= Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(20.dp))

        // ── App list ──────────────────────────────────────────
        Text(
            "${schedule.blockedPackages.size} אפליקציות נבחרו",
            fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
            fontFamily = SblHebrew, color = Muted
        )
        Spacer(Modifier.height(8.dp))

        OutlinedTextField(
            value         = appSearch,
            onValueChange = { appSearch = it },
            label         = { Text("חיפוש אפליקציה", fontFamily = SblHebrew) },
            modifier      = Modifier.fillMaxWidth(),
            shape         = RoundedCornerShape(12.dp),
            singleLine    = true,
            leadingIcon   = { Icon(Icons.Default.Search, null) }
        )

        Spacer(Modifier.height(8.dp))

        val filtered = installedApps.filter {
            appSearch.isEmpty() || it.label.contains(appSearch, ignoreCase = true)
        }

        if (isLoadingApps) {
            Box(Modifier.fillMaxWidth().height(200.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary)
            }
        } else {
            LazyColumn(
                modifier        = Modifier.fillMaxWidth().height(260.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp)
            ) {
                items(filtered, key = { it.packageName }) { app ->
                    val checked = app.packageName in schedule.blockedPackages
                    AppItem(
                        app     = app,
                        checked = checked,
                        onToggle= {
                            val updated = if (it) schedule.blockedPackages + app.packageName
                                         else    schedule.blockedPackages - app.packageName
                            onChange(schedule.copy(blockedPackages = updated))
                        }
                    )
                }
            }
        }

        Spacer(Modifier.height(20.dp))

        // ── Save ──────────────────────────────────────────────
        Row(
            modifier              = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            OutlinedButton(
                onClick  = onDismiss,
                modifier = Modifier.weight(1f),
                shape    = RoundedCornerShape(12.dp)
            ) { Text("ביטול", fontFamily = SblHebrew) }

            Button(
                onClick  = onSave,
                modifier = Modifier.weight(1f),
                shape    = RoundedCornerShape(12.dp),
                colors   = ButtonDefaults.buttonColors(containerColor = Primary)
            ) { Text("שמירה", fontFamily = SblHebrew, fontWeight = FontWeight.Bold) }
        }
    }

    // ── Time picker dialogs ───────────────────────────────────
    if (showStartPicker) {
        TimePickerDialog(
            state     = startState,
            onConfirm = {
                onChange(schedule.copy(startHour = startState.hour, startMinute = startState.minute))
                showStartPicker = false
            },
            onDismiss = { showStartPicker = false }
        )
    }
    if (showEndPicker) {
        TimePickerDialog(
            state     = endState,
            onConfirm = {
                onChange(schedule.copy(endHour = endState.hour, endMinute = endState.minute))
                showEndPicker = false
            },
            onDismiss = { showEndPicker = false }
        )
    }
}

// ── App item row ──────────────────────────────────────────────────────────────

@Composable
private fun AppItem(
    app:     InstalledApp,
    checked: Boolean,
    onToggle:(Boolean) -> Unit
) {
    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(if (checked) Primary.copy(alpha = 0.06f) else Color.Transparent)
            .clickable { onToggle(!checked) }
            .padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        AppIcon(drawable = app.icon, size = 36)
        Spacer(Modifier.width(12.dp))
        Text(
            text     = app.label,
            fontSize = 14.sp,
            fontFamily = SblHebrew,
            modifier = Modifier.weight(1f),
            color    = Ink
        )
        Checkbox(
            checked         = checked,
            onCheckedChange = onToggle,
            colors          = CheckboxDefaults.colors(checkedColor = Primary)
        )
    }
}

@Composable
private fun AppIcon(drawable: Drawable?, size: Int) {
    val bitmap = remember(drawable) {
        try { drawable?.toBitmap(size, size)?.asImageBitmap() } catch (e: Exception) { null }
    }
    if (bitmap != null) {
        Image(
            bitmap             = bitmap,
            contentDescription = null,
            modifier           = Modifier.size(size.dp).clip(RoundedCornerShape(8.dp))
        )
    } else {
        Box(
            modifier = Modifier
                .size(size.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(Muted.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(Icons.Default.Android, null, tint = Muted, modifier = Modifier.size((size * 0.6f).dp))
        }
    }
}

// ── Time button ───────────────────────────────────────────────────────────────

@Composable
private fun TimeButton(label: String, time: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedButton(
        onClick  = onClick,
        modifier = modifier.height(56.dp),
        shape    = RoundedCornerShape(12.dp)
    ) {
        Text(label, fontFamily = SblHebrew, fontSize = 12.sp, color = Muted)
        Spacer(Modifier.width(4.dp))
        Text(time, fontFamily = SblHebrew, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Ink)
    }
}

// ── Time picker dialog wrapper ────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun TimePickerDialog(
    state:     TimePickerState,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton    = {
            TextButton(onClick = onConfirm) { Text("אישור", fontFamily = SblHebrew) }
        },
        dismissButton    = {
            TextButton(onClick = onDismiss) { Text("ביטול", fontFamily = SblHebrew) }
        },
        text = {
            TimePicker(state = state)
        }
    )
}

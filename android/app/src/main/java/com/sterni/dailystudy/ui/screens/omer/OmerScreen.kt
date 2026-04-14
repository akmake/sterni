package com.sterni.dailystudy.ui.screens.omer

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.ui.theme.*

private val BG           = Color(0xFFEAE8E7)
private val GreenCounted = Color(0xFF00D18C)
private val AmberMissed  = Color(0xFFFFC200)
private val ActiveRing   = Primary
private val FutureText   = Color(0xFF9E9E9E)
private val FutureBg     = Color(0xFFF5F5F5)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OmerScreen(
    onBack: () -> Unit,
    onDayClick: (Int) -> Unit,
    vm: OmerViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    val ctx = LocalContext.current

    val notifPermLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) vm.setNotificationsEnabled(true) }

    // Refresh every time the screen becomes active so the omer day stays current
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) vm.refresh()
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Scaffold(
        containerColor = BG,
        topBar = {
            TopAppBar(
                title = { Text("ספירת העומר", fontFamily = BaHaYetzira) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ChevronRight, contentDescription = null)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                OmerStatusCard(
                    activeDay = state.activeDay,
                    days = state.days,
                    onMark = { vm.markDay(it) },
                    onUnmark = { vm.unmarkDay(it) },
                    onNusachClick = { day -> if (day in 1..49) onDayClick(day) }
                )
            }

            item { Spacer(Modifier.height(4.dp)) }

            for (week in 1..7) {
                item {
                    OmerWeekRow(
                        week = week,
                        days = state.days,
                        onToggle = { entry ->
                            if (entry.counted) vm.unmarkDay(entry.day)
                            else if (entry.canMark) vm.markDay(entry.day)
                        }
                    )
                }
            }

            item { Spacer(Modifier.height(4.dp)) }

            item {
                NotificationToggleCard(
                    enabled = state.notificationsEnabled,
                    onToggle = { enabled ->
                        if (enabled && Build.VERSION.SDK_INT >= 33) {
                            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS)
                                != PackageManager.PERMISSION_GRANTED
                            ) {
                                notifPermLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                return@NotificationToggleCard
                            }
                        }
                        vm.setNotificationsEnabled(enabled)
                    }
                )
            }

            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun OmerStatusCard(
    activeDay: Int,
    days: List<OmerDayEntry>,
    onMark: (Int) -> Unit,
    onUnmark: (Int) -> Unit,
    onNusachClick: (Int) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        color = Color.White,
        shadowElevation = 2.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (activeDay in 1 until 50) {
                Text(
                    text = "יום",
                    fontSize = 13.sp,
                    color = Muted,
                    fontFamily = SblHebrew
                )
                Text(
                    text = days.getOrNull(activeDay - 1)?.hebNumeral ?: "",
                    fontSize = 42.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = BaHaYetzira,
                    color = Primary
                )
                Text(
                    text = "לעומר",
                    fontSize = 13.sp,
                    color = Muted,
                    fontFamily = SblHebrew
                )

                Spacer(Modifier.height(12.dp))

                val entry = days.getOrNull(activeDay - 1)
                if (entry != null) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (!entry.counted) {
                            Button(
                                onClick = { onMark(activeDay) },
                                colors = ButtonDefaults.buttonColors(containerColor = Primary),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("ספרתי ✓", fontFamily = SblHebrew, fontSize = 14.sp)
                            }
                        }
                        OutlinedButton(
                            onClick = { onNusachClick(activeDay) },
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Primary)
                        ) {
                            Text("נוסח הספירה", fontFamily = SblHebrew, fontSize = 14.sp)
                        }
                    }
                }
            } else if (activeDay == -2) {
                Text(
                    text = "בין השמשות",
                    fontSize = 18.sp,
                    fontFamily = BaHaYetzira,
                    color = Amber,
                    textAlign = TextAlign.Center
                )
                Text(
                    text = "המתן לצאת הכוכבים לספירה",
                    fontSize = 13.sp,
                    color = Muted,
                    fontFamily = SblHebrew
                )
            } else {
                Text(
                    text = "אין ספירה כעת",
                    fontSize = 18.sp,
                    fontFamily = BaHaYetzira,
                    color = Muted,
                    textAlign = TextAlign.Center
                )
            }

            Spacer(Modifier.height(16.dp))

            if (activeDay in 1..49) {
                val currentWeek = (activeDay - 1) / 7 + 1
                val weekDays = days.filter { it.week == currentWeek }
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    weekDays.forEach { entry ->
                        val bg = when {
                            entry.counted  -> GreenCounted
                            entry.isActive -> Primary.copy(alpha = 0.15f)
                            else           -> FutureBg
                        }
                        val borderMod = if (entry.isActive)
                            Modifier.border(2.dp, ActiveRing, CircleShape) else Modifier
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .then(borderMod)
                                .clip(CircleShape)
                                .background(bg)
                                .clickable(enabled = entry.canMark || entry.counted) {
                                    if (entry.counted) onUnmark(entry.day) else onMark(entry.day)
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = entry.hebNumeral,
                                fontSize = 11.sp,
                                fontFamily = SblHebrew,
                                color = if (entry.counted) Color.White else Ink
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OmerWeekRow(
    week: Int,
    days: List<OmerDayEntry>,
    onToggle: (OmerDayEntry) -> Unit
) {
    val weekDays = days.filter { it.week == week }
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = Color.White,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            weekDays.forEach { entry ->
                OmerDayCell(entry = entry) { onToggle(entry) }
            }
        }
    }
}

@Composable
private fun OmerDayCell(
    entry: OmerDayEntry,
    onClick: () -> Unit
) {
    val bg = when {
        entry.counted  -> GreenCounted
        entry.isActive -> Primary.copy(alpha = 0.12f)
        entry.canMark  -> AmberMissed.copy(alpha = 0.15f)
        else           -> FutureBg
    }
    val textColor = when {
        entry.counted  -> Color.White
        entry.isActive -> Primary
        entry.canMark  -> AmberMissed
        else           -> FutureText
    }
    val borderMod = if (entry.isActive) Modifier.border(2.dp, ActiveRing, CircleShape) else Modifier

    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier
            .width(40.dp)
            .clickable(enabled = entry.canMark || entry.counted, onClick = onClick)
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .then(borderMod)
                .clip(CircleShape)
                .background(bg),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = entry.hebNumeral,
                fontSize = 12.sp,
                fontFamily = SblHebrew,
                fontWeight = FontWeight.Normal,
                color = textColor
            )
        }
    }
}

@Composable
private fun NotificationToggleCard(
    enabled: Boolean,
    onToggle: (Boolean) -> Unit
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        color = Color.White,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = "תזכורות ספירה",
                fontSize = 15.sp,
                fontFamily = SblHebrew,
                color = Ink
            )
            Switch(
                checked = enabled,
                onCheckedChange = onToggle,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = Color.White,
                    checkedTrackColor = Primary
                )
            )
        }
    }
}

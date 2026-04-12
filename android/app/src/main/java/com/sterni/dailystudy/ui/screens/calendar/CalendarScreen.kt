package com.sterni.dailystudy.ui.screens.calendar

import android.Manifest
import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CalendarViewMonth
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Translate
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.ui.theme.*
import com.kosherjava.zmanim.hebrewcalendar.JewishCalendar
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Locale

private val HEADERS_HE = listOf("א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳")
private val HEADERS_EN = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(vm: CalendarViewModel = viewModel()) {
    val ctx   = LocalContext.current
    val state by vm.state.collectAsState()
    var selectedDay by remember { mutableStateOf<DayCell?>(null) }
    val scope       = rememberCoroutineScope()
    val drawerState = rememberDrawerState(DrawerValue.Closed)

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted -> if (granted) vm.onPermissionGranted() }

    LaunchedEffect(Unit) {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.READ_CALENDAR) == 0) {
            vm.onPermissionGranted()
        } else {
            permLauncher.launch(Manifest.permission.READ_CALENDAR)
        }
    }

    ModalNavigationDrawer(
        drawerState = drawerState,
        drawerContent = {
            ModalDrawerSheet {
                CalendarDrawer(
                    calendars         = state.calendars,
                    hebrewMode        = state.hebrewMode,
                    onToggleCalendar  = { id -> vm.toggleCalendar(id) },
                    onToggleHebrew    = { vm.toggleHebrewMode() },
                    onRefresh         = { vm.reloadEvents() },
                    onClose           = { scope.launch { drawerState.close() } }
                )
            }
        }
    ) {
        Scaffold(
            containerColor = Color.White,
            topBar = {
                TopAppBar(
                    title = {},
                    actions = {
                        IconButton(onClick = { scope.launch { drawerState.open() } }) {
                            Icon(Icons.Outlined.CalendarViewMonth, contentDescription = null)
                        }
                    },
                    colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
                )
            }
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 12.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = { vm.nextMonth() }) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null)
                    }
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        if (state.hebrewMode) {
                            Text(
                                state.hebrewMonthLabel,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = SblHebrew
                            )
                        } else {
                            Text(
                                state.monthLabel,
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold,
                                fontFamily = SblHebrew
                            )
                            if (state.hebrewMonthLabel.isNotEmpty()) {
                                Text(
                                    state.hebrewMonthLabel,
                                    fontSize = 14.sp,
                                    color = Muted,
                                    fontFamily = SblHebrew
                                )
                            }
                        }
                    }
                    IconButton(onClick = { vm.prevMonth() }) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = null)
                    }
                }

                Spacer(Modifier.height(8.dp))

                val headers = if (state.hebrewMode) HEADERS_HE else HEADERS_EN
                Row(Modifier.fillMaxWidth()) {
                    headers.forEach { h ->
                        Text(
                            h,
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 13.sp,
                            color = Muted,
                            fontFamily = SblHebrew
                        )
                    }
                }

                Spacer(Modifier.height(4.dp))

                val offset     = state.startOffset
                val totalCells = offset + state.days.size
                val rows       = (totalCells + 6) / 7

                for (row in 0 until rows) {
                    Row(Modifier.fillMaxWidth()) {
                        for (col in 0 until 7) {
                            val idx = row * 7 + col - offset
                            if (idx in state.days.indices) {
                                val day = state.days[idx]
                                Box(Modifier.weight(1f)) {
                                    MonthDayCell(
                                        day        = day,
                                        hebrewMode = state.hebrewMode,
                                        selected   = selectedDay == day,
                                        onClick    = { selectedDay = day }
                                    )
                                }
                            } else {
                                Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }

                selectedDay?.let { day ->
                    DayDetailSheet(
                        day           = day,
                        year          = state.year,
                        month         = state.month,
                        hebrewMode    = state.hebrewMode,
                        onCreateEvent = {
                            createCalendarEvent(ctx, day.gregYear, day.gregMonth, day.gregDay)
                        },
                        onDismiss     = { selectedDay = null }
                    )
                }
            }
        }
    }
}

@Composable
private fun MonthDayCell(
    day: DayCell,
    hebrewMode: Boolean,
    selected: Boolean,
    onClick: () -> Unit
) {
    val bg = when {
        day.isToday  -> Primary
        selected     -> Primary.copy(alpha = 0.12f)
        day.isShabbat || day.isYomTov -> Color(0xFFF0FDF4)
        else -> Color.Transparent
    }
    val textColor = when {
        day.isToday -> Color.White
        day.isShabbat || day.isYomTov -> Primary
        else -> Ink
    }

    Column(
        modifier = Modifier
            .padding(2.dp)
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        val mainText = if (hebrewMode) day.hebrewLetters else day.day.toString()
        val subText  = if (hebrewMode) day.day.toString() else day.hebrewLetters

        Text(
            mainText,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = SblHebrew,
            color = textColor
        )
        Text(
            subText,
            fontSize = 10.sp,
            color = if (day.isToday) Color.White.copy(alpha = 0.8f) else Muted,
            fontFamily = SblHebrew
        )

        if (day.events.isNotEmpty()) {
            Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                day.events.take(3).forEach { ev ->
                    Box(
                        Modifier
                            .size(5.dp)
                            .clip(CircleShape)
                            .background(Color(ev.color))
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DayDetailSheet(
    day: DayCell,
    year: Int,
    month: Int,
    hebrewMode: Boolean,
    onCreateEvent: () -> Unit,
    onDismiss: () -> Unit
) {
    val jc = remember(day) {
        val cal = Calendar.getInstance().apply {
            set(day.gregYear, day.gregMonth, day.gregDay)
        }
        JewishCalendar(cal)
    }

    val hdf         = remember { com.kosherjava.zmanim.hebrewcalendar.HebrewDateFormatter().apply { isHebrewFormat = true } }
    val hebrewDate  = remember(day) { hdf.format(jc) }
    val gregLabel   = remember(day) {
        "${day.gregDay} ${CalendarViewModel.GREG_MONTHS[day.gregMonth]} ${day.gregYear}"
    }

    val allDay = day.events.filter { it.isAllDay }
    val timed  = day.events.filter { !it.isAllDay }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp),
            contentPadding = PaddingValues(bottom = 32.dp)
        ) {
            item {
                Text(hebrewDate, fontSize = 22.sp, fontWeight = FontWeight.Bold, fontFamily = SblHebrew, color = Primary)
                Text(gregLabel, fontSize = 14.sp, color = Muted, fontFamily = SblHebrew)
                Spacer(Modifier.height(16.dp))
            }

            if (allDay.isNotEmpty()) {
                item {
                    Text("כל היום", fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = SblHebrew, color = Muted)
                    Spacer(Modifier.height(4.dp))
                }
                items(allDay) { ev -> EventSheetRow(ev, allDay = true) }
                item { Spacer(Modifier.height(12.dp)) }
            }

            if (timed.isNotEmpty()) {
                item {
                    Text("אירועים", fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = SblHebrew, color = Muted)
                    Spacer(Modifier.height(4.dp))
                }
                items(timed) { ev -> EventSheetRow(ev, allDay = false) }
            }

            if (day.events.isEmpty()) {
                item {
                    Text("אין אירועים", fontSize = 14.sp, color = Muted, fontFamily = SblHebrew)
                }
            }

            item {
                Spacer(Modifier.height(16.dp))
                TextButton(onClick = onCreateEvent) {
                    Text("הוסף אירוע +", fontFamily = SblHebrew, color = Primary)
                }
            }
        }
    }
}

@Composable
private fun EventSheetRow(ev: CalEvent, allDay: Boolean) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .size(10.dp)
                .clip(CircleShape)
                .background(Color(ev.color))
        )
        Spacer(Modifier.width(8.dp))
        Column(Modifier.weight(1f)) {
            Text(ev.title, fontSize = 14.sp, fontFamily = SblHebrew, color = Ink)
            if (!allDay) {
                Text(
                    "${formatMinute(ev.startMinute)} – ${formatMinute(ev.endMinute)}",
                    fontSize = 12.sp,
                    color = Muted,
                    fontFamily = SblHebrew
                )
            }
        }
    }
}

@Composable
private fun CalendarDrawer(
    calendars: List<CalendarInfo>,
    hebrewMode: Boolean,
    onToggleCalendar: (Long) -> Unit,
    onToggleHebrew: () -> Unit,
    onRefresh: () -> Unit,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxHeight()
            .padding(16.dp)
    ) {
        Text("לוח שנה", fontSize = 22.sp, fontWeight = FontWeight.Bold, fontFamily = BaHaYetzira, color = Primary)
        Spacer(Modifier.height(16.dp))

        DrawerMenuItem(
            Icons.Outlined.Translate,
            if (hebrewMode) "תצוגה לועזית" else "תצוגה עברית",
            selected = hebrewMode,
            onClick  = { onToggleHebrew(); onClose() }
        )
        DrawerMenuItem(
            Icons.Outlined.Refresh,
            "רענון",
            selected = false,
            onClick  = { onRefresh(); onClose() }
        )

        Spacer(Modifier.height(16.dp))
        Text("יומנים", fontSize = 14.sp, fontWeight = FontWeight.Bold, fontFamily = SblHebrew, color = Muted)
        Spacer(Modifier.height(8.dp))

        calendars.forEach { cal ->
            CalendarCheckRow(cal) { onToggleCalendar(cal.id) }
        }
    }
}

@Composable
private fun DrawerMenuItem(
    icon: ImageVector,
    label: String,
    selected: Boolean,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) Primary else Muted)
        Spacer(Modifier.width(12.dp))
        Text(label, fontSize = 15.sp, fontFamily = SblHebrew, color = if (selected) Primary else Ink)
    }
}

@Composable
private fun CalendarCheckRow(cal: CalendarInfo, onToggle: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked = cal.isEnabled,
            onCheckedChange = { onToggle() },
            colors = CheckboxDefaults.colors(checkedColor = Color(cal.color))
        )
        Spacer(Modifier.width(8.dp))
        Column {
            Text(cal.name, fontSize = 14.sp, fontFamily = SblHebrew, color = Ink)
            Text(cal.accountName, fontSize = 11.sp, color = Muted, fontFamily = SblHebrew)
        }
    }
}

private fun formatMinute(min: Int): String {
    if (min < 0) return ""
    val h = min / 60
    val m = min % 60
    return String.format(Locale.US, "%02d:%02d", h, m)
}

private fun createCalendarEvent(ctx: Context, year: Int, month: Int, day: Int) {
    val cal = Calendar.getInstance().apply { set(year, month, day, 9, 0) }
    val intent = Intent(Intent.ACTION_INSERT).apply {
        data = CalendarContract.Events.CONTENT_URI
        putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, cal.timeInMillis)
    }
    ctx.startActivity(intent)
}

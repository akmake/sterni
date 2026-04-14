package com.sterni.dailystudy.ui.screens.calendar

import android.Manifest
import android.content.Context
import android.content.Intent
import android.provider.CalendarContract
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CalendarToday
import androidx.compose.material.icons.outlined.Menu
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.viewmodel.compose.viewModel
import com.kosherjava.zmanim.hebrewcalendar.JewishCalendar
import com.sterni.dailystudy.ui.theme.*
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.Locale

// Columns: index 0 = Sunday (appears rightmost in RTL), index 6 = Saturday (appears leftmost in RTL)
private val HEADERS_EN = listOf("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat")
private val HEADERS_HE = listOf("א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳")

private val SaturdayAmber = Color(0xFFF59E0B)
private val DividerColor  = Color(0xFFEEEEEE)
private val ChipTextColor = Color(0xFF1B5E20)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarScreen(vm: CalendarViewModel = viewModel()) {
    val ctx         = LocalContext.current
    val state       by vm.state.collectAsState()
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
        drawerState   = drawerState,
        drawerContent = {
            ModalDrawerSheet(drawerContainerColor = Color.White) {
                CalendarDrawer(
                    calendars        = state.calendars,
                    hebrewMode       = state.hebrewMode,
                    onToggleCalendar = { id -> vm.toggleCalendar(id) },
                    onToggleHebrew   = { vm.toggleHebrewMode() },
                    onRefresh        = { vm.reloadEvents() },
                    onClose          = { scope.launch { drawerState.close() } }
                )
            }
        }
    ) {
        Scaffold(containerColor = Color.White) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
            ) {
                // ── Top bar ──────────────────────────────────────────────────
                CalendarTopBar(
                    state       = state,
                    onPrev      = { vm.prevMonth() },
                    onNext      = { vm.nextMonth() },
                    onToday     = { vm.goToToday() },
                    onToggleMode= { vm.toggleHebrewMode() },
                    onOpenDrawer= { scope.launch { drawerState.open() } }
                )

                HorizontalDivider(color = DividerColor, thickness = 0.5.dp)

                // ── Column headers ───────────────────────────────────────────
                val headers = if (state.hebrewMode) HEADERS_HE else HEADERS_EN
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    headers.forEachIndexed { i, label ->
                        Text(
                            text       = label,
                            modifier   = Modifier.weight(1f),
                            textAlign  = TextAlign.Center,
                            fontSize   = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color      = if (i == 6) SaturdayAmber else Muted,
                            fontFamily = SblHebrew
                        )
                    }
                }

                HorizontalDivider(color = DividerColor, thickness = 0.5.dp)

                // ── Month grid ───────────────────────────────────────────────
                val offset     = state.startOffset
                val totalCells = offset + state.days.size
                val rows       = (totalCells + 6) / 7

                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(rememberScrollState())
                ) {
                    for (row in 0 until rows) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .defaultMinSize(minHeight = 64.dp)
                        ) {
                            for (col in 0 until 7) {
                                val idx = row * 7 + col - offset
                                Box(modifier = Modifier.weight(1f)) {
                                    if (idx in state.days.indices) {
                                        MonthDayCell(
                                            day        = state.days[idx],
                                            hebrewMode = state.hebrewMode,
                                            colIndex   = col,
                                            onClick    = { selectedDay = state.days[idx] }
                                        )
                                    }
                                }
                            }
                        }
                        HorizontalDivider(color = DividerColor, thickness = 0.5.dp)
                    }
                    Spacer(Modifier.height(32.dp))
                }
            }

            // ── Day detail sheet ─────────────────────────────────────────────
            selectedDay?.let { day ->
                DayDetailSheet(
                    day        = day,
                    hebrewMode = state.hebrewMode,
                    onCreateEvent = {
                        createCalendarEvent(ctx, day.gregYear, day.gregMonth, day.gregDay)
                    },
                    onDismiss  = { selectedDay = null }
                )
            }
        }
    }
}

// ── Top Bar ──────────────────────────────────────────────────────────────────

@Composable
private fun CalendarTopBar(
    state:        CalendarState,
    onPrev:       () -> Unit,
    onNext:       () -> Unit,
    onToday:      () -> Unit,
    onToggleMode: () -> Unit,
    onOpenDrawer: () -> Unit
) {
    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .padding(horizontal = 4.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // In RTL: first item → rightmost visually
        // Hamburger (far right)
        IconButton(onClick = onOpenDrawer) {
            Icon(Icons.Outlined.Menu, contentDescription = null, tint = Ink)
        }

        // Title column
        Column(
            modifier            = Modifier.weight(1f),
            horizontalAlignment = Alignment.Start  // Start = right in RTL
        ) {
            val mainLabel = if (state.hebrewMode) state.hebrewMonthLabel else state.monthLabel
            val subLabel  = if (state.hebrewMode) state.monthLabel else state.hebrewMonthLabel
            Text(
                text       = mainLabel,
                fontSize   = 20.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = BaHaYetzira,
                color      = Ink,
                maxLines   = 1
            )
            if (subLabel.isNotEmpty()) {
                Text(
                    text       = subLabel,
                    fontSize   = 12.sp,
                    color      = Muted,
                    fontFamily = SblHebrew,
                    maxLines   = 1
                )
            }
        }

        // Navigation row (far left in RTL)
        Row(verticalAlignment = Alignment.CenterVertically) {
            // Prev
            IconButton(onClick = onPrev, modifier = Modifier.size(36.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "חודש קודם", tint = Ink, modifier = Modifier.size(18.dp))
            }
            // Next
            IconButton(onClick = onNext, modifier = Modifier.size(36.dp)) {
                Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = "חודש הבא", tint = Ink, modifier = Modifier.size(18.dp))
            }
            // Today
            IconButton(onClick = onToday, modifier = Modifier.size(36.dp)) {
                Icon(Icons.Outlined.CalendarToday, contentDescription = "היום", tint = Ink, modifier = Modifier.size(18.dp))
            }
            // Hebrew toggle
            val toggleActive = state.hebrewMode
            Surface(
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable(onClick = onToggleMode),
                shape = RoundedCornerShape(6.dp),
                color = if (toggleActive) Primary else Color.Transparent
            ) {
                Text(
                    text       = "עב",
                    modifier   = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
                    fontSize   = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = SblHebrew,
                    color      = if (toggleActive) Color.White else Primary
                )
            }
            Spacer(Modifier.width(4.dp))
        }
    }
}

// ── Day Cell ──────────────────────────────────────────────────────────────────

@Composable
private fun MonthDayCell(
    day:       DayCell,
    hebrewMode: Boolean,
    colIndex:  Int,           // 6 = Saturday (leftmost in RTL)
    onClick:   () -> Unit
) {
    val isShabbat   = colIndex == 6   // col 6 = Saturday, always amber
    val numberColor = when {
        day.isToday  -> Color.White
        isShabbat    -> SaturdayAmber
        else         -> Ink
    }
    val mainText = if (hebrewMode) day.hebrewLetters else day.day.toString()
    val subText  = if (hebrewMode) day.day.toString() else day.hebrewLetters

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 2.dp, vertical = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        // Day number — circle for today
        Box(contentAlignment = Alignment.Center) {
            if (day.isToday) {
                Box(
                    modifier = Modifier
                        .size(26.dp)
                        .clip(CircleShape)
                        .background(Primary)
                )
            }
            Text(
                text       = mainText,
                fontSize   = 14.sp,
                fontWeight = if (day.isToday) FontWeight.Bold else FontWeight.Normal,
                fontFamily = SblHebrew,
                color      = numberColor,
                textAlign  = TextAlign.Center
            )
        }

        // Hebrew sub-date
        Text(
            text       = subText,
            fontSize   = 9.sp,
            color      = if (day.isToday) Primary.copy(alpha = 0.75f)
                         else if (isShabbat) SaturdayAmber.copy(alpha = 0.7f)
                         else Muted,
            fontFamily = SblHebrew,
            textAlign  = TextAlign.Center
        )

        // Event chips
        val visibleEvents = day.events.take(3)
        visibleEvents.forEach { ev ->
            CalEventChip(ev)
        }
        if (day.events.size > 3) {
            Text(
                text       = "+${day.events.size - 3}",
                fontSize   = 9.sp,
                color      = Muted,
                modifier   = Modifier.padding(top = 1.dp)
            )
        }
    }
}

@Composable
private fun CalEventChip(ev: CalEvent) {
    val rawColor = remember(ev.color) { Color(ev.color) }
    // Use a readable, saturated version for text; keep bg very light
    val bgColor   = rawColor.copy(alpha = 0.18f)
    val textColor = rawColor.copy(alpha = 1f)
    val label     = if (!ev.isAllDay && ev.startMinute >= 0) {
        "${formatMinute(ev.startMinute)} ${ev.title}"
    } else {
        ev.title
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 1.dp),
        shape = RoundedCornerShape(3.dp),
        color = bgColor
    ) {
        Text(
            text     = label,
            modifier = Modifier.padding(horizontal = 3.dp, vertical = 1.5.dp),
            fontSize = 10.sp,
            color    = textColor,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontFamily = SblHebrew
        )
    }
}

// ── Day Detail ────────────────────────────────────────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DayDetailSheet(
    day:           DayCell,
    hebrewMode:    Boolean,
    onCreateEvent: () -> Unit,
    onDismiss:     () -> Unit
) {
    val jc = remember(day) {
        val cal = Calendar.getInstance().apply { set(day.gregYear, day.gregMonth, day.gregDay) }
        JewishCalendar(cal)
    }
    val hdf        = remember { com.kosherjava.zmanim.hebrewcalendar.HebrewDateFormatter().apply { isHebrewFormat = true } }
    val hebrewDate = remember(day) { hdf.format(jc) }
    val gregLabel  = remember(day) {
        "${day.gregDay} ${CalendarViewModel.GREG_MONTHS[day.gregMonth]} ${day.gregYear}"
    }

    val allDay = day.events.filter { it.isAllDay }
    val timed  = day.events.filter { !it.isAllDay }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor   = Color.White
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            contentPadding = PaddingValues(bottom = 40.dp)
        ) {
            item {
                Text(hebrewDate, fontSize = 22.sp, fontWeight = FontWeight.Bold, fontFamily = BaHaYetzira, color = Primary)
                Text(gregLabel, fontSize = 14.sp, color = Muted, fontFamily = SblHebrew)
                Spacer(Modifier.height(16.dp))
            }

            if (allDay.isNotEmpty()) {
                item {
                    Text("כל היום", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = SblHebrew, color = Muted)
                    Spacer(Modifier.height(4.dp))
                }
                items(allDay) { ev -> EventSheetRow(ev, allDay = true) }
                item { Spacer(Modifier.height(12.dp)) }
            }

            if (timed.isNotEmpty()) {
                item {
                    Text("אירועים", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = SblHebrew, color = Muted)
                    Spacer(Modifier.height(4.dp))
                }
                items(timed) { ev -> EventSheetRow(ev, allDay = false) }
            }

            if (day.events.isEmpty()) {
                item {
                    Box(Modifier.fillMaxWidth().padding(vertical = 24.dp), contentAlignment = Alignment.Center) {
                        Text("אין אירועים ביום זה", fontSize = 15.sp, color = Muted, fontFamily = SblHebrew)
                    }
                }
            }

            item {
                Spacer(Modifier.height(12.dp))
                TextButton(onClick = onCreateEvent) {
                    Text("+ הוסף אירוע", fontFamily = SblHebrew, color = Primary, fontSize = 15.sp)
                }
            }
        }
    }
}

@Composable
private fun EventSheetRow(ev: CalEvent, allDay: Boolean) {
    val evColor = Color(ev.color)
    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .width(4.dp)
                .height(36.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(evColor)
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(ev.title, fontSize = 15.sp, fontFamily = SblHebrew, color = Ink, fontWeight = FontWeight.Medium)
            if (!allDay && ev.startMinute >= 0) {
                Text(
                    "${formatMinute(ev.startMinute)} – ${formatMinute(ev.endMinute)}",
                    fontSize = 13.sp,
                    color    = Muted,
                    fontFamily = SblHebrew
                )
            }
        }
    }
}

// ── Drawer ────────────────────────────────────────────────────────────────────

@Composable
private fun CalendarDrawer(
    calendars:        List<CalendarInfo>,
    hebrewMode:       Boolean,
    onToggleCalendar: (Long) -> Unit,
    onToggleHebrew:   () -> Unit,
    onRefresh:        () -> Unit,
    onClose:          () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxHeight()
            .padding(horizontal = 20.dp, vertical = 24.dp)
    ) {
        Text("לוח שנה", fontSize = 22.sp, fontWeight = FontWeight.Bold, fontFamily = BaHaYetzira, color = Primary)
        Spacer(Modifier.height(20.dp))

        // Hebrew/Gregorian toggle
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .clickable { onToggleHebrew(); onClose() },
            shape = RoundedCornerShape(10.dp),
            color = if (hebrewMode) Primary.copy(alpha = 0.08f) else Color.Transparent
        ) {
            Row(
                modifier          = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(
                    modifier = Modifier.size(36.dp),
                    shape    = CircleShape,
                    color    = Primary.copy(alpha = 0.1f)
                ) {
                    Box(contentAlignment = Alignment.Center) {
                        Text("עב", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Primary, fontFamily = SblHebrew)
                    }
                }
                Spacer(Modifier.width(12.dp))
                Text(
                    if (hebrewMode) "תצוגה עברית (פעיל)" else "תצוגה עברית",
                    fontSize = 15.sp, fontFamily = SblHebrew,
                    color    = if (hebrewMode) Primary else Ink
                )
            }
        }

        Spacer(Modifier.height(4.dp))

        // Refresh
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(10.dp))
                .clickable { onRefresh(); onClose() },
            shape = RoundedCornerShape(10.dp),
            color = Color.Transparent
        ) {
            Row(
                modifier          = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Surface(modifier = Modifier.size(36.dp), shape = CircleShape, color = Color(0xFFF0F0F0)) {
                    Box(contentAlignment = Alignment.Center) {
                        Icon(Icons.Outlined.Refresh, contentDescription = null, tint = Muted, modifier = Modifier.size(18.dp))
                    }
                }
                Spacer(Modifier.width(12.dp))
                Text("רענון", fontSize = 15.sp, fontFamily = SblHebrew, color = Ink)
            }
        }

        Spacer(Modifier.height(20.dp))
        HorizontalDivider(color = DividerColor)
        Spacer(Modifier.height(16.dp))

        Text("יומנים", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, fontFamily = SblHebrew, color = Muted)
        Spacer(Modifier.height(8.dp))

        calendars.forEach { cal ->
            CalendarCheckRow(cal) { onToggleCalendar(cal.id) }
        }
    }
}

@Composable
private fun CalendarCheckRow(cal: CalendarInfo, onToggle: () -> Unit) {
    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggle)
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Checkbox(
            checked         = cal.isEnabled,
            onCheckedChange = { onToggle() },
            colors          = CheckboxDefaults.colors(
                checkedColor   = Color(cal.color),
                uncheckedColor = Muted
            )
        )
        Spacer(Modifier.width(8.dp))
        Column {
            Text(cal.name, fontSize = 14.sp, fontFamily = SblHebrew, color = Ink)
            Text(cal.accountName, fontSize = 11.sp, color = Muted, fontFamily = SblHebrew)
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

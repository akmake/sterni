package com.sterni.dailystudy.ui.screens.zmanim

import android.app.Activity
import android.media.RingtoneManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Alarm
import androidx.compose.material.icons.filled.AlarmOff
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Map
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.alarm.AlarmConfig
import com.sterni.dailystudy.ui.theme.*
import com.sterni.dailystudy.util.HebrewDate
import com.sterni.dailystudy.zmanim.CalculatedZman
import com.sterni.dailystudy.zmanim.ChabadZmanimCalculator
import com.sterni.dailystudy.zmanim.ZmanimLocation
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun ZmanimScreen(
    onBack: () -> Unit,
    onOpenMapPicker: () -> Unit = {},
    vm: ZmanimViewModel = viewModel()
) {
    val state by vm.state.collectAsState()
    var selectedZman by remember { mutableStateOf<CalculatedZman?>(null) }
    val snackbarHostState = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                vm.refresh()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = BgColor
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(BgColor)
                .padding(paddingValues)
        ) {
            // Top Bar
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
                            Icon(Icons.AutoMirrored.Filled.ArrowForward, contentDescription = "חזור", tint = Primary)
                        }
                        Text(
                            "זמני היום — בעל התניא",
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color = Primary
                        )
                        IconButton(onClick = { vm.toggleDualClock() }) {
                            Icon(
                                Icons.Default.Language,
                                contentDescription = "שעון כפול / זמן חו\"ל",
                                tint = if (state.dualClockEnabled) Primary else Muted
                            )
                        }
                    }
                }
            }

            // Location Selector Chips + Map Picker Button
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Map Picker button
                item {
                    FilledTonalButton(
                        onClick = onOpenMapPicker,
                        modifier = Modifier.height(36.dp),
                        shape = RoundedCornerShape(8.dp),
                        contentPadding = PaddingValues(horizontal = 10.dp)
                    ) {
                        Icon(Icons.Default.Map, contentDescription = null, modifier = Modifier.size(16.dp), tint = Primary)
                        Spacer(Modifier.width(4.dp))
                        Text("בחר במפה", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Primary)
                    }
                }

                // Saved & Standard locations
                items(state.allLocations, key = { it.id }) { loc ->
                    val selected = loc.id == state.selectedLocation.id
                    OutlinedButton(
                        onClick = { vm.selectLocation(loc) },
                        modifier = Modifier.height(36.dp),
                        shape = RoundedCornerShape(8.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (selected) Primary else Color.Transparent,
                            contentColor = if (selected) Color.White else Muted
                        ),
                        contentPadding = PaddingValues(horizontal = 10.dp)
                    ) {
                        if (loc.isCurrentGps) {
                            Icon(
                                Icons.Default.MyLocation,
                                contentDescription = null,
                                modifier = Modifier.size(14.dp),
                                tint = if (selected) Color.White else Primary
                            )
                            Spacer(Modifier.width(4.dp))
                        }
                        Text(loc.name, fontSize = 13.sp, maxLines = 1)
                        if (loc.isCustom && !loc.isCurrentGps) {
                            Spacer(Modifier.width(4.dp))
                            IconButton(
                                onClick = { vm.deleteCustomLocation(loc.id) },
                                modifier = Modifier.size(16.dp)
                            ) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "הסר",
                                    tint = if (selected) Color.White else Muted,
                                    modifier = Modifier.size(12.dp)
                                )
                            }
                        }
                    }
                }
            }

            // Dual Clock Card (Samsung-style זמן חו"ל)
            AnimatedVisibility(visible = state.dualClockEnabled && state.compareLocation != null) {
                state.compareLocation?.let { compLoc ->
                    DualClockComparisonCard(
                        currentLoc = state.selectedLocation,
                        compareLoc = compLoc,
                        currentZmanim = state.zmanim,
                        compareZmanim = state.compareZmanim
                    )
                }
            }

            // Date Navigator
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 4.dp),
                shape = RoundedCornerShape(12.dp),
                shadowElevation = 0.dp,
                color = Color(0xFFFDFBF7),
                border = androidx.compose.foundation.BorderStroke(1.dp, LineColor.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 8.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    IconButton(onClick = { vm.shiftDate(+1) }, modifier = Modifier.size(40.dp)) {
                        Icon(Icons.Default.ChevronRight, contentDescription = "יום הבא", tint = Primary)
                    }
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        modifier = Modifier
                            .weight(1f)
                            .padding(horizontal = 8.dp)
                            .pointerInput(state.date) {
                                detectTapGestures(onTap = {
                                    val parts = state.date.split("-").mapNotNull { it.toIntOrNull() }
                                    if (parts.size == 3) {
                                        android.app.DatePickerDialog(
                                            context,
                                            { _, y, m, d ->
                                                val selected = "%04d-%02d-%02d".format(y, m + 1, d)
                                                vm.setDate(selected)
                                            },
                                            parts[0], parts[1] - 1, parts[2]
                                        ).show()
                                    }
                                })
                            }
                    ) {
                        Text(
                            text = HebrewDate.format(state.date),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            fontFamily = BaHaYetzira,
                            color = Primary,
                            textAlign = TextAlign.Center
                        )
                        val dayName = HebrewDate.getDayName(state.date)
                        val isToday = state.date == HebrewDate.today()
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text = if (isToday) "$dayName • היום" else dayName,
                                fontSize = 12.sp,
                                color = if (isToday) Primary else Muted,
                                fontWeight = if (isToday) FontWeight.Bold else FontWeight.Normal
                            )
                            if (!isToday) {
                                Spacer(Modifier.width(6.dp))
                                Text(
                                    text = "(חזור להיום)",
                                    fontSize = 11.sp,
                                    color = Primary,
                                    fontWeight = FontWeight.SemiBold,
                                    modifier = Modifier.pointerInput(Unit) {
                                        detectTapGestures { vm.setDate(HebrewDate.today()) }
                                    }
                                )
                            }
                        }
                    }
                    IconButton(onClick = { vm.shiftDate(-1) }, modifier = Modifier.size(40.dp)) {
                        Icon(Icons.Default.ChevronLeft, contentDescription = "יום קודם", tint = Primary)
                    }
                }
            }

            Text(
                text = "לחץ פעמיים על זמן להגדרת שעון מעורר",
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 4.dp, bottom = 4.dp),
                textAlign = TextAlign.Center,
                fontSize = 12.sp,
                color = Muted
            )

            // Zmanim List
            Box(modifier = Modifier.weight(1f)) {
                when {
                    state.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                        CircularProgressIndicator(color = Primary)
                    }
                    state.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                        Text(state.error!!, color = Muted, fontSize = 15.sp, textAlign = TextAlign.Center)
                    }
                    else -> {
                        val nowMs = System.currentTimeMillis()
                        val isToday = state.date == HebrewDate.today()
                        // Find upcoming zman
                        val upcomingZman = if (isToday) {
                            state.zmanim.firstOrNull { it.timeMillis > nowMs }
                        } else null

                        LazyColumn(
                            modifier = Modifier.fillMaxSize(),
                            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 32.dp)
                        ) {
                            items(state.zmanim, key = { it.label }) { zman ->
                                val hasAlarm = state.alarms.containsKey(zman.label)
                                val isUpcoming = zman == upcomingZman

                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .pointerInput(zman.label) {
                                            detectTapGestures(onDoubleTap = { selectedZman = zman })
                                        }
                                        .background(
                                            if (isUpcoming) Primary.copy(alpha = 0.06f) else Color.Transparent,
                                            RoundedCornerShape(8.dp)
                                        )
                                        .padding(horizontal = 8.dp, vertical = 10.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            Text(
                                                text = zman.label,
                                                fontSize = 17.sp,
                                                color = if (isUpcoming) Primary else Color.Black,
                                                fontWeight = if (isUpcoming) FontWeight.Bold else FontWeight.Medium
                                            )
                                            if (isUpcoming) {
                                                Spacer(Modifier.width(6.dp))
                                                Surface(
                                                    color = Primary.copy(alpha = 0.15f),
                                                    shape = RoundedCornerShape(4.dp)
                                                ) {
                                                    Text(
                                                        "הזמן הקרוב",
                                                        fontSize = 10.sp,
                                                        fontWeight = FontWeight.Bold,
                                                        color = Primary,
                                                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp)
                                                    )
                                                }
                                            }
                                        }
                                        if (zman.description != null) {
                                            Text(
                                                text = zman.description,
                                                fontSize = 11.sp,
                                                color = Muted
                                            )
                                        }
                                    }

                                    if (hasAlarm) {
                                        Icon(
                                            Icons.Default.Alarm,
                                            contentDescription = "יש התראה",
                                            tint = Primary,
                                            modifier = Modifier.size(18.dp)
                                        )
                                        Spacer(Modifier.width(8.dp))
                                    }

                                    Text(
                                        text = zman.time,
                                        fontSize = 19.sp,
                                        color = Primary,
                                        fontFamily = FontFamily.Monospace,
                                        fontWeight = FontWeight.Bold
                                    )
                                }
                                HorizontalDivider(
                                    color = LineColor.copy(alpha = 0.3f),
                                    modifier = Modifier.fillMaxWidth()
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    selectedZman?.let { zman ->
        AlarmSetupBottomSheet(
            zman = zman,
            location = state.selectedLocation,
            existingAlarm = state.alarms[zman.label],
            vm = vm,
            onDismiss = { selectedZman = null },
            onAlarmSetResult = { success ->
                val am = context.getSystemService(android.content.Context.ALARM_SERVICE) as android.app.AlarmManager
                val needsPermission = android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && !am.canScheduleExactAlarms()

                scope.launch {
                    if (success) {
                        snackbarHostState.showSnackbar("ההתראה נקבעה בהצלחה לכל יום")
                    } else if (needsPermission) {
                        val pResult = snackbarHostState.showSnackbar(
                            message = "לצורך התראות מדויקות נדרשת הרשאה מיוחדת",
                            actionLabel = "הגדרות",
                            duration = SnackbarDuration.Long
                        )
                        if (pResult == SnackbarResult.ActionPerformed) {
                            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                                val intent = android.content.Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                                    data = android.net.Uri.parse("package:${context.packageName}")
                                }
                                context.startActivity(intent)
                            }
                        }
                    } else {
                        snackbarHostState.showSnackbar("אירעה שגיאה בקביעת ההתראה")
                    }
                }
            }
        )
    }
}

/**
 * Samsung-style Dual Clock / World Halachic Times Card
 */
@Composable
fun DualClockComparisonCard(
    currentLoc: ZmanimLocation,
    compareLoc: ZmanimLocation,
    currentZmanim: List<CalculatedZman>,
    compareZmanim: List<CalculatedZman>
) {
    val diffHours = remember(currentLoc, compareLoc) {
        ChabadZmanimCalculator.getTimeDifferenceHours(compareLoc)
    }
    val diffText = if (diffHours == 0) "אותו אזור זמן" else if (diffHours > 0) "+$diffHours שעות מאיתנו" else "$diffHours שעות מאיתנו"

    val curTimeStr = remember(currentLoc) {
        val fmt = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = currentLoc.getTimeZone() }
        fmt.format(Date())
    }
    val compTimeStr = remember(compareLoc) {
        val fmt = SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = compareLoc.getTimeZone() }
        fmt.format(Date())
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 6.dp),
        shape = RoundedCornerShape(14.dp),
        color = Color(0xFFFDFBF7),
        border = androidx.compose.foundation.BorderStroke(1.dp, Primary.copy(alpha = 0.25f)),
        shadowElevation = 2.dp
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Default.Language, contentDescription = null, tint = Primary, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(6.dp))
                    Text("שעון כפול / השוואת זמנים", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = Primary)
                }
                Text(diffText, fontSize = 11.sp, color = Muted, fontWeight = FontWeight.Medium)
            }

            Spacer(Modifier.height(8.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                // Column 1: Current location
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(currentLoc.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1)
                    Text(curTimeStr, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Primary, fontFamily = FontFamily.Monospace)
                }

                Box(
                    modifier = Modifier
                        .width(1.dp)
                        .height(44.dp)
                        .background(LineColor.copy(alpha = 0.5f))
                )

                // Column 2: Compare location (e.g. 770)
                Column(
                    modifier = Modifier.weight(1f),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(compareLoc.name, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = Ink, maxLines = 1)
                    Text(compTimeStr, fontSize = 22.sp, fontWeight = FontWeight.Bold, color = Primary, fontFamily = FontFamily.Monospace)
                }
            }

            Spacer(Modifier.height(8.dp))
            HorizontalDivider(color = LineColor.copy(alpha = 0.3f))
            Spacer(Modifier.height(6.dp))

            // Compare 3 key zmanim: סוף זמן ק"ש, שקיעה, צאת
            val compareKeys = listOf("LatestShema" to "סוף ק\"ש", "Shkiah" to "שקיעה", "Tzeis" to "צאת")
            compareKeys.forEach { (type, label) ->
                val curTime = currentZmanim.find { it.type == type }?.time ?: "--:--"
                val compTime = compareZmanim.find { it.type == type }?.time ?: "--:--"
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 2.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(curTime, fontSize = 13.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium, color = Primary)
                    Text(label, fontSize = 12.sp, color = Muted)
                    Text(compTime, fontSize = 13.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Medium, color = Primary)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AlarmSetupBottomSheet(
    zman: CalculatedZman,
    location: ZmanimLocation,
    existingAlarm: AlarmConfig?,
    vm: ZmanimViewModel,
    onDismiss: () -> Unit,
    onAlarmSetResult: (success: Boolean) -> Unit
) {
    var offsetMinutes by remember { mutableIntStateOf(existingAlarm?.offsetMinutes ?: 0) }
    var isBefore by remember { mutableStateOf(existingAlarm?.isBefore ?: true) }
    var ringCount by remember { mutableIntStateOf(existingAlarm?.ringCount ?: 3) }
    var ringDuration by remember { mutableIntStateOf(existingAlarm?.ringDurationSeconds ?: 20) }
    var ringtoneUri by remember { mutableStateOf(existingAlarm?.ringtoneUri ?: "") }
    var ringtoneName by remember { mutableStateOf(if (existingAlarm?.ringtoneUri?.isNotEmpty() == true) "צלצול נבחר" else "ברירת מחדל") }

    val context = LocalContext.current
    val tz = remember(location) { location.getTimeZone() }
    val fmt = remember(tz) { SimpleDateFormat("HH:mm", Locale.US).apply { timeZone = tz } }

    val ringtoneLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == Activity.RESULT_OK) {
            val uri = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU)
                result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI, Uri::class.java)
            else
                @Suppress("DEPRECATION")
                result.data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
            ringtoneUri = uri?.toString() ?: ""
            ringtoneName = if (uri != null)
                RingtoneManager.getRingtone(context, uri)?.getTitle(context) ?: "צלצול נבחר"
            else "ברירת מחדל"
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        containerColor = Color(0xFFFDFBF7)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 24.dp)
                .padding(bottom = 36.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Text(
                text = "שעון מעורר קבוע לזמן הלכתי",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = Primary,
                textAlign = TextAlign.Center
            )
            Spacer(Modifier.height(4.dp))
            Text("התראה יומית לזמן: ${zman.label}", fontSize = 15.sp, color = Color.Gray, textAlign = TextAlign.Center)
            Spacer(Modifier.height(4.dp))

            val offsetMs = offsetMinutes * 60_000L
            val alarmTimeMs = if (isBefore) zman.timeMillis - offsetMs else zman.timeMillis + offsetMs
            Text(
                text = "השעה היום/מחר תהיה: ${fmt.format(Date(alarmTimeMs))}",
                fontSize = 14.sp,
                color = Primary,
                fontWeight = FontWeight.Medium
            )

            Spacer(Modifier.height(20.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("קיזוז זמן", fontSize = 14.sp, color = Color.Gray)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { if (offsetMinutes > 0) offsetMinutes-- }) {
                    Text("−", fontSize = 24.sp, color = Primary, fontWeight = FontWeight.Bold)
                }
                Text(
                    text = "$offsetMinutes דקות",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.width(100.dp),
                    textAlign = TextAlign.Center
                )
                IconButton(onClick = { if (offsetMinutes < 60) offsetMinutes++ }) {
                    Text("+", fontSize = 24.sp, color = Primary, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(10.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                FilterChip(selected = isBefore, onClick = { isBefore = true }, label = { Text("לפני הזמן") })
                FilterChip(selected = !isBefore, onClick = { isBefore = false }, label = { Text("אחרי הזמן") })
            }

            Spacer(Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("מספר צלצולים", fontSize = 14.sp, color = Color.Gray)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                (1..5).forEach { n ->
                    val selected = n == ringCount
                    OutlinedButton(
                        onClick = { ringCount = n },
                        modifier = Modifier.size(48.dp),
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = PaddingValues(0.dp),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = if (selected) Primary else Color.Transparent,
                            contentColor = if (selected) Color.White else Primary
                        )
                    ) {
                        Text("$n", fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            Text("משך כל צלצול", fontSize = 14.sp, color = Color.Gray)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = { if (ringDuration > 5) ringDuration -= 5 }) {
                    Text("−", fontSize = 24.sp, color = Primary, fontWeight = FontWeight.Bold)
                }
                Text(
                    text = "$ringDuration שניות",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.width(100.dp),
                    textAlign = TextAlign.Center
                )
                IconButton(onClick = { if (ringDuration < 120) ringDuration += 5 }) {
                    Text("+", fontSize = 24.sp, color = Primary, fontWeight = FontWeight.Bold)
                }
            }

            Spacer(Modifier.height(16.dp))
            HorizontalDivider()
            Spacer(Modifier.height(16.dp))

            OutlinedButton(
                onClick = {
                    val intent = android.content.Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
                        putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALARM)
                        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
                        putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
                        putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "בחר צלצול")
                        if (ringtoneUri.isNotEmpty())
                            putExtra(RingtoneManager.EXTRA_RINGTONE_EXISTING_URI, Uri.parse(ringtoneUri))
                    }
                    ringtoneLauncher.launch(intent)
                },
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.MusicNote, contentDescription = null, tint = Primary)
                Spacer(Modifier.width(8.dp))
                Text("צלצול: $ringtoneName", color = Primary)
            }

            Spacer(Modifier.height(20.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                if (existingAlarm != null) {
                    OutlinedButton(
                        onClick = { vm.cancelAlarm(zman.label); onDismiss() },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFD32F2F))
                    ) {
                        Icon(Icons.Default.AlarmOff, contentDescription = null)
                        Spacer(Modifier.width(4.dp))
                        Text("בטל התראה")
                    }
                }
                Button(
                    onClick = {
                        val config = AlarmConfig(
                            zmanLabel           = zman.label,
                            offsetMinutes       = offsetMinutes,
                            isBefore            = isBefore,
                            ringCount           = ringCount,
                            ringDurationSeconds = ringDuration,
                            ringtoneUri         = ringtoneUri
                        )
                        val ok = vm.scheduleAlarm(zman, config)
                        onAlarmSetResult(ok)
                        if (ok) onDismiss()
                    },
                    modifier = Modifier.weight(1f),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                ) {
                    Icon(Icons.Default.Alarm, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("קבע התראה")
                }
            }
        }
    }
}

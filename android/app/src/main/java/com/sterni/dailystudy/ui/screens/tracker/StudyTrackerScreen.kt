package com.sterni.dailystudy.ui.screens.tracker

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.notification.MidnightReminderReceiver
import com.sterni.dailystudy.notification.ZmanBriefWorker
import com.sterni.dailystudy.tracker.StudyTracker
import com.sterni.dailystudy.ui.theme.*
import com.sterni.dailystudy.widget.StudyWidgetProvider
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun StudyTrackerScreen(onBack: () -> Unit) {
    val context = LocalContext.current

    var todayStatus    by remember { mutableStateOf(StudyTracker.getTodayStatus(context)) }
    var enabledStudies by remember { mutableStateOf(StudyTracker.getEnabledStudies(context)) }
    var briefEnabled   by remember { mutableStateOf(ZmanBriefWorker.isEnabled(context)) }
    var midnightEnabled by remember { mutableStateOf(MidnightReminderReceiver.isEnabled(context)) }

    val recentDates = remember { StudyTracker.getRecentDates(context, 14) }

    var selectedTab by remember { mutableIntStateOf(0) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgColor)
    ) {
        Surface(shadowElevation = 0.dp, color = Color(0xFFFDFBF7)) {
            Column {
                Spacer(Modifier.statusBarsPadding())
                Row(
                    modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowForward, contentDescription = "חזור", tint = Primary)
                    }
                    Text(
                        "מעקב לימודים",
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        color = Primary
                    )
                    Spacer(Modifier.width(48.dp))
                }
            }
        }

        TabRow(
            selectedTabIndex = selectedTab,
            containerColor = Color(0xFFFDFBF7),
            contentColor = Primary
        ) {
            Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }) {
                Text("היום", modifier = Modifier.padding(vertical = 12.dp), fontSize = 14.sp)
            }
            Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }) {
                Text("הגדרות", modifier = Modifier.padding(vertical = 12.dp), fontSize = 14.sp)
            }
            Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }) {
                Text("היסטוריה", modifier = Modifier.padding(vertical = 12.dp), fontSize = 14.sp)
            }
        }

        when (selectedTab) {
            0 -> TrackerTodayTab(
                context = context,
                todayStatus = todayStatus,
                onToggle = { key ->
                    StudyTracker.toggleCompleted(context, key)
                    todayStatus = StudyTracker.getTodayStatus(context)
                    StudyWidgetProvider.updateAll(context)
                }
            )
            1 -> TrackerSettingsTab(
                context = context,
                enabledStudies = enabledStudies,
                briefEnabled = briefEnabled,
                midnightEnabled = midnightEnabled,
                onToggleStudy = { key ->
                    val updated = enabledStudies.toMutableSet()
                    if (key in updated) updated.remove(key) else updated.add(key)
                    enabledStudies = updated
                    StudyTracker.setEnabledStudies(context, updated)
                    todayStatus = StudyTracker.getTodayStatus(context)
                    StudyWidgetProvider.updateAll(context)
                },
                onBriefToggle = { on ->
                    briefEnabled = on
                    ZmanBriefWorker.setEnabled(context, on)
                },
                onMidnightToggle = { on ->
                    midnightEnabled = on
                    MidnightReminderReceiver.setEnabled(context, on)
                }
            )
            2 -> TrackerHistoryTab(context = context, dates = recentDates)
        }
    }
}

@Composable
private fun TrackerTodayTab(
    context: Context,
    todayStatus: List<Pair<String, Boolean>>,
    onToggle: (String) -> Unit
) {
    val done  = todayStatus.count { it.second }
    val total = todayStatus.size

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                color = if (done == total && total > 0) Primary.copy(alpha = 0.1f)
                else Color(0xFFFDFBF7),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (done == total && total > 0) Primary.copy(alpha = 0.3f)
                    else LineColor.copy(alpha = 0.5f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        if (done == total && total > 0) "כל הכבוד! השלמת הכל \uD83C\uDF1F"
                        else "$done מתוך $total הושלמו",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = if (done == total && total > 0) Primary else Ink
                    )
                    Spacer(Modifier.height(8.dp))
                    LinearProgressIndicator(
                        progress = { if (total > 0) done.toFloat() / total else 0f },
                        modifier = Modifier.fillMaxWidth().height(8.dp)
                            .clip(RoundedCornerShape(4.dp)),
                        color = Primary,
                        trackColor = LineColor
                    )
                }
            }
        }

        items(todayStatus, key = { it.first }) { (key, completed) ->
            val label = StudyTracker.STUDY_LABELS[key] ?: key
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onToggle(key) },
                shape = RoundedCornerShape(12.dp),
                color = Color(0xFFFDFBF7),
                border = androidx.compose.foundation.BorderStroke(
                    1.dp,
                    if (completed) Primary.copy(alpha = 0.3f) else LineColor.copy(alpha = 0.5f)
                )
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Checkbox(
                        checked = completed,
                        onCheckedChange = { onToggle(key) },
                        colors = CheckboxDefaults.colors(
                            checkedColor = Primary,
                            uncheckedColor = Muted
                        )
                    )
                    Spacer(Modifier.width(8.dp))
                    Text(
                        label,
                        fontSize = 16.sp,
                        fontWeight = if (completed) FontWeight.Normal else FontWeight.SemiBold,
                        color = if (completed) Muted else Ink
                    )
                    if (completed) {
                        Spacer(Modifier.weight(1f))
                        Icon(Icons.Default.Check, null, tint = Primary, modifier = Modifier.size(20.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackerSettingsTab(
    context: Context,
    enabledStudies: Set<String>,
    briefEnabled: Boolean,
    midnightEnabled: Boolean,
    onToggleStudy: (String) -> Unit,
    onBriefToggle: (Boolean) -> Unit,
    onMidnightToggle: (Boolean) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        item {
            Text("לימודים במעקב", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Primary)
            Spacer(Modifier.height(4.dp))
            Text("בחר אילו לימודים לעקוב אחריהם", fontSize = 13.sp, color = Muted)
        }
        items(StudyTracker.ALL_STUDY_KEYS) { key ->
            val label   = StudyTracker.STUDY_LABELS[key] ?: key
            val checked = key in enabledStudies
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(12.dp),
                color    = Color(0xFFFDFBF7),
                border   = androidx.compose.foundation.BorderStroke(1.dp, LineColor.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier
                        .clickable { onToggleStudy(key) }
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Switch(
                        checked = checked,
                        onCheckedChange = { onToggleStudy(key) },
                        colors = SwitchDefaults.colors(checkedTrackColor = Primary)
                    )
                    Spacer(Modifier.width(12.dp))
                    Text(label, fontSize = 15.sp, color = Ink)
                }
            }
        }

        item {
            Spacer(Modifier.height(8.dp))
            Text("התראות", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Primary)
        }
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(12.dp),
                color    = Color(0xFFFDFBF7),
                border   = androidx.compose.foundation.BorderStroke(1.dp, LineColor.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Switch(
                        checked = briefEnabled,
                        onCheckedChange = onBriefToggle,
                        colors = SwitchDefaults.colors(checkedTrackColor = Primary)
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("הזמן הבא (Brief)", fontSize = 15.sp, color = Ink)
                        Text("התראה קבועה עם הזמן ההלכתי הבא", fontSize = 12.sp, color = Muted)
                    }
                }
            }
        }
        item {
            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(12.dp),
                color    = Color(0xFFFDFBF7),
                border   = androidx.compose.foundation.BorderStroke(1.dp, LineColor.copy(alpha = 0.5f))
            ) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Switch(
                        checked = midnightEnabled,
                        onCheckedChange = onMidnightToggle,
                        colors = SwitchDefaults.colors(checkedTrackColor = Primary)
                    )
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text("תזכורת לפני חצות", fontSize = 15.sp, color = Ink)
                        Text("מזכיר ב-23:55 על לימודים שלא הושלמו", fontSize = 12.sp, color = Muted)
                    }
                }
            }
        }
    }
}

@Composable
private fun TrackerHistoryTab(context: Context, dates: List<String>) {
    val displaySdf = remember { SimpleDateFormat("EEEE, d בMMMM", Locale("he")) }
    val parseSdf   = remember { SimpleDateFormat("yyyy-MM-dd", Locale.US) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items(dates) { dateStr ->
            val status = StudyTracker.getDateStatus(context, dateStr)
            val done   = status.count { it.second }
            val total  = status.size
            val dateLabel = try {
                displaySdf.format(parseSdf.parse(dateStr) ?: Date())
            } catch (_: Exception) { dateStr }

            Surface(
                modifier = Modifier.fillMaxWidth(),
                shape    = RoundedCornerShape(12.dp),
                color    = Color(0xFFFDFBF7),
                border   = androidx.compose.foundation.BorderStroke(1.dp, LineColor.copy(alpha = 0.5f))
            ) {
                Column(modifier = Modifier.padding(12.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(dateLabel, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = Ink)
                        Text(
                            "$done/$total",
                            fontSize = 13.sp,
                            color = if (done == total && total > 0) Primary else Muted,
                            fontWeight = FontWeight.Bold
                        )
                    }
                    if (total > 0) {
                        Spacer(Modifier.height(8.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            status.forEach { (_, completed) ->
                                Box(
                                    modifier = Modifier
                                        .size(12.dp)
                                        .clip(CircleShape)
                                        .background(if (completed) Primary else LineColor)
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

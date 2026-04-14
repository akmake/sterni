package com.sterni.dailystudy.ui.screens.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.automirrored.filled.VolumeUp
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sterni.dailystudy.data.model.Study
import com.sterni.dailystudy.tracker.StudyTracker
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.Ink
import com.sterni.dailystudy.ui.theme.Muted
import com.sterni.dailystudy.ui.theme.Primary
import com.sterni.dailystudy.ui.theme.SblHebrew

private val HomeBg  = Color(0xFFFDFBF7)
private val CardBg  = Color.White

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onStudyClick: (studyKey: String, date: String, title: String, label: String) -> Unit,
    onZmanimClick:   () -> Unit = {},
    onMamaarimClick: () -> Unit = {},
    onLocationClick: () -> Unit = {},
    onTrackerClick:  () -> Unit = {},
    onCalendarClick: () -> Unit = {},
    onSettingsClick: () -> Unit = {},
    onToolsClick:    () -> Unit = {},
    onTefilaClick:   () -> Unit = {},
    onOmerClick:     () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val context = LocalContext.current
    var todayStatus by remember { mutableStateOf(StudyTracker.getTodayStatus(context)) }

    Scaffold(
        containerColor = HomeBg,
        bottomBar = {
            NavigationBar(
                containerColor = CardBg,
                tonalElevation = 0.dp,
                modifier = Modifier
                    .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
            ) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Default.Home, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label = { Text("בית", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor   = Primary,
                        selectedTextColor   = Primary,
                        indicatorColor      = Primary.copy(alpha = 0.1f),
                        unselectedIconColor = Muted,
                        unselectedTextColor = Muted
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onZmanimClick,
                    icon = { Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label = { Text("זמנים", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor   = Primary,
                        selectedTextColor   = Primary,
                        indicatorColor      = Primary.copy(alpha = 0.1f),
                        unselectedIconColor = Muted,
                        unselectedTextColor = Muted
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onToolsClick,
                    icon = { Icon(Icons.Default.Tune, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label = { Text("כלים", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor   = Primary,
                        selectedTextColor   = Primary,
                        indicatorColor      = Primary.copy(alpha = 0.1f),
                        unselectedIconColor = Muted,
                        unselectedTextColor = Muted
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onCalendarClick,
                    icon = { Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label = { Text("לוח", fontSize = 11.sp) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor   = Primary,
                        selectedTextColor   = Primary,
                        indicatorColor      = Primary.copy(alpha = 0.1f),
                        unselectedIconColor = Muted,
                        unselectedTextColor = Muted
                    )
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            when {
                uiState.isLoading -> CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = Primary,
                    strokeWidth = 2.dp
                )
                uiState.error != null -> ErrorState(
                    message   = uiState.error!!,
                    onRetry   = { viewModel.loadDailyStudy() },
                    modifier  = Modifier.align(Alignment.Center)
                )
                else -> {
                    val orderedKeys    = listOf("chumash", "rambam", "rambamOne", "tanya", "shnayimMikra", "tehillim")
                    val orderedStudies = orderedKeys.mapNotNull { key -> uiState.studies[key]?.let { key to it } }

                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        // ── Header ───────────────────────────────────────────
                        item {
                            HomeHeader(
                                hebrewDate      = uiState.hebrewDate,
                                onSettingsClick = onSettingsClick,
                                onRefreshClick  = {
                                    viewModel.loadDailyStudy()
                                    todayStatus = StudyTracker.getTodayStatus(context)
                                }
                            )
                        }

                        // ── Quick access ─────────────────────────────────────
                        item {
                            QuickAccessRow(
                                onMamaarimClick = onMamaarimClick,
                                onOmerClick     = onOmerClick,
                                onToolsClick    = onToolsClick,
                                onTefilaClick   = onTefilaClick,
                                modifier        = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }

                        // ── Progress ─────────────────────────────────────────
                        if (todayStatus.isNotEmpty()) {
                            item {
                                DailyProgressCard(
                                    todayStatus = todayStatus,
                                    modifier    = Modifier.padding(horizontal = 16.dp).padding(bottom = 8.dp)
                                )
                            }
                        }

                        // ── Section header ───────────────────────────────────
                        item {
                            Text(
                                text     = "לימוד היום",
                                modifier = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color    = Muted,
                                fontFamily = SblHebrew
                            )
                        }

                        // ── Study cards ──────────────────────────────────────
                        itemsIndexed(orderedStudies, key = { _, pair -> pair.first }) { index, (key, study) ->
                            AnimatedVisibility(
                                visible = true,
                                enter = slideInVertically(
                                    initialOffsetY = { 40 + index * 15 },
                                    animationSpec  = tween(350, delayMillis = index * 40)
                                ) + fadeIn(animationSpec = tween(350, delayMillis = index * 40))
                            ) {
                                StudyCard(
                                    studyKey = key,
                                    study    = study,
                                    modifier = Modifier
                                        .padding(horizontal = 16.dp)
                                        .padding(bottom = 10.dp),
                                    onClick  = {
                                        if (study.available == true) {
                                            onStudyClick(key, uiState.date, study.title ?: "", study.label ?: "")
                                        }
                                    }
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Header ──────────────────────────────────────────────────────────────────

@Composable
fun HomeHeader(
    hebrewDate:      String,
    onSettingsClick: () -> Unit,
    onRefreshClick:  () -> Unit
) {
    Surface(color = CardBg, shadowElevation = 0.dp) {
        Column {
            Spacer(Modifier.statusBarsPadding())
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 18.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.CenterVertically
            ) {
                Column {
                    Text(
                        text       = "לימוד יומי",
                        fontSize   = 28.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = BaHaYetzira,
                        color      = Primary
                    )
                    if (hebrewDate.isNotEmpty()) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text       = hebrewDate,
                            fontSize   = 15.sp,
                            fontFamily = SblHebrew,
                            color      = Muted
                        )
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(
                        onClick  = onRefreshClick,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Primary.copy(alpha = 0.07f))
                    ) {
                        Icon(
                            imageVector        = Icons.Rounded.Refresh,
                            contentDescription = "רענן",
                            tint               = Primary,
                            modifier           = Modifier.size(20.dp)
                        )
                    }
                    IconButton(
                        onClick  = onSettingsClick,
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(Primary.copy(alpha = 0.07f))
                    ) {
                        Icon(
                            imageVector        = Icons.Rounded.Settings,
                            contentDescription = "הגדרות",
                            tint               = Primary,
                            modifier           = Modifier.size(20.dp)
                        )
                    }
                }
            }

            HorizontalDivider(color = Color(0xFFE4E4E7), thickness = 0.5.dp)
        }
    }
}

// ── Quick Access ─────────────────────────────────────────────────────────────

@Composable
private fun QuickAccessRow(
    onMamaarimClick: () -> Unit,
    onOmerClick:     () -> Unit,
    onToolsClick:    () -> Unit,
    onTefilaClick:   () -> Unit,
    modifier:        Modifier = Modifier
) {
    Row(
        modifier              = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        QuickChip(
            label    = "מאמרים",
            icon     = Icons.AutoMirrored.Filled.List,
            onClick  = onMamaarimClick,
            modifier = Modifier.weight(1f)
        )
        QuickChip(
            label    = "ספירה",
            icon     = Icons.Default.DateRange,
            onClick  = onOmerClick,
            modifier = Modifier.weight(1f)
        )
        QuickChip(
            label    = "כלים",
            icon     = Icons.Default.Tune,
            onClick  = onToolsClick,
            modifier = Modifier.weight(1f)
        )
        QuickChip(
            label    = "תפילה",
            icon     = Icons.AutoMirrored.Filled.MenuBook,
            onClick  = onTefilaClick,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun QuickChip(
    label:    String,
    icon:     ImageVector,
    onClick:  () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier        = modifier
            .clip(RoundedCornerShape(14.dp))
            .clickable(onClick = onClick),
        shape           = RoundedCornerShape(14.dp),
        color           = Primary.copy(alpha = 0.07f),
        shadowElevation = 0.dp
    ) {
        Column(
            modifier            = Modifier
                .fillMaxWidth()
                .padding(vertical = 14.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Box(
                modifier         = Modifier
                    .size(36.dp)
                    .clip(CircleShape)
                    .background(Primary.copy(alpha = 0.12f)),
                contentAlignment = Alignment.Center
            ) {
                Icon(icon, contentDescription = null, tint = Primary, modifier = Modifier.size(18.dp))
            }
            Text(
                text       = label,
                fontSize   = 12.sp,
                color      = Primary,
                fontFamily = SblHebrew
            )
        }
    }
}

// ── Progress Card ────────────────────────────────────────────────────────────

@Composable
private fun DailyProgressCard(
    todayStatus: List<Pair<String, Boolean>>,
    modifier:    Modifier = Modifier
) {
    val done     = todayStatus.count { it.second }
    val total    = todayStatus.size
    val progress = if (total > 0) done.toFloat() / total else 0f
    val allDone  = done == total && total > 0
    val ringColor = if (allDone) Color(0xFF059669) else Primary

    Surface(
        modifier        = modifier.fillMaxWidth(),
        shape           = RoundedCornerShape(18.dp),
        color           = CardBg,
        shadowElevation = 1.dp
    ) {
        Row(
            modifier          = Modifier
                .fillMaxWidth()
                .padding(horizontal = 18.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(modifier = Modifier.size(56.dp), contentAlignment = Alignment.Center) {
                val trackColor = Color(0xFFE4E4E7)
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val stroke = 5.dp.toPx()
                    drawArc(color = trackColor, startAngle = -90f, sweepAngle = 360f, useCenter = false, style = Stroke(width = stroke))
                    if (progress > 0f) {
                        drawArc(color = ringColor, startAngle = -90f, sweepAngle = 360f * progress, useCenter = false, style = Stroke(width = stroke, cap = StrokeCap.Round))
                    }
                }
                Text(
                    text       = "$done/$total",
                    fontSize   = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color      = ringColor
                )
            }

            Spacer(Modifier.width(16.dp))

            Column {
                Text(
                    text       = if (allDone) "כל הכבוד! סיימת הכל ✓" else "ההתקדמות שלך להיום",
                    fontSize   = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    color      = if (allDone) ringColor else Ink,
                    fontFamily = SblHebrew
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text       = if (allDone) "עברת על כל $total הלימודים" else "נשארו עוד ${total - done} לימודים",
                    fontSize   = 13.sp,
                    color      = Muted,
                    fontFamily = SblHebrew
                )
            }
        }
    }
}

// ── Study Card ───────────────────────────────────────────────────────────────

@Composable
private fun StudyCard(
    studyKey: String,
    study:    Study,
    modifier: Modifier = Modifier,
    onClick:  () -> Unit
) {
    val available    = study.available == true
    val accentColor  = studyAccentColor(study.accent)
    val icon         = studyIcon(studyKey)

    Surface(
        modifier        = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .clickable(enabled = available, onClick = onClick),
        shape           = RoundedCornerShape(16.dp),
        color           = CardBg,
        shadowElevation = if (available) 1.5.dp else 0.5.dp
    ) {
        Row(
            modifier          = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Icon box
            Box(
                modifier         = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(
                        if (available) accentColor.copy(alpha = 0.10f)
                        else           Color(0xFFF4F4F5)
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector        = icon,
                    contentDescription = null,
                    tint               = if (available) accentColor else Muted,
                    modifier           = Modifier.size(22.dp)
                )
            }

            Spacer(Modifier.width(14.dp))

            // Text content
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment    = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier             = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text       = study.title ?: "",
                        fontSize   = 16.sp,
                        fontWeight = FontWeight.Bold,
                        color      = if (available) Ink else Muted,
                        fontFamily = SblHebrew,
                        modifier   = Modifier.weight(1f, fill = false)
                    )
                    if (available && !study.label.isNullOrEmpty()) {
                        Spacer(Modifier.width(8.dp))
                        Surface(
                            shape = RoundedCornerShape(6.dp),
                            color = accentColor.copy(alpha = 0.09f)
                        ) {
                            Text(
                                text       = study.label,
                                modifier   = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                                fontSize   = 12.sp,
                                fontWeight = FontWeight.SemiBold,
                                color      = accentColor,
                                fontFamily = SblHebrew,
                                style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                            )
                        }
                    }
                }

                if (!study.subtitle.isNullOrEmpty()) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text       = study.subtitle,
                        fontSize   = 13.sp,
                        color      = Muted,
                        fontFamily = SblHebrew
                    )
                }

                if (available && !study.preview.isNullOrEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text       = study.preview,
                        fontSize   = 13.sp,
                        lineHeight = 20.sp,
                        color      = Muted.copy(alpha = 0.8f),
                        maxLines   = 2,
                        overflow   = TextOverflow.Ellipsis,
                        fontFamily = SblHebrew,
                        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )
                }

                if (!available) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text       = "לא נמצאו נתונים להיום",
                        fontSize   = 12.sp,
                        color      = Muted.copy(alpha = 0.55f),
                        fontFamily = SblHebrew
                    )
                }
            }

            if (available) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    imageVector        = Icons.Default.ChevronLeft,
                    contentDescription = null,
                    tint               = Muted.copy(alpha = 0.4f),
                    modifier           = Modifier.size(20.dp)
                )
            }
        }
    }
}

// ── Error State ───────────────────────────────────────────────────────────────

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier              = modifier.padding(32.dp),
        horizontalAlignment   = Alignment.CenterHorizontally,
        verticalArrangement   = Arrangement.spacedBy(16.dp)
    ) {
        Icon(
            Icons.Default.CloudOff,
            contentDescription = null,
            tint     = Muted,
            modifier = Modifier.size(48.dp)
        )
        Text("שגיאה בטעינה", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = Ink, fontFamily = SblHebrew)
        Text(message, fontSize = 14.sp, color = Muted, textAlign = TextAlign.Center, fontFamily = SblHebrew)
        Button(
            onClick = onRetry,
            colors  = ButtonDefaults.buttonColors(containerColor = Primary),
            shape   = RoundedCornerShape(12.dp)
        ) {
            Text("נסה שוב", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

private fun studyAccentColor(accent: String?): Color = when (accent) {
    "blue"    -> Color(0xFF0284C7)
    "emerald" -> Color(0xFF059669)
    "violet"  -> Color(0xFF7C3AED)
    "amber"   -> Color(0xFFD97706)
    else      -> Primary
}

private fun studyIcon(key: String): ImageVector = when (key) {
    "chumash"         -> Icons.AutoMirrored.Filled.MenuBook
    "tehillim"        -> Icons.Default.MusicNote
    "tanya"           -> Icons.Default.Star
    "rambam"          -> Icons.Default.School
    "rambamOne"       -> Icons.Default.School
    "seferHamitzvot"  -> Icons.AutoMirrored.Filled.List
    "shnayimMikra"    -> Icons.AutoMirrored.Filled.VolumeUp
    else              -> Icons.AutoMirrored.Filled.MenuBook
}

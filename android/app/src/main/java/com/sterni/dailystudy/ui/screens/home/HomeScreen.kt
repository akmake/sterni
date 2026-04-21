package com.sterni.dailystudy.ui.screens.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
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
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onStudyClick:       (studyKey: String, date: String, title: String, label: String) -> Unit,
    onZmanimClick:      () -> Unit = {},
    onMamaarimClick:    () -> Unit = {},
    onLocationClick:    () -> Unit = {},
    onTrackerClick:     () -> Unit = {},
    onCalendarClick:    () -> Unit = {},
    onSettingsClick:    () -> Unit = {},
    onToolsClick:       () -> Unit = {},
    onNewsClick:        () -> Unit = {},
    onTefilaClick:      () -> Unit = {},
    onPdfLibraryClick:  () -> Unit = {},
    viewModel: HomeViewModel = hiltViewModel()
) {
    val uiState     by viewModel.uiState.collectAsStateWithLifecycle()
    val context     = LocalContext.current
    var todayStatus by remember { mutableStateOf(StudyTracker.getTodayStatus(context)) }
    var dateOffset  by remember { mutableStateOf(0) }
    val displayDate = remember(dateOffset) { LocalDate.now().plusDays(dateOffset.toLong()) }

    LaunchedEffect(dateOffset) {
        viewModel.loadDailyStudy(displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
    }

    Scaffold(
        containerColor = Color.White,
        contentWindowInsets = WindowInsets(0.dp),
        bottomBar = {
            Column(Modifier.background(Color.White)) {
                HorizontalDivider(color = Color(0xFFF0F0F0), thickness = 0.5.dp)
                NavigationBar(
                    containerColor = Color.White,
                    tonalElevation = 0.dp,
                    modifier       = Modifier.navigationBarsPadding()
                ) {
                    NavigationBarItem(
                        selected = true,
                        onClick  = {},
                        icon     = { Icon(Icons.Default.Home, contentDescription = null, modifier = Modifier.size(22.dp)) },
                        label    = { Text("בית", fontSize = 11.sp, fontFamily = SblHebrew) },
                        colors   = navColors()
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick  = onZmanimClick,
                        icon     = { Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(22.dp)) },
                        label    = { Text("זמנים", fontSize = 11.sp, fontFamily = SblHebrew) },
                        colors   = navColors()
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick  = onNewsClick,
                        icon     = { Icon(androidx.compose.material.icons.Icons.Default.Feed, contentDescription = null, modifier = Modifier.size(22.dp)) },
                        label    = { Text("חדשות", fontSize = 11.sp, fontFamily = SblHebrew) },
                        colors   = navColors()
                    )
                    NavigationBarItem(
                        selected = false,
                        onClick  = onCalendarClick,
                        icon     = { Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(22.dp)) },
                        label    = { Text("לוח", fontSize = 11.sp, fontFamily = SblHebrew) },
                        colors   = navColors()
                    )
                }
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            when {
                uiState.isLoading -> LazyColumn(
                    modifier       = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(bottom = 24.dp)
                ) {
                    item { SkeletonHeader() }
                    item { SkeletonQuickRow() }
                    items(6) { index ->
                        SkeletonStudyRow()
                        if (index < 5) HorizontalDivider(
                            modifier  = Modifier.padding(start = 19.dp),
                            color     = Color(0xFFF0F0F0),
                            thickness = 0.5.dp
                        )
                    }
                }
                uiState.error != null -> ErrorState(
                    message  = uiState.error!!,
                    onRetry  = { viewModel.loadDailyStudy(displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE)) },
                    modifier = Modifier.align(Alignment.Center)
                )
                else -> {
                    val orderedKeys    = listOf("chumash", "rambam", "rambamOne", "tanya", "shnayimMikra", "tehillim")
                    val orderedStudies = orderedKeys.mapNotNull { key -> uiState.studies[key]?.let { key to it } }

                    LazyColumn(
                        modifier       = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(bottom = 24.dp)
                    ) {
                        item {
                            HomeHeader(
                                displayDate     = displayDate,
                                hebrewDate      = uiState.hebrewDate,
                                onSettingsClick = onSettingsClick,
                                onRefreshClick  = {
                                    viewModel.loadDailyStudy(displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
                                    todayStatus = StudyTracker.getTodayStatus(context)
                                },
                                onPrevDay = { dateOffset-- },
                                onNextDay = { dateOffset++ }
                            )
                        }

                        item {
                            QuickAccessRow(
                                onMamaarimClick   = onMamaarimClick,
                                onTefilaClick     = onTefilaClick,
                                onPdfLibraryClick = onPdfLibraryClick,
                                onToolsClick      = onToolsClick,
                                modifier          = Modifier.padding(horizontal = 16.dp, vertical = 12.dp)
                            )
                        }

                        item {
                            Text(
                                text          = "לימוד היום",
                                modifier      = Modifier.padding(horizontal = 20.dp, vertical = 8.dp),
                                fontSize      = 11.sp,
                                fontWeight    = FontWeight.SemiBold,
                                color         = Muted.copy(alpha = 0.6f),
                                fontFamily    = SblHebrew,
                                letterSpacing = 0.8.sp
                            )
                        }

                        itemsIndexed(orderedStudies, key = { _, pair -> pair.first }) { index, (key, study) ->
                            AnimatedVisibility(
                                visible = true,
                                enter = slideInVertically(
                                    initialOffsetY = { 30 + index * 10 },
                                    animationSpec  = tween(300, delayMillis = index * 35)
                                ) + fadeIn(animationSpec = tween(300, delayMillis = index * 35))
                            ) {
                                StudyRow(
                                    studyKey = key,
                                    study    = study,
                                    onClick  = {
                                        if (study.available == true) {
                                            onStudyClick(key, uiState.date, study.title ?: "", study.label ?: "")
                                        }
                                    }
                                )
                            }
                            if (index < orderedStudies.size - 1) {
                                HorizontalDivider(
                                    modifier  = Modifier.padding(start = 19.dp),
                                    color     = Color(0xFFF0F0F0),
                                    thickness = 0.5.dp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

// ── Nav colors ────────────────────────────────────────────────────────────────

@Composable
private fun navColors() = NavigationBarItemDefaults.colors(
    selectedIconColor   = Primary,
    selectedTextColor   = Primary,
    indicatorColor      = Color.Transparent,
    unselectedIconColor = Muted.copy(alpha = 0.45f),
    unselectedTextColor = Muted.copy(alpha = 0.45f)
)

// ── Header ────────────────────────────────────────────────────────────────────

@Composable
fun HomeHeader(
    displayDate:     LocalDate,
    hebrewDate:      String,
    onSettingsClick: () -> Unit,
    onRefreshClick:  () -> Unit,
    onPrevDay:       () -> Unit,
    onNextDay:       () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxWidth().background(Color.White)
    ) {
        Spacer(Modifier.statusBarsPadding())

        // Row 1 — settings + refresh above the date (as requested)
        Row(
            modifier              = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
                .height(48.dp),
            horizontalArrangement = Arrangement.End,
            verticalAlignment     = Alignment.CenterVertically
        ) {
            IconButton(onClick = onRefreshClick, modifier = Modifier.size(48.dp)) {
                Icon(
                    imageVector        = Icons.Rounded.Refresh,
                    contentDescription = "רענן",
                    tint               = Muted.copy(alpha = 0.5f),
                    modifier           = Modifier.size(20.dp)
                )
            }
            IconButton(onClick = onSettingsClick, modifier = Modifier.size(48.dp)) {
                Icon(
                    imageVector        = Icons.Rounded.Settings,
                    contentDescription = "הגדרות",
                    tint               = Muted.copy(alpha = 0.5f),
                    modifier           = Modifier.size(20.dp)
                )
            }
        }

        // Row 2 — date navigation (day + Hebrew date)
        Row(
            modifier              = Modifier
                .fillMaxWidth()
                .padding(horizontal = 4.dp)
                .padding(bottom = 14.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment     = Alignment.CenterVertically
        ) {
            IconButton(onClick = onPrevDay, modifier = Modifier.size(44.dp)) {
                Icon(
                    Icons.Default.KeyboardArrowRight,
                    contentDescription = "יום קודם",
                    tint               = Muted.copy(alpha = 0.4f),
                    modifier           = Modifier.size(26.dp)
                )
            }

            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text       = displayDate.toHebrewDayOfWeek(),
                    fontSize   = 12.sp,
                    fontFamily = SblHebrew,
                    color      = Muted,
                    fontWeight = FontWeight.Normal
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text       = com.sterni.dailystudy.util.HebrewDate.format(
                        displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE)
                    ),
                    fontSize   = 26.sp,
                    fontFamily = BaHaYetzira,
                    color      = Ink,
                    textAlign  = TextAlign.Center
                )
            }

            IconButton(onClick = onNextDay, modifier = Modifier.size(44.dp)) {
                Icon(
                    Icons.Default.KeyboardArrowLeft,
                    contentDescription = "יום הבא",
                    tint               = Muted.copy(alpha = 0.4f),
                    modifier           = Modifier.size(26.dp)
                )
            }
        }

        HorizontalDivider(color = Color(0xFFF0F0F0), thickness = 0.5.dp)
    }
}

// ── Quick Access ──────────────────────────────────────────────────────────────

@Composable
private fun QuickAccessRow(
    onMamaarimClick:   () -> Unit,
    onTefilaClick:     () -> Unit,
    onPdfLibraryClick: () -> Unit,
    onToolsClick:      () -> Unit,
    modifier:          Modifier = Modifier
) {
    Row(
        modifier              = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        QuickChip(label = "מאמרים", icon = Icons.AutoMirrored.Filled.List,     onClick = onMamaarimClick,   modifier = Modifier.weight(1f))
        QuickChip(label = "תפילה",  icon = Icons.AutoMirrored.Filled.MenuBook,  onClick = onTefilaClick,     modifier = Modifier.weight(1f))
        QuickChip(label = "ספריה",  icon = Icons.Default.PictureAsPdf,          onClick = onPdfLibraryClick, modifier = Modifier.weight(1f))
        QuickChip(label = "כלים",   icon = Icons.Default.Tune,                  onClick = onToolsClick,      modifier = Modifier.weight(1f))
    }
}

@Composable
private fun QuickChip(
    label:    String,
    icon:     ImageVector,
    onClick:  () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier            = modifier
            .clip(RoundedCornerShape(12.dp))
            .background(Primary.copy(alpha = 0.07f))
            .clickable(onClick = onClick)
            .padding(vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp)
    ) {
        Icon(
            imageVector        = icon,
            contentDescription = null,
            tint               = Primary,
            modifier           = Modifier.size(20.dp)
        )
        Text(
            text       = label,
            fontSize   = 11.sp,
            color      = Primary,
            fontFamily = SblHebrew,
            fontWeight = FontWeight.SemiBold
        )
    }
}

// ── Study Row ─────────────────────────────────────────────────────────────────

@Composable
private fun StudyRow(
    studyKey: String,
    study:    Study,
    onClick:  () -> Unit
) {
    val available   = study.available == true
    val accentColor = studyAccentColor(study.accent)

    Row(
        modifier          = Modifier
            .fillMaxWidth()
            .height(IntrinsicSize.Min)
            .background(if (available) Color.White else Color(0xFFFAFAFA))
            .clickable(enabled = available, onClick = onClick),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Accent bar — first in RTL Row = physically RIGHT side (start of reading direction)
        Box(
            modifier = Modifier
                .width(3.dp)
                .fillMaxHeight()
                .background(if (available) accentColor else Color.Transparent)
        )

        // Content
        Row(
            modifier          = Modifier
                .weight(1f)
                .padding(horizontal = 16.dp, vertical = 14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Icon(
                imageVector        = studyIcon(studyKey),
                contentDescription = null,
                tint               = if (available) accentColor else Muted.copy(alpha = 0.35f),
                modifier           = Modifier.size(22.dp)
            )
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text       = study.title ?: "",
                        fontSize   = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color      = if (available) Ink else Muted,
                        fontFamily = SblHebrew,
                        modifier   = Modifier.weight(1f, fill = false)
                    )
                    if (available && !study.label.isNullOrEmpty()) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text      = study.label,
                            fontSize  = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color     = accentColor,
                            fontFamily = SblHebrew,
                            modifier  = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(accentColor.copy(alpha = 0.08f))
                                .padding(horizontal = 7.dp, vertical = 2.dp),
                            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                        )
                    }
                }

                if (!study.subtitle.isNullOrEmpty()) {
                    Spacer(Modifier.height(3.dp))
                    Text(
                        text       = study.subtitle,
                        fontSize   = 13.sp,
                        color      = Muted,
                        fontFamily = SblHebrew
                    )
                }

                if (available && !study.preview.isNullOrEmpty()) {
                    Spacer(Modifier.height(5.dp))
                    Text(
                        text       = study.preview,
                        fontSize   = 13.sp,
                        lineHeight = 19.sp,
                        color      = Muted.copy(alpha = 0.75f),
                        maxLines   = 2,
                        overflow   = TextOverflow.Ellipsis,
                        fontFamily = SblHebrew,
                        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )
                }

                if (!available) {
                    Spacer(Modifier.height(3.dp))
                    Text(
                        text       = "לא נמצאו נתונים להיום",
                        fontSize   = 12.sp,
                        color      = Muted.copy(alpha = 0.45f),
                        fontFamily = SblHebrew
                    )
                }
            }

            if (available) {
                Spacer(Modifier.width(8.dp))
                Icon(
                    imageVector        = Icons.Default.ChevronLeft,
                    contentDescription = null,
                    tint               = Muted.copy(alpha = 0.25f),
                    modifier           = Modifier.size(18.dp)
                )
            }
        }
    }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

@Composable
private fun SkeletonHeader() {
    Column(Modifier.fillMaxWidth().background(Color.White)) {
        Spacer(Modifier.statusBarsPadding())
        Spacer(Modifier.height(48.dp))
        Column(
            Modifier.fillMaxWidth().padding(horizontal = 4.dp).padding(bottom = 20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Box(Modifier.width(80.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFEEEEEE)))
            Box(Modifier.width(180.dp).height(26.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFFE8E8E8)))
        }
        HorizontalDivider(color = Color(0xFFF0F0F0), thickness = 0.5.dp)
    }
}

@Composable
private fun SkeletonQuickRow() {
    Row(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        repeat(4) {
            Box(
                Modifier.weight(1f).height(64.dp).clip(RoundedCornerShape(12.dp)).background(Color(0xFFF0F0F0))
            )
        }
    }
}

@Composable
private fun SkeletonStudyRow() {
    Row(
        Modifier.fillMaxWidth().height(IntrinsicSize.Min).background(Color.White),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(Modifier.width(3.dp).fillMaxHeight().background(Color(0xFFEEEEEE)))
        Column(Modifier.weight(1f).padding(horizontal = 16.dp, vertical = 16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Box(Modifier.width(120.dp).height(14.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFEEEEEE)))
                Box(Modifier.width(60.dp).height(14.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFF4F4F4)))
            }
            Box(Modifier.width(180.dp).height(12.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFF0F0F0)))
            Box(Modifier.fillMaxWidth(0.9f).height(12.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFF4F4F4)))
        }
    }
}

// ── Error State ───────────────────────────────────────────────────────────────

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier            = modifier.padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Icon(Icons.Default.CloudOff, contentDescription = null, tint = Muted, modifier = Modifier.size(40.dp))
        Text("שגיאה בטעינה", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Ink, fontFamily = SblHebrew)
        Text(message, fontSize = 14.sp, color = Muted, textAlign = TextAlign.Center, fontFamily = SblHebrew)
        Button(
            onClick = onRetry,
            colors  = ButtonDefaults.buttonColors(containerColor = Primary),
            shape   = RoundedCornerShape(10.dp)
        ) {
            Text("נסה שוב", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

private fun LocalDate.toHebrewDayOfWeek(): String = when (dayOfWeek) {
    DayOfWeek.SUNDAY    -> "יום ראשון"
    DayOfWeek.MONDAY    -> "יום שני"
    DayOfWeek.TUESDAY   -> "יום שלישי"
    DayOfWeek.WEDNESDAY -> "יום רביעי"
    DayOfWeek.THURSDAY  -> "יום חמישי"
    DayOfWeek.FRIDAY    -> "יום שישי"
    DayOfWeek.SATURDAY  -> "שבת קודש"
    else                -> ""
}

private fun studyAccentColor(accent: String?): Color = when (accent) {
    "blue"    -> Color(0xFF0284C7)
    "emerald" -> Color(0xFF059669)
    "violet"  -> Color(0xFF7C3AED)
    "amber"   -> Color(0xFFD97706)
    else      -> Primary
}

private fun studyIcon(key: String): ImageVector = when (key) {
    "chumash"        -> Icons.AutoMirrored.Filled.MenuBook
    "tehillim"       -> Icons.Default.MusicNote
    "tanya"          -> Icons.Default.Star
    "rambam"         -> Icons.Default.School
    "rambamOne"      -> Icons.Default.School
    "seferHamitzvot" -> Icons.AutoMirrored.Filled.List
    "shnayimMikra"   -> Icons.AutoMirrored.Filled.VolumeUp
    else             -> Icons.AutoMirrored.Filled.MenuBook
}

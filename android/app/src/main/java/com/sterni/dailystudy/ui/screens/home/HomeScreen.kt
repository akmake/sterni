package com.sterni.dailystudy.ui.screens.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.slideInVertically
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

private val HomeBg = Color(0xFFFDFBF7)
private val CardBg = Color.White

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
    val uiState  by viewModel.uiState.collectAsStateWithLifecycle()
    val context  = LocalContext.current
    var todayStatus by remember { mutableStateOf(StudyTracker.getTodayStatus(context)) }
    var dateOffset  by remember { mutableStateOf(0) }
    val displayDate = remember(dateOffset) { LocalDate.now().plusDays(dateOffset.toLong()) }

    // Reload study data whenever the selected date changes
    LaunchedEffect(dateOffset) {
        viewModel.loadDailyStudy(displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
    }

    Scaffold(
        containerColor = HomeBg,
        contentWindowInsets = WindowInsets(0.dp),
        bottomBar = {
            NavigationBar(
                containerColor = CardBg,
                tonalElevation = 0.dp,
                modifier       = Modifier
                    .clip(RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp))
                    .navigationBarsPadding()
            ) {
                NavigationBarItem(
                    selected = true,
                    onClick  = {},
                    icon     = { Icon(Icons.Default.Home, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label    = { Text("בית", fontSize = 11.sp) },
                    colors   = navColors()
                )
                NavigationBarItem(
                    selected = false,
                    onClick  = onZmanimClick,
                    icon     = { Icon(Icons.Default.AccessTime, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label    = { Text("זמנים", fontSize = 11.sp) },
                    colors   = navColors()
                )
                NavigationBarItem(
                    selected = false,
                    onClick  = onNewsClick,
                    icon     = { Icon(androidx.compose.material.icons.Icons.Default.Feed, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label    = { Text("חדשות", fontSize = 11.sp) },
                    colors   = navColors()
                )
                NavigationBarItem(
                    selected = false,
                    onClick  = onCalendarClick,
                    icon     = { Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(22.dp)) },
                    label    = { Text("לוח", fontSize = 11.sp) },
                    colors   = navColors()
                )
            }
        }
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            when {
                uiState.isLoading -> CircularProgressIndicator(
                    modifier    = Modifier.align(Alignment.Center),
                    color       = Primary,
                    strokeWidth = 2.dp
                )
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
                        // ── Header ──────────────────────────────────────────────
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

                        // ── Quick access ─────────────────────────────────────
                        item {
                            QuickAccessRow(
                                onMamaarimClick   = onMamaarimClick,
                                onTefilaClick     = onTefilaClick,
                                onPdfLibraryClick = onPdfLibraryClick,
                                onToolsClick      = onToolsClick,
                                modifier          = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
                            )
                        }

                        // ── Section header ──────────────────────────────────
                        item {
                            Text(
                                text       = "לימוד היום",
                                modifier   = Modifier.padding(horizontal = 20.dp, vertical = 4.dp),
                                fontSize   = 13.sp,
                                fontWeight = FontWeight.SemiBold,
                                color      = Muted,
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

// ── Nav color helper ──────────────────────────────────────────────────────────

@Composable
private fun navColors() = NavigationBarItemDefaults.colors(
    selectedIconColor   = Primary,
    selectedTextColor   = Primary,
    indicatorColor      = Primary.copy(alpha = 0.1f),
    unselectedIconColor = Muted,
    unselectedTextColor = Muted
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
    Surface(color = CardBg, shadowElevation = 0.dp) {
        Column {
            Spacer(Modifier.statusBarsPadding())

            // Action icons at the top
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.End,
                verticalAlignment     = Alignment.CenterVertically
            ) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    IconButton(onClick = onRefreshClick, modifier = Modifier.size(40.dp)) {
                        Icon(
                            imageVector        = Icons.Rounded.Refresh,
                            contentDescription = "רענן",
                            tint               = Primary,
                            modifier           = Modifier.size(22.dp)
                        )
                    }
                    IconButton(onClick = onSettingsClick, modifier = Modifier.size(40.dp)) {
                        Icon(
                            imageVector        = Icons.Rounded.Settings,
                            contentDescription = "הגדרות",
                            tint               = Primary,
                            modifier           = Modifier.size(22.dp)
                        )
                    }
                }
            }

            // Date navigation (independent area)
            Row(
                modifier              = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .padding(bottom = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment     = Alignment.CenterVertically
            ) {
                // In RTL Row: first = RIGHT side = go to yesterday
                IconButton(
                    onClick = onPrevDay,
                    modifier = Modifier.size(48.dp).background(Color.Transparent, RoundedCornerShape(8.dp))
                ) {
                    Icon(
                        Icons.Default.KeyboardArrowRight,
                        contentDescription = "יום קודם",
                        tint               = Primary,
                        modifier           = Modifier.size(32.dp)
                    )
                }

                Text(
                    text       = "${displayDate.toHebrewDayOfWeek()} ${com.sterni.dailystudy.util.HebrewDate.format(displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE))}",
                    fontSize   = 22.sp,
                    fontFamily = BaHaYetzira,
                    color      = Primary,
                    textAlign  = TextAlign.Center,
                    modifier   = Modifier.weight(1f)
                )

                // In RTL Row: last = LEFT side = go to tomorrow
                IconButton(
                    onClick = onNextDay,
                    modifier = Modifier.size(48.dp).background(Color.Transparent, RoundedCornerShape(8.dp))
                ) {
                    Icon(
                        Icons.Default.KeyboardArrowLeft,
                        contentDescription = "יום הבא",
                        tint               = Primary,
                        modifier           = Modifier.size(32.dp)
                    )
                }
            }

            HorizontalDivider(
                modifier  = Modifier.padding(top = 4.dp),
                color     = Color(0xFFE4E4E7),
                thickness = 0.5.dp
            )
        }
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
    // Order (RTL — first item appears on the RIGHT):
    // מאמרים | תפילה | ספריה | כלים
    Row(
        modifier              = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        QuickChip(label = "מאמרים", icon = Icons.AutoMirrored.Filled.List,    onClick = onMamaarimClick,   modifier = Modifier.weight(1f))
        QuickChip(label = "תפילה",  icon = Icons.AutoMirrored.Filled.MenuBook, onClick = onTefilaClick,     modifier = Modifier.weight(1f))
        QuickChip(label = "ספריה",  icon = Icons.Default.PictureAsPdf,         onClick = onPdfLibraryClick, modifier = Modifier.weight(1f))
        QuickChip(label = "כלים",   icon = Icons.Default.Tune,                 onClick = onToolsClick,      modifier = Modifier.weight(1f))
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
            Text(text = label, fontSize = 12.sp, color = Primary, fontFamily = SblHebrew)
        }
    }
}

// ── Study Card ────────────────────────────────────────────────────────────────

@Composable
private fun StudyCard(
    studyKey: String,
    study:    Study,
    modifier: Modifier = Modifier,
    onClick:  () -> Unit
) {
    val available   = study.available == true
    val accentColor = studyAccentColor(study.accent)
    val icon        = studyIcon(studyKey)

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
            modifier          = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier         = Modifier
                    .size(46.dp)
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (available) accentColor.copy(alpha = 0.10f) else Color(0xFFF4F4F5)),
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

            Column(modifier = Modifier.weight(1f)) {
                Row(
                    verticalAlignment     = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.SpaceBetween,
                    modifier              = Modifier.fillMaxWidth()
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
                    Text(text = study.subtitle, fontSize = 13.sp, color = Muted, fontFamily = SblHebrew)
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
                    Text(text = "לא נמצאו נתונים להיום", fontSize = 12.sp, color = Muted.copy(alpha = 0.55f), fontFamily = SblHebrew)
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
        Icon(Icons.Default.CloudOff, contentDescription = null, tint = Muted, modifier = Modifier.size(48.dp))
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

package com.sterni.dailystudy.ui.screens.home

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
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
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.sterni.dailystudy.R
import com.sterni.dailystudy.data.model.Study
import com.sterni.dailystudy.ui.theme.*
import com.sterni.dailystudy.util.HebrewDate
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter

// ── Extra color ───────────────────────────────────────────────────────────────
private val BgOffWhite = Color(0xFFF8F6F2)

// ── Accent color per study ────────────────────────────────────────────────────
private fun studyColor(accent: String?): Color = when (accent) {
    "blue"    -> Color(0xFF0369A1)
    "emerald" -> Color(0xFF047857)
    "violet"  -> Color(0xFF6D28D9)
    "amber"   -> Color(0xFFB45309)
    "rose"    -> Color(0xFFBE123C)
    else      -> Primary
}

// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen
// ─────────────────────────────────────────────────────────────────────────────
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onStudyClick:      (studyKey: String, date: String, title: String, label: String) -> Unit,
    onZmanimClick:     () -> Unit = {},
    onMamaarimClick:   () -> Unit = {},
    onLocationClick:   () -> Unit = {},
    onTrackerClick:    () -> Unit = {},
    onCalendarClick:   () -> Unit = {},
    onSettingsClick:   () -> Unit = {},
    onToolsClick:      () -> Unit = {},
    onNewsClick:       () -> Unit = {},
    onTefilaClick:     () -> Unit = {},
    onPdfLibraryClick: () -> Unit = {},
    viewModel:         HomeViewModel = hiltViewModel()
) {
    val uiState    by viewModel.uiState.collectAsStateWithLifecycle()
    var dateOffset by remember { mutableStateOf(0) }
    val displayDate = remember(dateOffset) { LocalDate.now().plusDays(dateOffset.toLong()) }
    var openKey    by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(dateOffset) {
        viewModel.loadDailyStudy(displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE))
        openKey = null // סגור preview בעת מעבר יום
    }

    val orderedKeys    = listOf("chumash", "rambam", "rambamOne", "tanya", "shnayimMikra", "tehillim")
    val orderedStudies = orderedKeys.mapNotNull { k -> uiState.studies[k]?.let { k to it } }

    Scaffold(
        containerColor      = BgOffWhite,
        contentWindowInsets = WindowInsets(0.dp),
        // ── Bottom nav ────────────────────────────────────────
        bottomBar = {
            Column(
                modifier = Modifier
                    .background(Color(0xF0F8F6F2))
                    .navigationBarsPadding()
            ) {
                HorizontalDivider(color = LineColor, thickness = 0.5.dp)
                Row(
                    modifier              = Modifier
                        .fillMaxWidth()
                        .padding(vertical = 8.dp),
                    horizontalArrangement = Arrangement.SpaceAround
                ) {
                    data class NavItem(val label: String, val icon: ImageVector, val active: Boolean, val action: () -> Unit)
                    listOf(
                        NavItem("בית",    Icons.Default.Home,          true,  {}),
                        NavItem("זמנים",  Icons.Default.AccessTime,    false, onZmanimClick),
                        NavItem("חדשות",  Icons.Default.Feed,           false, onNewsClick),
                        NavItem("לוח",    Icons.Default.CalendarMonth,  false, onCalendarClick),
                    ).forEach { item ->
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(10.dp))
                                .background(if (item.active) Primary.copy(alpha = .09f) else Color.Transparent)
                                .clickable(
                                    interactionSource = remember { MutableInteractionSource() },
                                    indication        = null,
                                    onClick           = item.action
                                )
                                .padding(vertical = 6.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(3.dp)
                        ) {
                            Icon(
                                item.icon, null,
                                tint     = if (item.active) Primary else Muted,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                item.label,
                                fontSize   = 10.sp,
                                fontWeight = FontWeight.SemiBold,
                                color      = if (item.active) Primary else Muted,
                                fontFamily = SblHebrew
                            )
                        }
                    }
                }
            }
        }
    ) { padding ->
        when {
            uiState.isLoading -> LoadingSkeleton(padding)
            uiState.error != null -> ErrorState(
                message  = uiState.error!!,
                onRetry  = { viewModel.loadDailyStudy(displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE)) },
                modifier = Modifier.padding(padding)
            )
            else -> LazyColumn(
                modifier       = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(bottom = 16.dp)
            ) {

                // ── Logo + settings ────────────────────────────
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .statusBarsPadding()
                            .padding(horizontal = 22.dp, vertical = 2.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment     = Alignment.CenterVertically
                    ) {
                        androidx.compose.foundation.Image(
                            painter            = painterResource(R.drawable.app_logo),
                            contentDescription = null,
                            modifier           = Modifier
                                .size(28.dp)
                                .graphicsLayer { alpha = .6f }
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                            IconButton(onClick = {
                                viewModel.loadDailyStudy(
                                    displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE)
                                )
                            }) {
                                Icon(Icons.Rounded.Refresh, null,
                                    tint = Muted.copy(.5f), modifier = Modifier.size(17.dp))
                            }
                            IconButton(onClick = onSettingsClick) {
                                Icon(Icons.Rounded.Settings, null,
                                    tint = Muted.copy(.5f), modifier = Modifier.size(17.dp))
                            }
                        }
                    }
                }

                // ── Date block + day navigation ────────────────
                item {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = 22.dp)
                    ) {
                        // חצי ניווט + תאריך
                        Row(
                            modifier              = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 4.dp),
                            verticalAlignment     = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            // חץ ימינה = יום קודם (RTL)
                            IconButton(
                                onClick  = { dateOffset-- },
                                modifier = Modifier.size(44.dp)
                            ) {
                                Icon(
                                    Icons.Default.KeyboardArrowRight,
                                    contentDescription = "יום קודם",
                                    tint               = Muted.copy(alpha = .4f),
                                    modifier           = Modifier.size(26.dp)
                                )
                            }

                            // תאריך מרכזי
                            Column(
                                modifier            = Modifier.weight(1f),
                                horizontalAlignment = Alignment.CenterHorizontally
                            ) {
                                Text(
                                    text          = buildString {
                                        append(displayDate.toHebrewDayOfWeek())
                                        if (dateOffset == 0) append(" · היום")
                                        append(" · ")
                                        append(displayDate.format(DateTimeFormatter.ofPattern("d.M.yyyy")))
                                        if (uiState.hebrewDate.isNotEmpty()) {
                                            append(" · ")
                                            append(uiState.hebrewDate)
                                        }
                                    },
                                    fontSize      = 11.sp,
                                    fontWeight    = FontWeight.SemiBold,
                                    color         = Muted,
                                    fontFamily    = SblHebrew,
                                    letterSpacing = 1.2.sp,
                                    textAlign     = TextAlign.Center
                                )
                                Spacer(Modifier.height(6.dp))
                                Text(
                                    text          = HebrewDate.format(
                                        displayDate.format(DateTimeFormatter.ISO_LOCAL_DATE)
                                    ),
                                    fontSize      = 46.sp,
                                    lineHeight    = 44.sp,
                                    fontFamily    = BaHaYetzira,
                                    color         = Ink,
                                    letterSpacing = (-1).sp,
                                    textAlign     = TextAlign.Center
                                )
                            }

                            // חץ שמאלה = יום הבא
                            IconButton(
                                onClick  = { dateOffset++ },
                                modifier = Modifier.size(44.dp)
                            ) {
                                Icon(
                                    Icons.Default.KeyboardArrowLeft,
                                    contentDescription = "יום הבא",
                                    tint               = Muted.copy(alpha = .4f),
                                    modifier           = Modifier.size(26.dp)
                                )
                            }
                        }

                        // teal rule מרכזי
                        Box(
                            modifier = Modifier
                                .width(48.dp)
                                .height(3.dp)
                                .clip(RoundedCornerShape(2.dp))
                                .background(Primary)
                                .align(Alignment.CenterHorizontally)
                        )
                        Spacer(Modifier.height(20.dp))
                    }
                }

                // ── Quick access ───────────────────────────────
                item {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .padding(bottom = 28.dp)
                    ) {
                        data class QuickItem(val label: String, val icon: ImageVector, val action: () -> Unit)
                        listOf(
                            QuickItem("מאמרים", Icons.AutoMirrored.Filled.List,     onMamaarimClick),
                            QuickItem("תפילה",  Icons.AutoMirrored.Filled.MenuBook,  onTefilaClick),
                            QuickItem("ספריה",  Icons.Default.PictureAsPdf,           onPdfLibraryClick),
                            QuickItem("כלים",   Icons.Default.Tune,                   onToolsClick),
                        ).forEachIndexed { i, item ->
                            Column(
                                modifier = Modifier
                                    .weight(1f)
                                    .then(if (i < 3) Modifier.drawEndDivider(LineColor) else Modifier)
                                    .clickable(
                                        interactionSource = remember { MutableInteractionSource() },
                                        indication        = null,
                                        onClick           = item.action
                                    )
                                    .padding(vertical = 10.dp),
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(7.dp)
                            ) {
                                Icon(item.icon, null, tint = Primary, modifier = Modifier.size(18.dp))
                                Text(
                                    item.label,
                                    fontSize      = 10.sp,
                                    fontWeight    = FontWeight.SemiBold,
                                    color         = Ink.copy(alpha = .75f),
                                    fontFamily    = SblHebrew,
                                    letterSpacing = .3.sp
                                )
                            }
                        }
                    }
                }

                // ── Section label ──────────────────────────────
                item {
                    Row(
                        modifier              = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 24.dp)
                            .padding(bottom = 12.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment     = Alignment.Bottom
                    ) {
                        Text(
                            "לימוד היום",
                            fontSize      = 11.sp,
                            fontWeight    = FontWeight.Bold,
                            color         = Muted,
                            letterSpacing = 1.1.sp,
                            fontFamily    = SblHebrew
                        )
                        Text(
                            "2 / ${orderedStudies.size} הושלמו",
                            fontSize   = 11.sp,
                            fontWeight = FontWeight.SemiBold,
                            color      = Primary,
                            fontFamily = SblHebrew
                        )
                    }
                }

                // ── Study rows ─────────────────────────────────
                itemsIndexed(orderedStudies, key = { _, p -> p.first }) { _, (key, study) ->
                    StudyRow(
                        studyKey = key,
                        study    = study,
                        isOpen   = openKey == key,
                        onToggle = {
                            if (study.available == true) {
                                if (openKey == key) {
                                    onStudyClick(key, uiState.date, study.title ?: "", study.label ?: "")
                                } else {
                                    openKey = key
                                }
                            }
                        }
                    )
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// StudyRow
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun StudyRow(
    studyKey: String,
    study:    Study,
    isOpen:   Boolean,
    onToggle: () -> Unit
) {
    val accent      = studyColor(study.accent)
    val stripeH    by animateDpAsState(if (isOpen) 36.dp else 20.dp, tween(200), label = "stripe")
    val stripeAlpha by animateFloatAsState(if (isOpen) 1f else .5f, tween(200), label = "alpha")

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (isOpen) accent.copy(alpha = .04f) else Color.Transparent)
            .clickable(onClick = onToggle)
    ) {
        Row(
            modifier          = Modifier
                .fillMaxWidth()
                .padding(top = 14.dp, bottom = 14.dp, end = 24.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // left stripe
            Box(modifier = Modifier.width(20.dp), contentAlignment = Alignment.Center) {
                Box(
                    modifier = Modifier
                        .width(3.dp)
                        .height(stripeH)
                        .clip(RoundedCornerShape(2.dp))
                        .background(accent.copy(alpha = stripeAlpha))
                )
            }

            Spacer(Modifier.width(14.dp))

            // icon
            Icon(
                studyIcon(studyKey), null,
                tint     = if (isOpen) accent else Muted,
                modifier = Modifier.size(19.dp)
            )

            Spacer(Modifier.width(14.dp))

            // title + label + subtitle
            Column(modifier = Modifier.weight(1f)) {
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment     = Alignment.CenterVertically
                ) {
                    Text(
                        text       = study.title ?: "",
                        fontSize   = 15.sp,
                        fontWeight = FontWeight.Bold,
                        color      = if (isOpen) accent else Ink,
                        fontFamily = BaHaYetzira,
                        modifier   = Modifier.weight(1f, fill = false)
                    )
                    if (!study.label.isNullOrEmpty()) {
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text       = study.label,
                            fontSize   = 10.sp,
                            fontWeight = FontWeight.Bold,
                            color      = accent.copy(alpha = if (isOpen) 1f else .6f),
                            fontFamily = SblHebrew
                        )
                    }
                }
                if (!study.subtitle.isNullOrEmpty()) {
                    Spacer(Modifier.height(1.dp))
                    Text(study.subtitle, fontSize = 11.sp, color = Muted, fontFamily = SblHebrew)
                }
            }

            Spacer(Modifier.width(8.dp))

            // chevron
            Icon(
                Icons.Default.ChevronLeft, null,
                tint     = if (isOpen) accent else LineColor,
                modifier = Modifier.size(14.dp)
            )
        }

        // preview text — expanded
        AnimatedVisibility(
            visible = isOpen,
            enter   = fadeIn(tween(180)) + expandVertically(tween(180)),
            exit    = fadeOut(tween(150)) + shrinkVertically(tween(150))
        ) {
            if (!study.preview.isNullOrEmpty()) {
                Text(
                    text       = study.preview,
                    fontSize   = 12.sp,
                    lineHeight = 22.sp,
                    color      = Ink.copy(alpha = .72f),
                    fontFamily = SblHebrew,
                    modifier   = Modifier
                        .fillMaxWidth()
                        .padding(start = 20.dp, end = 24.dp, bottom = 14.dp)
                        .drawTopDivider(LineColor)
                        .padding(top = 10.dp),
                    style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                )
            }
        }

        HorizontalDivider(
            modifier  = Modifier.padding(start = 20.dp),
            color     = LineColor,
            thickness = 0.5.dp
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading skeleton
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun LoadingSkeleton(padding: PaddingValues) {
    LazyColumn(
        modifier       = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(bottom = 24.dp)
    ) {
        item { Spacer(Modifier.statusBarsPadding().height(8.dp)) }
        item {
            Column(
                Modifier.padding(horizontal = 24.dp, vertical = 22.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Box(Modifier.width(160.dp).height(11.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFE8E8E6)))
                Box(Modifier.width(240.dp).height(42.dp).clip(RoundedCornerShape(6.dp)).background(Color(0xFFE2E0DC)))
                Box(Modifier.width(48.dp).height(3.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFFDDDCD8)))
            }
        }
        items(6) {
            Row(
                Modifier.fillMaxWidth().padding(end = 24.dp, top = 14.dp, bottom = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(Modifier.width(20.dp), contentAlignment = Alignment.Center) {
                    Box(Modifier.width(3.dp).height(20.dp).clip(RoundedCornerShape(2.dp)).background(Color(0xFFE0E0DE)))
                }
                Spacer(Modifier.width(14.dp))
                Box(Modifier.size(19.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFEEEEEC)))
                Spacer(Modifier.width(14.dp))
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.width(110.dp).height(13.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFE8E8E6)))
                    Box(Modifier.width(80.dp).height(10.dp).clip(RoundedCornerShape(4.dp)).background(Color(0xFFF0F0EE)))
                }
            }
            HorizontalDivider(modifier = Modifier.padding(start = 20.dp), color = LineColor, thickness = 0.5.dp)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Error state
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(
        modifier            = modifier.fillMaxSize().padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Icon(Icons.Default.CloudOff, null, tint = Muted, modifier = Modifier.size(40.dp))
        Spacer(Modifier.height(16.dp))
        Text("שגיאה בטעינה", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = Ink, fontFamily = SblHebrew)
        Spacer(Modifier.height(8.dp))
        Text(message, fontSize = 13.sp, color = Muted, textAlign = TextAlign.Center, fontFamily = SblHebrew)
        Spacer(Modifier.height(20.dp))
        Button(
            onClick = onRetry,
            colors  = ButtonDefaults.buttonColors(containerColor = Primary),
            shape   = RoundedCornerShape(10.dp)
        ) {
            Text("נסה שוב", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
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

private fun studyIcon(key: String): ImageVector = when (key) {
    "chumash"        -> Icons.AutoMirrored.Filled.MenuBook
    "tehillim"       -> Icons.Default.MusicNote
    "tanya"          -> Icons.Default.Star
    "rambam",
    "rambamOne"      -> Icons.Default.School
    "seferHamitzvot" -> Icons.AutoMirrored.Filled.List
    "shnayimMikra"   -> Icons.AutoMirrored.Filled.VolumeUp
    else             -> Icons.AutoMirrored.Filled.MenuBook
}

private fun Modifier.drawEndDivider(color: Color): Modifier = this.drawWithContent {
    drawContent()
    drawLine(
        color       = color,
        start       = Offset(size.width, 0f),
        end         = Offset(size.width, size.height),
        strokeWidth = 0.5.dp.toPx()
    )
}

private fun Modifier.drawTopDivider(color: Color): Modifier = this.drawWithContent {
    drawLine(
        color       = color,
        start       = Offset(0f, 0f),
        end         = Offset(size.width, 0f),
        strokeWidth = 0.5.dp.toPx()
    )
    drawContent()
}

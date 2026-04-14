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
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.AccessTime
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.rounded.Refresh
import androidx.compose.material.icons.rounded.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
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
import com.sterni.dailystudy.ui.theme.SblHebrew

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
        bottomBar = {
            NavigationBar(
                containerColor = MaterialTheme.colorScheme.surface,
                tonalElevation = 8.dp
            ) {
                NavigationBarItem(
                    selected = true,
                    onClick = {},
                    icon = { Icon(Icons.Default.Home, contentDescription = null) },
                    label = { Text("בית", fontWeight = FontWeight.Bold) },
                    colors = NavigationBarItemDefaults.colors(
                        selectedIconColor = MaterialTheme.colorScheme.primary,
                        selectedTextColor = MaterialTheme.colorScheme.primary,
                        indicatorColor = MaterialTheme.colorScheme.primaryContainer
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onZmanimClick,
                    icon = { Icon(Icons.Default.AccessTime, contentDescription = null) },
                    label = { Text("זמנים") },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onToolsClick,
                    icon = { Icon(Icons.Default.Build, contentDescription = null) },
                    label = { Text("כלים") },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onCalendarClick,
                    icon = { Icon(Icons.Default.CalendarMonth, contentDescription = null) },
                    label = { Text("לוח") },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
            }
        },
        containerColor = MaterialTheme.colorScheme.background
    ) { paddingValues ->
        Box(modifier = Modifier.fillMaxSize().padding(paddingValues)) {
            when {
                uiState.isLoading -> CircularProgressIndicator(
                    modifier = Modifier.align(Alignment.Center),
                    color = MaterialTheme.colorScheme.primary
                )
                uiState.error != null -> ErrorState(
                    message = uiState.error!!,
                    onRetry = { viewModel.loadDailyStudy() },
                    modifier = Modifier.align(Alignment.Center)
                )
                else -> {
                    val orderedKeys = listOf("chumash", "rambam", "rambamOne", "tanya", "seferHamitzvot", "shnayimMikra", "tehillim")
                    val orderedStudies = orderedKeys.mapNotNull { key -> uiState.studies[key]?.let { key to it } }
                    LazyColumn(contentPadding = PaddingValues(bottom = 32.dp), modifier = Modifier.fillMaxSize()) {
                        item {
                            HomeHeroSection(
                                hebrewDate = uiState.hebrewDate,
                                onSettingsClick = onSettingsClick,
                                onRefreshClick = {
                                    viewModel.loadDailyStudy()
                                    todayStatus = StudyTracker.getTodayStatus(context)
                                }
                            )
                        }
                        if (todayStatus.isNotEmpty()) {
                            item {
                                DailyProgressCard(todayStatus = todayStatus)
                                Spacer(modifier = Modifier.height(8.dp))
                            }
                        }
                        item {
                            QuickAccessRow(onTefilaClick = onTefilaClick, onOmerClick = onOmerClick, onToolsClick = onToolsClick)
                            Spacer(modifier = Modifier.height(8.dp))
                        }
                        itemsIndexed(orderedStudies, key = { _, pair -> pair.first }) { index, (key, study) ->
                            AnimatedVisibility(
                                visible = true,
                                enter = slideInVertically(initialOffsetY = { 50 + (index * 20) }, animationSpec = tween(400)) + fadeIn(animationSpec = tween(400))
                            ) {
                                StudyCard(
                                    study = study,
                                    modifier = Modifier.padding(horizontal = 16.dp).padding(vertical = 8.dp),
                                    onClick = {
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

@Composable
fun HomeHeroSection(
    hebrewDate: String,
    onSettingsClick: () -> Unit,
    onRefreshClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp))
            .background(Brush.verticalGradient(colors = listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.primary.copy(alpha = 0.85f))))
            .padding(bottom = 24.dp)
    ) {
        Column {
            Spacer(Modifier.statusBarsPadding())
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "לימוד יומי",
                        fontSize = 34.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = MaterialTheme.colorScheme.onPrimary,
                        fontFamily = BaHaYetzira
                    )
                    Spacer(Modifier.height(4.dp))
                    if (hebrewDate.isNotEmpty()) {
                        Surface(
                            shape = RoundedCornerShape(12.dp),
                            color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.2f)
                        ) {
                            Text(
                                text = hebrewDate,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                                fontSize = 16.sp,
                                color = MaterialTheme.colorScheme.onPrimary,
                                fontFamily = SblHebrew,
                                fontWeight = FontWeight.SemiBold
                            )
                        }
                    }
                }
                Row {
                    IconButton(
                        onClick = onRefreshClick,
                        modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.15f))
                    ) {
                        Icon(Icons.Rounded.Refresh, contentDescription = "רענן", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                    Spacer(modifier = Modifier.width(8.dp))
                    IconButton(
                        onClick = onSettingsClick,
                        modifier = Modifier.clip(CircleShape).background(Color.White.copy(alpha = 0.15f))
                    ) {
                        Icon(Icons.Rounded.Settings, contentDescription = "הגדרות", tint = MaterialTheme.colorScheme.onPrimary)
                    }
                }
            }
        }
    }
}

@Composable
private fun DailyProgressCard(todayStatus: List<Pair<String, Boolean>>) {
    val done = todayStatus.count { it.second }
    val total = todayStatus.size
    val progress = if (total > 0) done.toFloat() / total else 0f
    val allDone = done == total && total > 0

    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp).offset(y = (-16).dp),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = if (allDone) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 6.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth().padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(72.dp), contentAlignment = Alignment.Center) {
                val ringColor = if (allDone) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.primary
                val trackColor = MaterialTheme.colorScheme.surfaceVariant
                Canvas(modifier = Modifier.fillMaxSize()) {
                    val stroke = 8.dp.toPx()
                    drawArc(color = trackColor, startAngle = -90f, sweepAngle = 360f, useCenter = false, style = Stroke(width = stroke))
                    if (progress > 0f) {
                        drawArc(color = ringColor, startAngle = -90f, sweepAngle = 360f * progress, useCenter = false, style = Stroke(width = stroke, cap = StrokeCap.Round))
                    }
                }
                Text(text = "$done/$total", fontSize = 16.sp, fontWeight = FontWeight.ExtraBold, color = ringColor)
            }
            Spacer(Modifier.width(20.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = if (allDone) "כל הכבוד! סיימת הכל" else "ההתקדמות שלך להיום",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = if (allDone) MaterialTheme.colorScheme.onSecondaryContainer else MaterialTheme.colorScheme.onSurface
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = if (allDone) "עברת על כל $total הלימודים היום!" else "נשארו לך עוד ${total-done} לימודים",
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        }
    }
}

@Composable
private fun StudyCard(study: Study, modifier: Modifier = Modifier, onClick: () -> Unit) {
    val available = study.available == true
    val accentColor = when (study.accent) {
        "blue" -> Color(0xFF0284C7)
        "emerald" -> Color(0xFF059669)
        "violet" -> Color(0xFF7C3AED)
        "amber" -> Color(0xFFD97706)
        else -> MaterialTheme.colorScheme.primary
    }
    val cardAccent = if (available) accentColor else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.3f)

    Card(
        modifier = modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).clickable(enabled = available, onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = if (available) 3.dp else 1.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min)) {
            Box(modifier = Modifier.width(6.dp).fillMaxHeight().background(cardAccent))
            Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 16.dp)) {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = study.title ?: "",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (available) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f),
                            fontFamily = SblHebrew
                        )
                        if (!study.subtitle.isNullOrEmpty()) {
                            Spacer(Modifier.height(2.dp))
                            Text(text = study.subtitle, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, fontFamily = SblHebrew)
                        }
                    }
                    if (available && !study.label.isNullOrEmpty()) {
                        Spacer(Modifier.width(12.dp))
                        Surface(shape = RoundedCornerShape(8.dp), color = cardAccent.copy(alpha = 0.1f)) {
                            Text(
                                text = study.label,
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = cardAccent,
                                textAlign = TextAlign.End,
                                fontFamily = SblHebrew,
                                style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                            )
                        }
                    }
                }
                if (available && !study.preview.isNullOrEmpty()) {
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = study.preview,
                        fontSize = 14.sp,
                        lineHeight = 22.sp,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.75f),
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        fontFamily = SblHebrew,
                        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )
                }
                if (!available) {
                    Spacer(Modifier.height(6.dp))
                    Text(text = "לא נמצאו נתונים להיום", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.6f))
                }
            }
        }
    }
}

@Composable
private fun QuickAccessRow(onTefilaClick: () -> Unit, onOmerClick: () -> Unit, onToolsClick: () -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        QuickAccessButton(
            label = "תפילה",
            icon = Icons.AutoMirrored.Filled.MenuBook,
            color = Color(0xFF0284C7),
            onClick = onTefilaClick,
            modifier = Modifier.weight(1f)
        )
        QuickAccessButton(
            label = "עומר",
            icon = Icons.Default.DateRange,
            color = Color(0xFF7C3AED),
            onClick = onOmerClick,
            modifier = Modifier.weight(1f)
        )
        QuickAccessButton(
            label = "כלים",
            icon = Icons.Default.Build,
            color = Color(0xFF059669),
            onClick = onToolsClick,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun QuickAccessButton(label: String, icon: ImageVector, color: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.clickable(onClick = onClick),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = color.copy(alpha = 0.08f)),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(vertical = 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(26.dp))
            Spacer(Modifier.height(6.dp))
            Text(text = label, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = color, fontFamily = SblHebrew)
        }
    }
}

@Composable
private fun ErrorState(message: String, onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Column(modifier = modifier.padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text("שגיאה בטעינה", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.onBackground)
        Text(message, fontSize = 15.sp, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center)
        Button(onClick = onRetry, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary), shape = RoundedCornerShape(12.dp)) {
            Text("נסה שוב", fontWeight = FontWeight.Bold)
        }
    }
}

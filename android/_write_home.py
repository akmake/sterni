import os

path = r'c:\Users\yosef dahan\Documents\GitHub\sterni\android\app\src\main\java\com\sterni\dailystudy\ui\screens\home\HomeScreen.kt'

# Delete if exists
if os.path.exists(path):
    os.remove(path)

content = r"""package com.sterni.dailystudy.ui.screens.home

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
                    label = { Text(""" + '"' + "\u05d1\u05d9\u05ea" + '"' + r""", fontWeight = FontWeight.Bold) },
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
                    label = { Text(""" + '"' + "\u05d6\u05de\u05e0\u05d9\u05dd" + '"' + r""") },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onToolsClick,
                    icon = { Icon(Icons.Default.Build, contentDescription = null) },
                    label = { Text(""" + '"' + "\u05db\u05dc\u05d9\u05dd" + '"' + r""") },
                    colors = NavigationBarItemDefaults.colors(
                        unselectedIconColor = MaterialTheme.colorScheme.onSurfaceVariant,
                        unselectedTextColor = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                )
                NavigationBarItem(
                    selected = false,
                    onClick = onCalendarClick,
                    icon = { Icon(Icons.Default.CalendarMonth, contentDescription = null) },
                    label = { Text(""" + '"' + "\u05dc\u05d5\u05d7" + '"' + r""") },
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
                    val orderedKeys = listOf(""" + '"' + "chumash" + '"' + ", " + '"' + "rambam" + '"' + ", " + '"' + "rambamOne" + '"' + ", " + '"' + "tanya" + '"' + ", " + '"' + "seferHamitzvot" + '"' + ", " + '"' + "shnayimMikra" + '"' + ", " + '"' + "tehillim" + '"' + r""")
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
                                            onStudyClick(key, uiState.date, study.title ?: """ + '""' + r""", study.label ?: """ + '""' + r""")
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
"""

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Written {len(content)} chars, {content.count(chr(10))} lines")

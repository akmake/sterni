package com.sterni.dailystudy.ui.screens.omer

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Notifications
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
import com.sterni.dailystudy.omer.OmerHelper
import com.sterni.dailystudy.omer.OmerNusach
import com.sterni.dailystudy.omer.OmerScheduler
import com.sterni.dailystudy.omer.OmerTracker
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.SblHebrew

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OmerScreen(
    onBack: () -> Unit,
    onDayClick: (Int) -> Unit
) {
    val context = LocalContext.current
    val activeDay = remember { OmerHelper.activeOmerDay(context) }
    val counted = remember { mutableStateOf(OmerTracker.getAllCounted(context)) }

    // Schedule notifications when screen opens
    LaunchedEffect(Unit) {
        OmerScheduler.scheduleIfNeeded(context)
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "ספירת העומר",
                        fontFamily = BaHaYetzira,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזור")
                    }
                },
                actions = {
                    IconButton(onClick = {
                        OmerScheduler.scheduleIfNeeded(context)
                    }) {
                        Icon(Icons.Default.Notifications, contentDescription = "הפעל תזכורות")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary,
                    actionIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            // Status card
            OmerStatusCard(
                activeDay = activeDay,
                totalCounted = counted.value.size,
                onCountClick = {
                    if (activeDay in 1..49 && !OmerTracker.isCounted(context, activeDay)) {
                        OmerTracker.markCounted(context, activeDay)
                        counted.value = OmerTracker.getAllCounted(context)
                    }
                    if (activeDay in 1..49) {
                        onDayClick(activeDay)
                    }
                }
            )

            Spacer(modifier = Modifier.height(16.dp))

            // 7x7 grid
            Text(
                "לוח ספירה",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = SblHebrew,
                modifier = Modifier.padding(bottom = 8.dp)
            )

            // Week headers
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceEvenly
            ) {
                val sefirot = listOf("חסד", "גבורה", "תפארת", "נצח", "הוד", "יסוד", "מלכות")
                sefirot.forEach { s ->
                    Text(
                        text = s,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.width(44.dp),
                        textAlign = TextAlign.Center
                    )
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            LazyVerticalGrid(
                columns = GridCells.Fixed(7),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                modifier = Modifier.fillMaxWidth()
            ) {
                items((1..49).toList()) { day ->
                    val isCounted = day in counted.value
                    val isToday = day == activeDay
                    val nusach = OmerNusach.getDayNusach(day)

                    OmerDayCell(
                        day = day,
                        isCounted = isCounted,
                        isToday = isToday,
                        onClick = { onDayClick(day) }
                    )
                }
            }

            Spacer(modifier = Modifier.height(16.dp))

            // Legend
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.Center,
                verticalAlignment = Alignment.CenterVertically
            ) {
                LegendDot(color = MaterialTheme.colorScheme.primary, label = "נספר")
                Spacer(Modifier.width(16.dp))
                LegendDot(color = Color(0xFFF59E0B), label = "היום")
                Spacer(Modifier.width(16.dp))
                LegendDot(color = MaterialTheme.colorScheme.surfaceVariant, label = "טרם")
            }
        }
    }
}

@Composable
private fun OmerStatusCard(
    activeDay: Int,
    totalCounted: Int,
    onCountClick: () -> Unit
) {
    val context = LocalContext.current
    val isTwilight = activeDay == -2
    val isOutside = activeDay == -1
    val dayNusach = if (activeDay in 1..49) OmerNusach.getDayNusach(activeDay) else null

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.3f)
        ),
        elevation = CardDefaults.cardElevation(4.dp)
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            when {
                isOutside -> {
                    Text(
                        "לא בתקופת העומר",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SblHebrew
                    )
                }
                isTwilight -> {
                    Text(
                        "בין השמשות",
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SblHebrew,
                        color = Color(0xFFF59E0B)
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        "המתן לצאת הכוכבים לפני הספירה",
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                else -> {
                    Text(
                        "יום ${OmerHelper.hebrewNumeral(activeDay)}",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.ExtraBold,
                        fontFamily = BaHaYetzira,
                        color = MaterialTheme.colorScheme.primary
                    )

                    dayNusach?.let {
                        Spacer(Modifier.height(4.dp))
                        Text(
                            it.sefirah,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = MaterialTheme.colorScheme.onSurface,
                            fontFamily = SblHebrew
                        )
                        Text(
                            it.hebrewDate,
                            fontSize = 14.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontFamily = SblHebrew
                        )
                    }

                    Spacer(Modifier.height(8.dp))
                    Text(
                        "נספרו $totalCounted מתוך 49",
                        fontSize = 13.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )

                    Spacer(Modifier.height(12.dp))

                    val alreadyCounted = OmerTracker.isCounted(LocalContext.current, activeDay)
                    Button(
                        onClick = onCountClick,
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (alreadyCounted)
                                MaterialTheme.colorScheme.secondaryContainer
                            else MaterialTheme.colorScheme.primary
                        )
                    ) {
                        if (alreadyCounted) {
                            Icon(Icons.Default.Check, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text("נספר — צפה בנוסח", fontFamily = SblHebrew)
                        } else {
                            Text("ספור עכשיו", fontFamily = SblHebrew, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun OmerDayCell(
    day: Int,
    isCounted: Boolean,
    isToday: Boolean,
    onClick: () -> Unit
) {
    val bgColor = when {
        isCounted -> MaterialTheme.colorScheme.primary
        isToday   -> Color(0xFFF59E0B)
        else      -> MaterialTheme.colorScheme.surfaceVariant
    }
    val textColor = when {
        isCounted -> Color.White
        isToday   -> Color.White
        else      -> MaterialTheme.colorScheme.onSurfaceVariant
    }

    Box(
        modifier = Modifier
            .size(44.dp)
            .clip(CircleShape)
            .background(bgColor)
            .then(
                if (isToday && !isCounted)
                    Modifier.border(2.dp, MaterialTheme.colorScheme.primary, CircleShape)
                else Modifier
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        if (isCounted) {
            Icon(
                Icons.Default.Check,
                contentDescription = null,
                tint = Color.White,
                modifier = Modifier.size(16.dp)
            )
        }
        Text(
            text = OmerHelper.hebrewNumeral(day),
            fontSize = if (isCounted) 9.sp else 12.sp,
            fontWeight = FontWeight.Bold,
            color = textColor,
            textAlign = TextAlign.Center,
            modifier = if (isCounted) Modifier.offset(y = 8.dp) else Modifier
        )
    }
}

@Composable
private fun LegendDot(color: Color, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(12.dp)
                .clip(CircleShape)
                .background(color)
        )
        Spacer(Modifier.width(4.dp))
        Text(label, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

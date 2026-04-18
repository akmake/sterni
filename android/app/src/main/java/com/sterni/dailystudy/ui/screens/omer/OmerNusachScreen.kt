package com.sterni.dailystudy.ui.screens.omer

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.omer.OmerHelper
import com.sterni.dailystudy.omer.OmerNusach
import com.sterni.dailystudy.omer.OmerTracker
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.SblHebrew

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OmerNusachScreen(
    day: Int,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val dayNusach = OmerNusach.getDayNusach(day)
    var isCounted by remember { mutableStateOf(OmerTracker.isCounted(context, day)) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "יום ${OmerHelper.hebrewNumeral(day)}",
                        fontFamily = BaHaYetzira,
                        fontWeight = FontWeight.Bold
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזור")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary,
                    navigationIconContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp)
        ) {
            if (dayNusach == null) {
                Text("יום לא תקין", fontSize = 18.sp, color = MaterialTheme.colorScheme.error)
                return@Column
            }

            // Day info header
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(
                    containerColor = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.25f)
                )
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    Text(
                        dayNusach.sefirah,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SblHebrew,
                        color = MaterialTheme.colorScheme.primary,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        dayNusach.hebrewDate,
                        fontSize = 14.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        fontFamily = SblHebrew
                    )
                }
            }

            Spacer(Modifier.height(20.dp))

            // Count button
            if (!isCounted) {
                Button(
                    onClick = {
                        OmerTracker.markCounted(context, day)
                        isCounted = true
                    },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Text("ספרתי ✓", fontFamily = SblHebrew, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
                Spacer(Modifier.height(16.dp))
            } else {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                    color = MaterialTheme.colorScheme.secondaryContainer
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Icon(Icons.Default.Check, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        Spacer(Modifier.width(8.dp))
                        Text("נספר!", fontFamily = SblHebrew, fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    }
                }
                Spacer(Modifier.height(16.dp))
            }

            // Bracha
            NusachSection("ברכה") {
                NusachText(OmerNusach.BRACHA)
            }

            Spacer(Modifier.height(12.dp))

            // Counting text
            NusachSection("ספירה") {
                NusachText(dayNusach.countingText)
            }

            Spacer(Modifier.height(12.dp))

            // Harachaman
            NusachSection("הרחמן") {
                NusachText(OmerNusach.HARACHAMAN)
            }

            Spacer(Modifier.height(12.dp))

            // Psalm 67
            NusachSection("מזמור ס״ז") {
                NusachText(OmerNusach.PSALM_67)
            }

            Spacer(Modifier.height(12.dp))

            // Ana BeKoach
            NusachSection("אנא בכח") {
                val weekIdx = OmerNusach.anaBekoachWeek(day)
                OmerNusach.ANA_BEKOACH_LINES.forEachIndexed { idx, (text, abbr) ->
                    val isHighlighted = idx == weekIdx
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .then(
                                if (isHighlighted) Modifier
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.35f))
                                    .padding(8.dp)
                                else Modifier.padding(8.dp)
                            ),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = text,
                            fontSize = 16.sp,
                            lineHeight = 26.sp,
                            fontFamily = SblHebrew,
                            fontWeight = if (isHighlighted) FontWeight.Bold else FontWeight.Normal,
                            color = if (isHighlighted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.weight(1f),
                            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = abbr,
                            fontSize = 12.sp,
                            fontFamily = SblHebrew,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Baruch Shem
            NusachSection("") {
                NusachText(OmerNusach.BARUCH_SHEM)
            }

            Spacer(Modifier.height(12.dp))

            // Ribono Shel Olam
            NusachSection("רבונו של עולם") {
                NusachText(
                    OmerNusach.RIBONO_PREFIX +
                    dayNusach.sefirah +
                    OmerNusach.RIBONO_SUFFIX
                )
            }

            Spacer(Modifier.height(32.dp))
        }
    }
}

@Composable
private fun NusachSection(title: String, content: @Composable () -> Unit) {
    if (title.isNotEmpty()) {
        Text(
            text = title,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.primary,
            fontFamily = SblHebrew,
            modifier = Modifier.padding(bottom = 4.dp)
        )
    }
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Box(modifier = Modifier.padding(16.dp)) {
            content()
        }
    }
}

@Composable
private fun NusachText(text: String) {
    Text(
        text = text,
        fontSize = 18.sp,
        lineHeight = 30.sp,
        fontFamily = SblHebrew,
        color = MaterialTheme.colorScheme.onSurface,
        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

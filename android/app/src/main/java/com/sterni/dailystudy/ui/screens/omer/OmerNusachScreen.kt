package com.sterni.dailystudy.ui.screens.omer

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.omer.OmerHelper
import com.sterni.dailystudy.omer.OmerNusach
import com.sterni.dailystudy.omer.OmerTracker
import com.sterni.dailystudy.ui.theme.*

private val BG_NUSACH      = Color(0xFFFDFBF7)
private val HighlightGreen = Color(0xFF00D18C)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OmerNusachScreen(
    day: Int,
    onBack: () -> Unit
) {
    val ctx       = LocalContext.current
    val nusach    = remember(day) { OmerNusach.getDayNusach(day) }
    val isCounted = remember(day) {
        if (day in 1..49) OmerTracker.isCounted(ctx, day) else false
    }
    val week = if (day in 1..49) OmerNusach.anaBekoachWeek(day) else 0

    Scaffold(
        containerColor = BG_NUSACH,
        topBar = {
            TopAppBar(
                title = { Text("ספירת העומר", fontFamily = BaHaYetzira) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ChevronRight, contentDescription = null)
                    }
                },
                actions = {
                    TextButton(onClick = onBack) {
                        Text(
                            text       = "מעקב",
                            fontFamily = SblHebrew,
                            fontSize   = 14.sp,
                            color      = Primary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BG_NUSACH)
            )
        }
    ) { padding ->
        if (nusach == null) {
            Box(
                modifier            = Modifier.fillMaxSize().padding(padding),
                contentAlignment    = Alignment.Center
            ) {
                Text(
                    text       = "אין ספירה כעת",
                    fontSize   = 18.sp,
                    fontFamily = BaHaYetzira,
                    color      = Muted,
                    textAlign  = TextAlign.Center
                )
            }
            return@Scaffold
        }

        LazyColumn(
            modifier        = Modifier.fillMaxSize().padding(padding),
            contentPadding  = PaddingValues(horizontal = 20.dp, vertical = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {

            // ── Status badge ──────────────────────────────────────────────────
            item {
                Surface(
                    modifier = Modifier.fillMaxWidth(),
                    shape    = RoundedCornerShape(14.dp),
                    color    = Color.White
                ) {
                    Box(
                        modifier         = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 12.dp, horizontal = 16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        val badgeText = buildAnnotatedString {
                            append("יום ")
                            withStyle(SpanStyle(color = HighlightGreen)) {
                                append(OmerHelper.hebrewNumeral(day))
                            }
                            if (isCounted) {
                                append(" — ✓ נספר")
                            } else {
                                append(" — טרם נספרה")
                            }
                        }
                        Text(
                            text       = badgeText,
                            fontSize   = 15.sp,
                            fontFamily = BaHaYetzira,
                            color      = Ink,
                            textAlign  = TextAlign.Center
                        )
                    }
                }
            }

            // ── Hebrew date ──────────────────────────────────────────────────
            item {
                Text(
                    text      = nusach.hebrewDate,
                    modifier  = Modifier.fillMaxWidth(),
                    fontSize  = 13.sp,
                    fontFamily = SblHebrew,
                    color     = Muted,
                    textAlign = TextAlign.Center
                )
            }

            // ── Bracha ───────────────────────────────────────────────────────
            item { NusachText(text = OmerNusach.BRACHA) }

            // ── Counting declaration ─────────────────────────────────────────
            item { NusachText(text = nusach.countingText, fontSize = 21) }

            // ── Sefirah name ─────────────────────────────────────────────────
            item {
                Text(
                    text       = nusach.sefirah,
                    modifier   = Modifier.fillMaxWidth(),
                    fontSize   = 18.sp,
                    fontFamily = BaHaYetzira,
                    color      = HighlightGreen,
                    textAlign  = TextAlign.Center
                )
            }

            item { Spacer(Modifier.height(2.dp)) }

            // ── HaRachaman ───────────────────────────────────────────────────
            item { NusachText(text = OmerNusach.HARACHAMAN) }

            item { Spacer(Modifier.height(2.dp)) }

            // ── Psalm 67 ─────────────────────────────────────────────────────
            item { NusachText(text = OmerNusach.PSALM_67, fontSize = 16) }

            // ── Ana BeKoach ──────────────────────────────────────────────────
            item {
                Column(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    OmerNusach.ANA_BEKOACH_LINES.forEachIndexed { idx, (lineText, acrostic) ->
                        val isCurrentWeek = idx == week
                        val lineColor     = if (isCurrentWeek) HighlightGreen else Ink
                        val acroColor     = if (isCurrentWeek) HighlightGreen else Muted
                        Row(
                            modifier          = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 3.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.Center
                        ) {
                            Text(
                                text       = lineText,
                                modifier   = Modifier.weight(1f),
                                fontSize   = 17.sp,
                                fontFamily = SblHebrew,
                                color      = lineColor,
                                textAlign  = TextAlign.Center,
                                lineHeight = 26.sp
                            )
                            Spacer(Modifier.width(10.dp))
                            Text(
                                text       = acrostic,
                                fontSize   = 12.sp,
                                fontFamily = SblHebrew,
                                color      = acroColor
                            )
                        }
                    }
                }
            }

            item { Spacer(Modifier.height(4.dp)) }

            // ── Baruch Shem ──────────────────────────────────────────────────
            item { NusachText(text = OmerNusach.BARUCH_SHEM) }

            // ── Ribono Shel Olam ─────────────────────────────────────────────
            item {
                val ribonoText = buildAnnotatedString {
                    append(OmerNusach.RIBONO_PREFIX)
                    withStyle(SpanStyle(color = HighlightGreen)) {
                        append(nusach.sefirah)
                    }
                    append(OmerNusach.RIBONO_SUFFIX)
                }
                Text(
                    text       = ribonoText,
                    modifier   = Modifier.fillMaxWidth(),
                    fontSize   = 17.sp,
                    fontFamily = SblHebrew,
                    color      = Ink,
                    textAlign  = TextAlign.Center,
                    lineHeight = 26.sp
                )
            }

            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun NusachText(
    text:     String,
    fontSize: Int = 17
) {
    Text(
        text       = text,
        modifier   = Modifier.fillMaxWidth(),
        fontSize   = fontSize.sp,
        fontFamily = SblHebrew,
        color      = Ink,
        textAlign  = TextAlign.Center,
        lineHeight = (fontSize + 9).sp
    )
}

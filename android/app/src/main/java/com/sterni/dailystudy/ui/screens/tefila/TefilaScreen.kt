package com.sterni.dailystudy.ui.screens.tefila

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.AutoStories
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.*

private val STUDY_BG = Color(0xFFFDFBF7)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TefilaScreen(
    onBack:            () -> Unit,
    onEizVehuClick:    () -> Unit = {},
    onRabbenuTamClick: () -> Unit = {}
) {
    Scaffold(
        containerColor = STUDY_BG,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "סדר תפילה",
                        fontFamily = BaHaYetzira,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 20.sp,
                        color      = Primary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = Primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = STUDY_BG)
            )
        }
    ) { padding ->
        Column(
            modifier            = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 16.dp, vertical = 24.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            TefilaCard(
                title      = "איזהו מקומן",
                subtitle   = "פרק ה׳ מזבחים — קדשי קדשים וקדשים קלים",
                icon       = Icons.AutoMirrored.Filled.MenuBook,
                accentColor = Primary,
                onClick    = onEizVehuClick
            )

            TefilaCard(
                title      = "קריאת שמע — רבינו תם",
                subtitle   = "שמע ישראל, ואהבת, שמע ובין השמשות",
                icon       = Icons.Default.AutoStories,
                accentColor = Color(0xFF7C3AED),
                onClick    = onRabbenuTamClick
            )
        }
    }
}

@Composable
private fun TefilaCard(
    title:       String,
    subtitle:    String,
    icon:        ImageVector,
    accentColor: Color,
    onClick:     () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .clickable(onClick = onClick),
        shape    = RoundedCornerShape(20.dp),
        colors   = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Row(
            modifier          = Modifier
                .fillMaxWidth()
                .padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape  = RoundedCornerShape(14.dp),
                color  = accentColor.copy(alpha = 0.12f),
                modifier = Modifier.size(60.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        icon,
                        contentDescription = null,
                        tint               = accentColor,
                        modifier           = Modifier.size(32.dp)
                    )
                }
            }

            Spacer(Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text       = title,
                    fontSize   = 19.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = BaHaYetzira,
                    color      = accentColor
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text       = subtitle,
                    fontSize   = 13.sp,
                    fontFamily = SblHebrew,
                    color      = Muted,
                    lineHeight = 20.sp
                )
            }
        }
    }
}

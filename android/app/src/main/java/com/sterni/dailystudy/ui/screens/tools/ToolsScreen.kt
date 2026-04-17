package com.sterni.dailystudy.ui.screens.tools

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.SblHebrew

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ToolsScreen(
    onBack:                    () -> Unit,
    onSilentZoneClick:         () -> Unit,
    onPermissionsClick:        () -> Unit,
    onJerusalemDirectionClick: () -> Unit
) {
    Scaffold(
        containerColor = Color(0xFFFDFBF7),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "כלים",
                        fontFamily = BaHaYetzira,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 20.sp
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזור")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor        = Color(0xFFFDFBF7),
                    titleContentColor     = MaterialTheme.colorScheme.onSurface,
                    navigationIconContentColor = MaterialTheme.colorScheme.onSurface
                )
            )
        }
    ) { padding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                ToolCard(
                    title       = "הרשאות",
                    subtitle    = "ניהול כל הרשאות האפליקציה במקום אחד",
                    icon        = Icons.Default.Security,
                    accentColor = Color(0xFF0284C7),
                    onClick     = onPermissionsClick
                )
            }
            item {
                ToolCard(
                    title       = "כיוון ירושלים",
                    subtitle    = "מצפן לכיוון ירושלים עיר הקודש",
                    icon        = Icons.Default.Explore,
                    accentColor = Color(0xFF059669),
                    onClick     = onJerusalemDirectionClick
                )
            }
            item {
                ToolCard(
                    title       = "אזורי שקט",
                    subtitle    = "השתקה אוטומטית לפי מיקום",
                    icon        = Icons.Default.LocationOn,
                    accentColor = Color(0xFF7C3AED),
                    onClick     = onSilentZoneClick
                )
            }
        }
    }
}

@Composable
private fun ToolCard(
    title:       String,
    subtitle:    String,
    icon:        ImageVector,
    accentColor: Color,
    onClick:     () -> Unit
) {
    Card(
        modifier  = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape     = RoundedCornerShape(16.dp),
        colors    = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier          = Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape    = RoundedCornerShape(12.dp),
                color    = accentColor.copy(alpha = 0.12f),
                modifier = Modifier.size(52.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(icon, contentDescription = null, tint = accentColor, modifier = Modifier.size(28.dp))
                }
            }

            Spacer(Modifier.width(16.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text       = title,
                    fontSize   = 18.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SblHebrew,
                    color      = MaterialTheme.colorScheme.onSurface
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text       = subtitle,
                    fontSize   = 14.sp,
                    fontFamily = SblHebrew,
                    color      = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            Icon(
                Icons.Default.ChevronRight,
                contentDescription = null,
                tint               = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.5f)
            )
        }
    }
}

package com.sterni.dailystudy.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowForward
import androidx.compose.material.icons.rounded.ChevronLeft
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.*

@Composable
fun AppScreenHeader(
    title: String,
    onBack: () -> Unit,
    subtitle: String? = null,
    action: (@Composable () -> Unit)? = null
) {
    Column(Modifier.fillMaxWidth().background(Color.White)) {
        Spacer(Modifier.statusBarsPadding())
        Row(
            modifier = Modifier.fillMaxWidth().height(60.dp).padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                Icon(
                    Icons.AutoMirrored.Rounded.ArrowForward,
                    contentDescription = "חזור",
                    tint = Muted.copy(alpha = .65f),
                    modifier = Modifier.size(21.dp)
                )
            }
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    title,
                    color = Ink,
                    fontFamily = BaHaYetzira,
                    fontSize = 23.sp,
                    textAlign = TextAlign.Center
                )
                if (subtitle != null) Text(
                    subtitle,
                    color = Muted,
                    fontFamily = SblHebrew,
                    fontSize = 11.sp
                )
            }
            Box(Modifier.size(48.dp), contentAlignment = Alignment.Center) { action?.invoke() }
        }
        HorizontalDivider(color = Color(0xFFF0F0F0), thickness = .5.dp)
    }
}

@Composable
fun AppSectionTitle(title: String, description: String? = null) {
    Column(Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 4.dp)) {
        Text(title, fontFamily = SblHebrew, fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Ink)
        if (description != null) {
            Spacer(Modifier.height(2.dp))
            Text(description, fontFamily = SblHebrew, fontSize = 12.sp, color = Muted, lineHeight = 17.sp)
        }
    }
}

@Composable
fun AppCard(
    modifier: Modifier = Modifier,
    content: @Composable ColumnScope.() -> Unit
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = Color.White,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, LineColor.copy(alpha = .7f)),
        shadowElevation = 0.dp
    ) {
        Column(Modifier.padding(16.dp), content = content)
    }
}

@Composable
fun AppListRow(
    title: String,
    subtitle: String,
    icon: ImageVector,
    accent: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 15.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(
            modifier = Modifier.size(42.dp),
            shape = RoundedCornerShape(11.dp),
            color = accent.copy(alpha = .09f)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(icon, null, tint = accent, modifier = Modifier.size(21.dp))
            }
        }
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = Ink)
            Spacer(Modifier.height(2.dp))
            Text(subtitle, fontFamily = SblHebrew, fontSize = 12.sp, color = Muted, lineHeight = 17.sp)
        }
        Icon(Icons.Rounded.ChevronLeft, null, tint = Muted.copy(alpha = .28f), modifier = Modifier.size(20.dp))
    }
}

@Composable
fun AppValueLabel(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
        Text(label, fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = Ink)
        Text(value, fontFamily = SblHebrew, fontWeight = FontWeight.Bold, fontSize = 12.sp, color = Primary)
    }
}

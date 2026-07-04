package com.sterni.dailystudy.ui.screens.tools

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.rounded.*
import androidx.compose.material3.HorizontalDivider
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.sterni.dailystudy.ui.components.*
import com.sterni.dailystudy.ui.theme.BgColor
import com.sterni.dailystudy.ui.theme.LineColor
import com.sterni.dailystudy.ui.theme.Primary

private data class ToolItem(
    val title: String,
    val subtitle: String,
    val icon: ImageVector,
    val accent: Color,
    val onClick: () -> Unit
)

@Composable
fun ToolsScreen(
    onBack: () -> Unit,
    onTefilaClick: () -> Unit,
    onSilentZoneClick: () -> Unit,
    onMamaarimClick: () -> Unit,
    onPermissionsClick: () -> Unit,
    onJerusalemDirClick: () -> Unit,
    onAppBlockerClick: () -> Unit = {}
) {
    val everyday = listOf(
        ToolItem("תפילה", "קטעי תפילה וקריאת שמע", Icons.AutoMirrored.Filled.MenuBook, Primary, onTefilaClick),
        ToolItem("כיוון ירושלים", "מצפן לכיוון ירושלים עיר הקודש", Icons.Rounded.Explore, Color(0xFFD97706), onJerusalemDirClick),
        ToolItem("מאמרים", "מאגר המאמרים האישי שלך", Icons.Rounded.Article, Color(0xFF7C3AED), onMamaarimClick)
    )
    val device = listOf(
        ToolItem("אזורי שקט", "השתקה אוטומטית במקומות שבחרת", Icons.Rounded.LocationOn, Color(0xFF059669), onSilentZoneClick),
        ToolItem("חוסם אפליקציות", "זמנים שקטים מהסחות דעת", Icons.Rounded.Block, Color(0xFFDC2626), onAppBlockerClick),
        ToolItem("הרשאות", "בדיקה וניהול הרשאות המכשיר", Icons.Rounded.Security, Color(0xFF64748B), onPermissionsClick)
    )

    Column(Modifier.fillMaxSize().background(BgColor)) {
        AppScreenHeader("כלים", onBack, "הכל במקום אחד")
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp)
        ) {
            item { AppSectionTitle("ליום יום", "לימוד, תפילה והתמצאות") }
            item { ToolGroup(everyday) }
            item { AppSectionTitle("המכשיר שלי", "כלים שעובדים ברקע ושומרים על הזמן שלך") }
            item { ToolGroup(device) }
            item { Spacer(Modifier.height(20.dp)) }
        }
    }
}

@Composable
private fun ToolGroup(items: List<ToolItem>) {
    AppCard(modifier = Modifier.padding(top = 4.dp)) {
        items.forEachIndexed { index, item ->
            AppListRow(item.title, item.subtitle, item.icon, item.accent, item.onClick)
            if (index != items.lastIndex) HorizontalDivider(color = LineColor.copy(alpha = .55f), modifier = Modifier.padding(start = 56.dp))
        }
    }
}

package com.sterni.dailystudy.ui.screens.tools

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.Ink
import com.sterni.dailystudy.ui.theme.Muted
import com.sterni.dailystudy.ui.theme.Primary
import com.sterni.dailystudy.ui.theme.SblHebrew

private data class PermissionInfo(
    val title:      String,
    val subtitle:   String,
    val permission: String?,   // null = not a runtime permission (granted automatically)
    val icon:       ImageVector,
    val isDndSpecial: Boolean = false  // requires NotificationManager special access
)

private val APP_PERMISSIONS = listOf(
    PermissionInfo(
        title      = "מיקום מדויק",
        subtitle   = "נדרש לאזורי שקט ולכיוון ירושלים",
        permission = Manifest.permission.ACCESS_FINE_LOCATION,
        icon       = Icons.Default.LocationOn
    ),
    PermissionInfo(
        title      = "מיקום ברקע",
        subtitle   = "אזורי שקט פועלים גם כשהאפליקציה סגורה",
        permission = Manifest.permission.ACCESS_BACKGROUND_LOCATION,
        icon       = Icons.Default.MyLocation
    ),
    PermissionInfo(
        title      = "התראות",
        subtitle   = "תזכורות זמנים, ספירת העומר ולימוד יומי",
        permission = Manifest.permission.POST_NOTIFICATIONS,
        icon       = Icons.Default.Notifications
    ),
    PermissionInfo(
        title      = "יומן",
        subtitle   = "שמירת אירועי לימוד ביומן האישי",
        permission = Manifest.permission.READ_CALENDAR,
        icon       = Icons.Default.CalendarMonth
    ),
    PermissionInfo(
        title      = "שינוי הגדרות שמע",
        subtitle   = "השתקה אוטומטית באזורי שקט",
        permission = Manifest.permission.MODIFY_AUDIO_SETTINGS,
        icon       = Icons.Default.VolumeOff
    ),
    PermissionInfo(
        title        = "נא לא להפריע (DND)",
        subtitle     = "השתקה אוטומטית ועצירת התראות בזמן לימוד",
        permission   = null,
        icon         = Icons.Default.DoNotDisturb,
        isDndSpecial = true
    ),
    PermissionInfo(
        title      = "אינטרנט",
        subtitle   = "טעינת לימודים יומיים מהשרת",
        permission = null,
        icon       = Icons.Default.Wifi
    ),
    PermissionInfo(
        title      = "הפעלה בהפעלה מחדש",
        subtitle   = "שחזור תזמוני התראות לאחר הפעלה מחדש",
        permission = null,
        icon       = Icons.Default.Autorenew
    )
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PermissionsScreen(onBack: () -> Unit) {
    val context = LocalContext.current

    val notificationManager = remember {
        context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    }

    fun isGranted(p: PermissionInfo): Boolean = when {
        p.isDndSpecial -> notificationManager.isNotificationPolicyAccessGranted
        p.permission == null -> true
        else -> ContextCompat.checkSelfPermission(context, p.permission) == PackageManager.PERMISSION_GRANTED
    }

    // Track grant state — refresh when composable enters composition
    var grantState by remember { mutableStateOf(APP_PERMISSIONS.associate { it.title to isGranted(it) }) }

    val multiPermLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        grantState = APP_PERMISSIONS.associate { it.title to isGranted(it) }
    }

    Scaffold(
        containerColor = Color(0xFFFDFBF7),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "הרשאות האפליקציה",
                        fontFamily = BaHaYetzira,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 20.sp,
                        color      = Primary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזור", tint = Primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFFFDFBF7))
            )
        }
    ) { padding ->
        LazyColumn(
            modifier       = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            item {
                Surface(
                    modifier  = Modifier.fillMaxWidth(),
                    shape     = RoundedCornerShape(14.dp),
                    color     = Primary.copy(alpha = 0.07f)
                ) {
                    Text(
                        text       = "כאן תוכל לראות ולנהל את כל ההרשאות שהאפליקציה מבקשת ולמה הן נחוצות",
                        modifier   = Modifier.padding(14.dp),
                        fontSize   = 13.sp,
                        fontFamily = SblHebrew,
                        color      = Primary,
                        lineHeight = 20.sp
                    )
                }
            }

            items(APP_PERMISSIONS) { perm ->
                val isGranted = grantState[perm.title] ?: false
                PermissionCard(
                    info      = perm,
                    isGranted = isGranted,
                    onRequest = {
                        when {
                            perm.isDndSpecial ->
                                context.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
                            perm.permission != null ->
                                multiPermLauncher.launch(arrayOf(perm.permission))
                        }
                    },
                    onOpenSettings = {
                        context.startActivity(
                            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                                data = Uri.fromParts("package", context.packageName, null)
                            }
                        )
                    }
                )
            }

            item { Spacer(Modifier.height(16.dp)) }
        }
    }
}

@Composable
private fun PermissionCard(
    info:          PermissionInfo,
    isGranted:     Boolean,
    onRequest:     () -> Unit,
    onOpenSettings: () -> Unit
) {
    val grantedColor = Color(0xFF059669)
    val deniedColor  = Color(0xFFDC2626)

    Card(
        modifier  = Modifier.fillMaxWidth(),
        shape     = RoundedCornerShape(14.dp),
        colors    = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Row(
            modifier          = Modifier.fillMaxWidth().padding(14.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Surface(
                shape    = RoundedCornerShape(10.dp),
                color    = if (isGranted) grantedColor.copy(alpha = 0.10f) else deniedColor.copy(alpha = 0.08f),
                modifier = Modifier.size(44.dp)
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(
                        info.icon,
                        contentDescription = null,
                        tint               = if (isGranted) grantedColor else deniedColor,
                        modifier           = Modifier.size(22.dp)
                    )
                }
            }

            Spacer(Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text       = info.title,
                    fontSize   = 15.sp,
                    fontWeight = FontWeight.SemiBold,
                    fontFamily = SblHebrew,
                    color      = Ink
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text       = info.subtitle,
                    fontSize   = 12.sp,
                    fontFamily = SblHebrew,
                    color      = Muted,
                    lineHeight = 18.sp
                )
                Spacer(Modifier.height(6.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Surface(
                        shape = RoundedCornerShape(6.dp),
                        color = if (isGranted) grantedColor.copy(alpha = 0.12f) else deniedColor.copy(alpha = 0.10f)
                    ) {
                        Text(
                            text     = if (isGranted) "✓ מאושר" else "✗ לא מאושר",
                            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp),
                            fontSize = 11.sp,
                            fontFamily = SblHebrew,
                            color    = if (isGranted) grantedColor else deniedColor,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                    if (!isGranted && (info.permission != null || info.isDndSpecial)) {
                        TextButton(
                            onClick      = onRequest,
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                            modifier     = Modifier.height(28.dp)
                        ) {
                            Text(
                                text       = "אשר",
                                fontSize   = 12.sp,
                                fontFamily = SblHebrew,
                                color      = Primary
                            )
                        }
                        TextButton(
                            onClick      = onOpenSettings,
                            contentPadding = PaddingValues(horizontal = 8.dp, vertical = 0.dp),
                            modifier     = Modifier.height(28.dp)
                        ) {
                            Text(
                                text       = "הגדרות",
                                fontSize   = 12.sp,
                                fontFamily = SblHebrew,
                                color      = Muted
                            )
                        }
                    }
                }
            }
        }
    }
}

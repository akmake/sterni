package com.sterni.dailystudy.ui.screens.settings

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.CloudDownload
import androidx.compose.material.icons.rounded.DeleteOutline
import androidx.compose.material.icons.rounded.Sync
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.cache.StudyCache
import com.sterni.dailystudy.data.api.RetrofitClient
import com.sterni.dailystudy.sync.UserManager
import com.sterni.dailystudy.ui.theme.*
import com.sterni.dailystudy.ui.components.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

private val STUDY_LABELS = listOf(
    "chumash"      to "חומש",
    "tehillim"     to "תהילים",
    "tanya"        to "תניא",
    "rambam"       to "רמבם ג׳ פרקים",
    "rambamOne"    to "רמבם פרק א׳",
    "shnayimMikra" to "שניים מקרא"
)

@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context      = LocalContext.current
    val studyPrefs   = remember { context.getSharedPreferences("StudyPrefs", Context.MODE_PRIVATE) }
    val chumashPrefs = remember { context.getSharedPreferences("ChumashPrefs", Context.MODE_PRIVATE) }
    val shnayimPrefs = remember { context.getSharedPreferences("ShnayimPrefs", Context.MODE_PRIVATE) }
    val scope        = rememberCoroutineScope()

    var scrollSpeed      by remember { mutableIntStateOf(studyPrefs.getInt("scroll_speed", 40)) }
    var shnayimConnected by remember { mutableStateOf(shnayimPrefs.getBoolean("shnayim_mikra_connected", true)) }
    var cacheInfo        by remember { mutableStateOf("שמורים ${StudyCache.cachedCount(context)} ימים") }
    var downloadProgress by remember { mutableStateOf("") }
    var downloading      by remember { mutableStateOf(false) }
    var userId           by remember { mutableStateOf(UserManager.getUserId(context) ?: "טוען...") }
    var loginCode        by remember { mutableStateOf("") }
    var loginStatus      by remember { mutableStateOf("") }

    // Per-study font sizes
    val fontSizes = remember {
        STUDY_LABELS.associate { (key, _) ->
            key to mutableIntStateOf(
                if (key == "chumash") chumashPrefs.getInt("chumash_text_size", 20)
                else studyPrefs.getInt("font_$key", 20)
            )
        }
    }

    Column(Modifier.fillMaxSize().background(BgColor)) {
        AppScreenHeader("הגדרות", onBack, "התאמה אישית")
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AppSectionTitle("קריאה", "התאם את הטקסט והגלילה לקצב שלך")
            AppCard {
                STUDY_LABELS.forEach { (key, label) ->
                    val state = fontSizes[key] ?: return@forEach
                    var size by state
                    AppValueLabel(label, "$size")
                    Slider(
                        value         = size.toFloat(),
                        onValueChange = {
                            size = it.toInt()
                            if (key == "chumash")
                                chumashPrefs.edit().putInt("chumash_text_size", size).apply()
                            else
                                studyPrefs.edit().putInt("font_$key", size).apply()
                        },
                        valueRange = 14f..32f,
                        steps      = 17,
                        colors     = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary)
                    )
                    if (key != STUDY_LABELS.last().first) HorizontalDivider(color = LineColor.copy(alpha = .45f))
                }
            }
            AppCard {
                AppValueLabel("מהירות גלילה אוטומטית", "$scrollSpeed")
                Slider(
                    value = scrollSpeed.toFloat(),
                    onValueChange = {
                        scrollSpeed = it.toInt()
                        studyPrefs.edit().putInt("scroll_speed", scrollSpeed).apply()
                    },
                    valueRange = 10f..100f,
                    steps      = 8,
                    colors     = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary)
                )
            }
            AppCard {
                Text("שניים מקרא ואחד תרגום", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 14.sp)
                Text("בחר כיצד יוצגו הפסוקים והתרגום", color = Muted, fontSize = 12.sp)
                Spacer(Modifier.height(12.dp))
                Row(Modifier.fillMaxWidth().background(Color(0xFFF5F7F6), RoundedCornerShape(11.dp)).padding(4.dp)) {
                    TextButton(
                        onClick = {
                            shnayimConnected = true
                            shnayimPrefs.edit().putBoolean("shnayim_mikra_connected", true).apply()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (shnayimConnected) Color.White else Color.Transparent,
                            contentColor   = if (shnayimConnected) Color.White else Muted
                        ).let { if (shnayimConnected) ButtonDefaults.textButtonColors(containerColor = Primary, contentColor = Color.White) else ButtonDefaults.textButtonColors(contentColor = Muted) },
                        shape = RoundedCornerShape(8.dp)
                    ) { Text("רצוף") }
                    TextButton(
                        onClick = {
                            shnayimConnected = false
                            shnayimPrefs.edit().putBoolean("shnayim_mikra_connected", false).apply()
                        },
                        modifier = Modifier.weight(1f),
                        colors = if (!shnayimConnected) ButtonDefaults.textButtonColors(containerColor = Primary, contentColor = Color.White) else ButtonDefaults.textButtonColors(contentColor = Muted),
                        shape = RoundedCornerShape(8.dp)
                    ) { Text("מופרד") }
                }
            }
            AppSectionTitle("נתונים וסנכרון", "שמירה לשימוש בלי חיבור ומעבר בין מכשירים")
            AppCard {
                Text("לימוד בלי חיבור", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 14.sp)
                Text("הורד את 30 הימים הקרובים למכשיר", color = Muted, fontSize = 12.sp)
                if (downloadProgress.isNotEmpty()) {
                    Text(downloadProgress, fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 8.dp))
                }
                Spacer(Modifier.height(10.dp))
                Row(
                    modifier              = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = {
                            if (!downloading) {
                                downloading = true
                                scope.launch {
                                    downloadDays(context, 30) { progress -> downloadProgress = progress }
                                    cacheInfo = "שמורים ${StudyCache.cachedCount(context)} ימים"
                                    downloading = false
                                }
                            }
                        },
                        enabled  = !downloading,
                        modifier = Modifier.weight(1f),
                        colors   = ButtonDefaults.buttonColors(containerColor = Primary),
                        shape = RoundedCornerShape(10.dp)
                    ) { Icon(Icons.Rounded.CloudDownload, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("הורד") }
                    OutlinedButton(
                        onClick = {
                            val deleted = StudyCache.clearAll(context)
                            cacheInfo = "נמחקו $deleted ימים"
                            downloadProgress = ""
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFDC2626)),
                        border = BorderStroke(1.dp, Color(0xFFDC2626).copy(alpha = .25f)),
                        shape = RoundedCornerShape(10.dp)
                    ) { Icon(Icons.Rounded.DeleteOutline, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("מחק") }
                }
                if (cacheInfo.isNotEmpty()) {
                    Text(cacheInfo, fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 4.dp))
                }
            }
            AppCard {
                Text("החשבון שלי", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                Surface(color = Primary.copy(alpha = .07f), shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(14.dp), Arrangement.SpaceBetween, Alignment.CenterVertically) {
                        Text("מספר משתמש", color = Muted, fontSize = 12.sp)
                        Text(userId, fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Primary)
                    }
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "המספר הזה מאפשר לשחזר את הנתונים במכשיר אחר.",
                    fontSize = 12.sp,
                    color = Muted
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = LineColor.copy(alpha = 0.5f))
                Text("שחזור ממכשיר אחר", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = loginCode,
                    onValueChange = { loginCode = it.filter { c -> c.isDigit() }.take(4) },
                    label = { Text("מספר משתמש — 4 ספרות") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true
                )
                if (loginStatus.isNotEmpty()) {
                    Text(
                        loginStatus,
                        fontSize = 13.sp,
                        color = if (loginStatus.startsWith("✓")) Primary else Color.Red,
                        modifier = Modifier.padding(top = 4.dp)
                    )
                }
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = {
                        if (loginCode.length == 4) {
                            scope.launch {
                                loginStatus = "מתחבר..."
                                val ok = withContext(Dispatchers.IO) {
                                    UserManager.loginWithCode(context, loginCode)
                                }
                                if (ok) {
                                    userId = loginCode
                                    loginStatus = "✓ הנתונים סונכרנו בהצלחה!"
                                } else {
                                    loginStatus = "מספר לא נמצא. בדוק ונסה שוב."
                                }
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    enabled  = loginCode.length == 4,
                    colors   = ButtonDefaults.buttonColors(containerColor = Primary),
                    shape = RoundedCornerShape(10.dp)
                ) { Icon(Icons.Rounded.Sync, null, Modifier.size(18.dp)); Spacer(Modifier.width(7.dp)); Text("שחזר וסנכרן") }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    LaunchedEffect(Unit) {
        if (userId == "טוען...") {
            val id = withContext(Dispatchers.IO) { UserManager.ensureRegistered(context) }
            userId = id ?: "לא זמין (אין חיבור)"
        }
    }
}

private suspend fun downloadDays(context: Context, total: Int, onProgress: (String) -> Unit) {
    val sdf = SimpleDateFormat("yyyy-MM-dd", Locale.US)
    for (i in 0 until total) {
        val cal = Calendar.getInstance()
        cal.add(Calendar.DAY_OF_YEAR, i)
        val date = sdf.format(cal.time)
        if (StudyCache.get(context, date) != null) continue
        onProgress("מוריד ${i + 1} / $total...")
        try {
            val response = RetrofitClient.apiService.getDailyStudy(date)
            val day = if (response.isSuccessful) response.body() else null
            if (day != null) StudyCache.save(context, date, day)
        } catch (_: Exception) {}
    }
    onProgress("ההורדה הושלמה.")
}

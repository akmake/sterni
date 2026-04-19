package com.sterni.dailystudy.ui.screens.settings

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
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
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context      = LocalContext.current
    val rambamPrefs  = remember { context.getSharedPreferences("RambamPrefs", Context.MODE_PRIVATE) }
    val shnayimPrefs = remember { context.getSharedPreferences("ShnayimPrefs", Context.MODE_PRIVATE) }
    val scope        = rememberCoroutineScope()

    var fontSize         by remember { mutableIntStateOf(rambamPrefs.getInt("text_size_sp", 20)) }
    var scrollSpeed      by remember { mutableIntStateOf(rambamPrefs.getInt("scroll_speed", 40)) }
    var shnayimConnected by remember { mutableStateOf(shnayimPrefs.getBoolean("shnayim_mikra_connected", true)) }
    var cacheInfo        by remember { mutableStateOf("שמורים ${StudyCache.cachedCount(context)} ימים") }
    var downloadProgress by remember { mutableStateOf("") }
    var downloading      by remember { mutableStateOf(false) }
    var userId           by remember { mutableStateOf(UserManager.getUserId(context) ?: "טוען...") }
    var loginCode        by remember { mutableStateOf("") }
    var loginStatus      by remember { mutableStateOf("") }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(BgColor)
    ) {
        Surface(shadowElevation = 0.dp, color = Color(0xFFFDFBF7)) {
            Column {
                Spacer(Modifier.statusBarsPadding())
                Row(
                    modifier = Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowForward, contentDescription = "חזור", tint = Primary)
                    }
                    Text(
                        "הגדרות",
                        modifier = Modifier.weight(1f),
                        textAlign = TextAlign.Center,
                        fontSize = 19.sp,
                        fontWeight = FontWeight.Bold,
                        color = Primary
                    )
                    Spacer(Modifier.width(48.dp))
                }
            }
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(start = 16.dp, end = 8.dp, top = 16.dp, bottom = 16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            SettingsCard {
                SettingLabel("גודל טקסט", "${fontSize}sp")
                Slider(
                    value = ((fontSize - 14) / 2f),
                    onValueChange = {
                        fontSize = 14 + (it.toInt() * 2)
                        rambamPrefs.edit().putInt("text_size_sp", fontSize).apply()
                    },
                    valueRange = 0f..7f,
                    steps = 6,
                    colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary)
                )
            }

            SettingsCard {
                SettingLabel("מהירות גלילה", "${scrollSpeed} px/s")
                Slider(
                    value = ((scrollSpeed - 10) / 5f),
                    onValueChange = {
                        scrollSpeed = 10 + (it.toInt() * 5)
                        rambamPrefs.edit().putInt("scroll_speed", scrollSpeed).apply()
                    },
                    valueRange = 0f..22f,
                    steps = 21,
                    colors = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary)
                )
            }

            SettingsCard {
                Text("שניים מקרא ואחד תרגום", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp)
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            shnayimConnected = true
                            shnayimPrefs.edit().putBoolean("shnayim_mikra_connected", true).apply()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (shnayimConnected) Primary else LineColor,
                            contentColor   = if (shnayimConnected) Color.White else Muted
                        )
                    ) { Text("רצוף") }
                    Button(
                        onClick = {
                            shnayimConnected = false
                            shnayimPrefs.edit().putBoolean("shnayim_mikra_connected", false).apply()
                        },
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = if (!shnayimConnected) Primary else LineColor,
                            contentColor   = if (!shnayimConnected) Color.White else Muted
                        )
                    ) { Text("מופרד") }
                }
            }

            SettingsCard {
                Text("הורדה אופליין (30 יום)", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp)
                if (downloadProgress.isNotEmpty()) {
                    Text(downloadProgress, fontSize = 13.sp, color = Muted, modifier = Modifier.padding(top = 8.dp))
                }
                Spacer(Modifier.height(10.dp))
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
                    enabled = !downloading,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                ) { Text("הורד 30 ימים") }
                if (cacheInfo.isNotEmpty()) {
                    Text(cacheInfo, fontSize = 12.sp, color = Muted, modifier = Modifier.padding(top = 4.dp))
                }
            }

            SettingsCard {
                Text("מספר משתמש", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp)
                Spacer(Modifier.height(8.dp))
                Text(
                    "המספר שלך: $userId",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    "שמור את המספר הזה — הוא מסנכרן את כל הנתונים שלך בין מכשירים.",
                    fontSize = 12.sp,
                    color = Muted
                )
                HorizontalDivider(modifier = Modifier.padding(vertical = 12.dp), color = LineColor.copy(alpha = 0.5f))
                Text("כניסה ממכשיר אחר", fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 14.sp)
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = loginCode,
                    onValueChange = { loginCode = it.filter { c -> c.isDigit() }.take(4) },
                    label = { Text("הזן מספר משתמש (4 ספרות)") },
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
                    colors   = ButtonDefaults.buttonColors(containerColor = Primary)
                ) { Text("סנכרן מהמספר הזה") }
            }
        }
    }

    LaunchedEffect(Unit) {
        if (userId == "טוען...") {
            val id = withContext(Dispatchers.IO) { UserManager.ensureRegistered(context) }
            userId = id ?: "לא זמין (אין חיבור)"
        }
    }
}

@Composable
private fun SettingsCard(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        modifier        = Modifier.fillMaxWidth(),
        shape           = RoundedCornerShape(14.dp),
        shadowElevation = 1.dp,
        color           = Color(0xFFFDFBF7),
        border          = androidx.compose.foundation.BorderStroke(1.dp, LineColor.copy(alpha = 0.5f))
    ) {
        Column(modifier = Modifier.padding(16.dp), content = content)
    }
}

@Composable
private fun SettingLabel(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), Arrangement.SpaceBetween, Alignment.CenterVertically) {
        Text(label, fontWeight = FontWeight.SemiBold, color = Ink, fontSize = 15.sp)
        Text(value, fontSize = 14.sp, color = Primary, fontWeight = FontWeight.Bold)
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

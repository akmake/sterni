package com.sterni.dailystudy.ui.screens.location

import android.Manifest
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.geofence.SilentZone
import com.sterni.dailystudy.ui.theme.*
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*

@Composable
fun LocationZoneScreen(
    onBack: () -> Unit,
    vm: LocationZoneViewModel = viewModel()
) {
    val state         by vm.state.collectAsState()
    val context       = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    fun refreshPermissions() {
        val hasFine = ContextCompat.checkSelfPermission(
            context, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        val hasBackground = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            ContextCompat.checkSelfPermission(
                context, Manifest.permission.ACCESS_BACKGROUND_LOCATION
            ) == PackageManager.PERMISSION_GRANTED
        } else true
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        vm.updatePermissions(nm.isNotificationPolicyAccessGranted, hasFine && hasBackground)
    }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                refreshPermissions()
                if (state.hasLocationPermission) vm.reregisterAll()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    LaunchedEffect(Unit) { refreshPermissions() }

    val backgroundLocationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { refreshPermissions() }

    val locationLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        refreshPermissions()
        val fineGranted = results[Manifest.permission.ACCESS_FINE_LOCATION] == true
        if (fineGranted && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
        }
    }

    var showAddDialog by remember { mutableStateOf(false) }
    var pendingLatLng by remember { mutableStateOf<LatLng?>(null) }
    val cameraState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(LatLng(31.7683, 35.2137), 9f)
    }

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
                        "אזורי שקט",
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

        if (!state.hasLocationPermission) {
            val hasFine = ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            ZonePermissionBanner(
                text = if (!hasFine) "נדרשת הרשאת מיקום לפעולת השתקה" else "נדרשת הרשאת מיקום 'תמיד' לפעולה מדוייקת",
                buttonText = "אפשר"
            ) {
                if (!hasFine) {
                    locationLauncher.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                } else if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
                    backgroundLocationLauncher.launch(Manifest.permission.ACCESS_BACKGROUND_LOCATION)
                }
            }
        }
        if (!state.hasDndPermission) {
            ZonePermissionBanner(
                text = "הרשאת 'אל תפריע' חסומה? אפשר אותה בהגדרות המכשיר תחת 'אפשר הגדרות מוגבלות'.",
                buttonText = "אפשר"
            ) {
                context.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS))
            }
        }

        Box(modifier = Modifier.fillMaxWidth().weight(0.55f)) {
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraState,
                properties = MapProperties(isMyLocationEnabled = state.hasLocationPermission),
                onMapLongClick = { latLng ->
                    pendingLatLng = latLng
                    showAddDialog = true
                }
            ) {
                state.zones.forEach { zone ->
                    val center = LatLng(zone.lat, zone.lng)
                    Circle(
                        center      = center,
                        radius      = zone.radiusMeters.toDouble(),
                        strokeColor = if (zone.active) Primary else Color.Gray,
                        fillColor   = if (zone.active) Primary.copy(alpha = 0.15f) else Color.Gray.copy(alpha = 0.10f),
                        strokeWidth = 3f
                    )
                    Marker(state = MarkerState(position = center), title = zone.name)
                }
            }
        }

        Surface(
            modifier        = Modifier.fillMaxWidth().weight(0.45f).navigationBarsPadding(),
            color           = Color(0xFFFDFBF7),
            shape           = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
            shadowElevation = 8.dp
        ) {
            if (state.zones.isEmpty()) {
                Box(Modifier.fillMaxSize(), Alignment.Center) {
                    Text("עדיין אין אזורים מוגדרים.", textAlign = TextAlign.Center, color = Muted, fontSize = 14.sp)
                }
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 8.dp, top = 16.dp, bottom = 16.dp)
                ) {
                    items(state.zones, key = { it.id }) { zone ->
                        ZoneRow(
                            zone     = zone,
                            onToggle = { vm.toggleZone(zone.id) },
                            onDelete = { vm.removeZone(zone.id) }
                        )
                        HorizontalDivider(color = LineColor.copy(alpha = 0.5f), modifier = Modifier.padding(vertical = 4.dp))
                    }
                }
            }
        }
    }

    if (showAddDialog && pendingLatLng != null) {
        AddZoneDialog(
            latLng = pendingLatLng!!,
            onConfirm = { name, radius ->
                vm.addZone(name, pendingLatLng!!, radius)
                showAddDialog = false
            },
            onDismiss = { showAddDialog = false }
        )
    }
}

@Composable
private fun ZonePermissionBanner(text: String, buttonText: String, onClick: () -> Unit) {
    Surface(color = Amber.copy(alpha = 0.1f), modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(text, fontSize = 12.sp, color = Ink, modifier = Modifier.weight(1f))
            Button(onClick = onClick, modifier = Modifier.height(32.dp)) {
                Text(buttonText, fontSize = 12.sp)
            }
        }
    }
}

@Composable
private fun ZoneRow(zone: SilentZone, onToggle: () -> Unit, onDelete: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Switch(checked = zone.active, onCheckedChange = { onToggle() })
        Spacer(Modifier.width(16.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(zone.name, fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Ink)
            Text("${zone.radiusMeters.toInt()} מטר", fontSize = 13.sp, color = Muted)
        }
        IconButton(onClick = onDelete) {
            Icon(Icons.Default.Delete, contentDescription = "מחק", tint = Color.Red.copy(alpha = 0.6f))
        }
    }
}

@Composable
private fun AddZoneDialog(latLng: LatLng, onConfirm: (name: String, radius: Float) -> Unit, onDismiss: () -> Unit) {
    var name   by remember { mutableStateOf("") }
    var radius by remember { mutableFloatStateOf(100f) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("הוסף אזור שקט", fontWeight = FontWeight.Bold, color = Primary) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("שם האזור") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                Slider(value = radius, onValueChange = { radius = it }, valueRange = 50f..500f)
            }
        },
        confirmButton = {
            Button(onClick = { if (name.isNotBlank()) onConfirm(name.trim(), radius) }) { Text("הוסף") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("בטל") }
        }
    )
}

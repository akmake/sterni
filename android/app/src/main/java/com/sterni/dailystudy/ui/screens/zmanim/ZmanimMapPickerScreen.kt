package com.sterni.dailystudy.ui.screens.zmanim

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.BookmarkAdd
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.MyLocation
import androidx.compose.material.icons.filled.Place
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.google.android.gms.maps.CameraUpdateFactory
import com.google.android.gms.maps.model.CameraPosition
import com.google.android.gms.maps.model.LatLng
import com.google.maps.android.compose.*
import com.sterni.dailystudy.ui.theme.*
import com.sterni.dailystudy.util.HebrewDate
import com.sterni.dailystudy.zmanim.ChabadZmanimCalculator
import com.sterni.dailystudy.zmanim.ZmanimLocation
import com.sterni.dailystudy.zmanim.ZmanimLocationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale
import java.util.UUID

@Composable
fun ZmanimMapPickerScreen(
    onBack: () -> Unit,
    onLocationSelected: (ZmanimLocation) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val snackbarHostState = remember { SnackbarHostState() }

    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { perms ->
        hasLocationPermission = perms[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
                perms[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    }

    // Default pin: Jerusalem
    var selectedLatLng by remember { mutableStateOf(LatLng(31.7683, 35.2137)) }
    var locationName by remember { mutableStateOf("ירושלים") }
    var detectedTz by remember { mutableStateOf("Asia/Jerusalem") }
    var isGeocoding by remember { mutableStateOf(false) }
    var showSaveDialog by remember { mutableStateOf(false) }

    val cameraPositionState = rememberCameraPositionState {
        position = CameraPosition.fromLatLngZoom(selectedLatLng, 10f)
    }

    // Function to reverse geocode LatLng
    fun updateLocationDetails(latLng: LatLng) {
        selectedLatLng = latLng
        detectedTz = ZmanimLocationRepository.detectTimeZone(context, latLng.latitude, latLng.longitude)
        scope.launch {
            isGeocoding = true
            val name = withContext(Dispatchers.IO) {
                try {
                    val geocoder = Geocoder(context, Locale("he"))
                    @Suppress("DEPRECATION")
                    val list = geocoder.getFromLocation(latLng.latitude, latLng.longitude, 1)
                    val addr = list?.firstOrNull()
                    if (addr != null) {
                        val city = addr.locality ?: addr.subAdminArea ?: addr.adminArea
                        val country = addr.countryName
                        when {
                            city != null && country != null -> "$city, $country"
                            city != null -> city
                            country != null -> country
                            else -> "מיקום נבחר"
                        }
                    } else {
                        "מיקום נבחר"
                    }
                } catch (_: Exception) {
                    "מיקום נבחר"
                }
            }
            locationName = name
            isGeocoding = false
        }
    }

    // Function to center on GPS location
    fun moveToMyLocation() {
        if (!hasLocationPermission) {
            permissionLauncher.launch(
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
            )
            return
        }
        try {
            val fused = LocationServices.getFusedLocationProviderClient(context)
            fused.lastLocation.addOnSuccessListener { loc: Location? ->
                if (loc != null) {
                    val target = LatLng(loc.latitude, loc.longitude)
                    scope.launch {
                        cameraPositionState.animate(CameraUpdateFactory.newLatLngZoom(target, 14f))
                    }
                    updateLocationDetails(target)
                }
            }
        } catch (_: Exception) {}
    }

    // Live preview zmanim for selected location
    val previewLocation = remember(selectedLatLng, locationName, detectedTz) {
        ZmanimLocation(
            id = "preview",
            name = locationName,
            latitude = selectedLatLng.latitude,
            longitude = selectedLatLng.longitude,
            timeZoneId = detectedTz
        )
    }

    val previewZmanim = remember(previewLocation) {
        ChabadZmanimCalculator.calculateZmanim(HebrewDate.today(), previewLocation)
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) },
        containerColor = BgColor
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            // Google Map
            GoogleMap(
                modifier = Modifier.fillMaxSize(),
                cameraPositionState = cameraPositionState,
                properties = MapProperties(
                    isMyLocationEnabled = hasLocationPermission
                ),
                uiSettings = MapUiSettings(
                    zoomControlsEnabled = false,
                    myLocationButtonEnabled = false
                ),
                onMapClick = { latLng ->
                    updateLocationDetails(latLng)
                }
            ) {
                Marker(
                    state = MarkerState(position = selectedLatLng),
                    title = locationName,
                    snippet = "%.4f, %.4f".format(selectedLatLng.latitude, selectedLatLng.longitude)
                )
            }

            // Top Bar
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.TopCenter),
                color = Color(0xFFFDFBF7).copy(alpha = 0.95f),
                shadowElevation = 3.dp
            ) {
                Column {
                    Spacer(Modifier.statusBarsPadding())
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .padding(horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = onBack) {
                            Icon(
                                Icons.AutoMirrored.Filled.ArrowForward,
                                contentDescription = "חזור",
                                tint = Primary
                            )
                        }
                        Text(
                            text = "בחירת מיקום במפה",
                            modifier = Modifier.weight(1f),
                            textAlign = TextAlign.Center,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Primary
                        )
                        Spacer(Modifier.width(48.dp))
                    }
                }
            }

            // Floating My Location Button
            FloatingActionButton(
                onClick = { moveToMyLocation() },
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(top = 110.dp, end = 16.dp),
                containerColor = Color.White,
                contentColor = Primary,
                shape = CircleShape
            ) {
                Icon(Icons.Default.MyLocation, contentDescription = "המיקום שלי")
            }

            // Bottom Location Card
            Surface(
                modifier = Modifier
                    .fillMaxWidth()
                    .align(Alignment.BottomCenter)
                    .navigationBarsPadding()
                    .padding(16.dp),
                shape = RoundedCornerShape(20.dp),
                color = Color(0xFFFDFBF7),
                shadowElevation = 8.dp,
                border = androidx.compose.foundation.BorderStroke(1.dp, LineColor.copy(alpha = 0.5f))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .background(Primary.copy(alpha = 0.1f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(Icons.Default.Place, contentDescription = null, tint = Primary)
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = locationName,
                                fontSize = 17.sp,
                                fontWeight = FontWeight.Bold,
                                color = Primary,
                                maxLines = 1
                            )
                            Text(
                                text = "%.4f° N, %.4f° E | %s".format(
                                    selectedLatLng.latitude,
                                    selectedLatLng.longitude,
                                    detectedTz
                                ),
                                fontSize = 12.sp,
                                color = Muted
                            )
                        }
                    }

                    Spacer(Modifier.height(12.dp))

                    // Horizontal preview of key zmanim
                    val keyZmanim = previewZmanim.filter {
                        it.type in listOf("LatestShema", "Chatzos", "Shkiah", "Tzeis")
                    }

                    if (keyZmanim.isNotEmpty()) {
                        LazyRow(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            items(keyZmanim) { zman ->
                                Surface(
                                    color = BgColor,
                                    shape = RoundedCornerShape(8.dp),
                                    modifier = Modifier.padding(vertical = 2.dp)
                                ) {
                                    Column(
                                        modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally
                                    ) {
                                        Text(zman.label, fontSize = 11.sp, color = Muted)
                                        Text(
                                            zman.time,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Bold,
                                            color = Primary,
                                            fontFamily = FontFamily.Monospace
                                        )
                                    }
                                }
                            }
                        }
                        Spacer(Modifier.height(14.dp))
                    }

                    // Action buttons
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        OutlinedButton(
                            onClick = { showSaveDialog = true },
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Primary)
                        ) {
                            Icon(Icons.Default.BookmarkAdd, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("שמור מיקום", fontSize = 14.sp, fontWeight = FontWeight.Medium)
                        }

                        Button(
                            onClick = {
                                val finalLoc = ZmanimLocation(
                                    id = "custom_${System.currentTimeMillis()}",
                                    name = locationName,
                                    latitude = selectedLatLng.latitude,
                                    longitude = selectedLatLng.longitude,
                                    timeZoneId = detectedTz,
                                    isCustom = true
                                )
                                onLocationSelected(finalLoc)
                            },
                            modifier = Modifier
                                .weight(1f)
                                .height(44.dp),
                            shape = RoundedCornerShape(10.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Primary)
                        ) {
                            Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(18.dp))
                            Spacer(Modifier.width(6.dp))
                            Text("הצג זמנים", fontSize = 14.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }

    if (showSaveDialog) {
        var customName by remember { mutableStateOf(locationName) }
        AlertDialog(
            onDismissRequest = { showSaveDialog = false },
            title = {
                Text(
                    "שמירת מיקום חדש",
                    fontWeight = FontWeight.Bold,
                    color = Primary,
                    fontSize = 18.sp
                )
            },
            text = {
                Column {
                    Text("הזן שם עבור המיקום לשמירה במועדפים:", fontSize = 14.sp, color = Muted)
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = customName,
                        onValueChange = { customName = it },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                Button(
                    onClick = {
                        val nameToSave = customName.trim().ifEmpty { locationName }
                        val savedLoc = ZmanimLocation(
                            id = "saved_${UUID.randomUUID()}",
                            name = nameToSave,
                            latitude = selectedLatLng.latitude,
                            longitude = selectedLatLng.longitude,
                            timeZoneId = detectedTz,
                            isCustom = true
                        )
                        ZmanimLocationRepository.saveCustomLocation(context, savedLoc)
                        showSaveDialog = false
                        scope.launch {
                            snackbarHostState.showSnackbar("המיקום '$nameToSave' נשמר בהצלחה!")
                        }
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Primary)
                ) {
                    Text("שמור")
                }
            },
            dismissButton = {
                TextButton(onClick = { showSaveDialog = false }) {
                    Text("ביטול", color = Muted)
                }
            },
            containerColor = Color(0xFFFDFBF7)
        )
    }
}

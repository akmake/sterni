package com.sterni.dailystudy.ui.screens.tools

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.location.Location
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.*
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.google.android.gms.location.LocationServices
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.Muted
import com.sterni.dailystudy.ui.theme.Primary
import com.sterni.dailystudy.ui.theme.SblHebrew
import kotlin.math.*

// Jerusalem coordinates
private const val JERUSALEM_LAT = 31.7767
private const val JERUSALEM_LNG = 35.2345

// Default center of Israel when no GPS
private const val ISRAEL_CENTER_LAT = 31.5
private const val ISRAEL_CENTER_LNG = 35.0

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun JerusalemDirectionScreen(onBack: () -> Unit) {
    val context = LocalContext.current

    // Compass heading from sensors (degrees from magnetic north, 0-360)
    var compassHeading by remember { mutableFloatStateOf(0f) }
    // Bearing to Jerusalem from current location (degrees from north, 0-360)
    var bearingToJerusalem by remember { mutableFloatStateOf(bearingToJerusalem(ISRAEL_CENTER_LAT, ISRAEL_CENTER_LNG)) }
    var locationName by remember { mutableStateOf("מרכז ישראל (ברירת מחדל)") }
    var hasLocation by remember { mutableStateOf(false) }
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasLocationPermission = granted
    }

    // Register compass sensor
    DisposableEffect(Unit) {
        val sm = context.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val rotSensor = sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
            ?: sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

        val listener = object : SensorEventListener {
            private val rotMatrix   = FloatArray(9)
            private val orientation = FloatArray(3)

            override fun onSensorChanged(event: SensorEvent) {
                if (event.sensor.type == Sensor.TYPE_ROTATION_VECTOR) {
                    SensorManager.getRotationMatrixFromVector(rotMatrix, event.values)
                    SensorManager.getOrientation(rotMatrix, orientation)
                    val azimuth = Math.toDegrees(orientation[0].toDouble()).toFloat()
                    compassHeading = (azimuth + 360f) % 360f
                } else if (event.sensor.type == Sensor.TYPE_MAGNETIC_FIELD) {
                    compassHeading = (event.values[0] + 360f) % 360f
                }
            }

            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}
        }

        rotSensor?.let {
            sm.registerListener(listener, it, SensorManager.SENSOR_DELAY_UI)
        }

        onDispose {
            sm.unregisterListener(listener)
        }
    }

    // Get GPS location for accurate bearing
    LaunchedEffect(hasLocationPermission) {
        if (hasLocationPermission) {
            try {
                val fusedClient = LocationServices.getFusedLocationProviderClient(context)
                fusedClient.lastLocation.addOnSuccessListener { loc: Location? ->
                    if (loc != null) {
                        bearingToJerusalem = bearingToJerusalem(loc.latitude, loc.longitude)
                        hasLocation = true
                        locationName = "מיקום GPS"
                    }
                }
            } catch (e: SecurityException) {
                // Permission revoked while running
            }
        }
    }

    // Smooth rotation animation
    val animatedArrowAngle by animateFloatAsState(
        targetValue = (bearingToJerusalem - compassHeading + 360f) % 360f,
        animationSpec = spring(dampingRatio = Spring.DampingRatioMediumBouncy, stiffness = Spring.StiffnessLow),
        label = "arrowAngle"
    )

    Scaffold(
        containerColor = Color(0xFFFDFBF7),
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "כיוון ירושלים",
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
        Column(
            modifier            = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(24.dp, Alignment.CenterVertically)
        ) {

            Text(
                text       = "כוון את הטלפון ולחץ לאישור מיקום",
                fontSize   = 14.sp,
                fontFamily = SblHebrew,
                color      = Muted,
                textAlign  = TextAlign.Center
            )

            // Compass circle + arrow
            Surface(
                shape    = CircleShape,
                color    = Color.White,
                modifier = Modifier.size(280.dp),
                shadowElevation = 6.dp
            ) {
                Box(contentAlignment = Alignment.Center, modifier = Modifier.fillMaxSize()) {
                    Canvas(modifier = Modifier.size(260.dp)) {
                        drawCompassRose(this)
                        rotate(animatedArrowAngle, pivot = center) {
                            drawJerusalemArrow(this)
                        }
                    }
                }
            }

            // Direction label
            Surface(
                shape = RoundedCornerShape(14.dp),
                color = Primary.copy(alpha = 0.08f)
            ) {
                Column(
                    modifier            = Modifier.padding(horizontal = 20.dp, vertical = 14.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(4.dp)
                ) {
                    Text(
                        text       = "ירושלים עיר הקודש",
                        fontSize   = 18.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = BaHaYetzira,
                        color      = Primary,
                        textAlign  = TextAlign.Center
                    )
                    Text(
                        text       = "מיקום: $locationName",
                        fontSize   = 12.sp,
                        fontFamily = SblHebrew,
                        color      = Muted,
                        textAlign  = TextAlign.Center
                    )
                    Text(
                        text       = "כיוון: ${animatedArrowAngle.toInt()}°",
                        fontSize   = 12.sp,
                        fontFamily = SblHebrew,
                        color      = Muted,
                        textAlign  = TextAlign.Center
                    )
                }
            }

            if (!hasLocationPermission) {
                Button(
                    onClick = { permLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION) },
                    colors  = ButtonDefaults.buttonColors(containerColor = Primary),
                    shape   = RoundedCornerShape(12.dp)
                ) {
                    Text("שפר דיוק עם GPS", fontFamily = SblHebrew, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

// Draw compass rose (N/S/E/W labels + tick marks)
private fun drawCompassRose(scope: DrawScope) {
    val cx = scope.size.width / 2f
    val cy = scope.size.height / 2f
    val r  = scope.size.minDimension / 2f - 10f
    val trackColor = Color(0xFFE4E4E7)

    // Outer ring
    scope.drawCircle(color = trackColor, radius = r, center = Offset(cx, cy), style = androidx.compose.ui.graphics.drawscope.Stroke(width = 2f))

    // Tick marks every 30°
    for (i in 0 until 12) {
        val angle = Math.toRadians((i * 30).toDouble())
        val inner = if (i % 3 == 0) r - 14f else r - 8f
        val x1 = cx + r * sin(angle).toFloat()
        val y1 = cy - r * cos(angle).toFloat()
        val x2 = cx + inner * sin(angle).toFloat()
        val y2 = cy - inner * cos(angle).toFloat()
        scope.drawLine(color = trackColor, start = Offset(x1, y1), end = Offset(x2, y2), strokeWidth = if (i % 3 == 0) 3f else 1.5f)
    }
}

// Draw arrow pointing toward Jerusalem
private fun drawJerusalemArrow(scope: DrawScope) {
    val cx = scope.size.width / 2f
    val cy = scope.size.height / 2f
    val arrowLen  = scope.size.minDimension / 2f - 20f
    val arrowTip  = Offset(cx, cy - arrowLen)
    val arrowBase = Offset(cx, cy + arrowLen * 0.35f)
    val wingW = 18f

    // Arrow head
    val headPath = Path().apply {
        moveTo(arrowTip.x, arrowTip.y)
        lineTo(arrowTip.x - wingW, arrowTip.y + wingW * 2f)
        lineTo(arrowTip.x, arrowTip.y + wingW * 1.2f)
        lineTo(arrowTip.x + wingW, arrowTip.y + wingW * 2f)
        close()
    }
    scope.drawPath(path = headPath, color = Primary)

    // Arrow shaft
    scope.drawLine(
        color       = Primary.copy(alpha = 0.6f),
        start       = Offset(cx, arrowTip.y + wingW * 1.2f),
        end         = arrowBase,
        strokeWidth = 6f
    )

    // Center dot
    scope.drawCircle(color = Color.White, radius = 8f, center = Offset(cx, cy))
    scope.drawCircle(color = Primary, radius = 5f, center = Offset(cx, cy))
}

// Calculate bearing (degrees, 0=north) from (lat1,lon1) to Jerusalem
private fun bearingToJerusalem(lat1: Double, lon1: Double): Float {
    val lat2 = JERUSALEM_LAT
    val lon2 = JERUSALEM_LNG
    val dLon = Math.toRadians(lon2 - lon1)
    val φ1   = Math.toRadians(lat1)
    val φ2   = Math.toRadians(lat2)
    val y    = sin(dLon) * cos(φ2)
    val x    = cos(φ1) * sin(φ2) - sin(φ1) * cos(φ2) * cos(dLon)
    return ((Math.toDegrees(atan2(y, x)).toFloat() + 360f) % 360f)
}

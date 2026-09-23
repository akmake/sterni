package com.sterni.dailystudy.ui.screens.zmanim

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.android.gms.location.LocationServices
import com.google.gson.Gson
import com.sterni.dailystudy.alarm.AlarmConfig
import com.sterni.dailystudy.alarm.ZmanimAlarmReceiver
import com.sterni.dailystudy.util.HebrewDate
import com.sterni.dailystudy.zmanim.CalculatedZman
import com.sterni.dailystudy.zmanim.ChabadZmanimCalculator
import com.sterni.dailystudy.zmanim.ZmanimLocation
import com.sterni.dailystudy.zmanim.ZmanimLocationDefaults
import com.sterni.dailystudy.zmanim.ZmanimLocationRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.*

data class ZmanimState(
    val loading: Boolean = false,
    val zmanim: List<CalculatedZman> = emptyList(),
    val error: String? = null,
    val date: String = HebrewDate.today(),
    val selectedLocation: ZmanimLocation = ZmanimLocationDefaults.JERUSALEM,
    val allLocations: List<ZmanimLocation> = emptyList(),
    val compareLocation: ZmanimLocation? = null,
    val dualClockEnabled: Boolean = false,
    val compareZmanim: List<CalculatedZman> = emptyList(),
    val alarms: Map<String, AlarmConfig> = emptyMap()
)

class ZmanimViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(ZmanimState())
    val state = _state.asStateFlow()

    private val alarmPrefs = application.getSharedPreferences("ZmanimAlarms", Context.MODE_PRIVATE)
    private val gson = Gson()

    init {
        loadLocationsAndCalculate()
        loadAlarms()
        autoDetectGpsLocation()
    }

    fun refresh() {
        loadLocationsAndCalculate()
    }

    private fun loadLocationsAndCalculate() {
        val ctx = getApplication<Application>()
        val allLocs = ZmanimLocationRepository.getAllLocations(ctx)
        val selectedId = ZmanimLocationRepository.getSelectedLocationId(ctx)
        val selected = allLocs.find { it.id == selectedId } ?: allLocs.firstOrNull() ?: ZmanimLocationDefaults.JERUSALEM

        val dualEnabled = ZmanimLocationRepository.isDualClockEnabled(ctx)
        val compareId = ZmanimLocationRepository.getCompareLocationId(ctx)
        val compareLoc = allLocs.find { it.id == compareId } ?: ZmanimLocationDefaults.CROWN_HEIGHTS

        _state.value = _state.value.copy(
            selectedLocation = selected,
            allLocations = allLocs,
            dualClockEnabled = dualEnabled,
            compareLocation = compareLoc
        )
        recalculate()
    }

    private fun autoDetectGpsLocation() {
        val ctx = getApplication<Application>()
        if (ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) return

        try {
            val fusedClient = LocationServices.getFusedLocationProviderClient(ctx)
            fusedClient.lastLocation.addOnSuccessListener { loc: Location? ->
                if (loc == null) return@addOnSuccessListener
                viewModelScope.launch(Dispatchers.IO) {
                    val tz = ZmanimLocationRepository.detectTimeZone(ctx, loc.latitude, loc.longitude)
                    var locName = "מיקום נוכחי"
                    try {
                        val geocoder = Geocoder(ctx, Locale("he"))
                        @Suppress("DEPRECATION")
                        val addrs = geocoder.getFromLocation(loc.latitude, loc.longitude, 1)
                        val addr = addrs?.firstOrNull()
                        val city = addr?.locality ?: addr?.subAdminArea ?: addr?.adminArea
                        if (city != null) {
                            locName = "המיקום שלי ($city)"
                        }
                    } catch (_: Exception) {}

                    val gpsLoc = ZmanimLocation(
                        id = "gps",
                        name = locName,
                        latitude = loc.latitude,
                        longitude = loc.longitude,
                        timeZoneId = tz,
                        isCurrentGps = true
                    )
                    ZmanimLocationRepository.saveLastGpsLocation(ctx, gpsLoc)

                    withContext(Dispatchers.Main) {
                        val currentSelectedId = ZmanimLocationRepository.getSelectedLocationId(ctx)
                        val allLocs = ZmanimLocationRepository.getAllLocations(ctx)
                        val selected = if (currentSelectedId == "gps") gpsLoc else _state.value.selectedLocation
                        _state.value = _state.value.copy(
                            selectedLocation = selected,
                            allLocations = allLocs
                        )
                        recalculate()
                    }
                }
            }
        } catch (_: Exception) {}
    }

    fun selectLocation(location: ZmanimLocation) {
        val ctx = getApplication<Application>()
        ZmanimLocationRepository.setSelectedLocationId(ctx, location.id)
        if (location.isCustom) {
            ZmanimLocationRepository.saveCustomLocation(ctx, location)
        }
        val allLocs = ZmanimLocationRepository.getAllLocations(ctx)
        _state.value = _state.value.copy(
            selectedLocation = location,
            allLocations = allLocs
        )
        recalculate()
    }

    fun deleteCustomLocation(id: String) {
        val ctx = getApplication<Application>()
        ZmanimLocationRepository.removeCustomLocation(ctx, id)
        loadLocationsAndCalculate()
    }

    fun toggleDualClock() {
        val ctx = getApplication<Application>()
        val next = !_state.value.dualClockEnabled
        ZmanimLocationRepository.setDualClockEnabled(ctx, next)
        _state.value = _state.value.copy(dualClockEnabled = next)
        recalculate()
    }

    fun setCompareLocation(location: ZmanimLocation) {
        val ctx = getApplication<Application>()
        ZmanimLocationRepository.setCompareLocationId(ctx, location.id)
        _state.value = _state.value.copy(compareLocation = location)
        recalculate()
    }

    fun shiftDate(days: Int) {
        val newDate = HebrewDate.shift(_state.value.date, days)
        _state.value = _state.value.copy(date = newDate)
        recalculate()
    }

    fun setDate(isoDate: String) {
        _state.value = _state.value.copy(date = isoDate)
        recalculate()
    }

    private fun recalculate() {
        val snap = _state.value
        val zmanim = ChabadZmanimCalculator.calculateZmanim(snap.date, snap.selectedLocation)
        val compareZmanim = if (snap.dualClockEnabled && snap.compareLocation != null) {
            ChabadZmanimCalculator.calculateZmanim(snap.date, snap.compareLocation)
        } else {
            emptyList()
        }

        _state.value = snap.copy(
            loading = false,
            zmanim = zmanim,
            compareZmanim = compareZmanim,
            error = null
        )
    }

    fun scheduleAlarm(zman: CalculatedZman, config: AlarmConfig): Boolean {
        val ctx = getApplication<Application>()
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            return false
        }

        val offsetMs = config.offsetMinutes * 60_000L
        var alarmMs = if (config.isBefore) zman.timeMillis - offsetMs else zman.timeMillis + offsetMs

        if (alarmMs <= System.currentTimeMillis()) {
            val tomorrowIso = HebrewDate.shift(HebrewDate.today(), 1)
            val tomorrowZmanim = ChabadZmanimCalculator.calculateZmanim(tomorrowIso, _state.value.selectedLocation)
            val tomorrowZman = tomorrowZmanim.find { it.type == zman.type || it.label == zman.label }
            if (tomorrowZman != null && tomorrowZman.timeMillis > 0L) {
                val nextAlarmMs = if (config.isBefore) tomorrowZman.timeMillis - offsetMs else tomorrowZman.timeMillis + offsetMs
                if (nextAlarmMs > System.currentTimeMillis()) {
                    alarmMs = nextAlarmMs
                }
            } else {
                alarmMs += 24 * 60 * 60 * 1000L
            }
        }

        val intent = Intent(ctx, ZmanimAlarmReceiver::class.java).apply {
            putExtra(ZmanimAlarmReceiver.EXTRA_ZMAN_LABEL,    zman.label)
            putExtra(ZmanimAlarmReceiver.EXTRA_RING_COUNT,    config.ringCount)
            putExtra(ZmanimAlarmReceiver.EXTRA_RING_DURATION, config.ringDurationSeconds)
            putExtra(ZmanimAlarmReceiver.EXTRA_RINGTONE_URI,  config.ringtoneUri)
        }
        val pi = PendingIntent.getBroadcast(
            ctx, zman.label.hashCode(), intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        return try {
            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, alarmMs, pi)
            alarmPrefs.edit().putString("alarm_${zman.label}", gson.toJson(config)).apply()
            _state.value = _state.value.copy(
                alarms = _state.value.alarms.toMutableMap().also { it[zman.label] = config }
            )
            true
        } catch (_: SecurityException) { false }
    }

    fun cancelAlarm(zmanLabel: String) {
        val ctx = getApplication<Application>()
        val am  = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi  = PendingIntent.getBroadcast(
            ctx, zmanLabel.hashCode(),
            Intent(ctx, ZmanimAlarmReceiver::class.java),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_NO_CREATE
        )
        pi?.let { am.cancel(it); it.cancel() }
        alarmPrefs.edit().remove("alarm_${zmanLabel}").apply()
        _state.value = _state.value.copy(
            alarms = _state.value.alarms.toMutableMap().also { it.remove(zmanLabel) }
        )
    }

    private fun loadAlarms() {
        val alarms = alarmPrefs.all
            .filterKeys { it.startsWith("alarm_") }
            .mapNotNull { (_, v) ->
                try { gson.fromJson(v as String, AlarmConfig::class.java) } catch (_: Exception) { null }
            }
            .associateBy { it.zmanLabel }
        _state.value = _state.value.copy(alarms = alarms)
    }
}

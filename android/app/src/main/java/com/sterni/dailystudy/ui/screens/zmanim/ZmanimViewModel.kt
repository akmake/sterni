package com.sterni.dailystudy.ui.screens.zmanim

import android.app.AlarmManager
import android.app.Application
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sterni.dailystudy.alarm.AlarmConfig
import com.sterni.dailystudy.alarm.ZmanimAlarmReceiver
import com.sterni.dailystudy.data.api.RetrofitClient
import com.sterni.dailystudy.data.api.ZmanDto
import com.sterni.dailystudy.data.api.ZmanimDay
import com.sterni.dailystudy.util.HebrewDate
import com.google.android.gms.location.LocationServices
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.util.*
import kotlin.math.*

data class ZmanEntry(val label: String, val time: String, val timeMillis: Long)

data class ZmanimState(
    val loading: Boolean = true,
    val zmanim: List<ZmanEntry> = emptyList(),
    val error: String? = null,
    val date: String = HebrewDate.today(),
    val selectedCity: Int = 0,
    val alarms: Map<String, AlarmConfig> = emptyMap(),
    val syncing: Boolean = false
)

private data class CityInfo(val name: String, val locationId: Int, val lat: Double, val lng: Double)

private val ZMANIM_ORDER = listOf(
    "AlosHashachar"    to "עלות השחר",
    "EarliestTefillin" to "משיכיר",
    "NetzHachamah"     to "הנץ החמה",
    "LatestShema"      to "סוף זמן ק\"ש",
    "LatestTefillah"   to "סוף זמן תפילה",
    "Chatzos"          to "חצות היום",
    "MinchahGedolah"   to "מנחה גדולה",
    "MinchahKetanah"   to "מנחה קטנה",
    "PlagHaminchah"    to "פלג המנחה",
    "CandleLighting"   to "הדלקת נרות",
    "Shkiah"           to "שקיעת החמה",
    "Tzeis"            to "צאת הכוכבים",
    "ChatzosNight"     to "חצות הלילה",
)

class ZmanimViewModel(application: Application) : AndroidViewModel(application) {
    private val _state = MutableStateFlow(ZmanimState())
    val state = _state.asStateFlow()

    val cityNames = listOf("תל אביב", "ירושלים", "חיפה", "באר שבע")

    private val cityInfos = listOf(
        CityInfo("תל אביב", 531, 32.0853, 34.7818),
        CityInfo("ירושלים", 247, 31.7683, 35.2137),
        CityInfo("חיפה",    689, 32.7940, 34.9896),
        CityInfo("באר שבע", 688, 31.2530, 34.7915)
    )

    private val alarmPrefs = application.getSharedPreferences("ZmanimAlarms", Context.MODE_PRIVATE)
    private val gson       = Gson()
    private val cacheDir   = File(application.filesDir, "zmanim_cache").also { it.mkdirs() }

    // In-memory: locationId → (date → zmanim list)
    private val memCache = mutableMapOf<Int, MutableMap<String, List<ZmanDto>>>()

    init {
        val savedCity = application.getSharedPreferences("ZmanimPrefs", Context.MODE_PRIVATE)
            .getInt("selected_city", 0).coerceIn(0, cityInfos.lastIndex)
        if (savedCity != 0) _state.value = _state.value.copy(selectedCity = savedCity)
        loadAlarms()
        autoDetectCity()
        viewModelScope.launch(Dispatchers.IO) {
            loadFileCacheIntoMemory()
            withContext(Dispatchers.Main) { fetch() }
            syncMissingCities()
        }
    }

    private fun autoDetectCity() {
        val ctx = getApplication<Application>()
        if (ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.ACCESS_COARSE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) return

        try {
            val fusedClient = LocationServices.getFusedLocationProviderClient(ctx)
            fusedClient.lastLocation.addOnSuccessListener { loc: Location? ->
                if (loc == null) return@addOnSuccessListener
                val nearest = cityInfos.indices.minByOrNull { i ->
                    haversineKm(loc.latitude, loc.longitude, cityInfos[i].lat, cityInfos[i].lng)
                } ?: return@addOnSuccessListener
                if (nearest != _state.value.selectedCity) {
                    selectCity(nearest)
                }
            }
        } catch (_: Exception) {}
    }

    private fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val r = 6371.0
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2).pow(2) + cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) * sin(dLon / 2).pow(2)
        return r * 2 * asin(sqrt(a))
    }

    fun selectCity(idx: Int) {
        _state.value = _state.value.copy(selectedCity = idx, loading = true, error = null)
        getApplication<Application>()
            .getSharedPreferences("ZmanimPrefs", Context.MODE_PRIVATE)
            .edit().putInt("selected_city", idx).apply()
        fetch()
    }

    fun shiftDate(days: Int) {
        _state.value = _state.value.copy(
            date = HebrewDate.shift(_state.value.date, days),
            loading = true, error = null
        )
        fetch()
    }

    fun scheduleAlarm(zman: ZmanEntry, config: AlarmConfig): Boolean {
        val ctx = getApplication<Application>()
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
            return false
        }

        val offsetMs = config.offsetMinutes * 60_000L
        var alarmMs  = if (config.isBefore) zman.timeMillis - offsetMs else zman.timeMillis + offsetMs

        if (alarmMs <= System.currentTimeMillis()) {
            val tomorrowMs = findZmanMillisForTomorrow(zman.label)
            if (tomorrowMs > 0L) {
                val nextAlarmMs = if (config.isBefore) tomorrowMs - offsetMs else tomorrowMs + offsetMs
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

    private fun findZmanMillisForTomorrow(zmanLabel: String): Long {
        val type = ZMANIM_ORDER.firstOrNull { it.second == zmanLabel }?.first ?: return 0L
        val cityInfo = cityInfos[_state.value.selectedCity]
        val tomorrow = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem")).apply {
            add(Calendar.DAY_OF_YEAR, 1)
        }
        val tomorrowStr = "%04d-%02d-%02d".format(
            tomorrow.get(Calendar.YEAR),
            tomorrow.get(Calendar.MONTH) + 1,
            tomorrow.get(Calendar.DAY_OF_MONTH)
        )
        val dayZmanim = synchronized(memCache) {
            memCache[cityInfo.locationId]?.get(tomorrowStr)
        } ?: return 0L
        val dto = dayZmanim.find { it.type == type } ?: return 0L
        return timeStringToMillis(tomorrowStr, dto.time)
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

    private fun loadFileCacheIntoMemory() {
        val listType = object : TypeToken<List<ZmanimDay>>() {}.type
        cityInfos.forEach { city ->
            val file = File(cacheDir, "city_${city.locationId}.json")
            if (!file.exists()) return@forEach
            try {
                val days: List<ZmanimDay> = gson.fromJson(file.readText(), listType) ?: return@forEach
                val map = days.associate { it.date to it.zmanim }.toMutableMap()
                synchronized(memCache) { memCache[city.locationId] = map }
            } catch (_: Exception) {}
        }
    }

    private suspend fun downloadCity(locationId: Int, year: Int) {
        try {
            val days = RetrofitClient.zmanimService.getZmanim(
                locationId = locationId,
                from       = "$year-01-01",
                to         = "$year-12-31"
            )
            val incoming = days.associate { it.date to it.zmanim }
            synchronized(memCache) {
                val existing = memCache.getOrPut(locationId) { mutableMapOf() }
                existing.putAll(incoming)
            }
            val allDays = synchronized(memCache) {
                memCache[locationId]?.map { (d, z) -> ZmanimDay(d, z) } ?: emptyList()
            }
            File(cacheDir, "city_$locationId.json").writeText(gson.toJson(allDays))
        } catch (_: Exception) {}
    }

    private fun hasCacheForYear(locationId: Int, year: Int): Boolean =
        synchronized(memCache) {
            memCache[locationId]?.keys?.any { it.startsWith("$year-") } == true
        }

    private suspend fun syncMissingCities() {
        val year = Calendar.getInstance().get(Calendar.YEAR)
        val missing = cityInfos.filter { !hasCacheForYear(it.locationId, year) }
        if (missing.isEmpty()) return

        withContext(Dispatchers.Main) {
            _state.value = _state.value.copy(syncing = true)
        }
        missing.forEach { city ->
            downloadCity(city.locationId, year)
        }
        withContext(Dispatchers.Main) {
            _state.value = _state.value.copy(syncing = false)
            fetch()
        }
    }

    private fun fetch() {
        val snap     = _state.value
        val cityInfo = cityInfos[snap.selectedCity]
        val date     = snap.date

        val dayZmanim = synchronized(memCache) {
            memCache[cityInfo.locationId]?.get(date)
        }

        if (dayZmanim != null) {
            val byType  = dayZmanim.associateBy { it.type }
            val entries = ZMANIM_ORDER.mapNotNull { (type, label) ->
                val dto = byType[type] ?: return@mapNotNull null
                ZmanEntry(label, dto.time, timeStringToMillis(date, dto.time))
            }
            _state.value = snap.copy(loading = false, zmanim = entries, error = null)
        } else {
            _state.value = snap.copy(loading = true)
            viewModelScope.launch(Dispatchers.IO) {
                downloadCity(cityInfo.locationId, date.substring(0, 4).toInt())
                withContext(Dispatchers.Main) { fetch() }
            }
        }
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

    private fun timeStringToMillis(isoDate: String, timeStr: String): Long {
        return try {
            val (year, month, day) = isoDate.split("-").map { it.toInt() }
            val parts  = timeStr.split(":")
            val hour   = parts[0].toInt()
            val minute = parts[1].toInt()
            Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem")).apply {
                set(year, month - 1, day, hour, minute, 0)
                set(Calendar.MILLISECOND, 0)
            }.timeInMillis
        } catch (_: Exception) { 0L }
    }
}

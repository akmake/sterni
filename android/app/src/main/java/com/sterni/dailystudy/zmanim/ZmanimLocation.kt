package com.sterni.dailystudy.zmanim

import android.content.Context
import android.location.Geocoder
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.Locale
import java.util.TimeZone

data class ZmanimLocation(
    val id: String,
    val name: String,
    val latitude: Double,
    val longitude: Double,
    val timeZoneId: String,
    val isCustom: Boolean = false,
    val isCurrentGps: Boolean = false
) {
    fun getTimeZone(): TimeZone {
        return try {
            TimeZone.getTimeZone(timeZoneId)
        } catch (_: Exception) {
            TimeZone.getDefault()
        }
    }
}

object ZmanimLocationDefaults {
    val JERUSALEM = ZmanimLocation(
        id = "jerusalem",
        name = "ירושלים",
        latitude = 31.7683,
        longitude = 35.2137,
        timeZoneId = "Asia/Jerusalem"
    )

    val CROWN_HEIGHTS = ZmanimLocation(
        id = "770",
        name = "770 קראון הייטס",
        latitude = 40.6689,
        longitude = -73.9427,
        timeZoneId = "America/New_York"
    )

    val TEL_AVIV = ZmanimLocation(
        id = "tel_aviv",
        name = "תל אביב",
        latitude = 32.0853,
        longitude = 34.7818,
        timeZoneId = "Asia/Jerusalem"
    )

    val KFAR_CHABAD = ZmanimLocation(
        id = "kfar_chabad",
        name = "כפר חב\"ד",
        latitude = 31.9930,
        longitude = 34.8530,
        timeZoneId = "Asia/Jerusalem"
    )

    val HAIFA = ZmanimLocation(
        id = "haifa",
        name = "חיפה",
        latitude = 32.7940,
        longitude = 34.9896,
        timeZoneId = "Asia/Jerusalem"
    )

    val BEER_SHEVA = ZmanimLocation(
        id = "beer_sheva",
        name = "באר שבע",
        latitude = 31.2530,
        longitude = 34.7915,
        timeZoneId = "Asia/Jerusalem"
    )

    val DEFAULT_LIST = listOf(
        JERUSALEM,
        CROWN_HEIGHTS,
        TEL_AVIV,
        KFAR_CHABAD,
        HAIFA,
        BEER_SHEVA
    )
}

object ZmanimLocationRepository {
    private const val PREFS_NAME = "ZmanimLocationPrefs"
    private const val KEY_CUSTOM_LOCATIONS = "custom_locations"
    private const val KEY_SELECTED_ID = "selected_location_id"
    private const val KEY_GPS_LOCATION = "last_gps_location"
    private const val KEY_DUAL_CLOCK_ENABLED = "dual_clock_enabled"
    private const val KEY_COMPARE_ID = "compare_location_id"

    private val gson = Gson()

    fun getSelectedLocationId(context: Context): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_SELECTED_ID, "gps") ?: "gps"
    }

    fun setSelectedLocationId(context: Context, id: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_SELECTED_ID, id)
            .apply()
    }

    fun isDualClockEnabled(context: Context): Boolean {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getBoolean(KEY_DUAL_CLOCK_ENABLED, false)
    }

    fun setDualClockEnabled(context: Context, enabled: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(KEY_DUAL_CLOCK_ENABLED, enabled)
            .apply()
    }

    fun getCompareLocationId(context: Context): String {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_COMPARE_ID, "770") ?: "770"
    }

    fun setCompareLocationId(context: Context, id: String) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_COMPARE_ID, id)
            .apply()
    }

    fun saveLastGpsLocation(context: Context, location: ZmanimLocation) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_GPS_LOCATION, gson.toJson(location))
            .apply()
    }

    fun getLastGpsLocation(context: Context): ZmanimLocation? {
        val json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_GPS_LOCATION, null) ?: return null
        return try {
            gson.fromJson(json, ZmanimLocation::class.java)
        } catch (_: Exception) {
            null
        }
    }

    fun getCustomLocations(context: Context): List<ZmanimLocation> {
        val json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_CUSTOM_LOCATIONS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<ZmanimLocation>>() {}.type
            gson.fromJson(json, type) ?: emptyList()
        } catch (_: Exception) {
            emptyList()
        }
    }

    fun saveCustomLocation(context: Context, location: ZmanimLocation) {
        val current = getCustomLocations(context).toMutableList()
        current.removeAll { it.id == location.id }
        current.add(location)
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_CUSTOM_LOCATIONS, gson.toJson(current))
            .apply()
    }

    fun removeCustomLocation(context: Context, id: String) {
        val current = getCustomLocations(context).toMutableList()
        current.removeAll { it.id == id }
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_CUSTOM_LOCATIONS, gson.toJson(current))
            .apply()
    }

    fun getAllLocations(context: Context): List<ZmanimLocation> {
        val list = mutableListOf<ZmanimLocation>()
        val gps = getLastGpsLocation(context) ?: ZmanimLocation(
            id = "gps",
            name = "מיקום נוכחי",
            latitude = ZmanimLocationDefaults.JERUSALEM.latitude,
            longitude = ZmanimLocationDefaults.JERUSALEM.longitude,
            timeZoneId = "Asia/Jerusalem",
            isCurrentGps = true
        )
        list.add(gps.copy(isCurrentGps = true, id = "gps"))
        list.addAll(ZmanimLocationDefaults.DEFAULT_LIST)
        list.addAll(getCustomLocations(context))
        return list
    }

    fun findLocationById(context: Context, id: String): ZmanimLocation {
        return getAllLocations(context).find { it.id == id }
            ?: ZmanimLocationDefaults.JERUSALEM
    }

    /**
     * Guess timezone from coordinates using geographic bounding boxes or standard offsets.
     */
    fun detectTimeZone(context: Context?, lat: Double, lng: Double): String {
        // 1. Israel
        if (lat in 29.4..33.5 && lng in 34.2..35.9) {
            return "Asia/Jerusalem"
        }
        // 2. New York / Eastern US
        if (lat in 38.0..45.0 && lng in -80.0..-70.0) {
            return "America/New_York"
        }
        // 3. Central US (Chicago etc.)
        if (lat in 28.0..49.0 && lng in -100.0..-85.0) {
            return "America/Chicago"
        }
        // 4. Western US (California)
        if (lat in 32.0..42.0 && lng in -125.0..-114.0) {
            return "America/Los_Angeles"
        }
        // 5. UK
        if (lat in 49.8..60.0 && lng in -8.0..2.0) {
            return "Europe/London"
        }
        // 6. France / Western Europe
        if (lat in 42.0..51.5 && lng in -5.0..8.5) {
            return "Europe/Paris"
        }
        // 7. Ukraine / Russia European part
        if (lat in 44.0..56.0 && lng in 22.0..40.0) {
            return "Europe/Kyiv"
        }
        // 8. Argentina / Buenos Aires
        if (lat in -40.0..-20.0 && lng in -70.0..-50.0) {
            return "America/Argentina/Buenos_Aires"
        }
        // 9. Australia (Melbourne/Sydney)
        if (lat in -40.0..-30.0 && lng in 140.0..155.0) {
            return "Australia/Melbourne"
        }
        // 10. South Africa
        if (lat in -35.0..-22.0 && lng in 16.0..33.0) {
            return "Africa/Johannesburg"
        }

        // Try Geocoder if context available
        if (context != null) {
            try {
                val geocoder = Geocoder(context, Locale.ENGLISH)
                @Suppress("DEPRECATION")
                val addresses = geocoder.getFromLocation(lat, lng, 1)
                val countryCode = addresses?.firstOrNull()?.countryCode
                if (countryCode != null) {
                    when (countryCode.uppercase()) {
                        "IL" -> return "Asia/Jerusalem"
                        "US" -> return if (lng < -115) "America/Los_Angeles" else if (lng < -95) "America/Denver" else if (lng < -85) "America/Chicago" else "America/New_York"
                        "GB" -> return "Europe/London"
                        "FR" -> return "Europe/Paris"
                        "RU" -> return "Europe/Moscow"
                        "UA" -> return "Europe/Kyiv"
                        "AR" -> return "America/Argentina/Buenos_Aires"
                        "AU" -> return "Australia/Melbourne"
                        "ZA" -> return "Africa/Johannesburg"
                        "CA" -> return if (lng < -100) "America/Vancouver" else "America/Toronto"
                    }
                }
            } catch (_: Exception) {}
        }

        // Longitude estimation fallback
        val rawOffsetHours = Math.round(lng / 15.0).toInt().coerceIn(-12, 14)
        return if (rawOffsetHours >= 0) "GMT+$rawOffsetHours" else "GMT$rawOffsetHours"
    }
}

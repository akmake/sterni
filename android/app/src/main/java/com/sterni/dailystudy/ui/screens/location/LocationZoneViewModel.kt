package com.sterni.dailystudy.ui.screens.location

import android.app.Application
import android.content.Context
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import androidx.lifecycle.AndroidViewModel
import com.sterni.dailystudy.geofence.GeofenceCheckWorker
import com.sterni.dailystudy.geofence.GeofenceHelper
import com.sterni.dailystudy.geofence.GeofenceReceiver
import com.sterni.dailystudy.geofence.SilentZone
import com.sterni.dailystudy.geofence.distanceBetween
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.maps.model.LatLng
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class LocationZoneState(
    val zones: List<SilentZone> = emptyList(),
    val hasDndPermission: Boolean = false,
    val hasLocationPermission: Boolean = false
)

class LocationZoneViewModel(app: Application) : AndroidViewModel(app) {
    private val ctx   = app.applicationContext
    private val prefs = ctx.getSharedPreferences("LocationZones", Context.MODE_PRIVATE)
    private val gson  = Gson()
    private val geofencingClient = LocationServices.getGeofencingClient(ctx)

    private val _state = MutableStateFlow(LocationZoneState())
    val state = _state.asStateFlow()

    init { loadZones() }

    fun updatePermissions(hasDnd: Boolean, hasLocation: Boolean) {
        _state.value = _state.value.copy(hasDndPermission = hasDnd, hasLocationPermission = hasLocation)
    }

    fun addZone(name: String, latLng: LatLng, radiusMeters: Float) {
        val zone = SilentZone(
            id           = System.currentTimeMillis().toString(),
            name         = name,
            lat          = latLng.latitude,
            lng          = latLng.longitude,
            radiusMeters = radiusMeters
        )
        val updated = _state.value.zones + zone
        saveZones(updated)
        _state.value = _state.value.copy(zones = updated)

        GeofenceHelper.registerActiveGeofences(ctx)
        GeofenceCheckWorker.enqueue(ctx)
        checkCurrentLocationAgainstZones(updated.filter { it.active })
    }

    fun removeZone(id: String) {
        val updated = _state.value.zones.filter { it.id != id }
        saveZones(updated)
        _state.value = _state.value.copy(zones = updated)
        geofencingClient.removeGeofences(listOf(id))

        if (updated.none { it.active }) {
            GeofenceCheckWorker.cancel(ctx)
        }
    }

    fun toggleZone(id: String) {
        val updated = _state.value.zones.map {
            if (it.id == id) it.copy(active = !it.active) else it
        }
        saveZones(updated)
        _state.value = _state.value.copy(zones = updated)

        val allIds = updated.map { it.id }
        geofencingClient.removeGeofences(allIds).addOnCompleteListener {
            GeofenceHelper.registerActiveGeofences(ctx)
        }

        if (updated.any { it.active }) {
            GeofenceCheckWorker.enqueue(ctx)
        } else {
            GeofenceCheckWorker.cancel(ctx)
        }
    }

    fun reregisterAll() {
        val active = _state.value.zones.filter { it.active }
        if (active.isNotEmpty()) {
            GeofenceHelper.registerActiveGeofences(ctx)
            GeofenceCheckWorker.enqueue(ctx)
            checkCurrentLocationAgainstZones(active)
        }
    }

    private fun checkCurrentLocationAgainstZones(zones: List<SilentZone>) {
        if (ContextCompat.checkSelfPermission(ctx, android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) return

        val fusedClient = LocationServices.getFusedLocationProviderClient(ctx)
        fusedClient.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, null)
            .addOnSuccessListener { loc ->
                if (loc != null) {
                    val inZone = zones.any { z ->
                        distanceBetween(loc.latitude, loc.longitude, z.lat, z.lng) <= z.radiusMeters
                    }
                    val transition = if (inZone)
                        Geofence.GEOFENCE_TRANSITION_ENTER
                    else
                        Geofence.GEOFENCE_TRANSITION_EXIT
                    Log.d("GeofenceVM", "Immediate check: inZone=$inZone, triggering transition")
                    GeofenceReceiver.runMuteLogic(ctx, transition)
                }
            }
    }

    private fun saveZones(zones: List<SilentZone>) {
        prefs.edit().putString("zones", gson.toJson(zones)).apply()
    }

    private fun loadZones() {
        val json = prefs.getString("zones", null) ?: return
        val type = object : TypeToken<List<SilentZone>>() {}.type
        val zones: List<SilentZone> = try { gson.fromJson(json, type) } catch (_: Exception) { emptyList() }
        _state.value = _state.value.copy(zones = zones)
    }
}

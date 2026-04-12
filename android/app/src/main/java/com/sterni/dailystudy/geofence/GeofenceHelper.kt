package com.sterni.dailystudy.geofence

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationServices
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken

object GeofenceHelper {
    private const val TAG = "GeofenceHelper"
    private const val PREFS_NAME = "LocationZones"
    private const val KEY_ZONES = "zones"

    fun loadZones(context: Context): List<SilentZone> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(KEY_ZONES, null) ?: return emptyList()
        val type = object : TypeToken<List<SilentZone>>() {}.type
        return try { Gson().fromJson(json, type) } catch (_: Exception) { emptyList() }
    }

    fun registerActiveGeofences(context: Context) {
        if (ContextCompat.checkSelfPermission(context, android.Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED) {
            Log.w(TAG, "No location permission — skipping geofence registration")
            return
        }

        val zones = loadZones(context).filter { it.active }
        if (zones.isEmpty()) return

        val fences = zones.map { z ->
            Geofence.Builder()
                .setRequestId(z.id)
                .setCircularRegion(z.lat, z.lng, z.radiusMeters)
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setLoiteringDelay(10_000)
                .setNotificationResponsiveness(0)
                .setTransitionTypes(
                    Geofence.GEOFENCE_TRANSITION_ENTER or
                    Geofence.GEOFENCE_TRANSITION_EXIT or
                    Geofence.GEOFENCE_TRANSITION_DWELL
                )
                .build()
        }

        val req = GeofencingRequest.Builder()
            .setInitialTrigger(
                GeofencingRequest.INITIAL_TRIGGER_ENTER or GeofencingRequest.INITIAL_TRIGGER_DWELL
            )
            .addGeofences(fences)
            .build()

        try {
            val client = LocationServices.getGeofencingClient(context)
            client.addGeofences(req, getGeofencePendingIntent(context)).run {
                addOnSuccessListener { Log.d(TAG, "Registered ${fences.size} geofences") }
                addOnFailureListener { Log.e(TAG, "Failed to register geofences: ${it.message}") }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException registering geofences: ${e.message}")
        }
    }

    fun getGeofencePendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, GeofenceReceiver::class.java).apply {
            action = "com.sterni.dailystudy.ACTION_GEOFENCE_EVENT"
        }
        val flags = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        } else {
            PendingIntent.FLAG_UPDATE_CURRENT
        }
        return PendingIntent.getBroadcast(context, 0, intent, flags)
    }
}

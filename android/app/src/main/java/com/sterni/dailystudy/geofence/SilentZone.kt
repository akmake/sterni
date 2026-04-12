package com.sterni.dailystudy.geofence

data class SilentZone(
    val id: String,
    val name: String,
    val lat: Double,
    val lng: Double,
    val radiusMeters: Float = 100f,
    val active: Boolean = true
)

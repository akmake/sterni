package com.sterni.dailystudy.data.api

import retrofit2.http.GET
import retrofit2.http.Query

data class ZmanDto(val type: String, val time: String)
data class ZmanimDay(val date: String, val zmanim: List<ZmanDto>)

interface ZmanimService {
    @GET("zmanim")
    suspend fun getZmanim(
        @Query("locationId") locationId: Int,
        @Query("from")       from: String,
        @Query("to")         to: String
    ): List<ZmanimDay>
}

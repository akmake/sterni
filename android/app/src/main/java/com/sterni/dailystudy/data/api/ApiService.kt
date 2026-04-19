package com.sterni.dailystudy.data.api

import com.sterni.dailystudy.data.model.StudyDay
import com.sterni.dailystudy.data.model.TehillimChaptersResponse
import retrofit2.Response
import retrofit2.http.GET
import retrofit2.http.Query

interface ApiService {

    @GET("study/day")
    suspend fun getDailyStudy(
        @Query("date") date: String? = null
    ): Response<StudyDay>

    @GET("study/tehillim-chapters")
    suspend fun getTehillimChapters(
        @Query("chapters") chapters: String
    ): Response<TehillimChaptersResponse>
}

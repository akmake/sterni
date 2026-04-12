package com.sterni.dailystudy.data.api

import retrofit2.Call
import retrofit2.http.*

data class UserDataResponse(
    val userId: String,
    val readingPositions: Map<String, Int>?,
    val preferences: Map<String, Any>?,
    val savedArticleIds: List<String>?,
    val lastSyncAt: String?
)

data class RegisterResponse(val userId: String)
data class LoginRequest(val userId: String)
data class SyncRequest(
    val readingPositions: Map<String, Int>?,
    val preferences: Map<String, Any>?,
    val savedArticleIds: List<String>?
)

interface UserService {
    @POST("user/register")
    fun register(): Call<RegisterResponse>

    @POST("user/login")
    fun login(@Body body: LoginRequest): Call<UserDataResponse>

    @GET("user/{userId}")
    fun getUserData(@Path("userId") userId: String): Call<UserDataResponse>

    @PUT("user/{userId}/sync")
    fun sync(@Path("userId") userId: String, @Body body: SyncRequest): Call<UserDataResponse>
}

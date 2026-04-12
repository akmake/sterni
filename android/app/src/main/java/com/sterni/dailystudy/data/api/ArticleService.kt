package com.sterni.dailystudy.data.api

import com.google.gson.annotations.SerializedName
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.Call
import retrofit2.http.*

data class ArticleDto(
    @SerializedName("_id")
    val id: String,
    val title: String,
    val rawText: String?,
    val createdAt: String?
)

data class ExtractResponse(val rawText: String, val pageCount: Int)
data class SaveArticleBody(val rawText: String, val pageCount: Int, val title: String)

interface ArticleService {

    @GET("articles")
    fun getArticles(): Call<List<ArticleDto>>

    @GET("articles/{id}")
    fun getArticleById(@Path("id") id: String): Call<ArticleDto>

    @Multipart
    @POST("articles/extract")
    suspend fun extractText(
        @Part pdf: MultipartBody.Part
    ): ExtractResponse

    @Multipart
    @POST("articles/upload")
    suspend fun uploadArticle(
        @Part pdf:                 MultipartBody.Part,
        @Part("rawText")  rawText:  RequestBody,
        @Part("pageCount") pageCount: RequestBody,
        @Part("title")    title:    RequestBody
    ): ArticleDto

    @POST("articles/save")
    suspend fun saveArticle(@Body body: SaveArticleBody): ArticleDto
}

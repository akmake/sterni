package com.sterni.dailystudy.data.api

import com.sterni.dailystudy.data.model.ArticleResponse
import com.sterni.dailystudy.data.model.NewsFeedResponse
import retrofit2.http.GET
import retrofit2.http.Query

interface NewsService {

    @GET("news/feed")
    suspend fun getNewsFeed(): NewsFeedResponse

    @GET("news/article")
    suspend fun getArticle(
        @Query("url") url: String
    ): ArticleResponse
}

package com.sterni.dailystudy.data.api

import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object RetrofitClient {
    private const val BASE_URL = "https://dahanswebsite.com/api/"

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    private val retrofit by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    val zmanimService:  ZmanimService  by lazy { retrofit.create(ZmanimService::class.java)  }
    val articleService: ArticleService by lazy { retrofit.create(ArticleService::class.java) }
    val apiService:     ApiService     by lazy { retrofit.create(ApiService::class.java)     }
    val newsService:    NewsService    by lazy { retrofit.create(NewsService::class.java)    }
}

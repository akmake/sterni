package com.sterni.dailystudy.data.model

data class NewsFeedResponse(
    val items: List<NewsItem> = emptyList()
)

data class NewsItem(
    val id: String? = null,
    val text: String? = null,
    val replyText: String? = null,
    val replyLink: String? = null,
    val forwardedFrom: ForwardedFrom? = null,
    val date: String? = null,
    val link: String? = null,
    val image: String? = null,
    val video: String? = null,
    val videoThumb: String? = null,
    val source: String? = null,
    val channel: String? = null,
    val title: String? = null
)

data class ForwardedFrom(
    val name: String? = null,
    val link: String? = null
)

data class ArticleResponse(
    val content: ArticleContent? = null
)

data class ArticleContent(
    val text: String? = null,
    val comments: List<String>? = null,
    val images: List<String>? = null,
    val youtubeEmbeds: List<YoutubeEmbed>? = null,
    val twitterEmbeds: List<String>? = null,
    val tgEmbeds: List<String>? = null,
    val title: String? = null
)

data class YoutubeEmbed(
    val videoId: String? = null
)

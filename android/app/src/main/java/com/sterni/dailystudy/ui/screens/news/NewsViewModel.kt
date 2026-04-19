package com.sterni.dailystudy.ui.screens.news

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.sterni.dailystudy.data.api.RetrofitClient
import com.sterni.dailystudy.data.model.ArticleContent
import com.sterni.dailystudy.data.model.NewsItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class NewsState(
    val items: List<NewsItem> = emptyList(),
    val loading: Boolean = true,
    val error: String? = null,
    val lastUpdated: Long? = null
)

class NewsViewModel : ViewModel() {

    private val _state = MutableStateFlow(NewsState())
    val state: StateFlow<NewsState> = _state.asStateFlow()

    private val _articleCache = mutableMapOf<String, ArticleContent>()
    private val _articleLoading = MutableStateFlow<Set<String>>(emptySet())
    val articleLoading: StateFlow<Set<String>> = _articleLoading.asStateFlow()

    private val _articleContents = MutableStateFlow<Map<String, ArticleContent>>(emptyMap())
    val articleContents: StateFlow<Map<String, ArticleContent>> = _articleContents.asStateFlow()

    private val _articleErrors = MutableStateFlow<Set<String>>(emptySet())
    val articleErrors: StateFlow<Set<String>> = _articleErrors.asStateFlow()

    init {
        loadFeed()
    }

    fun loadFeed() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val response = RetrofitClient.newsService.getNewsFeed()
                val body = if (response.isSuccessful) response.body() else null
                if (body != null) {
                    _state.value = _state.value.copy(
                        items       = body.items,
                        loading     = false,
                        lastUpdated = System.currentTimeMillis()
                    )
                } else {
                    _state.value = _state.value.copy(
                        loading = false,
                        error   = "אין חיבור לשרת. נסה שוב מאוחר יותר."
                    )
                }
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    error   = "אין חיבור לאינטרנט."
                )
            }
        }
    }

    fun loadArticle(url: String) {
        if (_articleCache.containsKey(url)) {
            _articleContents.value = _articleContents.value + (url to _articleCache[url]!!)
            return
        }
        if (_articleLoading.value.contains(url)) return

        viewModelScope.launch {
            _articleLoading.value = _articleLoading.value + url
            _articleErrors.value = _articleErrors.value - url
            try {
                val response = RetrofitClient.newsService.getArticle(url)
                val content = if (response.isSuccessful) response.body()?.content else null
                if (content != null) {
                    _articleCache[url] = content
                    _articleContents.value = _articleContents.value + (url to content)
                } else {
                    _articleErrors.value = _articleErrors.value + url
                }
            } catch (e: Exception) {
                _articleErrors.value = _articleErrors.value + url
            } finally {
                _articleLoading.value = _articleLoading.value - url
            }
        }
    }
}

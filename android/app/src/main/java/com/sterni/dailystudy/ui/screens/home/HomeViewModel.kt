package com.sterni.dailystudy.ui.screens.home

import android.app.Application
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sterni.dailystudy.cache.StudyCache
import com.sterni.dailystudy.data.api.ApiService
import com.sterni.dailystudy.data.model.Study
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import javax.inject.Inject

data class HomeUiState(
    val isLoading: Boolean = false,
    val date: String = "",
    val hebrewDate: String = "",
    val studies: Map<String, Study> = emptyMap(),
    val error: String? = null
)

@HiltViewModel
class HomeViewModel @Inject constructor(
    private val apiService: ApiService,
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        loadDailyStudy()
    }

    fun loadDailyStudy() {
        val ctx = getApplication<Application>()
        val today = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)

        viewModelScope.launch {
            _uiState.value = HomeUiState(isLoading = true)

            // Try cache first
            val cached = StudyCache.get(ctx, today)
            if (cached?.studies?.isNotEmpty() == true) {
                _uiState.value = HomeUiState(
                    isLoading = false,
                    date = today,
                    hebrewDate = cached.hebrewDate ?: "",
                    studies = cached.studies
                )
                return@launch
            }

            // Network
            try {
                val day = apiService.getDailyStudy(today)
                StudyCache.save(ctx, today, day)
                _uiState.value = HomeUiState(
                    isLoading = false,
                    date = today,
                    hebrewDate = day.hebrewDate ?: "",
                    studies = day.studies ?: emptyMap()
                )
            } catch (e: Exception) {
                _uiState.value = HomeUiState(
                    isLoading = false,
                    date = today,
                    error = "No connection: ${e.message}"
                )
            }
        }
    }
}

package com.sterni.dailystudy.ui.screens.home

import android.app.Application
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

    fun loadDailyStudy(
        dateString: String = LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE)
    ) {
        val ctx = getApplication<Application>()

        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)

            val cached = StudyCache.get(ctx, dateString)
            if (cached?.studies?.isNotEmpty() == true) {
                _uiState.value = HomeUiState(
                    isLoading  = false,
                    date       = dateString,
                    hebrewDate = cached.hebrewDate ?: "",
                    studies    = cached.studies
                )
                return@launch
            }

            try {
                val response = apiService.getDailyStudy(dateString)
                val day = if (response.isSuccessful) response.body() else null
                if (day != null) {
                    StudyCache.save(ctx, dateString, day)
                    _uiState.value = HomeUiState(
                        isLoading  = false,
                        date       = dateString,
                        hebrewDate = day.hebrewDate ?: "",
                        studies    = day.studies ?: emptyMap()
                    )
                } else {
                    _uiState.value = HomeUiState(
                        isLoading = false,
                        date      = dateString,
                        error     = "אין חיבור לשרת. נסה שוב מאוחר יותר."
                    )
                }
            } catch (e: Exception) {
                _uiState.value = HomeUiState(
                    isLoading = false,
                    date      = dateString,
                    error     = "אין חיבור לאינטרנט."
                )
            }
        }
    }
}

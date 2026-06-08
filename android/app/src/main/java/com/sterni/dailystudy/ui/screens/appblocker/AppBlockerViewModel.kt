package com.sterni.dailystudy.ui.screens.appblocker

import android.app.Application
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.drawable.Drawable
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.sterni.dailystudy.data.local.AppBlockerPrefs
import com.sterni.dailystudy.data.model.AppBlockSchedule
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class InstalledApp(
    val packageName: String,
    val label: String,
    val icon: Drawable?
)

data class AppBlockerUiState(
    val schedules: List<AppBlockSchedule> = emptyList(),
    val installedApps: List<InstalledApp> = emptyList(),
    val isLoadingApps: Boolean = false,
    val editingSchedule: AppBlockSchedule? = null,
    val showEditor: Boolean = false
)

@HiltViewModel
class AppBlockerViewModel @Inject constructor(
    application: Application
) : AndroidViewModel(application) {

    private val _uiState = MutableStateFlow(AppBlockerUiState())
    val uiState: StateFlow<AppBlockerUiState> = _uiState.asStateFlow()

    init {
        loadSchedules()
        loadInstalledApps()
    }

    private fun loadSchedules() {
        _uiState.value = _uiState.value.copy(
            schedules = AppBlockerPrefs.getSchedules(getApplication())
        )
    }

    fun loadInstalledApps() = viewModelScope.launch(Dispatchers.IO) {
        _uiState.value = _uiState.value.copy(isLoadingApps = true)
        val pm   = getApplication<Application>().packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
            .filter { info ->
                pm.getLaunchIntentForPackage(info.packageName) != null &&
                (info.flags and ApplicationInfo.FLAG_SYSTEM) == 0
            }
            .map { info ->
                InstalledApp(
                    packageName = info.packageName,
                    label       = pm.getApplicationLabel(info).toString(),
                    icon        = try { pm.getApplicationIcon(info.packageName) } catch (e: Exception) { null }
                )
            }
            .sortedBy { it.label }
        _uiState.value = _uiState.value.copy(installedApps = apps, isLoadingApps = false)
    }

    fun startNewSchedule() {
        _uiState.value = _uiState.value.copy(
            editingSchedule = AppBlockSchedule(),
            showEditor      = true
        )
    }

    fun editSchedule(schedule: AppBlockSchedule) {
        _uiState.value = _uiState.value.copy(
            editingSchedule = schedule,
            showEditor      = true
        )
    }

    fun dismissEditor() {
        _uiState.value = _uiState.value.copy(showEditor = false, editingSchedule = null)
    }

    fun updateEditing(schedule: AppBlockSchedule) {
        _uiState.value = _uiState.value.copy(editingSchedule = schedule)
    }

    fun saveSchedule(schedule: AppBlockSchedule) {
        val list = AppBlockerPrefs.getSchedules(getApplication()).toMutableList()
        val idx  = list.indexOfFirst { it.id == schedule.id }
        if (idx >= 0) list[idx] = schedule else list.add(schedule)
        AppBlockerPrefs.saveSchedules(getApplication(), list)
        _uiState.value = _uiState.value.copy(
            schedules       = list,
            showEditor      = false,
            editingSchedule = null
        )
    }

    fun deleteSchedule(id: String) {
        val list = AppBlockerPrefs.getSchedules(getApplication()).filter { it.id != id }
        AppBlockerPrefs.saveSchedules(getApplication(), list)
        _uiState.value = _uiState.value.copy(schedules = list)
    }

    fun toggleSchedule(id: String, enabled: Boolean) {
        val list = AppBlockerPrefs.getSchedules(getApplication())
            .map { if (it.id == id) it.copy(enabled = enabled) else it }
        AppBlockerPrefs.saveSchedules(getApplication(), list)
        _uiState.value = _uiState.value.copy(schedules = list)
    }
}

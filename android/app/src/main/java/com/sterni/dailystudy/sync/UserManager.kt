package com.sterni.dailystudy.sync

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.sterni.dailystudy.data.api.LoginRequest
import com.sterni.dailystudy.data.api.SyncRequest
import com.sterni.dailystudy.data.api.UserDataResponse
import com.sterni.dailystudy.data.api.UserService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory

object UserManager {
    private const val TAG = "UserManager"
    private const val PREFS_NAME = "UserIdentity"
    private const val KEY_USER_ID = "user_id"
    private const val READING_PREFS = "RambamPrefs"
    private val PREFERENCE_KEYS = setOf(
        "text_size_sp", "mamaar_text_size_sp", "scroll_speed", "auto_scroll_speed"
    )

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun getUserId(context: Context): String? =
        prefs(context).getString(KEY_USER_ID, null)

    private fun userService(context: Context): UserService {
        val prefs = context.getSharedPreferences("network_prefs", Context.MODE_PRIVATE)
        val baseUrl = prefs.getString("base_url", "https://dahanswebsite.com/api/") ?: "https://dahanswebsite.com/api/"
        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(UserService::class.java)
    }

    fun ensureRegistered(context: Context): String? {
        val existing = getUserId(context)
        if (existing != null) return existing

        return try {
            val resp = userService(context).register().execute()
            if (resp.isSuccessful) {
                val userId = resp.body()?.userId ?: return null
                // Truncate to 4 digits if longer
                val shortId = userId.take(4)
                prefs(context).edit().putString(KEY_USER_ID, shortId).apply()
                Log.d(TAG, "Registered with userId=$shortId")
                shortId
            } else null
        } catch (e: Exception) {
            Log.w(TAG, "Registration failed: ${e.message}")
            null
        }
    }

    fun loginWithCode(context: Context, code: String): Boolean {
        return try {
            val resp = userService(context).login(LoginRequest(code)).execute()
            if (resp.isSuccessful) {
                val data = resp.body() ?: return false
                prefs(context).edit().putString(KEY_USER_ID, code).apply()
                applyServerData(context, data)
                Log.d(TAG, "Logged in with code=$code")
                true
            } else false
        } catch (e: Exception) {
            Log.w(TAG, "Login failed: ${e.message}")
            false
        }
    }

    /**
     * Gathers all reading positions and preferences from across all study modules:
     * - StudyPrefs (font sizes per study, scroll speed, scroll positions per date/study)
     * - ChumashPrefs (chumash text size, rashi text size, chumash scroll speed)
     * - ShnayimPrefs (shnayim_mikra_connected)
     * - TehillimPrefs (last chapter, last verse, free scroll index, free scroll offset)
     * - RambamPrefs (legacy positions and general text size)
     */
    private fun collectLocalData(context: Context): Pair<Map<String, Int>, Map<String, Any>> {
        val positions = mutableMapOf<String, Int>()
        val preferences = mutableMapOf<String, Any>()

        // 1. StudyPrefs (font sizes, scroll speed, and reading positions)
        val studyPrefs = context.getSharedPreferences("StudyPrefs", Context.MODE_PRIVATE)
        studyPrefs.all.forEach { (key, value) ->
            if (key.startsWith("font_") || key == "scroll_speed") {
                if (value is Number) preferences[key] = value.toInt()
            } else if (key.startsWith("scroll_")) {
                if (value is Number) positions[key] = value.toInt()
            }
        }

        // 2. ChumashPrefs
        val chumashPrefs = context.getSharedPreferences("ChumashPrefs", Context.MODE_PRIVATE)
        chumashPrefs.all.forEach { (key, value) ->
            if (value is Number) preferences[key] = value.toInt()
        }

        // 3. ShnayimPrefs
        val shnayimPrefs = context.getSharedPreferences("ShnayimPrefs", Context.MODE_PRIVATE)
        shnayimPrefs.all.forEach { (key, value) ->
            if (value is Boolean) preferences["shnayim_$key"] = value
        }

        // 4. TehillimPrefs
        val tehillimPrefs = context.getSharedPreferences("TehillimPrefs", Context.MODE_PRIVATE)
        tehillimPrefs.all.forEach { (key, value) ->
            if (value is Number) {
                positions["tehillim_$key"] = value.toInt()
            }
        }

        // 5. RambamPrefs
        val rambamPrefs = context.getSharedPreferences(READING_PREFS, Context.MODE_PRIVATE)
        rambamPrefs.all.forEach { (key, value) ->
            if (value is Int) {
                if (key in PREFERENCE_KEYS) preferences[key] = value
                else positions[key] = value
            }
        }

        return Pair(positions, preferences)
    }

    /**
     * Performs a two-way sync: sends current local positions, settings and articles,
     * receives the merged server state, and applies it locally across all preferences and library.
     */
    fun sync(context: Context): Boolean {
        val userId = getUserId(context) ?: ensureRegistered(context) ?: return false
        val (positions, preferences) = collectLocalData(context)
        val localArticleIds = syncLocalArticles(context)

        return try {
            val body = SyncRequest(positions, preferences, localArticleIds)
            val resp = userService(context).sync(userId, body).execute()
            if (resp.isSuccessful) {
                val data = resp.body()
                if (data != null) {
                    applyServerData(context, data)
                    syncDownloadedArticles(context, data.savedArticleIds)
                }
                true
            } else false
        } catch (e: Exception) {
            Log.w(TAG, "Sync failed: ${e.message}")
            false
        }
    }

    /**
     * Syncs any locally scanned articles (local_*) to the server and returns the active article IDs.
     */
    private fun syncLocalArticles(context: Context): List<String> {
        val cacheDir = java.io.File(context.filesDir, "articles_cache").also { it.mkdirs() }
        val listFile = java.io.File(cacheDir, "list.json")
        val gson = com.google.gson.Gson()
        val type = object : com.google.gson.reflect.TypeToken<List<com.sterni.dailystudy.data.api.ArticleDto>>() {}.type

        val currentList: MutableList<com.sterni.dailystudy.data.api.ArticleDto> = try {
            if (listFile.exists()) gson.fromJson(listFile.readText(), type) ?: mutableListOf()
            else mutableListOf()
        } catch (_: Exception) { mutableListOf() }

        var listChanged = false
        val articleIds = mutableListOf<String>()

        for (i in currentList.indices) {
            val item = currentList[i]
            if (item.id.startsWith("local_")) {
                val textFile = java.io.File(cacheDir, "text_${item.id}.txt")
                if (textFile.exists()) {
                    try {
                        val text = textFile.readText()
                        // Upload article via RetrofitClient
                        val response = com.sterni.dailystudy.data.api.RetrofitClient.articleService.saveArticleCall(
                            com.sterni.dailystudy.data.api.SaveArticleBody(
                                rawText = text,
                                pageCount = 0,
                                title = item.title
                            )
                        ).execute()
                        val serverId = response.body()?.id
                        if (serverId != null) {
                            currentList[i] = item.copy(id = serverId)
                            textFile.renameTo(java.io.File(cacheDir, "text_$serverId.txt"))
                            articleIds.add(serverId)
                            listChanged = true
                        }
                    } catch (e: Exception) {
                        Log.w(TAG, "Failed to upload local article ${item.id}: ${e.message}")
                    }
                }
            } else {
                articleIds.add(item.id)
            }
        }

        if (listChanged) {
            listFile.writeText(gson.toJson(currentList))
        }

        return articleIds
    }

    /**
     * Downloads any articles saved in user's cloud account that are not yet cached on this device.
     */
    private fun syncDownloadedArticles(context: Context, serverArticleIds: List<String>?) {
        if (serverArticleIds.isNullOrEmpty()) return
        val cacheDir = java.io.File(context.filesDir, "articles_cache").also { it.mkdirs() }
        val listFile = java.io.File(cacheDir, "list.json")
        val gson = com.google.gson.Gson()
        val type = object : com.google.gson.reflect.TypeToken<List<com.sterni.dailystudy.data.api.ArticleDto>>() {}.type

        val currentList: MutableList<com.sterni.dailystudy.data.api.ArticleDto> = try {
            if (listFile.exists()) gson.fromJson(listFile.readText(), type) ?: mutableListOf()
            else mutableListOf()
        } catch (_: Exception) { mutableListOf() }

        val localIds = currentList.map { it.id }.toSet()
        var updated = false

        for (id in serverArticleIds) {
            if (id !in localIds) {
                try {
                    val resp = com.sterni.dailystudy.data.api.RetrofitClient.articleService.getArticleById(id).execute()
                    if (resp.isSuccessful) {
                        val article = resp.body()
                        if (article != null) {
                            currentList.add(0, article.copy(rawText = null))
                            if (!article.rawText.isNullOrBlank()) {
                                java.io.File(cacheDir, "text_$id.txt").writeText(article.rawText)
                            }
                            updated = true
                        }
                    }
                } catch (e: Exception) {
                    Log.w(TAG, "Failed to download synced article $id: ${e.message}")
                }
            }
        }

        if (updated) {
            listFile.writeText(gson.toJson(currentList))
        }
    }

    /**
     * Triggers asynchronous background sync without blocking caller
     */
    fun triggerSync(context: Context) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                sync(context)
            } catch (e: Exception) {
                Log.w(TAG, "triggerSync failed: ${e.message}")
            }
        }
    }

    fun pushToServer(context: Context): Boolean = sync(context)

    fun pullFromServer(context: Context): Boolean {
        val userId = getUserId(context) ?: return false
        return try {
            val resp = userService(context).getUserData(userId).execute()
            if (resp.isSuccessful) {
                val data = resp.body() ?: return false
                applyServerData(context, data)
                true
            } else false
        } catch (e: Exception) {
            Log.w(TAG, "Pull failed: ${e.message}")
            false
        }
    }

    private fun applyServerData(context: Context, data: UserDataResponse) {
        val studyEditor = context.getSharedPreferences("StudyPrefs", Context.MODE_PRIVATE).edit()
        val chumashEditor = context.getSharedPreferences("ChumashPrefs", Context.MODE_PRIVATE).edit()
        val shnayimEditor = context.getSharedPreferences("ShnayimPrefs", Context.MODE_PRIVATE).edit()
        val tehillimEditor = context.getSharedPreferences("TehillimPrefs", Context.MODE_PRIVATE).edit()
        val rambamEditor = context.getSharedPreferences(READING_PREFS, Context.MODE_PRIVATE).edit()

        data.readingPositions?.forEach { (key, value) ->
            if (key.startsWith("tehillim_")) {
                val realKey = key.removePrefix("tehillim_")
                tehillimEditor.putInt(realKey, value)
            } else if (key.startsWith("scroll_")) {
                studyEditor.putInt(key, value)
            }
            rambamEditor.putInt(key, value)
        }

        data.preferences?.forEach { (key, value) ->
            when (value) {
                is Number -> {
                    val intVal = value.toInt()
                    if (key.startsWith("font_") || key == "scroll_speed") {
                        studyEditor.putInt(key, intVal)
                    }
                    if (key == "chumash_text_size" || key == "rashi_text_size" || key == "chumash_scroll_speed") {
                        chumashEditor.putInt(key, intVal)
                    }
                    rambamEditor.putInt(key, intVal)
                }
                is Boolean -> {
                    if (key.startsWith("shnayim_")) {
                        val realKey = key.removePrefix("shnayim_")
                        shnayimEditor.putBoolean(realKey, value)
                    }
                }
            }
        }

        studyEditor.apply()
        chumashEditor.apply()
        shnayimEditor.apply()
        tehillimEditor.apply()
        rambamEditor.apply()
    }
}

package com.sterni.dailystudy.sync

import android.content.Context
import android.content.SharedPreferences
import android.util.Log
import com.sterni.dailystudy.data.api.LoginRequest
import com.sterni.dailystudy.data.api.SyncRequest
import com.sterni.dailystudy.data.api.UserDataResponse
import com.sterni.dailystudy.data.api.UserService
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

    fun pushToServer(context: Context): Boolean {
        val userId = getUserId(context) ?: return false
        val readingPrefs = context.getSharedPreferences(READING_PREFS, Context.MODE_PRIVATE)

        val positions = mutableMapOf<String, Int>()
        val preferences = mutableMapOf<String, Any>()

        readingPrefs.all.forEach { (key, value) ->
            if (value is Int) {
                if (key in PREFERENCE_KEYS) preferences[key] = value
                else positions[key] = value
            }
        }

        val shnayimPrefs = context.getSharedPreferences("ShnayimPrefs", Context.MODE_PRIVATE)
        shnayimPrefs.all.forEach { (key, value) ->
            if (value is Boolean) preferences["shnayim_$key"] = value
        }

        return try {
            val body = SyncRequest(positions, preferences, null)
            val resp = userService(context).sync(userId, body).execute()
            resp.isSuccessful
        } catch (e: Exception) {
            Log.w(TAG, "Push failed: ${e.message}")
            false
        }
    }

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
        val readingPrefs = context.getSharedPreferences(READING_PREFS, Context.MODE_PRIVATE)
        val editor = readingPrefs.edit()
        data.readingPositions?.forEach { (key, value) -> editor.putInt(key, value) }
        data.preferences?.forEach { (key, value) ->
            when (value) {
                is Number -> editor.putInt(key, value.toInt())
                is Boolean -> {
                    if (key.startsWith("shnayim_")) {
                        val realKey = key.removePrefix("shnayim_")
                        context.getSharedPreferences("ShnayimPrefs", Context.MODE_PRIVATE)
                            .edit().putBoolean(realKey, value).apply()
                    }
                }
            }
        }
        editor.apply()
    }
}

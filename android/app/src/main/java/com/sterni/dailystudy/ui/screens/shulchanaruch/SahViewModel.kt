package com.sterni.dailystudy.ui.screens.shulchanaruch

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SahState(val loading: Boolean = true, val error: String? = null,
    val groups: List<SahGroup> = emptyList(), val group: SahGroup? = null,
    val chapters: List<SahChapter> = emptyList(), val chapter: SahChapter? = null,
    val segments: List<SahSegment> = emptyList(), val query: String = "", val hits: List<SahHit> = emptyList(),
    val searching: Boolean = false, val fontSize: Int = 24, val index: Int = 0, val offset: Int = 0,
    val bookmarks: Set<String> = emptySet(), val lastChapter: String? = null,
    val bookmarkHits: List<SahHit> = emptyList())

class SahViewModel(app: Application) : AndroidViewModel(app) {
    private val repository = SahRepository(app)
    private val prefs = app.getSharedPreferences("SahLibrary",0)
    private val mutable = MutableStateFlow(SahState(fontSize=prefs.getInt("fontSize",24),
        bookmarks=prefs.getStringSet("bookmarks",emptySet())!!.toSet(),lastChapter=prefs.getString("lastChapter",null)))
    val state = mutable.asStateFlow()
    private var job: Job? = null
    private var searchJob: Job? = null
    init { install() }
    fun install() {
        job = viewModelScope.launch {
            mutable.value=mutable.value.copy(loading=true,error=null)
            try { val groups=withContext(Dispatchers.IO) { repository.install(); repository.groups() }
                mutable.value=mutable.value.copy(loading=false,groups=groups)
            } catch(e: CancellationException) {throw e} catch(e: Exception) { mutable.value=mutable.value.copy(loading=false,error="לא ניתן להכין את הספר: ${e.message}") }
        }
    }
    fun openGroup(group: SahGroup) {
        job?.cancel(); job=viewModelScope.launch {
            mutable.value=mutable.value.copy(loading=true,error=null)
            try {
                val chapters=withContext(Dispatchers.IO) { repository.chapters(group.id) }
                mutable.value=mutable.value.copy(loading=false,group=group,chapters=chapters,chapter=null)
            } catch(e: CancellationException) {throw e} catch(e: Exception) {mutable.value=mutable.value.copy(loading=false,error="לא ניתן לפתוח את תוכן העניינים")}
        }
    }
    fun openChapter(id: String, segment: String? = null) {
        job?.cancel(); job=viewModelScope.launch {
            mutable.value=mutable.value.copy(loading=true,error=null)
            try {
                val (chapter,segments)=withContext(Dispatchers.IO) { repository.chapter(id) to repository.segments(id) }
                check(chapter!=null && segments.isNotEmpty()) { "הסימן אינו זמין" }
                val index=if(segment!=null) segments.indexOfFirst { it.id==segment }.coerceAtLeast(0) else prefs.getInt("index:$id",0).coerceIn(0,segments.lastIndex)
                prefs.edit().putString("lastChapter",id).apply()
                mutable.value=mutable.value.copy(loading=false,chapter=chapter,segments=segments,index=index,
                    offset=if(segment!=null) 0 else prefs.getInt("offset:$id",0),lastChapter=id)
            } catch(e: CancellationException) {throw e} catch(e: Exception) { mutable.value=mutable.value.copy(loading=false,error=e.message) }
        }
    }
    fun back(): Boolean {
        if(mutable.value.chapter!=null) { mutable.value=mutable.value.copy(chapter=null,segments=emptyList());return true }
        if(mutable.value.query.isNotEmpty()) { search(""); return true }
        if(mutable.value.group!=null) { mutable.value=mutable.value.copy(group=null,chapters=emptyList());return true }
        return false
    }
    fun search(query: String) {
        searchJob?.cancel(); mutable.value=mutable.value.copy(query=query,searching=query.isNotBlank(),hits=emptyList())
        if(query.isBlank()) return
        searchJob=viewModelScope.launch { delay(250)
            try { val hits=withContext(Dispatchers.IO) { repository.search(query) }; ensureActive()
                mutable.value=mutable.value.copy(hits=hits,searching=false)
            } catch(e: CancellationException) { throw e } catch(e: Exception) { mutable.value=mutable.value.copy(searching=false,error="החיפוש נכשל") }
        }
    }
    fun savePosition(id: String,index: Int,offset: Int) { prefs.edit().putInt("index:$id",index).putInt("offset:$id",offset).apply() }
    fun fontSize(value: Int) { val n=value.coerceIn(18,40);prefs.edit().putInt("fontSize",n).apply();mutable.value=mutable.value.copy(fontSize=n) }
    fun bookmark(id: String) {
        val next=mutable.value.bookmarks.toMutableSet(); if(!next.add(id)) next.remove(id)
        prefs.edit().putStringSet("bookmarks",next).apply();mutable.value=mutable.value.copy(bookmarks=next)
    }
    fun loadBookmarks() { viewModelScope.launch {
        val ids=mutable.value.bookmarks
        val hits=withContext(Dispatchers.IO) {repository.bookmarks(ids)}
        mutable.value=mutable.value.copy(bookmarkHits=hits)
    } }
    fun neighbor(next: Boolean) { val id=mutable.value.chapter?.id ?: return
        viewModelScope.launch { val target=withContext(Dispatchers.IO) { repository.neighbor(id,next) }; target?.let { openChapter(it) } }
    }
    override fun onCleared() { job?.cancel();searchJob?.cancel();repository.close() }
}

package com.sterni.dailystudy.ui.screens.shulchanaruch

import android.content.Context
import android.database.sqlite.SQLiteDatabase
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest
import java.text.Normalizer
import java.util.zip.GZIPInputStream

data class SahGroup(val id: String, val title: String, val part: String, val count: Int)
data class SahChapter(val id: String, val group: String, val title: String, val count: Int)
data class SahSegment(val id: String, val chapter: String, val number: Int, val html: String,
    val text: String, val edition: String, val source: String)
data class SahHit(val segment: String, val chapter: String, val title: String, val text: String)

/** Immutable content is separate from all user preferences; no study-server sync. */
class SahRepository(private val context: Context) : AutoCloseable {
    private lateinit var db: SQLiteDatabase
    lateinit var manifest: JSONObject
        private set

    fun install() = synchronized(installLock) {
        manifest = JSONObject(context.assets.open("sah/manifest.json").bufferedReader().use { it.readText() })
        val directory = File(context.noBackupFilesDir, "sah").also { it.mkdirs() }
        val file = File(directory, "body-${manifest.getInt("version")}.sqlite")
        val marker = File(directory, "body-${manifest.getInt("version")}.ready")
        fun hash(file: File) = file.inputStream().use { input ->
                val digest = MessageDigest.getInstance("SHA-256"); val buffer = ByteArray(65536)
                while (true) { val n = input.read(buffer); if (n < 0) break; digest.update(buffer, 0, n) }
                digest.digest().joinToString("") { "%02x".format(it) }
            }
        val ready = runCatching { marker.readLines() }.getOrDefault(emptyList())
        val valid = file.exists() && ready.size==2 && ready[0]==manifest.getString("sha256") &&
            runCatching {hash(file)==ready[1]}.getOrDefault(false)
        if (!valid) {
            val staging = File(directory, "body-${java.util.UUID.randomUUID()}.tmp")
            try {
                SQLiteDatabase.openOrCreateDatabase(staging,null).use { native ->
                    native.execSQL("CREATE TABLE groups(id TEXT PRIMARY KEY,title TEXT NOT NULL,part TEXT NOT NULL,ord INTEGER NOT NULL)")
                    native.execSQL("CREATE TABLE chapters(id TEXT PRIMARY KEY,group_id TEXT NOT NULL,title TEXT NOT NULL,number INTEGER,ord INTEGER NOT NULL)")
                    native.execSQL("CREATE TABLE segments(id TEXT PRIMARY KEY,chapter_id TEXT NOT NULL,number INTEGER NOT NULL,html TEXT NOT NULL,text TEXT NOT NULL,edition TEXT NOT NULL,source_ref TEXT NOT NULL)")
                    native.execSQL("CREATE INDEX chapter_group ON chapters(group_id,ord)")
                    native.execSQL("CREATE INDEX segment_chapter ON segments(chapter_id,number)")
                    native.execSQL("CREATE VIRTUAL TABLE search USING fts4(segment_id,terms,tokenize=unicode61)")
                    val columns=mapOf("groups" to 4,"chapters" to 5,"segments" to 7,"search" to 2)
                    val statements=columns.mapValues { (table,count) -> native.compileStatement("INSERT INTO $table VALUES (${List(count) {"?"}.joinToString(",")})") }
                    native.beginTransaction()
                    try {
                        val digest=MessageDigest.getInstance("SHA-256")
                        var bytes=0L
                        GZIPInputStream(context.assets.open("sah/corpus-v2.pack")).use { raw ->
                            val verified=object: java.io.FilterInputStream(java.security.DigestInputStream(raw,digest)) {
                                override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
                                    val n=super.read(buffer,offset,length); if(n>0) bytes+=n
                                    check(bytes<=manifest.getLong("bytes")) {"חבילת הספר חורגת מהגודל הצפוי"};return n
                                }
                                override fun read(): Int {val n=super.read();if(n>=0) bytes++;check(bytes<=manifest.getLong("bytes")) {"חבילת הספר חורגת מהגודל הצפוי"};return n}
                            }
                            verified.bufferedReader(Charsets.UTF_8).useLines { lines -> lines.forEach { line ->
                                val row=JSONObject(line);val table=row.getString("table")
                                val statement=statements[table] ?: error("טבלה לא מוכרת בחבילת הספר")
                                val values=row.getJSONArray("values")
                                check(values.length()==columns[table]) {"מבנה רשומה שגוי: $table"}
                                statement.clearBindings()
                                for(i in 0 until values.length()) {
                                    when(val value=values.get(i)) {
                                        is Number -> statement.bindLong(i+1,value.toLong())
                                        is String -> statement.bindString(i+1,value)
                                        JSONObject.NULL -> statement.bindNull(i+1)
                                        else -> error("ערך לא נתמך בחבילת הספר")
                                    }
                                }
                                statement.executeInsert()
                            } }
                        }
                        check(bytes==manifest.getLong("bytes") && digest.digest().joinToString("") {"%02x".format(it)}==manifest.getString("sha256")) {"אימות חבילת הטקסט נכשל"}
                        for(table in listOf("groups","chapters","segments")) native.rawQuery("SELECT count(*) FROM $table",null).use { c ->
                            check(c.moveToFirst() && c.getInt(0)==manifest.getInt(table)) {"מספר הרשומות בטבלת $table אינו תואם לחבילה"}
                        }
                        native.rawQuery("SELECT count(*) FROM search",null).use {c ->check(c.moveToFirst() && c.getInt(0)==manifest.getInt("segments")) {"אינדקס החיפוש אינו שלם"}}
                        native.setTransactionSuccessful()
                    } finally {native.endTransaction();statements.values.forEach {it.close()}}
                    native.rawQuery("PRAGMA quick_check",null).use {c ->
                        val results=buildList {while(c.moveToNext()) add(c.getString(0))}
                        check(results==listOf("ok")) {"בדיקת מסד מקומי נכשלה: ${results.take(2).joinToString()}"}
                    }
                }
                val installedHash=hash(staging)
                check(staging.renameTo(file)) { "לא ניתן לשמור את הספר" }
                marker.writeText(manifest.getString("sha256")+"\n"+installedHash)
            } finally { staging.delete() }
        }
        if(::db.isInitialized) db.close()
        db = SQLiteDatabase.openDatabase(file.path, null, SQLiteDatabase.OPEN_READONLY)
    }

    fun groups(): List<SahGroup> = db.rawQuery("SELECT g.id,g.title,g.part,count(c.id) FROM groups g JOIN chapters c ON c.group_id=g.id GROUP BY g.id ORDER BY g.ord", null).use { c ->
        buildList { while(c.moveToNext()) add(SahGroup(c.getString(0),c.getString(1),c.getString(2),c.getInt(3))) }
    }
    fun chapters(group: String): List<SahChapter> = db.rawQuery("SELECT c.id,c.group_id,c.title,count(s.id) FROM chapters c JOIN segments s ON s.chapter_id=c.id WHERE c.group_id=? GROUP BY c.id ORDER BY c.ord", arrayOf(group)).use { c ->
        buildList { while(c.moveToNext()) add(SahChapter(c.getString(0),c.getString(1),SahNumbers.title(c.getString(2)),c.getInt(3))) }
    }
    fun chapter(id: String): SahChapter? = db.rawQuery("SELECT c.id,c.group_id,c.title,count(s.id) FROM chapters c JOIN segments s ON s.chapter_id=c.id WHERE c.id=? GROUP BY c.id", arrayOf(id)).use { c ->
        if(c.moveToFirst()) SahChapter(c.getString(0),c.getString(1),SahNumbers.title(c.getString(2)),c.getInt(3)) else null
    }
    fun segments(chapter: String): List<SahSegment> = db.rawQuery("SELECT id,chapter_id,number,html,text,edition,source_ref FROM segments WHERE chapter_id=? ORDER BY number", arrayOf(chapter)).use { c ->
        buildList { while(c.moveToNext()) add(SahSegment(c.getString(0),c.getString(1),c.getInt(2),c.getString(3),c.getString(4),c.getString(5),c.getString(6))) }
    }
    fun neighbor(chapter: String, next: Boolean): String? = db.rawQuery(
        "SELECT id FROM chapters WHERE ord ${if(next) ">" else "<"} (SELECT ord FROM chapters WHERE id=?) ORDER BY ord ${if(next) "ASC" else "DESC"} LIMIT 1",arrayOf(chapter)).use { c -> if(c.moveToFirst()) c.getString(0) else null }
    fun bookmarks(ids: Set<String>): List<SahHit> = ids.toList().chunked(500).flatMap { chunk ->
        db.rawQuery("SELECT s.id,s.chapter_id,c.title,s.text FROM segments s JOIN chapters c ON c.id=s.chapter_id WHERE s.id IN (${chunk.joinToString(",") {"?"}}) ORDER BY c.ord,s.number",chunk.toTypedArray()).use { c ->
            buildList {while(c.moveToNext()) add(SahHit(c.getString(0),c.getString(1),SahNumbers.title(c.getString(2)),c.getString(3)))}
        }
    }
    fun search(query: String): List<SahHit> {
        val normalized = normalize(query).take(200)
        if(normalized.isBlank()) return emptyList()
        val direct = SahNumbers.directQuery(query)
        val sql: String; val args: Array<String>
        if(direct != null) {
            sql = "SELECT s.id,s.chapter_id,c.title,s.text FROM segments s JOIN chapters c ON c.id=s.chapter_id WHERE c.number=? AND s.number=1 ORDER BY c.ord LIMIT 80"
            args = arrayOf(direct.toString())
        } else {
            sql = "SELECT s.id,s.chapter_id,c.title,s.text FROM search f JOIN segments s ON s.id=f.segment_id JOIN chapters c ON c.id=s.chapter_id WHERE f.terms MATCH ? LIMIT 80"
            args = arrayOf(normalized.split(' ').filter { it.isNotBlank() }.joinToString(" AND ") {
                when(it) { "תפילין","תפלין" -> "(\"תפילין\" OR \"תפלין\")"
                    "ריבית","רבית" -> "(\"ריבית\" OR \"רבית\")"; else -> "\"$it\"" }
            })
        }
        return db.rawQuery(sql,args).use { c -> buildList { while(c.moveToNext()) add(SahHit(c.getString(0),c.getString(1),SahNumbers.title(c.getString(2)),c.getString(3))) } }
    }
    override fun close() { if(::db.isInitialized) db.close() }
    companion object {
        private val installLock=Any()
        fun normalize(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD)
            .replace(Regex("[\\p{M}]"), "").replace(Regex("[^א-תA-Za-z0-9]+"), " ").trim()
    }
}

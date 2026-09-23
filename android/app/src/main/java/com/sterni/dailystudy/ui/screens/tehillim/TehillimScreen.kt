package com.sterni.dailystudy.ui.screens.tehillim

import android.content.Context
import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.data.local.TehillimRepository
import com.sterni.dailystudy.data.model.SpecialCollection
import com.sterni.dailystudy.data.model.TehillimChapter
import com.sterni.dailystudy.data.model.TehillimTab
import com.sterni.dailystudy.ui.theme.*

private val HE_DAYS = arrayOf(
    "", "א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳",
    "י״א", "י״ב", "י״ג", "י״ד", "ט״ו", "ט״ז", "י״ז", "י״ח", "י״ט", "כ׳",
    "כ״א", "כ״ב", "כ״ג", "כ״ד", "כ״ה", "כ״ו", "כ״ז", "כ״ח", "כ״ט", "ל׳"
)

private val DOW_NAMES = arrayOf(
    "", "יום ראשון", "יום שני", "יום שלישי", "יום רביעי", "יום חמישי", "יום שישי", "שבת קודש"
)

private val BOOKS_INFO = listOf(
    Triple(1, "ספר ראשון", "מזמורים א׳ – מ״א"),
    Triple(2, "ספר שני", "מזמורים מ״ב – ע״ב"),
    Triple(3, "ספר שלישי", "מזמורים ע״ג – פ״ט"),
    Triple(4, "ספר רביעי", "מזמורים צ׳ – ק״ו"),
    Triple(5, "ספר חמישי", "מזמורים ק״ז – ק״נ")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TehillimScreen(
    onBack: () -> Unit,
    onOpenChapter: (chapter: Int, title: String) -> Unit,
    onOpenRange: (chapters: List<Int>, title: String) -> Unit
) {
    val context = LocalContext.current
    val repository = remember { TehillimRepository(context) }

    var selectedTab by remember { mutableStateOf(TehillimTab.MONTH) }
    var searchQuery by remember { mutableStateOf("") }
    var showAgeDialog by remember { mutableStateOf(false) }

    // Last read position
    var lastReadPos by remember { mutableStateOf(repository.getLastReadingPosition()) }
    val todayHebDay = remember { repository.getTodayHebrewDayOfMonth() }
    val todayDow = remember { repository.getTodayDayOfWeek() }

    LaunchedEffect(Unit) {
        lastReadPos = repository.getLastReadingPosition()
    }

    if (showAgeDialog) {
        AgeChapterDialog(
            onDismiss = { showAgeDialog = false },
            onSelect = { age ->
                showAgeDialog = false
                val targetChapter = (age + 1).coerceIn(1, 150)
                onOpenChapter(targetChapter, "פרק $targetChapter (לפי גיל $age)")
            }
        )
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "ספר תהילים",
                        fontWeight = FontWeight.Bold,
                        fontFamily = BaHaYetzira,
                        fontSize = 22.sp,
                        color = Ink
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "חזרה",
                            tint = Ink
                        )
                    }
                },
                actions = {
                    IconButton(onClick = {
                        val randomChapter = (1..150).random()
                        onOpenChapter(randomChapter, "פרק $randomChapter (אקראי)")
                    }) {
                        Icon(
                            imageVector = Icons.Default.Shuffle,
                            contentDescription = "פרק אקראי",
                            tint = Primary
                        )
                    }
                    IconButton(onClick = { showAgeDialog = true }) {
                        Icon(
                            imageVector = Icons.Default.Cake,
                            contentDescription = "פרק לפי גיל",
                            tint = Primary
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        },
        containerColor = Color(0xFFFBF9F5)
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // ── Continue Reading Card (המשך מאיפה שעצרת) ──────────────────────
            ContinueReadingCard(
                chapter = lastReadPos.chapter,
                verse = lastReadPos.verse,
                timestamp = lastReadPos.timestamp,
                repository = repository,
                onClick = {
                    onOpenChapter(lastReadPos.chapter, "המשך מאיפה שעצרת")
                }
            )

            // ── Tab Bar ───────────────────────────────────────────────────────
            ScrollableTabRow(
                selectedTabIndex = selectedTab.ordinal,
                edgePadding = 16.dp,
                containerColor = Color.White,
                contentColor = Primary,
                divider = { HorizontalDivider(color = Color(0xFFEEEEEE), thickness = 1.dp) }
            ) {
                TehillimTab.values().forEach { tab ->
                    val isSelected = selectedTab == tab
                    Tab(
                        selected = isSelected,
                        onClick = { selectedTab = tab },
                        text = {
                            Text(
                                text = tab.title,
                                fontFamily = SblHebrew,
                                fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Normal,
                                fontSize = 14.sp
                            )
                        }
                    )
                }
            }

            // ── Tab Content ───────────────────────────────────────────────────
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .weight(1f)
            ) {
                when (selectedTab) {
                    TehillimTab.MONTH -> MonthDaysTab(
                        todayHebDay = todayHebDay,
                        repository = repository,
                        onOpen = onOpenRange
                    )
                    TehillimTab.WEEK -> WeekDaysTab(
                        todayDow = todayDow,
                        repository = repository,
                        onOpen = onOpenRange
                    )
                    TehillimTab.ALL -> AllChaptersTab(
                        searchQuery = searchQuery,
                        onSearchChange = { searchQuery = it },
                        repository = repository,
                        onOpen = onOpenChapter
                    )
                    TehillimTab.BOOKS -> BooksTab(
                        repository = repository,
                        onOpen = onOpenRange
                    )
                    TehillimTab.SPECIAL -> SpecialTab(
                        repository = repository,
                        onOpenCollection = onOpenRange,
                        onOpenAgeDialog = { showAgeDialog = true }
                    )
                }
            }
        }
    }
}

// ── Continue Reading Card ─────────────────────────────────────────────────────

@Composable
private fun ContinueReadingCard(
    chapter: Int,
    verse: Int,
    timestamp: Long,
    repository: TehillimRepository,
    onClick: () -> Unit
) {
    val chObj = remember(chapter) { repository.getChapter(chapter) }
    val heChapter = chObj?.hebrewChapter ?: chapter.toString()

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF3EFE6)),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(46.dp)
                    .clip(CircleShape)
                    .background(Primary),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.AutoMirrored.Filled.MenuBook,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(24.dp)
                )
            }

            Spacer(Modifier.width(14.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "המשך מאיפה שעצרת",
                    fontSize = 12.sp,
                    fontFamily = SblHebrew,
                    color = Primary,
                    fontWeight = FontWeight.SemiBold
                )
                Text(
                    text = "פרק $heChapter • פסוק $verse",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = SblHebrew,
                    color = Ink
                )
                if (chObj?.verses?.isNotEmpty() == true) {
                    val preview = chObj.verses.firstOrNull()?.text ?: ""
                    Text(
                        text = preview,
                        fontSize = 12.sp,
                        fontFamily = SblHebrew,
                        color = Muted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }

            Spacer(Modifier.width(8.dp))

            FilledTonalButton(
                onClick = onClick,
                colors = ButtonDefaults.filledTonalButtonColors(containerColor = Primary.copy(alpha = 0.15f)),
                shape = RoundedCornerShape(10.dp),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
            ) {
                Text("המשך", fontFamily = SblHebrew, fontWeight = FontWeight.Bold, color = Primary, fontSize = 13.sp)
                Spacer(Modifier.width(4.dp))
                Icon(Icons.Default.PlayArrow, contentDescription = null, tint = Primary, modifier = Modifier.size(16.dp))
            }
        }
    }
}

// ── Tab 1: Day of Month ────────────────────────────────────────────────────────

@Composable
private fun MonthDaysTab(
    todayHebDay: Int,
    repository: TehillimRepository,
    onOpen: (chapters: List<Int>, title: String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        items((1..30).toList()) { day ->
            val chapters = remember(day) { repository.getChaptersByDayOfMonth(day) }
            val isToday = day == todayHebDay
            val rangeLabel = remember(chapters) {
                if (chapters.isEmpty()) ""
                else if (chapters.size == 1) "פרק ${chapters.first().hebrewChapter}"
                else "פרקים ${chapters.first().hebrewChapter} – ${chapters.last().hebrewChapter}"
            }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        onOpen(chapters.map { it.chapter }, "תהילים ליום ${HE_DAYS.getOrElse(day) { "$day" }} בחודש")
                    },
                shape = RoundedCornerShape(12.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isToday) Color(0xFFFDF7EA) else Color.White
                ),
                border = if (isToday) borderModifier(Primary) else null
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(40.dp)
                            .clip(CircleShape)
                            .background(if (isToday) Primary else Color(0xFFF3F1EC)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = HE_DAYS.getOrElse(day) { "$day" },
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isToday) Color.White else Ink,
                            fontFamily = SblHebrew
                        )
                    }

                    Spacer(Modifier.width(14.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "יום ${HE_DAYS.getOrElse(day) { "$day" }} בחודש",
                                fontSize = 15.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Ink,
                                fontFamily = SblHebrew
                            )
                            if (isToday) {
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = "היום!",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Primary,
                                    modifier = Modifier
                                        .background(Primary.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            text = "$rangeLabel (${chapters.size} מזמורים)",
                            fontSize = 13.sp,
                            color = Muted,
                            fontFamily = SblHebrew
                        )
                    }

                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = null,
                        tint = Muted.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

// ── Tab 2: Day of Week ─────────────────────────────────────────────────────────

@Composable
private fun WeekDaysTab(
    todayDow: Int,
    repository: TehillimRepository,
    onOpen: (chapters: List<Int>, title: String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items((1..7).toList()) { dow ->
            val chapters = remember(dow) { repository.getChaptersByDayOfWeek(dow) }
            val isToday = dow == todayDow
            val dayName = DOW_NAMES.getOrElse(dow) { "" }
            val rangeLabel = remember(chapters) {
                if (chapters.isEmpty()) ""
                else "פרקים ${chapters.first().hebrewChapter} – ${chapters.last().hebrewChapter}"
            }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable {
                        onOpen(chapters.map { it.chapter }, "תהילים ל$dayName")
                    },
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(
                    containerColor = if (isToday) Color(0xFFFDF7EA) else Color.White
                ),
                border = if (isToday) borderModifier(Primary) else null
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(if (isToday) Primary else Color(0xFFF3F1EC)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = HE_DAYS.getOrElse(dow) { "$dow" },
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (isToday) Color.White else Ink,
                            fontFamily = SblHebrew
                        )
                    }

                    Spacer(Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = dayName,
                                fontSize = 16.sp,
                                fontWeight = FontWeight.Bold,
                                color = Ink,
                                fontFamily = SblHebrew
                            )
                            if (isToday) {
                                Spacer(Modifier.width(8.dp))
                                Text(
                                    text = "היום!",
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Primary,
                                    modifier = Modifier
                                        .background(Primary.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                )
                            }
                        }
                        Text(
                            text = "$rangeLabel (${chapters.size} מזמורים)",
                            fontSize = 13.sp,
                            color = Muted,
                            fontFamily = SblHebrew
                        )
                    }

                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = null,
                        tint = Muted.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

// ── Tab 3: All Chapters ───────────────────────────────────────────────────────

@Composable
private fun AllChaptersTab(
    searchQuery: String,
    onSearchChange: (String) -> Unit,
    repository: TehillimRepository,
    onOpen: (chapter: Int, title: String) -> Unit
) {
    val chapters = remember(searchQuery) { repository.searchChapters(searchQuery) }

    Column(modifier = Modifier.fillMaxSize()) {
        OutlinedTextField(
            value = searchQuery,
            onValueChange = onSearchChange,
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            placeholder = { Text("חיפוש פרק (לדוגמה: 23, כ״ג, או מילות פסוק)", fontFamily = SblHebrew, fontSize = 13.sp) },
            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = Muted) },
            trailingIcon = {
                if (searchQuery.isNotEmpty()) {
                    IconButton(onClick = { onSearchChange("") }) {
                        Icon(Icons.Default.Clear, contentDescription = "נקה", tint = Muted)
                    }
                }
            },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = Color.White,
                unfocusedContainerColor = Color.White,
                focusedBorderColor = Primary,
                unfocusedBorderColor = Color(0xFFE2E2E2)
            )
        )

        LazyVerticalGrid(
            columns = GridCells.Adaptive(minSize = 68.dp),
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(chapters, key = { it.chapter }) { ch ->
                val isBookmarked = remember(ch.chapter) { repository.isBookmarked(ch.chapter) }

                Card(
                    modifier = Modifier
                        .aspectRatio(1f)
                        .clickable { onOpen(ch.chapter, "פרק ${ch.hebrewChapter}") },
                    shape = RoundedCornerShape(12.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    border = if (isBookmarked) borderModifier(Primary.copy(alpha = 0.4f)) else null
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Text(
                            text = ch.hebrewChapter,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = Ink,
                            fontFamily = SblHebrew
                        )
                        Text(
                            text = "${ch.verseCount} פסוקים",
                            fontSize = 9.sp,
                            color = Muted,
                            fontFamily = SblHebrew
                        )
                    }
                }
            }
        }
    }
}

// ── Tab 4: 5 Books ────────────────────────────────────────────────────────────

@Composable
private fun BooksTab(
    repository: TehillimRepository,
    onOpen: (chapters: List<Int>, title: String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(BOOKS_INFO) { (bookNum, title, range) ->
            val chapters = remember(bookNum) { repository.getChaptersByBook(bookNum) }

            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpen(chapters.map { it.chapter }, title) },
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(CircleShape)
                            .background(Primary.copy(alpha = 0.1f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = HE_DAYS.getOrElse(bookNum) { "$bookNum" },
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Primary,
                            fontFamily = SblHebrew
                        )
                    }

                    Spacer(Modifier.width(16.dp))

                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = title,
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Bold,
                            color = Ink,
                            fontFamily = SblHebrew
                        )
                        Text(
                            text = "$range (${chapters.size} מזמורים)",
                            fontSize = 13.sp,
                            color = Muted,
                            fontFamily = SblHebrew
                        )
                    }

                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = null,
                        tint = Muted.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

// ── Tab 5: Special Collections ────────────────────────────────────────────────

@Composable
private fun SpecialTab(
    repository: TehillimRepository,
    onOpenCollection: (chapters: List<Int>, title: String) -> Unit,
    onOpenAgeDialog: () -> Unit
) {
    val collections = remember { repository.getSpecialCollections() }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        // Age Card
        item {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onOpenAgeDialog),
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFFFDF7EA)),
                border = borderModifier(Primary.copy(alpha = 0.3f))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(18.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.Cake,
                        contentDescription = null,
                        tint = Primary,
                        modifier = Modifier.size(36.dp)
                    )
                    Spacer(Modifier.width(14.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "פרק תהילים לפי הגיל",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Ink,
                            fontFamily = SblHebrew
                        )
                        Text(
                            text = "מנהג ישראל לומר בכל יום את המזמור של שנת החיים (למשל: בגיל 20 אומרים פרק כ״א)",
                            fontSize = 12.sp,
                            color = Muted,
                            fontFamily = SblHebrew
                        )
                    }
                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = null,
                        tint = Primary
                    )
                }
            }
        }

        items(collections) { col ->
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onOpenCollection(col.chapters, col.title) },
                shape = RoundedCornerShape(14.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White)
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = col.title,
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = Ink,
                            fontFamily = SblHebrew
                        )
                        Text(
                            text = col.subtitle,
                            fontSize = 13.sp,
                            color = Muted,
                            fontFamily = SblHebrew
                        )
                    }
                    Icon(
                        imageVector = Icons.Default.ChevronLeft,
                        contentDescription = null,
                        tint = Muted.copy(alpha = 0.5f)
                    )
                }
            }
        }
    }
}

// ── Age Dialog ────────────────────────────────────────────────────────────────

@Composable
private fun AgeChapterDialog(
    onDismiss: () -> Unit,
    onSelect: (age: Int) -> Unit
) {
    var ageText by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text("פרק תהילים לפי הגיל", fontFamily = SblHebrew, fontWeight = FontWeight.Bold)
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(
                    "הזן את גילך (או גיל של קרוב משפחה). על פי המנהג, קוראים את הפרק המתאים לשנת החיים הנוכחית (הגיל + 1):",
                    fontFamily = SblHebrew,
                    fontSize = 14.sp
                )
                OutlinedTextField(
                    value = ageText,
                    onValueChange = { if (it.length <= 3 && it.all { c -> c.isDigit() }) ageText = it },
                    label = { Text("גיל (למשל: 30)", fontFamily = SblHebrew) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val age = ageText.toIntOrNull()
                    if (age != null && age in 0..149) {
                        onSelect(age)
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = Primary),
                shape = RoundedCornerShape(8.dp)
            ) {
                Text("פתח פרק", fontFamily = SblHebrew, fontWeight = FontWeight.Bold)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("ביטול", fontFamily = SblHebrew, color = Muted)
            }
        }
    )
}

private fun borderModifier(color: Color) = androidx.compose.foundation.BorderStroke(1.5.dp, color)

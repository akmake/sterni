package com.sterni.dailystudy.ui.screens.shulchanaruch

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.*
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.unit.LayoutDirection
import androidx.lifecycle.viewmodel.compose.viewModel
import com.sterni.dailystudy.ui.theme.SblHebrew
import kotlinx.coroutines.flow.distinctUntilChanged
import org.jsoup.Jsoup
import org.jsoup.nodes.Element
import org.jsoup.nodes.Node
import org.jsoup.nodes.TextNode

fun sahRichText(html: String): AnnotatedString = buildAnnotatedString {
    fun walk(node: Node) {
        if(node is TextNode) { append(node.wholeText); return }
        if(node is Element) {
            val tag=node.tagName()
            if(tag=="br") { append("\n"); return }
            val style=when(tag) { "b","strong" -> SpanStyle(fontWeight=FontWeight.Bold)
                "i","em" -> SpanStyle(fontStyle=FontStyle.Italic); else -> null }
            if(style!=null) pushStyle(style)
            node.childNodes().forEach { walk(it) }
            if(style!=null) pop()
            if(tag in listOf("p","div")) append("\n")
        }
    }
    Jsoup.parseBodyFragment(html).body().childNodes().forEach { walk(it) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SahScreen(onBack: () -> Unit, vm: SahViewModel = viewModel()) {
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        SahScreenContent(onBack,vm)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SahScreenContent(onBack: () -> Unit, vm: SahViewModel) {
    val state by vm.state.collectAsState()
    var info by remember { mutableStateOf(false) }
    var marks by remember { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    LaunchedEffect(marks,state.bookmarks) {if(marks) vm.loadBookmarks()}
    val clipboard=LocalClipboardManager.current
    fun back() { if(!vm.back()) onBack() }
    BackHandler { back() }
    val view=LocalView.current
    DisposableEffect(state.chapter) {
        val previous=view.keepScreenOn; if(state.chapter!=null) view.keepScreenOn=true
        onDispose { view.keepScreenOn=previous }
    }
    Scaffold(topBar={ TopAppBar(title={ Column {
        Text(if(state.chapter!=null) state.chapter!!.title else "שולחן ערוך אדמו״ר הזקן",maxLines=1)
        Text(if(state.chapter!=null) "${state.segments.size} סעיפים · טקסט מקומי" else "${state.group?.title ?: "גוף הספר · קריאה ללא אינטרנט"}",style=MaterialTheme.typography.labelSmall)
    } }, navigationIcon={ IconButton({ back() }) { Icon(Icons.AutoMirrored.Filled.ArrowForward,"חזרה") } },
        actions={
            IconButton({ info=true }) { Icon(Icons.Default.Info,"מידע על הספר") }
            IconButton({marks=true},enabled=!state.loading) {Icon(Icons.Default.Bookmark,"כל הסימניות")}
            if(state.chapter!=null) Box {
                IconButton({ menu=true }) { Icon(Icons.Default.MoreVert,"אפשרויות קריאה") }
                DropdownMenu(menu,{ menu=false }) {
                    DropdownMenuItem(text={Text("הגדלת טקסט")},onClick={vm.fontSize(state.fontSize+2);menu=false})
                    DropdownMenuItem(text={Text("הקטנת טקסט")},onClick={vm.fontSize(state.fontSize-2);menu=false})
                    DropdownMenuItem(text={Text("סימניות")},onClick={marks=true;menu=false})
                    DropdownMenuItem(text={Text("העתקת הסימן")},onClick={
                        val source=if(state.segments.firstOrNull()?.edition?.startsWith("Wikisource")==true)
                            "וויקיטקסט · CC-BY-SA 4.0" else "ספריא · קה״ת"
                        clipboard.setText(AnnotatedString(state.chapter!!.title+"\n\n"+state.segments.joinToString("\n\n") { it.text }+"\nמקור: $source")); menu=false
                    })
                }
            }
        }) }, bottomBar={ if(state.chapter!=null) Row(Modifier.fillMaxWidth().padding(horizontal=16.dp),horizontalArrangement=Arrangement.SpaceBetween) {
        TextButton({vm.neighbor(false)}) {Text("הסימן הקודם")}
        TextButton({vm.neighbor(true)}) {Text("הסימן הבא")}
    } }) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            if(state.loading) Column(Modifier.align(Alignment.Center),horizontalAlignment=Alignment.CenterHorizontally) {
                CircularProgressIndicator(); Spacer(Modifier.height(16.dp));Text("מכין את הספר לקריאה…")
            } else if(state.error!=null) Column(Modifier.align(Alignment.Center).padding(24.dp)) {
                Text(state.error!!); TextButton({vm.install()}) {Text("נסה שוב")}
            } else if(state.chapter!=null) {
                key(state.chapter!!.id) {
                    val list=rememberLazyListState(state.index,state.offset)
                    val chapterId=state.chapter!!.id
                    LaunchedEffect(list,chapterId) { snapshotFlow { list.firstVisibleItemIndex to list.firstVisibleItemScrollOffset }
                        .distinctUntilChanged().collect { (i,o) -> vm.savePosition(chapterId,i,o) } }
                    DisposableEffect(chapterId) { onDispose {vm.savePosition(chapterId,list.firstVisibleItemIndex,list.firstVisibleItemScrollOffset)} }
                    LazyColumn(state=list,contentPadding=PaddingValues(20.dp),verticalArrangement=Arrangement.spacedBy(22.dp)) {
                        items(state.segments,key={it.id}) { segment ->
                            Column {
                                Row(Modifier.fillMaxWidth(),verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween) {
                                    Text("סעיף ${SahNumbers.label(segment.number)}",color=MaterialTheme.colorScheme.primary,style=MaterialTheme.typography.labelLarge)
                                    IconButton({vm.bookmark(segment.id)}) {Icon(if(segment.id in state.bookmarks) Icons.Default.Bookmark else Icons.Outlined.BookmarkBorder,
                                        if(segment.id in state.bookmarks) "הסרת סימנייה" else "הוספת סימנייה")}
                                }
                                val rich=remember(segment.html) {sahRichText(segment.html)}
                                SelectionContainer { Text(rich,fontFamily=SblHebrew,fontSize=state.fontSize.sp,
                                    lineHeight=(state.fontSize*1.65f).sp,style=MaterialTheme.typography.bodyLarge.copy(textDirection=TextDirection.ContentOrRtl),
                                    modifier=Modifier.fillMaxWidth()) }
                            }
                        }
                    }
                }
            } else Column(Modifier.fillMaxSize()) {
                OutlinedTextField(state.query,vm::search,label={Text("חיפוש בספר או מספר סימן")},singleLine=true,
                    leadingIcon={Icon(Icons.Default.Search,null)},trailingIcon={if(state.query.isNotBlank()) IconButton({vm.search("")}) {Icon(Icons.Default.Close,"ניקוי חיפוש")}},
                    modifier=Modifier.fillMaxWidth().padding(horizontal=16.dp,vertical=8.dp))
                if(state.query.isNotBlank()) {
                    if(state.searching) LinearProgressIndicator(Modifier.fillMaxWidth())
                    else Text(if(state.hits.isEmpty()) "לא נמצאו תוצאות" else "${state.hits.size} תוצאות${if(state.hits.size==80) " ראשונות" else ""}",modifier=Modifier.padding(16.dp))
                    LazyColumn {items(state.hits,key={it.segment}) { hit ->
                        ListItem(headlineContent={Text(hit.title,maxLines=2)},supportingContent={Text(hit.text.take(180),maxLines=3)},
                            modifier=Modifier.clickable {vm.openChapter(hit.chapter,hit.segment)})
                        HorizontalDivider()
                    }}
                } else LazyColumn {
                    if(state.group==null) {
                        state.lastChapter?.let { id -> item {
                            FilledTonalButton({vm.openChapter(id)},modifier=Modifier.fillMaxWidth().padding(16.dp)) {Text("המשך לימוד מהמקום האחרון")}
                        }}
                        state.groups.groupBy {it.part}.forEach { (part,groups) ->
                            item {Text(part,fontWeight=FontWeight.Bold,modifier=Modifier.padding(16.dp),color=MaterialTheme.colorScheme.primary)}
                            items(groups,key={it.id}) { group -> ListItem(headlineContent={Text(group.title)},supportingContent={Text("${group.count} סימנים / פרקים")},
                                modifier=Modifier.clickable {vm.openGroup(group)}) }
                        }
                    } else items(state.chapters,key={it.id}) { chapter ->
                        ListItem(headlineContent={Text(chapter.title)},supportingContent={Text("${chapter.count} סעיפים")},modifier=Modifier.clickable {vm.openChapter(chapter.id)})
                        HorizontalDivider()
                    }
                }
            }
        }
    }
    if(info) AlertDialog(onDismissRequest={info=false},title={Text("על הספר")},text={Text(
        "שולחן ערוך אדמו״ר הזקן\n\nמקור: ספריא, מהדורות קה״ת. הטקסט המנוקד מושלם מהמהדורה הלא־מנוקדת במקומות החסרים.\n\nגוף הספר בלבד — ללא הערות, איורים וקונטרס אחרון. כולל 7,147 יחידות מהספר הראשי ו־54 סעיפים בהלכות תלמוד תורה מוויקיטקסט.\n\nייחוס: Kehot Publication Society · Sefaria · Wikisource\nרישיונות המקור: CC-BY-NC; הלכות תלמוד תורה CC-BY-SA 4.0.\nhttps://www.sefaria.org/Shulchan_Arukh_HaRav\nhttps://he.wikisource.org/wiki/שולחן_ערוך_הרב_הלכות_תלמוד_תורה")},confirmButton={TextButton({info=false}) {Text("סגירה")}})
    if(marks) AlertDialog(onDismissRequest={marks=false},title={Text("סימניות בספר")},text={
        val saved=state.bookmarkHits
        if(saved.isEmpty()) Text("אין סימניות שמורות") else LazyColumn {items(saved,key={it.segment}) { hit ->
            TextButton({marks=false;vm.openChapter(hit.chapter,hit.segment)}) {Text(hit.title+" · סעיף "+SahNumbers.label(hit.segment.substringAfterLast('/').toInt()),maxLines=2)}
        }}
    },confirmButton={TextButton({marks=false}) {Text("סגירה")}})
}

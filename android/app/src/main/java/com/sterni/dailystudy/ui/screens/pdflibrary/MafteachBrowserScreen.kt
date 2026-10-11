package com.sterni.dailystudy.ui.screens.pdflibrary

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Bundle
import android.os.Message
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.json.JSONObject

private data class MafteachSelection(val url: String, val title: String, val pageUrl: String)

/** The source's live catalogue retains all tabs, search, categories, summaries and media. */
@SuppressLint("SetJavaScriptEnabled")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MafteachBrowserScreen(state: PdfState, vm: PdfStudyViewModel, savedState: Bundle?,
    onSaveState: (Bundle) -> Unit, onBack: () -> Unit) {
    val context = LocalContext.current
    val navy = Color(0xFF002D40)
    var browser by remember { mutableStateOf<WebView?>(null) }
    var loading by remember { mutableStateOf(true) }
    var pageError by remember { mutableStateOf(false) }
    var selecting by remember { mutableStateOf<MafteachSelection?>(null) }
    var previewing by remember { mutableStateOf(false) }
    val snackbar = remember { SnackbarHostState() }

    fun preview(url: String) { previewing = true; browser?.loadUrl(url) }
    fun navigate(url: String) {
        val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return
        if (uri.scheme == "https") browser?.loadUrl(url)
        else if (uri.scheme in listOf("http", "mailto", "tel")) {
            runCatching { context.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
        }
    }
    fun document(url: String) {
        val source = browser?.url?.takeIf { MafteachLinks.isSite(it) } ?: MafteachLinks.HOME
        val quotedUrl = JSONObject.quote(url)
        // A one-shot read of the source link's public label; no persistent native JS bridge.
        val script = """(function() {
          const link = Array.from(document.links).find(a => a.href === $quotedUrl);
          const area = link && link.closest('.sicha-content, .collapsible-content, article, section');
          const header = area && area.id && document.getElementById(area.id.replace(/__content${'$'}/,'__button').replace(/_content${'$'}/,'_button'));
          const heading = document.querySelector('main h2, main h3, .maamar-title');
          return {title: ((header && header.innerText) || (heading && heading.innerText) || '').trim(),
                  label: link ? link.innerText.trim() : ''};
        })();"""
        browser?.evaluateJavascript(script) { result ->
            val metadata = runCatching { JSONObject(result) }.getOrNull()
            val label = metadata?.optString("label").orEmpty()
            if (label.contains("אודיו") || label.contains("וידיאו") || label.contains("וידאו")) preview(url)
            else {
                val title = listOf(metadata?.optString("title").orEmpty(), label).filter { it.isNotBlank() }
                    .joinToString(" · ").ifBlank { MafteachLinks.category(source) }
                selecting = MafteachSelection(url, title.take(160), source)
            }
        }
    }

    fun handle(url: String, popup: Boolean = false): Boolean {
        if (MafteachLinks.isDocument(url) && !previewing) { document(url); return true }
        val scheme = Uri.parse(url).scheme
        if (scheme !in listOf("https", "about")) { navigate(url); return true }
        if (popup) { navigate(url); return true }
        return false
    }

    fun back() {
        if (state.isOpening) vm.cancelOpening()
        else if (browser?.canGoBack() == true) browser?.goBack()
        else onBack()
    }
    BackHandler { back() }
    LaunchedEffect(state.errorMsg) {
        state.errorMsg?.let { snackbar.showSnackbar(it, withDismissAction = true); vm.clearError() }
    }
    LaunchedEffect(state.previewRemoteUrl) {
        state.previewRemoteUrl?.let { preview(it); vm.clearRemotePreview() }
    }
    DisposableEffect(Unit) {
        onDispose {
            browser?.let { view ->
                val bundle = Bundle(); view.saveState(bundle); onSaveState(bundle)
                view.stopLoading(); view.destroy()
            }
        }
    }

    Scaffold(snackbarHost = { SnackbarHost(snackbar) }, topBar = {
        TopAppBar(title = { Column {
            Text("מפתח בספרייה")
            Text("המאגר החי של mafteiach.app", style = MaterialTheme.typography.labelSmall)
        } }, navigationIcon = { IconButton({ back() }) { Icon(Icons.AutoMirrored.Filled.ArrowForward, "חזרה לספרייה או לעמוד הקודם") } },
            actions = {
                IconButton({ previewing = false; browser?.loadUrl(MafteachLinks.HOME) }) { Icon(Icons.Default.Home, "ראש המאגר") }
                IconButton({ browser?.reload() }) { Icon(Icons.Default.Refresh, "רענון המאגר") }
            }, colors = TopAppBarDefaults.topAppBarColors(containerColor = navy, titleContentColor = Color.White,
                navigationIconContentColor = Color.White, actionIconContentColor = Color.White))
    }) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            AndroidView(modifier = Modifier.fillMaxSize().testTag("mafteachBrowser"), factory = { ctx ->
                WebView(ctx).apply {
                    browser = this
                    layoutParams = android.view.ViewGroup.LayoutParams(
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT,
                        android.view.ViewGroup.LayoutParams.MATCH_PARENT)
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    settings.setSupportMultipleWindows(true)
                    settings.javaScriptCanOpenWindowsAutomatically = false
                    settings.mediaPlaybackRequiresUserGesture = true
                    webViewClient = object : WebViewClient() {
                        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
                            if (request.isForMainFrame) handle(request.url.toString()) else false
                        override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                            loading = true; pageError = false
                            if (MafteachLinks.isSite(url)) previewing = false
                        }
                        override fun onPageFinished(view: WebView, url: String) {
                            loading = false
                            if (MafteachLinks.isSite(url)) view.evaluateJavascript("""(function() {
                              // WebView can retain an initial, pre-layout 100vh value. Use its actual viewport.
                              function fit() {
                                const root = document.documentElement;
                                root.style.setProperty('--h-page-minus-nav-bar', 'calc(' + innerHeight + 'px - var(--h-nav-bar))');
                                root.style.setProperty('--h-page-minus-extended-nav-bar', 'calc(' + innerHeight + 'px - var(--h-extended-nav-bar))');
                              }
                              fit();
                              if (!window.sterniViewportFit) {
                                window.sterniViewportFit = fit;
                                window.addEventListener('resize', fit);
                              }
                            })();""", null)
                        }
                        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: android.webkit.WebResourceError) {
                            if (request.isForMainFrame) { pageError = true; loading = false }
                        }
                    }
                    webChromeClient = object : WebChromeClient() {
                        override fun onCreateWindow(view: WebView, isDialog: Boolean, isUserGesture: Boolean, resultMsg: Message): Boolean {
                            if (!isUserGesture) return false
                            val popup = WebView(ctx)
                            var handled = false
                            popup.webViewClient = object : WebViewClient() {
                                private fun dispatch(view: WebView, url: String): Boolean {
                                    if (url == "about:blank") return false
                                    if (!handled) { handled = true; handle(url, true); view.post { view.destroy() } }
                                    return true
                                }
                                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = dispatch(view, request.url.toString())
                                override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) { dispatch(view, url) }
                            }
                            (resultMsg.obj as WebView.WebViewTransport).webView = popup
                            resultMsg.sendToTarget()
                            return true
                        }
                    }
                    setDownloadListener { url, _, _, _, _ ->
                        if (MafteachLinks.isDocument(url)) document(url) else navigate(url)
                    }
                    if (savedState == null || restoreState(savedState) == null) loadUrl(MafteachLinks.HOME)
                }
            })
            if (loading) LinearProgressIndicator(Modifier.fillMaxWidth().align(Alignment.TopCenter))
            if (pageError) Card(Modifier.align(Alignment.Center).padding(24.dp)) {
                Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("לא ניתן לטעון את המאגר. בדוק את החיבור לאינטרנט.")
                    TextButton({ browser?.reload() }) { Text("נסה שוב") }
                }
            }
            if (state.isOpening && state.ocrRequest == null) AlertDialog(
                onDismissRequest = { vm.cancelOpening() },
                title = { Text(if (state.downloading) "מוריד מהמאגר" else "מכין לקריאה") },
                text = { Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                    CircularProgressIndicator(); Spacer(Modifier.height(12.dp))
                    Text(if (state.downloading) state.downloadProgress?.let { (bytes, total) ->
                        if (total != null && total > 0) "${bytes * 100 / total}%" else "${bytes / 1024} KB"
                    } ?: "מתחבר למקור…" else state.extractionProgress?.let { "${it.first} מתוך ${it.second} עמודים" } ?: "פותח את הקובץ…")
                } }, confirmButton = { TextButton({ vm.cancelOpening() }) { Text("ביטול") } }
            )
        }
    }
    selecting?.let { selection ->
        var title by remember(selection.url) { mutableStateOf(selection.title) }
        var asText by remember(selection.url) { mutableStateOf(true) }
        AlertDialog(onDismissRequest = { selecting = null }, title = { Text("פתיחה בקורא שלנו") },
            text = { Column {
                OutlinedTextField(title, { title = it }, label = { Text("שם הקטע") }, modifier = Modifier.fillMaxWidth())
                Row(Modifier.fillMaxWidth().selectable(asText, role = Role.RadioButton, onClick = { asText = true }),
                    verticalAlignment = Alignment.CenterVertically) { RadioButton(asText, null); Text("טקסט לקריאה רציפה") }
                Row(Modifier.fillMaxWidth().selectable(!asText, role = Role.RadioButton, onClick = { asText = false }),
                    verticalAlignment = Alignment.CenterVertically) { RadioButton(!asText, null); Text("PDF בעימוד המקורי") }
                Text("הקובץ יישמר בספרייה ויהיה זמין גם בלי אינטרנט.", style = MaterialTheme.typography.bodySmall)
                TextButton({ selecting = null; preview(selection.url) }) { Text("צפייה באתר המקור") }
            } },
            confirmButton = { Button({ selecting = null; vm.importMafteachDocument(selection.url, title, selection.pageUrl, asText) }) { Text("פתיחה") } },
            dismissButton = { TextButton({ selecting = null }) { Text("ביטול") } }
        )
    }
}

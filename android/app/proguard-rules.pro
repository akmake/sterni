-keep class com.sterni.dailystudy.data.model.** { *; }
-keepattributes Signature
-keepattributes *Annotation*
-dontwarn okhttp3.**
-dontwarn retrofit2.**

# Local PDF library and native Sichot text cache are serialized by Gson.
-keep class com.sterni.dailystudy.ui.screens.pdflibrary.PdfBook { *; }
-keep class com.sterni.dailystudy.ui.screens.pdflibrary.SichaCrop { *; }
-keep class com.sterni.dailystudy.ui.screens.pdflibrary.SichaTextDocument { *; }
-keep class com.sterni.dailystudy.ui.screens.pdflibrary.SichaTextBlock { *; }
-keep class com.sterni.dailystudy.ui.screens.pdflibrary.SichaTextRun { *; }

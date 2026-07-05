package com.sterni.dailystudy.ui.screens.tefila

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.*

private val STUDY_BG = Color(0xFFFDFBF7)

private val EIZEHU_PARAGRAPHS = listOf(
    "א אֵיזֶהוּ מְקוֹמָן שֶׁל זְבָחִים, קָדְשֵׁי קָדָשִׁים שְׁחִיטָתָן בַּצָּפוֹן. פָּר וְשָׂעִיר שֶׁל יוֹם הַכִּפּוּרִים שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, וְדָמָן טָעוּן הַזָּיָה עַל בֵּין הַבַּדִּים, וְעַל הַפָּרֹכֶת, וְעַל מִזְבַּח הַזָּהָב. מַתָּנָה אַחַת מֵהֶן מְעַכָּבֶת. שְׁיָרֵי הַדָּם הָיָה שׁוֹפֵךְ עַל יְסוֹד מַעֲרָבִי שֶׁל מִזְבֵּחַ הַחִיצוֹן, אִם לֹא נָתַן לֹא עִכֵּב:",
    "ב פָּרִים הַנִּשְֹרָפִים וּשְֹעִירִים הַנִּשְֹרָפִים שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, וְדָמָן טָעוּן הַזָּיָה עַל הַפָּרֹכֶת, וְעַל מִזְבַּח הַזָּהָב. מַתָּנָה אַחַת מֵהֶן מְעַכָּבֶת, שְׁיָרֵי הַדָּם, הָיָה שׁוֹפֵךְ עַל יְסוֹד מַעֲרָבִי שֶׁל מִזְבַּח הַחִיצוֹן, אִם לֹא נָתַן לֹא עִכֵּב, אֵלּוּ וָאֵלּוּ נִשְֹרָפִין בְּבֵית הַדָּשֶׁן:",
    "ג חַטָּאוֹת הַצִּבּוּר וְהַיָּחִיד, אֵלּוּ הֵן חַטּאוֹת הַצִּבּוּר: שְֹעִירֵי רָאשֵׁי חֳדָשִׁים וְשֶׁל מוֹעֲדוֹת, שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, וְדָמָן טָעוּן אַרְבַּע מַתָּנוֹת עַל אַרְבַּע קְרָנוֹת, כֵּיצַד: עָלָה בַכֶּבֶשׁ וּפָנָה לַסּוֹבֵב, וּבָא לוֹ לְקֶרֶן דְּרוֹמִית מִזְרָחִית, מִזְרָחִית צְפוֹנִית, צְפוֹנִית מַעֲרָבִית, מַעֲרָבִית דְּרומִית. שְׁיָרֵי הַדָּם הָיָה שׁוֹפֵךְ עַל יְסוֹד דְּרומִי, וְנֶאֱכָלִין לִפְנִים מִן הַקְּלָעִים לְזִכְרֵי כְהֻנָּה בְּכָל מַאֲכָל, לְיוֹם וָלַיְלָה עַד חֲצוֹת:",
    "ד הָעוֹלָה, קדֶשׁ קָדָשִׁים, שְׁחִיטָתָהּ בַּצָּפוֹן, וְקִבּוּל דָּמָהּ בִּכְלִי שָׁרֵת בַּצָּפוֹן, וְדָמָהּ טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע, וּטְעוּנָה הֶפְשֵׁט וְנִתּוּחַ, וְכָלִיל לָאִשִּׁים:",
    "ה זִבְחֵי שַׁלְמֵי צִבּוּר וַאֲשָׁמוֹת, אֵלּוּ הֵן אֲשָׁמות: אֲשַׁם גְּזֵלוֹת, אֲשַׁם מְעִילוֹת, אֲשַׁם שִׁפְחָה חֲרוּפָה, אֲשַׁם נָזִיר, אֲשַׁם מְצוֹרָע, אָשָׁם תָּלוּי. שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, וְדָמָן טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע, וְנֶאֱכָלִין לִפְנִים מִן הַקְּלָעִים לְזִכְרֵי כְהֻנָּה, בְּכָל מַאֲכָל, לְיוֹם וָלַיְלָה עַד חֲצוֹת:",
    "ו הַתּוֹדָה וְאֵיל נָזִיר, קָדָשִׁים קַלִּים, שְׁחִיטָתָן בְּכָל מָקוֹם בָּעֲזָרָה, וְדָמָן טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע, וְנֶאֱכָלִין בְּכָל הָעִיר, לְכָל אָדָם, בְּכָל מַאֲכָל, לְיוֹם וָלַיְלָה עַד חֲצוֹת: הַמּוּרָם מֵהֶם כַּיּוֹצֵא בָהֶם, אֶלָּא שֶׁהַמּוּרָם נֶאֱכָל לַכּהֲנִים לִנְשֵׁיהֶם וְלִבְנֵיהֶם וּלְעַבְדֵיהֶם:",
    "ז שְׁלָמִים, קָדָשִׁים קַלִּים, שְׁחיטָתָן בְּכָל מָקוֹם בָּעֲזָרָה, וְדָמָן טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע, וְנֶאֱכָלִין בְּכָל הָעִיר, לְכָל אָדָם, בְּכָל מַאֲכָל, לִשְׁנֵי יָמִים וְלַיְלָה אֶחָד. הַמּוּרָם מֵהֶם, כַּיּוֹצֵא בָהֶם, אֶלָּא, שֶׁהַמּוּרָם נֶאֱכָל לַכּהֲנִים לִנְשֵׁיהֶם וְלִבְנֵיהֶם וּלְעַבְדֵיהֶם:",
    "ח הַבְּכוֹר וְהַמַּעֲשֵֹר וְהַפֶּסַח, קָדָשִׁים קַלִּים שְׁחִיטָתָן בְּכָל מָקוֹם בָּעֲזָרָה, וְדָמָן טָעוּן מַתָּנָה אֶחָת, וּבִלְבָד שֶׁיִּתֵּן כְּנֶגֶד הַיְסוֹד. שִׁנָּה בַאֲכִילָתָן, הַבְּכוֹר נֶאֱכָל לַכֹּהֲנִים, וְהַמַּעֲשֵֹר לְכָל אָדָם, וְנֶאֱכָלִין בְּכָל הָעִיר, בְּכָל מַאֲכָל, לִשְׁנֵי יָמִים וְלַיְלָה אֶחָד. הַפֶּסַח אֵינוֹ נֶאֱכָל אֶלָּא בַלַּיְלָה, וְאֵינוֹ נֶאֱכָל אֶלָּא עַד חֲצוֹת, וְאֵינוֹ נֶאֱכָל אֶלָּא לִמְנוּיָו, וְאֵינוֹ נֶאֱכָל אֶלָּא צָלִי:",
    "רַבִּֽי יִשְׁמָעֵֽאל אוֹמֵֽר, בִּשְׁלֽשׁ עֶשְׂרֵֽה מִדּֽוֹת הַתּוֹרָֽה נִדְרֶֽשֶׁת: א מִקַּֽל וָחֹֽמֶר. ב וּמִגְּזֵרָֽה שָׁוָֽה. ג מִבִּנְיַֽן אָב מִכָּתֽוּב אֶחָֽד, וּמִבִּנְיַֽן אָב מִשְּׁנֵֽי כְתוּבִֽים. ד מִכְּלָֽל וּפְרָֽט. ה וּמִפְּרָֽט וּכְלָֽל. ו כְּלָֽל וּפְרָֽט וּכְלָֽל, אִי אַתָּֽה דָן אֶֽלָּא כְּעֵֽין הַפְּרָֽט. ז מִכְּלָֽל שֶׁהֽוּא צָרִֽיךְ לִפְרָֽט, וּמִפְּרָֽט שֶׁהֽוּא צָרִֽיךְ לִכְלָֽל. ח כָּל־דָּבָֽר שֶׁהָיָֽה בִּכְלָֽל וְיָצָֽא מִן הַכְּלָֽל לְלַמֵּֽד, לֹא לְלַמֵּֽד עַל עַצְמֽוֹ יָצָֽא, אֶֽלָּא לְלַמֵּֽד עַל־הַכְּלָֽל כֻּלּֽוֹ יָצָֽא. ט כָּל־דָּבָֽר שֶׁהָיָֽה בִּכְלָֽל, וְיָצָֽא לִטְעֽוֹן טַֽעַן אֶחָֽד שֶׁהֽוּא כְעִנְיָנֽוֹ, יָצָֽא לְהָקֵֽל וְלֹא לְהַחֲמִֽיר. י כָּל־דָּבָֽר שֶׁהָיָֽה בִּכְלָֽל וְיָצָֽא לִטְעֽוֹן טַֽעַן אַחֵֽר שֶׁלֹּֽא כְעִנְיָנֽוֹ, יָצָֽא לְהָקֵֽל וּלְהַחֲמִֽיר. יא כָּל־דָּבָֽר שֶׁהָיָֽה בִּכְלָֽל וְיָצָֽא לִדּֽוֹן בְּדָּבָֽר חָדָֽשׁ, אִי אַתָּֽה יָכֽוֹל לְהַחֲזִירֽוֹ לִכְלָלֽוֹ, עַד שֶׁיַּחֲזִירֶֽנּוּ הַכָּתֽוּב לִכְלָלֽוֹ בְּפֵרֽוּשׁ. יב דָּבָֽר הַלָּמֵֽד מֵעִנְיָנֽוֹ, וְדָבָֽר הַלָּמֵֽד מִסּוֹפֽוֹ. יג וְכֵן שְׁנֵי כְתוּבִֽים הַמַּכְחִישִֽׁים זֶה אֶת־זֶה, עַד שֶׁיָּבֹֽא הַכָּתֽוּב הַשְּׁלִישִֽׁי וְיַכְרִֽיעַ בֵּינֵיהֶֽם:",
    "יְהִי רָצוֹן מִלְּפָנֶֽיךָ, יְיָ אֱלֹהֵֽינוּ וֵאלֹהֵי אֲבוֹתֵֽינוּ, שֶׁיִּבָּנֶה בֵּית הַמִּקְדָּשׁ בִּמְהֵרָה בְיָמֵֽינוּ, וְתֵן חֶלְקֵֽנוּ בְּתוֹרָתֶֽךָ:"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun EizVehuScreen(onBack: () -> Unit) {
    Scaffold(
        containerColor = STUDY_BG,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        "איזהו מקומן",
                        fontFamily = BaHaYetzira,
                        fontWeight = FontWeight.Bold,
                        fontSize   = 20.sp,
                        color      = Primary
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowForward, contentDescription = null, tint = Primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = STUDY_BG)
            )
        }
    ) { padding ->
        LazyColumn(
            modifier       = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, bottom = 48.dp)
        ) {
            itemsIndexed(EIZEHU_PARAGRAPHS) { _, text ->
                EizVehuParagraph(text)
                Spacer(Modifier.height(16.dp))
            }
        }
    }
}

@Composable
private fun EizVehuParagraph(text: String) {
    val firstSpace = text.indexOf(' ')
    val firstWord  = if (firstSpace >= 0) text.substring(0, firstSpace) else text
    val rest       = if (firstSpace >= 0) text.substring(firstSpace) else ""

    val annotated = buildAnnotatedString {
        withStyle(SpanStyle(color = Primary, fontWeight = FontWeight.Bold)) { append(firstWord) }
        append(rest)
    }

    Text(
        annotated,
        modifier   = Modifier.fillMaxWidth(),
        fontSize   = 19.sp,
        fontFamily = SblHebrew,
        color      = Color(0xFF1A1A2A),
        lineHeight = 32.sp,
        textAlign  = TextAlign.Justify,
        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

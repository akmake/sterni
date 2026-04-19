package com.sterni.dailystudy.ui.screens.tefila

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.BaHaYetzira
import com.sterni.dailystudy.ui.theme.SblHebrew

private val LightBg = Color(0xFFFDFBF7)
private val Primary = Color(0xFF1B5E20)
private val Ink = Color(0xFF2D2D2D)
private val Muted = Color(0xFF8E8E93)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TefilaScreen(
    onBack: () -> Unit
) {
    var selectedSection by remember { mutableIntStateOf(-1) }

    Scaffold(
        containerColor = LightBg,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        if (selectedSection == -1) "תפילה"
                        else when (selectedSection) {
                            0 -> "ברכות השחר והתורה"
                            1 -> "איזהו מקומן"
                            else -> "תפילה"
                        },
                        fontFamily = BaHaYetzira,
                        fontWeight = FontWeight.Bold,
                        color = Ink
                    )
                },
                navigationIcon = {
                    IconButton(onClick = {
                        if (selectedSection == -1) onBack() else selectedSection = -1
                    }) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "חזור", tint = Primary)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = LightBg)
            )
        }
    ) { padding ->
        if (selectedSection == -1) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(horizontal = 20.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                PrayerSectionCard(
                    title = "ברכות השחר והתורה",
                    subtitle = "ברכות הבוקר וברכות התורה",
                    color = Color(0xFF1B5E20),
                    onClick = { selectedSection = 0 }
                )
                PrayerSectionCard(
                    title = "איזהו מקומן",
                    subtitle = "סדר קרבנות — פרק ה׳ מזבחים",
                    color = Color(0xFF4A148C),
                    onClick = { selectedSection = 1 }
                )
            }
        } else {
            when (selectedSection) {
                0 -> BrachotContent(Modifier.padding(padding))
                1 -> EizehuMekomanContent(Modifier.padding(padding))
            }
        }
    }
}

@Composable
private fun PrayerSectionCard(
    title: String,
    subtitle: String,
    color: Color,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(
            modifier = Modifier.padding(20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(6.dp, 40.dp)
                    .background(color, RoundedCornerShape(3.dp))
            )
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    fontSize = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = BaHaYetzira,
                    color = Ink,
                    textAlign = TextAlign.End,
                    modifier = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    subtitle,
                    fontSize = 14.sp,
                    fontFamily = SblHebrew,
                    color = Muted,
                    textAlign = TextAlign.End,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

@Composable
private fun BrachotContent(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 8.dp)
    ) {
        SectionTitle("ברכות השחר")

        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר נָתַן לַשֶּׂכְוִי בִינָה לְהַבְחִין בֵּין יוֹם וּבֵין לָיְלָה:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, שֶׁעָשַׂנִי יִשְׂרָאֵל:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, שֶׁעָשַׂנִי בֶּן חוֹרִין:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, פּוֹקֵחַ עִוְרִים:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, מַלְבִּישׁ עֲרֻמִּים:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, מַתִּיר אֲסוּרִים:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, זוֹקֵף כְּפוּפִים:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, רוֹקַע הָאָרֶץ עַל הַמָּיִם:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, שֶׁעָשָׂה לִי כָּל צָרְכִּי:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, הַמֵּכִין מִצְעֲדֵי גָבֶר:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אוֹזֵר יִשְׂרָאֵל בִּגְבוּרָה:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, עוֹטֵר יִשְׂרָאֵל בְּתִפְאָרָה:")
        PrayerText("בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, הַנּוֹתֵן לַיָּעֵף כֹּחַ:")

        Spacer(Modifier.height(20.dp))
        SectionTitle("ברכות התורה")

        PrayerText(
            "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֹתָיו " +
            "וְצִוָּנוּ לַעֲסוֹק בְּדִבְרֵי תוֹרָה:"
        )
        PrayerText(
            "וְהַעֲרֶב נָא יְיָ אֱלֹהֵינוּ אֶת דִּבְרֵי תוֹרָתְךָ בְּפִינוּ וּבְפִיפִיּוֹת עַמְּךָ בֵּית יִשְׂרָאֵל. " +
            "וְנִהְיֶה אֲנַחְנוּ וְצֶאֱצָאֵינוּ וְצֶאֱצָאֵי עַמְּךָ בֵּית יִשְׂרָאֵל " +
            "כֻּלָּנוּ יוֹדְעֵי שְׁמֶךָ וְלוֹמְדֵי תוֹרָתֶךָ לִשְׁמָהּ. בָּרוּךְ אַתָּה יְיָ, הַמְלַמֵּד תּוֹרָה לְעַמּוֹ יִשְׂרָאֵל:"
        )
        PrayerText(
            "בָּרוּךְ אַתָּה יְיָ אֱלֹהֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר בָּחַר בָּנוּ מִכָּל הָעַמִּים, " +
            "וְנָתַן לָנוּ אֶת תּוֹרָתוֹ. בָּרוּךְ אַתָּה יְיָ, נוֹתֵן הַתּוֹרָה:"
        )

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun EizehuMekomanContent(modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp, vertical = 8.dp)
    ) {
        SectionTitle("איזהו מקומן של זבחים")

        PrayerText(
            "אֵיזֶהוּ מְקוֹמָן שֶׁל זְבָחִים. קָדְשֵׁי קָדָשִׁים שְׁחִיטָתָן בַּצָּפוֹן. " +
            "פַּר וְשָׂעִיר שֶׁל יוֹם הַכִּפּוּרִים שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, " +
            "וְדָמָן טָעוּן הַזָּיָה עַל בֵּין הַבַּדִּים, וְעַל הַפָּרֹכֶת, וְעַל מִזְבַּח הַזָּהָב. מַתָּנָה אַחַת מֵהֶן מְעַכֶּבֶת. " +
            "שְׁיָרֵי הַדָּם הָיָה שׁוֹפֵךְ עַל יְסוֹד מַעֲרָבִי שֶׁל מִזְבֵּחַ הַחִיצוֹן. אִם לֹא נָתַן לֹא עִכֵּב."
        )

        PrayerText(
            "פָּרִים הַנִּשְׂרָפִים וּשְׂעִירִים הַנִּשְׂרָפִים, שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, " +
            "וְדָמָן טָעוּן הַזָּיָה עַל הַפָּרֹכֶת, וְעַל מִזְבַּח הַזָּהָב. מַתָּנָה אַחַת מֵהֶן מְעַכֶּבֶת. " +
            "שְׁיָרֵי הַדָּם הָיָה שׁוֹפֵךְ עַל יְסוֹד מַעֲרָבִי שֶׁל מִזְבֵּחַ הַחִיצוֹן. אִם לֹא נָתַן לֹא עִכֵּב. " +
            "אֵלוּ וָאֵלוּ נִשְׂרָפִים בְּבֵית הַדָּשֶׁן."
        )

        PrayerText(
            "חַטֹּאות הַצִּבּוּר וְהַיָּחִיד, אֵלוּ הֵן חַטֹּאות הַצִּבּוּר: שְׂעִירֵי רָאשֵׁי חֳדָשִׁים וְשֶׁל מוֹעֲדוֹת, " +
            "שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, " +
            "וְדָמָן טָעוּן אַרְבַּע מַתָּנוֹת עַל אַרְבַּע קְרָנוֹת. כֵּיצַד, עָלָה בַכֶּבֶשׁ וּפָנָה לַסּוֹבֵב, " +
            "וּבָא לוֹ לְקֶרֶן דְּרוֹמִית מִזְרָחִית, מִזְרָחִית צְפוֹנִית, צְפוֹנִית מַעֲרָבִית, מַעֲרָבִית דְּרוֹמִית. " +
            "שְׁיָרֵי הַדָּם הָיָה שׁוֹפֵךְ עַל יְסוֹד דְּרוֹמִי. " +
            "וְנֶאֱכָלִים לִפְנִים מִן הַקְּלָעִים, לְזִכְרֵי כְהֻנָּה, בְּכָל מַאֲכָל, לְיוֹם וָלַיְלָה עַד חֲצוֹת."
        )

        PrayerText(
            "הָעוֹלָה קָדְשֵׁי קָדָשִׁים, שְׁחִיטָתָהּ בַּצָּפוֹן, וְקִבּוּל דָּמָהּ בִּכְלִי שָׁרֵת בַּצָּפוֹן, " +
            "וְדָמָהּ טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע. " +
            "וּטְעוּנָה הֶפְשֵׁט וְנִתּוּחַ וְכָלִיל לָאִשׁ."
        )

        PrayerText(
            "זִבְחֵי שַׁלְמֵי צִבּוּר וַאֲשָׁמוֹת, אֵלוּ הֵן אֲשָׁמוֹת: אֲשַׁם גְּזֵלוֹת, אֲשַׁם מְעִילוֹת, " +
            "אֲשַׁם שִׁפְחָה חֲרוּפָה, אֲשַׁם נָזִיר, אֲשַׁם מְצוֹרָע, אֲשַׁם תָּלוּי. " +
            "שְׁחִיטָתָן בַּצָּפוֹן, וְקִבּוּל דָּמָן בִּכְלִי שָׁרֵת בַּצָּפוֹן, " +
            "וְדָמָן טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע. " +
            "וְנֶאֱכָלִים לִפְנִים מִן הַקְּלָעִים, לְזִכְרֵי כְהֻנָּה, בְּכָל מַאֲכָל, לְיוֹם וָלַיְלָה עַד חֲצוֹת."
        )

        PrayerText(
            "הַתּוֹדָה וְאֵיל נָזִיר קָדָשִׁים קַלִּים, שְׁחִיטָתָן בְּכָל מָקוֹם בָּעֲזָרָה, " +
            "וְדָמָן טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע. " +
            "וְנֶאֱכָלִין בְּכָל הָעִיר, לְכָל אָדָם, בְּכָל מַאֲכָל, לְיוֹם וָלַיְלָה עַד חֲצוֹת. " +
            "הַמּוּרָם מֵהֶם כַּיּוֹצֵא בָהֶם, אֶלָּא שֶׁהַמּוּרָם נֶאֱכָל לַכֹּהֲנִים, לִנְשֵׁיהֶם, וְלִבְנֵיהֶם, וּלְעַבְדֵיהֶם."
        )

        PrayerText(
            "שְׁלָמִים קָדָשִׁים קַלִּים, שְׁחִיטָתָן בְּכָל מָקוֹם בָּעֲזָרָה, " +
            "וְדָמָן טָעוּן שְׁתֵּי מַתָּנוֹת שֶׁהֵן אַרְבַּע. " +
            "וְנֶאֱכָלִין בְּכָל הָעִיר, לְכָל אָדָם, בְּכָל מַאֲכָל, לִשְׁנֵי יָמִים וְלַיְלָה אֶחָד. " +
            "הַמּוּרָם מֵהֶם כַּיּוֹצֵא בָהֶם, אֶלָּא שֶׁהַמּוּרָם נֶאֱכָל לַכֹּהֲנִים, לִנְשֵׁיהֶם, וְלִבְנֵיהֶם, וּלְעַבְדֵיהֶם."
        )

        PrayerText(
            "הַבְּכוֹר וְהַמַּעֲשֵׂר וְהַפֶּסַח קָדָשִׁים קַלִּים, שְׁחִיטָתָן בְּכָל מָקוֹם בָּעֲזָרָה, " +
            "וְדָמָן טָעוּן מַתָּנָה אַחַת, וּבִלְבַד שֶׁיִּתֵּן כְּנֶגֶד הַיְסוֹד. " +
            "שִׁנָּה בַאֲכִילָתָן. הַבְּכוֹר נֶאֱכָל לַכֹּהֲנִים, וְהַמַּעֲשֵׂר לְכָל אָדָם. " +
            "וְנֶאֱכָלִין בְּכָל הָעִיר, בְּכָל מַאֲכָל, לִשְׁנֵי יָמִים וְלַיְלָה אֶחָד. " +
            "הַפֶּסַח אֵינוֹ נֶאֱכָל אֶלָּא בַלַּיְלָה, וְאֵינוֹ נֶאֱכָל אֶלָּא עַד חֲצוֹת, " +
            "וְאֵינוֹ נֶאֱכָל אֶלָּא לִמְנוּיָיו, וְאֵינוֹ נֶאֱכָל אֶלָּא צָלִי."
        )

        Spacer(Modifier.height(32.dp))
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text = text,
        fontSize = 22.sp,
        fontWeight = FontWeight.Bold,
        fontFamily = BaHaYetzira,
        color = Primary,
        textAlign = TextAlign.End,
        modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp)
    )
}

@Composable
private fun PrayerText(text: String) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(1.dp)
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(14.dp),
            fontSize = 18.sp,
            lineHeight = 30.sp,
            fontFamily = SblHebrew,
            color = Ink,
            style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
        )
    }
}

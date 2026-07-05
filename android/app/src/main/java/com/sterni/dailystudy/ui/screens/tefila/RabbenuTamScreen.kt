package com.sterni.dailystudy.ui.screens.tefila

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.Primary
import com.sterni.dailystudy.ui.theme.SblHebrew

@Composable
fun RabbenuTamScreen(onBack: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFFDFBF7))
            .statusBarsPadding()
    ) {
        Surface(shadowElevation = 0.dp, color = Color(0xFFFDFBF7)) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 4.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack) {
                    Icon(Icons.Default.ArrowForward, contentDescription = "חזור", tint = Primary)
                }
                Text(
                    "קריאת שמע לפי רבינו תם",
                    modifier = Modifier.weight(1f),
                    textAlign = TextAlign.Center,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = Primary,
                    maxLines = 1
                )
                Spacer(Modifier.width(48.dp))
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(top = 12.dp, bottom = 48.dp)
        ) {
            item {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 24.dp)
                ) {
                    Text(
                        text = "שְׁמַע יִשְׂרָאֵל יְיָ אֱלֹהֵינוּ יְיָ | אֶחָד:",
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 4.dp),
                        textAlign = TextAlign.Center,
                        fontSize = 22.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = SblHebrew,
                        color = Color(0xFF1A1A1A),
                        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )

                    Text(
                        text = "בָּרוּךְ שֵׁם כְּבוֹד מַלְכוּתוֹ לְעוֹלָם וָעֶד:",
                        modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
                        textAlign = TextAlign.Center,
                        fontSize = 17.sp,
                        fontFamily = SblHebrew,
                        color = Color(0xFF1A1A1A),
                        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
                    )

                    RtParagraphText("וְאָהַבְתָּ אֵת יְיָ אֱלֹהֶֽיךָ בְּכָל֯־לְ֯בָבְךָ וּבְכָל־נַפשְׁךָ וּבְכָל־מְאֹדֶֽךָ: וְהָיוּ הַדְּבָרִים הָאֵֽלֶּה אֲשֶׁר֯ אָ֯נֹכִי מְצַוְּךָ הַיּוֹם עַל֯־לְ֯בָבֶֽךָ: וְשִׁנַּנְתָּם לְבָנֶֽיךָ וְדִבַּרְתָּ בָּם בְּשִׁבְתְּךָ בְּבֵיתֶֽךָ וּבְלֶכְתְּךָ בַדֶּֽרֶךְ וּבְשָׁכְבְּךָ וּבְקוּמֶֽךָ: וּקְשַׁרְתָּם לְאוֹת עַל֯־יָ֯דֶֽךָ וְהָיוּ לְטֹטָפֹת בֵּין עֵינֶֽיךָ: וּכְתַבְתָּם עַל־מְזֻזוֹת בֵּיתֶֽךָ וּבִשְׁעָרֶֽיךָ:")

                    Spacer(Modifier.height(16.dp))

                    RtParagraphText("וְהָיָה אִם־שָׁמֹֽעַ תִּשְׁמְעוּ אֶל־מִצְוֹתַי אֲשֶׁר֯ אָ֯נֹכִי מְצַוֶּה אֶתְכֶם הַיּוֹם לְאַהֲבָה אֶת־יְיָ אֱלֹהֵיכֶם וּלְעָבְדוֹ בְּכָל֯־לְ֯בַבְכֶם וּבְכָל־נַפְשְׁכֶם: וְנָתַתִּי מְטַר֯־אַ֯רְצְכֶם בְּעִתּוֹ֯ י֯וֹרֶה וּמַלְקוֹשׁ וְאָסַפְתָּ דְגָנֶֽךָ וְתִירשְׁךָ וְיִצְהָרֶֽךָ: וְנָתַתִּי עֵֽשֶׂב֯ בְּ֯שָׂדְךָ לִבְהֶמְתֶּֽךָ וְאָכַלְתָּ וְשָׁבָֽעְתָּ: הִשָּׁמְרוּ לָכֶם פֶּן֯־יִ֯פְתֶּה לְבַבְכֶם וְסַרְתֶּם וַעֲבַדְתֶּם אֱלֹהִים֯ אֲ֯חֵרִים וְהִשְׁתַּחֲוִיתֶם לָהֶם: וְחָרָה אַף־יְיָ בָּכֶם וְעָצַר֯ אֶ֯ת־הַשָּׁמַֽיִם וְלֹּא֯־יִ֯הְיֶה מָטָר וְהָאֲדָמָה לֹא תִתֵּן אֶת֯־יְ֯בוּלָהּ וַאֲבַדְתֶּם֯ מְ֯הֵרָה מֵעַל הָאָֽרֶץ הַטֹּבָה אֲשֶׁר֯ יְ֯יָ נֹתֵן לָכֶם: וְשַׂמְתֶּם֯ אֶ֯ת־דְּבָרַי֯ אֵֽ֯לֶּה עַל֯־לְ֯בַבְכֶם וְעַל־נַפְשְׁכֶם וּקְשַׁרְתֶּם֯ אֹ֯תָם לְאוֹת עַל֯־יֶ֯דְכֶם וְהָיוּ לְטוֹטָפֹת בֵּין עֵינֵיכֶם: וְלִמַּדְתֶּם֯ אֹ֯תָם אֶת־בְּנֵיכֶם לְדַבֵּר בָּם בְּשִׁבְתְּךָ בְּבֵיתֶֽךָ וּבְלֶכְתְּךָ בַדֶּֽרֶךְ וּבְשָׁכְבְּךָ וּבְקוּמֶֽךָ: וּכְתַבְתָּם עַל־מְזוּזוֹת בֵּיתֶֽךָ וּבִשְׁעָרֶֽיךָ: לְמַֽעַן֯ יִ֯רְבּוּ יְמֵיכֶם וִימֵי בְנֵיכֶם עַל הָאֲדָמָה אֲשֶׁר נִשְׁבַּע יְיָ לַאֲבֹתֵיכֶם לָתֵת לָהֶם כִּימֵי הַשָּׁמַֽיִם עַל־הָאָֽרֶץ:")

                    Spacer(Modifier.height(16.dp))

                    RtParagraphText("וַֽיֹּאמֶר֯ יְ֯יָ אֶ֯ל־משֶׁה לֵּאמֹר: דַּבֵּר֯ אֶ֯ל־בְּנֵי יִשְׂרָאֵל וְאָמַרְתָּ אֲלֵהֶם וְעָשׂוּ לָהֶם צִיצִת עַל־כַּנְפֵי בִגְדֵיהֶם לְדֹרֹתָם וְנָתְנוּ עַל־צִיצִת הַכָּנָף֯ פְּ֯תִיל תְּכֵֽלֶת: וְהָיָה לָכֶם לְצִיצִת וּרְאִיתֶם֯ אֹ֯תוֹ וּזְכַרְתֶּם֯ אֶ֯ת־כָּל־מִצְוֹת֯ יְ֯יָ וַעֲשִׂיתֶם֯ אֹ֯תָם וְלֹא תָתֽוּרוּ אַחֲרֵי לְבַבְכֶם וְאַחֲרֵי עֵינֵיכֶם אֲשֶׁר֯־אַ֯תֶּם זֹנִים֯ אַ֯חֲרֵיהֶם: לְמַֽעַן תִּזְכְּרוּ וַעֲשִׂיתֶם֯ אֶ֯ת־כָּל־מִצְוֹתָי וִהְיִיתֶם קְדשִׁים לֵאלֹהֵיכֶם: אֲנִי יְיָ אֱלֹהֵיכֶם֯ אֲ֯שֶׁר הוֹצֵֽאתִי אֶתְכֶם֯ מֵ֯אֶֽרֶץ מִצְרַֽיִם לִהְיוֹת לָכֶם לֵאלֹהִים֯ אֲ֯נִי יְיָ אֱלֹהֵיכֶם֯: אֱמֶת:")

                    Spacer(Modifier.height(16.dp))

                    RtParagraphText("וַיְדַבֵּ֥ר יְהֹוָ֖ה אֶל־מֹשֶׁ֥ה לֵּאמֹֽר׃ קַדֶּשׁ־לִ֨י כׇל־בְּכ֜וֹר פֶּ֤טֶר כׇּל־רֶ֙חֶם֙ בִּבְנֵ֣י יִשְׂרָאֵ֔ל בָּאָדָ֖ם וּבַבְּהֵמָ֑ה לִ֖י הֽוּא׃ וַיֹּ֨אמֶר מֹשֶׁ֜ה אֶל־הָעָ֗ם זָכ֞וֹר אֶת־הַיּ֤וֹם הַזֶּה֙ אֲשֶׁ֨ר יְצָאתֶ֤ם מִמִּצְרַ֙יִם֙ מִבֵּ֣ית עֲבָדִ֔ים כִּ֚י בְּחֹ֣זֶק יָ֔ד הוֹצִ֧יא יְהֹוָ֛ה אֶתְכֶם מִזֶּ֑ה וְלֹ֥א יֵאָכֵ֖ל חָמֵֽץ׃ הַיּ֖וֹם אַתֶּ֣ם יֹצְאִ֑ים בְּחֹ֖דֶשׁ הָאָבִֽיב׃ וְהָיָה כִֽי־יְבִיאֲךָ֣ יְהֹוָ֡ה אֶל־אֶ֣רֶץ הַֽ֠כְּנַעֲנִ֠י וְהַחִתִּ֨י וְהָאֱמֹרִ֜י וְהַחִוִּ֣י וְהַיְבוּסִ֗י אֲשֶׁ֨ר נִשְׁבַּ֤ע לַאֲבֹתֶ֙יךָ֙ לָ֣תֶת לָ֔ךְ אֶ֛רֶץ זָבַ֥ת חָלָ֖ב וּדְבָ֑שׁ וְעָבַדְתָּ֛ אֶת־הָעֲבֹדָ֥ה הַזֹּ֖את בַּחֹ֥דֶשׁ הַזֶּֽה׃ שִׁבְעַ֥ת יָמִ֖ים תֹּאכַ֣ל מַצֹּ֑ת וּבַיּוֹם֙ הַשְּׁבִיעִ֔י חַ֖ג לַיהֹוָֽה׃ מַצּוֹת֙ יֵֽאָכֵ֔ל אֵ֖ת שִׁבְעַ֣ת הַיָּמִ֑ים וְלֹֽא־יֵרָאֶ֨ה לְךָ֜ חָמֵ֗ץ וְלֹֽא־יֵרָאֶ֥ה לְךָ֛ שְׂאֹ֖ר בְּכׇל־גְּבֻלֶֽךָ׃ וְהִגַּדָּ֣ לְבִנְךָ֔ בַּיּ֥וֹם הַה֖וּא לֵאמֹ֑ר בַּעֲב֣וּר זֶ֗ה עָשָׂ֤ה יְיָ֙ לִ֔י בְּצֵאתִ֖י מִמִּצְרָֽיִם׃ וְהָיָה֩ לְךָ֨ לְא֜וֹת עַל־יָדְךָ֗ וּלְזִכָּרוֹן֙ בֵּ֣ין עֵינֶ֔יךָ לְמַ֗עַן תִּהְיֶ֛ה תּוֹרַ֥ת יְהֹוָ֖ה בְּפִ֑יךָ כִּ֚י בְּיָ֣ד חֲזָקָ֔ה הוֹצִֽאֲךָ֥ יְהֹוָ֖ה מִמִּצְרָֽיִם׃ וְשָׁמַרְתָּ֛ אֶת־הַחֻקָּ֥ה הַזֹּ֖את לְמוֹעֲדָ֑הּ מִיָּמִ֖ים יָמִֽימָה׃")
                }
            }
        }
    }
}

@Composable
private fun RtParagraphText(text: String) {
    Text(
        text = text,
        modifier = Modifier.fillMaxWidth(),
        fontSize = 20.sp,
        fontFamily = SblHebrew,
        color = Color(0xFF1A1A1A),
        lineHeight = 34.sp,
        textAlign = TextAlign.Justify,
        style = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

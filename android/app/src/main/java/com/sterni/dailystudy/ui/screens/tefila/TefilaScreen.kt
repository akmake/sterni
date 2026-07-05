package com.sterni.dailystudy.ui.screens.tefila

import android.content.Context
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowForward
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sterni.dailystudy.ui.theme.*

private val LightBg = Color(0xFFFDFBF7)

private enum class TefilaSection { EIZEHU, KSHEMA }

// ── Eizehu ────────────────────────────────────────────────────────────────────

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

// ── Kriat Shema ───────────────────────────────────────────────────────────────

private sealed class KshemaLine {
    data class ShemaIsrael(val text: String) : KshemaLine()
    data class BaruchShem(val text: String) : KshemaLine()
    data class Paragraph(val text: String) : KshemaLine()
}

private val KSHEMA_LINES: List<KshemaLine> = listOf(
    KshemaLine.ShemaIsrael("שְׁמַע יִשְׂרָאֵל יְיָ אֱלֹהֵינוּ יְיָ | אֶחָד:"),
    KshemaLine.BaruchShem("בָּרוּךְ שֵׁם כְּבוֹד מַלְכוּתוֹ לְעוֹלָם וָעֶד:"),
    KshemaLine.Paragraph(
        "וְאָהַבְתָּ אֵת יְיָ אֱלֹהֶֽיךָ בְּכָל֯־לְ֯בָבְךָ וּבְכָל־נַפְשְׁךָ וּבְכָל־מְאֹדֶֽךָ: וְהָיוּ הַדְּבָרִים הָאֵֽלֶּה אֲשֶׁר֯ אָ֯נֹכִי מְצַוְּךָ הַיּוֹם עַל֯־לְ֯בָבֶֽךָ: וְשִׁנַּנְתָּם לְבָנֶֽיךָ וְדִבַּרְתָּ בָּם בְּשִׁבְתְּךָ בְּבֵיתֶֽךָ וּבְלֶכְתְּךָ בַדֶּֽרֶךְ וּבְשָׁכְבְּךָ וּבְקוּמֶֽךָ: וּקְשַׁרְתָּם לְאוֹת עַל֯־יָ֯דֶֽךָ וְהָיוּ לְטֹטָפֹת בֵּין עֵינֶֽיךָ: וּכְתַבְתָּם עַל־מְזֻזוֹת בֵּיתֶֽךָ וּבִשְׁעָרֶֽיךָ:"
    ),
    KshemaLine.Paragraph(
        "וְהָיָה אִם־שָׁמֹֽעַ תִּשְׁמְעוּ אֶל־מִצְוֹתַי אֲשֶׁר֯ אָ֯נֹכִי מְצַוֶּה אֶתְכֶם הַיּוֹם לְאַהֲבָה אֶת־יְיָ אֱלֹהֵיכֶם וּלְעָבְדוֹ בְּכָל֯־לְ֯בַבְכֶם וּבְכָל־נַפְשְׁכֶם: וְנָתַתִּי מְטַר֯־אַ֯רְצְכֶם בְּעִתּוֹ֯ י֯וֹרֶה וּמַלְקוֹשׁ וְאָסַפְתָּ דְגָנֶֽךָ וְתִירשְׁךָ וְיִצְהָרֶֽךָ: וְנָתַתִּי עֵֽשֶׂב֯ בְּ֯שָׂדְךָ לִבְהֶמְתֶּֽךָ וְאָכַלְתָּ וְשָׂבָֽעְתָּ: הִשָּׁמְרוּ לָכֶם פֶּן֯־יִ֯פְתֶּה לְבַבְכֶם וְסַרְתֶּם וַעֲבַדְתֶּם אֱלֹהִים֯ אֲ֯חֵרִים וְהִשְׁתַּחֲוִיתֶם לָהֶם: וְחָרָה אַף־יְיָ בָּכֶם וְעָצַר֯ אֶ֯ת־הַשָּׁמַֽיִם וְלֹּא֯־יִ֯הְיֶה מָטָר וְהָאֲדָמָה לֹא תִתֵּן אֶת֯־יְ֯בוּלָהּ וַאֲבַדְתֶּם֯ מְ֯הֵרָה מֵעַל הָאָֽרֶץ הַטֹּבָה אֲשֶׁר֯ יְ֯יָ נֹתֵן לָכֶם: וְשַׂמְתֶּם֯ אֶ֯ת־דְּבָרַי֯ אֵֽ֯לֶּה עַל֯־לְ֯בַבְכֶם וְעַל־נַפְשְׁכֶם וּקְשַׁרְתֶּם֯ אֹ֯תָם לְאוֹת עַל֯־יֶ֯דְכֶם וְהָיוּ לְטוֹטָפֹת בֵּין עֵינֵיכֶם: וְלִמַּדְתֶּם֯ אֹ֯תָם אֶת־בְּנֵיכֶם לְדַבֵּר בָּם בְּשִׁבְתְּךָ בְּבֵיתֶֽךָ וּבְלֶכְתְּךָ בַדֶּֽרֶךְ וּבְשָׁכְבְּךָ וּבְקוּמֶֽךָ: וּכְתַבְתָּם עַל־מְזוּזוֹת בֵּיתֶֽךָ וּבִשְׁעָרֶֽיךָ: לְמַֽעַן֯ יִ֯רְבּוּ יְמֵיכֶם וִימֵי בְנֵיכֶם עַל הָאֲדָמָה אֲשֶׁר נִשְׁבַּע יְיָ לַאֲבֹתֵיכֶם לָתֵת לָהֶם כִּימֵי הַשָּׁמַֽיִם עַל־הָאָֽרֶץ:"
    ),
    KshemaLine.Paragraph(
        "וַֽיֹּאמֶר֯ יְ֯יָ אֶ֯ל־משֶׁה לֵּאמֹר: דַּבֵּר֯ אֶ֯ל־בְּנֵי יִשְׂרָאֵל וְאָמַרְתָּ אֲלֵהֶם וְעָשׂוּ לָהֶם צִיצִת עַל־כַּנְפֵי בִגְדֵיהֶם לְדֹרֹתָם וְנָתְנוּ עַל־צִיצִת הַכָּנָף֯ פְּ֯תִיל תְּכֵֽלֶת: וְהָיָה לָכֶם לְצִיצִת וּרְאִיתֶם֯ אֹ֯תוֹ וּזְכַרְתֶּם֯ אֶ֯ת־כָּל־מִצְוֹת֯ יְ֯יָ וַעֲשִׂיתֶם֯ אֹ֯תָם וְלֹא תָתֽוּרוּ אַחֲרֵי לְבַבְכֶם וְאַחֲרֵי עֵינֵיכֶם אֲשֶׁר֯־אַ֯תֶּם זֹנִים֯ אַ֯חֲרֵיהֶם: לְמַֽעַן תִּזְכְּרוּ וַעֲשִׂיתֶם֯ אֶ֯ת־כָּל־מִצְוֹתָי וִהְיִיתֶם קְדשִׁים לֵאלֹהֵיכֶם: אֲנִי יְיָ אֱלֹהֵיכֶם֯ אֲ֯שֶׁר הוֹצֵֽאתִי אֶתְכֶם֯ מֵ֯אֶֽרֶץ מִצְרַֽיִם לִהְיוֹת לָכֶם לֵאלֹהִים֯ אֲ֯נִי יְיָ אֱלֹהֵיכֶם֯: אֱמֶת:"
    ),
    KshemaLine.Paragraph(
        "וַיְדַבֵּ֥ר יְהֹוָ֖ה אֶל־מֹשֶׁ֥ה לֵּאמֹֽר׃ קַדֶּשׁ־לִ֨י כׇל־בְּכ֜וֹר פֶּ֤טֶר כׇּל־רֶ֙חֶם֙ בִּבְנֵ֣י יִשְׂרָאֵ֔ל בָּאָדָ֖ם וּבַבְּהֵמָ֑ה לִ֖י הֽוּא׃ וַיֹּ֨אמֶר מֹשֶׁ֜ה אֶל־הָעָ֗ם זָכ֞וֹר אֶת־הַיּ֤וֹם הַזֶּה֙ אֲשֶׁ֨ר יְצָאתֶ֤ם מִמִּצְרַ֙יִם֙ מִבֵּ֣ית עֲבָדִ֔ים כִּ֚י בְּחֹ֣זֶק יָ֔ד הוֹצִ֧יא יְהֹוָ֛ה אֶתְכֶ֖ם מִזֶּ֑ה וְלֹ֥א יֵאָכֵ֖ל חָמֵֽץ׃ הַיּ֖וֹם אַתֶּ֣ם יֹצְאִ֑ים בְּחֹ֖דֶשׁ הָאָבִֽיב׃ וְהָיָ֣ה כִֽי־יְבִיאֲךָ֣ יְהֹוָ֡ה אֶל־אֶ֣רֶץ הַֽ֠כְּנַעֲנִ֠י וְהַחִתִּ֨י וְהָאֱמֹרִ֜י וְהַחִוִּ֣י וְהַיְבוּסִ֗י אֲשֶׁ֨ר נִשְׁבַּ֤ע לַאֲבֹתֶ֙יךָ֙ לָ֣תֶת לָ֔ךְ אֶ֛רֶץ זָבַ֥ת חָלָ֖ב וּדְבָ֑שׁ וְעָבַדְתָּ֛ אֶת־הָעֲבֹדָ֥ה הַזֹּ֖את בַּחֹ֥דֶשׁ הַזֶּֽה׃ שִׁבְעַ֥ת יָמִ֖ים תֹּאכַ֣ל מַצֹּ֑ת וּבַיּוֹם֙ הַשְּׁבִיעִ֔י חַ֖ג לַיהֹוָֽה׃ מַצּוֹת֙ יֵֽאָכֵ֔ל אֵ֖ת שִׁבְעַ֣ת הַיָּמִ֑ים וְלֹֽא־יֵרָאֶ֨ה לְךָ֜ חָמֵ֗ץ וְלֹֽא־יֵרָאֶ֥ה לְךָ֛ שְׂאֹ֖ר בְּכׇל־גְּבֻלֶֽךָ׃ וְהִגַּדְתָּ֣ לְבִנְךָ֔ בַּיּ֥וֹם הַה֖וּא לֵאמֹ֑ר בַּעֲב֣וּר זֶ֗ה עָשָׂ֤ה יְיָ֙ לִ֔י בְּצֵאתִ֖י מִמִּצְרָֽיִם׃ וְהָיָה֩ לְךָ֨ לְא֜וֹת עַל־יָדְךָ֗ וּלְזִכָּרוֹן֙ בֵּ֣ין עֵינֶ֔יךָ לְמַ֗עַן תִּהְיֶ֛ה תּוֹרַ֥ת יְהֹוָ֖ה בְּפִ֑יךָ כִּ֚י בְּיָ֣ד חֲזָקָ֔ה הוֹצִֽאֲךָ֥ יְהֹוָ֖ה מִמִּצְרָֽיִם׃ וְשָׁמַרְתָּ֛ אֶת־הַחֻקָּ֥ה הַזֹּ֖את לְמוֹעֲדָ֑הּ מִיָּמִ֖ים יָמִֽימָה׃ וְהָיָ֞ה כִּֽי־יְבִאֲךָ֤ יְיָ֙ אֶל־אֶ֣רֶץ הַֽכְּנַעֲנִ֔י כַּאֲשֶׁ֛ר נִשְׁבַּ֥ע לְךָ֖ וְלַֽאֲבֹתֶ֑יךָ וּנְתָנָ֖הּ לָֽךְ׃ וְהַעֲבַרְתָּ֥ כׇל־פֶּֽטֶר־רֶ֖חֶם לַֽיהֹוָ֑ה וְכׇל־פֶּ֣טֶר ׀ שֶׁ֣גֶר בְּהֵמָ֗ה אֲשֶׁ֨ר יִהְיֶ֥ה לְךָ֛ הַזְּכָרִ֖ים לַיהֹוָֽה׃ וְכׇל־פֶּ֤טֶר חֲמֹר֙ תִּפְדֶּ֣ה בְשֶׂ֔ה וְאִם־לֹ֥א תִפְדֶּ֖ה וַעֲרַפְתּ֑וֹ וְכֹ֨ל בְּכ֥וֹר אָדָ֛ם בְּבָנֶ֖יךָ תִּפְדֶּֽה׃ וְהָיָ֞ה כִּֽי־יִשְׁאָלְךָ֥ בִנְךָ֛ מָחָ֖ר לֵאמֹ֣ר מַה־זֹּ֑את וְאָמַרְתָּ֣ אֵלָ֔יו בְּחֹ֣זֶק יָ֗ד הוֹצִיאָ֧נוּ יְהֹוָ֛ה מִמִּצְרַ֖יִם מִבֵּ֥ית עֲבָדִֽים׃ וַיְהִ֗י כִּֽי־הִקְשָׁ֣ה פַרְעֹה֮ לְשַׁלְּחֵנוּ וַיַּהֲרֹ֨ג יְהֹוָ֤ה כׇּל־בְּכוֹר֙ בְּאֶ֣רֶץ מִצְרַ֔יִם מִבְּכֹ֥ר אָדָ֖ם וְעַד־בְּכ֣וֹר בְּהֵמָ֑ה עַל־כֵּן֩ אֲנִ֨י זֹבֵ֜חַ לַֽיהֹוָ֗ה כׇּל־פֶּ֤טֶר רֶ֙חֶם֙ הַזְּכָרִ֔ים וְכׇל־בְּכ֥וֹר בָּנַ֖י אֶפְדֶּֽה׃ וְהָיָ֤ה לְאוֹת֙ עַל־יָ֣דְכָ֔ה וּלְטוֹטָפֹ֖ת בֵּ֣ין עֵינֶ֑יךָ כִּ֚י בְּחֹ֣זֶק יָ֔ד הוֹצִיאָ֥נוּ יְהֹוָ֖ה מִמִּצְרָֽיִם׃"
    )
)

// ── Screen ────────────────────────────────────────────────────────────────────

@Composable
fun TefilaScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    var selectedSection by remember { mutableStateOf<TefilaSection?>(null) }
    var showSettings by remember { mutableStateOf(false) }

    val prefs = remember { context.getSharedPreferences("TefilaPrefs", Context.MODE_PRIVATE) }
    val eizFontSize  = remember { mutableIntStateOf(prefs.getInt("eizehu_font_size", 20)) }
    val kshemaFontSize = remember { mutableIntStateOf(prefs.getInt("kshema_font_size", 20)) }

    val currentFontSize = when (selectedSection) {
        TefilaSection.EIZEHU -> eizFontSize.intValue
        TefilaSection.KSHEMA -> kshemaFontSize.intValue
        null -> 20
    }

    if (showSettings) {
        FontSizeDialog(
            fontSize  = currentFontSize,
            onDismiss = { showSettings = false },
            onSave    = { size ->
                when (selectedSection) {
                    TefilaSection.EIZEHU -> {
                        eizFontSize.intValue = size
                        prefs.edit().putInt("eizehu_font_size", size).apply()
                    }
                    TefilaSection.KSHEMA -> {
                        kshemaFontSize.intValue = size
                        prefs.edit().putInt("kshema_font_size", size).apply()
                    }
                    null -> {}
                }
                showSettings = false
            }
        )
    }

    Scaffold(
        containerColor = LightBg,
        topBar = {
            Surface(shadowElevation = 0.dp, color = LightBg) {
                Column {
                    Spacer(Modifier.statusBarsPadding())
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(56.dp)
                            .padding(horizontal = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(onClick = {
                            if (selectedSection == null) onBack() else selectedSection = null
                        }) {
                            Icon(Icons.Default.ArrowForward, contentDescription = "חזור", tint = Primary)
                        }
                        Text(
                            text = when (selectedSection) {
                                TefilaSection.EIZEHU -> "איזהו מקומן"
                                TefilaSection.KSHEMA -> "ק\"ש תפילין ר\"ת"
                                null                 -> "תפילה"
                            },
                            modifier   = Modifier.weight(1f),
                            textAlign  = TextAlign.Center,
                            fontSize   = 19.sp,
                            fontWeight = FontWeight.Bold,
                            color      = Primary,
                            fontFamily = BaHaYetzira
                        )
                        if (selectedSection != null) {
                            IconButton(onClick = { showSettings = true }) {
                                Icon(Icons.Default.Settings, contentDescription = "הגדרות", tint = Primary)
                            }
                        } else {
                            Spacer(Modifier.width(48.dp))
                        }
                    }
                }
            }
        }
    ) { padding ->
        when (selectedSection) {
            null -> TefilaMenu(
                modifier      = Modifier.padding(padding),
                onEizehuClick = { selectedSection = TefilaSection.EIZEHU },
                onKshemaClick = { selectedSection = TefilaSection.KSHEMA }
            )
            TefilaSection.EIZEHU -> EizehuContent(
                modifier = Modifier.padding(padding),
                fontSize = eizFontSize.intValue
            )
            TefilaSection.KSHEMA -> KshemaContent(
                modifier = Modifier.padding(padding),
                fontSize = kshemaFontSize.intValue
            )
        }
    }
}

// ── Menu ──────────────────────────────────────────────────────────────────────

@Composable
private fun TefilaMenu(
    modifier: Modifier = Modifier,
    onEizehuClick: () -> Unit,
    onKshemaClick: () -> Unit
) {
    Column(
        modifier            = modifier
            .fillMaxSize()
            .padding(horizontal = 20.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        SectionCard(
            title    = "איזהו מקומן",
            subtitle = "סדר קרבנות — פרק ה׳ מזבחים",
            color    = Color(0xFF4A148C),
            onClick  = onEizehuClick
        )
        SectionCard(
            title    = "ק\"ש תפילין רבינו תם",
            subtitle = "שלוש פרשיות עם פסוקי שמע",
            color    = Color(0xFF1B5E20),
            onClick  = onKshemaClick
        )
    }
}

@Composable
private fun SectionCard(title: String, subtitle: String, color: Color, onClick: () -> Unit) {
    Card(
        onClick   = onClick,
        modifier  = Modifier.fillMaxWidth(),
        shape     = RoundedCornerShape(16.dp),
        colors    = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(2.dp)
    ) {
        Row(modifier = Modifier.padding(20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(modifier = Modifier.size(6.dp, 40.dp).background(color, RoundedCornerShape(3.dp)))
            Spacer(Modifier.width(16.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    title,
                    fontSize   = 20.sp,
                    fontWeight = FontWeight.Bold,
                    fontFamily = BaHaYetzira,
                    color      = Ink,
                    textAlign  = TextAlign.End,
                    modifier   = Modifier.fillMaxWidth()
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    subtitle,
                    fontSize  = 14.sp,
                    fontFamily = SblHebrew,
                    color     = Muted,
                    textAlign = TextAlign.End,
                    modifier  = Modifier.fillMaxWidth()
                )
            }
        }
    }
}

// ── Eizehu content ────────────────────────────────────────────────────────────

@Composable
private fun EizehuContent(modifier: Modifier = Modifier, fontSize: Int) {
    LazyColumn(
        modifier       = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 48.dp)
    ) {
        items(EIZEHU_PARAGRAPHS) { text ->
            EizehoParagraph(text, fontSize)
            Spacer(Modifier.height(20.dp))
        }
    }
}

@Composable
private fun EizehoParagraph(text: String, fontSize: Int) {
    val firstSpace = text.indexOf(' ')
    val firstWord  = if (firstSpace >= 0) text.substring(0, firstSpace) else text
    val rest       = if (firstSpace >= 0) text.substring(firstSpace) else ""

    val annotated = buildAnnotatedString {
        withStyle(SpanStyle(color = Primary, fontWeight = FontWeight.Bold, fontSize = (fontSize + 2).sp)) {
            append(firstWord)
        }
        append(rest)
    }

    Text(
        text       = annotated,
        modifier   = Modifier.fillMaxWidth(),
        fontSize   = fontSize.sp,
        fontFamily = SblHebrew,
        color      = Color(0xFF1A1A2A),
        lineHeight = (fontSize * 1.85f).sp,
        textAlign  = TextAlign.Justify,
        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

// ── Kshema content ────────────────────────────────────────────────────────────

@Composable
private fun KshemaContent(modifier: Modifier = Modifier, fontSize: Int) {
    LazyColumn(
        modifier       = modifier.fillMaxSize(),
        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 16.dp, bottom = 48.dp)
    ) {
        items(KSHEMA_LINES) { line ->
            when (line) {
                is KshemaLine.ShemaIsrael -> ShemaIsraelLine(line.text, fontSize)
                is KshemaLine.BaruchShem  -> BaruchShemLine(line.text, fontSize)
                is KshemaLine.Paragraph   -> KshemaParagraph(line.text, fontSize)
            }
            Spacer(Modifier.height(14.dp))
        }
    }
}

@Composable
private fun ShemaIsraelLine(text: String, fontSize: Int) {
    Text(
        text       = text,
        modifier   = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        fontSize   = (fontSize + 12).sp,
        fontWeight = FontWeight.Bold,
        fontFamily = SblHebrew,
        color      = Primary,
        textAlign  = TextAlign.Center,
        lineHeight = ((fontSize + 12) * 1.4f).sp,
        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

@Composable
private fun BaruchShemLine(text: String, fontSize: Int) {
    Text(
        text       = text,
        modifier   = Modifier.fillMaxWidth().padding(bottom = 8.dp),
        fontSize   = (fontSize + 2).sp,
        fontFamily = SblHebrew,
        color      = Color(0xFF555555),
        textAlign  = TextAlign.Center,
        lineHeight = ((fontSize + 2) * 1.5f).sp,
        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

@Composable
private fun KshemaParagraph(text: String, fontSize: Int) {
    Text(
        text       = text,
        modifier   = Modifier.fillMaxWidth(),
        fontSize   = fontSize.sp,
        fontFamily = SblHebrew,
        color      = Color(0xFF1A1A2A),
        lineHeight = (fontSize * 1.85f).sp,
        textAlign  = TextAlign.Justify,
        style      = LocalTextStyle.current.copy(textDirection = TextDirection.Rtl)
    )
}

// ── Settings dialog ───────────────────────────────────────────────────────────

@Composable
private fun FontSizeDialog(fontSize: Int, onDismiss: () -> Unit, onSave: (Int) -> Unit) {
    var size by remember { mutableIntStateOf(fontSize) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor   = LightBg,
        title = {
            Text(
                "גודל גופן",
                fontWeight = FontWeight.Bold,
                fontSize   = 18.sp,
                color      = Primary,
                modifier   = Modifier.fillMaxWidth(),
                textAlign  = TextAlign.Center
            )
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("גודל טקסט: ${size}sp", fontSize = 14.sp, color = Ink)
                Slider(
                    value         = size.toFloat(),
                    onValueChange = { size = it.toInt() },
                    valueRange    = 14f..32f,
                    steps         = 17,
                    colors        = SliderDefaults.colors(thumbColor = Primary, activeTrackColor = Primary)
                )
                Text(
                    text       = "שְׁמַע יִשְׂרָאֵל — לדוגמה",
                    fontSize   = size.sp,
                    fontFamily = SblHebrew,
                    color      = Ink,
                    textAlign  = TextAlign.Center,
                    modifier   = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(size) },
                colors  = ButtonDefaults.buttonColors(containerColor = Primary)
            ) { Text("שמור") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("ביטול", color = Muted) }
        }
    )
}

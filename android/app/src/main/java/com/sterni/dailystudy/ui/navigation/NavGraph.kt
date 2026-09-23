package com.sterni.dailystudy.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.sterni.dailystudy.ui.screens.calendar.CalendarScreen
import com.sterni.dailystudy.ui.screens.home.HomeScreen
import com.sterni.dailystudy.ui.screens.location.LocationZoneScreen
import com.sterni.dailystudy.ui.screens.mamaarim.MamaarimScreen
import com.sterni.dailystudy.ui.screens.mamaarim.MamaarReaderScreen
import com.sterni.dailystudy.ui.screens.news.NewsScreen
import com.sterni.dailystudy.ui.screens.settings.SettingsScreen
import com.sterni.dailystudy.ui.screens.study.StudyDetailScreen
import com.sterni.dailystudy.ui.screens.tracker.StudyTrackerScreen
import com.sterni.dailystudy.ui.screens.zmanim.ZmanimScreen
import com.sterni.dailystudy.ui.screens.zmanim.ZmanimMapPickerScreen
import com.sterni.dailystudy.zmanim.ZmanimLocationRepository
import com.sterni.dailystudy.ui.screens.tefila.TefilaScreen
import com.sterni.dailystudy.ui.screens.tools.ToolsScreen
import com.sterni.dailystudy.ui.screens.tools.PermissionsScreen
import com.sterni.dailystudy.ui.screens.tools.JerusalemDirectionScreen
import com.sterni.dailystudy.ui.screens.pdflibrary.PdfStudyScreen
import com.sterni.dailystudy.ui.screens.mamaarim.ArticleUploadScreen
import com.sterni.dailystudy.ui.screens.appblocker.AppBlockerScreen
import com.sterni.dailystudy.ui.screens.tehillim.TehillimScreen
import com.sterni.dailystudy.ui.screens.tehillim.TehillimReaderScreen
import java.net.URLDecoder
import java.net.URLEncoder

sealed class Screen(val route: String) {
    object Home : Screen("home")
    object StudyDetail : Screen("study/{studyKey}/{date}/{title}/{label}") {
        fun createRoute(studyKey: String, date: String, title: String, label: String) =
            "study/$studyKey/${URLEncoder.encode(date, "UTF-8")}/${URLEncoder.encode(title, "UTF-8")}/${URLEncoder.encode(label, "UTF-8")}"
    }
    object Zmanim        : Screen("zmanim")
    object Mamaarim      : Screen("mamaarim")
    object MamaarReader  : Screen("mamaarReader/{id}") {
        fun createRoute(id: String) = "mamaarReader/$id"
    }
    object LocationZones : Screen("locationZones")
    object StudyTracker  : Screen("studyTracker")
    object Calendar      : Screen("calendar")
    object Settings      : Screen("settings")
    object Tools         : Screen("tools")
    object News          : Screen("news")
    object Tefila        : Screen("tefila")
    object Permissions    : Screen("permissions")
    object JerusalemDir   : Screen("jerusalemDirection")
    object PdfLibrary     : Screen("pdfLibrary")
    object ArticleUpload  : Screen("articleUpload")
    object AppBlocker     : Screen("appBlocker")
    object Tehillim       : Screen("tehillim")
    object TehillimReader : Screen("tehillimReader/{chapter}/{chapters}/{title}") {
        fun createRoute(chapter: Int, chapters: List<Int> = emptyList(), title: String = ""): String {
            val chaptersParam = if (chapters.isNotEmpty()) chapters.joinToString(",") else "all"
            val titleParam = if (title.isNotEmpty()) title else "תהילים"
            return "tehillimReader/$chapter/${URLEncoder.encode(chaptersParam, "UTF-8")}/${URLEncoder.encode(titleParam, "UTF-8")}"
        }
    }
    object ZmanimMapPicker : Screen("zmanimMapPicker")
}

@Composable
fun NavGraph(navController: NavHostController) {
    NavHost(navController = navController, startDestination = Screen.Home.route) {

        composable(Screen.Home.route) {
            HomeScreen(
                onStudyClick = { studyKey, date, title, label ->
                    navController.navigate(Screen.StudyDetail.createRoute(studyKey, date, title, label))
                },
                onZmanimClick       = { navController.navigate(Screen.Zmanim.route) },
                onMamaarimClick     = { navController.navigate(Screen.Mamaarim.route) },
                onLocationClick     = { navController.navigate(Screen.LocationZones.route) },
                onTrackerClick      = { navController.navigate(Screen.StudyTracker.route) },
                onCalendarClick     = { navController.navigate(Screen.Calendar.route) },
                onSettingsClick     = { navController.navigate(Screen.Settings.route) },
                onToolsClick        = { navController.navigate(Screen.Tools.route) },
                onNewsClick         = { navController.navigate(Screen.News.route) },
                onTefilaClick       = { navController.navigate(Screen.Tefila.route) },
                onPdfLibraryClick   = { navController.navigate(Screen.PdfLibrary.route) },
                onTehillimClick     = { navController.navigate(Screen.Tehillim.route) }
            )
        }

        composable(
            route = Screen.StudyDetail.route,
            arguments = listOf(
                navArgument("studyKey") { type = NavType.StringType },
                navArgument("date")     { type = NavType.StringType },
                navArgument("title")    { type = NavType.StringType },
                navArgument("label")    { type = NavType.StringType },
            )
        ) { backStackEntry ->
            val studyKey = backStackEntry.arguments?.getString("studyKey") ?: return@composable
            val date     = URLDecoder.decode(backStackEntry.arguments?.getString("date") ?: "", "UTF-8")
            val title    = URLDecoder.decode(backStackEntry.arguments?.getString("title") ?: "", "UTF-8")
            val label    = URLDecoder.decode(backStackEntry.arguments?.getString("label") ?: "", "UTF-8")
            StudyDetailScreen(
                studyKey = studyKey,
                date     = date,
                title    = title,
                label    = label,
                onBack   = { navController.popBackStack() }
            )
        }

        composable(Screen.Zmanim.route) {
            ZmanimScreen(
                onBack = { navController.popBackStack() },
                onOpenMapPicker = { navController.navigate(Screen.ZmanimMapPicker.route) }
            )
        }

        composable(Screen.ZmanimMapPicker.route) {
            ZmanimMapPickerScreen(
                onBack = { navController.popBackStack() },
                onLocationSelected = { loc ->
                    val ctx = navController.context
                    ZmanimLocationRepository.setSelectedLocationId(ctx, loc.id)
                    if (loc.isCustom) {
                        ZmanimLocationRepository.saveCustomLocation(ctx, loc)
                    }
                    navController.popBackStack()
                }
            )
        }

        composable(Screen.Mamaarim.route) {
            MamaarimScreen(
                onBack   = { navController.popBackStack() },
                onOpen   = { id -> navController.navigate(Screen.MamaarReader.createRoute(id)) },
                onUpload = { navController.navigate(Screen.ArticleUpload.route) }
            )
        }

        composable(
            route = Screen.MamaarReader.route,
            arguments = listOf(navArgument("id") { type = NavType.StringType })
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id") ?: return@composable
            MamaarReaderScreen(
                mamaarId = id,
                onBack   = { navController.popBackStack() }
            )
        }

        composable(Screen.LocationZones.route) {
            LocationZoneScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.StudyTracker.route) {
            StudyTrackerScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Calendar.route) {
            CalendarScreen()
        }

        composable(Screen.Settings.route) {
            SettingsScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Tools.route) {
            ToolsScreen(
                onBack              = { navController.popBackStack() },
                onTefilaClick       = { navController.navigate(Screen.Tefila.route) },
                onSilentZoneClick   = { navController.navigate(Screen.LocationZones.route) },
                onMamaarimClick     = { navController.navigate(Screen.Mamaarim.route) },
                onPermissionsClick  = { navController.navigate(Screen.Permissions.route) },
                onJerusalemDirClick = { navController.navigate(Screen.JerusalemDir.route) },
                onAppBlockerClick   = { navController.navigate(Screen.AppBlocker.route) }
            )
        }

        composable(Screen.AppBlocker.route) {
            AppBlockerScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.News.route) {
            NewsScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Tefila.route) {
            TefilaScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.Permissions.route) {
            PermissionsScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.JerusalemDir.route) {
            JerusalemDirectionScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.PdfLibrary.route) {
            PdfStudyScreen(onBack = { navController.popBackStack() })
        }

        composable(Screen.ArticleUpload.route) {
            ArticleUploadScreen(
                onBack    = { navController.popBackStack() },
                onSuccess = { navController.popBackStack() }
            )
        }

        composable(Screen.Tehillim.route) {
            TehillimScreen(
                onBack = { navController.popBackStack() },
                onOpenChapter = { ch, title ->
                    navController.navigate(Screen.TehillimReader.createRoute(ch, emptyList(), title))
                },
                onOpenRange = { chapters, title ->
                    val startCh = chapters.firstOrNull() ?: 1
                    navController.navigate(Screen.TehillimReader.createRoute(startCh, chapters, title))
                }
            )
        }

        composable(
            route = Screen.TehillimReader.route,
            arguments = listOf(
                navArgument("chapter")  { type = NavType.IntType },
                navArgument("chapters") { type = NavType.StringType },
                navArgument("title")    { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val ch = backStackEntry.arguments?.getInt("chapter") ?: 1
            val rawChapters = URLDecoder.decode(backStackEntry.arguments?.getString("chapters") ?: "", "UTF-8")
            val chaptersList = if (rawChapters.isNotEmpty() && rawChapters != "all") {
                rawChapters.split(",").mapNotNull { it.toIntOrNull() }
            } else {
                emptyList()
            }
            val title = URLDecoder.decode(backStackEntry.arguments?.getString("title") ?: "", "UTF-8")

            TehillimReaderScreen(
                initialChapter = ch,
                chapterList = chaptersList,
                displayTitle = title,
                onBack = { navController.popBackStack() }
            )
        }
    }
}

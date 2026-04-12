package com.sterni.dailystudy.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.LayoutDirection
import androidx.core.view.WindowCompat
import com.sterni.dailystudy.R

val SblHebrew    = FontFamily(Font(R.font.sbl_hbrw))
val BaHaYetzira  = FontFamily(Font(R.font.ba_hayetzira_regular))

// Kept for backward compatibility with older screens
val Primary      = Color(0xFF0F766E)
val PrimaryLight = Color(0xFF14B8A6)
val Ink          = Color(0xFF27272A)
val Muted        = Color(0xFF71717A)
val BgColor      = Color(0xFFFDFBF7)
val CardBg       = Color(0xFFFFFFFF)
val LineColor    = Color(0xFFE4E4E7)
val Amber        = Color(0xFFF59E0B)

val AppTypography = Typography(
    displayLarge  = TextStyle(fontFamily = SblHebrew),
    displayMedium = TextStyle(fontFamily = SblHebrew),
    displaySmall  = TextStyle(fontFamily = SblHebrew),
    headlineLarge = TextStyle(fontFamily = SblHebrew),
    headlineMedium= TextStyle(fontFamily = SblHebrew),
    headlineSmall = TextStyle(fontFamily = SblHebrew),
    titleLarge    = TextStyle(fontFamily = SblHebrew),
    titleMedium   = TextStyle(fontFamily = SblHebrew),
    titleSmall    = TextStyle(fontFamily = SblHebrew),
    bodyLarge     = TextStyle(fontFamily = SblHebrew),
    bodyMedium    = TextStyle(fontFamily = SblHebrew),
    bodySmall     = TextStyle(fontFamily = SblHebrew),
    labelLarge    = TextStyle(fontFamily = SblHebrew),
    labelMedium   = TextStyle(fontFamily = SblHebrew),
    labelSmall    = TextStyle(fontFamily = SblHebrew)
)

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF99F6E4),
    onPrimaryContainer = Color(0xFF042F2E),
    secondary = PrimaryLight,
    onSecondary = Color.White,
    background = BgColor,
    onBackground = Ink,
    surface = CardBg,
    onSurface = Ink,
    surfaceVariant = Color(0xFFF4F4F5),
    onSurfaceVariant = Muted,
    outline = LineColor,
    error = Color(0xFFEF4444)
)

private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF14B8A6),
    onPrimary = Color(0xFF042F2E),
    primaryContainer = Color(0xFF0F766E),
    onPrimaryContainer = Color(0xFF99F6E4),
    secondary = Color(0xFF2DD4BF),
    onSecondary = Color(0xFF042F2E),
    background = Color(0xFF18181B),
    onBackground = Color(0xFFF4F4F5),
    surface = Color(0xFF27272A),
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = Color(0xFF3F3F46),
    onSurfaceVariant = Color(0xFFA1A1AA),
    outline = Color(0xFF52525B),
    error = Color(0xFFF87171)
)

@Composable
fun DailyStudyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = AppTypography
    ) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            content()
        }
    }
}package com.sterni.dailystudy.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

val Md_Primary = Color(0xFF0F766E)
val Md_OnPrimary = Color(0xFFFFFFFF)
val Md_PrimaryContainer = Color(0xFF99F6E4)
val Md_OnPrimaryContainer = Color(0xFF042F2E)

val Md_Secondary = Color(0xFF14B8A6)
val Md_OnSecondary = Color(0xFFFFFFFF)
val Md_SecondaryContainer = Color(0xFFCCFBF1)
val Md_OnSecondaryContainer = Color(0xFF042F2E)

val Md_Background = Color(0xFFFDFBF7)
val Md_OnBackground = Color(0xFF27272A)
val Md_Surface = Color(0xFFFFFFFF)
val Md_OnSurface = Color(0xFF27272A)

private val LightColorScheme = lightColorScheme(
    primary = Md_Primary,
    onPrimary = Md_OnPrimary,
    primaryContainer = Md_PrimaryContainer,
    onPrimaryContainer = Md_OnPrimaryContainer,
    secondary = Md_Secondary,
    onSecondary = Md_OnSecondary,
    secondaryContainer = Md_SecondaryContainer,
    onSecondaryContainer = Md_OnSecondaryContainer,
    background = Md_Background,
    onBackground = Md_OnBackground,
    surface = Md_Surface,
    onSurface = Md_OnSurface,
)

private val DarkColorScheme = darkColorScheme(
    primary = Md_PrimaryContainer,
    onPrimary = Md_OnPrimaryContainer,
    primaryContainer = Md_Primary,
    onPrimaryContainer = Md_OnPrimary,
    background = Color(0xFF18181B),
    onBackground = Color(0xFFF4F4F5),
    surface = Color(0xFF27272A),
    onSurface = Color(0xFFF4F4F5),
)

@Composable
fun DailyStudyTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    dynamicColor: Boolean = false,
    content: @Composable () -> Unit
) {
    val colorScheme = when {
        dynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S -> {
            val context = LocalContext.current
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        }
        darkTheme -> DarkColorScheme
        else -> LightColorScheme
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.primary.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}package com.sterni.dailystudy.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.LayoutDirection
import com.sterni.dailystudy.R

val Primary      = Color(0xFF0f766e)
val PrimaryLight = Color(0xFF14b8a6)
val Ink          = Color(0xFF1a1a2e)
val Muted        = Color(0xFF6b7280)
val BgColor      = Color(0xFFF8F6F0)
val CardBg       = Color(0xFFFFFFFF)
val LineColor    = Color(0xFFE5E7EB)
val Amber        = Color(0xFFb58900)

val SblHebrew    = FontFamily(Font(R.font.sbl_hbrw))
val BaHaYetzira  = FontFamily(Font(R.font.ba_hayetzira_regular))

private val AppTypography = Typography(
    displayLarge  = TextStyle(fontFamily = SblHebrew),
    displayMedium = TextStyle(fontFamily = SblHebrew),
    displaySmall  = TextStyle(fontFamily = SblHebrew),
    headlineLarge = TextStyle(fontFamily = SblHebrew),
    headlineMedium= TextStyle(fontFamily = SblHebrew),
    headlineSmall = TextStyle(fontFamily = SblHebrew),
    titleLarge    = TextStyle(fontFamily = SblHebrew),
    titleMedium   = TextStyle(fontFamily = SblHebrew),
    titleSmall    = TextStyle(fontFamily = SblHebrew),
    bodyLarge     = TextStyle(fontFamily = SblHebrew),
    bodyMedium    = TextStyle(fontFamily = SblHebrew),
    bodySmall     = TextStyle(fontFamily = SblHebrew),
    labelLarge    = TextStyle(fontFamily = SblHebrew),
    labelMedium   = TextStyle(fontFamily = SblHebrew),
    labelSmall    = TextStyle(fontFamily = SblHebrew)
)

private val ColorScheme = lightColorScheme(
    primary        = Primary,
    onPrimary      = Color.White,
    background     = BgColor,
    surface        = CardBg,
    onBackground   = Ink,
    onSurface      = Ink,
    secondary      = PrimaryLight,
    surfaceVariant = Color(0xFFF1F5F9),
    outline        = LineColor,
)

@Composable
fun DailyStudyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = ColorScheme,
        typography = AppTypography
    ) {
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
            content()
        }
    }
}

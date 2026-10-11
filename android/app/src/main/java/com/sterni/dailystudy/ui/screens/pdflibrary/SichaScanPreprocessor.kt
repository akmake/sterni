package com.sterni.dailystudy.ui.screens.pdflibrary

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.roundToInt

object SichaScanPreprocessor {
    /** Modest scan tilt is estimated by horizontal ink projection, without changing the text. */
    fun deskew(source: Bitmap): Bitmap {
        val small = Bitmap.createScaledBitmap(source, 480,
            (480f * source.height / source.width).roundToInt().coerceAtLeast(1), true)
        val pixels = IntArray(small.width * small.height)
        small.getPixels(pixels, 0, small.width, 0, 0, small.width, small.height)
        val w = small.width; val h = small.height
        if (small !== source) small.recycle()
        val points = mutableListOf<Pair<Int, Int>>()
        for (y in (h * .06f).toInt() until (h * .94f).toInt())
            for (x in (w * .07f).toInt() until (w * .93f).toInt() step 2) {
                val p = pixels[y * w + x]
                if ((((p shr 16) and 255) + ((p shr 8) and 255) + (p and 255)) < 420) points += x to y
            }
        if (points.size < 40) return source
        fun score(angle: Double): Long {
            val rad = angle * Math.PI / 180
            // Score each half independently: differently staggered column baselines must
            // not favor an artificial tilt that happens to align one column with the other.
            val rows = IntArray(h * 2)
            for ((x, y) in points) {
                val row = ((x - w / 2f) * sin(rad) + (y - h / 2f) * cos(rad) + h / 2f).roundToInt()
                if (row in 0 until h) rows[row + if (x >= w / 2) h else 0]++
            }
            return rows.sumOf { it.toLong() * it }
        }
        val straight = score(0.0)
        val best = (-10..10).map { it / 2.0 }.maxBy { score(it) }
        if (best == 0.0 || score(best) < straight * 1.04) return source
        val rotated = Bitmap.createBitmap(source, 0, 0, source.width, source.height,
            Matrix().apply { postRotate(best.toFloat()) }, true)
        val result = Bitmap.createBitmap(rotated.width, rotated.height, Bitmap.Config.ARGB_8888)
        result.eraseColor(Color.WHITE)
        Canvas(result).drawBitmap(rotated, 0f, 0f, null)
        if (rotated !== source) rotated.recycle()
        return result
    }
}

package com.sterni.dailystudy.ui.screens.pdflibrary

/** Normalized source coordinates. Stored per page and column for manual corrections. */
data class SichaCrop(val left: Float, val top: Float, val right: Float, val bottom: Float)

/** Pixel-only analysis works for scans too; never reconstructs or changes the printed text. */
object SichaLayout {
    fun detect(pixels: IntArray, width: Int, height: Int): List<SichaCrop?> {
        require(width > 0 && height > 0 && pixels.size == width * height)
        fun ink(x: Int, y: Int): Boolean {
            val p = pixels[y * width + x]
            return (((p shr 16) and 255) * 299 + ((p shr 8) and 255) * 587 +
                (p and 255) * 114) / 1000 < 190
        }
        // Ignore running titles. Keep section titles below them, including the opening page.
        var startY = (height * 0.065f).toInt()
        val endY = (height * 0.96f).toInt()
        val middle = width / 2
        // An opening title can span both columns. Keep it whole above the right column.
        val titleRows = (startY until (height * .14f).toInt()).filter { y ->
            (middle - (width * .025f).toInt()..middle + (width * .025f).toInt()).any { x -> ink(x, y) }
        }
        var heading: SichaCrop? = null
        if (titleRows.size >= 2 && titleRows.last() - titleRows.first() < height * .05f) {
            val top = maxOf(startY, titleRows.first() - 3)
            val bottom = titleRows.last() + 4
            var left = width; var right = 0
            for (y in top until bottom) for (x in 0 until width) if (ink(x, y)) {
                left = minOf(left, x); right = maxOf(right, x)
            }
            // A genuine centered title occupies only the middle of the page. Ordinary
            // text on the same rows reaches the outer columns and must never be split.
            if (left > width * .30f && right < width * .70f) {
                heading = SichaCrop(maxOf(0, left - 4) / width.toFloat(), top / height.toFloat(),
                    minOf(width, right + 5) / width.toFloat(), bottom / height.toFloat())
                startY = bottom
            }
        }
        fun gutterInk(x: Int) = ((height * .14f).toInt() until (height * .80f).toInt())
            .count { y -> ink(x, y) }
        // Centered headings and end ornaments may cross the gutter; keep the center when
        // mostly blank instead of shifting a column boundary to avoid those few pixels.
        val split = if (gutterInk(middle) < height * .04f) middle else
            ((width * .46f).toInt()..(width * .54f).toInt()).minWith(
                compareBy<Int> { gutterInk(it) }.thenBy { kotlin.math.abs(it - middle) })
        // A genuine gutter is a wide vertical band, not a space between two words on
        // a one-column page. Relative density also works on short final pages.
        val central = ((width * .46f).toInt()..(width * .54f).toInt()).associateWith { gutterInk(it) }
        val quiet = central.values.maxOrNull()!!.toFloat() * .15f
        val valley = central.keys.minWith(compareBy<Int> { central[it]!! }.thenBy { kotlin.math.abs(it - middle) })
        var gutterLeft = valley; var gutterRight = valley
        while (central[gutterLeft - 1]?.let { it <= quiet } == true) gutterLeft--
        while (central[gutterRight + 1]?.let { it <= quiet } == true) gutterRight++
        val singleColumn = gutterRight - gutterLeft + 1 < width * .018f
        val ranges = if (singleColumn) listOf(0 to width) else listOf(split + 1 to width, 0 to split)
        val columns = ranges.map { (x0, x1) ->
            var stopY = endY
            // A footnote separator is a long unbroken stroke with blank space just above it.
            // The blank-space test avoids mistaking a dense text baseline for a separator.
            for (y in (height * .20f).toInt() until endY) {
                var run = 0
                var longest = 0
                for (x in x0 until x1) {
                    run = if (ink(x, y)) run + 1 else 0
                    longest = maxOf(longest, run)
                }
                if (longest < width * .10f) continue
                val gap = maxOf(3, (height * .006f).toInt())
                val blankAbove = ((y - gap).coerceAtLeast(startY) until y - 1).all { row ->
                    (x0 until x1).count { x -> ink(x, row) } < 3
                }
                if (blankAbove) { stopY = y - 1; break }
            }
            var left = x1; var right = x0; var top = stopY; var bottom = startY
            var count = 0
            for (y in startY until stopY) for (x in x0 until x1) if (ink(x, y)) {
                left = minOf(left, x); right = maxOf(right, x)
                top = minOf(top, y); bottom = maxOf(bottom, y); count++
            }
            if (count < 50 || bottom - top < height * .035f) null
            else SichaCrop(
                maxOf(x0, left - 4) / width.toFloat(), maxOf(startY, top - 4) / height.toFloat(),
                minOf(x1, right + 5) / width.toFloat(), minOf(stopY, bottom + 5) / height.toFloat()
            )
        }
        return if (singleColumn) listOf(columns[0], null, heading) else columns + heading
    }
}

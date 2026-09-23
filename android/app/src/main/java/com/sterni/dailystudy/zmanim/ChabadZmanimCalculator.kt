package com.sterni.dailystudy.zmanim

import com.kosherjava.zmanim.ComplexZmanimCalendar
import com.kosherjava.zmanim.util.GeoLocation
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class CalculatedZman(
    val type: String,
    val label: String,
    val time: String,
    val timeMillis: Long,
    val description: String? = null
)

object ChabadZmanimCalculator {

    /**
     * Calculates the 12 Chabad (Baal HaTanya) halachic times for the specified date and location.
     * @param isoDate Format: YYYY-MM-DD
     */
    fun calculateZmanim(isoDate: String, location: ZmanimLocation): List<CalculatedZman> {
        val parts = isoDate.split("-")
        if (parts.size != 3) return emptyList()
        val year = parts[0].toIntOrNull() ?: return emptyList()
        val month = parts[1].toIntOrNull() ?: return emptyList()
        val day = parts[2].toIntOrNull() ?: return emptyList()

        return calculateZmanim(year, month, day, location)
    }

    /**
     * Calculates the 12 Chabad (Baal HaTanya) halachic times.
     */
    fun calculateZmanim(year: Int, month: Int, day: Int, location: ZmanimLocation): List<CalculatedZman> {
        val tz = location.getTimeZone()
        val geo = GeoLocation(
            location.name,
            location.latitude,
            location.longitude,
            0.0,
            tz
        )

        val cal = ComplexZmanimCalendar(geo)
        val calendar = Calendar.getInstance(tz).apply {
            set(Calendar.YEAR, year)
            set(Calendar.MONTH, month - 1)
            set(Calendar.DAY_OF_MONTH, day)
            set(Calendar.HOUR_OF_DAY, 12)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        cal.calendar = calendar

        // Candle lighting offset: 40 minutes for Jerusalem, 20 minutes elsewhere
        val isJerusalem = location.id == "jerusalem" || location.name.contains("ירושלים")
        cal.candleLightingOffset = if (isJerusalem) 40.0 else 20.0

        val timeFormatter = SimpleDateFormat("HH:mm", Locale.US).apply {
            timeZone = tz
        }

        // 1. Alos Baal HaTanya (with polar summer midnight fallback)
        val alosDate = try {
            cal.alosBaalHatanya ?: cal.solarMidnight
        } catch (_: Exception) {
            try { cal.solarMidnight } catch (_: Exception) { null }
        }

        // 2. Misheyakir (10.2 degrees)
        val misheyakirDate = try { cal.misheyakir10Point2Degrees } catch (_: Exception) { null }

        // 3. Netz (Sunrise)
        val sunriseDate = try { cal.sunrise } catch (_: Exception) { null }

        // 4. Sof Zman Shma Baal HaTanya
        val shmaDate = try { cal.sofZmanShmaBaalHatanya } catch (_: Exception) { null }

        // 5. Sof Zman Tefillah Baal HaTanya
        val tfilaDate = try { cal.sofZmanTfilaBaalHatanya } catch (_: Exception) { null }

        // 6. Chatzos Hayom
        val chatzosDate = try { cal.chatzos } catch (_: Exception) { null }

        // 7. Mincha Gedolah Baal HaTanya
        val minchaGedolaDate = try { cal.minchaGedolaBaalHatanya } catch (_: Exception) { null }

        // 8. Mincha Ketanah Baal HaTanya
        val minchaKetanaDate = try { cal.minchaKetanaBaalHatanya } catch (_: Exception) { null }

        // 9. Plag Hamincha Baal HaTanya
        val plagDate = try { cal.plagHaminchaBaalHatanya } catch (_: Exception) { null }

        // Candle lighting: on Friday (or displayed if available)
        val isFriday = calendar.get(Calendar.DAY_OF_WEEK) == Calendar.FRIDAY
        val candleDate = if (isFriday) {
            try { cal.candleLighting } catch (_: Exception) { null }
        } else null

        // 10. Shkiah (Sunset)
        val sunsetDate = try { cal.sunset } catch (_: Exception) { null }

        // 11. Tzais Baal HaTanya
        val tzaisDate = try {
            cal.tzaisBaalHatanya ?: cal.solarMidnight
        } catch (_: Exception) {
            try { cal.solarMidnight } catch (_: Exception) { null }
        }

        // 12. Solar Midnight (Chatzos Layla)
        val midnightDate = try { cal.solarMidnight } catch (_: Exception) { null }

        val list = mutableListOf<CalculatedZman>()

        fun addZman(type: String, label: String, date: Date?, desc: String? = null) {
            if (date != null) {
                list.add(
                    CalculatedZman(
                        type = type,
                        label = label,
                        time = timeFormatter.format(date),
                        timeMillis = date.time,
                        description = desc
                    )
                )
            }
        }

        addZman("AlosHashachar", "עלות השחר", alosDate, "בעל התניא")
        addZman("EarliestTefillin", "משיכיר", misheyakirDate, "ציצית ותפילין (10.2°)")
        addZman("NetzHachamah", "הנץ החמה", sunriseDate, "זריחה במישור")
        addZman("LatestShema", "סוף זמן ק\"ש", shmaDate, "בעל התניא")
        addZman("LatestTefillah", "סוף זמן תפילה", tfilaDate, "בעל התניא")
        addZman("Chatzos", "חצות היום", chatzosDate, "חצות היום האסטרונומי")
        addZman("MinchahGedolah", "מנחה גדולה", minchaGedolaDate, "בעל התניא")
        addZman("MinchahKetanah", "מנחה קטנה", minchaKetanaDate, "בעל התניא")
        addZman("PlagHaminchah", "פלג המנחה", plagDate, "בעל התניא")
        if (candleDate != null) {
            addZman("CandleLighting", "הדלקת נרות", candleDate, if (isJerusalem) "40 דקות לשקיעה" else "20 דקות לשקיעה")
        }
        addZman("Shkiah", "שקיעת החמה", sunsetDate, "שקיעה במישור")
        addZman("Tzeis", "צאת הכוכבים", tzaisDate, "בעל התניא")
        addZman("ChatzosNight", "חצות הלילה", midnightDate, "חצות הלילה האסטרונומי")

        return list
    }

    /**
     * Formats the current time in the given location's timezone.
     */
    fun getCurrentTimeString(location: ZmanimLocation): String {
        val fmt = SimpleDateFormat("HH:mm:ss", Locale.US).apply {
            timeZone = location.getTimeZone()
        }
        return fmt.format(Date())
    }

    /**
     * Returns the hour difference between local device timezone and target location timezone.
     */
    fun getTimeDifferenceHours(targetLocation: ZmanimLocation): Int {
        val localOffset = TimeZone.getDefault().getOffset(System.currentTimeMillis())
        val targetOffset = targetLocation.getTimeZone().getOffset(System.currentTimeMillis())
        val diffMs = targetOffset - localOffset
        return (diffMs / (1000 * 60 * 60))
    }
}

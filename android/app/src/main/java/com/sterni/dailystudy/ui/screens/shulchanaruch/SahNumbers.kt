package com.sterni.dailystudy.ui.screens.shulchanaruch

object SahNumbers {
    private val values = linkedMapOf('ת' to 400,'ש' to 300,'ר' to 200,'ק' to 100,'צ' to 90,
        'פ' to 80,'ע' to 70,'ס' to 60,'נ' to 50,'מ' to 40,'ל' to 30,'כ' to 20,'י' to 10,
        'ט' to 9,'ח' to 8,'ז' to 7,'ו' to 6,'ה' to 5,'ד' to 4,'ג' to 3,'ב' to 2,'א' to 1)
    fun label(number: Int): String {
        if(number !in 1..999) return number.toString()
        var n=number
        val result=buildString {
            for((c,value) in values) {
                if(n==15) {append("טו");break}
                if(n==16) {append("טז");break}
                while(n>=value) {append(c);n-=value}
            }
        }
        return if(result.length==1) result else result.dropLast(1)+"״"+result.last()
    }
    fun directQuery(query: String): Int? {
        val raw=query.trim().removePrefix("סימן").trim()
        raw.toIntOrNull()?.let {return it}
        if(!query.trim().startsWith("סימן") && raw.none {it in "\"'״׳"}) return null
        val letters=raw.filterNot {it in "\"'״׳"}
        if(letters.isEmpty() || letters.any {it !in values}) return null
        return letters.sumOf {values.getValue(it)}.takeIf {it in 1..999}
    }
    fun title(value: String) = value.replace(Regex("^סימן (\\d+)")) { "סימן "+label(it.groupValues[1].toInt()) }
}

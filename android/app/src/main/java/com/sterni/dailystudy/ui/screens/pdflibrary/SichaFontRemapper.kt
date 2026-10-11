package com.sterni.dailystudy.ui.screens.pdflibrary

import java.nio.ByteBuffer
import java.nio.ByteOrder

/** Replaces a subset font's legacy cmap with Unicode while retaining its original glyphs. */
object SichaFontRemapper {
    fun remap(original: ByteArray, unicodeToGlyph: Map<Int, Int>): ByteArray {
        val input = ByteBuffer.wrap(original).order(ByteOrder.BIG_ENDIAN)
        require(original.size >= 12)
        val count = input.getShort(4).toInt() and 0xffff
        require(count in 1..100 && 12 + count * 16 <= original.size)
        val tables = linkedMapOf<String, ByteArray>()
        for (i in 0 until count) {
            val pos = 12 + i * 16
            val tag = String(original, pos, 4, Charsets.US_ASCII)
            val offset = input.getInt(pos + 8); val length = input.getInt(pos + 12)
            require(offset >= 0 && length >= 0 && offset.toLong() + length <= original.size)
            tables[tag] = original.copyOfRange(offset, offset + length)
        }
        val mapping = unicodeToGlyph.filter { it.key in 0..0xfffe && it.value in 1..0xffff }.toSortedMap()
        require(mapping.isNotEmpty() && mapping.size < 4000)
        val n = mapping.size + 1
        val subtable = ByteBuffer.allocate(16 + n * 8).order(ByteOrder.BIG_ENDIAN)
        val power = Integer.highestOneBit(n)
        subtable.putShort(4).putShort(subtable.capacity().toShort()).putShort(0)
        subtable.putShort((n * 2).toShort()).putShort((power * 2).toShort())
            .putShort(Integer.numberOfTrailingZeros(power).toShort()).putShort((n * 2 - power * 2).toShort())
        for (code in mapping.keys) subtable.putShort(code.toShort())
        subtable.putShort(0xffff.toShort()).putShort(0)
        for (code in mapping.keys) subtable.putShort(code.toShort())
        subtable.putShort(0xffff.toShort())
        for ((code, gid) in mapping) subtable.putShort((gid - code).toShort())
        subtable.putShort(1)
        repeat(n) { subtable.putShort(0) }
        val cmap = ByteBuffer.allocate(12 + subtable.capacity()).order(ByteOrder.BIG_ENDIAN)
        cmap.putShort(0).putShort(1).putShort(3).putShort(1).putInt(12).put(subtable.array())
        tables["cmap"] = cmap.array()
        tables["head"]?.let { require(it.size >= 12); it.fill(0, 8, 12) }
        val tableCount = tables.size
        var offset = 12 + tableCount * 16
        val output = ByteBuffer.allocate(offset + tables.values.sumOf { (it.size + 3) / 4 * 4 }).order(ByteOrder.BIG_ENDIAN)
        output.putInt(input.getInt(0)).putShort(tableCount.toShort())
        val tablePower = Integer.highestOneBit(tableCount)
        output.putShort((tablePower * 16).toShort()).putShort(Integer.numberOfTrailingZeros(tablePower).toShort())
            .putShort((tableCount * 16 - tablePower * 16).toShort())
        var headOffset: Int? = null
        for ((tag, bytes) in tables.toSortedMap()) {
            output.put(tag.toByteArray(Charsets.US_ASCII)).putInt(checksum(bytes)).putInt(offset).putInt(bytes.size)
            System.arraycopy(bytes, 0, output.array(), offset, bytes.size)
            if (tag == "head") headOffset = offset
            offset += (bytes.size + 3) / 4 * 4
        }
        headOffset?.let { output.putInt(it + 8, (0xB1B0AFBAL - (checksum(output.array()).toLong() and 0xffffffffL)).toInt()) }
        return output.array()
    }
    private fun checksum(bytes: ByteArray): Int {
        var sum = 0L
        for (start in bytes.indices step 4) {
            var word = 0L
            repeat(4) { i -> word = (word shl 8) or ((bytes.getOrNull(start + i)?.toInt() ?: 0) and 255).toLong() }
            sum = (sum + word) and 0xffffffffL
        }
        return sum.toInt()
    }
}

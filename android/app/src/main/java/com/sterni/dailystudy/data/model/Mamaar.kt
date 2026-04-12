package com.sterni.dailystudy.data.model

data class Mamaar(
    val id: String,
    val title: String,
    val fileName: String,
    val sections: List<MamaarSection>,
    val createdAt: Long
)

data class MamaarSection(
    val heading: String?,
    val body: String
)

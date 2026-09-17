package com.vigilshield.telecom

import android.content.Context

/**
 * Local-first repository for numbers reported by the user/community sync layer.
 * The native firewall can consult this without requiring network access on the
 * critical incoming-call path.
 */
object ScamNumberRepository {
    private const val PREFS = "vigilshield"
    private const val KEY_REPORTED = "reported_scam_numbers"

    fun isReported(context: Context, number: String): Boolean {
        val normalized = normalize(number)
        if (normalized.isBlank()) return false
        return read(context).any { normalized == it || normalized.endsWith(it) }
    }

    fun report(context: Context, number: String) {
        val normalized = normalize(number)
        if (normalized.isBlank()) return
        val current = read(context).toMutableSet()
        current += normalized
        write(context, current)
    }

    fun unreport(context: Context, number: String) {
        val normalized = normalize(number)
        val current = read(context).filterNot { normalized == it || normalized.endsWith(it) }.toSet()
        write(context, current)
    }

    fun all(context: Context): Set<String> = read(context)

    private fun read(context: Context): Set<String> = context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getStringSet(KEY_REPORTED, emptySet())
        .orEmpty()
        .map(::normalize)
        .filter { it.isNotBlank() }
        .toSet()

    private fun write(context: Context, values: Set<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY_REPORTED, values)
            .apply()
    }

    private fun normalize(value: String): String = value.filter(Char::isDigit)
}

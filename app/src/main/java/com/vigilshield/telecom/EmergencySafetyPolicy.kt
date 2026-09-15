package com.vigilshield.telecom

import android.content.Context
import org.json.JSONArray

/** Local emergency-contact and temporary safety policies used by the call firewall. */
object EmergencySafetyPolicy {
    private const val PREFS = "vigilshield"
    private const val KEY_CONTACTS = "phase3_emergency_contacts"

    fun isEmergencyContact(context: Context, number: String): Boolean {
        val normalized = normalize(number)
        if (normalized.isEmpty()) return false
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return try {
            val values = JSONArray(prefs.getString(KEY_CONTACTS, "[]") ?: "[]")
            (0 until values.length()).any { i ->
                val saved = normalize(values.optString(i))
                saved.isNotEmpty() && (normalized == saved || normalized.endsWith(saved) || saved.endsWith(normalized))
            }
        } catch (_: Exception) { false }
    }

    fun emergencyModeEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean("phase3_emergency_mode_enabled", false)

    fun drivingModeEnabled(context: Context): Boolean =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getBoolean("phase3_driving_mode_enabled", false)

    private fun normalize(value: String): String = value.filter { it.isDigit() }
}

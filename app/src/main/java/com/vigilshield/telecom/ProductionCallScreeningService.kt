package com.vigilshield.telecom

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallScreeningService
import org.json.JSONArray

/**
 * Fast, local-first call firewall. It never waits on the network: Android gives
 * a screening service only a short response window. Contacts and user rules are
 * therefore evaluated synchronously, while any richer caller-ID UI is handled
 * by the app after the call reaches the default dialer.
 */
class ProductionCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        val normalized = normalize(number)

        // Outgoing calls are never blocked by the firewall.
        if (details.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(details, CallResponse.Builder().setDisallowCall(false).build())
            return
        }

        // A saved device contact is trusted by default. This also prevents a
        // user-created spam rule from accidentally rejecting a known contact.
        if (isDeviceContact(number)) {
            respondToCall(details, CallResponse.Builder().setDisallowCall(false).build())
            return
        }

        val prefs = getSharedPreferences("vigilshield", Context.MODE_PRIVATE)
        val whitelist = readArray(prefs.getString("whitelist", "[]"))
        if (matchesList(whitelist, normalized)) {
            respondToCall(details, CallResponse.Builder().setDisallowCall(false).build())
            return
        }

        val rules = readArray(prefs.getString("block_rules", "[]"))
        val matched = findRule(rules, normalized)

        if (matched != null) {
            // Rejecting here prevents the phone from ringing. Android records
            // the result as a BLOCKED_TYPE call-log entry when permitted by the OS.
            val response = CallResponse.Builder()
                .setDisallowCall(true)
                .setRejectCall(true)
                .setSkipCallLog(false)
                .setSkipNotification(false)
                .build()
            respondToCall(details, response)
            return
        }

        respondToCall(details, CallResponse.Builder().setDisallowCall(false).build())
    }

    private fun findRule(rules: JSONArray, number: String): String? {
        for (i in 0 until rules.length()) {
            val rule = rules.optJSONObject(i) ?: continue
            if (!rule.optBoolean("enabled", true)) continue
            if (rule.optString("targetType", "BOTH") !in setOf("CALL", "BOTH")) continue

            val raw = rule.optString("value").trim()
            if (raw.isEmpty()) continue

            val matchType = rule.optString("matchType", "PREFIX").uppercase()
            val digits = normalize(raw)
            val matched = when (matchType) {
                "EXACT" -> number == digits
                "PREFIX" -> number.startsWith(digits)
                "REGEX" -> runCatching { Regex(raw).containsMatchIn(number) }.getOrDefault(false)
                "KEYWORD" -> number.contains(digits)
                else -> number == digits
            }
            if (matched) return rule.optString("id", "rule-$i")
        }
        return null
    }

    private fun matchesList(entries: JSONArray, number: String): Boolean {
        for (i in 0 until entries.length()) {
            val item = entries.optJSONObject(i) ?: continue
            val value = normalize(item.optString("value"))
            if (value.isNotEmpty() && (number == value || number.endsWith(value))) return true
        }
        return false
    }

    private fun isDeviceContact(number: String): Boolean {
        if (number.isBlank()) return false
        return try {
            contentResolver.query(
                Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number)),
                arrayOf(ContactsContract.PhoneLookup._ID),
                null,
                null,
                null
            )?.use { it.moveToFirst() } == true
        } catch (_: SecurityException) {
            false
        } catch (_: Exception) {
            false
        }
    }

    private fun readArray(value: String?): JSONArray = try {
        JSONArray(value ?: "[]")
    } catch (_: Exception) {
        JSONArray()
    }

    private fun normalize(value: String): String =
        value.filter { it.isDigit() }
}

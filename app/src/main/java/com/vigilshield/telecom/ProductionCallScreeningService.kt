package com.vigilshield.telecom

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallScreeningService
import org.json.JSONArray
import org.json.JSONObject

/**
 * Fast, local-first call firewall. It never waits on the network: Android gives
 * a screening service only a short response window. Contacts and user rules are
 * therefore evaluated synchronously.
 */
class ProductionCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        val normalized = normalize(number)

        if (details.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(details, allowResponse())
            return
        }

        val prefs = getSharedPreferences("vigilshield", Context.MODE_PRIVATE)

        // Saved contacts are never auto-blocked. Repeated-call escalation is a
        // separate safety signal and does not change the call disposition.
        if (isDeviceContact(number)) {
            EmergencyRepeatCallPolicy.onTrustedIncomingCall(applicationContext, number)
            respondToCall(details, allowResponse())
            return
        }

        val whitelist = readArray(prefs.getString("whitelist", "[]"))
        if (matchesList(whitelist, normalized)) {
            respondToCall(details, allowResponse())
            return
        }

        val callerName = details.callerDisplayName.orEmpty()
        val risk = CallRiskAnalyzer.analyze(number, callerName)
        val riskEnabled = prefs.getBoolean("phase2_risk_detection_enabled", true)
        if (riskEnabled && risk.optBoolean("patternWarning", false)) {
            CallNotificationHelper.showSecurityWarning(
                applicationContext,
                callerName.ifBlank { number.ifBlank { "Unknown caller" } },
                risk.optString("risk", "UNKNOWN"),
                risk.optString("spoofRisk", "LOW"),
                risk.optString("explanation", "Caller identity could not be verified.")
            )
        }

        val rules = readArray(prefs.getString("block_rules", "[]"))
        val matched = findRule(rules, normalized)

        if (matched != null) {
            val rejectHighRisk = prefs.getBoolean("smart_spam_reject_high_risk", false)
            val quietSpam = prefs.getBoolean("smart_spam_quiet_enabled", false)
            val shouldSilence = quietSpam && !rejectHighRisk
            val response = CallResponse.Builder()
                .setDisallowCall(rejectHighRisk)
                .setRejectCall(rejectHighRisk)
                .setSilenceCall(shouldSilence)
                .setSkipCallLog(false)
                .setSkipNotification(false)
                .build()
            respondToCall(details, response)
            return
        }

        // Unknown callers are handled independently from spam rules. This lets
        // ordinary unknown calls remain usable while still offering a quiet mode.
        val silenceUnknown = prefs.getBoolean("unknown_caller_silence", false)
        val rejectUnknown = prefs.getBoolean("unknown_caller_reject", false)
        val smartSilentUnknown = prefs.getBoolean("smart_silent_unknown_only", false) ||
            prefs.getBoolean("smart_silent_unknown_and_spam", false)
        val response = CallResponse.Builder()
            .setDisallowCall(rejectUnknown)
            .setRejectCall(rejectUnknown)
            .setSilenceCall(silenceUnknown || smartSilentUnknown)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()
        respondToCall(details, response)
    }

    private fun allowResponse(): CallResponse = CallResponse.Builder()
        .setDisallowCall(false)
        .setRejectCall(false)
        .setSilenceCall(false)
        .setSkipCallLog(false)
        .setSkipNotification(false)
        .build()

    private fun findRule(rules: JSONArray, number: String): JSONObject? {
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
            if (matched) return rule
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
                arrayOf(ContactsContract.PhoneLookup._ID), null, null, null
            )?.use { it.moveToFirst() } == true
        } catch (_: SecurityException) {
            false
        } catch (_: Exception) {
            false
        }
    }

    private fun readArray(value: String?): JSONArray = try { JSONArray(value ?: "[]") } catch (_: Exception) { JSONArray() }
    private fun normalize(value: String): String = value.filter { it.isDigit() }
}

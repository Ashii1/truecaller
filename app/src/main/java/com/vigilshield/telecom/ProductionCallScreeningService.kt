package com.vigilshield.telecom

import android.content.Context
import android.net.Uri
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallScreeningService
import org.json.JSONArray
import org.json.JSONObject

/** Fast, local-first incoming call firewall. */
class ProductionCallScreeningService : CallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        val normalized = normalize(number)
        val prefs = getSharedPreferences("vigilshield", Context.MODE_PRIVATE)

        if (!prefs.getBoolean("masterEnabled", true) || details.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(details, allowResponse())
            return
        }

        val emergencyContact = EmergencySafetyPolicy.isEmergencyContact(applicationContext, number)
        val emergencyMode = EmergencySafetyPolicy.emergencyModeEnabled(applicationContext)
        val deviceContact = isDeviceContact(number)
        if (emergencyContact || emergencyMode || deviceContact) {
            if (deviceContact) EmergencyRepeatCallPolicy.onTrustedIncomingCall(applicationContext, number)
            respondToCall(details, allowResponse())
            return
        }

        val isPrivate = details.handle == null ||
            details.handlePresentation == Call.Details.PRESENTATION_RESTRICTED ||
            number.isBlank() ||
            number.equals("private", ignoreCase = true) ||
            number.equals("unknown", ignoreCase = true) ||
            number.equals("0")

        if (isPrivate) {
            if (prefs.getBoolean("block_private_hidden", true)) {
                CallNotificationHelper.showSecurityWarning(
                    applicationContext,
                    "Private / Withheld Number",
                    "PRIVATE_CALL_BLOCKED",
                    "HIGH",
                    "Private and anonymous calls are automatically blocked by your protection settings."
                )
                respondToCall(
                    details,
                    CallResponse.Builder()
                        .setDisallowCall(true)
                        .setRejectCall(true)
                        .setSilenceCall(false)
                        .setSkipCallLog(false)
                        .setSkipNotification(false)
                        .build()
                )
                return
            }
        }

        val whitelist = readArray(prefs.getString("whitelist", "[]"))
        if (matchesList(whitelist, normalized)) {
            respondToCall(details, allowResponse())
            return
        }

        val callerName = details.callerDisplayName.orEmpty()
        RepeatedCallAttentionPolicy.onIncomingCall(applicationContext, number, callerName, trusted = false)

        val reported = ScamNumberRepository.isReported(applicationContext, normalized)
        if (reported && prefs.getBoolean("reported_scam_auto_block", true)) {
            CallNotificationHelper.showSecurityWarning(
                applicationContext,
                callerName.ifBlank { number.ifBlank { "Unknown caller" } },
                "REPORTED_SCAM",
                "HIGH",
                "This number has been reported as a scam. The call was blocked by your protection settings."
            )
            respondToCall(details, CallResponse.Builder()
                .setDisallowCall(true).setRejectCall(true).setSilenceCall(false)
                .setSkipCallLog(false).setSkipNotification(false).build())
            return
        }

        val risk = CallRiskAnalyzer.analyze(number, callerName)
        val riskEnabled = prefs.getBoolean("phase2_risk_detection_enabled", true)
        val financialEnabled = prefs.getBoolean("phase2_financial_warnings_enabled", true)
        val spoofEnabled = prefs.getBoolean("phase2_spoof_warnings_enabled", true)
        val patternWarning = risk.optBoolean("patternWarning", false) &&
            (!risk.optBoolean("financialScam", false) || financialEnabled)
        val spoofWarning = spoofEnabled && risk.optString("spoofRisk", "LOW") != "LOW"
        if (riskEnabled && (patternWarning || spoofWarning)) {
            CallNotificationHelper.showSecurityWarning(
                applicationContext,
                callerName.ifBlank { number.ifBlank { "Unknown caller" } },
                risk.optString("risk", "UNKNOWN"),
                risk.optString("spoofRisk", "LOW"),
                risk.optString("explanation", "Caller identity could not be verified locally.")
            )
        }

        val rules = readArray(prefs.getString("block_rules", "[]"))
        val matched = findRule(rules, normalized)
        val drivingMode = EmergencySafetyPolicy.drivingModeEnabled(applicationContext)

        if (matched != null) {
            val rejectHighRisk = prefs.getBoolean("smart_spam_reject_high_risk", false)
            val quietSpam = prefs.getBoolean("smart_spam_quiet_enabled", false)
            val builder = CallResponse.Builder()
            if (rejectHighRisk || !quietSpam) {
                builder.setDisallowCall(true).setRejectCall(true).setSilenceCall(false)
            } else {
                builder.setDisallowCall(false).setRejectCall(false).setSilenceCall(true)
            }
            respondToCall(details, builder.setSkipCallLog(false).setSkipNotification(false).build())
            return
        }

        val silenceUnknown = prefs.getBoolean("unknown_caller_silence", false)
        val rejectUnknown = prefs.getBoolean("unknown_caller_reject", false)
        val smartSilentUnknown = prefs.getBoolean("smart_silent_unknown_only", false) ||
            prefs.getBoolean("smart_silent_unknown_and_spam", false)
        val shouldSilenceUnknown = drivingMode || silenceUnknown || smartSilentUnknown
        val shouldRejectUnknown = !drivingMode && rejectUnknown
        respondToCall(details, CallResponse.Builder()
            .setDisallowCall(shouldRejectUnknown).setRejectCall(shouldRejectUnknown)
            .setSilenceCall(shouldSilenceUnknown).setSkipCallLog(false).setSkipNotification(false).build())
    }

    private fun allowResponse(): CallResponse = CallResponse.Builder()
        .setDisallowCall(false).setRejectCall(false).setSilenceCall(false)
        .setSkipCallLog(false).setSkipNotification(false).build()

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
        } catch (_: SecurityException) { false } catch (_: Exception) { false }
    }

    private fun readArray(value: String?): JSONArray = try { JSONArray(value ?: "[]") } catch (_: Exception) { JSONArray() }
    private fun normalize(value: String): String = value.filter { it.isDigit() }
}

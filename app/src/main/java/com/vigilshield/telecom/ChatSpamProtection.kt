package com.vigilshield.telecom

import org.json.JSONArray
import org.json.JSONObject

/**
 * Conservative, local-only chat spam analysis. It returns signals and a risk
 * level; callers decide whether to warn, quarantine, or deliver a message.
 * No network lookup or message retention is performed here.
 */
object ChatSpamProtection {
    private val urlPattern = Regex("(?i)\\b(?:https?://|www\\.)\\S+")
    private val financialPattern = Regex("(?i)\\b(?:otp|pin|cvv|upi|bank|account|credit|debit|loan|refund|payment|crypto|wallet|kyc|tax)\\b")
    private val urgencyPattern = Regex("(?i)\\b(?:urgent|immediately|act now|within \\d+ (?:minutes?|hours?)|expires?|suspended?|blocked?|verify now)\\b")
    private val rewardPattern = Regex("(?i)\\b(?:won|winner|prize|reward|cashback|lottery|gift card|free money|claim)\\b")
    private val credentialPattern = Regex("(?i)\\b(?:password|passcode|otp|one[- ]time code|security code|verification code)\\b")
    private val impersonationPattern = Regex("(?i)\\b(?:bank|police|court|government|income tax|customs|delivery|support|customer care|microsoft|google|apple|amazon)\\b")

    data class Result(
        val risk: String,
        val score: Int,
        val reasons: List<String>,
        val linkCount: Int,
        val repeatedCharacterRatio: Double,
        val action: String
    ) {
        fun toJson(): JSONObject = JSONObject()
            .put("risk", risk)
            .put("score", score)
            .put("reasons", JSONArray(reasons))
            .put("linkCount", linkCount)
            .put("repeatedCharacterRatio", repeatedCharacterRatio)
            .put("action", action)
    }

    fun analyze(message: String, senderKnown: Boolean = false, recentMessageCount: Int = 0): Result {
        val text = message.trim()
        if (text.isEmpty()) return Result("SAFE", 0, emptyList(), 0, 0.0, "DELIVER")

        val reasons = mutableListOf<String>()
        var score = 0
        val links = urlPattern.findAll(text).count()
        val normalized = text.lowercase().replace(Regex("\\s+"), " ")
        val repeatedChars = if (text.length < 12) 0.0 else {
            val repeated = text.windowed(2).count { it[0] == it[1] }
            repeated.toDouble() / (text.length - 1)
        }

        if (links > 0) { score += minOf(30, links * 15); reasons += "contains link" }
        if (links >= 2) { score += 10; reasons += "multiple links" }
        if (financialPattern.containsMatchIn(normalized) && credentialPattern.containsMatchIn(normalized)) {
            score += 35; reasons += "financial credentials requested"
        } else if (financialPattern.containsMatchIn(normalized)) {
            score += 15; reasons += "financial-service language"
        }
        if (urgencyPattern.containsMatchIn(normalized)) { score += 20; reasons += "urgent-action language" }
        if (rewardPattern.containsMatchIn(normalized)) { score += 20; reasons += "prize or reward lure" }
        if (impersonationPattern.containsMatchIn(normalized) && (urgencyPattern.containsMatchIn(normalized) || credentialPattern.containsMatchIn(normalized))) {
            score += 25; reasons += "authority or brand impersonation signal"
        }
        if (repeatedChars >= 0.18) { score += 10; reasons += "unusual repeated characters" }
        if (!senderKnown) { score += 5; reasons += "sender is not known locally" }
        if (recentMessageCount >= 5) { score += 15; reasons += "high recent message frequency" }
        if (recentMessageCount >= 10) { score += 15; reasons += "very high recent message frequency" }

        score = score.coerceIn(0, 100)
        val risk = when {
            score >= 75 -> "HIGH_RISK"
            score >= 45 -> "SUSPICIOUS"
            else -> "LOW_RISK"
        }
        val action = when (risk) {
            "HIGH_RISK" -> "QUARANTINE"
            "SUSPICIOUS" -> "WARN"
            else -> "DELIVER"
        }
        return Result(risk, score, reasons.distinct(), links, repeatedChars, action)
    }
}

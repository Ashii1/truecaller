package com.vigilshield.telecom

import org.json.JSONObject

object SmsSpamAnalyzer {
    private val scamWords = Regex("\\b(otp|kyc|upi|refund|prize|winner|lottery|cashback|loan|urgent|verify|blocked|suspend|click|claim|payment|bank|account|password|pin)\\b", RegexOption.IGNORE_CASE)
    private val linkPattern = Regex("https?://|www\\.", RegexOption.IGNORE_CASE)
    private val telecomPattern = Regex("\\b(trai|dnd|sim|telecom|mobile operator|number deactivation)\\b", RegexOption.IGNORE_CASE)

    fun analyze(sender: String, body: String): JSONObject {
        var score = 0
        val reasons = mutableListOf<String>()
        if (scamWords.containsMatchIn(body)) { score += 40; reasons += "scam-related language" }
        if (linkPattern.containsMatchIn(body)) { score += 25; reasons += "message contains a link" }
        if (telecomPattern.containsMatchIn(body) && scamWords.containsMatchIn(body)) {
            score += 25
            reasons += "telecom/DND scam pattern"
        }
        if (sender.filter(Char::isDigit).length < 5) { score += 10; reasons += "unusual sender format" }
        val category = when {
            score >= 70 -> "SCAM"
            score >= 35 -> "SPAM"
            else -> "OTHER"
        }
        return JSONObject()
            .put("category", category)
            .put("score", score.coerceIn(0, 100))
            .put("sender", sender)
            .put("reasons", reasons)
    }
}

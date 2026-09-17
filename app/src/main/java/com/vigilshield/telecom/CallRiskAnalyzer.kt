package com.vigilshield.telecom

import org.json.JSONObject

/**
 * Local-only safety heuristics. This is intentionally conservative: it never
 * claims that a caller is fraudulent and never relies on a remote database.
 */
object CallRiskAnalyzer {
    private val financialWords = Regex("\\b(bank|banking|upi|otp|kyc|credit|debit|loan|card|account|wallet|refund|payment|investment|crypto|tax|income tax|pan)\\b", RegexOption.IGNORE_CASE)
    private val urgencyWords = Regex("\\b(urgent|immediately|now|verify|suspend|blocked|expire|expired|legal action|police|arrest)\\b", RegexOption.IGNORE_CASE)
    private val impersonationWords = Regex("\\b(bank|police|court|tax|government|support|customer care|delivery|courier|amazon|microsoft|google|apple)\\b", RegexOption.IGNORE_CASE)
    private val telecomWords = Regex("\\b(trai|telecom|telecom company|dnd|do not disturb|sim|mobile operator|operator|jio|airtel|vi|bsnl|recharge|number deactivation|sim block|sim suspension)\\b", RegexOption.IGNORE_CASE)

    fun analyze(number: String, callerName: String = ""): JSONObject {
        val raw = number.trim()
        val digits = raw.filter(Char::isDigit)
        val name = callerName.trim()
        val financial = financialWords.containsMatchIn(name)
        val urgency = urgencyWords.containsMatchIn(name)
        val impersonation = impersonationWords.containsMatchIn(name)
        val telecom = telecomWords.containsMatchIn(name)
        val telecomImpersonation = telecom && (urgency || financial || impersonation)
        val malformed = raw.isNotEmpty() && digits.length < 7
        val privateNumber = raw.isBlank() || name.equals("Private number", true) || name.equals("Unknown caller", true)

        var score = 0
        val reasons = mutableListOf<String>()
        if (financial) { score += 45; reasons += "financial-service context" }
        if (urgency) { score += 20; reasons += "urgent-action language" }
        if (impersonation) { score += 15; reasons += "organization impersonation signal" }
        if (telecom) { score += 15; reasons += "telecom/DND context" }
        if (telecomImpersonation) { score += 20; reasons += "possible telecom authority impersonation" }
        if (malformed) { score += 20; reasons += "unusual caller number format" }
        if (privateNumber) { score += 10; reasons += "caller identity is unavailable" }

        val risk = when {
            score >= 70 -> "HIGH_RISK"
            score >= 35 -> "SUSPICIOUS"
            privateNumber || malformed -> "UNKNOWN"
            else -> "SAFE"
        }
        val spoofRisk = when {
            privateNumber -> "HIGH"
            malformed -> "MEDIUM"
            telecomImpersonation || (impersonation && financial) -> "MEDIUM"
            else -> "LOW"
        }
        val explanation = when {
            telecomImpersonation -> "Possible telecom/TRAI/DND impersonation pattern. Caller ID alone cannot verify an authority. Do not share OTPs or personal information."
            financial && urgency -> "Potential financial scam pattern: financial context combined with urgent action signals."
            financial -> "Financial-service context detected. Never share OTPs, PINs, passwords or remote-access codes."
            impersonation -> "Caller name resembles an organization or authority. Caller ID alone does not prove identity."
            telecom -> "Telecom or DND context detected. Verify through the operator's official channel rather than trusting the incoming call."
            malformed -> "The caller number has unusual metadata; treat caller ID as unverified."
            privateNumber -> "The caller identity is unavailable, so the call cannot be verified locally."
            else -> "No strong local scam pattern was detected. Caller identity is still not guaranteed."
        }
        return JSONObject()
            .put("risk", risk)
            .put("score", score.coerceIn(0, 100))
            .put("financialScam", financial)
            .put("telecomScam", telecomImpersonation)
            .put("patternWarning", financial || urgency || impersonation || telecom)
            .put("spoofRisk", spoofRisk)
            .put("explanation", explanation)
            .put("reasons", reasons)
    }
}

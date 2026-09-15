package com.vigilshield.telecom

import android.content.Context
import android.net.Uri
import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import androidx.annotation.RequiresApi
import kotlinx.coroutines.*
import java.util.concurrent.TimeUnit

/**
 * VigilShield Production CallScreeningService for Android (API 29+ / Android 10+).
 * 
 * Intercepts incoming voice calls via the Android Telecom subsystem, evaluates
 * local on-device SQLite block rules and cached reputation scores in sub-millisecond
 * time, and returns an immediate screening decision (Allow, Silence, Reject).
 */
@RequiresApi(Build.VERSION_CODES.Q)
class VigilShieldCallScreeningService : CallScreeningService() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onScreenCall(callDetails: Call.Details) {
        // Enforce incoming call check only
        if (callDetails.callDirection != Call.Details.DIRECTION_INCOMING) {
            respondToCall(callDetails, CallResponse.Builder().build())
            return
        }

        val handleUri: Uri? = callDetails.handle
        val rawNumber = handleUri?.schemeSpecificPart ?: ""

        // Handle private/withheld numbers
        if (rawNumber.isBlank()) {
            val shouldBlockPrivate = LocalSecurityDatabase.getInstance(this).getSetting("block_private_callers")
            if (shouldBlockPrivate) {
                val blockResponse = CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(false)
                    .setSkipNotification(true)
                    .build()
                respondToCall(callDetails, blockResponse)
                AuditLogger.logBlockedEvent(this, "PRIVATE_NUMBER", "Blocked by Private Caller Firewall Rule")
                return
            } else {
                respondToCall(callDetails, CallResponse.Builder().build())
                return
            }
        }

        // Fast-path: Normalized number lookup
        val normalizedE164 = PhoneNormalizer.toE164(rawNumber)

        // 1. Check Local Contacts first (Zero-latency privacy rule)
        if (LocalContactsResolver.isKnownContact(this, normalizedE164)) {
            // Never block user's personal address book contacts
            respondToCall(callDetails, CallResponse.Builder().build())
            return
        }

        // 2. Check Local Firewall Rules (Exact, Prefix, Regex, Ranges)
        val firewallMatch = LocalFirewallEngine.matchesBlockRule(this, normalizedE164)
        if (firewallMatch != null) {
            val response = CallResponse.Builder()
                .setDisallowCall(true)
                .setRejectCall(true)
                .setSkipCallLog(false)
                .setSkipNotification(true)
                .build()
            respondToCall(callDetails, response)
            AuditLogger.logBlockedEvent(this, normalizedE164, "Matched Firewall Rule: ${firewallMatch.label}")
            return
        }

        // 3. Inspect STIR/SHAKEN Caller ID Attestation Status
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val verificationStatus = callDetails.callerVerificationStatus
            if (verificationStatus == Call.Details.CALLER_VERIFICATION_STATUS_PASSED) {
                // Cryptographically signed carrier attestation A - mark as trusted
                respondToCall(callDetails, CallResponse.Builder().build())
                return
            }
        }

        // 4. Check Local High-Risk Spam Cache (Pre-synced SQLite DB)
        val cachedReputation = LocalSecurityDatabase.getInstance(this).getReputation(normalizedE164)
        val firewallMode = LocalSecurityDatabase.getInstance(this).getFirewallMode()

        if (cachedReputation != null && cachedReputation.riskScore >= 75) {
            val shouldReject = when (firewallMode) {
                FirewallMode.STRICT, FirewallMode.MAXIMUM -> true
                FirewallMode.SMART -> cachedReputation.riskScore >= 85
                FirewallMode.BASIC, FirewallMode.OFF -> false
            }

            if (shouldReject) {
                val blockResponse = CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(false)
                    .setSkipNotification(false) // Show notification so user is aware
                    .build()
                respondToCall(callDetails, blockResponse)
                AuditLogger.logBlockedEvent(this, normalizedE164, "Reputation score ${cachedReputation.riskScore}% (${cachedReputation.category})")
                return
            }
        }

        // Default: Allow call, broadcast metadata to in-call UI overlay
        respondToCall(callDetails, CallResponse.Builder().build())
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
    }
}

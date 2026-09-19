package com.vigilshield.telecom

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.util.Log
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject
import android.provider.CallLog
import java.util.concurrent.ConcurrentHashMap

/**
 * Official Android InCallService Implementation for CallShield.
 * 
 * When CallShield is granted the default dialer role (ROLE_DIALER) by Android Telecom,
 * the Android OS binds to this service to manage cellular voice calls.
 * 
 * Provides:
 * - Real call lifecycle handling (NEW, CONNECTING, DIALING, RINGING, ACTIVE, HOLDING, DISCONNECTED)
 * - Real call controls (answer, reject, disconnect, mute, speaker, DTMF, hold/resume, swap, merge)
 * - Multi-call management and audio routing
 * - Direct bidirectional bridging to the application UI
 */
@RequiresApi(Build.VERSION_CODES.Q)
class VigilShieldInCallService : InCallService() {

    companion object {
        private const val TAG = "CallShieldInCall"
        
        // Active singleton instance reference for UI bridge communication
        var instance: VigilShieldInCallService? = null
            private set
        var bridge: AndroidTelephonyBridge? = null
        var appContext: Context? = null
            
        // Thread-safe map of active Android Call objects indexed by unique Call ID
        val activeCalls = ConcurrentHashMap<String, Call>()
        
        // Callback listener for UI event dispatching
        var callEventListener: CallEventListener? = null
        
        fun isServiceBound(): Boolean = instance != null
        fun stopRinging() {
            appContext?.let { CallRingerHelper.silenceRinger(it) }
            runCatching { appContext?.getSystemService(android.telecom.TelecomManager::class.java)?.silenceRinger() }
        }
        fun isRinging(): Boolean = CallRingerHelper.isRinging() || activeCalls.values.any { it.state == Call.STATE_RINGING }
        fun emitActiveCalls() { activeCalls.forEach { (id, call) -> instance?.let { svc -> val d = svc.extractCallDetails(call, id); bridge?.dispatchCallEvent("CALL_STATE_CHANGED", JSONObject().put("callId", id).put("details", d.toJson())) } } }
        fun swapCalls(): Boolean = instance?.swapCallsInternal() ?: false
        fun mergeCalls(): Boolean = instance?.mergeCallsInternal() ?: false
        fun setSpeaker(enabled: Boolean): Boolean = instance?.setSpeakerRoute(enabled) != null
        fun readHistory(limit: Int): List<JSONObject> { val out = mutableListOf<JSONObject>(); runCatching { val a = JSONArray(appContext?.getSharedPreferences("vigilshield", Context.MODE_PRIVATE)?.getString("call_history", "[]") ?: "[]"); for (i in 0 until minOf(a.length(), limit.coerceIn(1, 500))) out += a.getJSONObject(i) }; return out }
    }

    interface CallEventListener {
        fun onCallStateChanged(callId: String, state: String, details: CallDetailsDto)
        fun onCallAdded(callId: String, details: CallDetailsDto)
        fun onCallRemoved(callId: String, details: CallDetailsDto, disconnectReason: String)
        fun onAudioStateChanged(isMuted: Boolean, route: String)
    }

    data class CallDetailsDto(
        val id: String,
        val number: String,
        val callerDisplayName: String?,
        val state: String,
        val isIncoming: Boolean,
        val isHolding: Boolean,
        val connectTimeMillis: Long,
        val durationSeconds: Long,
        val simAccount: String?,
        val verificationStatus: Int,
        val canHold: Boolean,
        val canMerge: Boolean,
        val canSwap: Boolean
    ) {
        fun toJson(): JSONObject {
            return JSONObject().apply {
                put("id", id)
                put("number", number)
                put("callerDisplayName", callerDisplayName ?: "")
                put("state", state)
                put("isIncoming", isIncoming)
                put("isHolding", isHolding)
                put("connectTimeMillis", connectTimeMillis)
                put("durationSeconds", durationSeconds)
                put("simAccount", simAccount ?: "")
                put("verificationStatus", verificationStatus)
                put("canHold", canHold)
                put("canMerge", canMerge)
                put("canSwap", canSwap)
            }
        }
    }

    private val callCallbacks = ConcurrentHashMap<String, Call.Callback>()

    override fun onCreate() {
        super.onCreate()
        instance = this
        appContext = applicationContext
        ensureRingerNotMuted(applicationContext)
        CallNotificationHelper.ensureChannel(applicationContext)
        Log.i(TAG, "CallShield InCallService instantiated and bound by Android Telecom.")
    }

    override fun onDestroy() {
        super.onDestroy()
        activeCalls.clear()
        callCallbacks.clear()
        instance = null
        Log.i(TAG, "CallShield InCallService destroyed.")
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        val callId = getCallIdentifier(call)
        activeCalls[callId] = call
        Log.i(TAG, "onCallAdded: $callId, state=${stateToString(call.state)}")

        val callback = object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                val stateName = stateToString(state)
                Log.d(TAG, "Call $callId state changed to: $stateName")
                val details = extractCallDetails(call, callId)
                val name = details.callerDisplayName.orEmpty().ifBlank { details.number.ifBlank { "Unknown caller" } }
                val number = details.number

                when (state) {
                    Call.STATE_RINGING -> {
                        handleIncomingCall(call, callId)
                    }
                    Call.STATE_ACTIVE, Call.STATE_DIALING, Call.STATE_CONNECTING, Call.STATE_HOLDING -> {
                        CallRingerHelper.stopRinging(applicationContext)
                        CallNotificationHelper.clearCall(applicationContext, callId)
                        CallNotificationHelper.showOngoingCall(applicationContext, callId, name, number, stateName, details.connectTimeMillis)
                    }
                    Call.STATE_DISCONNECTED -> {
                        CallRingerHelper.stopRinging(applicationContext)
                        CallNotificationHelper.clearCall(applicationContext, callId)
                        if (details.isIncoming && details.connectTimeMillis <= 0L) {
                            CallNotificationHelper.showMissedCall(applicationContext, name, number)
                        }
                    }
                }

                callEventListener?.onCallStateChanged(callId, stateName, details)
                bridge?.dispatchCallEvent(if (state == Call.STATE_DISCONNECTED) "CALL_DISCONNECTED" else "CALL_STATE_CHANGED", JSONObject().put("callId", callId).put("details", details.toJson()))
                
                // If call disconnected, persist to device call log if needed
                if (state == Call.STATE_DISCONNECTED) {
                    val disconnectCause = call.details.disconnectCause
                    Log.i(TAG, "Call $callId disconnected: ${disconnectCause.description}")
                }
            }

            override fun onDetailsChanged(call: Call, details: Call.Details) {
                super.onDetailsChanged(call, details)
                val callDetails = extractCallDetails(call, callId)
                callEventListener?.onCallStateChanged(callId, stateToString(call.state), callDetails)
            }

            override fun onConferenceableCallsChanged(call: Call, conferenceableCalls: MutableList<Call>?) {
                super.onConferenceableCallsChanged(call, conferenceableCalls)
                val callDetails = extractCallDetails(call, callId)
                callEventListener?.onCallStateChanged(callId, stateToString(call.state), callDetails)
            }
        }

        callCallbacks[callId] = callback
        call.registerCallback(callback)

        val initialDetails = extractCallDetails(call, callId)
        val initialName = initialDetails.callerDisplayName.orEmpty().ifBlank { initialDetails.number.ifBlank { "Unknown caller" } }
        val initialNumber = initialDetails.number

        if (call.state == Call.STATE_RINGING) {
            handleIncomingCall(call, callId)
        } else if (call.state == Call.STATE_ACTIVE || call.state == Call.STATE_DIALING || call.state == Call.STATE_CONNECTING || call.state == Call.STATE_HOLDING) {
            CallNotificationHelper.showOngoingCall(applicationContext, callId, initialName, initialNumber, stateToString(call.state), initialDetails.connectTimeMillis)
        }

        callEventListener?.onCallAdded(callId, initialDetails)
        bridge?.dispatchCallEvent(if (call.state == Call.STATE_RINGING) "CALL_ADDED" else "CALL_STATE_CHANGED", JSONObject().put("callId", callId).put("details", initialDetails.toJson()))
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        val callId = getCallIdentifier(call)
        val callback = callCallbacks.remove(callId)
        if (callback != null) {
            call.unregisterCallback(callback)
        }
        val details = extractCallDetails(call, callId)
        activeCalls.remove(callId)
        
        val disconnectReason = call.details.disconnectCause?.description?.toString() ?: "Call ended"
        Log.i(TAG, "onCallRemoved: $callId, reason: $disconnectReason")
        CallRingerHelper.stopRinging(applicationContext)
        CallNotificationHelper.clearCall(applicationContext, callId)
        if (activeCalls.isEmpty()) {
            CallNotificationHelper.clearAllCallNotifications(applicationContext)
            ensureRingerNotMuted(applicationContext)
            releaseWakeLock()
        }
        callEventListener?.onCallRemoved(callId, details, disconnectReason)
        bridge?.dispatchCallEvent("CALL_DISCONNECTED", JSONObject().put("callId", callId).put("details", details.toJson()))
    }

    override fun onCallAudioStateChanged(audioState: CallAudioState?) {
        super.onCallAudioStateChanged(audioState)
        if (audioState == null) return
        val isMuted = audioState.isMuted
        val routeName = when (audioState.route) {
            CallAudioState.ROUTE_SPEAKER -> "SPEAKER"
            CallAudioState.ROUTE_BLUETOOTH -> "BLUETOOTH"
            CallAudioState.ROUTE_WIRED_HEADSET -> "HEADSET"
            else -> "EARPIECE"
        }
        Log.d(TAG, "onCallAudioStateChanged: muted=$isMuted, route=$routeName")
        callEventListener?.onAudioStateChanged(isMuted, routeName)
    }

    // --- REAL CALL ACTIONS VIA ANDROID TELECOM APIS ---

    fun answerCall(callId: String): Boolean {
        CallRingerHelper.stopRinging(applicationContext)
        val call = activeCalls[callId] ?: return false
        if (call.state == Call.STATE_RINGING) {
            call.answer(VideoProfile.STATE_AUDIO_ONLY)
            Log.i(TAG, "Real call answered: $callId")
            return true
        }
        return false
    }

    fun rejectCall(callId: String, rejectWithMessage: String? = null): Boolean {
        CallRingerHelper.stopRinging(applicationContext)
        val call = activeCalls[callId] ?: return false
        if (call.state == Call.STATE_RINGING) {
            if (rejectWithMessage != null) {
                call.reject(true, rejectWithMessage)
            } else {
                call.reject(false, null)
            }
            Log.i(TAG, "Real call rejected: $callId")
            return true
        }
        return false
    }

    fun disconnectCall(callId: String): Boolean {
        CallRingerHelper.stopRinging(applicationContext)
        val call = activeCalls[callId] ?: return false
        call.disconnect()
        Log.i(TAG, "Real call disconnected: $callId")
        return true
    }

    fun setCallMute(muted: Boolean) {
        setMuted(muted)
        Log.i(TAG, "Microphone mute state set to: $muted")
    }

    fun setSpeaker(enabled: Boolean): Boolean {
        return runCatching {
            setAudioRoute(if (enabled) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)
            true
        }.getOrDefault(false)
    }

    fun setSpeakerRoute(enabled: Boolean) {
        val targetRoute = if (enabled) {
            CallAudioState.ROUTE_SPEAKER
        } else {
            CallAudioState.ROUTE_EARPIECE
        }
        setAudioRoute(targetRoute)
        Log.i(TAG, "Audio route switched: ${if (enabled) "SPEAKER" else "EARPIECE"}")
    }

    fun sendDtmfTone(callId: String, digit: Char): Boolean {
        val call = activeCalls[callId] ?: return false
        if (call.state == Call.STATE_ACTIVE) {
            call.playDtmfTone(digit)
            call.stopDtmfTone()
            Log.d(TAG, "DTMF tone sent for call $callId: $digit")
            return true
        }
        return false
    }

    fun holdCall(callId: String): Boolean {
        val call = activeCalls[callId] ?: return false
        if (call.state == Call.STATE_ACTIVE) {
            call.hold()
            Log.i(TAG, "Call put on hold: $callId")
            return true
        }
        return false
    }

    fun unholdCall(callId: String): Boolean {
        val call = activeCalls[callId] ?: return false
        if (call.state == Call.STATE_HOLDING) {
            call.unhold()
            Log.i(TAG, "Call resumed from hold: $callId")
            return true
        }
        return false
    }

    fun swapCalls(): Boolean {
        // Swap between active and held call
        val activeCall = activeCalls.values.find { it.state == Call.STATE_ACTIVE }
        val heldCall = activeCalls.values.find { it.state == Call.STATE_HOLDING }
        if (activeCall != null && heldCall != null) {
            activeCall.hold()
            heldCall.unhold()
            Log.i(TAG, "Swapped active and held calls")
            return true
        }
        return false
    }

    fun mergeCalls(): Boolean {
        val activeCall = activeCalls.values.find { it.state == Call.STATE_ACTIVE }
        val conferenceable = activeCall?.conferenceableCalls
        if (activeCall != null && !conferenceable.isNullOrEmpty()) {
            activeCall.conference(conferenceable[0])
            Log.i(TAG, "Merged calls into carrier conference")
            return true
        }
        return false
    }

    private fun swapCallsInternal(): Boolean { val active = activeCalls.values.firstOrNull { it.state == Call.STATE_ACTIVE } ?: return false; val held = activeCalls.values.firstOrNull { it.state == Call.STATE_HOLDING } ?: return false; active.hold(); held.unhold(); return true }
    private fun mergeCallsInternal(): Boolean { val active = activeCalls.values.firstOrNull { it.state == Call.STATE_ACTIVE } ?: return false; val other = active.conferenceableCalls?.firstOrNull() ?: activeCalls.values.firstOrNull { it !== active } ?: return false; return runCatching { active.conference(other); true }.getOrDefault(false) }

    // Helper functions
    private fun getCallIdentifier(call: Call): String {
        val handle = call.details?.handle?.schemeSpecificPart ?: "unknown"
        return "call_${handle}_${call.hashCode()}"
    }

    private fun extractCallDetails(call: Call, callId: String): CallDetailsDto {
        val details = call.details
        val rawNumber = details?.handle?.schemeSpecificPart ?: ""
        val callerName = details?.callerDisplayName
        val isIncoming = details?.hasProperty(Call.Details.PROPERTY_IS_EXTERNAL_CALL) == true ||
                call.state == Call.STATE_RINGING ||
                (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && details?.callDirection == Call.Details.DIRECTION_INCOMING)
        val isHolding = call.state == Call.STATE_HOLDING
        val connectTime = details?.connectTimeMillis ?: 0L
        val duration = if (connectTime > 0) (System.currentTimeMillis() - connectTime) / 1000 else 0L
        val simAccount = details?.accountHandle?.id
        val verificationStatus = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            0
        } else {
            0
        }
        val capabilities = details?.callCapabilities ?: 0
        val canHold = (capabilities and Call.Details.CAPABILITY_HOLD) != 0 ||
                (capabilities and Call.Details.CAPABILITY_SUPPORT_HOLD) != 0
        val canMerge = (capabilities and Call.Details.CAPABILITY_MERGE_CONFERENCE) != 0
        val canSwap = (capabilities and Call.Details.CAPABILITY_SWAP_CONFERENCE) != 0

        return CallDetailsDto(
            id = callId,
            number = rawNumber,
            callerDisplayName = callerName,
            state = stateToString(call.state),
            isIncoming = isIncoming,
            isHolding = isHolding,
            connectTimeMillis = connectTime,
            durationSeconds = duration,
            simAccount = simAccount,
            verificationStatus = verificationStatus,
            canHold = canHold,
            canMerge = canMerge,
            canSwap = canSwap
        )
    }

    private fun stateToString(state: Int): String {
        return when (state) {
            Call.STATE_NEW -> "NEW"
            Call.STATE_CONNECTING -> "CONNECTING"
            Call.STATE_SELECT_PHONE_ACCOUNT -> "SELECT_PHONE_ACCOUNT"
            Call.STATE_DIALING -> "DIALING"
            Call.STATE_RINGING -> "RINGING"
            Call.STATE_ACTIVE -> "ACTIVE"
            Call.STATE_HOLDING -> "HOLDING"
            Call.STATE_DISCONNECTED -> "DISCONNECTED"
            Call.STATE_DISCONNECTING -> "DISCONNECTING"
            else -> "UNKNOWN"
        }
    }

    private var incomingWakeLock: android.os.PowerManager.WakeLock? = null

    private fun handleIncomingCall(call: Call, callId: String) {
        val details = extractCallDetails(call, callId)
        val name = details.callerDisplayName.orEmpty().ifBlank { details.number.ifBlank { "Incoming call" } }
        val number = details.number
        wakeScreenUp(applicationContext)
        CallRingerHelper.startRinging(applicationContext)
        CallNotificationHelper.showIncomingCall(applicationContext, callId, name, number)

        val km = applicationContext.getSystemService(android.app.KeyguardManager::class.java)
        val isLocked = km?.isKeyguardLocked == true
        val sp = applicationContext.getSharedPreferences("vigilshield", Context.MODE_PRIVATE)
        val alwaysOnTop = sp.getBoolean("always_on_top_call_overlay", true)

        if (isLocked || !MainActivity.isAppVisible || alwaysOnTop) {
            launchIncomingCallActivity(applicationContext, callId, name, number)
        }
    }

    private fun wakeScreenUp(context: Context) {
        runCatching {
            val pm = context.getSystemService(android.os.PowerManager::class.java)
            if (incomingWakeLock?.isHeld == true) {
                try { incomingWakeLock?.release() } catch (_: Throwable) {}
            }
            @Suppress("DEPRECATION")
            incomingWakeLock = pm?.newWakeLock(
                android.os.PowerManager.FULL_WAKE_LOCK or
                    android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    android.os.PowerManager.ON_AFTER_RELEASE,
                "CallShield:IncomingWakeLock"
            )?.apply {
                setReferenceCounted(false)
                acquire(45_000L)
            }
        }
    }

    private fun releaseWakeLock() {
        runCatching {
            if (incomingWakeLock?.isHeld == true) {
                incomingWakeLock?.release()
            }
            incomingWakeLock = null
        }
    }

    private fun launchIncomingCallActivity(context: Context, callId: String, name: String, number: String) {
        runCatching {
            val intent = Intent(context, IncomingCallActivity::class.java).apply {
                putExtra("open_call_id", callId)
                putExtra("open_call_number", number)
                putExtra("display_name", name)
                addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_CLEAR_TOP or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                )
            }
            context.startActivity(intent)
        }
    }

    private fun ensureRingerNotMuted(context: Context) {
        runCatching {
            val audio = context.getSystemService(android.media.AudioManager::class.java) ?: return
            if (audio.ringerMode == android.media.AudioManager.RINGER_MODE_NORMAL) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (audio.isStreamMute(android.media.AudioManager.STREAM_RING)) {
                        audio.adjustStreamVolume(android.media.AudioManager.STREAM_RING, android.media.AudioManager.ADJUST_UNMUTE, 0)
                    }
                    if (audio.isStreamMute(android.media.AudioManager.STREAM_NOTIFICATION)) {
                        audio.adjustStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION, android.media.AudioManager.ADJUST_UNMUTE, 0)
                    }
                }
            }
        }
    }
}

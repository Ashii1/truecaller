package com.vigilshield.telecom

import android.app.Activity
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONArray
import org.json.JSONObject

/**
 * High-performance JavaScript Interface Bridge.
 * 
 * Exposes real Android Telecom subsystem APIs to the VigilShield React frontend.
 * Evaluates callbacks into window.__onAndroidTelecomEvent(eventType, payload).
 */
class AndroidTelephonyBridge(
    private val activity: Activity,
    private val webView: WebView,
    private val telecomManager: TelecomCallManager,
    private val callLogRepository: CallLogRepository
) : VigilShieldInCallService.CallEventListener, CallLogRepository.CallLogChangeListener {

    companion object {
        private const val TAG = "AndroidTelecomBridge"
        const val INTERFACE_NAME = "AndroidTelecomBridge"
    }

    private val mainHandler = Handler(Looper.getMainLooper())

    init {
        VigilShieldInCallService.callEventListener = this
        callLogRepository.registerObserver(this)
    }

    // --- JAVASCRIPT CALLABLE INTERFACES ---

    @JavascriptInterface
    fun checkDefaultDialerStatus(): String {
        val result = JSONObject().apply {
            put("isDefaultDialer", telecomManager.isDefaultDialer())
            put("isDialerRoleAvailable", telecomManager.isDialerRoleAvailable())
            put("isInCallServiceBound", VigilShieldInCallService.isServiceBound())
        }
        return result.toString()
    }

    @JavascriptInterface
    fun requestDefaultDialerRole(): Boolean {
        Log.i(TAG, "Requesting official Android ROLE_DIALER via RoleManager")
        return telecomManager.requestDefaultDialerRole(activity)
    }

    @JavascriptInterface
    fun getPhoneAccounts(): String {
        val accounts = telecomManager.getAvailablePhoneAccounts()
        val jsonArray = JSONArray()
        for (acc in accounts) {
            jsonArray.put(acc.toJson())
        }
        return jsonArray.toString()
    }

    @JavascriptInterface
    fun getTelephonyDiagnostics(): String {
        val status = telecomManager.getTelephonyStatus()
        status.put("activeCallsCount", VigilShieldInCallService.activeCalls.size)
        status.put("inCallServiceBound", VigilShieldInCallService.isServiceBound())
        status.put("callLogPermission", callLogRepository.hasCallLogPermission())
        status.put("contactsPermission", callLogRepository.hasContactsPermission())
        
        val accounts = telecomManager.getAvailablePhoneAccounts()
        val sim1 = accounts.find { it.slotIndex == 0 }
        val sim2 = accounts.find { it.slotIndex == 1 }
        
        status.put("sim1Available", sim1 != null)
        status.put("sim1Carrier", sim1?.carrierName ?: "None")
        status.put("sim2Available", sim2 != null)
        status.put("sim2Carrier", sim2?.carrierName ?: "None")
        
        return status.toString()
    }

    @JavascriptInterface
    fun placeRealCall(number: String, accountHandleId: String?): String {
        Log.i(TAG, "Initiating real cellular call to: $number (account: $accountHandleId)")
        val result = telecomManager.placeRealCall(number, accountHandleId)
        return JSONObject().apply {
            put("success", result.success)
            put("message", result.message)
        }.toString()
    }

    @JavascriptInterface
    fun answerCall(callId: String): Boolean {
        val inCall = VigilShieldInCallService.instance
        if (inCall == null) {
            Log.w(TAG, "Cannot answer call: InCallService not bound")
            return false
        }
        return inCall.answerCall(callId)
    }

    @JavascriptInterface
    fun rejectCall(callId: String, rejectReason: String?): Boolean {
        val inCall = VigilShieldInCallService.instance
        if (inCall == null) {
            Log.w(TAG, "Cannot reject call: InCallService not bound")
            return false
        }
        return inCall.rejectCall(callId, rejectReason)
    }

    @JavascriptInterface
    fun disconnectCall(callId: String): Boolean {
        val inCall = VigilShieldInCallService.instance
        if (inCall == null) {
            Log.w(TAG, "Cannot disconnect call: InCallService not bound")
            return false
        }
        return inCall.disconnectCall(callId)
    }

    @JavascriptInterface
    fun setMuted(muted: Boolean): Boolean {
        val inCall = VigilShieldInCallService.instance ?: return false
        inCall.setCallMute(muted)
        return true
    }

    @JavascriptInterface
    fun setSpeakerRoute(enabled: Boolean): Boolean {
        val inCall = VigilShieldInCallService.instance ?: return false
        inCall.setSpeakerRoute(enabled)
        return true
    }

    @JavascriptInterface
    fun sendDtmfTone(callId: String, digit: String): Boolean {
        val inCall = VigilShieldInCallService.instance ?: return false
        if (digit.isNotEmpty()) {
            return inCall.sendDtmfTone(callId, digit[0])
        }
        return false
    }

    @JavascriptInterface
    fun holdCall(callId: String): Boolean {
        val inCall = VigilShieldInCallService.instance ?: return false
        return inCall.holdCall(callId)
    }

    @JavascriptInterface
    fun unholdCall(callId: String): Boolean {
        val inCall = VigilShieldInCallService.instance ?: return false
        return inCall.unholdCall(callId)
    }

    @JavascriptInterface
    fun swapCalls(): Boolean {
        val inCall = VigilShieldInCallService.instance ?: return false
        return inCall.swapCalls()
    }

    @JavascriptInterface
    fun mergeCalls(): Boolean {
        val inCall = VigilShieldInCallService.instance ?: return false
        return inCall.mergeCalls()
    }

    @JavascriptInterface
    fun fetchRealCallLogs(limit: Int): String {
        val records = callLogRepository.fetchDeviceCallHistory(if (limit > 0) limit else 100)
        val jsonArray = JSONArray()
        for (r in records) {
            jsonArray.put(r.toJson())
        }
        return jsonArray.toString()
    }

    @JavascriptInterface
    fun fetchRealContacts(limit: Int): String {
        val contacts = callLogRepository.fetchDeviceContacts(if (limit > 0) limit else 300)
        val jsonArray = JSONArray()
        for (c in contacts) {
            jsonArray.put(c.toJson())
        }
        return jsonArray.toString()
    }

    @JavascriptInterface
    fun moveTaskToBack(): Boolean {
        activity.runOnUiThread {
            activity.moveTaskToBack(true)
        }
        return true
    }

    // --- EVENT DISPATCHING TO REACT FRONTEND ---

    override fun onCallAdded(callId: String, details: VigilShieldInCallService.CallDetailsDto) {
        val payload = JSONObject().apply {
            put("callId", callId)
            put("details", details.toJson())
        }
        dispatchWebEvent("CALL_ADDED", payload)
    }

    override fun onCallStateChanged(callId: String, state: String, details: VigilShieldInCallService.CallDetailsDto) {
        val payload = JSONObject().apply {
            put("callId", callId)
            put("state", state)
            put("details", details.toJson())
        }
        dispatchWebEvent("CALL_STATE_CHANGED", payload)
    }

    override fun onCallRemoved(callId: String, details: VigilShieldInCallService.CallDetailsDto, disconnectReason: String) {
        val payload = JSONObject().apply {
            put("callId", callId)
            put("details", details.toJson())
            put("disconnectReason", disconnectReason)
        }
        dispatchWebEvent("CALL_REMOVED", payload)
    }

    override fun onAudioStateChanged(isMuted: Boolean, route: String) {
        val payload = JSONObject().apply {
            put("isMuted", isMuted)
            put("route", route)
        }
        dispatchWebEvent("AUDIO_ROUTE_CHANGED", payload)
    }

    override fun onCallLogChanged() {
        dispatchWebEvent("CALL_LOG_CHANGED", JSONObject())
    }

    private fun dispatchWebEvent(eventType: String, data: JSONObject) {
        mainHandler.post {
            val script = "if (window.__onAndroidTelecomEvent) { window.__onAndroidTelecomEvent('$eventType', ${data}); }"
            webView.evaluateJavascript(script, null)
        }
    }
}

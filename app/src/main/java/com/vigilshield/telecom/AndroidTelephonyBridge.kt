package com.vigilshield.telecom

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.CallLog
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallScreeningService as AndroidCallScreeningService
import android.telecom.InCallService
import android.telecom.TelecomManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class AndroidTelephonyBridge(
    private val activity: Activity,
    private val webView: WebView
) {
    companion object { const val INTERFACE_NAME = "AndroidTelecomBridge" }
    private val telecom: TelecomManager get() = activity.getSystemService(TelecomManager::class.java)

    init { NativeInCallService.bridge = this }

    @JavascriptInterface fun checkDefaultDialerStatus(): String = roleStatus().toString()

    @JavascriptInterface fun requestDefaultDialerRole(): Boolean {
        if (Build.VERSION.SDK_INT < 29) return false
        val rm = activity.getSystemService(android.app.role.RoleManager::class.java)
        if (!rm.isRoleAvailable(android.app.role.RoleManager.ROLE_DIALER)) return false
        activity.startActivityForResult(rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_DIALER), 7001)
        return true
    }

    @JavascriptInterface fun requestCallScreeningRole(): Boolean {
        if (Build.VERSION.SDK_INT < 29) return false
        val rm = activity.getSystemService(android.app.role.RoleManager::class.java)
        if (!rm.isRoleAvailable(android.app.role.RoleManager.ROLE_CALL_SCREENING)) return false
        if (rm.isRoleHeld(android.app.role.RoleManager.ROLE_CALL_SCREENING)) return true
        activity.startActivityForResult(rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_CALL_SCREENING), 7003)
        return true
    }

    @JavascriptInterface fun getPhoneAccounts(): String {
        val result = JSONArray()
        telecom.callCapablePhoneAccounts.forEachIndexed { index, handle ->
            result.put(JSONObject().put("id", handle.id).put("label", handle.id)
                .put("carrierName", handle.componentName.packageName)
                .put("slotIndex", index).put("displayName", "SIM ${index + 1}").put("isDefault", false))
        }
        return result.toString()
    }

    @JavascriptInterface fun getTelephonyDiagnostics(): String {
        val accounts = telecom.callCapablePhoneAccounts
        val audio = activity.getSystemService(Context.AUDIO_SERVICE) as android.media.AudioManager
        return JSONObject()
            .put("isDefaultDialer", isDefaultDialer())
            .put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
            .put("isCallScreeningRoleHeld", if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(android.app.role.RoleManager::class.java).isRoleHeld(android.app.role.RoleManager.ROLE_CALL_SCREENING) else false)
            .put("isInCallServiceBound", NativeInCallService.instance != null)
            .put("hasSim", accounts.isNotEmpty())
            .put("isAirplaneMode", false)
            .put("isNetworkAvailable", true)
            .put("networkOperatorName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown")
            .put("simCarrierIdName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown")
            .put("activeCallsCount", NativeInCallService.activeCalls.size)
            .put("callLogPermission", hasCallLogPermission())
            .put("contactsPermission", hasContactsPermission())
            .put("speakerOn", audio.isSpeakerphoneOn)
            .put("sim1Available", accounts.isNotEmpty())
            .put("sim1Carrier", if (accounts.isNotEmpty()) accounts[0].componentName.packageName else "None")
            .put("sim2Available", accounts.size > 1)
            .put("sim2Carrier", if (accounts.size > 1) accounts[1].componentName.packageName else "None")
            .toString()
    }

    @JavascriptInterface fun placeRealCall(number: String, accountHandleId: String?): String {
        if (!isDefaultDialer()) return JSONObject().put("success", false).put("message", "VigilShield must be the default Phone app").toString()
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED)
            return JSONObject().put("success", false).put("message", "CALL_PHONE permission is required").toString()
        return try {
            val extras = Bundle()
            telecom.callCapablePhoneAccounts.firstOrNull { it.id == accountHandleId }
                ?.let { extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }
            telecom.callCapablePhoneAccounts.firstOrNull()?.let { if (!extras.containsKey(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE)) extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }
            telecom.placeCall(Uri.fromParts("tel", number, null), extras)
            JSONObject().put("success", true).put("message", "Call sent to Android Telecom").toString()
        } catch (e: Exception) { JSONObject().put("success", false).put("message", e.message ?: "Unable to place call").toString() }
    }

    @JavascriptInterface fun fetchRealContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchDeviceContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchRealCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun fetchDeviceCallLogs(limit: Int): String = readCallLogs(limit).toString()

    @JavascriptInterface fun lookupContactName(number: String): String = lookupName(number).orEmpty()

    @JavascriptInterface fun answerCall(callId: String): Boolean = NativeInCallService.activeCalls[callId]?.let { it.answer(0); true } ?: false
    @JavascriptInterface fun rejectCall(callId: String, reason: String?): Boolean = NativeInCallService.activeCalls[callId]?.let { it.reject(false, reason ?: ""); true } ?: false
    @JavascriptInterface fun disconnectCall(callId: String): Boolean = NativeInCallService.activeCalls[callId]?.let { it.disconnect(); true } ?: false

    @JavascriptInterface fun setMuted(muted: Boolean): Boolean = NativeInCallService.instance?.let { it.setMuted(muted); true } ?: false
    @JavascriptInterface fun setSpeakerRoute(enabled: Boolean): Boolean = NativeInCallService.instance?.setSpeaker(enabled) ?: false
    @JavascriptInterface fun sendDtmfTone(callId: String, digit: String): Boolean {
        val c = NativeInCallService.activeCalls[callId] ?: return false
        val d = digit.firstOrNull() ?: return false
        c.playDtmfTone(d)
        c.stopDtmfTone()
        return true
    }
    @JavascriptInterface fun holdCall(callId: String): Boolean = NativeInCallService.activeCalls[callId]?.let { it.hold(); true } ?: false
    @JavascriptInterface fun unholdCall(callId: String): Boolean = NativeInCallService.activeCalls[callId]?.let { it.unhold(); true } ?: false
    @JavascriptInterface fun swapCalls(): Boolean = NativeInCallService.swapCalls()
    @JavascriptInterface fun mergeCalls(): Boolean = NativeInCallService.mergeCalls()

    @JavascriptInterface fun syncBlockRules(json: String): Boolean = try {
        activity.getSharedPreferences("vigilshield", Context.MODE_PRIVATE).edit().putString("block_rules", json).apply(); true
    } catch (_: Exception) { false }
    @JavascriptInterface fun syncWhitelist(json: String): Boolean = try {
        activity.getSharedPreferences("vigilshield", Context.MODE_PRIVATE).edit().putString("whitelist", json).apply(); true
    } catch (_: Exception) { false }

    fun isDefaultDialer(): Boolean = if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(android.app.role.RoleManager::class.java).isRoleHeld(android.app.role.RoleManager.ROLE_DIALER) else telecom.defaultDialerPackage == activity.packageName
    fun hasCallLogPermission(): Boolean = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
    fun hasContactsPermission(): Boolean = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    fun hasDevicePermissions(): Boolean = hasContactsPermission()

    fun roleStatus(): JSONObject = JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
    fun permissionStatus(): JSONObject = JSONObject().put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission())
    fun dispatchWebEvent(type: String, data: JSONObject) { webView.post { webView.evaluateJavascript("if(window.__onAndroidTelecomEvent){window.__onAndroidTelecomEvent(${JSONObject.quote(type)},$data);}", null) } }
    fun dispatchCallEvent(type: String, payload: JSONObject) = dispatchWebEvent(type, payload)

    private fun readContacts(limit: Int): JSONArray {
        val result = JSONArray(); if (!hasContactsPermission()) return result
        val safeLimit = limit.coerceIn(1, 2000)
        val projection = arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.STARRED)
        activity.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection, null, null, "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { cursor ->
            var count = 0
            while (cursor.moveToNext() && count < safeLimit) {
                result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("name", cursor.getString(1).orEmpty()).put("number", cursor.getString(2).orEmpty()).put("isFavorite", cursor.getInt(3) == 1)); count++
            }
        }
        return result
    }

    private fun lookupName(number: String): String? {
        if (!hasContactsPermission() || number.isBlank()) return null
        return activity.contentResolver.query(Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number)), arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)?.use { if (it.moveToFirst()) it.getString(0) else null }
    }

    private fun readCallLogs(limit: Int): JSONArray {
        val result = JSONArray()
        if (hasCallLogPermission()) {
            val safeLimit = limit.coerceIn(1, 500)
            val uri = CallLog.Calls.CONTENT_URI.buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, safeLimit.toString()).build()
            val projection = arrayOf(CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION)
            activity.contentResolver.query(uri, projection, null, null, "${CallLog.Calls.DATE} DESC")?.use { cursor ->
                while (cursor.moveToNext()) {
                    val number = cursor.getString(1).orEmpty(); val name = lookupName(number) ?: cursor.getString(2)
                    result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("number", number).put("callerName", name ?: number.ifBlank { "Unknown caller" }).put("type", when(cursor.getInt(3)){CallLog.Calls.INCOMING_TYPE->"INCOMING";CallLog.Calls.OUTGOING_TYPE->"OUTGOING";CallLog.Calls.MISSED_TYPE->"MISSED";CallLog.Calls.REJECTED_TYPE->"REJECTED";else->"UNKNOWN"}).put("timestamp", cursor.getLong(4)).put("durationSeconds", cursor.getLong(5)).put("isContact", !name.isNullOrBlank() && name != number))
                }
            }
        } else {
            val stored = NativeInCallService.readHistory(limit)
            for (i in 0 until stored.length()) result.put(stored.getJSONObject(i))
        }
        return result
    }
}

class NativeInCallService : InCallService() {
    companion object {
        var instance: NativeInCallService? = null
        var bridge: AndroidTelephonyBridge? = null
        val activeCalls: MutableMap<String, Call> = mutableMapOf()
        private val callbacks: MutableMap<String, Call.Callback> = mutableMapOf()
        private val ids: MutableMap<Call, String> = mutableMapOf()
        private val historyLock = Any()

        fun idFor(call: Call): String = ids[call] ?: "call-${System.identityHashCode(call)}"

        fun readHistory(limit: Int): JSONArray {
            val prefs = bridge?.let { null } ?: return JSONArray()
            return JSONArray()
        }

        fun swapCalls(): Boolean {
            val held = activeCalls.values.filter { it.state == Call.STATE_HOLDING }
            val active = activeCalls.values.firstOrNull { it.state == Call.STATE_ACTIVE }
            if (active == null || held.isEmpty()) return false
            active.hold(); held.first().unhold(); return true
        }

        fun mergeCalls(): Boolean {
            val calls = activeCalls.values.toList(); if (calls.size < 2) return false
            return try { calls[0].conference(calls[1]); true } catch (_: Exception) { false }
        }

        private fun historyPrefs(): android.content.SharedPreferences? = bridge?.let { b ->
            val f = b.javaClass.getDeclaredField("activity"); f.isAccessible = true
            val a = f.get(b) as Activity
            a.getSharedPreferences("vigilshield", Context.MODE_PRIVATE)
        }

        fun persistCall(call: Call, removed: Boolean = false) {
            try {
                val prefs = historyPrefs() ?: return
                val arr = JSONArray(prefs.getString("call_history", "[]"))
                val id = idFor(call)
                val now = System.currentTimeMillis()
                val number = call.details.handle?.schemeSpecificPart.orEmpty()
                val name = bridge?.let { b -> b.lookupContactName(number) }.orEmpty().ifBlank { number.ifBlank { "Unknown caller" } }
                var found = -1
                for (i in 0 until arr.length()) if (arr.optJSONObject(i)?.optString("id") == id) { found = i; break }
                val created = if (found >= 0) arr.getJSONObject(found).optLong("timestamp", now) else now
                val connected = call.details.connectTimeMillis.takeIf { it > 0 } ?: 0L
                val duration = if (connected > 0) ((now - connected) / 1000L).coerceAtLeast(0) else 0L
                val type = if (call.details.callDirection == Call.Details.DIRECTION_INCOMING) "INCOMING" else "OUTGOING"
                val obj = JSONObject().put("id", id).put("number", number).put("callerName", name).put("type", if (removed && call.state == Call.STATE_DISCONNECTED) "COMPLETED" else type).put("timestamp", created).put("durationSeconds", duration).put("isContact", bridge?.lookupContactName(number)?.isNotBlank() == true)
                if (found >= 0) arr.put(found, obj) else arr.put(0, obj)
                while (arr.length() > 500) arr.remove(arr.length() - 1)
                prefs.edit().putString("call_history", arr.toString()).apply()
            } catch (_: Exception) { }
        }
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call); instance = this
        val id = "call-${System.identityHashCode(call)}-${System.currentTimeMillis()}"
        ids[call] = id; activeCalls[id] = call
        val callback = object : Call.Callback() { override fun onStateChanged(c: Call, state: Int) { emit(c, state); persistCall(c) } }
        callbacks[id] = callback; call.registerCallback(callback)
        persistCall(call)
        emit(call, call.state)
    }

    private fun emit(call: Call, state: Int) {
        val id = idFor(call); val number = call.details.handle?.schemeSpecificPart.orEmpty()
        val incoming = call.details.callDirection == Call.Details.DIRECTION_INCOMING
        val name = bridge?.lookupContactName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }
        val stateName = when(state) { Call.STATE_NEW->"NEW"; Call.STATE_RINGING->"RINGING"; Call.STATE_DIALING->"DIALING"; Call.STATE_CONNECTING->"CONNECTING"; Call.STATE_ACTIVE->"ACTIVE"; Call.STATE_HOLDING->"HOLDING"; Call.STATE_DISCONNECTED->"DISCONNECTED"; else->"UNKNOWN" }
        val details = JSONObject().put("number", number).put("callerDisplayName", name).put("state", stateName).put("isIncoming", incoming).put("durationSeconds", if (call.details.connectTimeMillis > 0) ((System.currentTimeMillis()-call.details.connectTimeMillis)/1000L).coerceAtLeast(0) else 0).put("isHolding", state == Call.STATE_HOLDING)
        bridge?.dispatchCallEvent(if(state == Call.STATE_DISCONNECTED) "CALL_DISCONNECTED" else if(state == Call.STATE_NEW) "CALL_ADDED" else "CALL_STATE_CHANGED", JSONObject().put("callId", id).put("details", details))
    }

    override fun onCallRemoved(call: Call) {
        val id = idFor(call); persistCall(call, true); callbacks.remove(id)?.let { call.unregisterCallback(it) }
        activeCalls.remove(id); ids.remove(call); if(activeCalls.isEmpty()) instance = null
        bridge?.dispatchCallEvent("CALL_REMOVED", JSONObject().put("callId", id).put("details", JSONObject().put("number", call.details.handle?.schemeSpecificPart.orEmpty()).put("state", "DISCONNECTED")))
        super.onCallRemoved(call)
    }

    fun setSpeaker(enabled: Boolean): Boolean = try { setAudioRoute(if(enabled) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE); true } catch (_: Exception) { false }
}

class CallScreeningService : AndroidCallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val number = details.handle?.schemeSpecificPart.orEmpty()
        val prefs = getSharedPreferences("vigilshield", Context.MODE_PRIVATE)
        val whitelist = try { JSONArray(prefs.getString("whitelist", "[]")) } catch (_: Exception) { JSONArray() }
        val rules = try { JSONArray(prefs.getString("block_rules", "[]")) } catch (_: Exception) { JSONArray() }
        val normalized = number.filter { it.isDigit() }
        var whitelisted = false
        for (i in 0 until whitelist.length()) {
            val v = whitelist.optJSONObject(i)?.optString("value").orEmpty().filter { it.isDigit() }
            if (v.isNotEmpty() && (normalized == v || normalized.endsWith(v))) { whitelisted = true; break }
        }
        var blocked = false
        if (!whitelisted && details.callDirection == Call.Details.DIRECTION_INCOMING) {
            for (i in 0 until rules.length()) {
                val r = rules.optJSONObject(i) ?: continue
                if (!r.optBoolean("enabled", true)) continue
                val value = r.optString("value").filter { it.isDigit() }
                val matchType = r.optString("matchType", "PREFIX")
                val target = r.optString("targetType", "BOTH")
                val targetIncoming = target == "BOTH" || target == "INCOMING"
                if (targetIncoming && value.isNotEmpty() && ((matchType == "PREFIX" && normalized.startsWith(value)) || (matchType == "EXACT" && normalized == value))) { blocked = true; break }
            }
        }
        respondToCall(details, CallResponse.Builder().setDisallowCall(blocked).setRejectCall(blocked).setSkipCallLog(false).setSkipNotification(false).build())
    }
}

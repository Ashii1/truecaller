package com.vigilshield.telecom

import android.Manifest
import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.CallLog
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.TelecomManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class AndroidTelephonyBridge(private val activity: Activity, private val webView: WebView) {
    companion object { const val INTERFACE_NAME = "AndroidTelecomBridge"; private const val PREFS = "vigilshield" }
    private val telecom: TelecomManager get() = activity.getSystemService(TelecomManager::class.java)

    init { NativeInCallService.bridge = this; NativeInCallService.appContext = activity.applicationContext; CallNotificationHelper.ensureChannel(activity.applicationContext) }

    @JavascriptInterface fun checkDefaultDialerStatus(): String = roleStatus().toString()
    @JavascriptInterface fun requestDefaultDialerRole(): Boolean { if (Build.VERSION.SDK_INT < 29) return false; val manager = activity.getSystemService(RoleManager::class.java); if (!manager.isRoleAvailable(RoleManager.ROLE_DIALER)) return false; activity.startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_DIALER), 7001); return true }
    @JavascriptInterface fun requestCallScreeningRole(): Boolean { if (Build.VERSION.SDK_INT < 29) return false; val manager = activity.getSystemService(RoleManager::class.java); if (!manager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) return false; if (manager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) return true; activity.startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), 7003); return true }
    @JavascriptInterface fun getPhoneAccounts(): String = JSONArray().also { out -> telecom.callCapablePhoneAccounts.forEachIndexed { index, handle -> out.put(JSONObject().put("id", handle.id).put("label", handle.id).put("carrierName", handle.componentName.packageName).put("slotIndex", index).put("displayName", "SIM ${index + 1}").put("isDefault", false)) } }.toString()
    @JavascriptInterface fun getTelephonyDiagnostics(): String { val accounts = telecom.callCapablePhoneAccounts; val audio = activity.getSystemService(AudioManager::class.java); return JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29).put("isCallScreeningRoleHeld", Build.VERSION.SDK_INT >= 29 && activity.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_CALL_SCREENING)).put("isInCallServiceBound", NativeInCallService.instance != null).put("hasSim", accounts.isNotEmpty()).put("isAirplaneMode", false).put("isNetworkAvailable", true).put("networkOperatorName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown").put("simCarrierIdName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown").put("activeCallsCount", NativeInCallService.activeCalls.size).put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission()).put("ringerMode", audio.ringerMode).put("sim1Available", accounts.isNotEmpty()).put("sim1Carrier", accounts.firstOrNull()?.componentName?.packageName ?: "None").put("sim2Available", accounts.size > 1).put("sim2Carrier", if (accounts.size > 1) accounts[1].componentName.packageName else "None").toString() }
    @JavascriptInterface fun placeRealCall(number: String, accountHandleId: String?): String { if (!isDefaultDialer()) return JSONObject().put("success", false).put("message", "VigilShield must be the default Phone app").toString(); if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) return JSONObject().put("success", false).put("message", "CALL_PHONE permission is required").toString(); val clean = number.trim().replace(Regex("[^0-9+*#]"), ""); if (clean.length < 3) return JSONObject().put("success", false).put("message", "Invalid phone number").toString(); return try { val extras = Bundle(); val account = telecom.callCapablePhoneAccounts.firstOrNull { it.id == accountHandleId } ?: telecom.callCapablePhoneAccounts.firstOrNull(); account?.let { extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }; telecom.placeCall(Uri.fromParts("tel", clean, null), extras); JSONObject().put("success", true).put("message", "Call sent to Android Telecom").toString() } catch (error: Exception) { JSONObject().put("success", false).put("message", error.message ?: "Unable to place call").toString() } }
    @JavascriptInterface fun fetchRealContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchDeviceContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchRealCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun fetchDeviceCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun lookupContactName(number: String): String = lookupName(number).orEmpty()
    @JavascriptInterface fun answerCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.answer(0); NativeInCallService.stopRinging(); true } ?: false
    @JavascriptInterface fun rejectCall(id: String, reason: String?): Boolean = NativeInCallService.activeCalls[id]?.let { it.reject(false, reason ?: "Declined"); NativeInCallService.stopRinging(); true } ?: false
    @JavascriptInterface fun disconnectCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.disconnect(); NativeInCallService.stopRinging(); true } ?: false
    @JavascriptInterface fun setMuted(value: Boolean): Boolean = NativeInCallService.instance?.let { it.setMuted(value); true } ?: false
    @JavascriptInterface fun setSpeakerRoute(enabled: Boolean): Boolean = NativeInCallService.instance?.setSpeaker(enabled) ?: false
    @JavascriptInterface fun sendDtmfTone(id: String, digit: String): Boolean { val call = NativeInCallService.activeCalls[id] ?: return false; val tone = digit.firstOrNull() ?: return false; call.playDtmfTone(tone); call.stopDtmfTone(); return true }
    @JavascriptInterface fun holdCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.hold(); true } ?: false
    @JavascriptInterface fun unholdCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.unhold(); true } ?: false
    @JavascriptInterface fun swapCalls(): Boolean = NativeInCallService.swapCalls()
    @JavascriptInterface fun mergeCalls(): Boolean = NativeInCallService.mergeCalls()
    @JavascriptInterface fun syncBlockRules(json: String): Boolean { activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("block_rules", json).apply(); return true }
    @JavascriptInterface fun syncWhitelist(json: String): Boolean { activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("whitelist", json).apply(); return true }
    @JavascriptInterface fun setSecuritySetting(key: String, value: Boolean): Boolean { activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(key, value).apply(); return true }
    @JavascriptInterface fun createContact(number: String, name: String?): Boolean = false
    fun isDefaultDialer(): Boolean = if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_DIALER) else telecom.defaultDialerPackage == activity.packageName
    fun hasCallLogPermission(): Boolean = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
    fun hasContactsPermission(): Boolean = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    fun hasDevicePermissions(): Boolean = hasContactsPermission()
    fun roleStatus(): JSONObject = JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
    fun permissionStatus(): JSONObject = JSONObject().put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission())
    fun dispatchWebEvent(type: String, data: JSONObject) { webView.post { webView.evaluateJavascript("if(window.__onAndroidTelecomEvent){window.__onAndroidTelecomEvent(${JSONObject.quote(type)},$data);}", null) } }
    fun dispatchCallEvent(type: String, data: JSONObject) = dispatchWebEvent(type, data)
    private fun readContacts(limit: Int): JSONArray { val result = JSONArray(); if (!hasContactsPermission()) return result; val projection = arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.STARRED); activity.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection, null, null, "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { cursor -> var count = 0; while (cursor.moveToNext() && count < limit.coerceIn(1, 2000)) { result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("name", cursor.getString(1).orEmpty()).put("number", cursor.getString(2).orEmpty()).put("isFavorite", cursor.getInt(3) == 1)); count++ } }; return result }
    fun lookupName(number: String): String? { if (!hasContactsPermission() || number.isBlank()) return null; return activity.contentResolver.query(Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number)), arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null } }
    private fun readCallLogs(limit: Int): JSONArray { val result = JSONArray(); if (!hasCallLogPermission()) { NativeInCallService.readHistory(limit).forEach(result::put); return result }; val uri = CallLog.Calls.CONTENT_URI.buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, limit.coerceIn(1, 500).toString()).build(); val projection = arrayOf(CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION); activity.contentResolver.query(uri, projection, null, null, "${CallLog.Calls.DATE} DESC")?.use { cursor -> while (cursor.moveToNext()) { val number = cursor.getString(1).orEmpty(); val name = lookupName(number) ?: cursor.getString(2); result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("number", number).put("callerName", name ?: number.ifBlank { "Unknown caller" }).put("type", when (cursor.getInt(3)) { CallLog.Calls.INCOMING_TYPE -> "INCOMING"; CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"; CallLog.Calls.MISSED_TYPE -> "MISSED"; CallLog.Calls.REJECTED_TYPE -> "REJECTED"; CallLog.Calls.BLOCKED_TYPE -> "BLOCKED_CANCELLED"; else -> "UNKNOWN" }).put("timestamp", cursor.getLong(4)).put("durationSeconds", cursor.getLong(5)).put("isContact", !name.isNullOrBlank() && name != number)) } }; return result }
}

class NativeInCallService : InCallService() {
    companion object {
        var instance: NativeInCallService? = null
        var bridge: AndroidTelephonyBridge? = null
        var appContext: Context? = null
        val activeCalls: MutableMap<String, Call> = mutableMapOf()
        private val ids = mutableMapOf<Call, String>()
        private val callbacks = mutableMapOf<String, Call.Callback>()
        private var ringtone: Ringtone? = null
        private var vibrator: Vibrator? = null
        private var vibrating = false
        fun stopRinging() { runCatching { ringtone?.stop() }; ringtone = null; if (vibrating) runCatching { vibrator?.cancel() }; vibrating = false }
        private fun startRinging() { stopRinging(); val context = appContext ?: return; val audio = context.getSystemService(AudioManager::class.java); when (audio.ringerMode) { AudioManager.RINGER_MODE_SILENT -> Unit; AudioManager.RINGER_MODE_VIBRATE -> { vibrator = context.getSystemService(Vibrator::class.java); val pattern = longArrayOf(0, 450, 350, 450, 700); if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) else @Suppress("DEPRECATION") vibrator?.vibrate(pattern, 0); vibrating = true }; else -> { val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE); ringtone = RingtoneManager.getRingtone(context, uri); ringtone?.audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(); ringtone?.play() } } }
        fun readHistory(limit: Int): List<JSONObject> { val result = mutableListOf<JSONObject>(); runCatching { val array = JSONArray(appContext?.getSharedPreferences("vigilshield", Context.MODE_PRIVATE)?.getString("call_history", "[]") ?: "[]"); for (index in 0 until minOf(array.length(), limit.coerceIn(1, 500))) result += array.getJSONObject(index) }; return result }
        fun swapCalls(): Boolean { val held = activeCalls.values.firstOrNull { it.state == Call.STATE_HOLDING }; val active = activeCalls.values.firstOrNull { it.state == Call.STATE_ACTIVE }; if (held == null || active == null) return false; active.hold(); held.unhold(); return true }
        fun mergeCalls(): Boolean = activeCalls.values.toList().let { calls -> if (calls.size < 2) false else runCatching { calls[0].conference(calls[1]); true }.getOrDefault(false) }
        fun persist(call: Call) { val context = appContext ?: return; val prefs = context.getSharedPreferences("vigilshield", Context.MODE_PRIVATE); val array = JSONArray(prefs.getString("call_history", "[]") ?: "[]"); val id = ids[call] ?: return; val number = call.details.handle?.schemeSpecificPart.orEmpty(); val name = bridge?.lookupName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }.ifBlank { number.ifBlank { "Unknown caller" } }; var existing = -1; for (index in 0 until array.length()) if (array.optJSONObject(index)?.optString("id") == id) { existing = index; break }; val connectedAt = call.details.connectTimeMillis; val duration = if (connectedAt > 0) ((System.currentTimeMillis() - connectedAt) / 1000).coerceAtLeast(0) else 0; val type = if (call.details.callDirection == Call.Details.DIRECTION_INCOMING) "INCOMING" else "OUTGOING"; val entry = JSONObject().put("id", id).put("number", number).put("callerName", name).put("type", type).put("timestamp", if (existing >= 0) array.getJSONObject(existing).optLong("timestamp", System.currentTimeMillis()) else System.currentTimeMillis()).put("durationSeconds", duration).put("isContact", bridge?.lookupName(number)?.isNotBlank() == true); if (existing >= 0) array.put(existing, entry) else array.put(0, entry); while (array.length() > 500) array.remove(array.length() - 1); prefs.edit().putString("call_history", array.toString()).apply() }
    }
    override fun onCreate() { super.onCreate(); instance = this; appContext = applicationContext; CallNotificationHelper.ensureChannel(applicationContext) }
    override fun onCallAdded(call: Call) { super.onCallAdded(call); instance = this; val id = "call-${System.identityHashCode(call)}-${System.currentTimeMillis()}"; ids[call] = id; activeCalls[id] = call; val callback = object : Call.Callback() { override fun onStateChanged(c: Call, state: Int) { if (state == Call.STATE_RINGING && c.details.callDirection == Call.Details.DIRECTION_INCOMING) startRinging() else if (state != Call.STATE_RINGING) stopRinging(); if (state == Call.STATE_DISCONNECTED) CallNotificationHelper.clearCall(applicationContext, id); emit(c, state); persist(c) } }; callbacks[id] = callback; call.registerCallback(callback); persist(call); val incoming = call.details.callDirection == Call.Details.DIRECTION_INCOMING; val number = call.details.handle?.schemeSpecificPart.orEmpty(); val name = bridge?.lookupName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }.ifBlank { number.ifBlank { "Unknown caller" } }; if (incoming && call.state == Call.STATE_RINGING) { startRinging(); CallNotificationHelper.showIncomingCall(applicationContext, id, name, number) }; emit(call, call.state) }
    private fun emit(call: Call, state: Int) { val id = ids[call] ?: return; val number = call.details.handle?.schemeSpecificPart.orEmpty(); val incoming = call.details.callDirection == Call.Details.DIRECTION_INCOMING; val name = bridge?.lookupName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }; val stateName = when (state) { Call.STATE_NEW -> "NEW"; Call.STATE_RINGING -> "RINGING"; Call.STATE_DIALING -> "DIALING"; Call.STATE_CONNECTING -> "CONNECTING"; Call.STATE_ACTIVE -> "ACTIVE"; Call.STATE_HOLDING -> "HOLDING"; Call.STATE_DISCONNECTED -> "DISCONNECTED"; else -> "UNKNOWN" }; val details = JSONObject().put("number", number).put("callerDisplayName", name).put("state", stateName).put("isIncoming", incoming).put("durationSeconds", if (call.details.connectTimeMillis > 0) ((System.currentTimeMillis() - call.details.connectTimeMillis) / 1000).coerceAtLeast(0) else 0).put("isHolding", state == Call.STATE_HOLDING).put("phoneAccountId", call.details.accountHandle?.id); bridge?.dispatchCallEvent(if (state == Call.STATE_DISCONNECTED) "CALL_DISCONNECTED" else if (state == Call.STATE_RINGING && incoming) "CALL_ADDED" else "CALL_STATE_CHANGED", JSONObject().put("callId", id).put("details", details)) }
    override fun onCallRemoved(call: Call) { val id = ids[call] ?: return; val incoming = call.details.callDirection == Call.Details.DIRECTION_INCOMING; val number = call.details.handle?.schemeSpecificPart.orEmpty(); val name = bridge?.lookupName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }.ifBlank { number.ifBlank { "Unknown caller" } }; if (incoming && call.details.connectTimeMillis <= 0L) CallNotificationHelper.showMissedCall(applicationContext, name, number); CallNotificationHelper.clearCall(applicationContext, id); persist(call); activeCalls.remove(id); callbacks.remove(id)?.let { call.unregisterCallback(it) }; ids.remove(call); stopRinging(); if (activeCalls.isEmpty()) instance = null; super.onCallRemoved(call) }
    @Suppress("DEPRECATION") fun setSpeaker(enabled: Boolean): Boolean { setAudioRoute(if (enabled) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_WIRED_OR_EARPIECE); return true }
}

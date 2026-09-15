package com.vigilshield.telecom

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.CallLog
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.InCallService
import android.telecom.TelecomManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class AndroidTelephonyBridge(private val activity: Activity, private val webView: WebView) {
    companion object { const val INTERFACE_NAME = "AndroidTelecomBridge" }
    private val telecom: TelecomManager get() = activity.getSystemService(TelecomManager::class.java)

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
        activity.startActivityForResult(rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_CALL_SCREENING), 7003)
        return true
    }
    @JavascriptInterface fun getPhoneAccounts(): String = JSONArray().apply {
        telecom.callCapablePhoneAccounts.forEachIndexed { index, handle -> put(JSONObject().apply {
            put("id", handle.id); put("label", handle.id); put("carrierName", "Cellular"); put("slotIndex", index); put("displayName", "SIM ${index + 1}"); put("isDefault", false)
        }) }
    }.toString()
    @JavascriptInterface fun getTelephonyDiagnostics(): String = JSONObject().apply {
        put("isDefaultDialer", isDefaultDialer()); put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29); put("isInCallServiceBound", NativeInCallService.instance != null)
        put("hasSim", telecom.callCapablePhoneAccounts.isNotEmpty()); put("isAirplaneMode", false); put("isNetworkAvailable", true); put("networkOperatorName", "Android")
        put("simCarrierIdName", "Unknown"); put("activeCallsCount", NativeInCallService.calls.size); put("callLogPermission", hasCallLogPermission()); put("contactsPermission", hasContactsPermission())
        put("sim1Available", telecom.callCapablePhoneAccounts.isNotEmpty()); put("sim1Carrier", "Cellular"); put("sim2Available", telecom.callCapablePhoneAccounts.size > 1); put("sim2Carrier", if (telecom.callCapablePhoneAccounts.size > 1) "Cellular" else "None")
    }.toString()
    @JavascriptInterface fun placeRealCall(number: String, accountHandleId: String?): String {
        if (!isDefaultDialer()) return JSONObject().put("success", false).put("message", "VigilShield must be the default Phone app").toString()
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) return JSONObject().put("success", false).put("message", "CALL_PHONE permission is required").toString()
        return try {
            val extras = android.os.Bundle()
            val accounts = telecom.callCapablePhoneAccounts
            if (accounts.isNotEmpty()) extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, accounts.first())
            telecom.placeCall(Uri.fromParts("tel", number, null), extras)
            JSONObject().put("success", true).put("message", "Call sent to Android Telecom").toString()
        } catch (e: Exception) { JSONObject().put("success", false).put("message", e.message ?: "Unable to place call").toString() }
    }
    @JavascriptInterface fun fetchRealContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchRealCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun answerCall(callId: String): Boolean = false
    @JavascriptInterface fun rejectCall(callId: String, reason: String?): Boolean = false
    @JavascriptInterface fun disconnectCall(callId: String): Boolean = NativeInCallService.calls[callId]?.disconnect().let { true }
    @JavascriptInterface fun setMuted(muted: Boolean): Boolean = NativeInCallService.instance?.let { telecom.isInCallServiceBound } ?: false
    @JavascriptInterface fun setSpeakerRoute(enabled: Boolean): Boolean = false
    @JavascriptInterface fun sendDtmfTone(callId: String, digit: String): Boolean = false
    @JavascriptInterface fun holdCall(callId: String): Boolean = false
    @JavascriptInterface fun unholdCall(callId: String): Boolean = false
    @JavascriptInterface fun swapCalls(): Boolean = false
    @JavascriptInterface fun mergeCalls(): Boolean = false

    fun isDefaultDialer(): Boolean = if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(android.app.role.RoleManager::class.java).isRoleHeld(android.app.role.RoleManager.ROLE_DIALER) else telecom.defaultDialerPackage == activity.packageName
    fun hasCallLogPermission() = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
    fun hasContactsPermission() = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    fun hasDevicePermissions() = hasCallLogPermission() || hasContactsPermission()
    fun roleStatus() = JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
    fun permissionStatus() = JSONObject().put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission())
    fun dispatchWebEvent(type: String, data: JSONObject) { webView.post { webView.evaluateJavascript("if(window.__onAndroidTelecomEvent){window.__onAndroidTelecomEvent(${JSONObject.quote(type)},$data);}", null) } }

    private fun readContacts(limit: Int): JSONArray {
        val out = JSONArray(); if (!hasContactsPermission()) return out
        activity.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.STARRED), null, null, "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { c ->
            val id=c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID); val name=c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME); val num=c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER); val star=c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.STARRED); var n=0
            while(c.moveToNext() && n++ < limit.coerceIn(1,1000)) out.put(JSONObject().put("id",c.getString(id)).put("name",c.getString(name)).put("number",c.getString(num)).put("isFavorite",c.getInt(star)==1))
        }; return out
    }
    private fun lookupName(number: String): String? = if (!hasContactsPermission()) null else activity.contentResolver.query(Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number)), arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)?.use { if(it.moveToFirst()) it.getString(0) else null }
    private fun readCallLogs(limit: Int): JSONArray {
        val out=JSONArray(); if(!hasCallLogPermission()) return out
        val uri=CallLog.Calls.CONTENT_URI.buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, limit.coerceIn(1,500).toString()).build()
        activity.contentResolver.query(uri, arrayOf(CallLog.Calls._ID,CallLog.Calls.NUMBER,CallLog.Calls.CACHED_NAME,CallLog.Calls.TYPE,CallLog.Calls.DATE,CallLog.Calls.DURATION), null,null,"${CallLog.Calls.DATE} DESC")?.use { c ->
            while(c.moveToNext()) { val number=c.getString(1).orEmpty(); val name=lookupName(number) ?: c.getString(2); val type=when(c.getInt(3)){CallLog.Calls.INCOMING_TYPE->"INCOMING";CallLog.Calls.OUTGOING_TYPE->"OUTGOING";CallLog.Calls.MISSED_TYPE->"MISSED";CallLog.Calls.REJECTED_TYPE->"REJECTED";else->"UNKNOWN"}; out.put(JSONObject().put("id",c.getString(0)).put("number",number).put("callerName",name ?: number.ifBlank { "Unknown caller" }).put("type",type).put("timestamp",c.getLong(4)).put("durationSeconds",c.getLong(5)).put("isContact",!name.isNullOrBlank())) }
        }; return out
    }
}

class NativeInCallService : InCallService() {
    companion object { var instance: NativeInCallService? = null; val calls = mutableMapOf<String, Call>() }
    override fun onCallAdded(call: Call) { super.onCallAdded(call); instance=this; calls[call.toString()]=call }
    override fun onCallRemoved(call: Call) { calls.remove(call.toString()); if(calls.isEmpty()) instance=null; super.onCallRemoved(call) }
}

class CallScreeningService : CallScreeningService() {
    override fun onScreenCall(callDetails: Call.Details) { respondToCall(callDetails, CallResponse.Builder().setDisallowCall(false).setRejectCall(false).setSkipCallLog(false).setSkipNotification(false).build()) }
}

package com.vigilshield.telecom

import android.Manifest
import android.app.Activity
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
    companion object {
        const val INTERFACE_NAME = "AndroidTelecomBridge"
    }

    private val telecom: TelecomManager
        get() = activity.getSystemService(TelecomManager::class.java)

    @JavascriptInterface
    fun checkDefaultDialerStatus(): String = roleStatus().toString()

    @JavascriptInterface
    fun requestDefaultDialerRole(): Boolean {
        if (Build.VERSION.SDK_INT < 29) return false
        val roleManager = activity.getSystemService(android.app.role.RoleManager::class.java)
        if (!roleManager.isRoleAvailable(android.app.role.RoleManager.ROLE_DIALER)) return false
        activity.startActivityForResult(
            roleManager.createRequestRoleIntent(android.app.role.RoleManager.ROLE_DIALER),
            7001
        )
        return true
    }

    @JavascriptInterface
    fun requestCallScreeningRole(): Boolean {
        if (Build.VERSION.SDK_INT < 29) return false
        val roleManager = activity.getSystemService(android.app.role.RoleManager::class.java)
        if (!roleManager.isRoleAvailable(android.app.role.RoleManager.ROLE_CALL_SCREENING)) return false
        activity.startActivityForResult(
            roleManager.createRequestRoleIntent(android.app.role.RoleManager.ROLE_CALL_SCREENING),
            7003
        )
        return true
    }

    @JavascriptInterface
    fun getPhoneAccounts(): String {
        val result = JSONArray()
        telecom.callCapablePhoneAccounts.forEachIndexed { index, handle ->
            result.put(
                JSONObject()
                    .put("id", handle.id)
                    .put("label", handle.id)
                    .put("carrierName", "Cellular")
                    .put("slotIndex", index)
                    .put("displayName", "SIM ${index + 1}")
                    .put("isDefault", false)
            )
        }
        return result.toString()
    }

    @JavascriptInterface
    fun getTelephonyDiagnostics(): String {
        val accounts = telecom.callCapablePhoneAccounts
        return JSONObject()
            .put("isDefaultDialer", isDefaultDialer())
            .put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
            .put("isInCallServiceBound", NativeInCallService.instance != null)
            .put("hasSim", accounts.isNotEmpty())
            .put("isAirplaneMode", false)
            .put("isNetworkAvailable", true)
            .put("networkOperatorName", "Android")
            .put("simCarrierIdName", "Unknown")
            .put("activeCallsCount", NativeInCallService.activeCalls.size)
            .put("callLogPermission", hasCallLogPermission())
            .put("contactsPermission", hasContactsPermission())
            .put("sim1Available", accounts.isNotEmpty())
            .put("sim1Carrier", if (accounts.isNotEmpty()) "Cellular" else "None")
            .put("sim2Available", accounts.size > 1)
            .put("sim2Carrier", if (accounts.size > 1) "Cellular" else "None")
            .toString()
    }

    @JavascriptInterface
    fun placeRealCall(number: String, accountHandleId: String?): String {
        if (!isDefaultDialer()) {
            return JSONObject()
                .put("success", false)
                .put("message", "VigilShield must be the default Phone app")
                .toString()
        }

        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            return JSONObject()
                .put("success", false)
                .put("message", "CALL_PHONE permission is required")
                .toString()
        }

        return try {
            val extras = Bundle()
            val selectedHandle = telecom.callCapablePhoneAccounts.firstOrNull { handle ->
                handle.id == accountHandleId
            } ?: telecom.callCapablePhoneAccounts.firstOrNull()

            if (selectedHandle != null) {
                extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, selectedHandle)
            }

            telecom.placeCall(Uri.fromParts("tel", number, null), extras)

            JSONObject()
                .put("success", true)
                .put("message", "Call sent to Android Telecom")
                .toString()
        } catch (exception: Exception) {
            JSONObject()
                .put("success", false)
                .put("message", exception.message ?: "Unable to place call")
                .toString()
        }
    }

    @JavascriptInterface
    fun fetchRealContacts(limit: Int): String = readContacts(limit).toString()

    @JavascriptInterface
    fun fetchDeviceContacts(limit: Int): String = readContacts(limit).toString()

    @JavascriptInterface
    fun fetchRealCallLogs(limit: Int): String = readCallLogs(limit).toString()

    @JavascriptInterface
    fun fetchDeviceCallLogs(limit: Int): String = readCallLogs(limit).toString()

    @JavascriptInterface
    fun answerCall(callId: String): Boolean {
        val call = NativeInCallService.activeCalls[callId] ?: return false
        call.answer(0)
        return true
    }

    @JavascriptInterface
    fun rejectCall(callId: String, reason: String?): Boolean {
        val call = NativeInCallService.activeCalls[callId] ?: return false
        call.reject(false, reason ?: "")
        return true
    }

    @JavascriptInterface
    fun disconnectCall(callId: String): Boolean {
        val call = NativeInCallService.activeCalls[callId] ?: return false
        call.disconnect()
        return true
    }

    @JavascriptInterface
    fun setMuted(muted: Boolean): Boolean {
        val service = NativeInCallService.instance ?: return false
        service.setMuted(muted)
        return true
    }

    @JavascriptInterface
    fun setSpeakerRoute(enabled: Boolean): Boolean = false

    @JavascriptInterface
    fun sendDtmfTone(callId: String, digit: String): Boolean = false

    @JavascriptInterface
    fun holdCall(callId: String): Boolean = false

    @JavascriptInterface
    fun unholdCall(callId: String): Boolean = false

    @JavascriptInterface
    fun swapCalls(): Boolean = false

    @JavascriptInterface
    fun mergeCalls(): Boolean = false

    fun isDefaultDialer(): Boolean {
        return if (Build.VERSION.SDK_INT >= 29) {
            activity.getSystemService(android.app.role.RoleManager::class.java)
                .isRoleHeld(android.app.role.RoleManager.ROLE_DIALER)
        } else {
            telecom.defaultDialerPackage == activity.packageName
        }
    }

    fun hasCallLogPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasContactsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasDevicePermissions(): Boolean = hasCallLogPermission() || hasContactsPermission()

    fun roleStatus(): JSONObject {
        return JSONObject()
            .put("isDefaultDialer", isDefaultDialer())
            .put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
    }

    fun permissionStatus(): JSONObject {
        return JSONObject()
            .put("callLogPermission", hasCallLogPermission())
            .put("contactsPermission", hasContactsPermission())
    }

    fun dispatchWebEvent(type: String, data: JSONObject) {
        webView.post {
            val script = "if(window.__onAndroidTelecomEvent){window.__onAndroidTelecomEvent(${JSONObject.quote(type)},$data);}"
            webView.evaluateJavascript(script, null)
        }
    }

    private fun readContacts(limit: Int): JSONArray {
        val result = JSONArray()
        if (!hasContactsPermission()) return result

        val safeLimit = limit.coerceIn(1, 1000)
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.STARRED
        )

        activity.contentResolver.query(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            projection,
            null,
            null,
            "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
        )?.use { cursor ->
            var count = 0
            while (cursor.moveToNext() && count < safeLimit) {
                val contactId = cursor.getString(0).orEmpty()
                val name = cursor.getString(1).orEmpty()
                val number = cursor.getString(2).orEmpty()
                val starred = cursor.getInt(3) == 1

                result.put(
                    JSONObject()
                        .put("id", contactId)
                        .put("name", name)
                        .put("number", number)
                        .put("isFavorite", starred)
                )
                count++
            }
        }

        return result
    }

    private fun lookupName(number: String): String? {
        if (!hasContactsPermission() || number.isBlank()) return null

        return activity.contentResolver.query(
            Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                Uri.encode(number)
            ),
            arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
            null,
            null,
            null
        )?.use { cursor ->
            if (cursor.moveToFirst()) cursor.getString(0) else null
        }
    }

    private fun readCallLogs(limit: Int): JSONArray {
        val result = JSONArray()
        if (!hasCallLogPermission()) return result

        val safeLimit = limit.coerceIn(1, 500)
        val uri = CallLog.Calls.CONTENT_URI.buildUpon()
            .appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, safeLimit.toString())
            .build()

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION
        )

        activity.contentResolver.query(
            uri,
            projection,
            null,
            null,
            "${CallLog.Calls.DATE} DESC"
        )?.use { cursor ->
            while (cursor.moveToNext()) {
                val id = cursor.getString(0).orEmpty()
                val number = cursor.getString(1).orEmpty()
                val cachedName = cursor.getString(2)
                val callType = cursor.getInt(3)
                val timestamp = cursor.getLong(4)
                val duration = cursor.getLong(5)
                val contactName = lookupName(number)
                val callerName = contactName ?: cachedName ?: number.ifBlank { "Unknown caller" }

                val type = when (callType) {
                    CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                    CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                    CallLog.Calls.MISSED_TYPE -> "MISSED"
                    CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                    else -> "UNKNOWN"
                }

                result.put(
                    JSONObject()
                        .put("id", id)
                        .put("number", number)
                        .put("callerName", callerName)
                        .put("type", type)
                        .put("timestamp", timestamp)
                        .put("durationSeconds", duration)
                        .put("isContact", !contactName.isNullOrBlank())
                )
            }
        }

        return result
    }
}

class NativeInCallService : InCallService() {
    companion object {
        var instance: NativeInCallService? = null
        val activeCalls: MutableMap<String, Call> = mutableMapOf()
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        instance = this
        activeCalls[call.toString()] = call
    }

    override fun onCallRemoved(call: Call) {
        activeCalls.remove(call.toString())
        if (activeCalls.isEmpty()) instance = null
        super.onCallRemoved(call)
    }
}

class CallScreeningService : AndroidCallScreeningService() {
    override fun onScreenCall(details: Call.Details) {
        val response = CallResponse.Builder()
            .setDisallowCall(false)
            .setRejectCall(false)
            .setSkipCallLog(false)
            .setSkipNotification(false)
            .build()
        respondToCall(details, response)
    }
}

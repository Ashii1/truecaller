package com.vigilshield.telecom

import android.Manifest
import android.app.Activity
import android.app.KeyguardManager
import android.app.role.RoleManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
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
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class AndroidTelephonyBridge(private val activity: Activity, private val webView: WebView) {
    companion object { const val INTERFACE_NAME = "AndroidTelecomBridge"; private const val PREFS = "vigilshield"; private const val PERMISSION_REQ = 7002 }
    private val telecom: TelecomManager get() = activity.getSystemService(TelecomManager::class.java)
    private var lastCallRequestNumber: String = ""
    private var lastCallRequestAt: Long = 0L

    init { NativeInCallService.bridge = this; NativeInCallService.appContext = activity.applicationContext; CallNotificationHelper.ensureChannel(activity.applicationContext) }

    @JavascriptInterface fun checkDefaultDialerStatus(): String = roleStatus().toString()
    @JavascriptInterface fun requestDefaultDialerRole(): Boolean { if (Build.VERSION.SDK_INT < 29) return false; val manager = activity.getSystemService(RoleManager::class.java); if (!manager.isRoleAvailable(RoleManager.ROLE_DIALER)) return false; if (manager.isRoleHeld(RoleManager.ROLE_DIALER)) return true; activity.startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_DIALER), 7001); return true }
    @JavascriptInterface fun requestCallScreeningRole(): Boolean { if (Build.VERSION.SDK_INT < 29) return false; val manager = activity.getSystemService(RoleManager::class.java); if (!manager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) return false; if (manager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) return true; activity.startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), 7003); return true }
    @JavascriptInterface fun requestDevicePermissions(): Boolean {
        val requested = mutableListOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE, Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.READ_CALL_LOG)
        if (Build.VERSION.SDK_INT >= 33) requested += Manifest.permission.POST_NOTIFICATIONS
        val missing = requested.filter { ContextCompat.checkSelfPermission(activity, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isEmpty()) return true
        ActivityCompat.requestPermissions(activity, missing.toTypedArray(), PERMISSION_REQ)
        return true
    }
    @JavascriptInterface fun openAppSettings(): Boolean = runCatching { activity.startActivity(Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${activity.packageName}"))); true }.getOrDefault(false)
    @JavascriptInterface fun requestIgnoreBatteryOptimizations(): Boolean = runCatching {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = activity.getSystemService(PowerManager::class.java)
            if (powerManager != null && powerManager.isIgnoringBatteryOptimizations(activity.packageName)) {
                return true
            }
            try {
                val intent = Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                    data = Uri.parse("package:${activity.packageName}")
                }
                activity.startActivity(intent)
                true
            } catch (e: Exception) {
                val fallbackIntent = Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                activity.startActivity(fallbackIntent)
                true
            }
        } else false
    }.getOrDefault(false)
    @JavascriptInterface fun getPhoneAccounts(): String = JSONArray().also { out -> telecom.callCapablePhoneAccounts.forEachIndexed { index, handle -> out.put(JSONObject().put("id", handle.id).put("label", handle.id).put("carrierName", handle.componentName.packageName).put("slotIndex", index).put("displayName", "SIM ${index + 1}").put("isDefault", false)) } }.toString()
    @JavascriptInterface fun getTelephonyDiagnostics(): String {
        val accounts = telecom.callCapablePhoneAccounts
        val audio = activity.getSystemService(AudioManager::class.java)
        val powerManager = activity.getSystemService(PowerManager::class.java)
        val isPowerSaveMode = powerManager?.isPowerSaveMode ?: false
        val isIgnoringBatteryOptimizations = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            powerManager?.isIgnoringBatteryOptimizations(activity.packageName) ?: false
        } else {
            true
        }

        val batteryStatus: Intent? = runCatching {
            activity.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        }.getOrNull()
        val level: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val batteryPct: Int = if (level >= 0 && scale > 0) ((level * 100) / scale) else -1
        val status: Int = batteryStatus?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val isCharging: Boolean = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
        val isBatteryLow: Boolean = if (batteryPct in 0..20) true else (batteryStatus?.getIntExtra(BatteryManager.EXTRA_BATTERY_LOW, 0) == 1)
        val isThrottlingRisk: Boolean = isPowerSaveMode || (isBatteryLow && !isCharging && !isIgnoringBatteryOptimizations)

        return JSONObject()
            .put("isDefaultDialer", isDefaultDialer())
            .put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29 && activity.getSystemService(RoleManager::class.java).isRoleAvailable(RoleManager.ROLE_DIALER))
            .put("isCallScreeningRoleHeld", Build.VERSION.SDK_INT >= 29 && activity.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_CALL_SCREENING))
            .put("isInCallServiceBound", NativeInCallService.instance != null)
            .put("hasSim", accounts.isNotEmpty())
            .put("isAirplaneMode", false)
            .put("isNetworkAvailable", true)
            .put("networkOperatorName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown")
            .put("simCarrierIdName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown")
            .put("activeCallsCount", NativeInCallService.activeCalls.size)
            .put("callLogPermission", hasCallLogPermission())
            .put("contactsPermission", hasContactsPermission())
            .put("callPhonePermission", hasPermission(Manifest.permission.CALL_PHONE))
            .put("phoneStatePermission", hasPermission(Manifest.permission.READ_PHONE_STATE))
            .put("answerCallsPermission", hasPermission(Manifest.permission.ANSWER_PHONE_CALLS))
            .put("notificationsPermission", Build.VERSION.SDK_INT < 33 || hasPermission(Manifest.permission.POST_NOTIFICATIONS))
            .put("ringerMode", audio.ringerMode)
            .put("sim1Available", accounts.isNotEmpty())
            .put("sim1Carrier", accounts.firstOrNull()?.componentName?.packageName ?: "None")
            .put("sim2Available", accounts.size > 1)
            .put("sim2Carrier", if (accounts.size > 1) accounts[1].componentName.packageName else "None")
            .put("batteryLevel", batteryPct)
            .put("isCharging", isCharging)
            .put("isPowerSaveMode", isPowerSaveMode)
            .put("isBatteryLow", isBatteryLow)
            .put("isBatteryThrottlingRisk", isThrottlingRisk)
            .put("isIgnoringBatteryOptimizations", isIgnoringBatteryOptimizations)
            .toString()
    }
    @JavascriptInterface fun placeRealCall(number: String, accountHandleId: String?): String {
        if (!isDefaultDialer()) {
            requestDefaultDialerRole()
            return JSONObject().put("success", false).put("message", "Please set CallShield as the default Phone app").toString()
        }
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) {
            requestDevicePermissions()
            return JSONObject().put("success", false).put("message", "CALL_PHONE permission is required").toString()
        }
        val clean = number.trim().replace(Regex("[^0-9+*#]"), "")
        if (clean.length < 3) return JSONObject().put("success", false).put("message", "Invalid phone number").toString()

        // Guard against duplicate ACTION_CALL/UI events arriving within the same
        // short window. Android Telecom itself is the single source of truth.
        val now = System.currentTimeMillis()
        if (clean == lastCallRequestNumber && now - lastCallRequestAt < 5000L) {
            return JSONObject().put("success", false).put("message", "Call is already being started").toString()
        }
        val normalized = clean.filter { it.isDigit() }
        if (NativeInCallService.activeCalls.values.any { call ->
                call.details.handle?.schemeSpecificPart?.filter { it.isDigit() } == normalized
            }) {
            return JSONObject().put("success", false).put("message", "A call to this number is already active").toString()
        }
        lastCallRequestNumber = clean
        lastCallRequestAt = now

        return try {
            // The default Phone role must stay on CallShield; use Telecom only and never launch ACTION_CALL.
            val extras = Bundle()
            val accounts = runCatching { telecom.callCapablePhoneAccounts }.getOrNull().orEmpty()
            val account = accounts.firstOrNull { it.id == accountHandleId } ?: accounts.firstOrNull()
            account?.let { extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }
            extras.putBoolean(TelecomManager.EXTRA_START_CALL_WITH_SPEAKERPHONE, false)

            // The real Telecom call id is assigned by NativeInCallService.onCallAdded().
            // Do not invent a second id: the UI will switch to the native id from the
            // CALL_STATE_CHANGED event, and disconnectCall() can safely use its fallback
            // during the short dialing window.
            val callId = ""
            val callerName = lookupName(clean).orEmpty().ifBlank { clean }

            // Do not launch a second activity here. NativeInCallService.onCallAdded()
            // owns the in-call UI lifecycle after Telecom accepts the call.

            // Once CallShield owns ROLE_DIALER, Android Telecom is the single call entry point.
            // Never fall back to ACTION_CALL here: that can hand the call back to the
            // manufacturer's Phone app and can also create duplicate call attempts.
            telecom.placeCall(Uri.fromParts("tel", clean, null), extras)
            JSONObject().put("success", true).put("callId", callId).put("message", "Call sent to Android Telecom").toString()
        } catch (error: Exception) {
            JSONObject().put("success", false).put("message", error.message ?: "Unable to place call").toString()
        }
    }

    @JavascriptInterface fun pinWidget(type: String): String {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return JSONObject().put("success", false).put("message", "Widget pinning requires Android 8.0 or newer").toString()
        }
        val appWidgetManager = AppWidgetManager.getInstance(activity)
        if (!appWidgetManager.isRequestPinAppWidgetSupported) {
            return JSONObject().put("success", false).put("message", "Launcher does not support automated widget pinning. Long-press home screen to add CallShield widget.").toString()
        }
        val providerClass = if (type == "security") SecurityWidgetProvider::class.java else SpeedDialWidgetProvider::class.java
        val provider = ComponentName(activity, providerClass)
        val success = appWidgetManager.requestPinAppWidget(provider, null, null)
        return JSONObject().put("success", success).put("message", if (success) "Home screen widget prompt opened" else "Unable to pin widget").toString()
    }

    @JavascriptInterface fun updateWidgetData(speedDialJson: String): Boolean {
        return runCatching {
            val prefs = activity.getSharedPreferences("vigilshield_widget_prefs", Context.MODE_PRIVATE).edit()
            val array = JSONArray(speedDialJson)
            for (i in 0 until minOf(array.length(), 4)) {
                val item = array.getJSONObject(i)
                val slot = i + 1
                prefs.putString("speed_dial_${slot}_name", item.optString("name", "Contact $slot"))
                prefs.putString("speed_dial_${slot}_num", item.optString("number", ""))
            }
            prefs.apply()
            SpeedDialWidgetProvider.updateAllWidgets(activity)
            SecurityWidgetProvider.updateAllWidgets(activity)
            true
        }.getOrDefault(false)
    }
    @JavascriptInterface fun fetchRealContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchDeviceContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchRealCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun fetchDeviceCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun lookupContactName(number: String): String = lookupName(number).orEmpty()
    @JavascriptInterface fun answerCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.answer(0); NativeInCallService.stopRinging(); CallNotificationHelper.clearCall(activity.applicationContext, id); true } ?: false
    @JavascriptInterface fun rejectCall(id: String, reason: String?): Boolean { NativeInCallService.stopRinging(); CallNotificationHelper.clearCall(activity.applicationContext, id); CallNotificationHelper.clearAllCallNotifications(activity.applicationContext); return NativeInCallService.activeCalls[id]?.let { it.reject(false, reason ?: "Declined"); true } ?: false }
    @JavascriptInterface fun disconnectCall(id: String): Boolean {
        val call = NativeInCallService.activeCalls[id] ?: NativeInCallService.activeCalls.values.singleOrNull() ?: return false
        NativeInCallService.stopRinging()
        return runCatching {
            call.disconnect()
            CallNotificationHelper.clearCall(activity.applicationContext, id)
            CallNotificationHelper.clearAllCallNotifications(activity.applicationContext)
            true
        }.getOrDefault(false)
    }
    @JavascriptInterface fun setMuted(muted: Boolean): Boolean = runCatching { NativeInCallService.instance?.setMuted(muted); true }.getOrDefault(false)
    @JavascriptInterface fun setSpeakerRoute(enabled: Boolean): Boolean = runCatching { NativeInCallService.instance?.setSpeaker(enabled) ?: false }.getOrDefault(false)
    @JavascriptInterface fun sendDtmfTone(id: String, digit: String): Boolean = runCatching {
        val call = NativeInCallService.activeCalls[id] ?: NativeInCallService.activeCalls.values.singleOrNull() ?: return false
        val tone = digit.firstOrNull() ?: return false
        call.playDtmfTone(tone)
        call.stopDtmfTone()
        true
    }.getOrDefault(false)
    @JavascriptInterface fun holdCall(id: String): Boolean = runCatching { (NativeInCallService.activeCalls[id] ?: NativeInCallService.activeCalls.values.singleOrNull())?.hold() ?: return false; true }.getOrDefault(false)
    @JavascriptInterface fun unholdCall(id: String): Boolean = runCatching { (NativeInCallService.activeCalls[id] ?: NativeInCallService.activeCalls.values.singleOrNull())?.unhold() ?: return false; true }.getOrDefault(false)
    @JavascriptInterface fun swapCalls(): Boolean = NativeInCallService.swapCalls()
    @JavascriptInterface fun mergeCalls(): Boolean = NativeInCallService.mergeCalls()
    @JavascriptInterface fun clearStaleCallNotifications(): Boolean { CallNotificationHelper.clearAllCallNotifications(activity.applicationContext); NativeInCallService.stopRinging(); return true }
    fun isDefaultDialer(): Boolean = if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_DIALER) else telecom.defaultDialerPackage == activity.packageName
    fun hasPermission(permission: String): Boolean = ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
    fun hasCallLogPermission(): Boolean = hasPermission(Manifest.permission.READ_CALL_LOG)
    fun hasContactsPermission(): Boolean = hasPermission(Manifest.permission.READ_CONTACTS)
    fun hasDevicePermissions(): Boolean = hasContactsPermission() && hasCallLogPermission() && hasPermission(Manifest.permission.CALL_PHONE) && hasPermission(Manifest.permission.READ_PHONE_STATE) && hasPermission(Manifest.permission.ANSWER_PHONE_CALLS) && (Build.VERSION.SDK_INT < 33 || hasPermission(Manifest.permission.POST_NOTIFICATIONS))
    fun setSecuritySetting(key: String, enabled: Boolean) {
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(key, enabled).apply()
    }
    fun roleStatus(): JSONObject = JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29 && activity.getSystemService(RoleManager::class.java).isRoleAvailable(RoleManager.ROLE_DIALER)).put("isCallScreeningRoleHeld", Build.VERSION.SDK_INT >= 29 && activity.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_CALL_SCREENING))
    fun permissionStatus(): JSONObject = JSONObject().put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission()).put("callPhonePermission", hasPermission(Manifest.permission.CALL_PHONE)).put("phoneStatePermission", hasPermission(Manifest.permission.READ_PHONE_STATE)).put("answerCallsPermission", hasPermission(Manifest.permission.ANSWER_PHONE_CALLS)).put("notificationsPermission", Build.VERSION.SDK_INT < 33 || hasPermission(Manifest.permission.POST_NOTIFICATIONS))
    fun dispatchWebEvent(type: String, data: JSONObject) { webView.post { webView.evaluateJavascript("if(window.__onAndroidTelecomEvent){window.__onAndroidTelecomEvent(${JSONObject.quote(type)},$data);}", null) } }
    fun dispatchCallEvent(type: String, data: JSONObject) = dispatchWebEvent(type, data)
    private fun readContacts(limit: Int): JSONArray { val result = JSONArray(); if (!hasContactsPermission()) return result; val projection = arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.STARRED); activity.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection, null, null, "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { cursor -> var count = 0; while (cursor.moveToNext() && count < limit.coerceIn(1, 2000)) { result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("name", cursor.getString(1).orEmpty()).put("number", cursor.getString(2).orEmpty()).put("isFavorite", cursor.getInt(3) == 1)); count++ } }; return result }
    fun lookupName(number: String): String? { if (!hasContactsPermission() || number.isBlank()) return null; return activity.contentResolver.query(Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number)), arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null } }
    private fun readCallLogs(limit: Int): JSONArray { val result = JSONArray(); if (!hasCallLogPermission()) { NativeInCallService.readHistory(limit).forEach(result::put); return result }; val uri = CallLog.Calls.CONTENT_URI.buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, limit.coerceIn(1, 500).toString()).build(); val projection = arrayOf(CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION); activity.contentResolver.query(uri, projection, null, null, "${CallLog.Calls.DATE} DESC")?.use { cursor -> while (cursor.moveToNext()) { val number = cursor.getString(1).orEmpty(); val name = cursor.getString(2)?.trim().orEmpty().ifBlank { number.ifBlank { "Unknown caller" } }; result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("number", number).put("callerName", name).put("type", when (cursor.getInt(3)) { CallLog.Calls.INCOMING_TYPE -> "INCOMING"; CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"; CallLog.Calls.MISSED_TYPE -> "MISSED"; CallLog.Calls.REJECTED_TYPE -> "REJECTED"; CallLog.Calls.BLOCKED_TYPE -> "BLOCKED_CANCELLED"; else -> "UNKNOWN" }).put("timestamp", cursor.getLong(4)).put("durationSeconds", cursor.getLong(5)).put("isContact", name.isNotBlank() && name != number)) } }; return result }
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
        fun stopRinging() {
            runCatching { ringtone?.stop() }
            ringtone = null
            if (vibrating) runCatching { vibrator?.cancel() }
            vibrating = false
            runCatching {
                val context = appContext
                val tm = context?.getSystemService(TelecomManager::class.java)
                tm?.silenceRinger()
                val am = context?.getSystemService(AudioManager::class.java)
                am?.adjustStreamVolume(AudioManager.STREAM_RING, AudioManager.ADJUST_MUTE, 0)
            }
            bridge?.dispatchWebEvent("SILENCE_RINGER", JSONObject())
        }
        fun isRinging(): Boolean = ringtone?.isPlaying == true || vibrating || activeCalls.values.any { it.state == Call.STATE_RINGING }
        fun emitActiveCalls() {
            activeCalls.values.forEach { call ->
                instance?.emit(call, call.state)
            }
        }
        private fun startRinging() { stopRinging(); val context = appContext ?: return; val audio = context.getSystemService(AudioManager::class.java); when (audio.ringerMode) { AudioManager.RINGER_MODE_SILENT -> Unit; AudioManager.RINGER_MODE_VIBRATE -> { vibrator = context.getSystemService(Vibrator::class.java); val pattern = longArrayOf(0, 450, 350, 450, 700); if (Build.VERSION.SDK_INT >= 26) vibrator?.vibrate(VibrationEffect.createWaveform(pattern, 0)) else @Suppress("DEPRECATION") vibrator?.vibrate(pattern, 0); vibrating = true }; else -> { val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE); ringtone = RingtoneManager.getRingtone(context, uri); ringtone?.audioAttributes = AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build(); ringtone?.play() } } }
        fun wakeScreenUp(context: Context) {
            runCatching {
                val pm = context.getSystemService(PowerManager::class.java) ?: return
                @Suppress("DEPRECATION")
                val wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                    "vigilshield:incoming_call_wake"
                )
                wakeLock.acquire(15_000L)
            }
        }
        fun launchIncomingCallActivity(context: Context, callId: String, name: String, number: String) {
            runCatching {
                val intent = Intent(context, MainActivity::class.java).apply {
                    action = "com.vigilshield.telecom.OPEN_INCOMING_CALL"
                    putExtra("open_call_id", callId)
                    putExtra("open_call_number", number)
                    putExtra("open_call_name", name)
                    putExtra("is_incoming_call", true)
                    putExtra("open_tab", "incoming")
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
                context.startActivity(intent)
            }
        }
        fun launchActiveCallActivity(context: Context, callId: String, name: String, number: String, state: Int = Call.STATE_DIALING) {
            // If CallShield is already visible, React owns the in-call surface and
            // receives the Telecom state event below. Reordering MainActivity here can
            // race WebView lifecycle during call setup. Only launch it when the app is
            // actually in the background.
            if (MainActivity.isAppVisible) return
            runCatching {
                val intent = Intent(context, MainActivity::class.java).apply {
                    action = "com.vigilshield.telecom.OPEN_OUTGOING_CALL"
                    putExtra("open_call_id", callId)
                    putExtra("open_call_number", number)
                    putExtra("open_call_name", name)
                    putExtra("is_incoming_call", false)
                    putExtra("open_tab", "dialer")
                    putExtra("call_state", when (state) {
                        Call.STATE_DIALING -> "DIALING"
                        Call.STATE_CONNECTING -> "CONNECTING"
                        Call.STATE_ACTIVE -> "ACTIVE"
                        Call.STATE_HOLDING -> "HOLDING"
                        else -> "NEW"
                    })
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
                context.startActivity(intent)
            }
        }
        fun readHistory(limit: Int): List<JSONObject> { val result = mutableListOf<JSONObject>(); runCatching { val array = JSONArray(appContext?.getSharedPreferences("vigilshield", Context.MODE_PRIVATE)?.getString("call_history", "[]") ?: "[]"); for (index in 0 until minOf(array.length(), limit.coerceIn(1, 500))) result += array.getJSONObject(index) }; return result }
        fun swapCalls(): Boolean { val held = activeCalls.values.firstOrNull { it.state == Call.STATE_HOLDING }; val active = activeCalls.values.firstOrNull { it.state == Call.STATE_ACTIVE }; if (held == null || active == null) return false; active.hold(); held.unhold(); return true }
        fun mergeCalls(): Boolean = activeCalls.values.toList().let { calls -> if (calls.size < 2) false else runCatching { calls[0].conference(calls[1]); true }.getOrDefault(false) }
        fun persist(call: Call) { val context = appContext ?: return; val prefs = context.getSharedPreferences("vigilshield", Context.MODE_PRIVATE); val array = JSONArray(prefs.getString("call_history", "[]") ?: "[]"); val id = ids[call] ?: return; val number = call.details.handle?.schemeSpecificPart.orEmpty(); val name = bridge?.lookupName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }.ifBlank { number.ifBlank { "Unknown caller" } }; var existing = -1; for (index in 0 until array.length()) if (array.optJSONObject(index)?.optString("id") == id) { existing = index; break }; val connectedAt = call.details.connectTimeMillis; val duration = if (connectedAt > 0) ((System.currentTimeMillis() - connectedAt) / 1000).coerceAtLeast(0) else 0; val type = if (call.details.callDirection == Call.Details.DIRECTION_INCOMING) "INCOMING" else "OUTGOING"; val entry = JSONObject().put("id", id).put("number", number).put("callerName", name).put("type", type).put("timestamp", if (existing >= 0) array.getJSONObject(existing).optLong("timestamp", System.currentTimeMillis()) else System.currentTimeMillis()).put("durationSeconds", duration).put("isContact", bridge?.lookupName(number)?.isNotBlank() == true); if (existing >= 0) array.put(existing, entry) else array.put(0, entry); while (array.length() > 500) array.remove(array.length() - 1); prefs.edit().putString("call_history", array.toString()).apply() }
    }
    override fun onCreate() { super.onCreate(); instance = this; appContext = applicationContext; CallNotificationHelper.ensureChannel(applicationContext) }
    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        runCatching { handleCallAdded(call) }.onFailure { runCatching { CallNotificationHelper.clearAllCallNotifications(applicationContext) } }
    }

    private fun handleCallAdded(call: Call) {
        instance = this
        val id = "call-${System.identityHashCode(call)}-${System.currentTimeMillis()}"
        ids[call] = id
        activeCalls[id] = call
        val callback = object : Call.Callback() {
            override fun onStateChanged(c: Call, state: Int) {
                runCatching {
                if (state == Call.STATE_RINGING && c.details.callDirection == Call.Details.DIRECTION_INCOMING) {
                    startRinging()
                    wakeScreenUp(applicationContext)
                    val number = c.details.handle?.schemeSpecificPart.orEmpty()
                    val name = bridge?.lookupName(number).orEmpty().ifBlank { c.details.callerDisplayName.orEmpty() }.ifBlank { number.ifBlank { "Unknown caller" } }
                    CallNotificationHelper.showIncomingCall(applicationContext, id, name, number)
                    launchIncomingCallActivity(applicationContext, id, name, number)
                } else if (state == Call.STATE_DIALING || state == Call.STATE_CONNECTING || state == Call.STATE_ACTIVE) {
                    stopRinging()
                    val number = c.details.handle?.schemeSpecificPart.orEmpty()
                    val name = bridge?.lookupName(number).orEmpty().ifBlank { c.details.callerDisplayName.orEmpty() }.ifBlank { number.ifBlank { "Unknown caller" } }
                    launchActiveCallActivity(applicationContext, id, name, number, state)
                } else if (state != Call.STATE_RINGING) {
                    stopRinging()
                }
                if (state == Call.STATE_DISCONNECTED) {
                    stopRinging()
                    CallNotificationHelper.clearCall(applicationContext, id)
                    CallNotificationHelper.clearAllCallNotifications(applicationContext)
                }
                emit(c, state)
                persist(c)
                }
            }
        }
        callbacks[id] = callback
        call.registerCallback(callback)
        persist(call)
        val incoming = call.details.callDirection == Call.Details.DIRECTION_INCOMING
        val rawNum = call.details.handle?.schemeSpecificPart.orEmpty()
        val isRestricted = call.details.handlePresentation == TelecomManager.PRESENTATION_RESTRICTED || rawNum.isBlank() || rawNum.equals("private", ignoreCase = true) || rawNum.equals("unknown", ignoreCase = true) || rawNum == "0"
        val number = if (isRestricted) "Private Number" else rawNum
        val name = if (isRestricted) "Private / Withheld Number" else bridge?.lookupName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }.ifBlank { number.ifBlank { "Unknown caller" } }
        if (incoming && call.state == Call.STATE_RINGING) {
            startRinging()
            wakeScreenUp(applicationContext)
            CallNotificationHelper.showIncomingCall(applicationContext, id, name, number)
            launchIncomingCallActivity(applicationContext, id, name, number)
        } else {
            // Publish the ongoing-call notification immediately from InCallService.
            // It must remain available after the user leaves CallShield for the launcher.
            val initialState = when (call.state) {
                Call.STATE_ACTIVE -> "ACTIVE"
                Call.STATE_HOLDING -> "HOLDING"
                Call.STATE_CONNECTING -> "CONNECTING"
                Call.STATE_DIALING -> "DIALING"
                else -> "DIALING"
            }
            CallNotificationHelper.showOngoingCall(
                applicationContext,
                id,
                name.ifBlank { number.ifBlank { "Unknown caller" } },
                number,
                initialState,
                call.details.connectTimeMillis
            )
            launchActiveCallActivity(applicationContext, id, name, number, call.state)
        }
        emit(call, call.state)
    }
    private fun emit(call: Call, state: Int) { val id = ids[call] ?: return; val rawNum = call.details.handle?.schemeSpecificPart.orEmpty(); val isRestricted = call.details.handlePresentation == TelecomManager.PRESENTATION_RESTRICTED || rawNum.isBlank() || rawNum.equals("private", ignoreCase = true) || rawNum.equals("unknown", ignoreCase = true) || rawNum == "0"; val number = if (isRestricted) "Private Number" else rawNum; val incoming = call.details.callDirection == Call.Details.DIRECTION_INCOMING; val name = if (isRestricted) "Private / Withheld Number" else bridge?.lookupName(number).orEmpty().ifBlank { call.details.callerDisplayName.orEmpty() }.ifBlank { number }; val stateName = when (state) { Call.STATE_NEW -> "NEW"; Call.STATE_RINGING -> "RINGING"; Call.STATE_DIALING -> "DIALING"; Call.STATE_CONNECTING -> "CONNECTING"; Call.STATE_ACTIVE -> "ACTIVE"; Call.STATE_HOLDING -> "HOLDING"; Call.STATE_DISCONNECTED -> "DISCONNECTED"; else -> "UNKNOWN" }; val details = JSONObject().put("number", number).put("callerDisplayName", name).put("state", stateName).put("isIncoming", incoming).put("durationSeconds", if (call.details.connectTimeMillis > 0) ((System.currentTimeMillis() - call.details.connectTimeMillis) / 1000).coerceAtLeast(0) else 0).put("isHolding", state == Call.STATE_HOLDING).put("phoneAccountId", call.details.accountHandle?.id); if (state == Call.STATE_ACTIVE || state == Call.STATE_HOLDING || state == Call.STATE_DIALING || state == Call.STATE_CONNECTING) { CallNotificationHelper.showOngoingCall(applicationContext, id, name.ifBlank { number.ifBlank { "Unknown caller" } }, number, stateName, call.details.connectTimeMillis, null) }; bridge?.dispatchCallEvent(if (state == Call.STATE_DISCONNECTED) "CALL_DISCONNECTED" else if (state == Call.STATE_RINGING && incoming) "CALL_ADDED" else "CALL_STATE_CHANGED", JSONObject().put("callId", id).put("details", details)) }
    override fun onCallRemoved(call: Call) {
        val id = ids[call] ?: activeCalls.entries.firstOrNull { it.value == call }?.key
        if (id == null) {
            stopRinging()
            super.onCallRemoved(call)
            return
        }
        val incoming = call.details.callDirection == Call.Details.DIRECTION_INCOMING
        val number = call.details.handle?.schemeSpecificPart.orEmpty()
        val name = bridge?.lookupName(number).orEmpty()
            .ifBlank { call.details.callerDisplayName.orEmpty() }
            .ifBlank { number.ifBlank { "Unknown caller" } }
        if (incoming && call.details.connectTimeMillis <= 0L) {
            CallNotificationHelper.showMissedCall(applicationContext, name, number)
        }
        CallNotificationHelper.clearCall(applicationContext, id)
        persist(call)
        activeCalls.remove(id)
        callbacks.remove(id)?.let { call.unregisterCallback(it) }
        ids.remove(call)
        stopRinging()
        if (activeCalls.isEmpty()) {
            instance = null
            CallNotificationHelper.clearAllCallNotifications(applicationContext)
        }
        super.onCallRemoved(call)
    }
    fun setSpeaker(enabled: Boolean): Boolean {
        return runCatching {
            // Telecom owns the audio route. Use the explicit earpiece route when speaker
            // is turned off; ROUTE_WIRED_OR_EARPIECE can leave some devices without audio.
            setAudioRoute(if (enabled) CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)
            true
        }.getOrDefault(false)
    }
}

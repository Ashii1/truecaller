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

    init { VigilShieldInCallService.bridge = this; VigilShieldInCallService.appContext = activity.applicationContext; CallNotificationHelper.ensureChannel(activity.applicationContext) }

    @JavascriptInterface fun checkDefaultDialerStatus(): String = roleStatus().toString()
    @JavascriptInterface fun requestDefaultDialerRole(): Boolean { if (Build.VERSION.SDK_INT < 29) return false; val manager = activity.getSystemService(RoleManager::class.java); if (!manager.isRoleAvailable(RoleManager.ROLE_DIALER)) return false; if (manager.isRoleHeld(RoleManager.ROLE_DIALER)) return true; activity.startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_DIALER), 7001); return true }
    @JavascriptInterface fun requestCallScreeningRole(): Boolean { if (Build.VERSION.SDK_INT < 29) return false; val manager = activity.getSystemService(RoleManager::class.java); if (!manager.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING)) return false; if (manager.isRoleHeld(RoleManager.ROLE_CALL_SCREENING)) return true; activity.startActivityForResult(manager.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), 7003); return true }
    @JavascriptInterface fun requestDevicePermissions(): Boolean {
        val requested = mutableListOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE, Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.READ_CALL_LOG, Manifest.permission.RECORD_AUDIO)
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
            .put("isInCallServiceBound", VigilShieldInCallService.instance != null)
            .put("hasSim", accounts.isNotEmpty())
            .put("isAirplaneMode", false)
            .put("isNetworkAvailable", true)
            .put("networkOperatorName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown")
            .put("simCarrierIdName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown")
            .put("activeCallsCount", VigilShieldInCallService.activeCalls.size)
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
        if (VigilShieldInCallService.activeCalls.values.any { call ->
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

            // The real Telecom call id is assigned by VigilShieldInCallService.onCallAdded().
            // Do not invent a second id: the UI will switch to the native id from the
            // CALL_STATE_CHANGED event, and disconnectCall() can safely use its fallback
            // during the short dialing window.
            val callId = ""
            val callerName = lookupName(clean).orEmpty().ifBlank { clean }

            // Do not launch a second activity here. VigilShieldInCallService.onCallAdded()
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
    @JavascriptInterface fun answerCall(id: String): Boolean = VigilShieldInCallService.activeCalls[id]?.let { it.answer(0); CallRingerHelper.stopRinging(activity.applicationContext); VigilShieldInCallService.stopRinging(); CallNotificationHelper.clearCall(activity.applicationContext, id); true } ?: false
    @JavascriptInterface fun rejectCall(id: String, reason: String?): Boolean { CallRingerHelper.stopRinging(activity.applicationContext); VigilShieldInCallService.stopRinging(); CallNotificationHelper.clearCall(activity.applicationContext, id); CallNotificationHelper.clearAllCallNotifications(activity.applicationContext); return VigilShieldInCallService.activeCalls[id]?.let { it.reject(false, reason ?: "Declined"); true } ?: false }
    @JavascriptInterface fun silenceRinger(): Boolean { CallRingerHelper.silenceRinger(activity.applicationContext); VigilShieldInCallService.stopRinging(); return true }
    @JavascriptInterface fun isDeviceLocked(): Boolean {
        val km = activity.getSystemService(KeyguardManager::class.java)
        return km?.isKeyguardLocked == true
    }
    @JavascriptInterface fun canDrawOverlays(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            android.provider.Settings.canDrawOverlays(activity)
        } else {
            true
        }
    }
    @JavascriptInterface fun requestOverlayPermission(): Boolean {
        return runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !android.provider.Settings.canDrawOverlays(activity)) {
                val intent = Intent(
                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${activity.packageName}")
                ).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                activity.startActivity(intent)
                true
            } else {
                true
            }
        }.getOrDefault(false)
    }
    @JavascriptInterface fun wakeDeviceScreen(): Boolean {
        return runCatching {
            val pm = activity.getSystemService(PowerManager::class.java)
            @Suppress("DEPRECATION")
            val wl = pm?.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                "CallShield:DirectWakeLock"
            )
            wl?.acquire(15000L)
            true
        }.getOrDefault(false)
    }
    @JavascriptInterface fun isAlwaysOnTopEnabled(): Boolean {
        val sp = activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        return sp.getBoolean("always_on_top_call_overlay", true)
    }
    @JavascriptInterface fun setAlwaysOnTopEnabled(enabled: Boolean): Boolean {
        return runCatching {
            activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putBoolean("always_on_top_call_overlay", enabled)
                .apply()
            activity.runOnUiThread {
                if (activity is MainActivity) {
                    activity.configureLockscreenWindow(enabled && activity.hasActiveOrRingingCall())
                }
            }
            dispatchWebEvent("ALWAYS_ON_TOP_CHANGED", JSONObject().put("enabled", enabled))
            true
        }.getOrDefault(false)
    }
    @JavascriptInterface fun requestDeviceUnlock(): Boolean {
        return runCatching {
            val km = activity.getSystemService(KeyguardManager::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                km?.requestDismissKeyguard(activity, object : KeyguardManager.KeyguardDismissCallback() {
                    override fun onDismissSucceeded() {
                        super.onDismissSucceeded()
                        dispatchWebEvent("DEVICE_LOCK_STATE_CHANGED", JSONObject().put("isLocked", false).put("state", "unlocked"))
                    }
                    override fun onDismissCancelled() {
                        super.onDismissCancelled()
                        dispatchWebEvent("DEVICE_LOCK_STATE_CHANGED", JSONObject().put("isLocked", km.isKeyguardLocked).put("state", if (km.isKeyguardLocked) "locked" else "unlocked"))
                    }
                    override fun onDismissError() {
                        super.onDismissError()
                    }
                })
                true
            } else {
                @Suppress("DEPRECATION")
                activity.window.addFlags(android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD)
                true
            }
        }.getOrDefault(false)
    }
    @JavascriptInterface fun onUiReady() {
        activity.runOnUiThread {
            if (activity is MainActivity) activity.onReactUiReady()
        }
    }
    @JavascriptInterface fun syncActiveCalls() {
        activity.runOnUiThread {
            VigilShieldInCallService.emitActiveCalls()
        }
    }
    @JavascriptInterface fun disconnectCall(id: String, number: String? = null): Boolean {
        val normalizedNumber = number.orEmpty().filter { it.isDigit() }
        val call = VigilShieldInCallService.activeCalls[id]
            ?: VigilShieldInCallService.activeCalls.values.firstOrNull { active ->
                normalizedNumber.isNotBlank() &&
                    active.details.handle?.schemeSpecificPart.orEmpty().filter { it.isDigit() } == normalizedNumber
            }
            ?: VigilShieldInCallService.activeCalls.values.singleOrNull()
            ?: return false
        val resolvedId = VigilShieldInCallService.activeCalls.entries.firstOrNull { it.value == call }?.key ?: id
        CallRingerHelper.stopRinging(activity.applicationContext)
        VigilShieldInCallService.stopRinging()
        return runCatching {
            if (call.state != Call.STATE_DISCONNECTED && call.state != Call.STATE_DISCONNECTING) {
                call.disconnect()
            }
            CallNotificationHelper.clearCall(activity.applicationContext, resolvedId)
            CallNotificationHelper.clearAllCallNotifications(activity.applicationContext)
            true
        }.getOrDefault(false)
    }
    @JavascriptInterface fun setMuted(muted: Boolean): Boolean = runCatching { VigilShieldInCallService.instance?.setMuted(muted); true }.getOrDefault(false)
    @JavascriptInterface fun setSpeakerRoute(enabled: Boolean): Boolean = runCatching { VigilShieldInCallService.instance?.setSpeaker(enabled) ?: false }.getOrDefault(false)
    @JavascriptInterface fun sendDtmfTone(id: String, digit: String): Boolean = runCatching {
        val call = VigilShieldInCallService.activeCalls[id] ?: VigilShieldInCallService.activeCalls.values.singleOrNull() ?: return false
        val tone = digit.firstOrNull() ?: return false
        call.playDtmfTone(tone)
        call.stopDtmfTone()
        true
    }.getOrDefault(false)
    @JavascriptInterface fun holdCall(id: String): Boolean = runCatching { (VigilShieldInCallService.activeCalls[id] ?: VigilShieldInCallService.activeCalls.values.singleOrNull())?.hold() ?: return false; true }.getOrDefault(false)
    @JavascriptInterface fun unholdCall(id: String): Boolean = runCatching { (VigilShieldInCallService.activeCalls[id] ?: VigilShieldInCallService.activeCalls.values.singleOrNull())?.unhold() ?: return false; true }.getOrDefault(false)
    @JavascriptInterface fun swapCalls(): Boolean = VigilShieldInCallService.swapCalls()
    @JavascriptInterface fun mergeCalls(): Boolean = VigilShieldInCallService.mergeCalls()
    @JavascriptInterface fun clearStaleCallNotifications(): Boolean { CallNotificationHelper.clearAllCallNotifications(activity.applicationContext); CallRingerHelper.stopRinging(activity.applicationContext); VigilShieldInCallService.stopRinging(); return true }
    @JavascriptInterface fun saveCallRecordingToDevice(fileName: String, base64Data: String, mimeType: String?): String {
        return try {
            val cleanBase64 = if (base64Data.contains(",")) base64Data.substringAfter(",") else base64Data
            val bytes = android.util.Base64.decode(cleanBase64, android.util.Base64.DEFAULT)
            val cleanName = if (fileName.endsWith(".wav", ignoreCase = true)) fileName else "$fileName.wav"
            val effectiveMime = if (mimeType.isNullOrBlank()) "audio/wav" else mimeType

            var savedPath = ""
            var savedUri: Uri? = null

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = android.content.ContentValues().apply {
                    put(android.provider.MediaStore.Audio.Media.DISPLAY_NAME, cleanName)
                    put(android.provider.MediaStore.Audio.Media.MIME_TYPE, effectiveMime)
                    put(android.provider.MediaStore.Audio.Media.RELATIVE_PATH, "${android.os.Environment.DIRECTORY_RECORDINGS}/CallShield")
                    put(android.provider.MediaStore.Audio.Media.IS_PENDING, 1)
                }
                val uri = activity.contentResolver.insert(android.provider.MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, values)
                if (uri != null) {
                    activity.contentResolver.openOutputStream(uri)?.use { os ->
                        os.write(bytes)
                        os.flush()
                    }
                    values.clear()
                    values.put(android.provider.MediaStore.Audio.Media.IS_PENDING, 0)
                    activity.contentResolver.update(uri, values, null, null)
                    savedUri = uri
                    savedPath = "Internal Storage/Recordings/CallShield/$cleanName"
                }
            }

            if (savedUri == null) {
                val recDir = android.os.Environment.getExternalStoragePublicDirectory(android.os.Environment.DIRECTORY_RECORDINGS)
                val targetDir = java.io.File(recDir, "CallShield").apply { if (!exists()) mkdirs() }
                val targetFile = java.io.File(targetDir, cleanName)
                java.io.FileOutputStream(targetFile).use { fos ->
                    fos.write(bytes)
                    fos.flush()
                }
                android.media.MediaScannerConnection.scanFile(activity, arrayOf(targetFile.absolutePath), arrayOf(effectiveMime), null)
                savedPath = targetFile.absolutePath
                savedUri = Uri.fromFile(targetFile)
            }

            activity.runOnUiThread {
                android.widget.Toast.makeText(activity, "Saved call recording to device:\nRecordings/CallShield/$cleanName", android.widget.Toast.LENGTH_LONG).show()
            }

            JSONObject()
                .put("success", true)
                .put("path", savedPath)
                .put("uri", savedUri?.toString() ?: "")
                .put("fileName", cleanName)
                .put("sizeBytes", bytes.size)
                .toString()
        } catch (e: Exception) {
            JSONObject().put("success", false).put("error", e.message ?: "Failed saving recording").toString()
        }
    }
    @JavascriptInterface fun hasRecordAudioPermission(): Boolean = hasPermission(Manifest.permission.RECORD_AUDIO)
    @JavascriptInterface fun requestAudioPermission(): Boolean {
        if (hasRecordAudioPermission()) return true
        ActivityCompat.requestPermissions(activity, arrayOf(Manifest.permission.RECORD_AUDIO), PERMISSION_REQ)
        return true
    }
    fun isDefaultDialer(): Boolean = if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_DIALER) else telecom.defaultDialerPackage == activity.packageName
    fun hasPermission(permission: String): Boolean = ContextCompat.checkSelfPermission(activity, permission) == PackageManager.PERMISSION_GRANTED
    fun hasCallLogPermission(): Boolean = hasPermission(Manifest.permission.READ_CALL_LOG)
    fun hasContactsPermission(): Boolean = hasPermission(Manifest.permission.READ_CONTACTS)
    fun hasDevicePermissions(): Boolean = hasContactsPermission() && hasCallLogPermission() && hasPermission(Manifest.permission.CALL_PHONE) && hasPermission(Manifest.permission.READ_PHONE_STATE) && hasPermission(Manifest.permission.ANSWER_PHONE_CALLS) && hasPermission(Manifest.permission.RECORD_AUDIO) && (Build.VERSION.SDK_INT < 33 || hasPermission(Manifest.permission.POST_NOTIFICATIONS))
    fun setSecuritySetting(key: String, enabled: Boolean) {
        activity.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(key, enabled).apply()
    }
    fun roleStatus(): JSONObject = JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29 && activity.getSystemService(RoleManager::class.java).isRoleAvailable(RoleManager.ROLE_DIALER)).put("isCallScreeningRoleHeld", Build.VERSION.SDK_INT >= 29 && activity.getSystemService(RoleManager::class.java).isRoleHeld(RoleManager.ROLE_CALL_SCREENING))
    fun permissionStatus(): JSONObject = JSONObject().put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission()).put("callPhonePermission", hasPermission(Manifest.permission.CALL_PHONE)).put("phoneStatePermission", hasPermission(Manifest.permission.READ_PHONE_STATE)).put("answerCallsPermission", hasPermission(Manifest.permission.ANSWER_PHONE_CALLS)).put("recordAudioPermission", hasPermission(Manifest.permission.RECORD_AUDIO)).put("notificationsPermission", Build.VERSION.SDK_INT < 33 || hasPermission(Manifest.permission.POST_NOTIFICATIONS))
    fun dispatchWebEvent(type: String, data: JSONObject) { webView.post { webView.evaluateJavascript("if(window.__onAndroidTelecomEvent){window.__onAndroidTelecomEvent(${JSONObject.quote(type)},$data);}", null) } }
    fun dispatchCallEvent(type: String, data: JSONObject) = dispatchWebEvent(type, data)
    private fun readContacts(limit: Int): JSONArray { val result = JSONArray(); if (!hasContactsPermission()) return result; val projection = arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME, ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.STARRED); activity.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI, projection, null, null, "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { cursor -> var count = 0; while (cursor.moveToNext() && count < limit.coerceIn(1, 2000)) { result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("name", cursor.getString(1).orEmpty()).put("number", cursor.getString(2).orEmpty()).put("isFavorite", cursor.getInt(3) == 1)); count++ } }; return result }
    fun lookupName(number: String): String? { if (!hasContactsPermission() || number.isBlank()) return null; return activity.contentResolver.query(Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI, Uri.encode(number)), arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME), null, null, null)?.use { cursor -> if (cursor.moveToFirst()) cursor.getString(0) else null } }
    private fun readCallLogs(limit: Int): JSONArray { val result = JSONArray(); if (!hasCallLogPermission()) { VigilShieldInCallService.readHistory(limit).forEach(result::put); return result }; val uri = CallLog.Calls.CONTENT_URI.buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, limit.coerceIn(1, 500).toString()).build(); val projection = arrayOf(CallLog.Calls._ID, CallLog.Calls.NUMBER, CallLog.Calls.CACHED_NAME, CallLog.Calls.TYPE, CallLog.Calls.DATE, CallLog.Calls.DURATION); activity.contentResolver.query(uri, projection, null, null, "${CallLog.Calls.DATE} DESC")?.use { cursor -> while (cursor.moveToNext()) { val number = cursor.getString(1).orEmpty(); val name = cursor.getString(2)?.trim().orEmpty().ifBlank { number.ifBlank { "Unknown caller" } }; result.put(JSONObject().put("id", cursor.getString(0).orEmpty()).put("number", number).put("callerName", name).put("type", when (cursor.getInt(3)) { CallLog.Calls.INCOMING_TYPE -> "INCOMING"; CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"; CallLog.Calls.MISSED_TYPE -> "MISSED"; CallLog.Calls.REJECTED_TYPE -> "REJECTED"; CallLog.Calls.BLOCKED_TYPE -> "BLOCKED_CANCELLED"; else -> "UNKNOWN" }).put("timestamp", cursor.getLong(4)).put("durationSeconds", cursor.getLong(5)).put("isContact", name.isNotBlank() && name != number)) } }; return result }
}

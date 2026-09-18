package com.vigilshield.telecom

import android.Manifest
import android.app.KeyguardManager
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.Vibrator
import android.telecom.TelecomManager
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: AndroidTelephonyBridge
    private lateinit var loadingView: View
    private lateinit var errorView: View
    private lateinit var errorText: TextView
    private lateinit var assetLoader: WebViewAssetLoader
    private val mainHandler = Handler(Looper.getMainLooper())
    private var uiReportedReady = false
    private var startupCheckAttempts = 0
    private var lastConsoleError: String? = null
    private var lastPermissionSignature: String? = null
    private var lastDispatchedIntentIdentity: Int = 0
    companion object {
        private const val PERMISSION_REQ = 7002
        private const val DIALER_ROLE_REQ = 7001
        private const val SCREENING_ROLE_REQ = 7003
        private const val APP_ASSET_URL = "https://appassets.androidplatform.net/index.html"
        @Volatile var isAppVisible: Boolean = false
    }

    override fun onStart() {
        super.onStart()
        isAppVisible = true
    }

    override fun onStop() {
        isAppVisible = false
        super.onStop()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(11, 15, 20)
        window.navigationBarColor = Color.rgb(11, 15, 20)
        configureLockscreenWindow(hasActiveOrRingingCall() || isIncomingCallIntent(intent))
        val root = FrameLayout(this)
        webView = WebView(this); root.addView(webView, FrameLayout.LayoutParams(-1, -1))
        loadingView = createLoadingView(); root.addView(loadingView, FrameLayout.LayoutParams(-1, -1))
        errorView = createErrorView(); errorView.visibility = View.GONE; root.addView(errorView, FrameLayout.LayoutParams(-1, -1)); setContentView(root)
        bridge = AndroidTelephonyBridge(this, webView); lastPermissionSignature = permissionSignature()
        assetLoader = WebViewAssetLoader.Builder().addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.addJavascriptInterface(bridge, AndroidTelephonyBridge.INTERFACE_NAME)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? = request?.url?.let { assetLoader.shouldInterceptRequest(it) }
            @Suppress("DEPRECATION") override fun shouldInterceptRequest(view: WebView?, url: String?): WebResourceResponse? = url?.let { assetLoader.shouldInterceptRequest(Uri.parse(it)) }
            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) { uiReportedReady = false; startupCheckAttempts = 0; lastConsoleError = null; showLoading() }
            override fun onPageFinished(view: WebView?, url: String?) {
                bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
                bridge.dispatchWebEvent("PERMISSIONS_CHANGED", bridge.permissionStatus())
                syncWebSettingsToNative()
                scheduleReactMountCheck(view)
            }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: android.webkit.WebResourceError?) { if (request?.isForMainFrame != false) showError("The CallShield screen could not load.\n\n${error?.description ?: "Unknown WebView error"}") }
            @Suppress("DEPRECATION") override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) { showError("The CallShield screen could not load.\n\n${description ?: "WebView error $errorCode"}") }
        }
        webView.webChromeClient = object : WebChromeClient() { override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean { if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) lastConsoleError = "${consoleMessage.message()} (line ${consoleMessage.lineNumber()})"; return true } }
        webView.loadUrl(APP_ASSET_URL)
        // Default Phone role is requested only from an explicit user action in the UI.
        // Do not interrupt widget/phone-surface launches with a system role dialog.
    }

    private fun hasActiveOrRingingCall(): Boolean {
        return NativeInCallService.activeCalls.values.any {
            it.state == android.telecom.Call.STATE_RINGING ||
            it.state == android.telecom.Call.STATE_ACTIVE ||
            it.state == android.telecom.Call.STATE_DIALING ||
            it.state == android.telecom.Call.STATE_CONNECTING ||
            it.state == android.telecom.Call.STATE_HOLDING
        }
    }

    private fun isIncomingCallIntent(value: Intent?): Boolean {
        return value?.getBooleanExtra("is_incoming_call", false) == true ||
               value?.action == "com.vigilshield.telecom.OPEN_INCOMING_CALL" ||
               (!value?.getStringExtra("open_call_id").isNullOrBlank() && value?.getStringExtra("open_tab") == "incoming")
    }

    private fun isCallIntent(value: Intent?): Boolean {
        return isIncomingCallIntent(value) ||
               value?.action == "com.vigilshield.telecom.OPEN_OUTGOING_CALL" ||
               value?.action == Intent.ACTION_CALL ||
               !value?.getStringExtra("open_call_id").isNullOrBlank()
    }

    private fun configureLockscreenWindow(isIncomingOrActiveCall: Boolean) {
        if (isIncomingOrActiveCall) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true)
                setTurnScreenOn(true)
            }
            @Suppress("DEPRECATION")
            window.addFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(false)
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = (
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                )
            }
        } else {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(false)
                setTurnScreenOn(false)
            }
            @Suppress("DEPRECATION")
            window.clearFlags(
                android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or
                android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                window.setDecorFitsSystemWindows(true)
            } else {
                @Suppress("DEPRECATION")
                window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE
            }
        }
    }

    private fun permissionSignature(): String = listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.READ_CALL_LOG, Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE, Manifest.permission.ANSWER_PHONE_CALLS).joinToString("|") { "$it:${ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED}" }
    private fun syncWebSettingsToNative() { webView.evaluateJavascript("localStorage.getItem('vigilshield_settings')") { raw -> runCatching { val value = raw?.trim()?.let { if (it == "null") null else org.json.JSONTokener(it).nextValue() as? String } ?: return@runCatching; val settings = org.json.JSONObject(value); bridge.setSecuritySetting("masterEnabled", settings.optBoolean("masterEnabled", true)); bridge.setSecuritySetting("phase2_risk_detection_enabled", settings.optBoolean("scamShieldEnabled", true)); bridge.setSecuritySetting("phase2_financial_warnings_enabled", settings.optBoolean("financialWarningsEnabled", true)); bridge.setSecuritySetting("phase2_spoof_warnings_enabled", settings.optBoolean("spoofWarningsEnabled", true)); bridge.setSecuritySetting("smart_spam_reject_high_risk", settings.optBoolean("autoCancelSpamCalls", false)); bridge.setSecuritySetting("block_private_hidden", settings.optBoolean("blockPrivateHidden", false)); bridge.setSecuritySetting("block_international", settings.optBoolean("blockInternational", false)); bridge.setSecuritySetting("unknown_caller_silence", settings.optBoolean("unknownCallerSilence", false)); bridge.setSecuritySetting("unknown_caller_reject", settings.optBoolean("unknownCallerReject", false)) } } }

    private fun dispatchLaunchIntent() {
        val current = intent ?: return
        val identity = System.identityHashCode(current)
        if (identity == lastDispatchedIntentIdentity) return
        lastDispatchedIntentIdentity = identity
        val callId = current.getStringExtra("open_call_id")
        val telUri = current.data?.schemeSpecificPart?.trim()
        val number = current.getStringExtra("open_call_number")
            ?: current.getStringExtra("search_number")
            ?: telUri
        val name = current.getStringExtra("open_call_name")
        val tab = current.getStringExtra("open_tab")
        val action = current.getStringExtra("notification_action") ?: current.action ?: ""
        val isIncoming = isIncomingCallIntent(current)
        val phoneSurface = current.getBooleanExtra("phone_surface", false)
        bridge.dispatchWebEvent("PHONE_SURFACE_CHANGED", JSONObject().put("phoneOnly", phoneSurface))
        hideLoading()
        hideError()
        if (!callId.isNullOrBlank() || !number.isNullOrBlank() || !tab.isNullOrBlank() || isIncoming) {
            val payload = JSONObject()
                .put("callId", callId ?: "")
                .put("number", number ?: "")
                .put("name", name ?: "")
                .put("tab", tab ?: if (isIncoming) "incoming" else if (current.action == Intent.ACTION_CALL || current.action == Intent.ACTION_DIAL) "dialer" else "recents")
                .put("action", action)
                .put("isIncoming", isIncoming)
            val actionIsCallUi = current.action == "com.vigilshield.telecom.OPEN_INCOMING_CALL"
            val actionIsDialIntent = current.action == Intent.ACTION_DIAL || current.action == Intent.ACTION_VIEW
            val actionIsDirectCall = current.action == Intent.ACTION_CALL
            if (actionIsCallUi || (!actionIsDirectCall && !actionIsDialIntent && !current.action.equals("com.vigilshield.telecom.OPEN_OUTGOING_CALL"))) {
                bridge.dispatchWebEvent("OPEN_CALL_FROM_NOTIFICATION", payload)
            }
            if (!number.isNullOrBlank()) {
                val quoted = JSONObject.quote(number)
                if (current.action == Intent.ACTION_CALL) {
                    webView.post { webView.evaluateJavascript("if(window.__onAndroidCallIntent){window.__onAndroidCallIntent($quoted);}", null) }
                } else if (current.action == Intent.ACTION_DIAL || current.action == Intent.ACTION_VIEW) {
                    webView.post { webView.evaluateJavascript("if(window.__onAndroidDialIntent){window.__onAndroidDialIntent($quoted);}", null) }
                }
            }
        }
    }

    fun onReactUiReady() {
        uiReportedReady = true
        mainHandler.removeCallbacksAndMessages("react-startup")
        hideLoading()
        hideError()
        syncWebSettingsToNative()
        dispatchLaunchIntent()
        NativeInCallService.emitActiveCalls()
    }

    private fun scheduleReactMountCheck(view: WebView?) {
        if (view == null || isFinishing || isDestroyed || uiReportedReady) return
        startupCheckAttempts = 0
        mainHandler.removeCallbacksAndMessages("react-startup")
        val check = object : Runnable {
            override fun run() {
                if (uiReportedReady || isFinishing || isDestroyed) return
                startupCheckAttempts++
                verifyReactMounted(view)
                if (!uiReportedReady && startupCheckAttempts < 10) mainHandler.postDelayed(this, 500L)
            }
        }
        mainHandler.postDelayed(check, 500L)
    }

    private fun verifyReactMounted(view: WebView?) {
        if (view == null || uiReportedReady || isFinishing || isDestroyed) return
        view.evaluateJavascript("(function(){var r=document.getElementById('root');return r&&r.children.length>0?'READY':'EMPTY';})()") { result ->
            if (result?.contains("READY") == true) {
                onReactUiReady()
            } else if (startupCheckAttempts >= 10) {
                showError("CallShield UI did not finish starting.\n\n${lastConsoleError ?: "The interface took too long to mount."}")
            }
        }
    }

    private fun createLoadingView(): View = FrameLayout(this).apply {
        setBackgroundColor(Color.rgb(2, 6, 23))
        val icon = android.widget.ImageView(this@MainActivity).apply {
            setImageResource(R.drawable.ic_callshield)
            scaleType = android.widget.ImageView.ScaleType.FIT_CENTER
            contentDescription = "CallShield"
            alpha = 0f
        }
        addView(icon, FrameLayout.LayoutParams(88, 88, Gravity.CENTER))
        icon.animate().alpha(1f).setDuration(220L).start()
    }

    private fun createErrorView(): View {
        val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setBackgroundColor(Color.rgb(2, 6, 23)); setPadding(32, 32, 32, 32) }
        box.addView(TextView(this).apply { text = "CallShield couldn't start"; textSize = 24f; setTextColor(Color.WHITE); gravity = Gravity.CENTER })
        errorText = TextView(this).apply { textSize = 15f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER; setPadding(0, 20, 0, 24) }
        box.addView(errorText)
        box.addView(Button(this).apply { text = "Retry"; setOnClickListener { hideError(); showLoading(); webView.reload() } })
        return box
    }

    private fun showLoading() { loadingView.visibility = View.VISIBLE; errorView.visibility = View.GONE }
    private fun hideLoading() { loadingView.visibility = View.GONE }
    private fun showError(message: String) { loadingView.visibility = View.GONE; errorText.text = message; errorView.visibility = View.VISIBLE }
    private fun hideError() { errorView.visibility = View.GONE }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val isVolumeKey = event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN ||
                          event.keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
                          event.keyCode == KeyEvent.KEYCODE_VOLUME_MUTE
        if (isVolumeKey && isRingingOrIncoming()) {
            if (event.action == KeyEvent.ACTION_DOWN) {
                silenceIncomingRinger()
            }
            return true
        }
        return super.dispatchKeyEvent(event)
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        val isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_DOWN ||
                          keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
                          keyCode == KeyEvent.KEYCODE_VOLUME_MUTE
        if (isVolumeKey && isRingingOrIncoming()) {
            silenceIncomingRinger()
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
        val isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_DOWN ||
                          keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
                          keyCode == KeyEvent.KEYCODE_VOLUME_MUTE
        if (isVolumeKey && isRingingOrIncoming()) {
            return true
        }
        return super.onKeyUp(keyCode, event)
    }

    private fun isRingingOrIncoming(): Boolean {
        return NativeInCallService.isRinging() ||
               NativeInCallService.activeCalls.values.any { it.state == android.telecom.Call.STATE_RINGING } ||
               intent?.getBooleanExtra("is_incoming_call", false) == true
    }

    private fun silenceIncomingRinger() {
        NativeInCallService.stopRinging()
        runCatching {
            val telecom = getSystemService(TelecomManager::class.java)
            telecom?.silenceRinger()
        }
        runCatching {
            val audio = getSystemService(AudioManager::class.java)
            audio?.adjustStreamVolume(AudioManager.STREAM_RING, AudioManager.ADJUST_MUTE, 0)
            audio?.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, AudioManager.ADJUST_MUTE, 0)
        }
        runCatching {
            val vibrator = getSystemService(Vibrator::class.java)
            vibrator?.cancel()
        }
        if (::bridge.isInitialized) {
            bridge.dispatchWebEvent("SILENCE_RINGER", JSONObject())
        }
    }

    override fun onResume() {
        super.onResume()
        val km = getSystemService(KeyguardManager::class.java)
        val hasCall = hasActiveOrRingingCall() || isIncomingCallIntent(intent)

        configureLockscreenWindow(hasCall)
        hideLoading()
        hideError()

        if (NativeInCallService.activeCalls.isEmpty()) {
            CallNotificationHelper.clearAllCallNotifications(this)
            NativeInCallService.stopRinging()
        }

        if (::bridge.isInitialized) {
            bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
            bridge.dispatchWebEvent("PERMISSIONS_CHANGED", bridge.permissionStatus())
            bridge.dispatchWebEvent("DEVICE_LOCK_STATE_CHANGED", JSONObject().put("isLocked", km?.isKeyguardLocked == true))
            syncWebSettingsToNative()
            val current = permissionSignature()
            if (lastPermissionSignature != current) lastPermissionSignature = current
            if (uiReportedReady) {
                dispatchLaunchIntent()
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent != null) {
            setIntent(intent)
            hideLoading()
            hideError()
            val hasCall = hasActiveOrRingingCall() || isIncomingCallIntent(intent)
            configureLockscreenWindow(hasCall)
            val km = getSystemService(KeyguardManager::class.java)
            if (::bridge.isInitialized) {
                bridge.dispatchWebEvent("DEVICE_LOCK_STATE_CHANGED", JSONObject().put("isLocked", km?.isKeyguardLocked == true))
            }
            dispatchLaunchIntent()
        }
    }

    @Deprecated("Deprecated in Android API 31; kept for API 29/30 role flow compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            DIALER_ROLE_REQ -> {
                bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
                requestPermissionsIfNeeded()
            }
            SCREENING_ROLE_REQ -> bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == PERMISSION_REQ) {
            lastPermissionSignature = permissionSignature()
            bridge.dispatchWebEvent("PERMISSIONS_CHANGED", bridge.permissionStatus())
            if (bridge.isDefaultDialer()) requestCallScreeningRoleOnce()
        }
    }

    private fun requestPermissionsIfNeeded() {
        val permissions = mutableListOf(Manifest.permission.READ_CONTACTS, Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE, Manifest.permission.ANSWER_PHONE_CALLS, Manifest.permission.READ_CALL_LOG)
        if (Build.VERSION.SDK_INT >= 33) permissions += Manifest.permission.POST_NOTIFICATIONS
        val missing = permissions.filter { ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED }
        if (missing.isNotEmpty()) ActivityCompat.requestPermissions(this, missing.toTypedArray(), PERMISSION_REQ)
        else requestCallScreeningRoleOnce()
    }

    private fun requestCallScreeningRoleOnce() {
        if (Build.VERSION.SDK_INT >= 29) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm.isRoleAvailable(RoleManager.ROLE_CALL_SCREENING) && !rm.isRoleHeld(RoleManager.ROLE_CALL_SCREENING))
                startActivityForResult(rm.createRequestRoleIntent(RoleManager.ROLE_CALL_SCREENING), SCREENING_ROLE_REQ)
        }
    }

    private fun requestDefaultDialerIfAvailable() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm.isRoleAvailable(RoleManager.ROLE_DIALER)) {
                if (rm.isRoleHeld(RoleManager.ROLE_DIALER)) requestPermissionsIfNeeded()
                else startActivityForResult(rm.createRequestRoleIntent(RoleManager.ROLE_DIALER), DIALER_ROLE_REQ)
            } else requestPermissionsIfNeeded()
        } else requestPermissionsIfNeeded()
    }
}


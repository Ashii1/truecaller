package com.vigilshield.telecom

import android.Manifest
import android.app.KeyguardManager
import android.app.role.RoleManager
import android.content.Context
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
    private var lockStateReceiver: android.content.BroadcastReceiver? = null
    private var keyguardLockedListener: Any? = null
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

    override fun onStart() { super.onStart(); isAppVisible = true }
    override fun onStop() { isAppVisible = false; super.onStop() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        runCatching { ensureRingerNotMuted() }
        runCatching { window.statusBarColor = Color.rgb(11, 15, 20); window.navigationBarColor = Color.rgb(11, 15, 20) }
        runCatching { registerLockStateListener() }
        runCatching { configureLockscreenWindow(hasActiveOrRingingCall() || isIncomingCallIntent(intent)) }
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
            override fun onPageFinished(view: WebView?, url: String?) { bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus()); bridge.dispatchWebEvent("PERMISSIONS_CHANGED", bridge.permissionStatus()); syncWebSettingsToNative(); scheduleReactMountCheck(view) }
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: android.webkit.WebResourceError?) { if (request?.isForMainFrame != false) showError("The CallShield screen could not load.\n\n${error?.description ?: "Unknown WebView error"}") }
            @Suppress("DEPRECATION") override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) { showError("The CallShield screen could not load.\n\n${description ?: "WebView error $errorCode"}") }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean { if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) lastConsoleError = "${consoleMessage.message()} (line ${consoleMessage.lineNumber()})"; return true }
            override fun onPermissionRequest(request: android.webkit.PermissionRequest?) { runOnUiThread { request?.grant(request.resources) } }
        }
        webView.setDownloadListener { url, _, contentDisposition, mimetype, _ -> try { if (url.startsWith("data:")) { val base64Data = url.substringAfter("base64,"); val fileName = "CallShield_Recording_${System.currentTimeMillis()}.wav"; bridge.saveCallRecordingToDevice(fileName, base64Data, mimetype ?: "audio/wav") } else { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) } } catch (e: Exception) { android.util.Log.w("MainActivity", "Download failed: ${e.message}") } }
        webView.loadUrl(APP_ASSET_URL)
    }

    internal fun hasActiveOrRingingCall(): Boolean = runCatching { VigilShieldInCallService.activeCalls.values.any { it.state == android.telecom.Call.STATE_RINGING || it.state == android.telecom.Call.STATE_ACTIVE || it.state == android.telecom.Call.STATE_DIALING || it.state == android.telecom.Call.STATE_CONNECTING || it.state == android.telecom.Call.STATE_HOLDING } }.getOrDefault(false)
    private fun isIncomingCallIntent(value: Intent?): Boolean = value?.getBooleanExtra("is_incoming_call", false) == true || value?.action == "com.vigilshield.telecom.OPEN_INCOMING_CALL" || (!value?.getStringExtra("open_call_id").isNullOrBlank() && value?.getStringExtra("open_tab") == "incoming")
    private fun isCallIntent(value: Intent?): Boolean = isIncomingCallIntent(value) || value?.action == "com.vigilshield.telecom.OPEN_OUTGOING_CALL" || !value?.getStringExtra("open_call_id").isNullOrBlank()
    private fun isWindowShowOnLockConfigured(): Boolean = runCatching { val ai = packageManager.getActivityInfo(componentName, PackageManager.GET_META_DATA); ai.metaData?.getBoolean("window-show-on-lock", true) ?: true }.getOrDefault(true)
    internal fun configureLockscreenWindow(isIncomingOrActiveCall: Boolean) { runCatching { val showOnLock = isWindowShowOnLockConfigured(); if (isIncomingOrActiveCall && showOnLock) { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) { setShowWhenLocked(true); setTurnScreenOn(true) }; @Suppress("DEPRECATION") window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(false) else { @Suppress("DEPRECATION") window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY } } else { if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) { setShowWhenLocked(false); setTurnScreenOn(false) }; @Suppress("DEPRECATION") window.clearFlags(android.view.WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or android.view.WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or android.view.WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD or android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) window.setDecorFitsSystemWindows(true) else { @Suppress("DEPRECATION") window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_VISIBLE } } } }
    private fun permissionSignature(): String = listOf(Manifest.permission.READ_CONTACTS, Manifest.permission.READ_CALL_LOG, Manifest.permission.CALL_PHONE, Manifest.permission.READ_PHONE_STATE, Manifest.permission.ANSWER_PHONE_CALLS).joinToString("|") { "$it:${ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED}" }
    private fun syncWebSettingsToNative() { webView.evaluateJavascript("localStorage.getItem('vigilshield_settings')") { raw -> runCatching { val value = raw?.trim()?.let { if (it == "null") null else org.json.JSONTokener(it).nextValue() as? String } ?: return@runCatching; val settings = org.json.JSONObject(value); bridge.setSecuritySetting("masterEnabled", settings.optBoolean("masterEnabled", true)); bridge.setSecuritySetting("phase2_risk_detection_enabled", settings.optBoolean("scamShieldEnabled", true)); bridge.setSecuritySetting("phase2_financial_warnings_enabled", settings.optBoolean("financialWarningsEnabled", true)); bridge.setSecuritySetting("phase2_spoof_warnings_enabled", settings.optBoolean("spoofWarningsEnabled", true)); bridge.setSecuritySetting("smart_spam_reject_high_risk", settings.optBoolean("autoCancelSpamCalls", false)); bridge.setSecuritySetting("block_private_hidden", settings.optBoolean("blockPrivateHidden", false)); bridge.setSecuritySetting("block_international", settings.optBoolean("blockInternational", false)); bridge.setSecuritySetting("unknown_caller_silence", settings.optBoolean("unknownCallerSilence", false)); bridge.setSecuritySetting("unknown_caller_reject", settings.optBoolean("unknownCallerReject", false)) } } }

    private fun dispatchLaunchIntent() {
        val current = intent ?: return
        val identity = System.identityHashCode(current)
        if (identity == lastDispatchedIntentIdentity) return
        lastDispatchedIntentIdentity = identity
        val callId = current.getStringExtra("open_call_id")
        val telUri = current.data?.schemeSpecificPart?.trim()
        val number = current.getStringExtra("open_call_number") ?: current.getStringExtra("search_number") ?: telUri
        val name = current.getStringExtra("open_call_name")
        val tab = current.getStringExtra("open_tab")
        val action = current.getStringExtra("notification_action") ?: current.action ?: ""
        val isIncoming = isIncomingCallIntent(current)
        val phoneSurface = current.getBooleanExtra("phone_surface", false)
        bridge.dispatchWebEvent("PHONE_SURFACE_CHANGED", JSONObject().put("phoneOnly", phoneSurface))
        hideLoading(); hideError()
        if (!callId.isNullOrBlank() || !number.isNullOrBlank() || !tab.isNullOrBlank() || isIncoming) {
            val payload = JSONObject().put("callId", callId ?: "").put("number", number ?: "").put("name", name ?: "").put("tab", tab ?: if (isIncoming) "incoming" else if (current.action == Intent.ACTION_CALL || current.action == Intent.ACTION_DIAL) "dialer" else "recents").put("action", action).put("isIncoming", isIncoming)
            val actionIsCallUi = current.action == "com.vigilshield.telecom.OPEN_INCOMING_CALL"
            val actionIsDialIntent = current.action == Intent.ACTION_DIAL || current.action == Intent.ACTION_VIEW
            val actionIsDirectCall = current.action == Intent.ACTION_CALL
            if (actionIsCallUi || (!actionIsDirectCall && !actionIsDialIntent && !current.action.equals("com.vigilshield.telecom.OPEN_OUTGOING_CALL"))) bridge.dispatchWebEvent("OPEN_CALL_FROM_NOTIFICATION", payload)
            if (!number.isNullOrBlank()) {
                val quoted = JSONObject.quote(number)
                if (current.action == Intent.ACTION_DIAL || current.action == Intent.ACTION_VIEW) webView.post { webView.evaluateJavascript("if(window.__onAndroidDialIntent){window.__onAndroidDialIntent($quoted);}", null) }
                // ACTION_CALL is deliberately not forwarded into the WebView. A direct call
                // has already been accepted by Android Telecom; forwarding it here can trigger
                // a second JS call attempt and make the OEM Phone app appear.
            }
        }
    }

    fun onReactUiReady() { uiReportedReady = true; mainHandler.removeCallbacksAndMessages("react-startup"); hideLoading(); hideError(); syncWebSettingsToNative(); dispatchLaunchIntent(); requestPermissionsIfNeeded(); VigilShieldInCallService.emitActiveCalls() }
    private fun scheduleReactMountCheck(view: WebView?) { if (view == null || isFinishing || isDestroyed || uiReportedReady) return; startupCheckAttempts = 0; mainHandler.removeCallbacksAndMessages("react-startup"); val check = object : Runnable { override fun run() { if (uiReportedReady || isFinishing || isDestroyed) return; startupCheckAttempts++; verifyReactMounted(view); if (!uiReportedReady && startupCheckAttempts < 10) mainHandler.postDelayed(this, 500L) } }; mainHandler.postDelayed(check, 500L) }
    private fun verifyReactMounted(view: WebView?) { if (view == null || uiReportedReady || isFinishing || isDestroyed) return; view.evaluateJavascript("(function(){var r=document.getElementById('root');return r&&r.children.length>0?'READY':'EMPTY';})()") { result -> if (result?.contains("READY") == true) onReactUiReady() else if (startupCheckAttempts >= 10) showError("CallShield UI did not finish starting.\n\n${lastConsoleError ?: "The interface took too long to mount."}") } }
    private fun createLoadingView(): View = FrameLayout(this).apply { setBackgroundColor(Color.rgb(2, 6, 23)); val icon = android.widget.ImageView(this@MainActivity).apply { setImageResource(R.drawable.ic_callshield); scaleType = android.widget.ImageView.ScaleType.FIT_CENTER; contentDescription = "CallShield"; alpha = 0f }; addView(icon, FrameLayout.LayoutParams(88, 88, Gravity.CENTER)); val tagline = TextView(this@MainActivity).apply { text = "CallShield - Know Who's Calling"; textSize = 14f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER; alpha = 0f }; val taglineParams = FrameLayout.LayoutParams(-2, -2, Gravity.CENTER).apply { topMargin = 124 }; addView(tagline, taglineParams); tagline.animate().alpha(1f).setStartDelay(80L).setDuration(220L).start(); icon.animate().alpha(1f).setDuration(220L).start() }
    private fun createErrorView(): View { val box = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = Gravity.CENTER; setBackgroundColor(Color.rgb(2, 6, 23)); setPadding(32, 32, 32, 32) }; box.addView(TextView(this@MainActivity).apply { text = "CallShield couldn't start"; textSize = 24f; setTextColor(Color.WHITE); gravity = Gravity.CENTER }); errorText = TextView(this@MainActivity).apply { textSize = 15f; setTextColor(Color.LTGRAY); gravity = Gravity.CENTER; setPadding(0, 20, 0, 24) }; box.addView(errorText); box.addView(Button(this@MainActivity).apply { text = "Retry"; setOnClickListener { hideError(); showLoading(); webView.reload() } }); return box }
    private fun showLoading() { loadingView.visibility = View.VISIBLE; errorView.visibility = View.GONE }
    private fun showError(message: String) { loadingView.visibility = View.GONE; errorText.text = message; errorView.visibility = View.VISIBLE }
    private fun hideLoading() { loadingView.visibility = View.GONE }
    private fun hideError() { errorView.visibility = View.GONE }
    override fun dispatchKeyEvent(event: KeyEvent): Boolean { val isVolumeKey = event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || event.keyCode == KeyEvent.KEYCODE_VOLUME_UP || event.keyCode == KeyEvent.KEYCODE_VOLUME_MUTE; if (isVolumeKey && isRingingOrIncoming()) { if (event.action == KeyEvent.ACTION_DOWN) silenceIncomingRinger(); return true }; return super.dispatchKeyEvent(event) }
    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean { val isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_MUTE; if (isVolumeKey && isRingingOrIncoming()) { silenceIncomingRinger(); return true }; return super.onKeyDown(keyCode, event) }
    override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean { val isVolumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_MUTE; if (isVolumeKey && isRingingOrIncoming()) return true; return super.onKeyUp(keyCode, event) }
    private fun isRingingOrIncoming(): Boolean = VigilShieldInCallService.isRinging() || VigilShieldInCallService.activeCalls.values.any { it.state == android.telecom.Call.STATE_RINGING } || intent?.getBooleanExtra("is_incoming_call", false) == true
    private fun ensureRingerNotMuted() { runCatching { val audio = getSystemService(AudioManager::class.java) ?: return; if (audio.ringerMode == AudioManager.RINGER_MODE_NORMAL && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) { if (audio.isStreamMute(AudioManager.STREAM_RING)) audio.adjustStreamVolume(AudioManager.STREAM_RING, AudioManager.ADJUST_UNMUTE, 0); if (audio.isStreamMute(AudioManager.STREAM_NOTIFICATION)) audio.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, AudioManager.ADJUST_UNMUTE, 0) } } }
}

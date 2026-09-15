package com.vigilshield.telecom

import android.Manifest
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
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

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: AndroidTelephonyBridge
    private lateinit var loadingView: View
    private lateinit var errorView: View
    private lateinit var errorText: TextView
    private lateinit var assetLoader: WebViewAssetLoader
    private val mainHandler = Handler(Looper.getMainLooper())
    private var pageFinished = false
    private var uiReportedReady = false
    private var lastConsoleError: String? = null

    companion object {
        private const val PERMISSION_REQ = 7002
        private const val DIALER_ROLE_REQ = 7001
        // The Vite production bundle is copied to app/src/main/assets.
        // Loading index.html from the asset root makes relative ./assets/* URLs resolve correctly.
        private const val APP_ASSET_URL = "https://appassets.androidplatform.net/index.html"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = FrameLayout(this)
        webView = WebView(this)
        root.addView(webView, FrameLayout.LayoutParams(-1, -1))

        loadingView = createLoadingView()
        root.addView(loadingView, FrameLayout.LayoutParams(-1, -1))

        errorView = createErrorView()
        errorView.visibility = View.GONE
        root.addView(errorView, FrameLayout.LayoutParams(-1, -1))
        setContentView(root)

        bridge = AndroidTelephonyBridge(this, webView)
        assetLoader = WebViewAssetLoader.Builder()
            // Root handler is intentional: Vite base './' emits ./assets/<hash> files.
            // Loading index.html at the asset root avoids the old /assets/assets/... path.
            .addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = false
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.addJavascriptInterface(bridge, AndroidTelephonyBridge.INTERFACE_NAME)
        webView.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
                return request?.url?.let { assetLoader.shouldInterceptRequest(it) }
            }

            @Suppress("DEPRECATION")
            override fun shouldInterceptRequest(view: WebView?, url: String?): WebResourceResponse? {
                return url?.let { assetLoader.shouldInterceptRequest(Uri.parse(it)) }
            }

            override fun onPageStarted(view: WebView?, url: String?, favicon: android.graphics.Bitmap?) {
                pageFinished = false
                uiReportedReady = false
                lastConsoleError = null
                showLoading()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                pageFinished = true
                bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
                handleDialIntent(intent)

                // Do not hide the loader just because HTML loaded. A broken JS bundle used to
                // leave the user with a completely white WebView. Verify that React mounted first.
                view?.postDelayed({ verifyReactMounted(view) }, 700)
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: android.webkit.WebResourceError?) {
                if (request?.isForMainFrame != false) {
                    showError("The VigilShield screen could not load.\n\n${error?.description ?: "Unknown WebView error"}")
                }
            }

            @Suppress("DEPRECATION")
            override fun onReceivedError(view: WebView?, errorCode: Int, description: String?, failingUrl: String?) {
                showError("The VigilShield screen could not load.\n\n${description ?: "WebView error $errorCode"}")
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                if (consoleMessage.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                    lastConsoleError = "${consoleMessage.message()} (line ${consoleMessage.lineNumber()})"
                    // Keep the diagnostic visible instead of allowing onPageFinished to turn it white.
                    if (pageFinished) showError("VigilShield UI error.\n\n$lastConsoleError")
                }
                return true
            }
        }

        webView.loadUrl(APP_ASSET_URL)
        requestDefaultDialerIfAvailable()
    }

    private fun verifyReactMounted(view: WebView) {
        if (uiReportedReady || isFinishing || isDestroyed) return
        view.evaluateJavascript(
            "(function(){var r=document.getElementById('root'); return r && r.children.length > 0 ? 'READY' : 'EMPTY';})()"
        ) { result ->
            val ready = result?.contains("READY") == true
            if (ready) {
                uiReportedReady = true
                hideLoading()
                hideError()
            } else {
                val detail = lastConsoleError ?: "The React interface did not mount inside WebView."
                showError("VigilShield UI failed to start.\n\n$detail")
            }
        }
    }

    private fun createLoadingView(): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.WHITE)
            setPadding(48, 48, 48, 48)
        }
        box.addView(ProgressBar(this), LinearLayout.LayoutParams(64, 64))
        box.addView(TextView(this).apply {
            text = "Starting VigilShield…"
            textSize = 18f
            setTextColor(Color.DKGRAY)
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 0)
        })
        return box
    }

    private fun createErrorView(): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setBackgroundColor(Color.WHITE)
            setPadding(32, 32, 32, 32)
        }
        box.addView(TextView(this).apply {
            text = "VigilShield couldn't start"
            textSize = 24f
            setTextColor(Color.BLACK)
            gravity = Gravity.CENTER
        })
        errorText = TextView(this).apply {
            textSize = 15f
            setTextColor(Color.DKGRAY)
            gravity = Gravity.CENTER
            setPadding(0, 20, 0, 24)
        }
        box.addView(errorText)
        box.addView(Button(this).apply {
            text = "Retry"
            setOnClickListener {
                pageFinished = false
                uiReportedReady = false
                lastConsoleError = null
                hideError()
                showLoading()
                webView.reload()
            }
        }, LinearLayout.LayoutParams(-2, -2))
        return box
    }

    private fun showLoading() {
        loadingView.visibility = View.VISIBLE
        errorView.visibility = View.GONE
    }

    private fun hideLoading() {
        loadingView.visibility = View.GONE
    }

    private fun showError(message: String) {
        loadingView.visibility = View.GONE
        errorText.text = message
        errorView.visibility = View.VISIBLE
    }

    private fun hideError() {
        errorView.visibility = View.GONE
    }

    override fun onResume() {
        super.onResume()
        if (::bridge.isInitialized) {
            bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
            if (bridge.hasDevicePermissions()) {
                bridge.dispatchWebEvent("PERMISSIONS_CHANGED", bridge.permissionStatus())
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDialIntent(intent)
    }

    @Deprecated("Deprecated in Android API 31; kept for API 29/30 role flow compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == DIALER_ROLE_REQ) {
            requestPermissionsIfNeeded()
            bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
        }
    }

    private fun handleDialIntent(intent: Intent?) {
        val uri: Uri = intent?.data ?: return
        if (uri.scheme == "tel") {
            val number = uri.schemeSpecificPart
            if (!number.isNullOrBlank() && ::webView.isInitialized) {
                val quoted = org.json.JSONObject.quote(number)
                webView.post {
                    webView.evaluateJavascript(
                        "if(window.__onAndroidDialIntent){window.__onAndroidDialIntent($quoted);}",
                        null
                    )
                }
            }
        }
    }

    private fun requestPermissionsIfNeeded() {
        val permissions = mutableListOf(
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE,
            Manifest.permission.ANSWER_PHONE_CALLS
        )
        if (Build.VERSION.SDK_INT >= 33) permissions += Manifest.permission.POST_NOTIFICATIONS
        val missing = permissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (missing.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, missing.toTypedArray(), PERMISSION_REQ)
        }
    }

    private fun requestDefaultDialerIfAvailable() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm.isRoleAvailable(RoleManager.ROLE_DIALER)) {
                if (rm.isRoleHeld(RoleManager.ROLE_DIALER)) {
                    requestPermissionsIfNeeded()
                } else {
                    startActivityForResult(
                        rm.createRequestRoleIntent(RoleManager.ROLE_DIALER),
                        DIALER_ROLE_REQ
                    )
                }
            } else {
                requestPermissionsIfNeeded()
            }
        } else {
            requestPermissionsIfNeeded()
        }
    }
}

package com.vigilshield.telecom

import android.Manifest
import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridge: AndroidTelephonyBridge

    companion object {
        private const val PERMISSION_REQ = 7002
        private const val DIALER_ROLE_REQ = 7001
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = true
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                bridge.dispatchWebEvent("ROLE_STATUS_CHANGED", bridge.roleStatus())
                handleDialIntent(intent)
            }
        }
        webView.webChromeClient = WebChromeClient()
        bridge = AndroidTelephonyBridge(this, webView)
        webView.addJavascriptInterface(bridge, AndroidTelephonyBridge.INTERFACE_NAME)
        setContentView(webView)
        webView.loadUrl("file:///android_asset/index.html")

        // Android requires apps that need call-log permissions to become the
        // default phone handler before requesting those sensitive permissions.
        // Requesting READ_CALL_LOG first can cause the RoleController to deny
        // the default-phone prompt with a sensitive-permissions warning.
        requestDefaultDialerIfAvailable()
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
            // Only request call-log access after the role has been granted.
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
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.CALL_PHONE,
            Manifest.permission.READ_PHONE_STATE
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
                    // Already the default phone app; it is now safe to request
                    // the call-log permission needed for real call history.
                    requestPermissionsIfNeeded()
                } else {
                    startActivityForResult(
                        rm.createRequestRoleIntent(RoleManager.ROLE_DIALER),
                        DIALER_ROLE_REQ
                    )
                }
            } else {
                // On devices without the dialer role, request only the normal
                // runtime permissions and let the UI degrade gracefully.
                requestPermissionsIfNeeded()
            }
        } else {
            requestPermissionsIfNeeded()
        }
    }
}

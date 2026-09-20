# Keep the Android Telecom default-dialer implementation intact in release builds.
# Telecom discovers the InCallService from the manifest and invokes lifecycle methods
# outside the normal application call graph. Keeping this package prevents R8 from
# changing/removing call-service code and causing Android to fall back to the OEM Phone app.
-keep class com.vigilshield.telecom.VigilShieldInCallService { *; }
-keep class com.vigilshield.telecom.AndroidTelephonyBridge { *; }
-keep class com.vigilshield.telecom.MainActivity { *; }
-keep class com.vigilshield.telecom.IncomingCallActivity { *; }
-keep class com.vigilshield.telecom.OutgoingCallActivity { *; }
-keep class com.vigilshield.telecom.CallNotificationHelper { *; }
-keep class com.vigilshield.telecom.CallRingerHelper { *; }
-keep class com.vigilshield.telecom.CallActionReceiver { *; }

# Keep all Android Telecom component entry points and @JavascriptInterface methods.
-keepclasseswithmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keep class com.vigilshield.telecom.** { *; }

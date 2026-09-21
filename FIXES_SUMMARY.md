# Fixes Summary

The uploaded fixed version addresses three areas:

1. Incoming and ongoing calls use direction-aware CallShield intents.
2. Ongoing-call notifications remain persistent while the app is minimized.
3. Android build version/signing configuration is updated for the fixed APK flow.

Primary implementation changes are in `app/build.gradle.kts`, `MainActivity.kt`, `CallNotificationHelper.kt`, and `VigilShieldInCallService.kt`.

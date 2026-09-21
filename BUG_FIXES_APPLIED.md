# CallShield Bug Fixes

This release applies the uploaded fixes for:

- keeping incoming and ongoing calls inside CallShield
- keeping the ongoing-call notification persistent while the app is minimized
- updating Android build version/signing configuration for APK installation

Modified implementation files:
- `app/build.gradle.kts`
- `app/src/main/java/com/vigilshield/telecom/MainActivity.kt`
- `app/src/main/java/com/vigilshield/telecom/CallNotificationHelper.kt`
- `app/src/main/java/com/vigilshield/telecom/VigilShieldInCallService.kt`

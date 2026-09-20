package com.vigilshield.telecom

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * Compatibility helpers kept outside MainActivity so lifecycle/call UI code can
 * safely share the same permission and ringer operations without duplicating
 * state inside the Activity.
 */
internal fun MainActivity.registerLockStateListener() {
    // Telecom/InCallService is the source of truth for call state. The Activity
    // already reconfigures its lock-screen window when it is created or resumed.
}

internal fun MainActivity.requestPermissionsIfNeeded() {
    val requested = mutableListOf(
        Manifest.permission.READ_CONTACTS,
        Manifest.permission.CALL_PHONE,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.ANSWER_PHONE_CALLS,
        Manifest.permission.READ_CALL_LOG,
        Manifest.permission.RECORD_AUDIO
    )
    if (android.os.Build.VERSION.SDK_INT >= 33) {
        requested += Manifest.permission.POST_NOTIFICATIONS
    }
    val missing = requested.filter {
        ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing.isNotEmpty()) {
        ActivityCompat.requestPermissions(this, missing.toTypedArray(), 7002)
    }
}

internal fun MainActivity.silenceIncomingRinger() {
    runCatching { CallRingerHelper.silenceRinger(applicationContext) }
    runCatching { VigilShieldInCallService.stopRinging() }
}

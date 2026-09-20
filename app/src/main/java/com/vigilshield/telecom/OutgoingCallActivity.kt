package com.vigilshield.telecom

import android.app.Activity
import android.app.role.RoleManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.TelecomManager
import android.widget.Toast

/**
 * Native entry point for ACTION_CALL coming from Contacts, Recents or another app.
 * It deliberately does not open the WebView or launch the OEM Phone app.
 * Android Telecom owns the real call; VigilShieldInCallService receives the call lifecycle.
 */
class OutgoingCallActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        placeCallAndFinish(intent?.data?.schemeSpecificPart)
    }

    override fun onNewIntent(intent: android.content.Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        placeCallAndFinish(intent?.data?.schemeSpecificPart)
    }

    private fun placeCallAndFinish(rawNumber: String?) {
        val number = rawNumber?.trim().orEmpty()
        if (number.length < 3) {
            finish()
            return
        }

        if (Build.VERSION.SDK_INT >= 29) {
            val roleManager = getSystemService(RoleManager::class.java)
            if (roleManager != null && roleManager.isRoleAvailable(RoleManager.ROLE_DIALER) &&
                !roleManager.isRoleHeld(RoleManager.ROLE_DIALER)) {
                Toast.makeText(this, "Set CallShield as the default Phone app first", Toast.LENGTH_SHORT).show()
                finish()
                return
            }
        }

        val telecom = getSystemService(TelecomManager::class.java)
        val normalized = number.filter { it.isDigit() }
        val alreadyActive = VigilShieldInCallService.activeCalls.values.any { call ->
            call.details.handle?.schemeSpecificPart?.filter { it.isDigit() } == normalized
        }
        if (alreadyActive) {
            finish()
            return
        }

        runCatching {
            telecom.placeCall(Uri.fromParts("tel", number, null), Bundle())
        }.onFailure {
            Toast.makeText(this, "Unable to start the call", Toast.LENGTH_SHORT).show()
        }
        finish()
    }
}

package com.vigilshield.telecom

import android.content.Intent
import android.telecom.Call
import android.telecom.InCallService

/** Native Telecom endpoint required for ROLE_DIALER. */
class NativeInCallService : InCallService() {
    private val activeCalls = LinkedHashMap<String, Call>()

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        activeCalls[call.toString()] = call
        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                openCallUi(call, state, false)
            }
            override fun onDetailsChanged(call: Call, details: Call.Details) {
                openCallUi(call, call.state, false)
            }
        })
        openCallUi(call, call.state, true)
    }

    override fun onCallRemoved(call: Call) {
        activeCalls.remove(call.toString())
        openCallUi(call, call.state, true, true)
        super.onCallRemoved(call)
    }

    private fun openCallUi(call: Call, state: Int, initial: Boolean, removed: Boolean = false) {
        val intent = Intent(this, MainActivity::class.java).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            putExtra("android_in_call", initial)
            putExtra("android_call_removed", removed)
            putExtra("android_call_id", call.toString())
            putExtra("android_call_state", state)
        }
        try { startActivity(intent) } catch (_: Throwable) { }
    }
}

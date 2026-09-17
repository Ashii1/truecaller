package com.vigilshield.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CallActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_ANSWER = "com.vigilshield.telecom.ANSWER"
        const val ACTION_DECLINE = "com.vigilshield.telecom.DECLINE"
        const val ACTION_END = "com.vigilshield.telecom.END"
        const val ACTION_DISMISS = "com.vigilshield.telecom.DISMISS"
        const val EXTRA_CALL_ID = "call_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_CALL_ID)
        NativeInCallService.stopRinging()

        if (!id.isNullOrBlank()) {
            CallNotificationHelper.clearCall(context, id)
        }

        if (intent.action == ACTION_DECLINE || intent.action == ACTION_END || intent.action == ACTION_DISMISS) {
            CallNotificationHelper.clearAllCallNotifications(context)
        }

        val call = if (!id.isNullOrBlank()) NativeInCallService.activeCalls[id] else null
        when (intent.action) {
            ACTION_ANSWER -> {
                runCatching { call?.answer(0) }
            }
            ACTION_DECLINE -> {
                runCatching { call?.reject(false, "Declined from notification") }
                CallNotificationHelper.clearAllCallNotifications(context)
            }
            ACTION_END -> {
                runCatching { call?.disconnect() }
                CallNotificationHelper.clearAllCallNotifications(context)
            }
            ACTION_DISMISS -> {
                CallNotificationHelper.clearAllCallNotifications(context)
            }
        }
    }
}

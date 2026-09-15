package com.vigilshield.telecom

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class CallActionReceiver : BroadcastReceiver() {
    companion object {
        const val ACTION_ANSWER = "com.vigilshield.telecom.ANSWER"
        const val ACTION_DECLINE = "com.vigilshield.telecom.DECLINE"
        const val EXTRA_CALL_ID = "call_id"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val id = intent.getStringExtra(EXTRA_CALL_ID) ?: return
        val call = NativeInCallService.activeCalls[id] ?: return
        when (intent.action) {
            ACTION_ANSWER -> call.answer(0)
            ACTION_DECLINE -> call.reject(false, "Declined from notification")
        }
        CallNotificationHelper.clearCall(context, id)
    }
}

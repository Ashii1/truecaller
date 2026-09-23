package com.vigilshield.telecom

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.WindowManager
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Dedicated incoming-call full-screen surface.
 * It is separate from MainActivity so an incoming call does not open the main app.
 */
class IncomingCallActivity : Activity() {
    private val handler = Handler(Looper.getMainLooper())
    private var callId: String = ""

    private val monitor = object : Runnable {
        override fun run() {
            if (isFinishing) return
            val call = NativeInCallService.activeCalls[callId]
            if (call == null || call.state != android.telecom.Call.STATE_RINGING) {
                finish()
                return
            }
            handler.postDelayed(this, 350L)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        callId = intent.getStringExtra("open_call_id").orEmpty()
        val displayName = intent.getStringExtra("display_name").orEmpty().ifBlank { intent.getStringExtra("open_call_name").orEmpty() }.ifBlank { "Incoming call" }
        val number = intent.getStringExtra("open_call_number").orEmpty()

        if (callId.isNotBlank()) {
            runCatching {
                val forwardIntent = Intent(this, MainActivity::class.java).apply {
                    action = "com.vigilshield.telecom.OPEN_INCOMING_CALL"
                    putExtra("open_call_id", callId)
                    putExtra("open_call_number", number)
                    putExtra("open_call_name", displayName)
                    putExtra("is_incoming_call", true)
                    putExtra("phone_surface", true)
                    putExtra("open_tab", "incoming")
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                        Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                        Intent.FLAG_ACTIVITY_SINGLE_TOP
                    )
                }
                startActivity(forwardIntent)
            }
        }
        finish()
    }

    override fun onResume() {
        super.onResume()
        handler.post(monitor)
    }

    override fun onPause() {
        handler.removeCallbacks(monitor)
        super.onPause()
    }

    override fun onDestroy() {
        handler.removeCallbacks(monitor)
        super.onDestroy()
    }
}

package com.vigilshield.telecom

import android.app.Activity
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
            val call = VigilShieldInCallService.activeCalls[callId]
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
        if (callId.isBlank()) {
            finish()
            return
        }

        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        }
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            val km = getSystemService(android.app.KeyguardManager::class.java)
            km?.requestDismissKeyguard(this, null)
        }
        window.statusBarColor = Color.rgb(2, 6, 23)
        window.navigationBarColor = Color.rgb(2, 6, 23)

        val displayName = intent.getStringExtra("display_name").orEmpty().ifBlank { "Incoming call" }
        val number = intent.getStringExtra("open_call_number").orEmpty()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(40, 48, 40, 48)
            setBackgroundColor(Color.rgb(2, 6, 23))
        }

        root.addView(ImageView(this).apply {
            setImageResource(com.vigilshield.telecom.R.drawable.ic_callshield)
            contentDescription = "CallShield"
        }, LinearLayout.LayoutParams(96, 96))

        root.addView(TextView(this).apply {
            text = "Incoming call"
            textSize = 18f
            setTextColor(Color.LTGRAY)
            gravity = Gravity.CENTER
            setPadding(0, 28, 0, 8)
        })

        root.addView(TextView(this).apply {
            text = displayName
            textSize = 30f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setPadding(0, 8, 0, 8)
        })

        if (number.isNotBlank() && number != displayName) {
            root.addView(TextView(this).apply {
                text = number
                textSize = 17f
                setTextColor(Color.LTGRAY)
                gravity = Gravity.CENTER
                setPadding(0, 0, 0, 36)
            })
        }

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }

        val decline = Button(this).apply {
            text = "Decline"
            setOnClickListener {
                CallRingerHelper.stopRinging(this@IncomingCallActivity)
                VigilShieldInCallService.activeCalls[callId]?.reject(false, null)
                finish()
            }
        }
        val answer = Button(this).apply {
            text = "Answer"
            setOnClickListener {
                CallRingerHelper.stopRinging(this@IncomingCallActivity)
                val call = VigilShieldInCallService.activeCalls[callId]
                call?.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY)
                val mainIntent = android.content.Intent(this@IncomingCallActivity, MainActivity::class.java).apply {
                    action = "com.vigilshield.telecom.OPEN_OUTGOING_CALL"
                    putExtra("open_call_id", callId)
                    putExtra("open_call_number", number)
                    putExtra("open_call_name", displayName)
                    putExtra("is_incoming_call", false)
                    putExtra("open_tab", "dialer")
                    addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
                startActivity(mainIntent)
                finish()
            }
        }

        actions.addView(decline, LinearLayout.LayoutParams(0, 64, 1f).apply { setMargins(0, 0, 12, 0) })
        actions.addView(answer, LinearLayout.LayoutParams(0, 64, 1f).apply { setMargins(12, 0, 0, 0) })
        root.addView(actions, LinearLayout.LayoutParams(-1, 64))

        setContentView(root)
    }

    override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent?): Boolean {
        if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP) {
            CallRingerHelper.silenceRinger(this)
            runCatching {
                getSystemService(android.telecom.TelecomManager::class.java)?.silenceRinger()
            }
            return true
        }
        return super.onKeyDown(keyCode, event)
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
        CallRingerHelper.stopRinging(this)
        handler.removeCallbacks(monitor)
        super.onDestroy()
    }
}

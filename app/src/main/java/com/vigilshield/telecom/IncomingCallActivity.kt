package com.vigilshield.telecom

import android.app.Activity
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView

/**
 * Dedicated incoming-call full-screen surface.
 * It is separate from MainActivity so an incoming call never opens the main app underneath it.
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
            handler.postDelayed(this, 300L)
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
            runCatching {
                getSystemService(android.app.KeyguardManager::class.java)
                    ?.requestDismissKeyguard(this, null)
            }
        }
        window.statusBarColor = Color.rgb(3, 7, 18)
        window.navigationBarColor = Color.rgb(3, 7, 18)
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_LAYOUT_STABLE

        val displayName = intent.getStringExtra("display_name").orEmpty().ifBlank { "Unknown caller" }
        val number = intent.getStringExtra("open_call_number").orEmpty()

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(dp(28), dp(38), dp(28), dp(30))
            background = GradientDrawable(
                GradientDrawable.Orientation.TL_BR,
                intArrayOf(Color.rgb(3, 7, 18), Color.rgb(10, 20, 31), Color.rgb(3, 7, 18))
            )
        }

        val topRow = LinearLayout(this).apply {
            gravity = Gravity.CENTER_VERTICAL
            orientation = LinearLayout.HORIZONTAL
        }
        topRow.addView(ImageView(this).apply {
            setImageResource(com.vigilshield.telecom.R.drawable.ic_callshield)
            contentDescription = "CallShield"
            scaleType = ImageView.ScaleType.CENTER_INSIDE
        }, LinearLayout.LayoutParams(dp(34), dp(34)))
        topRow.addView(TextView(this).apply {
            text = "CallShield"
            textSize = 16f
            setTextColor(Color.WHITE)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(dp(10), 0, 0, 0)
        }, LinearLayout.LayoutParams(0, dp(40), 1f))
        root.addView(topRow, LinearLayout.LayoutParams(-1, dp(44)))

        val avatar = TextView(this).apply {
            val initial = displayName.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
            text = initial
            textSize = 42f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.rgb(24, 48, 65))
                setStroke(dp(2), Color.rgb(55, 86, 105))
            }
        }
        root.addView(avatar, LinearLayout.LayoutParams(dp(112), dp(112)).apply {
            gravity = Gravity.CENTER_HORIZONTAL
            topMargin = dp(58)
            bottomMargin = dp(24)
        })

        root.addView(TextView(this).apply {
            text = "Incoming call"
            textSize = 15f
            setTextColor(Color.rgb(148, 163, 184))
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, dp(28)))

        root.addView(TextView(this).apply {
            text = displayName
            textSize = 30f
            setTextColor(Color.WHITE)
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            gravity = Gravity.CENTER
            maxLines = 2
            ellipsize = android.text.TextUtils.TruncateAt.END
        }, LinearLayout.LayoutParams(-1, dp(48)).apply { topMargin = dp(3) })

        if (number.isNotBlank() && number != displayName) {
            root.addView(TextView(this).apply {
                text = number
                textSize = 17f
                setTextColor(Color.rgb(148, 163, 184))
                gravity = Gravity.CENTER
            }, LinearLayout.LayoutParams(-1, dp(30)))
        }

        root.addView(TextView(this).apply {
            text = "Protected by CallShield"
            textSize = 12f
            setTextColor(Color.rgb(100, 116, 139))
            gravity = Gravity.CENTER
        }, LinearLayout.LayoutParams(-1, dp(30)).apply { topMargin = dp(6) })

        val spacer = View(this)
        root.addView(spacer, LinearLayout.LayoutParams(1, 0, 1f))

        val actions = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
        }
        actions.addView(callAction("Decline", "✕", Color.rgb(190, 52, 61)) {
            CallRingerHelper.stopRinging(this@IncomingCallActivity)
            VigilShieldInCallService.activeCalls[callId]?.reject(false, null)
            finish()
        }, LinearLayout.LayoutParams(0, dp(116), 1f).apply { marginEnd = dp(10) })
        actions.addView(callAction("Accept", "✓", Color.rgb(25, 150, 91)) {
            CallRingerHelper.stopRinging(this@IncomingCallActivity)
            VigilShieldInCallService.activeCalls[callId]?.answer(android.telecom.VideoProfile.STATE_AUDIO_ONLY)
            finish()
        }, LinearLayout.LayoutParams(0, dp(116), 1f).apply { marginStart = dp(10) })
        root.addView(actions, LinearLayout.LayoutParams(-1, dp(116)))

        setContentView(root)
    }

    private fun callAction(label: String, symbol: String, color: Int, action: () -> Unit): View {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            isClickable = true
            isFocusable = true
            setOnClickListener { action() }
        }
        val icon = TextView(this).apply {
            text = symbol
            textSize = 31f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(color)
            }
        }
        box.addView(icon, LinearLayout.LayoutParams(dp(72), dp(72)).apply { gravity = Gravity.CENTER_HORIZONTAL })
        box.addView(TextView(this).apply {
            text = label
            textSize = 14f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
            setTypeface(typeface, android.graphics.Typeface.BOLD)
        }, LinearLayout.LayoutParams(-1, dp(32)).apply { topMargin = dp(8) })
        return box
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    override fun onKeyDown(keyCode: Int, event: android.view.KeyEvent?): Boolean {
        if (keyCode == android.view.KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == android.view.KeyEvent.KEYCODE_VOLUME_UP) {
            CallRingerHelper.silenceRinger(this)
            runCatching { getSystemService(android.telecom.TelecomManager::class.java)?.silenceRinger() }
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

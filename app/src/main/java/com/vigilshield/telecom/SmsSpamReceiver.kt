package com.vigilshield.telecom

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat

/**
 * Lightweight SMS classifier. It does not silently delete messages: users can
 * review the message and enable stronger handling when the app is their default
 * SMS handler on supported Android versions.
 */
class SmsSpamReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val sender = messages.firstOrNull()?.displayOriginatingAddress.orEmpty()
        val body = messages.joinToString("") { it.messageBody.orEmpty() }
        val result = SmsSpamAnalyzer.analyze(sender, body)
        val category = result.optString("category", "OTHER")
        if (category == "OTHER") return

        val prefs = context.getSharedPreferences("vigilshield", Context.MODE_PRIVATE)
        if (!prefs.getBoolean("sms_spam_protection_enabled", true)) return
        if (category == "SPAM" && !prefs.getBoolean("sms_spam_notifications", true)) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channelId = "sms_security"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(NotificationChannel(
                channelId,
                "SMS security alerts",
                NotificationManager.IMPORTANCE_HIGH
            ))
        }
        val title = if (category == "SCAM") "Possible scam SMS" else "Spam SMS detected"
        val reasons = result.optJSONArray("reasons")?.let { array ->
            (0 until array.length()).joinToString(", ") { array.optString(it) }
        }.orEmpty()
        manager.notify(
            (sender + body).hashCode(),
            NotificationCompat.Builder(context, channelId)
                .setSmallIcon(android.R.drawable.stat_notify_error)
                .setContentTitle(title)
                .setContentText(if (reasons.isBlank()) sender else "$sender • $reasons")
                .setStyle(NotificationCompat.BigTextStyle().bigText(body.take(240)))
                .setAutoCancel(true)
                .build()
        )
    }
}

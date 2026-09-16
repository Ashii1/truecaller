package com.vigilshield.telecom

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person

object CallNotificationHelper {
    private const val CHANNEL_ID = "calls"
    private const val SECURITY_CHANNEL_ID = "security"
    private const val MISSED_ID = 4101
    private const val REPEATED_ID = 4102
    private const val ENDED_ID = 4103
    private const val PREFS = "vigilshield"

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH).apply { description = "Incoming, ongoing and missed call alerts"; enableVibration(false); setSound(null, null); lightColor = Color.BLUE })
        if (manager.getNotificationChannel(SECURITY_CHANNEL_ID) == null) manager.createNotificationChannel(NotificationChannel(SECURITY_CHANNEL_ID, "Call security", NotificationManager.IMPORTANCE_HIGH).apply { description = "Local caller safety warnings"; enableVibration(false); setSound(null, null); lightColor = Color.RED })
    }

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private fun privacyMode(context: Context): Boolean = prefs(context).getBoolean("privacy_mode", true)
    private fun detailedNotifications(context: Context): Boolean = prefs(context).getBoolean("notification_caller_details", false)
    private fun notificationsEnabled(context: Context): Boolean = prefs(context).getBoolean("security_notifications", true)
    private fun callAlertsEnabled(context: Context): Boolean = prefs(context).getBoolean("security_call_alerts", true)
    private fun privateLockScreen(context: Context): Boolean = prefs(context).getBoolean("security_privacy_lock_screen", true) || privacyMode(context)

    private fun identity(context: Context, name: String, number: String): String {
        if (privacyMode(context)) return "Private caller"
        if (detailedNotifications(context)) return if (name.isBlank()) number else name
        return if (name.isBlank()) number else name
    }

    private fun identityWithNumber(context: Context, name: String, number: String): String {
        if (privacyMode(context)) return "Private caller"
        val who = identity(context, name, number)
        return if (detailedNotifications(context) && number.isNotBlank() && who != number) "$who · $number" else who
    }

    private fun applyPrivacy(builder: NotificationCompat.Builder, context: Context): NotificationCompat.Builder {
        if (privateLockScreen(context)) builder.setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
        return builder
    }

    fun showMissedCall(context: Context, name: String, number: String) {
        if (!callAlertsEnabled(context)) return
        ensureChannel(context)
        val openIntent = PendingIntent.getActivity(context, MISSED_ID, Intent(context, MainActivity::class.java).apply { putExtra("open_tab", "recents"); putExtra("search_number", number) }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val display = identityWithNumber(context, name, number)
        val detail = if (privacyMode(context)) "You missed a call. Tap to open Recents." else "You missed a call from $display. Tap to open Recents."
        val notification = applyPrivacy(NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentTitle("Missed call")
            .setContentText(display)
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(detail)), context).build()
        context.getSystemService(NotificationManager::class.java).notify(MISSED_ID, notification)
    }

    fun showIncomingCall(context: Context, callId: String, name: String, number: String) {
        if (!callAlertsEnabled(context)) return
        ensureChannel(context)
        val openIntent = PendingIntent.getActivity(context, callId.hashCode(), Intent(context, MainActivity::class.java).apply {
            putExtra("open_call_id", callId)
            putExtra("open_call_number", number)
            putExtra("open_call_name", name)
        }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val answer = PendingIntent.getBroadcast(context, callId.hashCode() + 1, Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_ANSWER).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val decline = PendingIntent.getBroadcast(context, callId.hashCode() + 2, Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_DECLINE).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val display = identity(context, name, number)
        val person = Person.Builder().setName(display).setImportant(true).build()
        val builder = applyPrivacy(NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setFullScreenIntent(openIntent, true), context)
        if (Build.VERSION.SDK_INT >= 31) builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer))
        else builder.setContentTitle(display).setContentText("Incoming call").addAction(0, "Decline", decline).addAction(0, "Answer", answer)
        context.getSystemService(NotificationManager::class.java).notify(callId.hashCode(), builder.build())
    }

    fun showCallEnded(context: Context) {
        if (!callAlertsEnabled(context)) return
        ensureChannel(context)
        val openIntent = PendingIntent.getActivity(context, ENDED_ID, Intent(context, MainActivity::class.java).putExtra("open_tab", "recents"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = applyPrivacy(NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentTitle("Call ended")
            .setContentText("Call details were saved to Recents.")
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setAutoCancel(true)
            .setContentIntent(openIntent), context).build()
        context.getSystemService(NotificationManager::class.java).notify(ENDED_ID, notification)
    }

    fun showSecurityWarning(context: Context, name: String, risk: String, spoofRisk: String, explanation: String) {
        if (!notificationsEnabled(context)) return
        ensureChannel(context)
        val title = when (risk) { "HIGH_RISK" -> "High-risk call pattern detected"; "SUSPICIOUS" -> "Suspicious call pattern"; else -> "Caller safety warning" }
        val identityText = if (privacyMode(context)) "Private caller" else identity(context, name, "")
        val text = if (privacyMode(context)) "Review this call before sharing sensitive information" else "$identityText · Spoof risk: $spoofRisk"
        val openIntent = PendingIntent.getActivity(context, (name + risk).hashCode(), Intent(context, MainActivity::class.java).putExtra("open_tab", "recents"), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val body = "$explanation Caller ID is not proof of identity. Never share OTPs, PINs or passwords."
        val notification = applyPrivacy(NotificationCompat.Builder(context, SECURITY_CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openIntent), context).build()
        context.getSystemService(NotificationManager::class.java).notify((name + risk + spoofRisk).hashCode(), notification)
    }

    fun showRepeatedCallAttention(context: Context, name: String, number: String) {
        if (!notificationsEnabled(context)) return
        ensureChannel(context)
        val identityText = if (privacyMode(context)) "The same caller" else identity(context, name, number)
        val detail = if (privacyMode(context)) "" else if (detailedNotifications(context) && number.isNotBlank()) " · $number" else ""
        val openIntent = PendingIntent.getActivity(context, REPEATED_ID, Intent(context, MainActivity::class.java).putExtra("open_tab", "recents").putExtra("search_number", number), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val text = if (privacyMode(context)) "A caller contacted you repeatedly within 10 minutes" else "$identityText$detail called again within 10 minutes"
        val body = if (privacyMode(context)) "A caller called again within 10 minutes. If you were expecting the call, review it from Recents." else "$identityText called again within 10 minutes. If you were expecting this call, you can return it from Recents. If not, review the caller before calling back."
        val notification = applyPrivacy(NotificationCompat.Builder(context, SECURITY_CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentTitle("Repeated call needs your attention")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openIntent), context).build()
        context.getSystemService(NotificationManager::class.java).notify(REPEATED_ID, notification)
    }

    fun clearCall(context: Context, callId: String) {
        context.getSystemService(NotificationManager::class.java).cancel(callId.hashCode())
        showCallEnded(context)
    }
}

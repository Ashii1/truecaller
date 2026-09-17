package com.vigilshield.telecom

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person

object CallNotificationHelper {
    private const val CHANNEL_ID = "calls"
    private const val SECURITY_CHANNEL_ID = "security"
    const val INCOMING_CALL_ID = 4100
    private const val MISSED_ID = 4101
    private const val REPEATED_ID = 4102
    private const val ENDED_ID = 4103
    private const val PREFS = "vigilshield"
    private val activeNotificationIds = java.util.Collections.synchronizedSet(mutableSetOf<Int>())

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Incoming, ongoing and missed call alerts"
                enableVibration(false)
                setSound(null, null)
                lightColor = Color.BLUE
                setShowBadge(true)
            })
        }
        if (manager.getNotificationChannel(SECURITY_CHANNEL_ID) == null) manager.createNotificationChannel(NotificationChannel(SECURITY_CHANNEL_ID, "Call security", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Local caller safety warnings"
            enableVibration(false)
            setSound(null, null)
            lightColor = Color.RED
        })
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

    private fun callActivityIntent(context: Context, callId: String, name: String, number: String): Intent = Intent(context, MainActivity::class.java).apply {
        action = "com.vigilshield.telecom.OPEN_INCOMING_CALL"
        putExtra("open_call_id", callId)
        putExtra("open_call_number", number)
        putExtra("open_call_name", name)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

    fun showMissedCall(context: Context, name: String, number: String) {
        if (!callAlertsEnabled(context)) return
        ensureChannel(context)
        val openIntent = PendingIntent.getActivity(context, MISSED_ID, Intent(context, MainActivity::class.java).apply { putExtra("open_tab", "recents"); putExtra("search_number", number); addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP) }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val display = identityWithNumber(context, name, number)
        val detail = if (privacyMode(context)) "Missed call: $number" else "Missed call from $display"
        val callBackIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(number)}"))
        val callBackPendingIntent = PendingIntent.getActivity(context, (number + "callback").hashCode(), callBackIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = NotificationCompat.Builder(context, CHANNEL_ID).setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield).setContentTitle("Missed call").setContentText(if (name.isNotBlank() && name != number) "$name · $number" else number).setCategory(NotificationCompat.CATEGORY_MISSED_CALL).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(openIntent).addAction(0, "Call back", callBackPendingIntent).setStyle(NotificationCompat.BigTextStyle().bigText(detail))
        context.getSystemService(NotificationManager::class.java).notify(MISSED_ID, applyPrivacy(builder, context).build())
    }

    fun showIncomingCall(context: Context, callId: String, name: String, number: String) {
        if (!callAlertsEnabled(context)) return
        ensureChannel(context)
        val notifId = INCOMING_CALL_ID
        activeNotificationIds.add(notifId)
        activeNotificationIds.add(callId.hashCode())
        val openIntent = PendingIntent.getActivity(context, callId.hashCode(), callActivityIntent(context, callId, name, number), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val answer = PendingIntent.getBroadcast(context, callId.hashCode() + 1, Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_ANSWER).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val decline = PendingIntent.getBroadcast(context, callId.hashCode() + 2, Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_DECLINE).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val dismiss = PendingIntent.getBroadcast(context, callId.hashCode() + 4, Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_DISMISS).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val display = identity(context, name, number)
        val person = Person.Builder().setName(display).setImportant(true).build()
        val builder = applyPrivacy(NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentIntent(openIntent)
            .setDeleteIntent(dismiss)
            .setAutoCancel(false)
            .setOngoing(true)
            .setTimeoutAfter(60_000L)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setFullScreenIntent(openIntent, true), context)
        if (Build.VERSION.SDK_INT >= 31) builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer))
        else builder.setContentTitle(display).setContentText("Incoming call").addAction(0, "Decline", decline).addAction(0, "Answer", answer)
        val notif = builder.build()
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(notifId, notif)
        manager.notify(callId.hashCode(), notif)
    }

    fun showOngoingCall(context: Context, callId: String, name: String, number: String, state: String, connectTimeMillis: Long, riskLevel: String? = null) {
        if (!callAlertsEnabled(context)) return
        ensureChannel(context)
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(INCOMING_CALL_ID)
        activeNotificationIds.remove(INCOMING_CALL_ID)
        activeNotificationIds.add(callId.hashCode())
        val display = identity(context, name, number)
        val openIntent = PendingIntent.getActivity(context, callId.hashCode(), callActivityIntent(context, callId, name, number), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val end = PendingIntent.getBroadcast(context, callId.hashCode() + 3, Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_END).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val status = when (state) { "ACTIVE" -> "Ongoing call"; "HOLDING" -> "Call on hold"; "DIALING" -> "Calling…"; "CONNECTING" -> "Connecting…"; else -> "Call in progress" }
        val riskText = when (riskLevel) { "HIGH_RISK" -> " · High risk"; "SUSPICIOUS" -> " · Suspicious"; else -> "" }
        val detail = if (privacyMode(context)) "$status$riskText · Tap to return to call" else "$display$riskText · $status · Tap to return to call"
        val person = Person.Builder().setName(display).setImportant(true).build()
        val builder = applyPrivacy(NotificationCompat.Builder(context, CHANNEL_ID).setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield).setContentTitle(display).setContentText(detail).setSubText(status).setCategory(NotificationCompat.CATEGORY_CALL).setPriority(NotificationCompat.PRIORITY_HIGH).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(openIntent).setWhen(if (connectTimeMillis > 0L) connectTimeMillis else System.currentTimeMillis()).setUsesChronometer(state == "ACTIVE" || state == "HOLDING").setStyle(NotificationCompat.BigTextStyle().bigText(detail + if (state == "ACTIVE" || state == "HOLDING") "\nCall controls are available when you return to VigilShield." else "")).addAction(0, "End call", end), context)
        if (Build.VERSION.SDK_INT >= 31) builder.setStyle(NotificationCompat.CallStyle.forOngoingCall(person, end))
        manager.notify(callId.hashCode(), builder.build())
    }

    fun showCallEnded(context: Context) {}

    fun showSecurityWarning(context: Context, name: String, risk: String, spoofRisk: String, explanation: String) {
        if (!notificationsEnabled(context)) return
        ensureChannel(context)
        val title = when (risk) { "HIGH_RISK" -> "High-risk call pattern detected"; "SUSPICIOUS" -> "Suspicious call pattern"; else -> "Caller safety warning" }
        val identityText = if (privacyMode(context)) "Private caller" else identity(context, name, "")
        val text = if (privacyMode(context)) "Review this call before sharing sensitive information" else "$identityText · Spoof risk: $spoofRisk"
        val openIntent = PendingIntent.getActivity(context, (name + risk).hashCode(), Intent(context, MainActivity::class.java).apply { putExtra("open_tab", "recents"); addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP) }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val body = "$explanation Caller ID is not proof of identity. Never share OTPs, PINs or passwords."
        val notification = applyPrivacy(NotificationCompat.Builder(context, SECURITY_CHANNEL_ID).setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield).setContentTitle(title).setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(body)).setCategory(NotificationCompat.CATEGORY_STATUS).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(openIntent), context).build()
        context.getSystemService(NotificationManager::class.java).notify((name + risk + spoofRisk).hashCode(), notification)
    }

    fun showRepeatedCallAttention(context: Context, name: String, number: String) {
        if (!notificationsEnabled(context)) return
        ensureChannel(context)
        val identityText = if (privacyMode(context)) "The same caller" else identity(context, name, number)
        val detail = if (privacyMode(context)) "" else if (detailedNotifications(context) && number.isNotBlank()) " · $number" else ""
        val openIntent = PendingIntent.getActivity(context, REPEATED_ID, Intent(context, MainActivity::class.java).putExtra("open_tab", "recents").putExtra("search_number", number).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val text = if (privacyMode(context)) "A caller contacted you repeatedly within 10 minutes" else "$identityText$detail called again within 10 minutes"
        val body = if (privacyMode(context)) "A caller called again within 10 minutes. If you were expecting the call, review it from Recents." else "$identityText called again within 10 minutes. If you were expecting this call, you can return it from Recents. If not, review the caller before calling back."
        val notification = applyPrivacy(NotificationCompat.Builder(context, SECURITY_CHANNEL_ID).setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield).setContentTitle("Repeated call needs your attention").setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(body)).setCategory(NotificationCompat.CATEGORY_STATUS).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(openIntent), context).build()
        context.getSystemService(NotificationManager::class.java).notify(REPEATED_ID, notification)
    }

    fun clearCall(context: Context, callId: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(INCOMING_CALL_ID)
        manager.cancel(callId.hashCode())
        activeNotificationIds.remove(callId.hashCode())
        activeNotificationIds.remove(INCOMING_CALL_ID)
    }

    fun clearAllCallNotifications(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(INCOMING_CALL_ID)
        manager.cancel(ENDED_ID)
        val copy = synchronized(activeNotificationIds) { activeNotificationIds.toList() }
        for (id in copy) manager.cancel(id)
        activeNotificationIds.clear()
    }
}

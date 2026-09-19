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
    private const val ONGOING_CALL_ID = 4104
    private const val PREFS = "vigilshield"
    private val activeNotificationIds = java.util.Collections.synchronizedSet(mutableSetOf<Int>())

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Incoming, ongoing and missed call alerts"
                enableVibration(true)
                setSound(null, null)
                lightColor = Color.BLUE
                setShowBadge(true)
                lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
                setBypassDnd(true)
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
    private fun privateLockScreen(context: Context): Boolean = prefs(context).getBoolean("security_privacy_lock_screen", false) || privacyMode(context)

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
        putExtra("is_incoming_call", true)
        putExtra("open_tab", "incoming")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

    private fun ongoingCallActivityIntent(context: Context, callId: String, name: String, number: String): Intent = Intent(context, MainActivity::class.java).apply {
        action = "com.vigilshield.telecom.OPEN_OUTGOING_CALL"
        putExtra("open_call_id", callId)
        putExtra("open_call_number", number)
        putExtra("open_call_name", name)
        putExtra("is_incoming_call", false)
        putExtra("open_tab", "dialer")
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    }

    fun showMissedCall(context: Context, name: String, number: String) {
        if (!callAlertsEnabled(context)) return
        ensureChannel(context)
        val openIntent = PendingIntent.getActivity(context, MISSED_ID, Intent(context, MainActivity::class.java).apply {
            action = "com.vigilshield.telecom.OPEN_MISSED_CALL"
            putExtra("open_tab", "recents")
            putExtra("search_number", number)
            putExtra("open_call_number", number)
            putExtra("open_call_name", name)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        }, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val display = identityWithNumber(context, name, number)
        val detail = if (privacyMode(context)) "Missed call: $number" else "Missed call from $display"
        val callBackIntent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(number)}"))
        val callBackPendingIntent = PendingIntent.getActivity(context, (number + "callback").hashCode(), callBackIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val builder = NotificationCompat.Builder(context, CHANNEL_ID).setSmallIcon(com.vigilshield.telecom.R.drawable.ic_callshield).setContentTitle("Missed call").setContentText(if (name.isNotBlank() && name != number) "$name · $number" else number).setCategory(NotificationCompat.CATEGORY_MISSED_CALL).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(openIntent).addAction(0, "Call back", callBackPendingIntent).setStyle(NotificationCompat.BigTextStyle().bigText(detail))
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
        val display = identityWithNumber(context, name, number)
        val person = Person.Builder().setName(display).setImportant(true).build()
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_callshield)
            .setContentTitle(display)
            .setContentText(number)
            .setContentIntent(openIntent)
            .setDeleteIntent(dismiss)
            .setAutoCancel(false)
            .setOngoing(true)
            .setTimeoutAfter(60_000L)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setFullScreenIntent(openIntent, !MainActivity.isAppVisible)
        if (Build.VERSION.SDK_INT >= 31) builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer))
        else builder.setContentTitle(display).setContentText("Incoming call").addAction(0, "Decline", decline).addAction(0, "Answer", answer)
        val notif = builder.build()
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.notify(notifId, notif)
        manager.notify(callId.hashCode(), notif)
    }

    fun showOngoingCall(context: Context, callId: String, name: String, number: String, state: String, connectTimeMillis: Long, riskLevel: String? = null) {
        // Ongoing call status is a core phone-function notification, not an optional
        // security alert. Keep it visible even when security-call alerts are disabled.
        ensureChannel(context)
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(INCOMING_CALL_ID)
        activeNotificationIds.remove(INCOMING_CALL_ID)
        activeNotificationIds.add(callId.hashCode())
        val display = identity(context, name, number)
        val numberDetail = if (privacyMode(context)) "" else number.takeIf { it.isNotBlank() } ?: ""
        val openIntent = PendingIntent.getActivity(context, callId.hashCode(), callActivityIntent(context, callId, name, number), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val end = PendingIntent.getBroadcast(context, callId.hashCode() + 3, Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_END).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId).putExtra(CallActionReceiver.EXTRA_CALL_NUMBER, number), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val status = when (state) { "ACTIVE" -> "Ongoing call"; "HOLDING" -> "Call on hold"; "DIALING" -> "Calling…"; "CONNECTING" -> "Connecting…"; else -> "Call in progress" }
        val riskText = when (riskLevel) { "HIGH_RISK" -> " · High risk"; "SUSPICIOUS" -> " · Suspicious"; else -> "" }
        val detail = if (privacyMode(context)) "$status$riskText · Tap to return to call" else buildString {
            append(display)
            if (numberDetail.isNotBlank() && numberDetail != display) append(" · ").append(numberDetail)
            append(riskText).append(" · ").append(status).append(" · Tap to return to call")
        }
        val person = Person.Builder().setName(display).setImportant(true).build()
        val builder = applyPrivacy(NotificationCompat.Builder(context, CHANNEL_ID).setSmallIcon(com.vigilshield.telecom.R.drawable.ic_callshield).setContentTitle(display).setContentText(detail).setSubText(status).setCategory(NotificationCompat.CATEGORY_CALL).setPriority(NotificationCompat.PRIORITY_HIGH).setOngoing(true).setOnlyAlertOnce(true).setContentIntent(openIntent).setWhen(if (connectTimeMillis > 0L) connectTimeMillis else System.currentTimeMillis()).setUsesChronometer(state == "ACTIVE" || state == "HOLDING").setStyle(NotificationCompat.BigTextStyle().bigText(detail + if (state == "ACTIVE" || state == "HOLDING") "\nCall controls are available when you return to CallShield." else "")).addAction(0, "End call", end), context)
        if (Build.VERSION.SDK_INT >= 31) builder.setStyle(NotificationCompat.CallStyle.forOngoingCall(person, end))
        val ongoingNotification = builder.build()
        manager.notify(ONGOING_CALL_ID, ongoingNotification)
        manager.notify(callId.hashCode(), ongoingNotification)
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
        val notification = applyPrivacy(NotificationCompat.Builder(context, SECURITY_CHANNEL_ID).setSmallIcon(com.vigilshield.telecom.R.drawable.ic_callshield).setContentTitle(title).setContentText(text).setStyle(NotificationCompat.BigTextStyle().bigText(body)).setCategory(NotificationCompat.CATEGORY_STATUS).setPriority(NotificationCompat.PRIORITY_HIGH).setAutoCancel(true).setContentIntent(openIntent), context).build()
        context.getSystemService(NotificationManager::class.java).notify((name + risk + spoofRisk).hashCode(), notification)
    }

    fun showRepeatedCallAttention(context: Context, name: String, number: String, callCount: Int) {
        if (!notificationsEnabled(context)) return
        ensureChannel(context)
        // Repeated-call alerts should immediately show who is calling and how many times.
        val callerLabel = when {
            name.isNotBlank() && name != number -> name
            number.isNotBlank() -> number
            else -> "Unknown caller"
        }
        val openIntent = PendingIntent.getActivity(context, REPEATED_ID, Intent(context, MainActivity::class.java).putExtra("open_tab", "recents").putExtra("search_number", number).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val callbackIntent = PendingIntent.getActivity(context, (REPEATED_ID.toString() + number + "callback").hashCode(), Intent(Intent.ACTION_DIAL, Uri.parse("tel:${Uri.encode(number)}")), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val countLabel = if (callCount == 1) "1 time" else "$callCount times"
        val text = "$callerLabel called $countLabel in the last 10 minutes"
        val body = if (number.isNotBlank() && callerLabel != number) {
            "$callerLabel called $countLabel in the last 10 minutes.\n$number"
        } else {
            text
        }
        val notification = applyPrivacy(
            NotificationCompat.Builder(context, SECURITY_CHANNEL_ID)
                .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_callshield)
                .setContentTitle(callerLabel)
                .setContentText(text)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setCategory(NotificationCompat.CATEGORY_STATUS)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(openIntent)
                .addAction(0, "Call back", callbackIntent),
            context
        ).build()
        context.getSystemService(NotificationManager::class.java).notify(REPEATED_ID, notification)
    }

    fun clearCall(context: Context, callId: String) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(INCOMING_CALL_ID)
        manager.cancel(ONGOING_CALL_ID)
        manager.cancel(callId.hashCode())
        activeNotificationIds.remove(callId.hashCode())
        activeNotificationIds.remove(INCOMING_CALL_ID)
        activeNotificationIds.remove(ONGOING_CALL_ID)
    }

    fun clearAllCallNotifications(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.cancel(INCOMING_CALL_ID)
        manager.cancel(ONGOING_CALL_ID)
        manager.cancel(ENDED_ID)
        val copy = synchronized(activeNotificationIds) { activeNotificationIds.toList() }
        for (id in copy) manager.cancel(id)
        activeNotificationIds.clear()
    }
}

package com.vigilshield.telecom

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import org.json.JSONArray

/** Privacy-first escalation for unusually frequent calls from saved contacts. */
object EmergencyRepeatCallPolicy {
    private const val PREFS = "vigilshield"
    private const val EVENTS_KEY = "emergency_repeat_events"
    private const val CHANNEL_ID = "vigilshield_emergency_repeat"
    private const val NOTIFICATION_ID = 49021
    private var alertRingtone: Ringtone? = null

    data class Result(val triggered: Boolean, val count: Int, val windowMinutes: Int)

    fun onTrustedIncomingCall(context: Context, number: String): Result {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("emergency_repeat_enabled", true) || number.isBlank()) return Result(false, 0, configuredWindow(prefs))
        val threshold = configuredThreshold(prefs)
        val windowMinutes = configuredWindow(prefs)
        val now = System.currentTimeMillis()
        val cutoff = now - windowMinutes * 60_000L
        val normalized = normalize(number)
        if (normalized.isBlank()) return Result(false, 0, windowMinutes)

        val all = readEvents(prefs)
        val current = all.filter { it.number == normalized && it.timestamp >= cutoff }.toMutableList()
        current += Event(normalized, now)
        val retained = current + all.filter { it.number != normalized && it.timestamp >= cutoff }
        writeEvents(prefs, retained)

        val triggered = current.size >= threshold
        if (triggered) escalate(context, number, current.size, windowMinutes)
        return Result(triggered, current.size, windowMinutes)
    }

    private fun escalate(context: Context, number: String, count: Int, windowMinutes: Int) {
        val screenOff = context.getSystemService(PowerManager::class.java)?.isInteractive == false
        val audio = context.getSystemService(AudioManager::class.java)
        // Only override SILENT when the display is off, and never change the global ringer mode.
        if (screenOff && audio?.ringerMode == AudioManager.RINGER_MODE_SILENT) playShortEmergencyAlert(context)
        showEmergencyNotification(context, number, count, windowMinutes)
    }

    private fun playShortEmergencyAlert(context: Context) {
        runCatching {
            alertRingtone?.stop()
            val uri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
            alertRingtone = RingtoneManager.getRingtone(context.applicationContext, uri)
            alertRingtone?.audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            alertRingtone?.play()
            android.os.Handler(android.os.Looper.getMainLooper()).postDelayed({ runCatching { alertRingtone?.stop() } }, 8_000L)
        }
    }

    private fun showEmergencyNotification(context: Context, number: String, count: Int, windowMinutes: Int) {
        createChannel(context)
        val privacy = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean("privacy_mode", true)
        val text = if (privacy) "A saved contact has called $count times in $windowMinutes minutes." else "$number: $count calls in $windowMinutes minutes."
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_alert)
            .setContentTitle("Repeated call needs your attention")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText("This saved contact is calling repeatedly in a short period. Review the call before deciding whether it needs attention."))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setAutoCancel(true)
            .setVisibility(if (privacy) NotificationCompat.VISIBILITY_PRIVATE else NotificationCompat.VISIBILITY_PUBLIC)
            .build()
        context.getSystemService(NotificationManager::class.java)?.notify(NOTIFICATION_ID, notification)
    }

    private fun createChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(CHANNEL_ID, "Repeated-call alerts", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Alerts when a saved contact calls repeatedly in a short period."
                setSound(null, null)
                lockscreenVisibility = NotificationCompat.VISIBILITY_PRIVATE
            }
            manager.createNotificationChannel(channel)
        }
    }

    private data class Event(val number: String, val timestamp: Long)

    private fun readEvents(prefs: android.content.SharedPreferences): List<Event> = runCatching {
        val array = JSONArray(prefs.getString(EVENTS_KEY, "[]") ?: "[]")
        buildList {
            for (i in 0 until array.length()) {
                val item = array.optJSONObject(i) ?: continue
                val number = item.optString("number")
                val timestamp = item.optLong("timestamp")
                if (number.isNotBlank() && timestamp > 0) add(Event(number, timestamp))
            }
        }
    }.getOrDefault(emptyList())

    private fun writeEvents(prefs: android.content.SharedPreferences, events: List<Event>) {
        val array = JSONArray()
        events.takeLast(200).forEach { array.put(org.json.JSONObject().put("number", it.number).put("timestamp", it.timestamp)) }
        prefs.edit().putString(EVENTS_KEY, array.toString()).apply()
    }

    private fun configuredThreshold(prefs: android.content.SharedPreferences): Int = when {
        prefs.getBoolean("emergency_repeat_threshold_5", false) -> 5
        prefs.getBoolean("emergency_repeat_threshold_4", false) -> 4
        else -> 3
    }

    private fun configuredWindow(prefs: android.content.SharedPreferences): Int = when {
        prefs.getBoolean("emergency_repeat_window_10", false) -> 10
        prefs.getBoolean("emergency_repeat_window_3", false) -> 3
        else -> 5
    }

    private fun normalize(value: String): String = value.filter { it.isDigit() }
}

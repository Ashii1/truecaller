package com.vigilshield.telecom

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/** Local repeated-call attention signal. It never blocks a caller by itself. */
object RepeatedCallAttentionPolicy {
    private const val PREFS = "vigilshield"
    private const val EVENTS_KEY = "phase3_repeated_call_events"
    private const val WINDOW_MS = 10 * 60 * 1000L
    private const val THRESHOLD = 2
    private const val MAX_EVENTS = 200

    fun onIncomingCall(context: Context, number: String, displayName: String, trusted: Boolean) {
        if (trusted || number.isBlank()) return
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        if (!prefs.getBoolean("phase3_repeated_call_attention_enabled", true)) return
        val now = System.currentTimeMillis()
        val normalized = normalize(number)
        if (normalized.isEmpty()) return

        val events = try { JSONArray(prefs.getString(EVENTS_KEY, "[]") ?: "[]") } catch (_: Exception) { JSONArray() }
        val recent = ArrayList<Long>()
        for (i in 0 until events.length()) {
            val item = events.optJSONObject(i) ?: continue
            val saved = normalize(item.optString("number"))
            val timestamp = item.optLong("timestamp", 0L)
            if (now - timestamp in 0..WINDOW_MS) {
                if (saved == normalized || saved.endsWith(normalized) || normalized.endsWith(saved)) recent.add(timestamp)
            }
        }
        val updated = JSONArray()
        for (i in maxOf(0, events.length() - MAX_EVENTS + 1) until events.length()) updated.put(events.opt(i))
        updated.put(JSONObject().put("number", normalized).put("timestamp", now))
        prefs.edit().putString(EVENTS_KEY, updated.toString()).apply()

        if (recent.size + 1 >= THRESHOLD) {
            val privacy = prefs.getBoolean("privacy_mode", false)
            val name = if (!privacy && displayName.isNotBlank()) displayName else "Unknown caller"
            CallNotificationHelper.showRepeatedCallAttention(context, name, if (privacy) "" else number, recent.size + 1)
        }
    }

    private fun normalize(value: String): String = value.filter { it.isDigit() }
}

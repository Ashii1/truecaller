package com.vigilshield.telecom

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.telecom.Call
import androidx.core.app.NotificationCompat

object CallNotificationHelper {
    private const val CHANNEL_ID = "calls"
    private const val MISSED_ID = 4101

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < 26) return
        val manager = context.getSystemService(NotificationManager::class.java)
        if (manager.getNotificationChannel(CHANNEL_ID) == null) {
            val channel = NotificationChannel(CHANNEL_ID, "Calls", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Incoming, ongoing and missed call alerts"
                enableVibration(false)
                setSound(null, null)
                lightColor = Color.BLUE
            }
            manager.createNotificationChannel(channel)
        }
    }

    fun showMissedCall(context: Context, name: String, number: String) {
        ensureChannel(context)
        val openIntent = PendingIntent.getActivity(
            context,
            MISSED_ID,
            Intent(context, MainActivity::class.java).apply {
                putExtra("open_tab", "recents")
                putExtra("search_number", number)
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentTitle("Missed call")
            .setContentText(if (name.isBlank() || name == number) number else "$name · $number")
            .setCategory(NotificationCompat.CATEGORY_MISSED_CALL)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText("You missed a call from ${if (name.isBlank()) number else name}. Tap to open Recents."))
            .build()
        context.getSystemService(NotificationManager::class.java).notify(MISSED_ID, notification)
    }

    fun showIncomingCall(context: Context, callId: String, name: String, number: String) {
        ensureChannel(context)
        val openIntent = PendingIntent.getActivity(
            context,
            callId.hashCode(),
            Intent(context, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val answer = PendingIntent.getBroadcast(
            context,
            callId.hashCode() + 1,
            Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_ANSWER).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val decline = PendingIntent.getBroadcast(
            context,
            callId.hashCode() + 2,
            Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.ACTION_DECLINE).putExtra(CallActionReceiver.EXTRA_CALL_ID, callId),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val person = android.app.Person.Builder().setName(if (name.isBlank()) number else name).setImportant(true).build()
        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(com.vigilshield.telecom.R.drawable.ic_vigilshield)
            .setContentIntent(openIntent)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
        if (Build.VERSION.SDK_INT >= 31) {
            builder.setStyle(NotificationCompat.CallStyle.forIncomingCall(person, decline, answer))
        } else {
            builder.setContentTitle(if (name.isBlank()) number else name).setContentText("Incoming call").addAction(0, "Decline", decline).addAction(0, "Answer", answer)
        }
        context.getSystemService(NotificationManager::class.java).notify(callId.hashCode(), builder.build())
    }

    fun clearCall(context: Context, callId: String) {
        context.getSystemService(NotificationManager::class.java).cancel(callId.hashCode())
    }
}

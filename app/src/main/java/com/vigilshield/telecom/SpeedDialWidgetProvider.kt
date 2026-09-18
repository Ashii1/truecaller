package com.vigilshield.telecom

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

class SpeedDialWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        private const val PREFS_NAME = "vigilshield_widget_prefs"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, SpeedDialWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (id in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, id)
            }
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_speed_dial)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            // Header: Open Dialer
            val dialerIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_MAIN
                putExtra("open_tab", "dialer")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val dialerPendingIntent = PendingIntent.getActivity(
                context, 100, dialerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_open_dialer, dialerPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_title, dialerPendingIntent)

            // Contact 1
            val name1 = prefs.getString("speed_dial_1_name", "Mom") ?: "Mom"
            val num1 = prefs.getString("speed_dial_1_num", "") ?: ""
            views.setTextViewText(R.id.slot_name_1, name1)
            views.setTextViewText(R.id.slot_avatar_1, name1.take(1).uppercase())
            views.setOnClickPendingIntent(R.id.slot_contact_1, createCallPendingIntent(context, 101, num1, name1))

            // Contact 2
            val name2 = prefs.getString("speed_dial_2_name", "Work") ?: "Work"
            val num2 = prefs.getString("speed_dial_2_num", "") ?: ""
            views.setTextViewText(R.id.slot_name_2, name2)
            views.setTextViewText(R.id.slot_avatar_2, name2.take(1).uppercase())
            views.setOnClickPendingIntent(R.id.slot_contact_2, createCallPendingIntent(context, 102, num2, name2))

            // Contact 3 (Emergency)
            val name3 = prefs.getString("speed_dial_3_name", "Emergency") ?: "Emergency"
            val num3 = prefs.getString("speed_dial_3_num", "911") ?: "911"
            views.setTextViewText(R.id.slot_name_3, name3)
            views.setTextViewText(R.id.slot_avatar_3, "SOS")
            views.setOnClickPendingIntent(R.id.slot_contact_3, createCallPendingIntent(context, 103, num3, name3))

            // Contact 4 (Voicemail / Quick Private Call)
            val name4 = prefs.getString("speed_dial_4_name", "Voicemail") ?: "Voicemail"
            val num4 = prefs.getString("speed_dial_4_num", "*86") ?: "*86"
            views.setTextViewText(R.id.slot_name_4, name4)
            views.setTextViewText(R.id.slot_avatar_4, "VM")
            views.setOnClickPendingIntent(R.id.slot_contact_4, createCallPendingIntent(context, 104, num4, name4))

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        private fun createCallPendingIntent(context: Context, reqCode: Int, number: String, name: String): PendingIntent {
            val intent = if (number.isNotBlank()) {
                Intent(context, MainActivity::class.java).apply {
                    action = Intent.ACTION_CALL
                    data = Uri.parse("tel:" + Uri.encode(number))
                    putExtra("open_call_number", number)
                    putExtra("open_call_name", name)
                    putExtra("open_tab", "dialer")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
            } else {
                Intent(context, MainActivity::class.java).apply {
                    action = Intent.ACTION_MAIN
                    putExtra("open_tab", "contacts")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                }
            }
            return PendingIntent.getActivity(
                context, reqCode, intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}

package com.vigilshield.telecom

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/**
 * Phone-style CallShield launcher widget.
 * The widget is intentionally limited to the two primary phone surfaces:
 * Recents and Dialer. It never launches a contact/speed-dial flow.
 */
class SpeedDialWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        appWidgetIds.forEach { updateAppWidget(context, appWidgetManager, it) }
    }

    companion object {
        fun updateAllWidgets(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, SpeedDialWidgetProvider::class.java)
            manager.getAppWidgetIds(component).forEach { updateAppWidget(context, manager, it) }
        }

        fun updateAppWidget(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_speed_dial)
            views.setOnClickPendingIntent(R.id.widget_phone_icon, createSurfacePendingIntent(context, 203, "recents"))
            manager.updateAppWidget(appWidgetId, views)
        }

        private fun createSurfacePendingIntent(context: Context, requestCode: Int, tab: String): PendingIntent {
            val intent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_MAIN
                putExtra("open_tab", tab)
                putExtra("phone_surface", true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            return PendingIntent.getActivity(
                context,
                requestCode,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
        }
    }
}

package com.vigilshield.telecom

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

class SecurityWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        private const val PREFS_NAME = "vigilshield_widget_prefs"

        fun updateAllWidgets(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val componentName = ComponentName(context, SecurityWidgetProvider::class.java)
            val appWidgetIds = appWidgetManager.getAppWidgetIds(componentName)
            for (id in appWidgetIds) {
                updateAppWidget(context, appWidgetManager, id)
            }
        }

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val views = RemoteViews(context.packageName, R.layout.widget_security_status)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

            val isShieldOn = prefs.getBoolean("shield_master_enabled", true)
            val spamCount = prefs.getInt("spam_blocked_count", 14)

            views.setTextViewText(
                R.id.widget_security_badge,
                if (isShieldOn) "SHIELD ACTIVE • PROTECTED" else "SHIELD PAUSED"
            )
            views.setTextColor(
                R.id.widget_security_badge,
                if (isShieldOn) 0xFF34D399.toInt() else 0xFFF59E0B.toInt()
            )

            views.setTextViewText(
                R.id.widget_security_stats,
                if (isShieldOn) "$spamCount spam calls shielded" else "Tap to activate protection"
            )

            // Button: Open Dialer
            val dialerIntent = Intent(context, MainActivity::class.java).apply {
                action = Intent.ACTION_MAIN
                putExtra("open_tab", "dialer")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            }
            val dialerPendingIntent = PendingIntent.getActivity(
                context, 201, dialerIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.btn_widget_action, dialerPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_security_root, dialerPendingIntent)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}

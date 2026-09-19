package com.vigilshield.telecom

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import android.util.Log

/**
 * CallRingerHelper manages incoming call ringing and vibration behavior.
 * Strictly honors device ringer modes:
 * - RINGER_MODE_NORMAL: Plays the user's selected system ringtone and vibrates if vibrate-on-ring is on.
 * - RINGER_MODE_VIBRATE: Does not play sound; triggers rhythmic haptic vibration.
 * - RINGER_MODE_SILENT: Stays completely silent without sound or vibration.
 */
object CallRingerHelper {
    private const val TAG = "CallShieldRinger"
    private var activeRingtone: Ringtone? = null
    private var isRingingActive = false
    private var isSilenced = false

    private val VIBRATE_PATTERN = longArrayOf(0, 1000, 1000)

    @Synchronized
    fun startRinging(context: Context) {
        val appContext = context.applicationContext
        val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return
        val ringerMode = audioManager.ringerMode

        Log.i(TAG, "startRinging requested. Current ringer mode: $ringerMode")
        isSilenced = false

        when (ringerMode) {
            AudioManager.RINGER_MODE_SILENT -> {
                Log.i(TAG, "Device is in SILENT mode. Suppressing ringtone and vibration.")
                stopRinging(appContext)
            }
            AudioManager.RINGER_MODE_VIBRATE -> {
                Log.i(TAG, "Device is in VIBRATE mode. Starting haptic vibration pattern only.")
                stopRingtoneSoundOnly()
                startVibration(appContext)
                isRingingActive = true
            }
            AudioManager.RINGER_MODE_NORMAL -> {
                Log.i(TAG, "Device is in NORMAL mode. Playing user system ringtone.")
                startRingtoneSound(appContext)
                
                val shouldVibrate = shouldVibrateWhenRinging(appContext, audioManager)
                if (shouldVibrate) {
                    startVibration(appContext)
                } else {
                    stopVibration(appContext)
                }
                isRingingActive = true
            }
        }
    }

    private fun startRingtoneSound(context: Context) {
        try {
            if (activeRingtone != null && activeRingtone?.isPlaying == true) {
                return
            }
            stopRingtoneSoundOnly()

            val ringtoneUri = RingtoneManager.getActualDefaultRingtoneUri(context, RingtoneManager.TYPE_RINGTONE)
                ?: Settings.System.DEFAULT_RINGTONE_URI

            val ringtone = RingtoneManager.getRingtone(context, ringtoneUri) ?: return
            
            val audioAttributes = AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build()

            ringtone.audioAttributes = audioAttributes

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                ringtone.isLooping = true
            }

            ringtone.play()
            activeRingtone = ringtone
            Log.i(TAG, "System ringtone playing successfully with URI: $ringtoneUri")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to play default system ringtone: ${e.message}", e)
        }
    }

    private fun startVibration(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                val vibrator = vibratorManager?.defaultVibrator
                val effect = VibrationEffect.createWaveform(VIBRATE_PATTERN, 0)
                val attributes = AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build()
                vibrator?.vibrate(effect, attributes)
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    val effect = VibrationEffect.createWaveform(VIBRATE_PATTERN, 0)
                    vibrator?.vibrate(effect)
                } else {
                    @Suppress("DEPRECATION")
                    vibrator?.vibrate(VIBRATE_PATTERN, 0)
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Vibrator trigger failed: ${e.message}")
        }
    }

    private fun shouldVibrateWhenRinging(context: Context, audioManager: AudioManager): Boolean {
        return try {
            val vibrateWhenRinging = Settings.System.getInt(context.contentResolver, "vibrate_when_ringing", 1)
            vibrateWhenRinging != 0
        } catch (e: Exception) {
            true
        }
    }

    private fun stopRingtoneSoundOnly() {
        try {
            activeRingtone?.let {
                if (it.isPlaying) {
                    it.stop()
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error stopping ringtone sound: ${e.message}")
        } finally {
            activeRingtone = null
        }
    }

    private fun stopVibration(context: Context) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vibratorManager = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as? VibratorManager
                vibratorManager?.defaultVibrator?.cancel()
            } else {
                @Suppress("DEPRECATION")
                val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator
                vibrator?.cancel()
            }
        } catch (e: Exception) {
            Log.w(TAG, "Error cancelling vibration: ${e.message}")
        }
    }

    /**
     * Silences the ringer immediately without declining the call (e.g. volume key pressed).
     */
    @Synchronized
    fun silenceRinger(context: Context) {
        Log.i(TAG, "silenceRinger invoked: muting sound and vibration.")
        isSilenced = true
        stopRingtoneSoundOnly()
        stopVibration(context.applicationContext)
    }

    /**
     * Completely stops ringing and cancels vibration (call answered, rejected, or disconnected).
     */
    @Synchronized
    fun stopRinging(context: Context) {
        Log.i(TAG, "stopRinging invoked: cleaning up audio and vibration.")
        isRingingActive = false
        isSilenced = false
        stopRingtoneSoundOnly()
        stopVibration(context.applicationContext)
    }

    fun isRinging(): Boolean = isRingingActive && !isSilenced
}

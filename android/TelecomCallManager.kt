package com.vigilshield.telecom

import android.Manifest
import android.app.Activity
import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.telecom.PhoneAccount
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

/**
 * Android Telecom Subsystem Manager for VigilShield.
 * 
 * Handles:
 * - Default Dialer Role verification & official RoleManager enrollment
 * - Hardware PhoneAccount & Dual SIM enumeration
 * - Outgoing cellular call placement via TelecomManager
 * - Device telephony states (SIM readiness, Airplane mode, cellular connectivity)
 */
class TelecomCallManager(private val context: Context) {

    companion object {
        private const val TAG = "TelecomCallManager"
        const val REQUEST_CODE_SET_DEFAULT_DIALER = 2001
    }

    private val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
    private val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as? TelephonyManager
    private val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
    private val roleManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        context.getSystemService(Context.ROLE_SERVICE) as? RoleManager
    } else {
        null
    }

    // 1. DEFAULT PHONE APP ROLE DETECTION
    fun isDefaultDialer(): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && roleManager != null) {
            val isHeld = roleManager.isRoleHeld(RoleManager.ROLE_DIALER)
            Log.d(TAG, "RoleManager isRoleHeld(ROLE_DIALER): $isHeld")
            return isHeld
        }
        val defaultPackage = telecomManager?.defaultDialerPackage
        val matches = defaultPackage == context.packageName
        Log.d(TAG, "TelecomManager defaultDialerPackage: $defaultPackage, matches: $matches")
        return matches
    }

    fun isDialerRoleAvailable(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && roleManager != null) {
            roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)
        } else {
            true
        }
    }

    fun requestDefaultDialerRole(activity: Activity): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && roleManager != null) {
                if (roleManager.isRoleAvailable(RoleManager.ROLE_DIALER)) {
                    val intent = roleManager.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                    activity.startActivityForResult(intent, REQUEST_CODE_SET_DEFAULT_DIALER)
                    true
                } else {
                    Log.w(TAG, "ROLE_DIALER is not available on this device")
                    false
                }
            } else {
                val intent = Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                    putExtra(TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME, context.packageName)
                }
                activity.startActivityForResult(intent, REQUEST_CODE_SET_DEFAULT_DIALER)
                true
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to initiate default dialer role request", e)
            false
        }
    }

    // 2. DUAL SIM & PHONE ACCOUNTS ENUMERATION
    fun getAvailablePhoneAccounts(): List<PhoneAccountDto> {
        val accounts = mutableListOf<PhoneAccountDto>()
        
        // Query SubscriptionManager if permission granted
        val hasPhoneStatePerm = ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_PHONE_STATE
        ) == PackageManager.PERMISSION_GRANTED

        var activeSubs: List<SubscriptionInfo>? = null
        if (hasPhoneStatePerm && subscriptionManager != null) {
            try {
                activeSubs = subscriptionManager.activeSubscriptionInfoList
            } catch (e: SecurityException) {
                Log.w(TAG, "SecurityException reading activeSubscriptionInfoList: ${e.message}")
            }
        }

        if (telecomManager != null && hasPhoneStatePerm) {
            try {
                val handles = telecomManager.callCapablePhoneAccounts
                for (handle in handles) {
                    val account: PhoneAccount? = telecomManager.getPhoneAccount(handle)
                    val label = account?.label?.toString() ?: "Cellular SIM"
                    val subId = handle.id
                    val matchingSub = activeSubs?.find { it.subscriptionId.toString() == subId }
                    val slotIndex = matchingSub?.simSlotIndex ?: (accounts.size)
                    val carrierName = matchingSub?.carrierName?.toString() ?: account?.shortDescription?.toString() ?: "Carrier"

                    accounts.add(
                        PhoneAccountDto(
                            id = handle.id,
                            handlePackage = handle.componentName.packageName,
                            handleClassName = handle.componentName.className,
                            label = label,
                            carrierName = carrierName,
                            slotIndex = slotIndex,
                            displayName = "SIM ${slotIndex + 1} ($carrierName)",
                            isDefault = accounts.isEmpty()
                        )
                    )
                }
            } catch (e: SecurityException) {
                Log.w(TAG, "SecurityException reading callCapablePhoneAccounts: ${e.message}")
            }
        }

        // If no telecom handles found or no permissions yet, fallback to active subscription list
        if (accounts.isEmpty() && activeSubs != null && activeSubs.isNotEmpty()) {
            for (sub in activeSubs) {
                val slot = sub.simSlotIndex
                val carrier = sub.carrierName?.toString() ?: "Cellular"
                accounts.add(
                    PhoneAccountDto(
                        id = sub.subscriptionId.toString(),
                        handlePackage = context.packageName,
                        handleClassName = "",
                        label = sub.displayName?.toString() ?: "SIM ${slot + 1}",
                        carrierName = carrier,
                        slotIndex = slot,
                        displayName = "SIM ${slot + 1} ($carrier)",
                        isDefault = slot == 0
                    )
                )
            }
        }

        return accounts
    }

    data class PhoneAccountDto(
        val id: String,
        val handlePackage: String,
        val handleClassName: String,
        val label: String,
        val carrierName: String,
        val slotIndex: Int,
        val displayName: String,
        val isDefault: Boolean
    ) {
        fun toJson(): JSONObject {
            return JSONObject().apply {
                put("id", id)
                put("label", label)
                put("carrierName", carrierName)
                put("slotIndex", slotIndex)
                put("displayName", displayName)
                put("isDefault", isDefault)
            }
        }
    }

    // 3. TELEPHONY & SYSTEM STATES
    fun isAirplaneModeOn(): Boolean {
        return Settings.Global.getInt(
            context.contentResolver,
            Settings.Global.AIRPLANE_MODE_ON, 0
        ) != 0
    }

    fun isSimReady(): Boolean {
        return telephonyManager?.simState == TelephonyManager.SIM_STATE_READY
    }

    fun getTelephonyStatus(): JSONObject {
        val hasSim = telephonyManager?.simState == TelephonyManager.SIM_STATE_READY
        val isAirplane = isAirplaneModeOn()
        val networkType = telephonyManager?.networkType ?: TelephonyManager.NETWORK_TYPE_UNKNOWN
        val isNetworkAvailable = hasSim && !isAirplane && networkType != TelephonyManager.NETWORK_TYPE_UNKNOWN

        return JSONObject().apply {
            put("hasSim", hasSim)
            put("simState", telephonyManager?.simState ?: 0)
            put("isAirplaneMode", isAirplane)
            put("isNetworkAvailable", isNetworkAvailable)
            put("networkOperatorName", telephonyManager?.networkOperatorName ?: "Unknown")
            put("simCarrierIdName", telephonyManager?.simCarrierIdName ?: "Unknown")
            put("isDefaultDialer", isDefaultDialer())
            put("isDialerRoleAvailable", isDialerRoleAvailable())
        }
    }

    // 4. REAL OUTGOING CELLULAR CALL PLACEMENT
    fun placeRealCall(number: String, preferredAccountHandleId: String? = null): CallResult {
        // Validation checks
        val sanitizedNumber = number.trim()
        if (sanitizedNumber.isBlank()) {
            return CallResult(false, "Phone number cannot be empty")
        }

        val dialableDigits = sanitizedNumber.filter { it.isDigit() || it == '+' || it == '*' || it == '#' }
        if (dialableDigits.length < 3) {
            return CallResult(false, "Phone number is too short to dial")
        }

        if (isAirplaneModeOn()) {
            return CallResult(false, "Airplane mode prevents cellular calls")
        }

        if (telephonyManager?.simState == TelephonyManager.SIM_STATE_ABSENT) {
            return CallResult(false, "No SIM available. Please insert a valid SIM card")
        }

        val hasCallPhonePerm = ContextCompat.checkSelfPermission(
            context, Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        if (!hasCallPhonePerm) {
            // Fallback to DIAL intent which opens system phone app without direct CALL_PHONE permission
            return try {
                val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                    data = Uri.parse("tel:${Uri.encode(dialableDigits)}")
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(dialIntent)
                CallResult(true, "Dialer opened for $dialableDigits (CALL_PHONE permission required for direct placing)")
            } catch (e: Exception) {
                CallResult(false, "Failed to open system dialer: ${e.message}")
            }
        }

        // Direct cellular call initiation via TelecomManager
        if (telecomManager == null) {
            return CallResult(false, "Android TelecomManager service is unavailable")
        }

        return try {
            val uri = Uri.fromParts("tel", dialableDigits, null)
            val extras = Bundle()

            // Resolve target phone account handle (Dual SIM support)
            if (!preferredAccountHandleId.isNullOrBlank()) {
                val capableAccounts = telecomManager.callCapablePhoneAccounts
                val targetHandle = capableAccounts.find { it.id == preferredAccountHandleId }
                if (targetHandle != null) {
                    extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, targetHandle)
                    Log.i(TAG, "Routing call through designated phone account: ${targetHandle.id}")
                }
            }

            telecomManager.placeCall(uri, extras)
            Log.i(TAG, "Successfully placed real cellular call to $dialableDigits via Android Telecom")
            CallResult(true, "Calling $dialableDigits...")
        } catch (e: SecurityException) {
            Log.e(TAG, "SecurityException placing call", e)
            CallResult(false, "Permission denied: ${e.message}")
        } catch (e: Exception) {
            Log.e(TAG, "Error placing call via TelecomManager", e)
            CallResult(false, "Call initiation failed: ${e.message}")
        }
    }

    data class CallResult(val success: Boolean, val message: String)
}

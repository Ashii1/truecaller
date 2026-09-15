package com.vigilshield.telecom

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.database.ContentObserver
import android.database.Cursor
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.provider.CallLog
import android.provider.ContactsContract
import android.util.Log
import androidx.core.content.ContextCompat
import org.json.JSONObject

/** Real Android system call-log/contacts reader. */
class CallLogRepository(private val context: Context) {
    companion object { private const val TAG = "CallLogRepository" }

    interface CallLogChangeListener { fun onCallLogChanged() }
    private var contentObserver: ContentObserver? = null

    fun hasCallLogPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED

    fun hasContactsPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED

    fun registerObserver(listener: CallLogChangeListener) {
        if (!hasCallLogPermission()) return
        unregisterObserver()
        contentObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
            override fun onChange(selfChange: Boolean, uri: Uri?) {
                super.onChange(selfChange, uri)
                listener.onCallLogChanged()
            }
        }
        runCatching {
            context.contentResolver.registerContentObserver(CallLog.Calls.CONTENT_URI, true, contentObserver!!)
        }.onFailure { Log.e(TAG, "Failed to observe CallLog", it) }
    }

    fun unregisterObserver() {
        contentObserver?.let { runCatching { context.contentResolver.unregisterContentObserver(it) } }
        contentObserver = null
    }

    /**
     * Reads the real device call log.
     * Android's CallLog provider does NOT accept `LIMIT` in sortOrder;
     * the limit must be supplied with CallLog.Calls.LIMIT_PARAM_KEY.
     */
    fun fetchDeviceCallHistory(limit: Int = 100): List<DeviceCallRecord> {
        if (!hasCallLogPermission()) {
            Log.w(TAG, "READ_CALL_LOG is not granted")
            return emptyList()
        }

        val safeLimit = limit.coerceIn(1, 500)
        val uri = CallLog.Calls.CONTENT_URI.buildUpon()
            .appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY, safeLimit.toString())
            .build()

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.PHONE_ACCOUNT_ID,
            CallLog.Calls.GEOCODED_LOCATION,
            CallLog.Calls.PHONE_ACCOUNT_COMPONENT_NAME
        )

        val records = mutableListOf<DeviceCallRecord>()
        try {
            context.contentResolver.query(
                uri,
                projection,
                null,
                null,
                "${CallLog.Calls.DATE} DESC"
            )?.use { cursor ->
                val idCol = cursor.getColumnIndex(CallLog.Calls._ID)
                val numberCol = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                val nameCol = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeCol = cursor.getColumnIndex(CallLog.Calls.TYPE)
                val dateCol = cursor.getColumnIndex(CallLog.Calls.DATE)
                val durationCol = cursor.getColumnIndex(CallLog.Calls.DURATION)
                val accountCol = cursor.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
                val locationCol = cursor.getColumnIndex(CallLog.Calls.GEOCODED_LOCATION)

                while (cursor.moveToNext()) {
                    val id = cursor.stringOrEmpty(idCol).ifBlank { "call_${System.currentTimeMillis()}_${records.size}" }
                    val number = cursor.stringOrEmpty(numberCol)
                    var name = cursor.stringOrNull(nameCol)

                    // CACHED_NAME can be empty for calls that were made before the
                    // contact was saved, or when the dialer did not cache a name.
                    // Always do a live PhoneLookup when possible.
                    if (hasContactsPermission() && number.isNotBlank()) {
                        name = resolveContactName(number) ?: name
                    }

                    val type = cursor.intOrDefault(typeCol, CallLog.Calls.INCOMING_TYPE)
                    val direction = when (type) {
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                        CallLog.Calls.BLOCKED_TYPE -> "BLOCKED"
                        CallLog.Calls.ANSWERED_EXTERNALLY_TYPE -> "ANSWERED_EXTERNALLY"
                        else -> "UNKNOWN"
                    }

                    records += DeviceCallRecord(
                        id = id,
                        number = number,
                        callerName = name?.takeIf { it.isNotBlank() } ?: number.ifBlank { "Unknown caller" },
                        direction = direction,
                        timestamp = cursor.longOrDefault(dateCol, 0L),
                        durationSeconds = cursor.longOrDefault(durationCol, 0L),
                        phoneAccountId = cursor.stringOrNull(accountCol),
                        geocodedLocation = cursor.stringOrNull(locationCol),
                        isContact = !name.isNullOrBlank()
                    )
                }
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Call log permission was revoked/restricted", e)
        } catch (e: Exception) {
            Log.e(TAG, "Unable to query Android CallLog.Calls", e)
        }
        return records
    }

    fun fetchDeviceContacts(limit: Int = 300): List<DeviceContact> {
        if (!hasContactsPermission()) return emptyList()
        val safeLimit = limit.coerceIn(1, 1000)
        val contacts = mutableListOf<DeviceContact>()
        val uri = ContactsContract.CommonDataKinds.Phone.CONTENT_URI.buildUpon()
            .appendQueryParameter("limit", safeLimit.toString())
            .build()
        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.STARRED
        )

        try {
            context.contentResolver.query(
                uri, projection, null, null,
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC"
            )?.use { cursor ->
                val idCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                val nameCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numberCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                val starCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.STARRED)
                while (cursor.moveToNext()) {
                    val number = cursor.stringOrEmpty(numberCol)
                    if (number.isBlank()) continue
                    contacts += DeviceContact(
                        id = cursor.stringOrEmpty(idCol),
                        name = cursor.stringOrEmpty(nameCol).ifBlank { "Contact" },
                        number = number,
                        isFavorite = cursor.intOrDefault(starCol, 0) == 1
                    )
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Unable to query ContactsContract", e)
        }
        return contacts
    }

    /** Android's PhoneLookup is the authoritative local contact lookup for a phone number. */
    private fun resolveContactName(number: String): String? {
        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(number)
        )
        return try {
            context.contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null,
                null,
                null
            )?.use { cursor ->
                if (cursor.moveToFirst()) cursor.stringOrNull(cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)) else null
            }
        } catch (e: Exception) {
            Log.w(TAG, "PhoneLookup failed for number", e)
            null
        }
    }

    private fun Cursor.stringOrEmpty(index: Int): String = stringOrNull(index).orEmpty()
    private fun Cursor.stringOrNull(index: Int): String? = if (index >= 0 && !isNull(index)) getString(index) else null
    private fun Cursor.intOrDefault(index: Int, fallback: Int): Int = if (index >= 0 && !isNull(index)) getInt(index) else fallback
    private fun Cursor.longOrDefault(index: Int, fallback: Long): Long = if (index >= 0 && !isNull(index)) getLong(index) else fallback

    data class DeviceCallRecord(
        val id: String,
        val number: String,
        val callerName: String,
        val direction: String,
        val timestamp: Long,
        val durationSeconds: Long,
        val phoneAccountId: String?,
        val geocodedLocation: String?,
        val isContact: Boolean
    ) {
        fun toJson() = JSONObject().apply {
            put("id", id)
            put("number", number)
            put("callerName", callerName)
            put("type", direction)
            put("timestamp", timestamp)
            put("durationSeconds", durationSeconds)
            put("phoneAccountId", phoneAccountId ?: "")
            put("location", geocodedLocation ?: "")
            put("isContact", isContact)
        }
    }

    data class DeviceContact(
        val id: String,
        val name: String,
        val number: String,
        val isFavorite: Boolean
    ) {
        fun toJson() = JSONObject().apply {
            put("id", id)
            put("name", name)
            put("number", number)
            put("isFavorite", isFavorite)
        }
    }
}

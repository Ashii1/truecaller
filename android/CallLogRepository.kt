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
import org.json.JSONArray
import org.json.JSONObject

/**
 * Real Android System Call Log Repository.
 * 
 * Interacts directly with android.provider.CallLog.Calls to fetch, observe,
 * and synchronize authentic device call history.
 * 
 * Never fabricates or injects fake call entries in production mode.
 */
class CallLogRepository(private val context: Context) {

    companion object {
        private const val TAG = "CallLogRepository"
    }

    interface CallLogChangeListener {
        fun onCallLogChanged()
    }

    private var contentObserver: ContentObserver? = null

    fun hasCallLogPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_CALL_LOG
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun hasContactsPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, Manifest.permission.READ_CONTACTS
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun registerObserver(listener: CallLogChangeListener) {
        if (!hasCallLogPermission()) return
        try {
            contentObserver = object : ContentObserver(Handler(Looper.getMainLooper())) {
                override fun onChange(selfChange: Boolean, uri: Uri?) {
                    super.onChange(selfChange, uri)
                    Log.d(TAG, "Device call log changed. Emitting update.")
                    listener.onCallLogChanged()
                }
            }
            context.contentResolver.registerContentObserver(
                CallLog.Calls.CONTENT_URI,
                true,
                contentObserver!!
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register CallLog ContentObserver", e)
        }
    }

    fun unregisterObserver() {
        contentObserver?.let {
            try {
                context.contentResolver.unregisterContentObserver(it)
            } catch (e: Exception) {
                Log.w(TAG, "Failed to unregister ContentObserver", e)
            }
        }
        contentObserver = null
    }

    /**
     * Reads authentic device call records from CallLog.Calls
     */
    fun fetchDeviceCallHistory(limit: Int = 100): List<DeviceCallRecord> {
        val records = mutableListOf<DeviceCallRecord>()
        if (!hasCallLogPermission()) {
            Log.w(TAG, "Cannot fetch call history: READ_CALL_LOG permission not granted")
            return records
        }

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION,
            CallLog.Calls.PHONE_ACCOUNT_ID,
            CallLog.Calls.GEOCODED_LOCATION
        )

        val sortOrder = "${CallLog.Calls.DATE} DESC LIMIT $limit"

        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null,
                null,
                sortOrder
            )

            if (cursor != null && cursor.moveToFirst()) {
                val idCol = cursor.getColumnIndex(CallLog.Calls._ID)
                val numberCol = cursor.getColumnIndex(CallLog.Calls.NUMBER)
                val nameCol = cursor.getColumnIndex(CallLog.Calls.CACHED_NAME)
                val typeCol = cursor.getColumnIndex(CallLog.Calls.TYPE)
                val dateCol = cursor.getColumnIndex(CallLog.Calls.DATE)
                val durationCol = cursor.getColumnIndex(CallLog.Calls.DURATION)
                val accountCol = cursor.getColumnIndex(CallLog.Calls.PHONE_ACCOUNT_ID)
                val locationCol = cursor.getColumnIndex(CallLog.Calls.GEOCODED_LOCATION)

                do {
                    val id = if (idCol >= 0) cursor.getString(idCol) else "call_${System.currentTimeMillis()}"
                    val number = if (numberCol >= 0) cursor.getString(numberCol) ?: "" else ""
                    var name = if (nameCol >= 0) cursor.getString(nameCol) else null
                    val typeInt = if (typeCol >= 0) cursor.getInt(typeCol) else CallLog.Calls.INCOMING_TYPE
                    val date = if (dateCol >= 0) cursor.getLong(dateCol) else System.currentTimeMillis()
                    val duration = if (durationCol >= 0) cursor.getLong(durationCol) else 0L
                    val accountId = if (accountCol >= 0) cursor.getString(accountCol) else null
                    val location = if (locationCol >= 0) cursor.getString(locationCol) else null

                    // If contact name missing, lookup in ContactsContract if permission available
                    if (name.isNullOrBlank() && hasContactsPermission() && number.isNotBlank()) {
                        name = resolveContactName(number)
                    }

                    val direction = when (typeInt) {
                        CallLog.Calls.INCOMING_TYPE -> "INCOMING"
                        CallLog.Calls.OUTGOING_TYPE -> "OUTGOING"
                        CallLog.Calls.MISSED_TYPE -> "MISSED"
                        CallLog.Calls.REJECTED_TYPE -> "REJECTED"
                        CallLog.Calls.BLOCKED_TYPE -> "BLOCKED_CANCELLED"
                        else -> "INCOMING"
                    }

                    records.add(
                        DeviceCallRecord(
                            id = id,
                            number = number,
                            callerName = name ?: number,
                            direction = direction,
                            timestamp = date,
                            durationSeconds = duration,
                            phoneAccountId = accountId,
                            geocodedLocation = location,
                            isContact = !name.isNullOrBlank()
                        )
                    )
                } while (cursor.moveToNext())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying system CallLog", e)
        } finally {
            cursor?.close()
        }

        return records
    }

    /**
     * Reads authentic contacts from ContactsContract
     */
    fun fetchDeviceContacts(limit: Int = 300): List<DeviceContact> {
        val contacts = mutableListOf<DeviceContact>()
        if (!hasContactsPermission()) {
            return contacts
        }

        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.STARRED
        )

        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                projection,
                null,
                null,
                "${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC LIMIT $limit"
            )

            if (cursor != null && cursor.moveToFirst()) {
                val idCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                val nameCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME)
                val numCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER)
                val starCol = cursor.getColumnIndex(ContactsContract.CommonDataKinds.Phone.STARRED)

                do {
                    val id = if (idCol >= 0) cursor.getString(idCol) else ""
                    val name = if (nameCol >= 0) cursor.getString(nameCol) ?: "Contact" else "Contact"
                    val number = if (numCol >= 0) cursor.getString(numCol) ?: "" else ""
                    val isFavorite = if (starCol >= 0) cursor.getInt(starCol) == 1 else false

                    if (number.isNotBlank()) {
                        contacts.add(
                            DeviceContact(
                                id = id,
                                name = name,
                                number = number,
                                isFavorite = isFavorite
                            )
                        )
                    }
                } while (cursor.moveToNext())
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error querying ContactsContract", e)
        } finally {
            cursor?.close()
        }

        return contacts
    }

    private fun resolveContactName(number: String): String? {
        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(number)
        )
        val projection = arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME)
        var cursor: Cursor? = null
        try {
            cursor = context.contentResolver.query(uri, projection, null, null, null)
            if (cursor != null && cursor.moveToFirst()) {
                val nameCol = cursor.getColumnIndex(ContactsContract.PhoneLookup.DISPLAY_NAME)
                if (nameCol >= 0) {
                    return cursor.getString(nameCol)
                }
            }
        } catch (e: Exception) {
            // Ignore
        } finally {
            cursor?.close()
        }
        return null
    }

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
        fun toJson(): JSONObject {
            return JSONObject().apply {
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
    }

    data class DeviceContact(
        val id: String,
        val name: String,
        val number: String,
        val isFavorite: Boolean
    ) {
        fun toJson(): JSONObject {
            return JSONObject().apply {
                put("id", id)
                put("name", name)
                put("number", number)
                put("isFavorite", isFavorite)
            }
        }
    }
}

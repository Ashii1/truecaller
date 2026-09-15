package com.vigilshield.telecom

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.CallLog
import android.provider.ContactsContract
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.CallScreeningService as AndroidCallScreeningService
import android.telecom.InCallService
import android.telecom.TelecomManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject

class AndroidTelephonyBridge(private val activity: Activity, private val webView: WebView) {
    companion object { const val INTERFACE_NAME = "AndroidTelecomBridge" }
    private val telecom: TelecomManager get() = activity.getSystemService(TelecomManager::class.java)
    init { NativeInCallService.bridge = this; NativeInCallService.appContext = activity.applicationContext }

    @JavascriptInterface fun checkDefaultDialerStatus(): String = roleStatus().toString()
    @JavascriptInterface fun requestDefaultDialerRole(): Boolean {
        if (Build.VERSION.SDK_INT < 29) return false
        val rm = activity.getSystemService(android.app.role.RoleManager::class.java)
        if (!rm.isRoleAvailable(android.app.role.RoleManager.ROLE_DIALER)) return false
        activity.startActivityForResult(rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_DIALER), 7001); return true
    }
    @JavascriptInterface fun requestCallScreeningRole(): Boolean {
        if (Build.VERSION.SDK_INT < 29) return false
        val rm = activity.getSystemService(android.app.role.RoleManager::class.java)
        if (!rm.isRoleAvailable(android.app.role.RoleManager.ROLE_CALL_SCREENING)) return false
        if (rm.isRoleHeld(android.app.role.RoleManager.ROLE_CALL_SCREENING)) return true
        activity.startActivityForResult(rm.createRequestRoleIntent(android.app.role.RoleManager.ROLE_CALL_SCREENING), 7003); return true
    }
    @JavascriptInterface fun getPhoneAccounts(): String = JSONArray().also { out ->
        telecom.callCapablePhoneAccounts.forEachIndexed { i, h -> out.put(JSONObject().put("id", h.id).put("label", h.id).put("carrierName", h.componentName.packageName).put("slotIndex", i).put("displayName", "SIM ${i + 1}").put("isDefault", false)) }
    }.toString()
    @JavascriptInterface fun getTelephonyDiagnostics(): String {
        val accounts = telecom.callCapablePhoneAccounts
        val audio = activity.getSystemService(AudioManager::class.java)
        return JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
            .put("isCallScreeningRoleHeld", if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(android.app.role.RoleManager::class.java).isRoleHeld(android.app.role.RoleManager.ROLE_CALL_SCREENING) else false)
            .put("isInCallServiceBound", NativeInCallService.instance != null).put("hasSim", accounts.isNotEmpty()).put("isAirplaneMode", false)
            .put("isNetworkAvailable", true).put("networkOperatorName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown")
            .put("simCarrierIdName", accounts.firstOrNull()?.componentName?.packageName ?: "Unknown").put("activeCallsCount", NativeInCallService.activeCalls.size)
            .put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission())
            .put("ringerMode", audio.ringerMode).put("sim1Available", accounts.isNotEmpty()).put("sim1Carrier", accounts.firstOrNull()?.componentName?.packageName ?: "None")
            .put("sim2Available", accounts.size > 1).put("sim2Carrier", if (accounts.size > 1) accounts[1].componentName.packageName else "None").toString()
    }
    @JavascriptInterface fun placeRealCall(number: String, accountHandleId: String?): String {
        if (!isDefaultDialer()) return JSONObject().put("success", false).put("message", "VigilShield must be the default Phone app").toString()
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.CALL_PHONE) != PackageManager.PERMISSION_GRANTED) return JSONObject().put("success", false).put("message", "CALL_PHONE permission is required").toString()
        return try {
            val extras = Bundle(); val selected = telecom.callCapablePhoneAccounts.firstOrNull { it.id == accountHandleId } ?: telecom.callCapablePhoneAccounts.firstOrNull()
            selected?.let { extras.putParcelable(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, it) }
            telecom.placeCall(Uri.fromParts("tel", number, null), extras); JSONObject().put("success", true).put("message", "Call sent to Android Telecom").toString()
        } catch (e: Exception) { JSONObject().put("success", false).put("message", e.message ?: "Unable to place call").toString() }
    }
    @JavascriptInterface fun fetchRealContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchDeviceContacts(limit: Int): String = readContacts(limit).toString()
    @JavascriptInterface fun fetchRealCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun fetchDeviceCallLogs(limit: Int): String = readCallLogs(limit).toString()
    @JavascriptInterface fun lookupContactName(number: String): String = lookupName(number).orEmpty()
    @JavascriptInterface fun answerCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.answer(0); NativeInCallService.stopRinging(); true } ?: false
    @JavascriptInterface fun rejectCall(id: String, reason: String?): Boolean = NativeInCallService.activeCalls[id]?.let { it.reject(false, reason ?: ""); NativeInCallService.stopRinging(); true } ?: false
    @JavascriptInterface fun disconnectCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.disconnect(); NativeInCallService.stopRinging(); true } ?: false
    @JavascriptInterface fun setMuted(v: Boolean): Boolean = NativeInCallService.instance?.let { it.setMuted(v); true } ?: false
    @JavascriptInterface fun setSpeakerRoute(v: Boolean): Boolean = NativeInCallService.instance?.setSpeaker(v) ?: false
    @JavascriptInterface fun sendDtmfTone(id: String, digit: String): Boolean { val c=NativeInCallService.activeCalls[id] ?: return false; val d=digit.firstOrNull() ?: return false; c.playDtmfTone(d); c.stopDtmfTone(); return true }
    @JavascriptInterface fun holdCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.hold(); true } ?: false
    @JavascriptInterface fun unholdCall(id: String): Boolean = NativeInCallService.activeCalls[id]?.let { it.unhold(); true } ?: false
    @JavascriptInterface fun swapCalls(): Boolean = NativeInCallService.swapCalls()
    @JavascriptInterface fun mergeCalls(): Boolean = NativeInCallService.mergeCalls()
    @JavascriptInterface fun syncBlockRules(json: String): Boolean = activity.getSharedPreferences("vigilshield", Context.MODE_PRIVATE).edit().putString("block_rules", json).apply().let { true }
    @JavascriptInterface fun syncWhitelist(json: String): Boolean = activity.getSharedPreferences("vigilshield", Context.MODE_PRIVATE).edit().putString("whitelist", json).apply().let { true }

    fun isDefaultDialer(): Boolean = if (Build.VERSION.SDK_INT >= 29) activity.getSystemService(android.app.role.RoleManager::class.java).isRoleHeld(android.app.role.RoleManager.ROLE_DIALER) else telecom.defaultDialerPackage == activity.packageName
    fun hasCallLogPermission(): Boolean = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CALL_LOG) == PackageManager.PERMISSION_GRANTED
    fun hasContactsPermission(): Boolean = ContextCompat.checkSelfPermission(activity, Manifest.permission.READ_CONTACTS) == PackageManager.PERMISSION_GRANTED
    fun hasDevicePermissions(): Boolean = hasContactsPermission()
    fun roleStatus(): JSONObject = JSONObject().put("isDefaultDialer", isDefaultDialer()).put("isDialerRoleAvailable", Build.VERSION.SDK_INT >= 29)
    fun permissionStatus(): JSONObject = JSONObject().put("callLogPermission", hasCallLogPermission()).put("contactsPermission", hasContactsPermission())
    fun dispatchWebEvent(type: String, data: JSONObject) { webView.post { webView.evaluateJavascript("if(window.__onAndroidTelecomEvent){window.__onAndroidTelecomEvent(${JSONObject.quote(type)},$data);}", null) } }
    fun dispatchCallEvent(type: String, data: JSONObject) = dispatchWebEvent(type, data)

    private fun readContacts(limit: Int): JSONArray {
        val out=JSONArray(); if(!hasContactsPermission()) return out
        val p=arrayOf(ContactsContract.CommonDataKinds.Phone.CONTACT_ID,ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME,ContactsContract.CommonDataKinds.Phone.NUMBER,ContactsContract.CommonDataKinds.Phone.STARRED)
        activity.contentResolver.query(ContactsContract.CommonDataKinds.Phone.CONTENT_URI,p,null,null,"${ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME} ASC")?.use { c -> var n=0; while(c.moveToNext() && n<limit.coerceIn(1,2000)){out.put(JSONObject().put("id",c.getString(0).orEmpty()).put("name",c.getString(1).orEmpty()).put("number",c.getString(2).orEmpty()).put("isFavorite",c.getInt(3)==1));n++} }
        return out
    }
    private fun lookupName(number:String):String? { if(!hasContactsPermission()||number.isBlank()) return null; return activity.contentResolver.query(Uri.withAppendedPath(ContactsContract.PhoneLookup.CONTENT_FILTER_URI,Uri.encode(number)),arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),null,null,null)?.use{if(it.moveToFirst())it.getString(0)else null} }
    private fun readCallLogs(limit:Int):JSONArray {
        val out=JSONArray()
        if(hasCallLogPermission()){
            val uri=CallLog.Calls.CONTENT_URI.buildUpon().appendQueryParameter(CallLog.Calls.LIMIT_PARAM_KEY,limit.coerceIn(1,500).toString()).build()
            val p=arrayOf(CallLog.Calls._ID,CallLog.Calls.NUMBER,CallLog.Calls.CACHED_NAME,CallLog.Calls.TYPE,CallLog.Calls.DATE,CallLog.Calls.DURATION)
            activity.contentResolver.query(uri,p,null,null,"${CallLog.Calls.DATE} DESC")?.use{c->while(c.moveToNext()){val number=c.getString(1).orEmpty();val name=lookupName(number)?:c.getString(2);out.put(JSONObject().put("id",c.getString(0).orEmpty()).put("number",number).put("callerName",name?:number.ifBlank{"Unknown caller"}).put("type",when(c.getInt(3)){CallLog.Calls.INCOMING_TYPE->"INCOMING";CallLog.Calls.OUTGOING_TYPE->"OUTGOING";CallLog.Calls.MISSED_TYPE->"MISSED";CallLog.Calls.REJECTED_TYPE->"REJECTED";CallLog.Calls.BLOCKED_TYPE->"BLOCKED_CANCELLED";else->"UNKNOWN"}).put("timestamp",c.getLong(4)).put("durationSeconds",c.getLong(5)).put("isContact",!name.isNullOrBlank()&&name!=number))}}
        } else NativeInCallService.readHistory(limit).forEach(out::put)
        return out
    }
}

class NativeInCallService : InCallService() {
    companion object {
        var instance: NativeInCallService?=null
        var bridge: AndroidTelephonyBridge?=null
        var appContext: Context?=null
        val activeCalls:MutableMap<String,Call> = mutableMapOf()
        private val ids=mutableMapOf<Call,String>()
        private val callbacks=mutableMapOf<String,Call.Callback>()
        private var ringtone:Ringtone?=null
        private var vibrator:Vibrator?=null
        private var vibrating=false
        fun stopRinging(){ try{ringtone?.stop()}catch(_:Exception){};ringtone=null; if(vibrating)try{vibrator?.cancel()}catch(_:Exception){};vibrating=false }
        private fun startRinging(){
            stopRinging()
            val ctx=appContext ?: return
            val audio=ctx.getSystemService(AudioManager::class.java)
            when(audio.ringerMode){
                AudioManager.RINGER_MODE_SILENT -> return
                AudioManager.RINGER_MODE_VIBRATE -> {
                    vibrator=ctx.getSystemService(Vibrator::class.java)
                    val pattern=longArrayOf(0,450,350,450,700)
                    if(Build.VERSION.SDK_INT>=26) vibrator?.vibrate(VibrationEffect.createWaveform(pattern,0)) else @Suppress("DEPRECATION") vibrator?.vibrate(pattern,0)
                    vibrating=true
                }
                else -> {
                    val uri=RingtoneManager.getActualDefaultRingtoneUri(ctx,RingtoneManager.TYPE_RINGTONE) ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                    ringtone=RingtoneManager.getRingtone(ctx,uri)
                    ringtone?.audioAttributes=android.media.AudioAttributes.Builder().setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE).setContentType(android.media.AudioAttributes.CONTENT_TYPE_MUSIC).build()
                    ringtone?.play()
                }
            }
        }
        fun readHistory(limit:Int):List<JSONObject>{ val out=mutableListOf<JSONObject>(); try{val a=JSONArray(appContext?.getSharedPreferences("vigilshield",Context.MODE_PRIVATE)?.getString("call_history","[]")?:"[]");for(i in 0 until minOf(a.length(),limit.coerceIn(1,500)))out+=a.getJSONObject(i)}catch(_:Exception){};return out }
        fun swapCalls():Boolean{val held=activeCalls.values.firstOrNull{it.state==Call.STATE_HOLDING};val active=activeCalls.values.firstOrNull{it.state==Call.STATE_ACTIVE};if(held==null||active==null)return false;active.hold();held.unhold();return true}
        fun mergeCalls():Boolean{val c=activeCalls.values.toList();if(c.size<2)return false;return try{c[0].conference(c[1]);true}catch(_:Exception){false}}
        fun persist(call:Call,removed:Boolean=false){try{val p=appContext?.getSharedPreferences("vigilshield",Context.MODE_PRIVATE)?:return;val a=JSONArray(p.getString("call_history","[]"));val id=ids[call]?:return;val num=call.details.handle?.schemeSpecificPart.orEmpty();val name=bridge?.lookupContactName(num).orEmpty().ifBlank{call.details.callerDisplayName.orEmpty()}.ifBlank{num.ifBlank{"Unknown caller"}};var at=-1;for(i in 0 until a.length())if(a.optJSONObject(i)?.optString("id")==id){at=i;break};val connected=call.details.connectTimeMillis;val dur=if(connected>0)((System.currentTimeMillis()-connected)/1000).coerceAtLeast(0)else 0;val obj=JSONObject().put("id",id).put("number",num).put("callerName",name).put("type",if(call.details.callDirection==Call.Details.DIRECTION_INCOMING)"INCOMING"else"OUTGOING").put("timestamp",if(at>=0)a.getJSONObject(at).optLong("timestamp",System.currentTimeMillis())else System.currentTimeMillis()).put("durationSeconds",dur).put("isContact",bridge?.lookupContactName(num)?.isNotBlank()==true);if(at>=0)a.put(at,obj)else a.put(0,obj);while(a.length()>500)a.remove(a.length()-1);p.edit().putString("call_history",a.toString()).apply()}catch(_:Exception){}}
    }
    override fun onCallAdded(call:Call){super.onCallAdded(call);instance=this;val id="call-${System.identityHashCode(call)}-${System.currentTimeMillis()}";ids[call]=id;activeCalls[id]=call;val cb=object:Call.Callback(){override fun onStateChanged(c:Call,s:Int){if(s==Call.STATE_RINGING&&c.details.callDirection==Call.Details.DIRECTION_INCOMING)startRinging();if(s!=Call.STATE_RINGING)stopRinging();emit(c,s);persist(c)}};callbacks[id]=cb;call.registerCallback(cb);persist(call);if(call.state==Call.STATE_RINGING&&call.details.callDirection==Call.Details.DIRECTION_INCOMING)startRinging();emit(call,call.state)}
    private fun emit(call:Call,state:Int){val id=ids[call]?:return;val num=call.details.handle?.schemeSpecificPart.orEmpty();val incoming=call.details.callDirection==Call.Details.DIRECTION_INCOMING;val name=bridge?.lookupContactName(num).orEmpty().ifBlank{call.details.callerDisplayName.orEmpty()};val stateName=when(state){Call.STATE_NEW->"NEW";Call.STATE_RINGING->"RINGING";Call.STATE_DIALING->"DIALING";Call.STATE_CONNECTING->"CONNECTING";Call.STATE_ACTIVE->"ACTIVE";Call.STATE_HOLDING->"HOLDING";Call.STATE_DISCONNECTED->"DISCONNECTED";else->"UNKNOWN"};val details=JSONObject().put("number",num).put("callerDisplayName",name).put("state",stateName).put("isIncoming",incoming).put("durationSeconds",if(call.details.connectTimeMillis>0)((System.currentTimeMillis()-call.details.connectTimeMillis)/1000).coerceAtLeast(0)else 0).put("isHolding",state==Call.STATE_HOLDING);bridge?.dispatchCallEvent(if(state==Call.STATE_DISCONNECTED)"CALL_DISCONNECTED"else if(state==Call.STATE_NEW)"CALL_ADDED"else"CALL_STATE_CHANGED",JSONObject().put("callId",id).put("details",details))}
    override fun onCallRemoved(call:Call){stopRinging();val id=ids[call]?:return;persist(call,true);callbacks.remove(id)?.let{call.unregisterCallback(it)};activeCalls.remove(id);ids.remove(call);if(activeCalls.isEmpty())instance=null;bridge?.dispatchCallEvent("CALL_REMOVED",JSONObject().put("callId",id));super.onCallRemoved(call)}
    fun setSpeaker(enabled:Boolean):Boolean=try{setAudioRoute(if(enabled)CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE);true}catch(_:Exception){false}
}

class CallScreeningService : AndroidCallScreeningService() {
    override fun onScreenCall(details:Call.Details){val n=details.handle?.schemeSpecificPart.orEmpty().filter{it.isDigit()};val p=getSharedPreferences("vigilshield",Context.MODE_PRIVATE);val rules=try{JSONArray(p.getString("block_rules","[]"))}catch(_:Exception){JSONArray()};val white=try{JSONArray(p.getString("whitelist","[]"))}catch(_:Exception){JSONArray()};if(details.callDirection!=Call.Details.DIRECTION_INCOMING){respondToCall(details,CallResponse.Builder().setDisallowCall(false).build());return};for(i in 0 until white.length()){val v=white.optJSONObject(i)?.optString("value").orEmpty().filter{it.isDigit()};if(v.isNotEmpty()&&(n==v||n.endsWith(v))){respondToCall(details,CallResponse.Builder().setDisallowCall(false).setRejectCall(false).build());return}};var blocked=false;for(i in 0 until rules.length()){val r=rules.optJSONObject(i)?:continue;if(!r.optBoolean("enabled",true))continue;val target=r.optString("targetType","BOTH");if(target!="CALL"&&target!="BOTH")continue;val v=r.optString("value").filter{it.isDigit()};val m=r.optString("matchType","PREFIX");if(v.isNotEmpty()&&((m=="PREFIX"&&n.startsWith(v))||(m=="EXACT"&&n==v))){blocked=true;break}};respondToCall(details,CallResponse.Builder().setDisallowCall(blocked).setRejectCall(blocked).setSkipCallLog(false).setSkipNotification(false).build())}
}

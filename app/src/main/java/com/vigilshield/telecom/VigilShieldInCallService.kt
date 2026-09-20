package com.vigilshield.telecom

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.telecom.Call
import android.telecom.CallAudioState
import android.telecom.InCallService
import android.telecom.VideoProfile
import android.util.Log
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject
import android.provider.CallLog
import java.util.concurrent.ConcurrentHashMap

/**
 * Official Android InCallService Implementation for CallShield.
 *
 * When CallShield is granted the default dialer role (ROLE_DIALER) by Android Telecom,
 * Android binds this service for the real cellular call lifecycle and in-call UI ownership.
 */
@RequiresApi(Build.VERSION_CODES.Q)
class VigilShieldInCallService : InCallService() {
    companion object {
        private const val TAG = "CallShieldInCall"
        var instance: VigilShieldInCallService? = null
            private set
        var bridge: AndroidTelephonyBridge? = null
        var appContext: Context? = null
        val activeCalls = ConcurrentHashMap<String, Call>()
        var callEventListener: CallEventListener? = null
        fun isServiceBound(): Boolean = instance != null
        fun stopRinging() { appContext?.let { CallRingerHelper.silenceRinger(it) }; runCatching { appContext?.getSystemService(android.telecom.TelecomManager::class.java)?.silenceRinger() } }
        fun isRinging(): Boolean = CallRingerHelper.isRinging() || activeCalls.values.any { it.state == Call.STATE_RINGING }
        fun emitActiveCalls() { activeCalls.forEach { (id, call) -> instance?.let { svc -> bridge?.dispatchCallEvent("CALL_STATE_CHANGED", JSONObject().put("callId", id).put("details", svc.extractCallDetails(call, id).toJson())) } } }
        fun swapCalls(): Boolean = instance?.swapCallsInternal() ?: false
        fun mergeCalls(): Boolean = instance?.mergeCallsInternal() ?: false
        fun setSpeaker(enabled: Boolean): Boolean = instance?.setSpeakerRoute(enabled) != null
        fun readHistory(limit: Int): List<JSONObject> { val out = mutableListOf<JSONObject>(); runCatching { val a = JSONArray(appContext?.getSharedPreferences("vigilshield", Context.MODE_PRIVATE)?.getString("call_history", "[]") ?: "[]"); for (i in 0 until minOf(a.length(), limit.coerceIn(1, 500))) out += a.getJSONObject(i) }; return out }
    }
    interface CallEventListener { fun onCallStateChanged(callId: String, state: String, details: CallDetailsDto); fun onCallAdded(callId: String, details: CallDetailsDto); fun onCallRemoved(callId: String, details: CallDetailsDto, disconnectReason: String); fun onAudioStateChanged(isMuted: Boolean, route: String) }
    data class CallDetailsDto(val id: String,val number: String,val callerDisplayName: String?,val state: String,val isIncoming: Boolean,val isHolding: Boolean,val connectTimeMillis: Long,val durationSeconds: Long,val simAccount: String?,val verificationStatus: Int,val canHold: Boolean,val canMerge: Boolean,val canSwap: Boolean) { fun toJson(): JSONObject = JSONObject().apply { put("id",id);put("number",number);put("callerDisplayName",callerDisplayName ?: "");put("state",state);put("isIncoming",isIncoming);put("isHolding",isHolding);put("connectTimeMillis",connectTimeMillis);put("durationSeconds",durationSeconds);put("simAccount",simAccount ?: "");put("verificationStatus",verificationStatus);put("canHold",canHold);put("canMerge",canMerge);put("canSwap",canSwap) } }
    private val callCallbacks = ConcurrentHashMap<String, Call.Callback>()
    override fun onCreate() { super.onCreate(); instance=this;appContext=applicationContext;ensureRingerNotMuted(applicationContext);CallNotificationHelper.ensureChannel(applicationContext);Log.i(TAG,"CallShield InCallService instantiated and bound by Android Telecom.") }
    override fun onDestroy() { activeCalls.clear();callCallbacks.clear();instance=null;super.onDestroy() }
    override fun onCallAdded(call: Call) {
        super.onCallAdded(call); val callId=getCallIdentifier(call);activeCalls[callId]=call
        val callback=object:Call.Callback(){
            override fun onStateChanged(call: Call,state:Int){
                super.onStateChanged(call,state);val stateName=stateToString(state);val details=extractCallDetails(call,callId);val name=details.callerDisplayName.orEmpty().ifBlank{details.number.ifBlank{"Unknown caller"}};val number=details.number
                when(state){
                    Call.STATE_RINGING->handleIncomingCall(call,callId)
                    Call.STATE_ACTIVE,Call.STATE_DIALING,Call.STATE_CONNECTING,Call.STATE_HOLDING->{CallRingerHelper.stopRinging(applicationContext);CallNotificationHelper.clearCall(applicationContext,callId);CallNotificationHelper.showOngoingCall(applicationContext,callId,name,number,stateName,details.connectTimeMillis);if(state==Call.STATE_ACTIVE||state==Call.STATE_HOLDING)launchCallShieldInCallSurface(callId,name,number)}
                    Call.STATE_DISCONNECTED->{CallRingerHelper.stopRinging(applicationContext);CallNotificationHelper.clearCall(applicationContext,callId);if(details.isIncoming&&details.connectTimeMillis<=0L)CallNotificationHelper.showMissedCall(applicationContext,name,number)}
                }
                callEventListener?.onCallStateChanged(callId,stateName,details);bridge?.dispatchCallEvent(if(state==Call.STATE_DISCONNECTED)"CALL_DISCONNECTED" else "CALL_STATE_CHANGED",JSONObject().put("callId",callId).put("details",details.toJson()))
            }
            override fun onDetailsChanged(call:Call,details:Call.Details){super.onDetailsChanged(call,details);callEventListener?.onCallStateChanged(callId,stateToString(call.state),extractCallDetails(call,callId))}
            override fun onConferenceableCallsChanged(call:Call,conferenceableCalls:MutableList<Call>?){super.onConferenceableCallsChanged(call,conferenceableCalls);callEventListener?.onCallStateChanged(callId,stateToString(call.state),extractCallDetails(call,callId))}
        }
        callCallbacks[callId]=callback;call.registerCallback(callback)
        val initial=extractCallDetails(call,callId);val name=initial.callerDisplayName.orEmpty().ifBlank{initial.number.ifBlank{"Unknown caller"}};val number=initial.number
        if(call.state==Call.STATE_RINGING)handleIncomingCall(call,callId) else if(call.state==Call.STATE_ACTIVE||call.state==Call.STATE_HOLDING){CallNotificationHelper.showOngoingCall(applicationContext,callId,name,number,stateToString(call.state),initial.connectTimeMillis);launchCallShieldInCallSurface(callId,name,number)}
        callEventListener?.onCallAdded(callId,initial);bridge?.dispatchCallEvent(if(call.state==Call.STATE_RINGING)"CALL_ADDED" else "CALL_STATE_CHANGED",JSONObject().put("callId",callId).put("details",initial.toJson()))
    }
    override fun onCallRemoved(call:Call){super.onCallRemoved(call);val id=getCallIdentifier(call);callCallbacks.remove(id)?.let{call.unregisterCallback(it)};val d=extractCallDetails(call,id);activeCalls.remove(id);CallRingerHelper.stopRinging(applicationContext);CallNotificationHelper.clearCall(applicationContext,id);if(activeCalls.isEmpty()){CallNotificationHelper.clearAllCallNotifications(applicationContext);ensureRingerNotMuted(applicationContext);releaseWakeLock()};callEventListener?.onCallRemoved(id,d,call.details.disconnectCause?.description?.toString() ?: "Call ended");bridge?.dispatchCallEvent("CALL_DISCONNECTED",JSONObject().put("callId",id).put("details",d.toJson()))}
    override fun onCallAudioStateChanged(audioState:CallAudioState?){super.onCallAudioStateChanged(audioState);if(audioState==null)return;val route=when(audioState.route){CallAudioState.ROUTE_SPEAKER->"SPEAKER";CallAudioState.ROUTE_BLUETOOTH->"BLUETOOTH";CallAudioState.ROUTE_WIRED_HEADSET->"HEADSET";else->"EARPIECE"};callEventListener?.onAudioStateChanged(audioState.isMuted,route)}
    fun answerCall(id:String):Boolean{CallRingerHelper.stopRinging(applicationContext);val c=activeCalls[id]?:return false;if(c.state==Call.STATE_RINGING){c.answer(VideoProfile.STATE_AUDIO_ONLY);return true};return false}
    fun rejectCall(id:String,msg:String?=null):Boolean{CallRingerHelper.stopRinging(applicationContext);val c=activeCalls[id]?:return false;if(c.state==Call.STATE_RINGING){if(msg!=null)c.reject(true,msg)else c.reject(false,null);return true};return false}
    fun disconnectCall(id:String):Boolean{CallRingerHelper.stopRinging(applicationContext);val c=activeCalls[id]?:return false;c.disconnect();return true}
    fun setCallMute(m:Boolean){setMuted(m)}
    fun setSpeaker(enabled:Boolean):Boolean=runCatching{setAudioRoute(if(enabled)CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE);true}.getOrDefault(false)
    fun setSpeakerRoute(enabled:Boolean){setAudioRoute(if(enabled)CallAudioState.ROUTE_SPEAKER else CallAudioState.ROUTE_EARPIECE)}
    fun sendDtmfTone(id:String,d:Char):Boolean{val c=activeCalls[id]?:return false;if(c.state==Call.STATE_ACTIVE){c.playDtmfTone(d);c.stopDtmfTone();return true};return false}
    fun holdCall(id:String):Boolean{val c=activeCalls[id]?:return false;if(c.state==Call.STATE_ACTIVE){c.hold();return true};return false}
    fun unholdCall(id:String):Boolean{val c=activeCalls[id]?:return false;if(c.state==Call.STATE_HOLDING){c.unhold();return true};return false}
    fun swapCalls():Boolean{val a=activeCalls.values.find{it.state==Call.STATE_ACTIVE};val h=activeCalls.values.find{it.state==Call.STATE_HOLDING};if(a!=null&&h!=null){a.hold();h.unhold();return true};return false}
    fun mergeCalls():Boolean{val a=activeCalls.values.find{it.state==Call.STATE_ACTIVE};val c=a?.conferenceableCalls;if(a!=null&&!c.isNullOrEmpty()){a.conference(c[0]);return true};return false}
    private fun swapCallsInternal():Boolean=swapCalls();private fun mergeCallsInternal():Boolean=mergeCalls()
    private fun getCallIdentifier(call:Call):String="call_${call.details?.handle?.schemeSpecificPart ?: "unknown"}_${call.hashCode()}"
    private fun extractCallDetails(call:Call,id:String):CallDetailsDto{val d=call.details;val n=d?.handle?.schemeSpecificPart ?: "";val incoming=d?.hasProperty(Call.Details.PROPERTY_IS_EXTERNAL_CALL)==true||call.state==Call.STATE_RINGING||(Build.VERSION.SDK_INT>=Build.VERSION_CODES.Q&&d?.callDirection==Call.Details.DIRECTION_INCOMING);val ct=d?.connectTimeMillis?:0L;val caps=d?.callCapabilities?:0;return CallDetailsDto(id,n,d?.callerDisplayName,stateToString(call.state),incoming,call.state==Call.STATE_HOLDING,ct,if(ct>0)(System.currentTimeMillis()-ct)/1000 else 0L,d?.accountHandle?.id,0,(caps and Call.Details.CAPABILITY_HOLD)!=0||(caps and Call.Details.CAPABILITY_SUPPORT_HOLD)!=0,(caps and Call.Details.CAPABILITY_MERGE_CONFERENCE)!=0,(caps and Call.Details.CAPABILITY_SWAP_CONFERENCE)!=0)}
    private fun stateToString(s:Int):String=when(s){Call.STATE_NEW->"NEW";Call.STATE_CONNECTING->"CONNECTING";Call.STATE_SELECT_PHONE_ACCOUNT->"SELECT_PHONE_ACCOUNT";Call.STATE_DIALING->"DIALING";Call.STATE_RINGING->"RINGING";Call.STATE_ACTIVE->"ACTIVE";Call.STATE_HOLDING->"HOLDING";Call.STATE_DISCONNECTED->"DISCONNECTED";Call.STATE_DISCONNECTING->"DISCONNECTING";else->"UNKNOWN"}
    private var incomingWakeLock:android.os.PowerManager.WakeLock?=null
    private fun handleIncomingCall(call:Call,id:String){val d=extractCallDetails(call,id);val name=d.callerDisplayName.orEmpty().ifBlank{d.number.ifBlank{"Incoming call"}};val number=d.number;wakeScreenUp(applicationContext);CallRingerHelper.startRinging(applicationContext);CallNotificationHelper.showIncomingCall(applicationContext,id,name,number);val km=applicationContext.getSystemService(android.app.KeyguardManager::class.java);val locked=km?.isKeyguardLocked==true;val sp=applicationContext.getSharedPreferences("vigilshield",Context.MODE_PRIVATE);val top=sp.getBoolean("always_on_top_call_overlay",true);if(locked||!MainActivity.isAppVisible||top)launchIncomingCallActivity(applicationContext,id,name,number)}
    private fun wakeScreenUp(context:Context){runCatching{val pm=context.getSystemService(android.os.PowerManager::class.java)?:return;if(incomingWakeLock?.isHeld==true)runCatching{incomingWakeLock?.release()};@Suppress("DEPRECATION") incomingWakeLock=pm.newWakeLock(android.os.PowerManager.FULL_WAKE_LOCK or android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP or android.os.PowerManager.ON_AFTER_RELEASE,"CallShield:IncomingWakeLock").apply{setReferenceCounted(false);acquire(45_000L)}}}
    private fun releaseWakeLock(){runCatching{if(incomingWakeLock?.isHeld==true)incomingWakeLock?.release();incomingWakeLock=null}}
    private fun launchIncomingCallActivity(context:Context,id:String,name:String,number:String){runCatching{val intent=Intent(context,IncomingCallActivity::class.java).apply{putExtra("open_call_id",id);putExtra("open_call_number",number);putExtra("display_name",name);addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)};context.startActivity(intent)}}
    private fun launchCallShieldInCallSurface(id:String,name:String,number:String){runCatching{val intent=Intent(applicationContext,MainActivity::class.java).apply{action="com.vigilshield.telecom.OPEN_INCOMING_CALL";putExtra("open_call_id",id);putExtra("open_call_number",number);putExtra("open_call_name",name);putExtra("open_tab","incoming");putExtra("is_incoming_call",true);putExtra("phone_surface",true);addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)};applicationContext.startActivity(intent)}.onFailure{Log.e(TAG,"Unable to foreground CallShield in-call UI",it)}}
    private fun ensureRingerNotMuted(context:Context){runCatching{val audio=context.getSystemService(android.media.AudioManager::class.java)?:return;if(audio.ringerMode==android.media.AudioManager.RINGER_MODE_NORMAL&&Build.VERSION.SDK_INT>=Build.VERSION_CODES.M){if(audio.isStreamMute(android.media.AudioManager.STREAM_RING))audio.adjustStreamVolume(android.media.AudioManager.STREAM_RING,android.media.AudioManager.ADJUST_UNMUTE,0);if(audio.isStreamMute(android.media.AudioManager.STREAM_NOTIFICATION))audio.adjustStreamVolume(android.media.AudioManager.STREAM_NOTIFICATION,android.media.AudioManager.ADJUST_UNMUTE,0)}}}
}
